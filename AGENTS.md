# AGENTS.md

Guidance for AI agents (and future human contributors) working in this
repo. This file is about *how to work here*; domain/protocol knowledge
about the device itself lives in [`README.md`](README.md) and
[`reference/README.md`](reference/README.md) — read those first for
"what does this app do and why", read this file for "how do I make a
change safely".

## What this project is

A Homey Apps SDK (v3, Node.js, ESM) app for the Sonoff Hydro One Zigbee
water valve, ported from Sonoff's Python ZHA quirk
(`reference/sonoff_hydro_one_zha_quirk.py`). One driver
(`drivers/hydro-one`), one custom Zigbee cluster
(`lib/SonoffHydroCluster.mjs`), one payload codec
(`lib/sonoffIrrigation.mjs`). Not published to the App Store yet.

## Homey SDK documentation

Full docs: https://apps.developer.homey.app/ (llms.txt index:
https://apps.developer.homey.app/llms.txt). Pages most relevant to this
repo:

- [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose.md) — how `.homeycompose/*` + `*.compose.json` become `app.json`.
- [Manifest](https://apps.developer.homey.app/the-basics/app/manifest.md), [Capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities.md), [Flow](https://apps.developer.homey.app/the-basics/flow.md) / [Arguments](https://apps.developer.homey.app/the-basics/flow/arguments.md) — driver/capability/Flow-card schema.
- [Using ESM in Homey Apps](https://apps.developer.homey.app/guides/using-esm-in-homey-apps.md) — this app's module format.
- [Zigbee](https://apps.developer.homey.app/wireless/zigbee.md) and the [Zigbee Developer Tools guide](https://apps.developer.homey.app/guides/tools/zigbee.md) — for `homey-zigbeedriver`/`zigbee-clusters` work.
- [Homey CLI reference](https://apps.developer.homey.app/the-basics/getting-started/homey-cli.md).

When in doubt about SDK behavior, check these before guessing — this
codebase has already hit a few undocumented/surprising edges (see
"Known gotchas" below); don't rediscover them by trial and error on
real hardware if the answer is already written down in README.md.

## Repo map

```
.homeycompose/app.json                      app-level manifest source (edit this, not app.json)
.homeycompose/capabilities/*.json           custom capability definitions
drivers/hydro-one/driver.compose.json       driver manifest: capabilities, class, Zigbee pairing config
drivers/hydro-one/driver.flow.compose.json  Flow action/trigger card definitions
app.json                                    GENERATED — never edit by hand
lib/SonoffHydroCluster.mjs                  0xFC11 cluster: attribute defs + custom ZCL "Array" data type
lib/sonoffIrrigation.mjs                    single-irrigation 12-byte payload encode/decode
drivers/hydro-one/device.mjs                capability <-> cluster wiring, Flow action implementations
drivers/hydro-one/driver.mjs                Flow action run listener registration
reference/                                  source-of-truth Python quirk + asset originals; not part of the app
```

## Hard rules

- **Never edit `app.json` directly.** It's regenerated from
  `.homeycompose/app.json` + `drivers/*/driver*.compose.json` by
  `homey app run`/`validate`/`build`. Edit the compose sources instead
  and let the CLI regenerate it.
- **All source is ESM** (`.mjs`, `import`/`export`). Don't introduce
  CommonJS (`require`/`module.exports`).
- **Format with Prettier before considering a change done**: `npm run
  format` (or `format:check` to verify without writing). CI
  (`homey-app-validate.yml`) runs `format:check` then `npm run
  validate` and fails the build on either.
- Manual irrigation (start/stop a watering run) is exposed via **Flow
  actions only**, not capabilities — this was a deliberate design
  decision (see README.md "Architecture"). Don't reintroduce
  `irrigation_*` capabilities without re-reading that history.
- **On every change, re-check `README.md` against the code and update
  it in the same commit** — capability/attribute tables, Flow card
  descriptions, "Known simplifications", and "Deliberately not
  ported" sections must stay accurate. Don't merge a behavioral change
  with stale documentation.

## Workflow / commands

```
npm install
npm run dev             # homey app run — requires a Homey Pro on the same network (Zigbee radio)
npm run validate        # homey app validate --level verified — also run in CI
npm run format / format:check
```

There is no unit test suite (`npm test` is a stub). Validation is:
Prettier + `homey app validate`, plus manual testing against real
hardware (a Homey Pro; Homey Cloud/Bridge can't pair Zigbee devices).
If you change Zigbee cluster/attribute logic, say so explicitly and
flag that it needs hardware verification — don't claim something
"works" from reading the protocol alone.

CI/CD (`.github/workflows/`):
- `homey-app-validate.yml` — runs on every push/PR: `format:check` + `validate`.
- `homey-app-version.yml` — manual dispatch, bumps version in `.homeycompose/app.json`, commits ("Update Homey App Version to vX.Y.Z"), tags, and creates a GitHub release.
- `homey-app-publish.yml` — manual dispatch, publishes to the Homey App Store.

## Known gotchas already paid for (don't relearn the hard way)

- `homey-zigbeedriver`/`zigbee-clusters` don't implement the generic ZCL
  "Array" data type (0x48) that several `sonoffHydro` attributes use —
  it's hand-rolled in `lib/SonoffHydroCluster.mjs` (`sonoffByteArray`).
- The device is a battery-powered sleepy end device; ZCL "configure
  reporting" is rejected for `waterValveState` — only unsolicited
  reports work, so capabilities for it use `report:` without a
  configured reporting interval.
- Homey does **not** retroactively add capabilities to already-paired
  devices when an app update adds new ones — `device.mjs` reconciles
  this on every `onNodeInit` via `ALL_CAPABILITIES`.
- Flow card `"$filter": "capabilities=..."` does **not** react to
  per-device `addCapability`/`removeCapability` calls — it only reads
  each driver's static manifest capability list. This is why the
  no-flow-meter product IDs are rejected at runtime
  (`startVolumeIrrigation`) instead of having the "water a volume" Flow
  card hidden for them; splitting into two drivers would be the real
  fix (see README.md "Known simplifications").
- Removing a `.homeycompose/capabilities/*.json` definition that a
  paired device still references breaks `removeCapability()` migration
  on that device (`Invalid Capability`) — keep the definition around
  until no paired device could still have it.

## Documentation style expected in this repo

README.md and code comments here favor **recording rationale, not just
behavior** — why a decision was made, what was deliberately left out,
what's still unverified on real hardware, and pointers back to the
source quirk. Keep that standard when adding features:
- Update the README.md "Status" table when a capability's
  wiring changes.
- Update "Known simplifications" / "Deliberately not ported" sections
  instead of silently dropping that context.
- Prefer a code comment explaining *why* (e.g. a firmware quirk, an SDK
  limitation) over one restating *what* the code does.
