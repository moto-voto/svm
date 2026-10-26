//! JSON response shapes — 1:1 with the JS typedefs in `src/parser/*.js`.
//!
//! Field order/omission matters for the frontend and the JS unit tests:
//! `id` is dropped when the source link had no `-<id>` segment (JS
//! `undefined` keys are removed by `JSON.stringify`), everything else keeps
//! its key with `null` when absent.

use serde::Serialize;

/// Item of `/api/search` and `/api/series-list` (`SerialDescription`).
#[derive(Debug, Clone, Serialize)]
pub struct SerialDescription {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub title: String,
    #[serde(rename = "fullLink")]
    pub full_link: String,
    pub image: Option<String>,
    pub description: Option<String>,
}

/// Response of `/api/series-details` (`SeriesDetails`).
#[derive(Debug, Serialize)]
pub struct SeriesDetails {
    pub id: String,
    #[serde(rename = "idSerial")]
    pub id_serial: String,
    pub title: String,
    #[serde(rename = "fullLink")]
    pub full_link: String,
    pub image: String,
    pub description: Option<String>,
    pub year: Option<String>,
    pub country: Option<String>,
    pub genre: Option<String>,
    pub imdb: Option<String>,
    pub kinopoisk: Option<String>,
    #[serde(rename = "originalName")]
    pub original_name: Option<String>,
    pub seasons: Option<usize>,
}

/// Season entry of `/api/series` (`SeasonLink`).
#[derive(Debug, Clone, Serialize)]
pub struct SeasonLink {
    pub title: String,
    pub link: String,
    #[serde(rename = "isCurrent")]
    pub is_current: bool,
}

/// Episode entry (`PlayListItem`).
#[derive(Debug, Clone, Serialize)]
pub struct PlayListItem {
    pub title: String,
    pub file: Option<String>,
}

/// Translation with its playlist (`PlaylistTranslation`).
#[derive(Debug, Clone, Serialize)]
pub struct PlaylistTranslation {
    pub translation: String,
    pub plist: Vec<PlayListItem>,
}

/// Response of `/api/series` (`Series`).
#[derive(Debug, Serialize)]
pub struct Series {
    #[serde(rename = "idSerial")]
    pub id_serial: String,
    pub seasons: Vec<SeasonLink>,
    #[serde(rename = "currentSeasonPlaylists")]
    pub current_season_playlists: Vec<PlaylistTranslation>,
}
