mod backup;
mod catalog;
pub mod cli;
pub mod device;
mod paths;
mod plan;
mod rules;
mod write;

use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Emitter};

const PROGRESS_EVENT: &str = "iconstate://progress";

type Answer<T> = Result<T, String>;

/// Progress is narrated to the window as it happens; the return value is only
/// ever the finished thing.
fn say(app: &AppHandle, event: serde_json::Value) {
    let _ = app.emit(PROGRESS_EVENT, event);
}

#[tauri::command]
fn user_rules() -> Answer<Option<rules::UserRules>> {
    rules::load()
}

#[tauri::command]
fn save_rules(rules: rules::UserRules) -> Answer<String> {
    rules::save(&rules).map(|path| path.to_string_lossy().into_owned())
}

fn icon_cache() -> PathBuf {
    paths::data_dir().join("icons")
}

async fn connect(app: &AppHandle, serial: Option<&str>) -> Answer<serde_json::Value> {
    say(app, json!({ "event": "connecting" }));
    let (about, state) = device::layout(serial).await?;

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
    let wanted = match keys {
        Some(keys) => keys,
        None => {
            let (_, state, _) = device::icon_state(serial.as_deref()).await?;
            let mut wanted = plan::keys(&state);
            let mut seen = std::collections::HashSet::new();
            wanted.retain(|key| seen.insert(key.clone()));
            wanted
        }
    };

    say(
        &app,
        json!({ "event": "icons-wanted", "count": wanted.len() }),
    );
    let handle = app.clone();
    let manifest = device::icons(
        serial.as_deref(),
        &wanted,
        &icon_cache(),
        |_, done, total| {
            say(
                &handle,
                json!({ "event": "icon", "done": done, "total": total }),
            );
        },
    )
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
    let (_, current, metrics) = device::icon_state(serial.as_deref()).await?;
    plan::ensure_valid(&plan, &current, &plan::Limits::from_metrics(&metrics))?;
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
