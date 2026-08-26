# IconState

The iPhone home screen editor Apple removed from iTunes, brought back — and it
sorts your apps into folders for you.

Plug the phone in over USB, read the whole layout, get a folder structure
proposed for it, preview it, apply it in one write, roll it back if you hate it.

> macOS arm64 only for now. USB only — SpringBoard's layout service is not
> reachable over the network.

## Where things live

| Path | What it is |
|---|---|
| `core/` | `iconstate` Python package: the layout engine and the CLI |
| `core/src/iconstate/core/` | pure JSON in, JSON out — no device, fully testable |
| `core/src/iconstate/device/` | lockdown + SpringBoard; thin on purpose, tested by hand |
| `app/` | React + Vite frontend |
| `app/src-tauri/` | Tauri v2 shell; runs the core as a one-shot sidecar |
| `reference/` | real-device fixtures and the working prototype this grew from |
| `scripts/` | sidecar build, bundle verification, version stamping |

The split is the whole architecture: CI has no phone, so everything that can be
tested without one lives in `iconstate.core`.

## The CLI

```bash
cd core
uv venv --python 3.12
uv pip install -e . --group dev

.venv/bin/iconstate devices          # what is plugged in
.venv/bin/iconstate show             # the home screen as a tree
.venv/bin/iconstate dump -o now.json # the raw icon state
.venv/bin/iconstate apps -o apps.json
.venv/bin/iconstate validate -p plan.json -i now.json
```

Every command also accepts `-i file.json` instead of a device, so the whole
engine can be driven offline.

Progress is written to stderr as one JSON object per line; the payload goes to
stdout. That is what lets the Tauri shell turn a CLI run into UI events without
a server, a port, or a lifecycle to manage.

## The desktop app

```bash
./scripts/build-sidecar.sh      # freezes the CLI next to the Tauri shell
cd app && npm install && npm run tauri dev
```

`scripts/build-sidecar.sh` names the binary after the Rust host triple
(`iconstate-core-aarch64-apple-darwin`), which is what Tauri looks for. A
mismatch makes the app fail to launch with no error, so the release pipeline
runs the packaged sidecar as its last step.

## Tests

```bash
cd core && .venv/bin/python -m pytest -q
```

The load-bearing one is the round-trip: every fixture in `reference/fixtures/`
is parsed into the model, serialized back, and compared to the original byte
structure. If that ever fails, nothing may be written to a phone.

## What the device will and will not do

Measured on a real iPhone, not guessed:

**Works** — reading the whole layout, writing it back atomically, creating and
naming folders, moving apps between them, editing the dock, adding an app that
is installed but not on any page.

**Does not work** — widgets (the icon state does not carry them), removing an
app from the home screen (iOS puts it back on a new page), tinted/clear/large
icon modes, anything over the network, Screen Time usage data.

## Licence

MIT
