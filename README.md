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
.venv/bin/iconstate wallpaper          # save the home screen wallpaper
.venv/bin/iconstate metrics            # the device's own grid dimensions

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

The app is the point: a real iPhone home screen you can rearrange with a mouse.
The icons are the device's own PNGs and the grid is the size SpringBoard says it
is — four columns by six rows on this phone, not a number someone typed in.

The wallpaper is not read from the device at all. `getHomeScreenWallpaperPNGData`
returns a stale copy on iOS 26 — the same bytes every time, verified by hashing
repeated fetches, and not what is actually on the phone. Wallpapers moved to the
poster system in iOS 16 and this SpringBoard command never followed;
`getWallpaperInfo` is worse, it closes the connection for every name. Since the
answer is wrong anyway, the editor ships one of its own in
`app/src/assets/wallpaper.svg`. Apple's own wallpapers are not an option: they
are copyrighted and cannot be redistributed here.

The window *is* the phone. It has no decorations and no background: the title
bar and the device are two floating pieces with the desktop showing between
them, the way the Simulator does it. The title bar carries the device name, the
iOS version, and three buttons — sort into folders, read the phone again, review
changes. Everything else lives in the right-click menu.

Transparency on macOS needs Tauri's `macOSPrivateApi`, which rules out the Mac
App Store; this ships through GitHub Releases, so that is not a constraint.

Drawing the frame by hand was a choice, not a gap. `devices.css` has a good
iPhone 14 Pro, but it resets `.device *` to `display: block`, which flattens
every grid and flex box on the screen, and its frame is a fixed 428x868 that
cannot take the grid dimensions the device reports. MagicUI's iPhone is an SVG
that accepts an image or a video, not a live surface to drag icons around in.
Apple's Design Resources are Sketch and Figma files, and shipping Apple's device
art in an open source repo is a licensing problem.

Press and hold to drag; a quick click opens a folder. Drop an icon on the middle
of another to make a folder, on its edge to slot in beside it, on a folder to
file it there. Click to select, ⌘-click or shift-click for several, ⌘G to fold
the selection into one folder. Arrow keys or a two-finger swipe move between
pages, ⌘Z undoes.

Pages sit side by side behind one native horizontal scroller with CSS scroll
snapping, so the swipe, the momentum and the settle are the browser's own. An
earlier version animated the transition by hand and it never felt right; the fix
was to delete it rather than tune it.

Nothing is written until Review changes, which shows the same diff the CLI
prints.

```bash
./scripts/build-sidecar.sh      # freezes the CLI next to the Tauri shell
cd app && bun install && bun run tauri dev
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

`--lookup` fills those in from the App Store's own category, through the public
iTunes lookup endpoint. No account, no API key, no model — every user gets the
same answer, and answers are cached in `~/.iconstate/genres.json` so a bundle
identifier is only ever asked about once.

`core/src/iconstate/core/genres.py` maps a store genre to a folder. The table is
ordered from specific to generic and that order *is* the algorithm: an app lists
several genres and the one the store calls primary is regularly the vaguer of
them — Instagram leads with Photo & Video, a dating app with Lifestyle. Reading the
table in order rather than trusting the app's own ordering puts both under
Social, which is where a person would look for them.

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
