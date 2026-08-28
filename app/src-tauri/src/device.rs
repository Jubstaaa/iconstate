//! Everything that talks to the phone, and nothing else.
//!
//! No layout rules live here — this module only knows lockdown, SpringBoard and
//! how to turn what they answer into JSON.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use base64::Engine as _;
use idevice::provider::UsbmuxdProvider;
use idevice::services::lockdown::LockdownClient;
use idevice::services::springboardservices::SpringBoardServicesClient;
use idevice::usbmuxd::{Connection, UsbmuxdAddr, UsbmuxdConnection};
use idevice::IdeviceService;
use serde::Serialize;

const FORMAT_VERSION: &str = "2";
const LABEL: &str = "iconstate";

pub type Result<T> = std::result::Result<T, String>;

#[derive(Debug, Serialize)]
pub struct DeviceRow {
    pub serial: String,
    pub connection: String,
    pub device_id: u32,
}

#[derive(Debug, Default, Serialize)]
pub struct DeviceInfo {
    pub name: Option<String>,
    pub ios: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
}

/// SpringBoard answers in plist types; everything above this module sees JSON.
fn to_json(value: &plist::Value) -> serde_json::Value {
    match value {
        plist::Value::String(text) => serde_json::Value::String(text.clone()),
        plist::Value::Boolean(flag) => serde_json::Value::Bool(*flag),
        plist::Value::Integer(number) => number
            .as_signed()
            .map(serde_json::Value::from)
            .or_else(|| number.as_unsigned().map(serde_json::Value::from))
            .unwrap_or(serde_json::Value::Null),
        plist::Value::Real(number) => serde_json::Number::from_f64(*number)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        plist::Value::Data(bytes) => {
            serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(bytes))
        }
        plist::Value::Date(date) => serde_json::Value::String(date.to_xml_format()),
        plist::Value::Uid(uid) => serde_json::Value::from(uid.get()),
        plist::Value::Array(items) => {
            serde_json::Value::Array(items.iter().map(to_json).collect())
        }
        plist::Value::Dictionary(map) => serde_json::Value::Object(
            map.iter()
                .map(|(key, item)| (key.clone(), to_json(item)))
                .collect(),
        ),
        _ => serde_json::Value::Null,
    }
}

fn to_plist(value: &serde_json::Value) -> plist::Value {
    match value {
        serde_json::Value::Bool(flag) => plist::Value::Boolean(*flag),
        serde_json::Value::String(text) => plist::Value::String(text.clone()),
        serde_json::Value::Number(number) => number
            .as_i64()
            .map(plist::Value::from)
            .or_else(|| number.as_f64().map(plist::Value::from))
            .unwrap_or_else(|| plist::Value::Integer(0.into())),
        serde_json::Value::Array(items) => {
            plist::Value::Array(items.iter().map(to_plist).collect())
        }
        serde_json::Value::Object(map) => plist::Value::Dictionary(
            map.iter()
                .map(|(key, item)| (key.clone(), to_plist(item)))
                .collect(),
        ),
        serde_json::Value::Null => plist::Value::String(String::new()),
    }
}

fn command(name: &str) -> plist::Dictionary {
    let mut request = plist::Dictionary::new();
    request.insert("command".into(), plist::Value::String(name.into()));
    request
}

async fn muxer() -> Result<UsbmuxdConnection> {
    UsbmuxdConnection::default()
        .await
        .map_err(|error| format!("usbmuxd is not answering: {error}"))
}

pub async fn devices() -> Result<Vec<DeviceRow>> {
    let found = muxer()
        .await?
        .get_devices()
        .await
        .map_err(|error| format!("could not list devices: {error}"))?;

    Ok(found
        .into_iter()
        .map(|device| DeviceRow {
            serial: device.udid,
            connection: match device.connection_type {
                Connection::Usb => "USB".into(),
                Connection::Network(address) => address.to_string(),
                Connection::Unknown(what) => what,
            },
            device_id: device.device_id,
        })
        .collect())
}

async fn provider(serial: Option<&str>) -> Result<UsbmuxdProvider> {
    let mut muxer = muxer().await?;
    let found = muxer
        .get_devices()
        .await
        .map_err(|error| format!("could not list devices: {error}"))?;

    let device = match serial {
        Some(serial) => found.into_iter().find(|device| device.udid == serial),
        None => found.into_iter().next(),
    }
    .ok_or_else(|| "no iPhone is plugged in".to_string())?;

    let addr = UsbmuxdAddr::from_env_var().unwrap_or_default();
    Ok(device.to_provider(addr, LABEL))
}

pub async fn info(provider: &UsbmuxdProvider) -> Result<DeviceInfo> {
    let mut lockdown = LockdownClient::connect(provider)
        .await
        .map_err(|error| format!("could not reach the device over USB: {error}"))?;

    let values = lockdown
        .get_value(None, None)
        .await
        .map_err(|error| format!("the device would not say what it is: {error}"))?;

    let read = |key: &str| {
        values
            .as_dictionary()
            .and_then(|map| map.get(key))
            .and_then(plist::Value::as_string)
            .map(str::to_owned)
    };

    Ok(DeviceInfo {
        name: read("DeviceName"),
        ios: read("ProductVersion"),
        model: read("ProductType"),
        serial: read("UniqueDeviceID"),
    })
}

async fn springboard(provider: &UsbmuxdProvider) -> Result<SpringBoardServicesClient> {
    SpringBoardServicesClient::connect(provider)
        .await
        .map_err(|error| format!("SpringBoard would not open: {error}"))
}

/// SpringBoard frames every message with a big-endian length. The crate wraps
/// this in private methods, so the framing is done here against its public raw
/// socket — which also keeps the commands we send in one place, rather than
/// spread between our code and the crate's.
async fn tell(
    client: &mut SpringBoardServicesClient,
    request: plist::Dictionary,
    what: &str,
) -> Result<()> {
    let mut body = Vec::new();
    plist::Value::Dictionary(request)
        .to_writer_xml(&mut body)
        .map_err(|error| format!("could not build the request for {what}: {error}"))?;

    let mut message = (body.len() as u32).to_be_bytes().to_vec();
    message.extend_from_slice(&body);

    client
        .idevice
        .send_raw(&message)
        .await
        .map_err(|error| format!("could not ask for {what}: {error}"))
}

async fn ask(
    client: &mut SpringBoardServicesClient,
    request: plist::Dictionary,
    what: &str,
) -> Result<plist::Value> {
    tell(client, request, what).await?;

    let head = client
        .idevice
        .read_raw(4)
        .await
        .map_err(|error| format!("could not read {what}: {error}"))?;
    let length = u32::from_be_bytes(
        head.as_slice()
            .try_into()
            .map_err(|_| format!("{what} came back truncated"))?,
    ) as usize;

    let body = client
        .idevice
        .read_raw(length)
        .await
        .map_err(|error| format!("could not read {what}: {error}"))?;

    plist::from_bytes(&body).map_err(|error| format!("{what} came back malformed: {error}"))
}

async fn read_state_as(
    client: &mut SpringBoardServicesClient,
    format: Option<&str>,
) -> Result<serde_json::Value> {
    let mut request = command("getIconState");
    if let Some(format) = format {
        request.insert("formatVersion".into(), plist::Value::String(format.into()));
    }
    let state = ask(client, request, "the home screen").await?;
    Ok(to_json(&state))
}

async fn read_state(client: &mut SpringBoardServicesClient) -> Result<serde_json::Value> {
    read_state_as(client, Some(FORMAT_VERSION)).await
}

/// Ask SpringBoard for a specific icon state format, to see what each one says.
pub async fn icon_state_as(serial: Option<&str>, format: Option<&str>) -> Result<serde_json::Value> {
    let provider = provider(serial).await?;
    read_state_as(&mut springboard(&provider).await?, format).await
}

async fn read_metrics(client: &mut SpringBoardServicesClient) -> Result<serde_json::Value> {
    let metrics = ask(
        client,
        command("getHomeScreenIconMetrics"),
        "the home screen grid",
    )
    .await?;
    Ok(to_json(&metrics))
}

/// The layout and the device's own grid, over one connection.
pub async fn icon_state(
    serial: Option<&str>,
) -> Result<(DeviceInfo, serde_json::Value, serde_json::Value)> {
    let provider = provider(serial).await?;
    let about = info(&provider).await?;
    let mut client = springboard(&provider).await?;

    let state = read_state(&mut client).await?;
    let metrics = read_metrics(&mut client).await?;
    Ok((about, state, metrics))
}

pub async fn metrics(serial: Option<&str>) -> Result<serde_json::Value> {
    let provider = provider(serial).await?;
    let mut client = springboard(&provider).await?;
    read_metrics(&mut client).await
}

/// Send a layout and read back what SpringBoard actually settled on.
///
/// setIconState answers nothing and the socket is spent once it lands, so the
/// read back has to happen over a connection of its own.
pub async fn write_icon_state(
    serial: Option<&str>,
    state: &serde_json::Value,
) -> Result<(DeviceInfo, serde_json::Value)> {
    let provider = provider(serial).await?;
    let about = info(&provider).await?;

    let mut request = command("setIconState");
    request.insert("iconState".into(), to_plist(state));
    tell(&mut springboard(&provider).await?, request, "the write").await?;

    let settled = read_state(&mut springboard(&provider).await?).await?;
    Ok((about, settled))
}

/// Pull each app's icon into the cache directory, skipping what is already there.
pub async fn icons(
    serial: Option<&str>,
    wanted: &[String],
    directory: &Path,
    mut on_icon: impl FnMut(&str, usize, usize),
) -> Result<BTreeMap<String, PathBuf>> {
    std::fs::create_dir_all(directory)
        .map_err(|error| format!("could not make the icon cache: {error}"))?;

    let mut manifest = BTreeMap::new();
    let mut missing = Vec::new();

    for key in wanted {
        let path = directory.join(format!("{key}.png"));
        if path.is_file() {
            manifest.insert(key.clone(), path);
        } else {
            missing.push(key.clone());
        }
    }

    if missing.is_empty() {
        return Ok(manifest);
    }

    let provider = provider(serial).await?;
    let mut client = springboard(&provider).await?;

    for (index, key) in missing.iter().enumerate() {
        let mut request = command("getIconPNGData");
        request.insert("bundleId".into(), plist::Value::String(key.clone()));

        if let Ok(answer) = ask(&mut client, request, "an app icon").await {
            let png = answer
                .as_dictionary()
                .and_then(|map| map.get("pngData"))
                .and_then(plist::Value::as_data);

            if let Some(png) = png {
                let path = directory.join(format!("{key}.png"));
                if std::fs::write(&path, png).is_ok() {
                    manifest.insert(key.clone(), path);
                }
            }
        }
        on_icon(key, index + 1, missing.len());
    }

    Ok(manifest)
}
