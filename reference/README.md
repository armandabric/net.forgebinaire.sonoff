# Reference material

## Home Assistant plugin

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


## zigbee2mqtt docs

https://www.zigbee2mqtt.io/devices/SWV-ZFE.html

## Original brand/product assets

`original-assets/` — the source files provided for the App Store asset
work tracked in issue #2, kept around uncropped/unedited in case the
derived `assets/` and `drivers/hydro-one/assets/` files ever need to be
regenerated or redone differently:

- `sonoff-logo.svg` — the full Sonoff wordmark logo. `assets/icon.svg`
  is cropped from just the "S" + antenna-wave glyph in this file (the
  "ONOFF" letters are deliberately excluded per the App Store icon
  guidelines).
- `sonoff-hydro-icon.svg` — line-drawing vector of the Hydro One valve,
  used as-is for `drivers/hydro-one/assets/icon.svg`.
- `SWV-ZFE-product-photo.webp` — white-background product photo (the
  source for `drivers/hydro-one/assets/images/*.png`, with the Zigbee
  compatibility badge removed and resized/cropped to each required
  size).
- `SWV-ZFE-lifestyle-photo.webp` — outdoor lifestyle photo (the source
  for `assets/images/*.png`, cropped to the required 10:7 ratio).

Not part of the Homey app itself (not referenced by `app.json` or any
driver) — kept purely as source material for future asset work.
