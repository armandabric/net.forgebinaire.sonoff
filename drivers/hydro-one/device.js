'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

const SonoffHydroCluster = require('../../lib/SonoffHydroCluster');
const {
  SingleIrrigationMode,
  encodeSingleIrrigationPayload,
} = require('../../lib/sonoffIrrigation');

// Bit layout of the sonoffHydro `waterValveState` attribute (0x500C), as
// documented in Sonoff's ZHA quirk: several alarm conditions are packed
// into a single byte rather than exposed as separate attributes.
const WATER_VALVE_STATE_BIT = {
  WATER_SHORTAGE: 1 << 0,
  WATER_LEAKAGE: 1 << 1,
  WATER_SHORTAGE_CHANNEL_2: 1 << 4,
};

// IrrigationAmountUnit enum value for Liter. The app always forces the
// device into this unit - no gallon support, no setting to configure it.
const ZCL_UNIT_OF_WATER_FLOW_LITER = 0;

// Homey does not retroactively add capabilities introduced by an app
// update to already-paired devices, so this full list is reconciled on
// every init to migrate existing devices forward.
const ALL_CAPABILITIES = [
  'onoff',
  'alarm_water',
  'alarm_water_shortage',
  'child_lock',
  'measure_battery',
  'measure_water_usage_duration',
  'meter_water',
];

// Capabilities removed from a previous version of this app (manual
// irrigation config, now Flow actions instead), still present on devices
// paired back then.
const REMOVED_CAPABILITIES = [
  'irrigation_amount_unit',
  'irrigation_mode',
  'irrigation_duration',
  'irrigation_amount',
  'irrigation_fail_safe_duration',
];

// Liters assumed for waterUsageVolume - the source quirk declares no
// explicit unit for it. meter_water is conventionally m³ in Homey.
const LITERS_PER_CUBIC_METER = 1000;

// SWV-ZNU/ZNE have no flow meter and don't support Volume mode at the
// firmware level, per the source quirk (they only get a Duration-only
// irrigation plan mode). This driver pairs with them too (same cluster,
// duration-only features), so the Volume Flow action needs to reject them
// explicitly rather than silently sending a payload the firmware can't use.
const DURATION_ONLY_PRODUCT_IDS = ['SWV-ZNU', 'SWV-ZNE'];

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

    // The app only ever sends/reads amounts in liters, so force the device
    // into that unit once on pairing rather than exposing it as a setting.
    if (this.isFirstInit()) {
      await this._writeWaterFlowUnit();
    }

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

  // Used by the "water for a duration" Flow action.
  async startDurationIrrigation(totalDurationMin) {
    const payload = encodeSingleIrrigationPayload({
      irrigationMode: SingleIrrigationMode.DURATION,
      totalDurationMin,
    });
    await this.zclNode.endpoints[1].clusters.sonoffHydro.writeAttributes({
      singleIrrigationSet: payload,
    });
    await this.triggerCapabilityListener('onoff', true);
  }

  // Used by the "water a volume" Flow action.
  async startVolumeIrrigation(amount, failSafeDurationMin) {
    if (DURATION_ONLY_PRODUCT_IDS.includes(this.getSetting('zb_product_id'))) {
      throw new Error(
        'This Hydro One has no flow meter and does not support watering by volume - use "Water for a duration" instead.',
      );
    }

    const payload = encodeSingleIrrigationPayload({
      irrigationMode: SingleIrrigationMode.VOLUME,
      amount,
      failSafeDurationMin,
    });
    await this.zclNode.endpoints[1].clusters.sonoffHydro.writeAttributes({
      singleIrrigationSet: payload,
    });
    await this.triggerCapabilityListener('onoff', true);
  }

  async _writeWaterFlowUnit() {
    await this.zclNode.endpoints[1].clusters.sonoffHydro
      .writeAttributes({ unitOfWaterFlow: ZCL_UNIT_OF_WATER_FLOW_LITER })
      .catch(err => this.error('Error: could not write water flow unit', err));
  }
}

module.exports = HydroOneDevice;
