//! The rule table built from someone's own home screen. It never ships with the
//! app and never leaves this machine.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::paths;

pub type Result<T> = std::result::Result<T, String>;

/// What `app/src/lib/rules.ts` calls `UserRules`. The file is read into this
/// shape, so a damaged one is reported instead of reaching the window as
/// something that only looks like rules.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRules {
    pub dock: Vec<String>,
    pub folder_order: Vec<String>,
    pub rules: BTreeMap<String, String>,
}

fn file() -> PathBuf {
    paths::data_dir().join("rules.json")
}

fn parse(body: &str) -> Result<UserRules> {
    serde_json::from_str(body).map_err(|error| format!("your rules file is not readable: {error}"))
}

fn load_from(path: &Path) -> Result<Option<UserRules>> {
    if !path.is_file() {
        return Ok(None);
    }
    let body = std::fs::read_to_string(path)
        .map_err(|error| format!("could not read your rules: {error}"))?;
    parse(&body).map(Some)
}

pub fn load() -> Result<Option<UserRules>> {
    load_from(&file())
}

pub fn save(rules: &UserRules) -> Result<PathBuf> {
    let path = file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("could not make the folder for your rules: {error}"))?;
    }

    let body = serde_json::to_string_pretty(rules)
        .map_err(|error| format!("could not write your rules: {error}"))?;
    std::fs::write(&path, body).map_err(|error| format!("could not write your rules: {error}"))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::{load_from, parse};

    #[test]
    fn a_saved_table_reads_back() {
        let rules = parse(
            r#"{ "dock": ["com.apple.mobilephone"], "folderOrder": ["Games"], "rules": { "com.a": "Games" } }"#,
        )
        .expect("valid rules");

        assert_eq!(rules.dock, ["com.apple.mobilephone"]);
        assert_eq!(rules.folder_order, ["Games"]);
        assert_eq!(rules.rules["com.a"], "Games");
    }

    #[test]
    fn a_damaged_table_is_reported_not_passed_on() {
        assert!(parse(r#"{ "rules": { "com.a": "Games" } }"#).is_err());
        assert!(parse(r#"{ "dock": [], "folderOrder": "Games", "rules": {} }"#).is_err());
        assert!(parse("not json").is_err());
    }

    #[test]
    fn no_file_means_no_rules_yet() {
        let directory = tempfile::tempdir().expect("temp dir");
        assert_eq!(load_from(&directory.path().join("rules.json")), Ok(None));
    }
}
