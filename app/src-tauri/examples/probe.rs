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
        _ => {
            let (about, state, metrics) =
                iconstate_lib::device::icon_state(None).await.expect("state");
            eprintln!("{}", serde_json::to_string(&about).unwrap());
            eprintln!("{}", serde_json::to_string(&metrics).unwrap());
            println!("{}", serde_json::to_string_pretty(&state).unwrap());
        }
    }
}
