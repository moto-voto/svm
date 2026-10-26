//! Router + request handlers (port of `src/server.js`).
//!
//! Response semantics match the Express implementation exactly: API errors
//! are HTTP 200 with `{"error": "..."}`, missing params get
//! `{"error": "Series URL is required"}`, unknown paths fall back to the SPA
//! `index.html`, and a bare `BASE_PATH` prefix 301-redirects to `BASE_PATH/`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::api;
use crate::http::Upstream;
use crate::static_files;

pub struct AppState {
    pub upstream: Upstream,
    /// Directory with the built SPA (`dist/public`).
    pub ui_dist: PathBuf,
    /// Mount prefix of the whole app (empty when served at the root).
    pub base_path: String,
}

pub type SharedState = Arc<AppState>;

pub fn router(state: SharedState) -> Router {
    let base = state.base_path.clone();

    // All route paths are built with the prefix baked in (the Node version
    // mounts the router at BASE_PATH instead — same visible behavior).
    let mut app = Router::new()
        .route(&format!("{base}/api/search"), get(handler_search))
        .route(&format!("{base}/api/series-list"), get(handler_series_list))
        .route(&format!("{base}/api/playlist"), get(handler_playlist))
        .route(&format!("{base}/api/series"), get(handler_series))
        .route(
            &format!("{base}/api/series-details"),
            get(handler_series_details),
        )
        .route(&format!("{base}/"), get(handler_index));
    if !base.is_empty() {
        // Bare prefix (no trailing slash): 301 handled inside handler_index.
        app = app.route(&base, get(handler_index));
    }

    app.fallback(fallback).with_state(state)
}

/// SPA entry + bare-prefix redirect.
async fn handler_index(
    State(state): State<SharedState>,
    uri: Uri,
    headers: HeaderMap,
) -> Response {
    // Non-strict routing in Express matches both `/svm` and `/svm/`; only the
    // bare prefix (no slash) needs the redirect so relative asset URLs keep
    // resolving against the app root.
    if !state.base_path.is_empty() && uri.path() == state.base_path {
        // Node sends `res.redirect(301, ...)`; axum's Redirect helpers only
        // expose 303/307/308, so the 301 response is built directly.
        let location = match header::HeaderValue::from_str(&format!("{}/", state.base_path)) {
            Ok(value) => value,
            Err(_) => return not_found(),
        };
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::MOVED_PERMANENTLY;
        response.headers_mut().insert(header::LOCATION, location);
        return response;
    }
    static_files::serve_index(&state.ui_dist, &headers)
}

/// `express.static` + SPA fallback, mounted under the prefix when set.
async fn fallback(State(state): State<SharedState>, uri: Uri, headers: HeaderMap) -> Response {
    let path = uri.path();
    let base = state.base_path.as_str();

    let rel = if base.is_empty() {
        path
    } else {
        match path.strip_prefix(base) {
            // "/svm/..." -> "..." ; anything not under the prefix is 404,
            // like the Node router mounted at BASE_PATH.
            Some(rest) if rest.starts_with('/') => &rest[1..],
            _ => return not_found(),
        }
    };

    static_files::serve(&state.ui_dist, rel, &headers)
}

async fn handler_search(
    State(state): State<SharedState>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let query = params.get("q").map(String::as_str).unwrap_or("");
    match api::search(&state.upstream, query).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => Json(json!({ "error": format!("Failed to fetch search results.{err}") }))
            .into_response(),
    }
}

async fn handler_series_list(State(state): State<SharedState>) -> Response {
    match api::series_list(&state.upstream).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => {
            Json(json!({ "error": format!("Failed to fetch series list.{err}") })).into_response()
        }
    }
}

async fn handler_playlist(
    State(state): State<SharedState>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let Some(series_url) = params.get("url").map(String::as_str).filter(|u| !u.is_empty()) else {
        return Json(json!({ "error": "Series URL is required" })).into_response();
    };
    match api::playlist(&state.upstream, series_url).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => Json(json!({ "error": format!("Failed to fetch playlist:{err}") })).into_response(),
    }
}

async fn handler_series(
    State(state): State<SharedState>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let Some(series_url) = params.get("url").map(String::as_str).filter(|u| !u.is_empty()) else {
        return Json(json!({ "error": "Series URL is required" })).into_response();
    };
    match api::series(&state.upstream, series_url).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => Json(json!({ "error": format!("Failed to fetch series:{err}") })).into_response(),
    }
}

async fn handler_series_details(
    State(state): State<SharedState>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let Some(url) = params.get("url").map(String::as_str).filter(|u| !u.is_empty()) else {
        return Json(json!({ "error": "Series URL is required" })).into_response();
    };
    match api::series_details(&state.upstream, url).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => {
            Json(json!({ "error": format!("Failed to fetch series info:{err}") })).into_response()
        }
    }
}

fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "Not Found").into_response()
}
