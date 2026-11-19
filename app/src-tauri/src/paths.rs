//! Where IconState keeps its own files: backups, the icon and genre caches, and
//! the rules built from someone's own home screen. The window's asset scope in
//! `tauri.conf.json` points at the same folder.

use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".iconstate")
}
