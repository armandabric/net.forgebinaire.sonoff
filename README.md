# Sonoff Hydro (Homey)

Homey app for the Sonoff Hydro One Zigbee smart water valve
([SWV-ZFU / SWV-ZFE / SWV-ZNU / SWV-ZNE](https://sonoff.tech/fr-fr/products/sonoff-hydro-series-hydro-one-zigbee-smart-water-valve-swv-zfu-swv-zfe)),
ported from Sonoff's official ZHA quirk (Python/zigpy, for Home Assistant)
to the Homey Apps SDK (Node.js). The device isn't natively supported by
Homey, and Sonoff only publishes a ZHA quirk — this app re-implements the
same Zigbee protocol on top of `homey-zigbeedriver` / `zigbee-clusters`.
The original quirk is kept in [`reference/`](reference/) as the source of
truth for anything not yet ported.

## Status

Confirmed working on real hardware (Homey Pro, device model `SWV-ZFE`):

| Capability | Cluster / attribute | Notes |
|---|---|---|
| `onoff` | standard `OnOff` (`0x0006`) | Opens/closes the valve |
| `alarm_water` | `sonoffHydro.waterValveState` (`0x500C`, bit 1) | Leak alarm |
| `alarm_water_shortage` | `sonoffHydro.waterValveState` (`0x500C`, bits 0 \| 4) | No-water alarm |
| `child_lock` | `sonoffHydro.childLock` (`0x0000`) | |
| `measure_battery` | standard `PowerConfiguration` (`0x0001`) | Device reports its own reporting config |
| `irrigation_mode` | `sonoffHydro.singleIrrigationSet` (`0x501D`) | Duration / Volume, see below |
| `irrigation_amount_unit` | `sonoffHydro.unitOfWaterFlow` (`0x5021`) | Liter / US gallon / Imperial gallon |
| `irrigation_duration` | `sonoffHydro.singleIrrigationSet` | Minutes, used in Duration mode |
| `irrigation_amount` | `sonoffHydro.singleIrrigationSet` | Used in Volume mode |
| `irrigation_fail_safe_duration` | `sonoffHydro.singleIrrigationSet` | Safety cutoff, used in Volume mode |
| `measure_water_usage_duration` | `sonoffHydro.waterUsageDuration` (`0x501C`) | Duration of the last watering run, minutes. Not cumulative. |
| `meter_water` | `sonoffHydro.waterUsageVolume` (`0x501B`) | Lifetime cumulative volume, m³. **Unit assumed** — see below. |

The four `irrigation_*` config capabilities configure what happens the
*next* time the valve is opened via `onoff` — there is no separate
"start irrigation" command in this cluster; opening the valve runs
whatever mode/duration/amount was last written.

`meter_water` is a lifetime running total (per the source quirk's
`TOTAL_INCREASING` state class), not a per-run value — to check how much a
single manual irrigation actually used, compare the value before and
after, or watch `measure_water_usage_duration` for the run's duration.
The device reports the raw volume in an unspecified unit; this app
**assumes liters** (consistent with the rest of the protocol) and converts
to m³ for `meter_water`. A short manual test showed a plausible reading
(~2 L for a brief run), which supports the assumption, but it hasn't been
checked against a precisely measured volume yet.

Not yet ported (present in the source ZHA quirk, not in this app):

- The 6 scheduled irrigation plans (day/time, repeat mode, weekday mask).
- Seasonal (monthly) watering adjustment.
- Manual rain delay.

These all live behind the same `sonoffHydro` cluster (`0xFC11`) and are
protocol-wise understood (see the source quirk), just not wired up yet.
The scheduled plans in particular use a 28-byte payload and would likely
need a custom settings page rather than plain capabilities, since Homey
has no native equivalent of Home Assistant's per-field entities.

## Architecture

```
app.json                        — manifest: capabilities, driver, Zigbee pairing config
lib/SonoffHydroCluster.js       — the 0xFC11 cluster: attribute/command defs
lib/sonoffIrrigation.js         — single-irrigation 12-byte payload codec
drivers/hydro-one/device.js     — capability <-> cluster wiring
drivers/hydro-one/driver.js
```

### The custom "Array" ZCL data type

Several `sonoffHydro` attributes (`singleIrrigationSet`, and eventually the
irrigation plan / quarterly adjustment ones) are wrapped in the generic ZCL
"Array" data type (id `0x48`): 1 byte element type + 2 byte little-endian
element count + N element bytes. `zigbee-clusters`' underlying
`@athombv/data-types` package does **not** implement this type — it's
commented out in its source. This is why even Sonoff's own Python quirk
needed a manual low-level write helper
(`write_sonoff_array_attribute`) instead of a normal attribute write.

`lib/SonoffHydroCluster.js` defines this type by hand (`sonoffByteArray`),
matching the exact wire format zigpy's `foundation.Array` /
`t.LVList[uint8, uint16]` combination produces. It was verified byte-for-byte
in isolation (encode → wire bytes → decode round-trip) before ever touching
real hardware — see the git history for the verification script if this
needs revisiting.

## Confirmed facts (from a real Zigbee interview, `SWV-ZFE`)

- Endpoint **1** carries `basic`, `powerConfiguration`, `identify`, `onOff`,
  `pollControl`, cluster `64599` (`0xFC57`, undocumented — not used by this
  app), and `sonoffHydro` (`64529` / `0xFC11`).
- The device is a **battery-powered sleepy end device**
  (`receiveWhenIdle: false`, poll-control check-in ≈ 1 hour). On-demand
  attribute reads work when the device happens to be awake, but active ZCL
  "configure reporting" is **rejected** by the firmware
  (`UNSUPPORTED_ATTRIBUTE`) for `waterValveState` — the device sends
  unsolicited reports on its own instead, so this app only listens for
  those rather than requesting a reporting config.
- Battery type/count is unknown; `app.json` declares `energy.batteries:
  ["OTHER"]` as a placeholder.

## Known simplifications vs. the source quirk

- Reading `irrigation_duration` / `irrigation_amount` /
  `irrigation_fail_safe_duration` always reflects the raw device value.
  The Python quirk has an asymmetric rule that preserves the last non-zero
  `amount`/`fail_safe_duration_min` across mode switches (since the
  firmware always zeroes the fields not relevant to the current mode) but
  does *not* apply the same preservation to `total_duration_min`. This app
  doesn't replicate that: switching mode may show `0` for the
  now-irrelevant field until it's set again. Protocol-wise this is
  harmless — the firmware always receives valid, mode-consistent data.
- One driver (`hydro-one`) covers all four product IDs (`SWV-ZFU`/`ZFE`
  with a flow meter, `SWV-ZNU`/`ZNE` without). The Python quirk uses two
  separate device profiles for these — the no-flow-meter variants don't
  support Volume mode at the firmware level. This app doesn't yet detect
  or restrict that; it's only been tested against a flow-meter variant
  (`SWV-ZFE`).

## Testing

Requires a **Homey Pro** (Zigbee radio — Homey Cloud/Bridge cannot pair
Zigbee devices) and the [Homey CLI](https://apps.developer.homey.app/):

```
npm install
npm run homey app run
```

Then pair the device from the Homey app. If pairing fails or an
attribute/cluster doesn't match, capture the Zigbee interview log
(Homey app → device → Zigbee settings → "Interview") and the
`homey app run` console output.
