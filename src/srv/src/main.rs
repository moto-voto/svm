//! svm backend — Rust port of `src/server.js` (axum + scrape-core).
//!
//! Serves the JSON API (`/api/*`) plus the built SolidJS SPA (`dist/public`)
//! with a SPA fallback, mountable under `BASE_PATH`, exactly like the Node
//! implementation.

mod api;
mod common;
mod http;
mod models;
mod parser;
mod server;
mod static_files;
mod text;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::server::AppState;

/// Binds a dual-stack listener (`::` accepting IPv4 too) — the same socket
/// Node's `app.listen` creates, so `localhost` (which resolves to `::1`
/// first) connects without an IPv4 fallback delay. Falls back to plain
/// IPv4 when IPv6 is unavailable.
fn bind_listener(port: u16) -> Option<tokio::net::TcpListener> {
    use socket2::{Domain, Protocol, Socket, Type};

    let addr: std::net::SocketAddr = format!("[::]:{port}")
        .parse()
        .expect("valid IPv6 wildcard");
    let result = (|| -> std::io::Result<tokio::net::TcpListener> {
        let socket = Socket::new(Domain::IPV6, Type::STREAM, Some(Protocol::TCP))?;
        socket.set_only_v6(false).ok(); // dual-stack where supported
        socket.bind(&addr.into())?;
        socket.listen(1024)?;
        socket.set_nonblocking(true)?;
        tokio::net::TcpListener::from_std(socket.into())
    })();
    result.ok()
}

/// Resolves the SPA directory (`dist/public` in the Node build).
///
/// Mirrors `join(__dirname, '..', 'dist', 'public')` from server.js: the Node
/// bundle lives in `dist/`, so the same formula works when the compiled
/// binary is deployed into `dist/` next to `public/`. Falls back to the CWD
/// for development runs; `UI_DIST` overrides everything.
fn resolve_ui_dist() -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(from_env) = std::env::var("UI_DIST") {
        candidates.push(PathBuf::from(from_env));
    }
    if let Some(exe_dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
    {
        candidates.push(exe_dir.join("..").join("dist").join("public"));
    }
    candidates.push(PathBuf::from("dist").join("public"));

    candidates
        .into_iter()
        .find(|dir| dir.join("index.html").is_file())
        .unwrap_or_else(|| PathBuf::from("dist").join("public"))
}

/// Port of the `BASE_PATH` normalization in server.js: strip leading/trailing
/// slashes; empty -> `""` (served at the root), otherwise `/<prefix>`.
fn base_path() -> String {
    let raw = std::env::var("BASE_PATH").unwrap_or_else(|_| "/".to_string());
    let trimmed = raw.trim_matches('/');
    if trimmed.is_empty() {
        String::new()
    } else {
        format!("/{trimmed}")
    }
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let base_path = base_path();
    let ui_dist = resolve_ui_dist();

    let upstream = match http::Upstream::new() {
        Ok(upstream) => upstream,
        Err(err) => {
            common::log("error", &format!("Failed to initialize HTTP client: {err}"));
            std::process::exit(1);
        }
    };

    common::log("log", &format!("Serving UI from {}", ui_dist.display()));

    let state = Arc::new(AppState {
        upstream,
        ui_dist,
        base_path: base_path.clone(),
    });
    let app = server::router(state);

    let listener = match bind_listener(port) {
        Some(listener) => listener,
        None => match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
            Ok(listener) => listener,
            Err(err) => {
                common::log("error", &format!("Failed to bind 0.0.0.0:{port}: {err}"));
                std::process::exit(1);
            }
        },
    };

    common::log(
        "log",
        &format!("✅ Server running at http://localhost:{port}{base_path}/"),
    );
    if let Err(err) = axum::serve(listener, app).await {
        common::log("error", &format!("Server error: {err}"));
        std::process::exit(1);
    }
}
