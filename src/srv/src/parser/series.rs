//! Port of `src/parser/series.js` — season links + current season playlists.

use std::sync::LazyLock;

use scrape_core::{CompiledSelector, Soup};

use crate::http::Upstream;
use crate::models::{SeasonLink, Series};
use crate::parser::playlists;
use crate::text::{find_date_cut, js_trim};

static SINFO: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo").unwrap());
static SEASONS_LINK: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-seaslist .tabs-result a").unwrap());

/// Port of `parseSeries`.
pub async fn parse_series(
    html: &str,
    target_url: &str,
    upstream: &Upstream,
) -> Result<Series, String> {
    let soup = Soup::parse(html);

    // JS: attr('data-id-serial') || attr('data-id-season') || ''
    let id_serial = soup
        .find_compiled(&SINFO)
        .and_then(|el| {
            el.get("data-id-serial")
                .filter(|v| !v.is_empty())
                .or_else(|| el.get("data-id-season"))
                .map(str::to_string)
        })
        .unwrap_or_default();

    let mut seasons = Vec::new();
    for link in soup.select_compiled(&SEASONS_LINK) {
        let text = link.text();
        let text = js_trim(&text);
        let is_current = text.contains(">>>");
        // Both JS branches strip one leading `>>>`, then trim.
        let mut title = js_trim(text.strip_prefix(">>>").unwrap_or(text));
        // Drop the trailing "DD.MM.YYYY …" date + episode info.
        if let Some(cut) = find_date_cut(title) {
            title = js_trim(&title[..cut]);
        }
        let href = link.get("href").unwrap_or("");
        let link_out = if href.is_empty() {
            "#".to_string()
        } else if href.starts_with("http") {
            href.to_string()
        } else {
            format!("{target_url}{href}")
        };
        seasons.push(SeasonLink {
            title: title.to_string(),
            link: link_out,
            is_current,
        });
    }

    // The document is parsed once and shared with the playlist parser
    // (the JS version parses the same HTML twice).
    let current_season_playlists = playlists::parse_from_soup(&soup, upstream).await?;

    Ok(Series {
        id_serial,
        seasons,
        current_season_playlists,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET: &str = "https://seasonvar.ru";

    const FIXTURE: &str = r#"
<html><body>
  <div class="pgs-seaslist">
    <div class="tabs-result">
      <a href="/s1.html">>>>Сезон 1 01.01.2024 8 серий</a>
      <a href="/s2.html">Сезон 2 05.05.2023 10 серий</a>
    </div>
  </div>
</body></html>"#;

    #[tokio::test]
    async fn extracts_seasons_and_cleans_titles() {
        // No scripts / translate lists in the fixture -> no network access.
        let upstream = Upstream::new().unwrap();
        let series = parse_series(FIXTURE, TARGET, &upstream).await.unwrap();

        assert_eq!(series.id_serial, "");
        assert_eq!(series.seasons.len(), 2);
        assert_eq!(series.seasons[0].title, "Сезон 1");
        assert_eq!(series.seasons[0].link, format!("{TARGET}/s1.html"));
        assert!(series.seasons[0].is_current);
        assert_eq!(series.seasons[1].title, "Сезон 2");
        assert_eq!(series.seasons[1].link, format!("{TARGET}/s2.html"));
        assert!(!series.seasons[1].is_current);
        assert!(series.current_season_playlists.is_empty());
    }
}
