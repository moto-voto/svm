//! Shared constants, upstream headers and logging (port of `src/common.js`).

use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::header::{HeaderMap, HeaderValue};

/// Upstream site all API endpoints scrape (port of `TARGET`).
pub const TARGET: &str = "https://seasonvar.ru";

/// Headers sent with every upstream request (port of `HEADERS`).
///
/// The `Host` header from common.js is intentionally omitted: the HTTP client
/// derives it from the request URL, which also keeps third-party hosts
/// reachable through `/api/playlist` / `/api/series`.
pub fn upstream_headers() -> &'static HeaderMap {
    static HEADERS: OnceLock<HeaderMap> = OnceLock::new();
    HEADERS.get_or_init(|| {
        let mut headers = HeaderMap::with_capacity(4);
        headers.insert(
            "User-Agent",
            HeaderValue::from_static(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ),
        );
        headers.insert(
            "Accept",
            HeaderValue::from_static(
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            ),
        );
        headers.insert(
            "Accept-Language",
            HeaderValue::from_static("ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3"),
        );
        headers.insert("Referer", HeaderValue::from_static("https://seasonvar.ru/"));
        headers
    })
}

/// Timestamped log line (port of `log()`): `log` goes to stdout, everything
/// else to stderr.
pub fn log(level: &str, message: &str) {
    let line = format!("[{}] {}: {}", iso_now(), level.to_ascii_uppercase(), message);
    if level == "log" {
        println!("{line}");
    } else {
        eprintln!("{line}");
    }
}

/// Current UTC time in `YYYY-MM-DDTHH:MM:SS.mmmZ` form (`toISOString`).
fn iso_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let (y, m, d) = civil_from_days((secs / 86_400) as i64);
    let s = secs % 86_400;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y,
        m,
        d,
        s / 3600,
        (s % 3600) / 60,
        s % 60,
        now.subsec_millis()
    )
}

/// Days since 1970-01-01 -> (year, month, day). Howard Hinnant's
/// `civil_from_days` algorithm; avoids a date-time dependency.
pub fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_from_days_matches_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1)); // 2024-01-01
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
    }
}
