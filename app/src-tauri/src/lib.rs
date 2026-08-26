use std::io::Write;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const PROGRESS_EVENT: &str = "iconstate://progress";

#[derive(Debug, Serialize)]
struct CoreFailure {
    message: String,
    events: Vec<serde_json::Value>,
}

impl CoreFailure {
    fn new(message: impl Into<String>, events: Vec<serde_json::Value>) -> Self {
        Self {
            message: message.into(),
            events,
        }
    }
}

async fn run_core(app: &AppHandle, args: Vec<String>) -> Result<String, CoreFailure> {
    let command = app
        .shell()
        .sidecar("iconstate-core")
        .map_err(|error| CoreFailure::new(format!("sidecar not found: {error}"), Vec::new()))?
        .args(&args);

    let (mut rx, _child) = command.spawn().map_err(|error| {
        CoreFailure::new(format!("could not start the core: {error}"), Vec::new())
    })?;

    let mut stdout = String::new();
    let mut events: Vec<serde_json::Value> = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(chunk) => stdout.push_str(&String::from_utf8_lossy(&chunk)),
            CommandEvent::Stderr(chunk) => {
                for line in String::from_utf8_lossy(&chunk).lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<serde_json::Value>(line) {
                        Ok(value) => {
                            let _ = app.emit(PROGRESS_EVENT, value.clone());
                            events.push(value);
                        }
                        Err(_) => eprintln!("core: {line}"),
                    }
                }
            }
            CommandEvent::Terminated(payload) if payload.code != Some(0) => {
                let message = events
                    .iter()
                    .rev()
                    .find(|event| event.get("event").and_then(|e| e.as_str()) == Some("error"))
                    .and_then(|event| event.get("message"))
                    .and_then(|message| message.as_str())
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("core exited with {:?}", payload.code));
                return Err(CoreFailure::new(message, events));
            }
            _ => {}
        }
    }

    Ok(stdout)
}

async fn run_core_json(
    app: &AppHandle,
    args: Vec<String>,
) -> Result<serde_json::Value, CoreFailure> {
    let stdout = run_core(app, args).await?;
    serde_json::from_str(&stdout).map_err(|error| {
        CoreFailure::new(format!("core returned invalid JSON: {error}"), Vec::new())
    })
}

#[tauri::command]
async fn core_version(app: AppHandle) -> Result<String, CoreFailure> {
    Ok(run_core(&app, vec!["--version".into()])
        .await?
        .trim()
        .to_owned())
}

#[tauri::command]
async fn list_devices(app: AppHandle) -> Result<serde_json::Value, CoreFailure> {
    run_core_json(&app, vec!["devices".into(), "--json".into()]).await
}

fn write_temp(name: &str, value: &serde_json::Value) -> Result<std::path::PathBuf, CoreFailure> {
    let path = std::env::temp_dir().join(format!("iconstate-{name}.json"));
    let mut file = std::fs::File::create(&path).map_err(|error| {
        CoreFailure::new(format!("could not stage {name}: {error}"), Vec::new())
    })?;
    file.write_all(value.to_string().as_bytes())
        .map_err(|error| {
            CoreFailure::new(format!("could not stage {name}: {error}"), Vec::new())
        })?;
    Ok(path)
}

#[tauri::command]
async fn read_icon_state(
    app: AppHandle,
    serial: Option<String>,
) -> Result<serde_json::Value, CoreFailure> {
    let mut args = vec!["dump".into()];
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    run_core_json(&app, args).await
}

#[tauri::command]
async fn plan_layout(
    app: AppHandle,
    serial: Option<String>,
    assignments: Option<serde_json::Value>,
    lookup: Option<bool>,
    country: Option<String>,
) -> Result<serde_json::Value, CoreFailure> {
    let mut args = vec!["plan".to_string(), "--json".to_string()];
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    if lookup.unwrap_or(false) {
        args.push("--lookup".into());
        args.push("--country".into());
        args.push(country.unwrap_or_else(|| "us".into()));
    }
    if let Some(assignments) = assignments {
        let path = write_temp("assignments", &assignments)?;
        args.push("--assign".into());
        args.push(path.to_string_lossy().into_owned());
    }
    run_core_json(&app, args).await
}

#[tauri::command]
async fn diff_layout(
    app: AppHandle,
    serial: Option<String>,
    plan: serde_json::Value,
) -> Result<serde_json::Value, CoreFailure> {
    let path = write_temp("plan", &plan)?;
    let mut args = vec![
        "diff".to_string(),
        "--json".to_string(),
        "--plan".to_string(),
        path.to_string_lossy().into_owned(),
    ];
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    run_core_json(&app, args).await
}

#[tauri::command]
async fn apply_layout(
    app: AppHandle,
    serial: Option<String>,
    plan: serde_json::Value,
) -> Result<(), CoreFailure> {
    let path = write_temp("plan", &plan)?;
    let mut args = vec![
        "apply".to_string(),
        "--yes".to_string(),
        "--plan".to_string(),
        path.to_string_lossy().into_owned(),
    ];
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    run_core(&app, args).await.map(|_| ())
}

#[tauri::command]
async fn fetch_icons(
    app: AppHandle,
    serial: Option<String>,
) -> Result<serde_json::Value, CoreFailure> {
    let mut args = vec!["icons".to_string()];
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    run_core_json(&app, args).await
}

#[tauri::command]
async fn list_backups(app: AppHandle) -> Result<serde_json::Value, CoreFailure> {
    run_core_json(&app, vec!["backups".into(), "--json".into()]).await
}

#[tauri::command]
async fn restore_backup(
    app: AppHandle,
    serial: Option<String>,
    file: Option<String>,
) -> Result<(), CoreFailure> {
    let mut args = vec!["restore".to_string(), "--yes".to_string()];
    if let Some(file) = file {
        args.push(file);
    }
    if let Some(serial) = serial {
        args.push("--serial".into());
        args.push(serial);
    }
    run_core(&app, args).await.map(|_| ())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
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
            core_version,
            list_devices,
            read_icon_state,
            plan_layout,
            diff_layout,
            apply_layout,
            fetch_icons,
            list_backups,
            restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
