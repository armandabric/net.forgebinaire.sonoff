# Reference material

`sonoff_hydro_one_zha_quirk.py` — Sonoff's official [ZHA](https://www.home-assistant.io/integrations/zha/)
quirk (Python, [zigpy](https://github.com/zigpy/zigpy)) for the Hydro One
water valve (SWV-ZFU/ZFE/ZNU/ZNE), used for Home Assistant. It's the only
protocol documentation Sonoff publishes for this device, so it's kept here
verbatim as the source of truth this Homey app is ported from — see the
main [README](../README.md) for what's been ported so far and what
hasn't.

Not part of the Homey app itself (not referenced by `app.json` or any
driver) — kept purely for reference when porting the remaining features
(scheduled irrigation plans, seasonal adjustment, rain delay, water usage
sensors).
