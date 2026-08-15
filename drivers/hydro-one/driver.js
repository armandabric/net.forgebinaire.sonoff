'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class HydroOneDriver extends ZigBeeDriver {
  async onInit() {
    this.log('HydroOneDriver has been initialized');
  }
}

module.exports = HydroOneDriver;
