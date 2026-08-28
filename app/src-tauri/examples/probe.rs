//! Read the phone through the Rust device layer and print what it says, so the
//! answer can be diffed against the Python core's.

#[tokio::main]
async fn main() {
    let what = std::env::args().nth(1).unwrap_or_else(|| "state".into());

    match what.as_str() {
        "devices" => {
            let found = iconstate_lib::device::devices().await.expect("devices");
            println!("{}", serde_json::to_string_pretty(&found).unwrap());
        }
        "metrics" => {
            let metrics = iconstate_lib::device::metrics(None).await.expect("metrics");
            println!("{}", serde_json::to_string_pretty(&metrics).unwrap());
        }
        "icons" => {
            let wanted: Vec<String> = std::env::args().skip(2).collect();
            let directory = std::env::temp_dir().join("iconstate-probe-icons");
            let manifest = iconstate_lib::device::icons(None, &wanted, &directory, |key, at, all| {
                eprintln!("{at}/{all} {key}");
            })
            .await
            .expect("icons");
            println!("{}", serde_json::to_string_pretty(&manifest).unwrap());
        }
        "write-roundtrip" => {
            let (_, before, _) = iconstate_lib::device::icon_state(None).await.expect("read");
            let backup = std::env::args().nth(2).expect("give a backup path");
            std::fs::write(&backup, serde_json::to_string_pretty(&before).unwrap()).expect("backup");
            eprintln!("backed up to {backup}");

            let (_, settled) = iconstate_lib::device::write_icon_state(None, &before)
                .await
                .expect("write");
            eprintln!("wrote it back");

            println!("{}", serde_json::to_string_pretty(&settled).unwrap());
        }
        "format" => {
            let format = std::env::args().nth(2);
            let state = iconstate_lib::device::icon_state_as(None, format.as_deref())
                .await
                .expect("state");
            println!("{}", serde_json::to_string(&state).unwrap());
        }
        "gap-test" => {
            // Read in the format we normally use, push the last page's icons one
            // cell to the right with a false, write it, then read back in the
            // row format to see whether the gap survived.
            let (_, mut state, _) = iconstate_lib::device::icon_state(None).await.expect("read");
            let pages = state.as_array_mut().expect("pages");
            let last = pages.last_mut().expect("a page");
            let icons = last.as_array_mut().expect("icons");
            icons.insert(0, serde_json::Value::Bool(false));
            eprintln!("sending last page as {}", serde_json::to_string(last).unwrap());

            iconstate_lib::device::write_icon_state(None, &state)
                .await
                .expect("write");

            let rows = iconstate_lib::device::icon_state_as(None, Some("1"))
                .await
                .expect("read back");
            println!("{}", serde_json::to_string(&rows).unwrap());
        }
        "rows-test" => {
            // Lay the flat layout out as rows, leave the last page's icon one
            // cell in, and write it back in the row format.
            let (_, state, metrics) = iconstate_lib::device::icon_state(None).await.expect("read");
            let columns = metrics["homeScreenIconColumns"].as_f64().unwrap_or(4.0) as usize;
            let rows_per_page = metrics["homeScreenIconRows"].as_f64().unwrap_or(6.0) as usize;

            let mut out = Vec::new();
            for (index, page) in state.as_array().expect("pages").iter().enumerate() {
                let mut icons: Vec<serde_json::Value> = page.as_array().expect("icons").clone();

                // The dock is one row and takes no gaps.
                if index == 0 {
                    out.push(serde_json::Value::Array(vec![serde_json::Value::Array(icons)]));
                    continue;
                }

                // Push the last page's icons one cell along, to see if a gap sticks.
                if index == state.as_array().unwrap().len() - 1 {
                    icons.insert(0, serde_json::Value::Bool(false));
                }

                let mut rows = Vec::new();
                for row in 0..rows_per_page {
                    let cells: Vec<serde_json::Value> = (0..columns)
                        .map(|column| {
                            icons
                                .get(row * columns + column)
                                .cloned()
                                .unwrap_or(serde_json::Value::Bool(false))
                        })
                        .collect();
                    rows.push(serde_json::Value::Array(cells));
                }
                out.push(serde_json::Value::Array(rows));
            }

            let shaped = serde_json::Value::Array(out);
            eprintln!("writing {} pages as rows", shaped.as_array().unwrap().len());

            let format = std::env::args().nth(2).unwrap_or_else(|| "1".into());
            match iconstate_lib::device::write_icon_state_as(None, &shaped, Some(&format)).await {
                Ok(_) => eprintln!("write accepted"),
                Err(error) => eprintln!("write refused: {error}"),
            }

            let back = iconstate_lib::device::icon_state_as(None, Some("1"))
                .await
                .expect("read back");
            println!("{}", serde_json::to_string(&back).unwrap());
        }
        _ => {
            let (about, state, metrics) =
                iconstate_lib::device::icon_state(None).await.expect("state");
            eprintln!("{}", serde_json::to_string(&about).unwrap());
            eprintln!("{}", serde_json::to_string(&metrics).unwrap());
            println!("{}", serde_json::to_string_pretty(&state).unwrap());
        }
    }
}
