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
            read_icon_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
