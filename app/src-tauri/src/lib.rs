mod backup;
mod catalog;
pub mod cli;
pub mod device;
mod plan;
mod write;

use std::path::{Path, PathBuf};

use serde_json::json;
use tauri::{AppHandle, Emitter};

const PROGRESS_EVENT: &str = "iconstate://progress";

type Answer<T> = Result<T, String>;

/// Progress is narrated to the window as it happens; the return value is only
/// ever the finished thing.
fn say(app: &AppHandle, event: serde_json::Value) {
    let _ = app.emit(PROGRESS_EVENT, event);
}

fn rules_file() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Path::new(&home).join(".iconstate").join("rules.json")
}

/// A table built from someone's own home screen. It never ships with the app and
/// never leaves this machine.
#[tauri::command]
fn user_rules() -> Answer<Option<serde_json::Value>> {
    let path = rules_file();
    if !path.is_file() {
        return Ok(None);
    }

    let body = std::fs::read_to_string(&path)
        .map_err(|error| format!("could not read your rules: {error}"))?;
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|error| format!("your rules file is not readable: {error}"))
}

#[tauri::command]
fn save_rules(rules: serde_json::Value) -> Answer<String> {
    let path = rules_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("could not make the folder for your rules: {error}"))?;
    }

    let body = serde_json::to_string_pretty(&rules)
        .map_err(|error| format!("could not write your rules: {error}"))?;
    std::fs::write(&path, body).map_err(|error| format!("could not write your rules: {error}"))?;

    Ok(path.to_string_lossy().into_owned())
}

fn icon_cache() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Path::new(&home).join(".iconstate").join("icons")
}

async fn connect(app: &AppHandle, serial: Option<&str>) -> Answer<serde_json::Value> {
    say(app, json!({ "event": "connecting" }));
    let (about, state, metrics) = device::icon_state(serial).await?;

    say(
        app,
        json!({
            "event": "connected",
            "name": about.name,
            "ios": about.ios,
            "model": about.model,
            "serial": about.serial,
        }),
    );

    let pages = state.as_array().map(|pages| pages.len().saturating_sub(1));
    say(app, json!({ "event": "icon-state-read", "pages": pages }));

    let _ = metrics;
    Ok(state)
}

#[tauri::command]
async fn list_devices() -> Answer<Vec<device::DeviceRow>> {
    device::devices().await
}

#[tauri::command]
async fn read_icon_state(app: AppHandle, serial: Option<String>) -> Answer<serde_json::Value> {
    connect(&app, serial.as_deref()).await
}

#[tauri::command]
async fn fetch_metrics(serial: Option<String>) -> Answer<serde_json::Value> {
    device::metrics(serial.as_deref()).await
}

#[tauri::command]
async fn fetch_icons(
    app: AppHandle,
    serial: Option<String>,
    keys: Option<Vec<String>>,
) -> Answer<std::collections::BTreeMap<String, String>> {
    // The window usually knows which icons it wants; reading the layout again
    // just to work them out would cost another trip to the phone.
    if let Some(keys) = keys {
        say(
            &app,
            json!({ "event": "icons-wanted", "count": keys.len() }),
        );
        let handle = app.clone();
        let manifest = device::icons(serial.as_deref(), &keys, &icon_cache(), |_, done, total| {
            say(
                &handle,
                json!({ "event": "icon", "done": done, "total": total }),
            );
        })
        .await?;
        say(&app, json!({ "event": "icons-ready" }));
        return Ok(manifest
            .into_iter()
            .map(|(key, path)| (key, path.to_string_lossy().into_owned()))
            .collect());
    }

    let (_, state, _) = device::icon_state(serial.as_deref()).await?;

    let mut wanted = plan::keys(&state);
    let mut seen = std::collections::HashSet::new();
    wanted.retain(|key| seen.insert(key.clone()));

    say(
        &app,
        json!({ "event": "icons-wanted", "count": wanted.len() }),
    );

    let cache = icon_cache();
    let handle = app.clone();
    let manifest = device::icons(serial.as_deref(), &wanted, &cache, |_, done, total| {
        say(
            &handle,
            json!({ "event": "icon", "done": done, "total": total }),
        );
    })
    .await?;

    say(&app, json!({ "event": "icons-ready" }));

    Ok(manifest
        .into_iter()
        .map(|(key, path)| (key, path.to_string_lossy().into_owned()))
        .collect())
}

#[tauri::command]
async fn lookup_genres(
    app: AppHandle,
    bundle_ids: Vec<String>,
    country: Option<String>,
) -> Answer<catalog::Genres> {
    say(
        &app,
        json!({ "event": "looking-up", "count": bundle_ids.len() }),
    );

    let handle = app.clone();
    let found = catalog::lookup(
        &bundle_ids,
        country.as_deref().unwrap_or("us"),
        |_, done, total| {
            say(
                &handle,
                json!({ "event": "looked-up", "done": done, "total": total }),
            );
        },
    )
    .await?;

    let resolved = found.values().filter(|genres| !genres.is_empty()).count();
    say(
        &app,
        json!({ "event": "looked-up-done", "resolved": resolved }),
    );
    Ok(found)
}

#[tauri::command]
async fn apply_layout(
    app: AppHandle,
    serial: Option<String>,
    plan: serde_json::Value,
) -> Answer<serde_json::Value> {
    let (_, current, _) = device::icon_state(serial.as_deref()).await?;
    let applied =
        write::apply(serial.as_deref(), &current, &plan, |event| say(&app, event)).await?;
    Ok(applied.settled)
}

#[tauri::command]
async fn restore_backup(
    app: AppHandle,
    serial: Option<String>,
    file: Option<String>,
) -> Answer<serde_json::Value> {
    let restored = write::restore(serial.as_deref(), file.map(PathBuf::from), |event| {
        say(&app, event)
    })
    .await?;
    Ok(restored.settled)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            user_rules,
            save_rules,
            read_icon_state,
            fetch_metrics,
            fetch_icons,
            lookup_genres,
            apply_layout,
            restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
