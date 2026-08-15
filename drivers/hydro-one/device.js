'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

const SonoffHydroCluster = require('../../lib/SonoffHydroCluster');
const {
  SingleIrrigationMode,
  encodeSingleIrrigationPayload,
  decodeSingleIrrigationPayload,
} = require('../../lib/sonoffIrrigation');

// Bit layout of the sonoffHydro `waterValveState` attribute (0x500C), as
// documented in Sonoff's ZHA quirk: several alarm conditions are packed
// into a single byte rather than exposed as separate attributes.
const WATER_VALVE_STATE_BIT = {
  WATER_SHORTAGE: 1 << 0,
  WATER_LEAKAGE: 1 << 1,
  WATER_SHORTAGE_CHANNEL_2: 1 << 4,
};

const IRRIGATION_MODE_TO_ZCL = {
  duration: SingleIrrigationMode.DURATION,
  volume: SingleIrrigationMode.VOLUME,
};
const IRRIGATION_MODE_FROM_ZCL = {
  [SingleIrrigationMode.DURATION]: 'duration',
  [SingleIrrigationMode.VOLUME]: 'volume',
};

// IrrigationAmountUnit enum (the real, user-facing unit attribute),
// configured via the device settings page rather than a capability.
const WATER_FLOW_UNIT_TO_ZCL = { liter: 0, us_gallon: 1, imperial_gallon: 2 };
const WATER_FLOW_UNIT_SETTING_DEFAULT = 'liter';

const IRRIGATION_CONFIG_CAPABILITIES = [
  'irrigation_mode',
  'irrigation_duration',
  'irrigation_amount',
  'irrigation_fail_safe_duration',
];

// Homey does not retroactively add capabilities introduced by an app
// update to already-paired devices, so this full list is reconciled on
// every init to migrate existing devices forward.
const ALL_CAPABILITIES = [
  'onoff',
  'alarm_water',
  'alarm_water_shortage',
  'child_lock',
  'measure_battery',
  ...IRRIGATION_CONFIG_CAPABILITIES,
  'measure_water_usage_duration',
  'meter_water',
];

// Capabilities removed from a previous version of this app, still present
// on devices paired back then.
const REMOVED_CAPABILITIES = ['irrigation_amount_unit'];

// Liters assumed for waterUsageVolume - the source quirk declares no
// explicit unit for it. meter_water is conventionally m³ in Homey.
const LITERS_PER_CUBIC_METER = 1000;

class HydroOneDevice extends ZigBeeDevice {
  async onNodeInit({ zclNode }) {
    for (const capabilityId of ALL_CAPABILITIES) {
      if (!this.hasCapability(capabilityId)) {
        await this.addCapability(capabilityId);
      }
    }
    for (const capabilityId of REMOVED_CAPABILITIES) {
      if (this.hasCapability(capabilityId)) {
        await this.removeCapability(capabilityId);
      }
    }

    // Confirmed via Zigbee interview: OnOff and the Sonoff cluster (0xFC11)
    // both live on endpoint 1.
    this.registerCapability('onoff', CLUSTER.ON_OFF);

    // The firmware rejects ZCL "configure reporting" for waterValveState
    // (UNSUPPORTED_ATTRIBUTE) but sends unsolicited reports on its own, so
    // we only listen for reports rather than requesting a reporting config.
    this.registerCapability('alarm_water', SonoffHydroCluster, {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value => Boolean(value & WATER_VALVE_STATE_BIT.WATER_LEAKAGE),
    });

    this.registerCapability('alarm_water_shortage', SonoffHydroCluster, {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value =>
        Boolean(
          value &
          (WATER_VALVE_STATE_BIT.WATER_SHORTAGE | WATER_VALVE_STATE_BIT.WATER_SHORTAGE_CHANNEL_2),
        ),
    });

    this.registerCapability('child_lock', SonoffHydroCluster, {
      get: 'childLock',
      set: 'writeAttributes',
      setParser: value => ({ childLock: value }),
      report: 'childLock',
      reportParser: value => Boolean(value),
    });

    this.registerCapability('measure_battery', CLUSTER.POWER_CONFIGURATION);

    // The capacity unit is a device setting rather than a capability (it's
    // rarely changed); push the current setting to the device on pairing.
    if (this.isFirstInit()) {
      await this._writeWaterFlowUnit(
        this.getSetting('water_flow_unit') ?? WATER_FLOW_UNIT_SETTING_DEFAULT,
      );
    }

    // These four capabilities together configure a single manual irrigation
    // run (mode, duration, target amount, fail-safe cutoff); the firmware
    // only exposes them as one combined 12-byte attribute, so reads parse
    // out one field each and writes are merged into a single payload below.
    this.registerCapability('irrigation_mode', SonoffHydroCluster, {
      get: 'singleIrrigationSet',
      report: 'singleIrrigationSet',
      reportParser: value =>
        IRRIGATION_MODE_FROM_ZCL[decodeSingleIrrigationPayload(value).irrigationMode] ?? 'duration',
    });

    this.registerCapability('irrigation_duration', SonoffHydroCluster, {
      get: 'singleIrrigationSet',
      report: 'singleIrrigationSet',
      reportParser: value => decodeSingleIrrigationPayload(value).totalDurationMin,
    });

    this.registerCapability('irrigation_amount', SonoffHydroCluster, {
      get: 'singleIrrigationSet',
      report: 'singleIrrigationSet',
      reportParser: value => decodeSingleIrrigationPayload(value).amount,
    });

    this.registerCapability('irrigation_fail_safe_duration', SonoffHydroCluster, {
      get: 'singleIrrigationSet',
      report: 'singleIrrigationSet',
      reportParser: value => decodeSingleIrrigationPayload(value).failSafeDurationMin,
    });

    this.registerMultipleCapabilityListener(IRRIGATION_CONFIG_CAPABILITIES, async valueObj => {
      const payload = encodeSingleIrrigationPayload({
        irrigationMode:
          IRRIGATION_MODE_TO_ZCL[
            valueObj.irrigation_mode ?? this.getCapabilityValue('irrigation_mode')
          ],
        totalDurationMin:
          valueObj.irrigation_duration ?? this.getCapabilityValue('irrigation_duration'),
        amount: valueObj.irrigation_amount ?? this.getCapabilityValue('irrigation_amount'),
        failSafeDurationMin:
          valueObj.irrigation_fail_safe_duration ??
          this.getCapabilityValue('irrigation_fail_safe_duration'),
      });
      await this.zclNode.endpoints[1].clusters.sonoffHydro.writeAttributes({
        singleIrrigationSet: payload,
      });
    });

    this.registerCapability('measure_water_usage_duration', SonoffHydroCluster, {
      get: 'waterUsageDuration',
      report: 'waterUsageDuration',
      reportParser: value => value,
    });

    this.registerCapability('meter_water', SonoffHydroCluster, {
      get: 'waterUsageVolume',
      report: 'waterUsageVolume',
      reportParser: value => value / LITERS_PER_CUBIC_METER,
    });
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('water_flow_unit')) {
      await this._writeWaterFlowUnit(newSettings.water_flow_unit);
    }
  }

  async _writeWaterFlowUnit(unit) {
    await this.zclNode.endpoints[1].clusters.sonoffHydro
      .writeAttributes({
        unitOfWaterFlow:
          WATER_FLOW_UNIT_TO_ZCL[unit] ?? WATER_FLOW_UNIT_TO_ZCL[WATER_FLOW_UNIT_SETTING_DEFAULT],
      })
      .catch(err => this.error('Error: could not write water flow unit', err));
  }
}

module.exports = HydroOneDevice;
