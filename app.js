'use strict';

const Homey = require('homey');

class SonoffApp extends Homey.App {

  async onInit() {
    this.log('Sonoff app has been initialized');
  }

}

module.exports = SonoffApp;
