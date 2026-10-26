//! Port of `src/parser/search.js` — `/search?q=` results.

use std::sync::LazyLock;

use scrape_core::{CompiledSelector, Soup};

use crate::models::SerialDescription;
use crate::parser::concat_text;
use crate::text::normalized;

static SEARCH_WRAP: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-search-wrap").unwrap());
static SEARCH_INFO: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-search-info").unwrap());
static A: LazyLock<CompiledSelector> = LazyLock::new(|| CompiledSelector::compile("a").unwrap());
static POSTER_IMG: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile("a.pst img").unwrap());
static P: LazyLock<CompiledSelector> = LazyLock::new(|| CompiledSelector::compile("p").unwrap());

/// Port of `parseSearchResults`.
pub fn parse_search_results(html: &str, target_url: &str) -> Vec<SerialDescription> {
    let soup = Soup::parse(html);
    let mut results = Vec::new();

    for wrap in soup.select_compiled(&SEARCH_WRAP) {
        let Some(info) = wrap.find_compiled(&SEARCH_INFO) else {
            continue;
        };
        let Some(title_link) = info.find_compiled(&A) else {
            continue;
        };

        let title = normalized(&title_link.text());
        let link = title_link.get("href").unwrap_or("");

        // JS: (link || '').split('-')[1] — undefined (dropped by
        // JSON.stringify) when the link has no `-` segment.
        let id = link.split('-').nth(1).map(str::to_string);

        // Poster image; protocol-relative URLs get the `https:` scheme.
        let image = wrap
            .find_compiled(&POSTER_IMG)
            .and_then(|img| img.get("src").map(str::to_string))
            .map(|src| {
                // JS: imageSrc.startsWith('//') ? 'https:' + imageSrc : imageSrc
                if src.starts_with("//") {
                    format!("https:{src}")
                } else {
                    src
                }
            });

        // Description: concatenated text of all <p> inside the info block.
        let description = normalized(&concat_text(&info, &P));
        let description = if description.is_empty() {
            None
        } else {
            Some(description)
        };

        if !title.is_empty() && !link.is_empty() && title.chars().count() > 1 {
            let full_link = if link.starts_with("http") {
                link.to_string()
            } else {
                format!("{target_url}/{}", link.strip_prefix('/').unwrap_or(link))
            };
            results.push(SerialDescription {
                id,
                title,
                full_link,
                image,
                description,
            });
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET: &str = "https://seasonvar.ru";

    const FIXTURE: &str = r#"
<html><body>
  <div class="pgs-search-wrap">
    <a class="pst" href="/serial-1-test.html"><img src="//cdn.svstat.net/oblojka/1.jpg"></a>
    <div class="pgs-search-info">
      <a href="/serial-1-test.html">  Test   Show  </a>
      <p>  A   description  </p>
    </div>
  </div>
  <div class="pgs-search-wrap">
    <a class="pst" href="https://other.example/x.html"><img src="https://img.example/x.jpg"></a>
    <div class="pgs-search-info">
      <a href="https://other.example/x.html">Second</a>
      <p></p>
    </div>
  </div>
</body></html>"#;

    #[test]
    fn extracts_id_less_search_hits() {
        let results = parse_search_results(FIXTURE, TARGET);
        assert_eq!(results.len(), 2);

        assert_eq!(results[0].id.as_deref(), Some("1"));
        assert_eq!(results[0].title, "Test Show");
        assert_eq!(results[0].full_link, format!("{TARGET}/serial-1-test.html"));
        assert_eq!(results[0].image.as_deref(), Some("https://cdn.svstat.net/oblojka/1.jpg"));
        assert_eq!(results[0].description.as_deref(), Some("A description"));

        assert_eq!(results[1].title, "Second");
        assert_eq!(results[1].full_link, "https://other.example/x.html");
        assert_eq!(results[1].image.as_deref(), Some("https://img.example/x.jpg"));
        assert_eq!(results[1].description, None);
        // No `-` in the link -> JS drops the `id` key entirely.
        assert_eq!(results[1].id, None);
    }
}
