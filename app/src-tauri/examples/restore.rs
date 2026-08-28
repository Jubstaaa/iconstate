//! Write a saved icon state back to the phone.

#[tokio::main]
async fn main() {
    let path = std::env::args().nth(1).expect("give a state file");
    let state: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).expect("read")).expect("parse");

    let (about, settled) = iconstate_lib::device::write_icon_state(None, &state)
        .await
        .expect("write");

    eprintln!("{}", serde_json::to_string(&about).unwrap());
    println!("{}", serde_json::to_string_pretty(&settled).unwrap());
}
