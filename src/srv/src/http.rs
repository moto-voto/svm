//! Upstream HTTP client shared by all API endpoints.

use crate::common;

/// Reusable client for upstream (seasonvar) requests. One client per process
/// keeps the connection pool warm — the Node `fetch` equivalent does the same
/// via undici's global agent.
pub struct Upstream {
    client: reqwest::Client,
}

impl Upstream {
    pub fn new() -> Result<Self, reqwest::Error> {
        let client = reqwest::Client::builder()
            .default_headers(common::upstream_headers().clone())
            // Node's fetch follows up to 20 redirects by default.
            .redirect(reqwest::redirect::Policy::limited(20))
            .build()?;
        Ok(Self { client })
    }

    /// GET and return the body as text. Status codes are not checked —
    /// matching the JS implementation, which parses whatever comes back.
    pub async fn text(&self, url: &str) -> Result<String, String> {
        let response = self.client.get(url).send().await.map_err(|e| e.to_string())?;
        response.text().await.map_err(|e| e.to_string())
    }

    /// GET and parse the body as JSON (status not checked, like JS
    /// `response.json()`).
    pub async fn json(&self, url: &str) -> Result<serde_json::Value, String> {
        let response = self.client.get(url).send().await.map_err(|e| e.to_string())?;
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        serde_json::from_slice(&bytes).map_err(|e| e.to_string())
    }
}
