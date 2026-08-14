'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

require('../../lib/SonoffHydroCluster');

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
    // Assumes the valve exposes the standard OnOff and the Sonoff cluster
    // on endpoint 1; unconfirmed until paired with a real device.
    this.registerCapability('onoff', CLUSTER.ON_OFF);

    this.registerCapability('alarm_water', 'sonoffHydro', {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value => Boolean(value & WATER_VALVE_STATE_BIT.WATER_LEAKAGE),
      getOpts: { getOnStart: true },
    });

    this.registerCapability('alarm_water_shortage', 'sonoffHydro', {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value => Boolean(
        value & (WATER_VALVE_STATE_BIT.WATER_SHORTAGE | WATER_VALVE_STATE_BIT.WATER_SHORTAGE_CHANNEL_2),
      ),
      getOpts: { getOnStart: true },
    });

    this.registerCapability('child_lock', 'sonoffHydro', {
      get: 'childLock',
      set: 'childLock',
      setParser: value => value,
      report: 'childLock',
      reportParser: value => Boolean(value),
      getOpts: { getOnStart: true },
    });
  }

}

module.exports = HydroOneDevice;
