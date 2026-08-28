//! Every write is preceded by a copy of what was there.

use std::path::{Path, PathBuf};

use serde_json::Value;

pub type Result<T> = std::result::Result<T, String>;

const APPLY: &str = "apply";
const RESTORE: &str = "restore";

pub fn directory() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    Path::new(&home).join(".iconstate").join("backups")
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

/// Civil date from days since the epoch — Howard Hinnant's algorithm.
fn civil(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// UTC, seconds, sortable — the file name is also the ordering.
fn stamp_at(now: u64) -> String {
    let (days, seconds) = ((now / 86_400) as i64, now % 86_400);
    let (hour, minute, second) = (seconds / 3600, (seconds % 3600) / 60, seconds % 60);
    let (year, month, day) = civil(days);
    format!("{year:04}{month:02}{day:02}T{hour:02}{minute:02}{second:02}Z")
}

fn stamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_secs())
        .unwrap_or(0);
    stamp_at(now)
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

    found.sort();
    found.reverse();
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
    use super::{civil, slug, stamp_at};

    /// The date is worked out by hand, so it is checked against days whose
    /// answers are known — including both kinds of century.
    #[test]
    fn the_calendar_is_right() {
        assert_eq!(civil(0), (1970, 1, 1));
        assert_eq!(civil(59), (1970, 3, 1));
        assert_eq!(civil(11_016), (2000, 2, 29)); // 2000 is a leap year
        assert_eq!(civil(19_782), (2024, 2, 29));
        assert_eq!(civil(20_754), (2026, 10, 28));
    }

    #[test]
    fn the_stamp_sorts_and_carries_the_time() {
        assert_eq!(stamp_at(0), "19700101T000000Z");
        assert_eq!(stamp_at(19_782 * 86_400 + 3_661), "20240229T010101Z");
        assert!(stamp_at(1) < stamp_at(86_400));
    }

    #[test]
    fn a_serial_with_odd_characters_is_slugged() {
        assert_eq!(slug(Some("0000-8140_ABC")), "0000-8140_ABC");
        assert_eq!(slug(Some("a/b c:d")), "a-b-c-d");
        assert_eq!(slug(None), "device");
    }
}
