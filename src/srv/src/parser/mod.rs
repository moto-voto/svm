//! Ports of the cheerio-based parsers in `src/parser/` (cheerio -> scrape-core).

pub mod default_list;
pub mod playlists;
pub mod search;
pub mod series;
pub mod series_details;

use scrape_core::{CompiledSelector, Tag};

/// Concatenated text of all elements matching `selector` among `el`'s
/// descendants — the equivalent of cheerio's `$(el).find(sel).text()`.
pub(crate) fn concat_text(el: &Tag<'_>, selector: &CompiledSelector) -> String {
    let mut out = String::new();
    for tag in el.select_compiled(selector) {
        tag.text_into(&mut out);
    }
    out
}
