//! Port of `src/parser/playlists.js` — translations + playlist fetching +
//! the seasonvar link decoder.

use std::sync::LazyLock;

use base64::Engine as _;
use scrape_core::{CompiledSelector, Soup};
use serde_json::Value;

use crate::http::Upstream;
use crate::models::{PlayListItem, PlaylistTranslation};
use crate::text::{extract_pl_assignments, extract_pl_pairs, find_var_pl, normalized, replace_br};

static SCRIPT: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile("script").unwrap());
static TRANSLATE_LI: LazyLock<CompiledSelector> =
    LazyLock::new(|| CompiledSelector::compile(r#"li[data-click="translate"]"#).unwrap());

/// Port of `parsePlaylistTranslations`.
pub async fn parse_playlist_translations(
    html: &str,
    upstream: &Upstream,
) -> Result<Vec<PlaylistTranslation>, String> {
    let soup = Soup::parse(html);
    parse_from_soup(&soup, upstream).await
}

/// Same as [`parse_playlist_translations`] but reuses an already parsed
/// document (the JS version re-parses the same HTML for series pages).
pub async fn parse_from_soup(
    soup: &Soup,
    upstream: &Upstream,
) -> Result<Vec<PlaylistTranslation>, String> {
    // Ordered map with first-insertion positions and in-place overwrites —
    // plain JS object semantics.
    let mut pl_map: Vec<(String, String)> = Vec::new();

    // 1. Collect playlist URLs from <script> contents.
    for script in soup.select_compiled(&SCRIPT) {
        let content = script.text();

        // `var pl = {...};` — try JSON first (after the ' -> " rewrite),
        // then the key/value fallback scan, exactly like the JS code.
        if let Some(obj) = find_var_pl(&content) {
            let as_json = obj.replace('\'', "\"");
            match serde_json::from_str::<Value>(&as_json) {
                Ok(Value::Object(map)) => {
                    for (key, value) in map {
                        upsert(&mut pl_map, key, value_to_string(&value));
                    }
                }
                _ => {
                    for (key, value) in extract_pl_pairs(&obj) {
                        upsert(&mut pl_map, key, value);
                    }
                }
            }
        }

        // `pl[id] = "...";`
        for (key, value) in extract_pl_assignments(&content) {
            upsert(&mut pl_map, key, value);
        }
    }

    // 2. Match the <li> translation list against the collected URLs.
    let li_items = soup.select_compiled(&TRANSLATE_LI);

    if li_items.is_empty() {
        if pl_map.is_empty() {
            return Ok(Vec::new());
        }
        // First key per JS own-property ordering: numeric keys ascending.
        let url = first_key(&pl_map).expect("pl_map is not empty");
        let plist = fetch_playlist(&url, upstream).await?;
        return Ok(vec![PlaylistTranslation {
            translation: "Default".to_string(),
            plist,
        }]);
    }

    let mut translations = Vec::new();
    for li in li_items {
        // Empty/missing data-translate falls back to "0".
        let translate_id = li
            .get("data-translate")
            .filter(|v| !v.is_empty())
            .unwrap_or("0");
        let translation = crate::text::js_trim(&li.text()).to_string();
        if let Some((_, url)) = pl_map.iter().find(|(key, _)| key == translate_id) {
            let plist = fetch_playlist(url, upstream).await?;
            translations.push(PlaylistTranslation { translation, plist });
        }
    }

    Ok(translations)
}

/// Port of `fetchPlaylist`.
pub async fn fetch_playlist(
    plist_url: &str,
    upstream: &Upstream,
) -> Result<Vec<PlayListItem>, String> {
    let url = if plist_url.starts_with("http") {
        plist_url.to_string()
    } else {
        format!("https://seasonvar.ru{plist_url}")
    };
    let data = upstream.json(&url).await?;
    Ok(parse_playlist_json(&data))
}

/// Pure mapping of a playlist JSON payload to decoded episodes. Non-array
/// payloads yield an empty list (the JS `Array.isArray` check).
pub fn parse_playlist_json(data: &Value) -> Vec<PlayListItem> {
    let Value::Array(items) = data else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let raw_title = item.get("title").and_then(Value::as_str).unwrap_or("");
            let title = normalized(&replace_br(raw_title));
            let file = item
                .get("file")
                .and_then(Value::as_str)
                .and_then(decode_seasonvar_link)
                .filter(|file| file.starts_with("http"))?;
            Some(PlayListItem {
                title,
                file: Some(file),
            })
        })
        .collect()
}

/// Port of `decodeSeasonvarLink`: strips the `#<digit>` marker and the
/// `b2xvbG8` (= base64 "ololo") chunks, base64-decodes, then removes the
/// `ololo` marker and any non-printable ASCII characters.
pub fn decode_seasonvar_link(encoded: &str) -> Option<String> {
    // Strip the leading `#<one digit>` marker.
    let bytes = encoded.as_bytes();
    let mut clean = encoded;
    if bytes.first() == Some(&b'#') && bytes.get(1).is_some_and(u8::is_ascii_digit) {
        clean = &clean[2..];
    }

    let clean = clean
        .replace("//b2xvbG8=", "")
        .replace("b2xvbG8=", "")
        .replace("b2xvbG8", "");

    // Node's Buffer.from(str, 'base64') silently ignores non-alphabet
    // characters; keep the base64/base64url alphabet plus padding, then pad
    // to a multiple of four like the JS code does.
    let mut filtered: String = clean
        .chars()
        .filter(|c| {
            c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '-' | '_' | '=')
        })
        .collect();
    while filtered.len() % 4 != 0 {
        filtered.push('=');
    }

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(filtered.as_bytes())
        .ok()?;
    let text = String::from_utf8_lossy(&decoded);

    let mut out = String::with_capacity(text.len());
    for c in text.replace("ololo", "").chars() {
        if ('\u{20}'..='\u{7E}').contains(&c) {
            out.push(c);
        }
    }
    if out.starts_with("//") {
        out.insert_str(0, "https:");
    }
    Some(out.trim().to_string())
}

/// Insert-or-replace keeping the first insertion position.
fn upsert(map: &mut Vec<(String, String)>, key: String, value: String) {
    if let Some(slot) = map.iter_mut().find(|(k, _)| *k == key) {
        slot.1 = value;
    } else {
        map.push((key, value));
    }
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// The key a JS object would expose first: integer-like keys in ascending
/// numeric order, then string keys in insertion order.
fn first_key(map: &[(String, String)]) -> Option<String> {
    let mut best: Option<(u64, &str)> = None;
    for (key, _) in map {
        if !key.is_empty() && key.bytes().all(|b| b.is_ascii_digit()) {
            let n: u64 = key.parse().unwrap_or(u64::MAX);
            if best.as_ref().is_none_or(|(bn, _)| n < *bn) {
                best = Some((n, key));
            }
        }
    }
    best.map(|(_, key)| key.to_string())
        .or_else(|| map.first().map(|(key, _)| key.clone()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b64(s: &str) -> String {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(s)
    }

    #[test]
    fn decodes_seasonvar_links() {
        let encoded = format!("#1{}", b64("https://example.com/e1.mp4"));
        assert_eq!(
            decode_seasonvar_link(&encoded).as_deref(),
            Some("https://example.com/e1.mp4")
        );
        // Without the `#N` marker, and with ololo chunks + padding noise.
        let noisy = format!("//b2xvbG8={}b2xvbG8=", b64("https://example.com/f1.mp4"));
        assert_eq!(
            decode_seasonvar_link(&noisy).as_deref(),
            Some("https://example.com/f1.mp4")
        );
        // Protocol-relative result gets the https: scheme.
        let rel = b64("//example.com/g.mp4");
        assert_eq!(
            decode_seasonvar_link(&rel).as_deref(),
            Some("https://example.com/g.mp4")
        );
    }

    #[test]
    fn parse_playlist_json_filters_invalid_entries() {
        let data = serde_json::json!([
            { "title": "Good", "file": format!("#1{}", b64("https://example.com/good.mp4")) },
            { "title": "Bad", "file": format!("#1{}", b64("ftp://example.com/bad.mp4")) }
        ]);
        let items = parse_playlist_json(&data);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Good");
        assert_eq!(items[0].file.as_deref(), Some("https://example.com/good.mp4"));
    }

    #[test]
    fn parse_playlist_json_handles_br_titles() {
        let data = serde_json::json!([
            { "title": "Episode 1<br/>Pilot", "file": b64("https://example.com/e1.mp4") }
        ]);
        let items = parse_playlist_json(&data);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Episode 1 - Pilot");
    }

    #[test]
    fn non_array_payload_yields_empty() {
        let data = serde_json::json!({ "nope": true });
        assert!(parse_playlist_json(&data).is_empty());
    }
}
