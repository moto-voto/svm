//! Port of `src/parser/series-details.js`.

use std::sync::LazyLock;

use scrape_core::{CompiledSelector, Soup, Tag};

use crate::models::SeriesDetails;
use crate::text::{js_trim, label_then_4digits, label_then_numeric_run};

static SINFO: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo").unwrap());
static SINFO_TITLE: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo-title").unwrap());
static CANONICAL: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(r#"link[rel="canonical"]"#).unwrap());
static META_OG_URL: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(r#"meta[property="og:url"]"#).unwrap());
static META_OG_IMAGE: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(r#"meta[property="og:image"]"#).unwrap());
static META_DESCRIPTION: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(r#"meta[name="description"]"#).unwrap());
static SINFO_POSTER_IMG: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo-img img").unwrap());
static SINFO_INFO_P: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo-info > p").unwrap());
static SINFO_LIST: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-sinfo_list").unwrap());
static SPAN: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile("span").unwrap());
static SEASLIST_A: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(".pgs-seaslist a").unwrap());

/// Port of `parseSeriesDetails`.
pub fn parse_series_details(html: &str) -> SeriesDetails {
    let soup = Soup::parse(html);

    let sinfo = soup.find_compiled(&SINFO);
    let id_season = sinfo
        .as_ref()
        .and_then(|el| el.get("data-id-season"))
        .unwrap_or("");
    // JS: attr('data-id-serial') || idSeason || ''
    let id_serial = sinfo
        .as_ref()
        .and_then(|el| el.get("data-id-serial"))
        .filter(|v| !v.is_empty())
        .unwrap_or(id_season);
    let id = if id_season.is_empty() { id_serial } else { id_season };

    let title = soup
        .find_compiled(&SINFO_TITLE)
        .map(|el| el.text())
        .unwrap_or_default();
    let title = js_trim(&title).to_string();

    // First matching element's attribute, skipped when missing or empty
    // (JS `||` treats "" as falsy).
    let first_attr =
        |selector: &CompiledSelector, attr: &str| -> Option<String> {
            soup.find_compiled(selector)
                .and_then(|el| el.get(attr).map(str::to_string))
                .filter(|v| !v.is_empty())
        };

    let full_link = first_attr(&CANONICAL, "href")
        .or_else(|| first_attr(&META_OG_URL, "content"))
        .unwrap_or_default();
    let image = first_attr(&META_OG_IMAGE, "content")
        .or_else(|| first_attr(&SINFO_POSTER_IMG, "src"))
        .unwrap_or_default();
    let description = first_attr(&META_DESCRIPTION, "content").or_else(|| {
        soup.find_compiled(&SINFO_INFO_P)
            .map(|p| p.text())
            .map(|t| js_trim(&t).to_string())
            .filter(|t| !t.is_empty())
    });

    // One pass over all `.pgs-sinfo_list` items; every field keeps the value
    // from the LAST matching element (JS `each` + assignment semantics).
    let mut year: Option<String> = None;
    let mut country: Option<String> = None;
    let mut genre: Option<String> = None;
    let mut original_name: Option<String> = None;
    let mut imdb: Option<String> = None;
    let mut kinopoisk: Option<String> = None;

    for item in soup.select_compiled(&SINFO_LIST) {
        let full_text = item.text();
        let is_rating = item.has_class("rating");

        if full_text.contains("Вышел:") {
            if let Some(value) = label_then_4digits(&full_text, "Вышел:") {
                year = Some(value);
            }
        }
        if full_text.contains("Страна:") {
            if let Some(value) = info_list_value(&item, &full_text) {
                country = Some(value);
            }
        }
        if full_text.contains("Жанр:") {
            if let Some(value) = info_list_value(&item, &full_text) {
                genre = Some(value);
            }
        }
        if full_text.contains("Оригинал:") {
            if let Some(value) = info_list_value(&item, &full_text) {
                original_name = Some(value);
            }
        }
        if is_rating {
            if full_text.contains("IMDB:") {
                if let Some(value) = label_then_numeric_run(&full_text, "IMDB:") {
                    imdb = Some(value);
                }
            }
            if full_text.contains("КиноПоиск:") {
                if let Some(value) = label_then_numeric_run(&full_text, "КиноПоиск:") {
                    kinopoisk = Some(value);
                }
            }
        }
    }

    let seasons = soup.select_compiled(&SEASLIST_A).len();

    SeriesDetails {
        id: id.to_string(),
        id_serial: id_serial.to_string(),
        title,
        full_link,
        image,
        description,
        year,
        country,
        genre,
        imdb,
        kinopoisk,
        original_name,
        seasons: (seasons > 0).then_some(seasons),
    }
}

/// Port of `getInfoListText`: first non-empty `<span>` text, else the text
/// between the first and second `:` (first line only).
fn info_list_value(item: &Tag<'_>, full_text: &str) -> Option<String> {
    if let Some(span) = item.find_compiled(&SPAN) {
        let text = span.text();
        let text = js_trim(&text);
        if !text.is_empty() {
            return Some(text.to_string());
        }
    }
    let mut parts = full_text.split(':');
    parts.next()?; // text before the first ':'
    let second = parts.next()?;
    Some(
        js_trim(second)
            .split('\n')
            .next()
            .unwrap_or("")
            .to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"
<html>
<head>
  <link rel="canonical" href="https://seasonvar.ru/serial-43004-test.html">
  <meta property="og:image" content="//cdn.svstat.net/oblojka/43004.jpg">
  <meta name="description" content="A test description">
</head>
<body>
  <div class="pgs-sinfo" data-id-season="43004-season" data-id-serial="43004">
    <h1 class="pgs-sinfo-title">Test Series (не)Пара</h1>
    <div class="pgs-sinfo_list">Страна: <span>США</span></div>
    <div class="pgs-sinfo_list">Жанр: <span>комедия, мелодрамы</span></div>
    <div class="pgs-sinfo_list">Вышел: 2024</div>
    <div class="pgs-sinfo_list">Оригинал: <span>Mismatched</span></div>
    <div class="pgs-sinfo_list rating">IMDB: <span>6.00</span></div>
    <div class="pgs-sinfo_list rating">КиноПоиск: <span>7.24</span></div>
  </div>
  <div class="pgs-seaslist">
    <a href="/s1.html">Сезон 1</a>
    <a href="/s2.html">Сезон 2</a>
  </div>
</body>
</html>"#;

    #[test]
    fn extracts_every_field() {
        let details = parse_series_details(FIXTURE);

        assert_eq!(details.id, "43004-season");
        assert_eq!(details.id_serial, "43004");
        assert_eq!(details.title, "Test Series (не)Пара");
        assert_eq!(details.full_link, "https://seasonvar.ru/serial-43004-test.html");
        assert_eq!(details.image, "//cdn.svstat.net/oblojka/43004.jpg");
        assert_eq!(details.description.as_deref(), Some("A test description"));
        assert_eq!(details.year.as_deref(), Some("2024"));
        assert_eq!(details.country.as_deref(), Some("США"));
        assert_eq!(details.genre.as_deref(), Some("комедия, мелодрамы"));
        assert_eq!(details.imdb.as_deref(), Some("6.00"));
        assert_eq!(details.kinopoisk.as_deref(), Some("7.24"));
        assert_eq!(details.original_name.as_deref(), Some("Mismatched"));
        assert_eq!(details.seasons, Some(2));
    }

    #[test]
    fn returns_nulls_for_bare_document() {
        let details = parse_series_details("<html><body></body></html>");
        assert_eq!(details.id, "");
        assert_eq!(details.id_serial, "");
        assert_eq!(details.title, "");
        assert_eq!(details.full_link, "");
        assert_eq!(details.image, "");
        assert_eq!(details.description, None);
        assert_eq!(details.year, None);
        assert_eq!(details.country, None);
        assert_eq!(details.genre, None);
        assert_eq!(details.imdb, None);
        assert_eq!(details.kinopoisk, None);
        assert_eq!(details.original_name, None);
        assert_eq!(details.seasons, None);
    }
}
