"use strict";

const { ZigBeeDriver } = require("homey-zigbeedriver");

class HydroOneDriver extends ZigBeeDriver {
  async onInit() {
    this.log("HydroOneDriver has been initialized");

    this.homey.flow
      .getActionCard("water_for_duration")
      .registerRunListener(async (args) => {
        await args.device.startDurationIrrigation(args.duration);
      });

    this.homey.flow
      .getActionCard("water_for_volume")
      .registerRunListener(async (args) => {
        await args.device.startVolumeIrrigation(
          args.amount,
          args.fail_safe_duration,
        );
      });
  }
}

module.exports = HydroOneDriver;
