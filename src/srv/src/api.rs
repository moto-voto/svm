//! Ports of `src/api/*.js` — one function per backend endpoint.

use crate::common::TARGET;
use crate::http::Upstream;
use crate::models::{PlaylistTranslation, Series, SeriesDetails, SerialDescription};
use crate::parser::{default_list, playlists, search, series, series_details};
use crate::text::encode_component;

/// Port of `apiSearch`: search endpoint for non-empty queries, front page
/// (default list) otherwise.
pub async fn search(upstream: &Upstream, query: &str) -> Result<Vec<SerialDescription>, String> {
    if !query.is_empty() {
        let url = format!("{TARGET}/search?q={}", encode_component(query));
        let html = upstream.text(&url).await?;
        Ok(search::parse_search_results(&html, TARGET))
    } else {
        let html = upstream.text(TARGET).await?;
        Ok(default_list::parse_default_list(&html, TARGET))
    }
}

/// Port of `apiSeriesList`.
pub async fn series_list(upstream: &Upstream) -> Result<Vec<SerialDescription>, String> {
    let html = upstream.text(TARGET).await?;
    Ok(default_list::parse_default_list(&html, TARGET))
}

/// Port of `apiPlaylist`.
pub async fn playlist(
    upstream: &Upstream,
    series_url: &str,
) -> Result<Vec<PlaylistTranslation>, String> {
    if series_url.is_empty() {
        return Err("Series URL is required".to_string());
    }
    let html = upstream.text(series_url).await?;
    playlists::parse_playlist_translations(&html, upstream).await
}

/// Port of `apiSeries`.
pub async fn series(upstream: &Upstream, series_url: &str) -> Result<Series, String> {
    if series_url.is_empty() {
        return Err("Series URL is required".to_string());
    }
    let html = upstream.text(series_url).await?;
    series::parse_series(&html, TARGET, upstream).await
}

/// Port of `apiSeriesDetails`.
pub async fn series_details(upstream: &Upstream, url: &str) -> Result<SeriesDetails, String> {
    if url.is_empty() {
        return Err("Series URL is required".to_string());
    }
    let html = upstream.text(url).await?;
    Ok(series_details::parse_series_details(&html))
}
