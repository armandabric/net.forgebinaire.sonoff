'use strict';

const { Cluster, ZCLDataTypes } = require('zigbee-clusters');

// Sonoff manufacturer-specific cluster (0xFC11), as documented by Sonoff's
// own ZHA quirk for the Hydro One (SWV-ZFU/ZFE/ZNU/ZNE) water valve.
class SonoffHydroCluster extends Cluster {

  static get ID() {
    return 64529; // 0xFC11
  }

  static get NAME() {
    return 'sonoffHydro';
  }

  static get ATTRIBUTES() {
    return {
      childLock: {
        id: 0x0000,
        type: ZCLDataTypes.bool,
      },
      waterValveState: {
        id: 0x500c,
        type: ZCLDataTypes.uint8,
      },
    };
  }

  static get COMMANDS() {
    return {};
  }

}

Cluster.addCluster(SonoffHydroCluster);

module.exports = SonoffHydroCluster;
