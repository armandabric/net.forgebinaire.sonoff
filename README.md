# Sonoff Hydro (Homey)

Homey app for the Sonoff Hydro One Zigbee smart water valve
(SWV-ZFU / SWV-ZFE / SWV-ZNU / SWV-ZNE), ported from Sonoff's official
ZHA quirk (Python/zigpy) to the Homey Apps SDK (Node.js).

## Status: minimal driver

This first version only covers pairing and the basics:

- `onoff` — open/close the valve (standard Zigbee OnOff cluster).
- `alarm_water` — water leak alarm.
- `alarm_water_shortage` — water shortage alarm (custom capability).
- `child_lock` — child lock toggle (custom capability).

Not yet ported: manual irrigation (duration/volume), the 6 scheduled
irrigation plans, seasonal (monthly) watering adjustment, and the manual
rain delay. These live behind the Sonoff manufacturer-specific cluster
`0xFC11` and use a binary payload format documented in the source ZHA
quirk — the logic is well understood, just not wired up to Homey
capabilities/flow cards yet.

## Unverified assumptions

These come from the ZHA quirk, which never states the endpoint number
(ZHA discovers it automatically). They need to be confirmed against a
real device:

- The Sonoff cluster (`0xFC11` / `64529`) and the standard OnOff cluster
  (`0x0006`) are both assumed to live on **endpoint 1**.
- `alarm_water` / `alarm_water_shortage` read bits 1 and (0 | 4) of the
  `waterValveState` attribute (`0x500C`), per the quirk's `ValveState`
  enum.

## Testing

Requires a **Homey Pro** (Zigbee radio — Homey Cloud/Bridge cannot pair
Zigbee devices) and the [Homey CLI](https://apps.developer.homey.app/):

```
npm install -g homey
homey login
homey app run
```

Then pair the device from the Homey app. If pairing fails or an
attribute/cluster doesn't match, capture the Zigbee interview log
(Homey app → device → Zigbee settings → "Interview") and the
`homey app run` console output.
