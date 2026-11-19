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

/// The genres in a lookup answer. `None` when the answer is not a lookup result
/// at all, which is a failure to ask rather than an app the store does not know.
fn genres_in(payload: &serde_json::Value) -> Option<Vec<String>> {
    let results = payload.get("results")?.as_array()?;
    Some(
        results
            .first()
            .and_then(|first| first.get("genres"))
            .and_then(|genres| genres.as_array())
            .map(|genres| {
                genres
                    .iter()
                    .filter_map(|genre| genre.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default(),
    )
}

/// `None` when the store could not be asked: offline, rate limited, or an answer
/// that is not JSON.
async fn ask(client: &reqwest::Client, bundle_id: &str, country: &str) -> Option<Vec<String>> {
    let response = client
        .get(ENDPOINT)
        .query(&[("bundleId", bundle_id), ("country", country)])
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?;
    let payload = response.json::<serde_json::Value>().await.ok()?;
    genres_in(&payload)
}

/**
 * Resolve genres for each bundle identifier, asking the store only about the
 * ones the cache has never seen. An app the store has never heard of —
 * sideloaded, enterprise, pulled — is cached as an empty list so it is not asked
 * about again. A lookup that failed is not cached at all, so the next sort asks
 * again instead of filing the app as unknown for good.
 */
pub async fn lookup(
    bundle_ids: &[String],
    country: &str,
    on_result: impl FnMut(&str, usize, usize),
) -> Result<Genres> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|error| format!("could not reach the App Store: {error}"))?;

    Ok(lookup_cached(
        &cache_file(),
        bundle_ids,
        |key| {
            let client = &client;
            async move { ask(client, &key, country).await }
        },
        on_result,
    )
    .await)
}

async fn lookup_cached<F, Fut>(
    path: &Path,
    bundle_ids: &[String],
    mut fetch: F,
    mut on_result: impl FnMut(&str, usize, usize),
) -> Genres
where
    F: FnMut(String) -> Fut,
    Fut: std::future::Future<Output = Option<Vec<String>>>,
{
    let mut catalog = load(path);
    let missing: Vec<String> = bundle_ids
        .iter()
        .filter(|key| !catalog.contains_key(*key))
        .cloned()
        .collect();

    if !missing.is_empty() {
        let mut learned = false;
        for (index, key) in missing.iter().enumerate() {
            if let Some(genres) = fetch(key.clone()).await {
                catalog.insert(key.clone(), genres);
                learned = true;
            }
            on_result(key, index + 1, missing.len());
        }
        if learned {
            store(path, &catalog);
        }
    }

    bundle_ids
        .iter()
        .map(|key| (key.clone(), catalog.get(key).cloned().unwrap_or_default()))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use serde_json::json;

    use super::{genres_in, load, lookup_cached};

    fn keys(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| word.to_string()).collect()
    }

    #[test]
    fn an_answer_with_no_results_is_an_unknown_app_not_a_failure() {
        assert_eq!(
            genres_in(&json!({ "resultCount": 0, "results": [] })),
            Some(vec![])
        );
        assert_eq!(
            genres_in(&json!({ "results": [{ "genres": ["Games", "Puzzle"] }] })),
            Some(vec!["Games".to_string(), "Puzzle".to_string()])
        );
        assert_eq!(genres_in(&json!({ "errorMessage": "rate limited" })), None);
    }

    #[tokio::test]
    async fn a_failed_lookup_is_asked_again_next_time() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = directory.path().join("genres.json");
        let wanted = keys(&["com.up", "com.unknown", "com.down"]);

        let found = lookup_cached(
            &path,
            &wanted,
            |key| {
                let answer = match key.as_str() {
                    "com.up" => Some(vec!["Games".to_string()]),
                    "com.unknown" => Some(vec![]),
                    _ => None,
                };
                async move { answer }
            },
            |_, _, _| {},
        )
        .await;
        assert_eq!(found["com.up"], ["Games"]);
        assert!(found["com.down"].is_empty());

        let cached = load(&path);
        assert!(cached.contains_key("com.up"));
        assert!(cached.contains_key("com.unknown"));
        assert!(!cached.contains_key("com.down"));

        let asked = RefCell::new(Vec::new());
        lookup_cached(
            &path,
            &wanted,
            |key| {
                asked.borrow_mut().push(key);
                async { Some(vec!["Utilities".to_string()]) }
            },
            |_, _, _| {},
        )
        .await;
        assert_eq!(asked.into_inner(), ["com.down"]);
    }
}
