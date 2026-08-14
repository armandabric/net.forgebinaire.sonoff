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

// The valve is a sleepy battery end device: it wakes up roughly once an
// hour (poll control check-in), so alarm state relies on the device
// proactively reporting changes rather than on-demand reads.
const WATER_VALVE_STATE_REPORTING = {
  minInterval: 30,
  maxInterval: 900,
  minChange: 1,
};

class HydroOneDevice extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    // Confirmed via Zigbee interview: OnOff and the Sonoff cluster (0xFC11)
    // both live on endpoint 1.
    this.registerCapability('onoff', CLUSTER.ON_OFF);

    this.registerCapability('alarm_water', SonoffHydroCluster, {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value => Boolean(value & WATER_VALVE_STATE_BIT.WATER_LEAKAGE),
      reportOpts: { configureAttributeReporting: WATER_VALVE_STATE_REPORTING },
    });

    this.registerCapability('alarm_water_shortage', SonoffHydroCluster, {
      get: 'waterValveState',
      report: 'waterValveState',
      reportParser: value => Boolean(
        value & (WATER_VALVE_STATE_BIT.WATER_SHORTAGE | WATER_VALVE_STATE_BIT.WATER_SHORTAGE_CHANNEL_2),
      ),
      reportOpts: { configureAttributeReporting: WATER_VALVE_STATE_REPORTING },
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
