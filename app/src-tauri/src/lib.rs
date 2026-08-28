mod backup;
mod catalog;
pub mod device;

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
async fn installed_apps(app: AppHandle, serial: Option<String>) -> Answer<serde_json::Value> {
    let apps = device::installed_apps(serial.as_deref()).await?;
    let count = apps.as_object().map(|map| map.len()).unwrap_or(0);
    say(
        &app,
        json!({ "event": "installed-apps-read", "count": count }),
    );
    Ok(apps)
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

    let mut wanted: Vec<String> = Vec::new();
    let mut push = |icon: &serde_json::Value| {
        let key = icon
            .get("bundleIdentifier")
            .or_else(|| icon.get("displayIdentifier"))
            .and_then(|value| value.as_str());
        if let Some(key) = key {
            if !wanted.iter().any(|seen| seen == key) {
                wanted.push(key.to_owned());
            }
        }
    };

    for page in state.as_array().into_iter().flatten() {
        for item in page.as_array().into_iter().flatten() {
            match item.get("iconLists") {
                Some(lists) => {
                    for folder_page in lists.as_array().into_iter().flatten() {
                        for icon in folder_page.as_array().into_iter().flatten() {
                            push(icon);
                        }
                    }
                }
                None => push(item),
            }
        }
    }

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
    let saved = backup::save_before_write(&current, serial.as_deref())?;
    say(
        &app,
        json!({ "event": "backed-up", "file": saved.to_string_lossy() }),
    );

    say(&app, json!({ "event": "writing" }));
    let (_, settled) = device::write_icon_state(serial.as_deref(), &plan).await?;
    say(&app, json!({ "event": "written" }));

    Ok(settled)
}

#[tauri::command]
async fn list_backups() -> Answer<Vec<String>> {
    Ok(backup::history()
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
async fn restore_backup(
    app: AppHandle,
    serial: Option<String>,
    file: Option<String>,
) -> Answer<serde_json::Value> {
    let path = match file {
        Some(file) => PathBuf::from(file),
        None => backup::latest().ok_or_else(|| "there is nothing to undo to".to_string())?,
    };

    say(
        &app,
        json!({ "event": "reading-file", "file": path.to_string_lossy() }),
    );
    let state = backup::read(&path)?;

    let (_, current, _) = device::icon_state(serial.as_deref()).await?;
    backup::mark_restore(&current, serial.as_deref())?;

    say(&app, json!({ "event": "writing" }));
    let (_, settled) = device::write_icon_state(serial.as_deref(), &state).await?;
    say(&app, json!({ "event": "written" }));

    Ok(settled)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            read_icon_state,
            fetch_metrics,
            fetch_icons,
            installed_apps,
            lookup_genres,
            apply_layout,
            list_backups,
            restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
