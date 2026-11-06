//! What the command line checks before it lets a layout near the phone.
//!
//! The window runs the same rules in `app/src/lib/validate.ts`; the command line
//! has no TypeScript to call, so the ones that can lose an app or get a write
//! refused are repeated here.

use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct Limits {
    pub dock: usize,
    pub page: usize,
    pub folder_page: usize,
    pub pages: usize,
}

impl Limits {
    /// The grid SpringBoard reports, with the same fallbacks the window uses.
    pub fn from_metrics(metrics: &Value) -> Self {
        let pick = |key: &str, fallback: usize| {
            metrics
                .get(key)
                .and_then(Value::as_f64)
                .filter(|value| *value > 0.0)
                .map(|value| value.round() as usize)
                .unwrap_or(fallback)
        };

        Limits {
            dock: pick("homeScreenIconDockMaxCount", 4),
            page: pick("homeScreenIconRows", 6) * pick("homeScreenIconColumns", 4),
            folder_page: pick("homeScreenIconFolderRows", 3)
                * pick("homeScreenIconFolderColumns", 3),
            pages: pick("homeScreenIconMaxPages", 15),
        }
    }
}

#[derive(Debug, Default, Serialize)]
pub struct Report {
    pub ok: bool,
    pub missing: Vec<String>,
    pub unknown: Vec<String>,
    pub duplicated: Vec<String>,
    pub issues: Vec<String>,
}

fn is_folder(item: &Value) -> bool {
    item.get("iconLists").is_some()
}

/// Bundle identifier first; a few system icons only carry a display identifier.
fn key_of(app: &Value) -> Option<&str> {
    app.get("bundleIdentifier")
        .or_else(|| app.get("displayIdentifier"))
        .and_then(Value::as_str)
}

fn pages_of(state: &Value) -> impl Iterator<Item = &Vec<Value>> {
    state
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_array)
}

fn folder_pages(folder: &Value) -> impl Iterator<Item = &Vec<Value>> {
    folder
        .get("iconLists")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_array)
}

/// Every app in the layout, in order, folders opened up.
pub fn keys(state: &Value) -> Vec<String> {
    let mut found = Vec::new();
    for item in pages_of(state).flatten() {
        if is_folder(item) {
            for app in folder_pages(item).flatten() {
                found.extend(key_of(app).map(str::to_owned));
            }
        } else {
            found.extend(key_of(item).map(str::to_owned));
        }
    }
    found
}

pub fn same_apps(left: &Value, right: &Value) -> bool {
    let mut left = keys(left);
    let mut right = keys(right);
    left.sort();
    right.sort();
    left == right
}

/// A plan passes when it places every installed app exactly once and fits the grid.
pub fn check(plan: &Value, inventory: &Value, limits: &Limits) -> Report {
    let mut report = Report::default();

    if !plan.is_array() {
        report.issues.push("the plan is not a list of pages".into());
        return report;
    }

    let mut placed: BTreeMap<String, usize> = BTreeMap::new();
    for key in keys(plan) {
        *placed.entry(key).or_default() += 1;
    }
    let installed: BTreeMap<String, usize> =
        keys(inventory).into_iter().map(|key| (key, 1)).collect();

    for (key, count) in &placed {
        if *count > 1 {
            report.duplicated.push(key.clone());
            report.issues.push(format!("{key} is placed {count} times"));
        }
        if !installed.contains_key(key) {
            report.unknown.push(key.clone());
            report.issues.push(format!(
                "{key} is in the plan but not installed on the phone"
            ));
        }
    }
    for key in installed.keys() {
        if !placed.contains_key(key) {
            report.missing.push(key.clone());
            report
                .issues
                .push(format!("{key} is on the phone but not in the plan"));
        }
    }

    let mut pages = pages_of(plan);
    if let Some(dock) = pages.next() {
        if dock.len() > limits.dock {
            report.issues.push(format!(
                "the dock holds {} items, the phone takes {}",
                dock.len(),
                limits.dock
            ));
        }
    }

    let pages: Vec<&Vec<Value>> = pages.collect();
    if pages.len() > limits.pages {
        report.issues.push(format!(
            "the layout has {} pages, the phone takes {}",
            pages.len(),
            limits.pages
        ));
    }
    for (index, page) in pages.iter().enumerate() {
        if page.len() > limits.page {
            report.issues.push(format!(
                "page {} holds {} items, the phone takes {}",
                index + 1,
                page.len(),
                limits.page
            ));
        }
    }

    for folder in pages_of(plan).flatten().filter(|item| is_folder(item)) {
        let name = folder
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or("a folder");
        if folder_pages(folder).all(Vec::is_empty) {
            report.issues.push(format!("folder '{name}' is empty"));
        }
        for (index, page) in folder_pages(folder).enumerate() {
            if page.len() > limits.folder_page {
                report.issues.push(format!(
                    "folder '{name}' page {} holds {} items, the phone takes {}",
                    index + 1,
                    page.len(),
                    limits.folder_page
                ));
            }
        }
    }

    report.ok = report.issues.is_empty();
    report
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::{check, keys, same_apps, Limits};

    fn fixture() -> Value {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../reference/fixtures/state-c3.json"
        );
        serde_json::from_str(&std::fs::read_to_string(path).expect("fixture")).expect("json")
    }

    fn limits() -> Limits {
        Limits::from_metrics(&Value::Null)
    }

    fn app(key: &str) -> Value {
        json!({ "bundleIdentifier": key, "displayIdentifier": key })
    }

    #[test]
    fn a_real_layout_passes_against_itself() {
        let state = fixture();
        let report = check(&state, &state, &limits());
        assert!(report.ok, "{:?}", report.issues);
        assert!(!keys(&state).is_empty());
    }

    #[test]
    fn folders_are_opened_up() {
        let state = json!([
            [app("a")],
            [app("b"), { "displayName": "F", "listType": "folder", "iconLists": [[app("c")], [app("d")]] }]
        ]);
        assert_eq!(keys(&state), ["a", "b", "c", "d"]);
    }

    #[test]
    fn a_lost_or_doubled_app_is_refused() {
        let phone = json!([[app("a")], [app("b"), app("c")]]);
        let plan = json!([[app("a")], [app("b"), app("b"), app("x")]]);
        let report = check(&plan, &phone, &limits());
        assert!(!report.ok);
        assert_eq!(report.missing, ["c"]);
        assert_eq!(report.duplicated, ["b"]);
        assert_eq!(report.unknown, ["x"]);
    }

    #[test]
    fn the_grid_comes_from_the_phone() {
        let metrics = json!({ "homeScreenIconRows": 2.0, "homeScreenIconColumns": 2.0, "homeScreenIconDockMaxCount": 1.0 });
        let phone = json!([
            [app("a"), app("b")],
            [app("c"), app("d"), app("e"), app("f"), app("g")]
        ]);
        let report = check(&phone, &phone, &Limits::from_metrics(&metrics));
        assert!(!report.ok);
        assert_eq!(report.issues.len(), 2);
    }

    #[test]
    fn order_does_not_matter_to_the_read_back() {
        let written = json!([[app("a")], [app("b"), app("c")]]);
        let settled = json!([[app("a")], [app("c")], [app("b")]]);
        assert!(same_apps(&written, &settled));
        assert!(!same_apps(&written, &json!([[app("a")], [app("b")]])));
    }
}
