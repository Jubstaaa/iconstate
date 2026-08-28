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
| `app/src/lib/` | the layout engine: pure JSON in, JSON out, no device, fully tested |
| `app/src/features/` | the editor — the phone frames, drag and drop, the diff sheet |
| `app/src-tauri/src/device.rs` | lockdown + SpringBoard; thin on purpose, tested by hand |
| `app/src-tauri/src/` | backups and the App Store lookup, next to the Tauri shell |
| `reference/` | real-device fixtures and the working prototype this grew from |
| `scripts/` | bundle verification and version stamping |

The split is the whole architecture: CI has no phone, so everything that can be
tested without one lives in `app/src/lib/` and never imports a Tauri command.

It used to be a frozen Python CLI running as a sidecar. That worked, but it put
46MB and a second process between the window and the phone for code that is a
few hundred lines. The device layer is Rust now, over the [`idevice`][idevice]
crate, and the layout engine is TypeScript in the app itself.

[idevice]: https://github.com/jkcoxson/idevice


## Getting it

Download the `.dmg` from [releases][releases], drag IconState across, then plug
an iPhone in over USB and tap Trust on the phone.

The build is not signed with an Apple developer certificate, so the first launch
needs one extra step: right-click the app and choose Open, then Open again in the
dialog. Double-clicking it will only offer to move it to the bin. macOS remembers
the choice, so this is once per install.

[releases]: https://github.com/Jubstaaa/iconstate/releases

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
cd app && bun install && bun run tauri dev
```

One binary, nothing to stage beside it.

## How apps get sorted

`app/src/lib/rules.ts` maps bundle identifiers to folder names. It is generated,
not hand-edited:

```bash
python3 scripts/derive-rules.py path/to/a/good-layout.json
```

Keying on bundle identifiers rather than display names matters more than it
looks: a phone can carry two apps with the same display name, and WhatsApp ships
with an invisible character in its.

Apps the table does not know go into an `Unsorted` folder. Assignments are a
plain `{"com.example.app": "Games"}` map layered on top of the offline table,
and the plan is rebuilt with them.

"Sort, looking up unknown apps" fills those in from the App Store's own category, through the public
iTunes lookup endpoint. No account, no API key, no model — every user gets the
same answer, and answers are cached in `~/.iconstate/genres.json` so a bundle
identifier is only ever asked about once.

`app/src/lib/genres.ts` maps a store genre to a folder. The table is
ordered from specific to generic and that order *is* the algorithm: an app lists
several genres and the one the store calls primary is regularly the vaguer of
them — Instagram leads with Photo & Video rather than Social Networking. Reading
table in order rather than trusting the app's own ordering puts both under
Social, which is where a person would look for them.

## Tests

```bash
cd app && bun run lint    # types, formatting and the tests
```

The load-bearing ones run the real fixtures in `reference/fixtures/` through the
planner and assert that planning is idempotent, that every app is placed exactly
once, and that a state does not differ from itself. If those ever fail, nothing
may be written to a phone.

## What the device will and will not do

Measured on a real iPhone, not guessed:

**Works** — reading the whole layout, writing it back atomically, creating and
naming folders, moving apps between them, editing the dock, adding an app that
is installed but not on any page.

**Does not work** — widgets (the icon state does not carry them), removing an
app from the home screen (iOS puts it back on a new page), free icon placement,
tinted/clear/large icon modes, anything over the network, Screen Time usage data.

Free placement is worth spelling out, because the format looks like it should
support it. Since iOS 18 an icon can sit anywhere on a page with gaps around it,
but `getIconState` never reports one: `formatVersion` 2 returns a flat list, and
1 and 3 return a fixed grid whose trailing cells are `false` — filler, not gaps,
and they stay `false` no matter where the icon actually sits. Writing a gap was
tried four ways (a `false` in the flat list, and a row matrix under formatVersion
1, 3 and 4); SpringBoard accepts every one of them and left-aligns the icons
anyway. Formats 1 and 3 also report every folder as an empty cell, so they carry
strictly less than format 2. The placement lives somewhere this service cannot
see.

## Licence

MIT
