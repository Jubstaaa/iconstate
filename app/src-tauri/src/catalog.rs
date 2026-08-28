//! Bundle identifier to App Store genre lookup.
//!
//! Separate from the device layer because it touches the network. No account, no
//! key, no rate-limit headers to manage — just the public iTunes lookup endpoint,
//! with answers cached on disk so a bundle identifier is only ever asked about
//! once.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub type Result<T> = std::result::Result<T, String>;

pub type Genres = BTreeMap<String, Vec<String>>;

const ENDPOINT: &str = "https://itunes.apple.com/lookup";
const USER_AGENT: &str = "iconstate (+https://github.com/Jubstaaa/iconstate)";

fn cache_file() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Path::new(&home).join(".iconstate").join("genres.json")
}

fn load(path: &Path) -> Genres {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|body| serde_json::from_str(&body).ok())
        .unwrap_or_default()
}

fn store(path: &Path, catalog: &Genres) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(body) = serde_json::to_string_pretty(catalog) {
        let _ = std::fs::write(path, body);
    }
}

async fn ask(client: &reqwest::Client, bundle_id: &str, country: &str) -> Vec<String> {
    let answer = client
        .get(ENDPOINT)
        .query(&[("bundleId", bundle_id), ("country", country)])
        .header("User-Agent", USER_AGENT)
        .send()
        .await;

    let Ok(response) = answer else { return Vec::new() };
    let Ok(payload) = response.json::<serde_json::Value>().await else {
        return Vec::new();
    };

    payload
        .get("results")
        .and_then(|results| results.as_array())
        .and_then(|results| results.first())
        .and_then(|first| first.get("genres"))
        .and_then(|genres| genres.as_array())
        .map(|genres| {
            genres
                .iter()
                .filter_map(|genre| genre.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

/**
 * Resolve genres for each bundle identifier, asking the store only about the
 * ones the cache has never seen. An app the store has never heard of —
 * sideloaded, enterprise, pulled — is cached as an empty list so it is not asked
 * about again.
 */
pub async fn lookup(
    bundle_ids: &[String],
    country: &str,
    mut on_result: impl FnMut(&str, usize, usize),
) -> Result<Genres> {
    let path = cache_file();
    let mut catalog = load(&path);
    let missing: Vec<String> = bundle_ids
        .iter()
        .filter(|key| !catalog.contains_key(*key))
        .cloned()
        .collect();

    if !missing.is_empty() {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|error| format!("could not reach the App Store: {error}"))?;

        for (index, key) in missing.iter().enumerate() {
            catalog.insert(key.clone(), ask(&client, key, country).await);
            on_result(key, index + 1, missing.len());
        }
        store(&path, &catalog);
    }

    Ok(bundle_ids
        .iter()
        .map(|key| (key.clone(), catalog.get(key).cloned().unwrap_or_default()))
        .collect())
}
