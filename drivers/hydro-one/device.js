'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

const SonoffHydroCluster = require('../../lib/SonoffHydroCluster');

// Bit layout of the sonoffHydro `waterValveState` attribute (0x500C), as
// documented in Sonoff's ZHA quirk: several alarm conditions are packed
// into a single byte rather than exposed as separate attributes.
const WATER_VALVE_STATE_BIT = {
  WATER_SHORTAGE: 1 << 0,
  WATER_LEAKAGE: 1 << 1,
  WATER_SHORTAGE_CHANNEL_2: 1 << 4,
};

class HydroOneDevice extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
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
      reportParser: value => Boolean(
        value & (WATER_VALVE_STATE_BIT.WATER_SHORTAGE | WATER_VALVE_STATE_BIT.WATER_SHORTAGE_CHANNEL_2),
      ),
    });

    this.registerCapability('child_lock', SonoffHydroCluster, {
      get: 'childLock',
      set: 'childLock',
      setParser: value => value,
      report: 'childLock',
      reportParser: value => Boolean(value),
    });
  }

}

module.exports = HydroOneDevice;
