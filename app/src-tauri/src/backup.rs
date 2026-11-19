//! Every write is preceded by a copy of what was there.

use std::path::{Path, PathBuf};

use serde_json::Value;
use time::format_description::BorrowedFormatItem;
use time::macros::format_description;
use time::OffsetDateTime;

use crate::paths;

pub type Result<T> = std::result::Result<T, String>;

const APPLY: &str = "apply";
const RESTORE: &str = "restore";

pub fn directory() -> PathBuf {
    paths::data_dir().join("backups")
}

fn slug(serial: Option<&str>) -> String {
    serial
        .unwrap_or("device")
        .chars()
        .map(|char| {
            if char.is_alphanumeric() || char == '-' || char == '_' {
                char
            } else {
                '-'
            }
        })
        .collect()
}

const STAMP: &[BorrowedFormatItem<'static>] =
    format_description!("[year][month][day]T[hour][minute][second]Z");

/// UTC, seconds, sortable — the file name is also the ordering.
fn stamp_of(at: OffsetDateTime) -> String {
    at.format(STAMP)
        .unwrap_or_else(|_| at.unix_timestamp().to_string())
}

fn stamp() -> String {
    stamp_of(OffsetDateTime::now_utc())
}

pub fn save(state: &Value, serial: Option<&str>, kind: &str) -> Result<PathBuf> {
    let directory = directory();
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("could not make the backup folder: {error}"))?;

    let path = directory.join(format!("{}-{kind}-{}.json", stamp(), slug(serial)));
    let body = serde_json::to_string_pretty(state)
        .map_err(|error| format!("could not write the backup: {error}"))?;

    std::fs::write(&path, body).map_err(|error| format!("could not write the backup: {error}"))?;
    Ok(path)
}

pub fn save_before_write(state: &Value, serial: Option<&str>) -> Result<PathBuf> {
    save(state, serial, APPLY)
}

pub fn history() -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(directory()) else {
        return Vec::new();
    };

    let mut found: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .collect();

    // By the time each was written, not by name: a backup saved or renamed by
    // hand has no timestamp in front and would otherwise sort first.
    found.sort_by_key(|path| {
        std::cmp::Reverse(path.metadata().and_then(|meta| meta.modified()).ok())
    });
    found
}

/**
 * The layout to undo back to.
 *
 * Restores are backed up too, so a mistaken undo is itself recoverable, but they
 * must not become the next undo target — otherwise pressing undo twice puts the
 * change back. Anything that is not a restore counts, which also covers backups
 * written before the name carried a kind.
 */
pub fn latest() -> Option<PathBuf> {
    history()
        .into_iter()
        .find(|path| !path.to_string_lossy().contains(&format!("-{RESTORE}-")))
}

pub fn read(path: &Path) -> Result<Value> {
    let body = std::fs::read_to_string(path)
        .map_err(|error| format!("could not read the backup: {error}"))?;
    serde_json::from_str(&body).map_err(|error| format!("the backup is not readable: {error}"))
}

pub fn mark_restore(state: &Value, serial: Option<&str>) -> Result<PathBuf> {
    save(state, serial, RESTORE)
}

#[cfg(test)]
mod tests {
    use time::OffsetDateTime;

    use super::{slug, stamp_of};

    fn at(seconds: i64) -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(seconds).expect("a valid timestamp")
    }

    #[test]
    fn the_stamp_sorts_and_carries_the_time() {
        assert_eq!(stamp_of(at(0)), "19700101T000000Z");
        assert_eq!(stamp_of(at(11_016 * 86_400)), "20000229T000000Z");
        assert_eq!(stamp_of(at(19_782 * 86_400 + 3_661)), "20240229T010101Z");
        assert!(stamp_of(at(1)) < stamp_of(at(86_400)));
    }

    #[test]
    fn a_serial_with_odd_characters_is_slugged() {
        assert_eq!(slug(Some("0000-8140_ABC")), "0000-8140_ABC");
        assert_eq!(slug(Some("a/b c:d")), "a-b-c-d");
        assert_eq!(slug(None), "device");
    }
}
