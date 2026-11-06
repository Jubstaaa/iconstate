//! The same binary without the window: every command prints JSON, so a script or
//! an agent can drive the phone through the device layer the app uses.

use std::path::PathBuf;

use serde_json::{json, Value};

use crate::{backup, device, plan, write};

const USAGE: &str = "\
usage: iconstate <command> [--device UDID]

  devices                  list connected iPhones
  snapshot [--output FILE] save the current layout (stdout without --output)
  check PLAN               validate a layout file against the phone
  apply PLAN               back up, write, read back; rolls back if an app goes missing
  restore [BACKUP]         write a backup back (the last one before a write by default)
  backups                  list saved backups, newest first

Run without a command to open the app. Exit status: 0 done, 1 failed, 2 refused.";

const FAILED: i32 = 1;
const REFUSED: i32 = 2;

type Outcome = Result<(Value, i32), String>;

/// Finder used to launch apps with a `-psn_` argument; anything else is a command.
pub fn wanted(args: &[String]) -> bool {
    args.first()
        .is_some_and(|first| !first.starts_with("-psn_"))
}

struct Args {
    words: Vec<String>,
    device: Option<String>,
    output: Option<PathBuf>,
}

fn parse(args: &[String]) -> Result<Args, String> {
    let mut parsed = Args {
        words: Vec::new(),
        device: None,
        output: None,
    };

    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        let mut value = |flag: &str| {
            rest.next()
                .cloned()
                .ok_or_else(|| format!("{flag} needs a value"))
        };
        match arg.as_str() {
            "--device" => parsed.device = Some(value("--device")?),
            "--output" | "-o" => parsed.output = Some(PathBuf::from(value("--output")?)),
            flag if flag.starts_with('-') && !matches!(flag, "-h" | "--help") => {
                return Err(format!("unknown option {flag}"))
            }
            word => parsed.words.push(word.to_owned()),
        }
    }
    Ok(parsed)
}

fn read_json(path: &str) -> Result<Value, String> {
    let body =
        std::fs::read_to_string(path).map_err(|error| format!("could not read {path}: {error}"))?;
    serde_json::from_str(&body).map_err(|error| format!("{path} is not JSON: {error}"))
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

pub fn run(args: &[String]) -> i32 {
    let parsed = match parse(args) {
        Ok(parsed) => parsed,
        Err(error) => {
            eprintln!("{error}\n\n{USAGE}");
            return REFUSED;
        }
    };

    let words: Vec<&str> = parsed.words.iter().map(String::as_str).collect();
    if matches!(words.as_slice(), [] | ["help"])
        || args.iter().any(|arg| arg == "-h" || arg == "--help")
    {
        println!("{USAGE}");
        return 0;
    }

    let runtime = match tokio::runtime::Runtime::new() {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!(
                "{}",
                json!({ "error": format!("could not start: {error}") })
            );
            return FAILED;
        }
    };

    match runtime.block_on(dispatch(&words, &parsed)) {
        Ok((answer, code)) => {
            println!("{}", pretty(&answer));
            code
        }
        Err(error) => {
            eprintln!("{}", pretty(&json!({ "error": error })));
            FAILED
        }
    }
}

async fn dispatch(words: &[&str], args: &Args) -> Outcome {
    let serial = args.device.as_deref();
    match words {
        ["devices"] => Ok((json!(device::devices().await?), 0)),
        ["snapshot"] => snapshot(serial, args.output.as_ref()).await,
        ["check", file] => check(serial, file).await,
        ["apply", file] => apply(serial, file).await,
        ["restore"] => restore(serial, None).await,
        ["restore", file] => restore(serial, Some(PathBuf::from(file))).await,
        ["backups"] => Ok((json!(backup::history()), 0)),
        _ => Err(format!(
            "unknown command: {} (see iconstate help)",
            words.join(" ")
        )),
    }
}

async fn snapshot(serial: Option<&str>, output: Option<&PathBuf>) -> Outcome {
    let (about, state, _) = device::icon_state(serial).await?;
    let Some(output) = output else {
        return Ok((state, 0));
    };

    std::fs::write(output, pretty(&state))
        .map_err(|error| format!("could not write {}: {error}", output.display()))?;
    Ok((
        json!({ "device": about, "apps": plan::keys(&state).len(), "file": output }),
        0,
    ))
}

async fn check(serial: Option<&str>, file: &str) -> Outcome {
    let layout = read_json(file)?;
    let (_, current, metrics) = device::icon_state(serial).await?;
    let report = plan::check(&layout, &current, &plan::Limits::from_metrics(&metrics));
    let code = if report.ok { 0 } else { REFUSED };
    Ok((json!(report), code))
}

async fn apply(serial: Option<&str>, file: &str) -> Outcome {
    let layout = read_json(file)?;
    let (about, current, metrics) = device::icon_state(serial).await?;

    let report = plan::check(&layout, &current, &plan::Limits::from_metrics(&metrics));
    if !report.ok {
        return Ok((json!({ "applied": false, "report": report }), REFUSED));
    }

    let applied = write::apply(serial, &current, &layout, quiet).await?;
    Ok((
        json!({ "applied": true, "device": about, "backup": applied.backup }),
        0,
    ))
}

async fn restore(serial: Option<&str>, file: Option<PathBuf>) -> Outcome {
    let restored = write::restore(serial, file, quiet).await?;
    Ok((
        json!({
            "restored": restored.from,
            "apps": plan::keys(&restored.settled).len(),
            "replaced_layout_saved_to": restored.replaced,
        }),
        0,
    ))
}

/// Progress is for the window; the command line prints only the outcome.
fn quiet(_: Value) {}

#[cfg(test)]
mod tests {
    use super::{parse, wanted};

    fn args(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| word.to_string()).collect()
    }

    #[test]
    fn a_bare_launch_opens_the_window() {
        assert!(!wanted(&[]));
        assert!(!wanted(&args(&["-psn_0_12345"])));
        assert!(wanted(&args(&["snapshot"])));
    }

    #[test]
    fn options_go_anywhere() {
        let parsed = parse(&args(&["--device", "ABC", "snapshot", "-o", "now.json"])).unwrap();
        assert_eq!(parsed.words, ["snapshot"]);
        assert_eq!(parsed.device.as_deref(), Some("ABC"));
        assert_eq!(parsed.output.unwrap().to_str(), Some("now.json"));
    }

    #[test]
    fn a_flag_without_its_value_is_refused() {
        assert!(parse(&args(&["snapshot", "--output"])).is_err());
        assert!(parse(&args(&["snapshot", "--force"])).is_err());
    }
}
