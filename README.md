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
.venv/bin/iconstate icons              # cache every icon as a PNG

.venv/bin/iconstate plan                 # the folder layout the rules propose
.venv/bin/iconstate diff                 # what applying it would change
.venv/bin/iconstate apply                # backs up, shows the diff, asks first
.venv/bin/iconstate backups              # every layout ever written over
.venv/bin/iconstate restore              # put the most recent one back
```

Every read-only command also accepts `-i file.json` instead of a device, so the
whole engine can be driven offline.

Nothing reaches the phone without passing `validate` against the device's own
inventory, writing a backup, and printing the diff for confirmation. After the
write the layout is read back and any drift from the plan is reported.

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

## How apps get sorted

`core/src/iconstate/core/rules.py` maps bundle identifiers to folder names. It
is generated, not hand-edited:

```bash
python3 scripts/derive-rules.py path/to/a/good-layout.json
```

Keying on bundle identifiers rather than display names matters more than it
looks: two apps on this phone are both called "the same name", and WhatsApp ships
with an invisible character in its name.

Apps the table does not know go into an `Unsorted` folder and are reported on
stderr as an `unassigned` event. Pass decisions back as `--assign
decisions.json`, a plain `{"com.example.app": "Games"}` map, and the plan is
rebuilt with them layered on the offline table.

That is the seam the LLM categoriser plugs into. It lives in the frontend
(`app/src/lib/categorise.ts`), calls Claude with a tool schema so the answer
comes back as data rather than prose, and drops the result straight into
`--assign`. The API key is the user's, stored in the webview and never seen by
the core — which is the point of keeping the call on that side: the Python
package stays offline and dependency-free.

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
