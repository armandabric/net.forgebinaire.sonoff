import Homey from "homey";

class SonoffApp extends Homey.App {
  async onInit() {
    this.log("Sonoff app has been initialized");
  }
}

export default SonoffApp;
