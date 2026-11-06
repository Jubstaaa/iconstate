//! The two ways a layout reaches the phone, shared by the window and the command
//! line so both back up, write and check the same way.

use std::path::PathBuf;

use serde_json::{json, Value};

use crate::{backup, device, plan};

pub type Result<T> = std::result::Result<T, String>;

pub struct Applied {
    pub backup: PathBuf,
    pub settled: Value,
}

pub struct Restored {
    pub from: PathBuf,
    pub replaced: PathBuf,
    pub settled: Value,
}

/// SpringBoard answers a write with nothing, so the only proof it took is the
/// layout read back afterwards. If an app went missing on the way, what was
/// there before goes straight back on.
pub async fn apply(
    serial: Option<&str>,
    current: &Value,
    layout: &Value,
    say: impl Fn(Value),
) -> Result<Applied> {
    let saved = backup::save_before_write(current, serial)?;
    say(json!({ "event": "backed-up", "file": saved.to_string_lossy() }));

    say(json!({ "event": "writing" }));
    let (_, settled) = device::write_icon_state(serial, layout).await?;
    if plan::same_apps(layout, &settled) {
        say(json!({ "event": "written" }));
        return Ok(Applied {
            backup: saved,
            settled,
        });
    }

    say(json!({ "event": "rolling-back" }));
    let (_, restored) = device::write_icon_state(serial, current).await?;
    let outcome = if plan::same_apps(current, &restored) {
        "the previous layout is back"
    } else {
        "putting the previous layout back did not take either"
    };
    Err(format!(
        "the phone did not keep every app in the plan; {outcome} (backup: {})",
        saved.display()
    ))
}

/// Restores are backed up too, so a mistaken one can itself be undone.
pub async fn restore(
    serial: Option<&str>,
    file: Option<PathBuf>,
    say: impl Fn(Value),
) -> Result<Restored> {
    let from = match file {
        Some(file) => file,
        None => backup::latest().ok_or_else(|| "there is nothing to undo to".to_string())?,
    };

    say(json!({ "event": "reading-file", "file": from.to_string_lossy() }));
    let state = backup::read(&from)?;

    let (_, current, _) = device::icon_state(serial).await?;
    let replaced = backup::mark_restore(&current, serial)?;

    say(json!({ "event": "writing" }));
    let (_, settled) = device::write_icon_state(serial, &state).await?;
    say(json!({ "event": "written" }));

    Ok(Restored {
        from,
        replaced,
        settled,
    })
}
