//! Hand-rolled text utilities that replicate the exact JavaScript
//! regex/string semantics the original parsers rely on. Avoiding the `regex`
//! crate keeps the binary small and every match branch-free.

/// JS `\s` character class (Unicode-aware).
pub fn is_js_ws(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n'
            | '\u{0B}'
            | '\u{0C}'
            | '\u{0D}'
            | ' '
            | '\u{A0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202F}'
            | '\u{205F}'
            | '\u{3000}'
            | '\u{FEFF}'
    )
}

fn js_ws_ascii(b: u8) -> bool {
    matches!(b, b' ' | b'\t' | b'\n' | 0x0B | 0x0C | b'\r')
}

/// JS `String.prototype.trim()` (Unicode-aware, unlike Rust's `str::trim`
/// it also strips `\u{FEFF}`).
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_ws)
}

/// `text.trim().replace(/\s+/g, ' ')` in one pass.
pub fn normalized(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut pending_ws = false;
    for c in s.chars() {
        if is_js_ws(c) {
            pending_ws = true;
        } else {
            if pending_ws && !out.is_empty() {
                out.push(' ');
            }
            pending_ws = false;
            out.push(c);
        }
    }
    out
}

fn utf8_char_len(first: u8) -> usize {
    match first {
        0x00..=0x7F => 1,
        0xC0..=0xDF => 2,
        0xE0..=0xEF => 3,
        0xF0..=0xF7 => 4,
        _ => 1, // continuation byte: only reachable on malformed input
    }
}

/// `s.replace(/<br\s*\/?>/gi, ' - ')` — case-insensitive, whitespace allowed
/// before an optional slash.
pub fn replace_br(s: &str) -> String {
    let b = s.as_bytes();
    let n = b.len();
    let mut out = String::with_capacity(n);
    let mut i = 0;
    while i < n {
        if b[i] == b'<'
            && i + 3 < n
            && (b[i + 1] | 0x20) == b'b'
            && (b[i + 2] | 0x20) == b'r'
        {
            let mut j = i + 3;
            while j < n && js_ws_ascii(b[j]) {
                j += 1;
            }
            if j < n && b[j] == b'/' {
                j += 1;
            }
            if j < n && b[j] == b'>' {
                out.push_str(" - ");
                i = j + 1;
                continue;
            }
        }
        let ch_len = utf8_char_len(b[i]);
        out.push_str(&s[i..i + ch_len]);
        i += ch_len;
    }
    out
}

fn digits_end(b: &[u8], mut i: usize) -> usize {
    while i < b.len() && b[i].is_ascii_digit() {
        i += 1;
    }
    i
}

/// Byte index where `/\d{1,2}\.\d{1,2}\.\d{4}\s+.+$/` first matches — i.e.
/// where the trailing "date + everything after it" begins — or `None`.
pub fn find_date_cut(s: &str) -> Option<usize> {
    let b = s.as_bytes();
    (0..b.len()).find(|&i| try_date_at(b, i))
}

/// Greedy-with-backtracking attempt of the date regex at byte index `i`
/// (digits are ASCII, so `i` is always a char boundary when it succeeds).
fn try_date_at(b: &[u8], i: usize) -> bool {
    let n = b.len();
    let run1 = digits_end(b, i);
    if run1 == i {
        return false;
    }
    for l1 in (1..=(run1 - i).min(2)).rev() {
        let mut j = i + l1;
        if j >= n || b[j] != b'.' {
            continue;
        }
        j += 1;
        let run2 = digits_end(b, j);
        for l2 in (1..=(run2 - j).min(2)).rev() {
            let mut k = j + l2;
            if k >= n || b[k] != b'.' {
                continue;
            }
            k += 1;
            if k + 4 > n || !b[k..k + 4].iter().all(u8::is_ascii_digit) {
                continue;
            }
            k += 4;
            if k >= n || !js_ws_ascii(b[k]) {
                continue;
            }
            if date_tail_ok(b, k) {
                return true;
            }
        }
    }
    false
}

/// `\s+.+$` tail: at least one whitespace char was consumed at `k`, and
/// `.+` must be able to run to the end without crossing a line terminator
/// (JS `.` excludes `\n`, `\r`, U+2028, U+2029; `$` is absolute end).
fn date_tail_ok(b: &[u8], k: usize) -> bool {
    let n = b.len();
    let mut w = k;
    while w < n && js_ws_ascii(b[w]) {
        w += 1;
    }
    let mut suffix_start = k;
    let mut has_term = false;
    let mut idx = k;
    while idx < n {
        if b[idx] == b'\n' || b[idx] == b'\r' {
            has_term = true;
            suffix_start = idx + 1;
        } else if b[idx] == 0xE2
            && idx + 2 < n
            && b[idx + 1] == 0x80
            && (b[idx + 2] == 0xA8 || b[idx + 2] == 0xA9)
        {
            has_term = true;
            suffix_start = idx + 3;
        }
        idx += 1;
    }
    if !has_term {
        w < n
    } else {
        suffix_start > k && suffix_start < n && b[k..suffix_start].iter().all(|&x| js_ws_ascii(x))
    }
}

/// Skips JS whitespace starting at byte index `i` (which must be a char
/// boundary) and returns the index of the next non-whitespace char.
fn skip_js_ws(s: &str, mut i: usize) -> usize {
    while let Some(c) = s[i..].chars().next() {
        if is_js_ws(c) {
            i += c.len_utf8();
        } else {
            break;
        }
    }
    i
}

/// Emulates `/var\s+pl\s*=\s*({[^;]+});/` — returns the `{...}` literal
/// (from the first `{` up to the last `}` before the first `;`).
pub fn find_var_pl(content: &str) -> Option<String> {
    let mut from = 0usize;
    while let Some(off) = content[from..].find("var") {
        let after_var = from + off + 3;

        // `\s+` — at least one whitespace char.
        let mut j = after_var;
        let mut saw_ws = false;
        while let Some(c) = content[j..].chars().next() {
            if is_js_ws(c) {
                saw_ws = true;
                j += c.len_utf8();
            } else {
                break;
            }
        }
        if !saw_ws {
            from = after_var;
            continue;
        }

        if !content[j..].starts_with("pl") {
            from = j;
            continue;
        }
        j = skip_js_ws(content, j + 2);
        if !content[j..].starts_with('=') {
            from = j;
            continue;
        }
        j = skip_js_ws(content, j + 1);
        if !content[j..].starts_with('{') {
            from = j;
            continue;
        }

        // `{` [^;]+ `}` `;`
        let brace = j;
        let Some(semi_rel) = content[brace + 1..].find(';') else {
            from = brace;
            continue;
        };
        let semi = brace + 1 + semi_rel;
        let span = &content[brace..semi];
        match span.rfind('}') {
            // `[^;]+` needs at least one char between the braces.
            Some(close) if close > 1 => return Some(span[..=close].to_string()),
            _ => from = brace,
        }
    }
    None
}

/// Emulates global `/['"]?(\d+)['"]?\s*:\s*['"]([^'"]+)['"]/` over `s`,
/// returning `(key, value)` pairs in match order.
pub fn extract_pl_pairs(s: &str) -> Vec<(String, String)> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i].is_ascii_digit() {
            match try_pl_pair(s, i) {
                Some((end, key, value)) => {
                    out.push((key, value));
                    i = end;
                }
                None => i += 1,
            }
        } else {
            i += 1;
        }
    }
    out
}

/// Single match attempt of the pair regex with the capture starting at digit
/// position `p` (greedy digit run with backtracking).
fn try_pl_pair(s: &str, p: usize) -> Option<(usize, String, String)> {
    let b = s.as_bytes();
    let run_end = digits_end(b, p);
    let mut q = run_end; // captured key = s[p..q], shrunk on failure
    while q > p {
        let mut j = q;
        if j < b.len() && (b[j] == b'\'' || b[j] == b'"') {
            j += 1;
        }
        j = skip_js_ws(s, j);
        if j < b.len() && b[j] == b':' {
            j = skip_js_ws(s, j + 1);
            if j < b.len() && (b[j] == b'\'' || b[j] == b'"') {
                if let Some(vend_rel) = s[j + 1..].find(['\'', '"']) {
                    let vend = j + 1 + vend_rel;
                    if vend > j + 1 {
                        return Some((
                            vend + 1,
                            s[p..q].to_string(),
                            s[j + 1..vend].to_string(),
                        ));
                    }
                }
            }
        }
        q -= 1;
    }
    None
}

/// Emulates global `/pl\[['"]?(\w+)['"]?\]\s*=\s*['"]([^'"]+)['"]/`.
pub fn extract_pl_assignments(s: &str) -> Vec<(String, String)> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut from = 0usize;
    while let Some(rel) = s[from..].find("pl[") {
        let i = from + rel;
        let mut j = i + 3;
        if j < b.len() && (b[j] == b'\'' || b[j] == b'"') {
            j += 1;
        }
        let key_start = j;
        while j < b.len() && (b[j].is_ascii_alphanumeric() || b[j] == b'_') {
            j += 1;
        }
        if j == key_start {
            from = i + 3;
            continue;
        }
        let key = s[key_start..j].to_string();
        if j < b.len() && (b[j] == b'\'' || b[j] == b'"') {
            j += 1;
        }

        let mut matched = false;
        if j < b.len() && b[j] == b']' {
            j = skip_js_ws(s, j + 1);
            if j < b.len() && b[j] == b'=' {
                j = skip_js_ws(s, j + 1);
                if j < b.len() && (b[j] == b'\'' || b[j] == b'"') {
                    if let Some(vend_rel) = s[j + 1..].find(['\'', '"']) {
                        let vend = j + 1 + vend_rel;
                        if vend > j + 1 {
                            out.push((key, s[j + 1..vend].to_string()));
                            from = vend + 1;
                            matched = true;
                        }
                    }
                }
            }
        }
        if !matched {
            from = i + 3;
        }
    }
    out
}

/// `new RegExp(label + "\\s*(\\d{4})")` — label, then whitespace, then
/// exactly four digits (first match wins).
pub fn label_then_4digits(text: &str, label: &str) -> Option<String> {
    let mut from = 0;
    while let Some(pos) = text[from..].find(label) {
        let after = from + pos + label.len();
        let i = skip_js_ws(text, after);
        let b = text.as_bytes();
        if i + 4 <= b.len() && b[i..i + 4].iter().all(u8::is_ascii_digit) {
            return Some(text[i..i + 4].to_string());
        }
        from = after;
        if from >= text.len() {
            break;
        }
    }
    None
}

/// `new RegExp(label + "\\s*([\\d.]+)")` — label, then whitespace, then a
/// run of digits/dots (first match wins).
pub fn label_then_numeric_run(text: &str, label: &str) -> Option<String> {
    let mut from = 0;
    while let Some(pos) = text[from..].find(label) {
        let after = from + pos + label.len();
        let start = skip_js_ws(text, after);
        let b = text.as_bytes();
        let mut i = start;
        while i < b.len() && (b[i].is_ascii_digit() || b[i] == b'.') {
            i += 1;
        }
        if i > start {
            return Some(text[start..i].to_string());
        }
        from = after;
        if from >= text.len() {
            break;
        }
    }
    None
}

/// `encodeURIComponent` — keeps `A-Za-z0-9-_.!~*'()`.
pub fn encode_component(s: &str) -> String {
    use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};
    const COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
        .remove(b'-')
        .remove(b'_')
        .remove(b'.')
        .remove(b'!')
        .remove(b'~')
        .remove(b'*')
        .remove(b'\'')
        .remove(b'(')
        .remove(b')');
    utf8_percent_encode(s, COMPONENT).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalized_collapses_and_trims() {
        assert_eq!(normalized("  Test   Show  "), "Test Show");
        assert_eq!(normalized("a\t\nb"), "a b");
        assert_eq!(normalized("   "), "");
        assert_eq!(normalized("Сезон  1"), "Сезон 1");
    }

    #[test]
    fn js_trim_strips_bom_like_js() {
        assert_eq!(js_trim("\u{FEFF}x\u{A0}"), "x");
    }

    #[test]
    fn replace_br_handles_variants() {
        assert_eq!(replace_br("Episode 1<br/>Pilot"), "Episode 1 - Pilot");
        assert_eq!(replace_br("Only<br>One"), "Only - One");
        assert_eq!(replace_br("A<BR />B"), "A - B");
        assert_eq!(replace_br("no tags"), "no tags");
        assert_eq!(replace_br("x<b>y"), "x<b>y");
    }

    #[test]
    fn date_cut_finds_first_date() {
        let s = "Сезон 1 01.01.2024 8 серий";
        let cut = find_date_cut(s).unwrap();
        assert_eq!(&s[cut..], "01.01.2024 8 серий");
        assert_eq!(find_date_cut("Сезон 2"), None);
        // Nothing after the year -> `\s+.+$` cannot match.
        assert_eq!(find_date_cut("01.01.2024"), None);
        assert_eq!(find_date_cut("1.2.2024 x"), Some(0));
        assert_eq!(find_date_cut("a 01.01.2024\nmore"), Some(2));
        // Text ending in a newline: `.+` cannot reach `$`.
        assert_eq!(find_date_cut("a 01.01.2024 8 серий\n"), None);
    }

    #[test]
    fn label_helpers() {
        assert_eq!(label_then_4digits("Вышел: 2024", "Вышел:"), Some("2024".into()));
        assert_eq!(label_then_4digits("Вышел:  20245", "Вышел:"), Some("2024".into()));
        assert_eq!(label_then_4digits("no year", "Вышел:"), None);
        assert_eq!(label_then_numeric_run("IMDB: 6.00", "IMDB:"), Some("6.00".into()));
        assert_eq!(
            label_then_numeric_run("КиноПоиск: 7.24", "КиноПоиск:"),
            Some("7.24".into())
        );
    }

    #[test]
    fn var_pl_detection() {
        let script = "var pl = {'0':'/plist/0.json','1':'/plist/1.json'};";
        assert_eq!(
            find_var_pl(script).as_deref(),
            Some("{'0':'/plist/0.json','1':'/plist/1.json'}")
        );
        assert_eq!(find_var_pl("var pl=1;"), None);
        assert_eq!(find_var_pl("var\tpl\t=\t{'0':'/a'};").as_deref(), Some("{'0':'/a'}"));
    }

    #[test]
    fn pl_pairs_and_assignments() {
        assert_eq!(
            extract_pl_pairs("{'0':'/a','1':'/b'}"),
            vec![
                ("0".to_string(), "/a".to_string()),
                ("1".to_string(), "/b".to_string())
            ]
        );
        assert_eq!(
            extract_pl_assignments("pl['0'] = '/plist/only.json';"),
            vec![("0".to_string(), "/plist/only.json".to_string())]
        );
        assert_eq!(
            extract_pl_assignments("pl[12]='/x'; pl['a_b'] = '/y';"),
            vec![
                ("12".to_string(), "/x".to_string()),
                ("a_b".to_string(), "/y".to_string())
            ]
        );
    }

    #[test]
    fn encode_component_matches_js() {
        assert_eq!(encode_component("a b"), "a%20b");
        assert_eq!(encode_component("a+b"), "a%2Bb");
        assert_eq!(encode_component("ко-ко"), "%D0%BA%D0%BE-%D0%BA%D0%BE");
        assert_eq!(encode_component("x!~*'()"), "x!~*'()");
    }
}
