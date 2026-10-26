//! Port of `src/parser/defaultList.js` — the front-page `.news` list.

use std::sync::LazyLock;

use scrape_core::{CompiledSelector, Soup, Tag};

use crate::models::SerialDescription;
use crate::parser::concat_text;
use crate::text::normalized;

static NEWS: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".news").unwrap());
static A_DATA_ID: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile("a[data-id]").unwrap());
static NEWS_N: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".news_n").unwrap());
static SEASON_DIV: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".news_w div:not(.news_n)").unwrap());
static NEWS_S: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".news_s").unwrap());

/// Port of `parseDefaultList`.
pub fn parse_default_list(html: &str, target_url: &str) -> Vec<SerialDescription> {
    let soup = Soup::parse(html);
    let mut results = Vec::new();

    for news in soup.select_compiled(&NEWS) {
        for link in news.select_compiled(&A_DATA_ID) {
            // JS skips the entry entirely when data-id is missing/empty.
            let Some(id) = link.get("data-id").filter(|id| !id.is_empty()) else {
                continue;
            };

            let href = link.get("href").unwrap_or("");
            let full_link = if href.starts_with("http") {
                href.to_string()
            } else {
                format!("{target_url}/{}", href.strip_prefix('/').unwrap_or(href))
            };

            let title = normalized(&concat_text(&link, &NEWS_N));

            // Poster URLs are derived from the numeric id.
            let image = format!("https://cdn.svstat.net/oblojka/{id}.jpg");

            // Season info: `.news_w` divs that are not `.news_n`; episode
            // info: `.news_s`. Empty text counts as absent (falsy in JS).
            let season_info = opt_normalized(&link, &SEASON_DIV);
            let episode_info = opt_normalized(&link, &NEWS_S);

            let description = match (season_info, episode_info) {
                (Some(s), Some(e)) => Some(format!("{s}\n{e}")),
                (Some(s), None) => Some(s),
                (None, Some(e)) => Some(e),
                (None, None) => None,
            };

            if title.chars().count() > 1 {
                results.push(SerialDescription {
                    id: Some(id.to_string()),
                    title,
                    full_link,
                    image: Some(image),
                    description,
                });
            }
        }
    }

    results
}

/// Text of `selector` descendants, normalized; `None` when nothing matches
/// or the text is empty.
fn opt_normalized(el: &Tag<'_>, selector: &CompiledSelector) -> Option<String> {
    if el.select_compiled(selector).is_empty() {
        return None;
    }
    let text = normalized(&concat_text(el, selector));
    if text.is_empty() { None } else { Some(text) }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET: &str = "https://seasonvar.ru";

    const FIXTURE: &str = r#"
<html><body>
  <div class="news">
    <a data-id="43004" href="/serial-43004-nePara-3-season.html">
      <div class="news_w">
        <div class="news_n">Series Title</div>
        <div class="season">(3 сезон)</div>
      </div>
      <span class="news_s">1-8 серия</span>
    </a>
  </div>
  <div class="news">
    <a data-id="43005" href="https://seasonvar.ru/serial-43005-other.html">
      <div class="news_w">
        <div class="news_n">Another</div>
      </div>
    </a>
  </div>
</body></html>"#;

    #[test]
    fn builds_image_urls_and_descriptions() {
        let results = parse_default_list(FIXTURE, TARGET);
        assert_eq!(results.len(), 2);

        assert_eq!(results[0].id.as_deref(), Some("43004"));
        assert_eq!(results[0].title, "Series Title");
        assert_eq!(
            results[0].full_link,
            format!("{TARGET}/serial-43004-nePara-3-season.html")
        );
        assert_eq!(
            results[0].image.as_deref(),
            Some("https://cdn.svstat.net/oblojka/43004.jpg")
        );
        assert_eq!(results[0].description.as_deref(), Some("(3 сезон)\n1-8 серия"));

        // Second entry has absolute link and no season/episode info.
        assert_eq!(results[1].id.as_deref(), Some("43005"));
        assert_eq!(results[1].title, "Another");
        assert_eq!(results[1].full_link, "https://seasonvar.ru/serial-43005-other.html");
        assert_eq!(results[1].description, None);
    }
}
