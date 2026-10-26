//! Static SPA file serving (replacement for `express.static` + `sendFile`).
//!
//! Reads files from disk per request (the OS page cache makes this cheap and
//! keeps memory footprint flat), answers conditional requests with 304, and
//! falls back to `index.html` for unknown paths so the client router can
//! resolve deep links.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use percent_encoding::percent_decode_str;

use crate::common::civil_from_days;

const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/// Serves `rel_path` (already stripped of the base path) relative to `root`.
/// Missing paths fall back to `root/index.html` — the SPA fallback.
pub fn serve(root: &Path, rel_path: &str, req_headers: &HeaderMap) -> Response {
    let decoded = percent_decode_str(rel_path).decode_utf8_lossy().into_owned();

    let mut target = PathBuf::from(root);
    for component in decoded.split('/') {
        match component {
            "" | "." => {}
            // Traversal and Windows-hostile components are rejected.
            ".." => return not_found(),
            c if c.contains('\\') || c.contains(':') => return not_found(),
            c => target.push(c),
        }
    }

    // Directories serve their index (express.static behavior).
    if let Ok(meta) = fs::metadata(&target) {
        if meta.is_dir() {
            target.push("index.html");
        }
    }

    serve_or_fallback(&target, root, req_headers)
}

/// Serves `root/index.html` (the SPA entry).
pub fn serve_index(root: &Path, req_headers: &HeaderMap) -> Response {
    serve_or_fallback(&root.join("index.html"), root, req_headers)
}

fn serve_or_fallback(path: &Path, root: &Path, req_headers: &HeaderMap) -> Response {
    match try_serve_file(path, req_headers) {
        Some(response) => response,
        None => match try_serve_file(&root.join("index.html"), req_headers) {
            Some(response) => response,
            None => not_found(),
        },
    }
}

fn try_serve_file(path: &Path, req_headers: &HeaderMap) -> Option<Response> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() {
        return None;
    }
    let body = fs::read(path).ok()?;

    let (etag, last_modified) = cache_tags(&meta);

    if let Some(if_none_match) = req_headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
    {
        if etag_matches(if_none_match, &etag) {
            return Some(not_modified(&etag, last_modified.as_deref()));
        }
    } else if let Some(if_modified_since) = req_headers
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|v| v.to_str().ok())
    {
        // Browsers echo our exact Last-Modified string, so a string compare
        // is a second-precision timestamp comparison.
        if last_modified.as_deref() == Some(if_modified_since) {
            return Some(not_modified(&etag, last_modified.as_deref()));
        }
    }

    let mut response = Response::new(Body::from(body));
    let headers = response.headers_mut();
    if let Ok(value) = header::HeaderValue::from_str(mime_for(path)) {
        headers.insert(header::CONTENT_TYPE, value);
    }
    if let Ok(value) = header::HeaderValue::from_str(&etag) {
        headers.insert(header::ETAG, value);
    }
    if let Some(lm) = &last_modified {
        if let Ok(value) = header::HeaderValue::from_str(lm) {
            headers.insert(header::LAST_MODIFIED, value);
        }
    }
    Some(response)
}

/// Weak ETag + HTTP-date from the file mtime (express-style).
fn cache_tags(meta: &fs::Metadata) -> (String, Option<String>) {
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() * 1000 + u64::from(d.subsec_millis()));
    let etag = match mtime_ms {
        Some(ms) => format!("W/\"{:x}-{:x}\"", meta.len(), ms),
        None => format!("W/\"{:x}\"", meta.len()),
    };
    let last_modified = mtime_ms.map(|ms| http_date(ms / 1000));
    (etag, last_modified)
}

fn etag_matches(if_none_match: &str, etag: &str) -> bool {
    if_none_match
        .split(',')
        .map(str::trim)
        .any(|candidate| {
            candidate == "*"
                || candidate == etag
                || candidate.trim_start_matches("W/") == etag.trim_start_matches("W/")
        })
}

/// RFC 7231 IMF-fixdate, e.g. `Wed, 21 Oct 2015 07:28:00 GMT`.
fn http_date(unix_secs: u64) -> String {
    let days = (unix_secs / 86_400) as i64;
    let secs_of_day = unix_secs % 86_400;
    let (y, m, d) = civil_from_days(days);
    // 1970-01-01 was a Thursday (weekday index 4).
    let dow = (((days + 4) % 7 + 7) % 7) as usize;
    format!(
        "{}, {:02} {} {:04} {:02}:{:02}:{:02} GMT",
        WEEKDAYS[dow],
        d,
        MONTHS[(m - 1) as usize],
        y,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60
    )
}

fn mime_for(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    match ext.as_deref() {
        Some("html" | "htm") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("txt") => "text/plain; charset=utf-8",
        Some("wasm") => "application/wasm",
        Some("xml") => "application/xml",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn not_modified(etag: &str, last_modified: Option<&str>) -> Response {
    let mut response = Response::new(Body::empty());
    *response.status_mut() = StatusCode::NOT_MODIFIED;
    let headers = response.headers_mut();
    if let Ok(value) = header::HeaderValue::from_str(etag) {
        headers.insert(header::ETAG, value);
    }
    if let Some(lm) = last_modified {
        if let Ok(value) = header::HeaderValue::from_str(lm) {
            headers.insert(header::LAST_MODIFIED, value);
        }
    }
    response
}

fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "Not Found").into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_date_formats_epoch() {
        assert_eq!(http_date(0), "Thu, 01 Jan 1970 00:00:00 GMT");
        assert_eq!(http_date(1_445_432_680), "Wed, 21 Oct 2015 13:04:40 GMT");
    }
}
