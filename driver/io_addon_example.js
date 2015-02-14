function addonDriver () {
  this.driver = null;
  this.timer = null;
  this.counter = 0;

  // This driver does not make much sense but demonstrates how
  // an addon driver can be implemented

  // -----------------------------------------------------------------------------
  // T E S T
  // -----------------------------------------------------------------------------
  this.update = function() {
    // you can call this.driver.updateWidget at any time to set the data for a widget
    // simply pass the GAD name and a string with the value
    this.driver.updateWidget("hcs.data.counter", (this.counter++).toString());
  }

  // -----------------------------------------------------------------------------
  // INIT
  // called only after a page load
  // -----------------------------------------------------------------------------
  this.init = function(driver) {
    this.stop();
    this.driver = driver;
    var self = this;

    console.log("addonDriver started, main driver works on: " + this.driver.address);
    this.update();
    this.timer = setInterval(function () {
      self.update();
    }, 5000);
  };

  // -----------------------------------------------------------------------------
  // RUN
  // called for each page change
  // -----------------------------------------------------------------------------
  this.run = function() {
    console.log("addon-run");
  };

  // -----------------------------------------------------------------------------
  // MONITOR
  // called to tell which gads, series, .. shall be delivered
  // -----------------------------------------------------------------------------
  this.monitor = function(gads, series, logs) {
    console.log("addon-monitor");
  };

  // -----------------------------------------------------------------------------
  // WRITE
  // called to write changed data to the data source
  // -----------------------------------------------------------------------------
  this.write = function(gad, val) {
    console.log("addon-write");
  };

  // -----------------------------------------------------------------------------
  // TRIGGER
  // for basic.trigger
  // -----------------------------------------------------------------------------
  this.trigger = function(gad, val) {
    console.log("addon-trigger");
  };

  // -----------------------------------------------------------------------------
  // STOP
  // no question for what it could be
  // -----------------------------------------------------------------------------
  this.stop = function() {
    if(this.timer) {
      console.log("addon - argh! - they kill me");
      clearInterval(this.timer);
      this.timer = null;
    }
  }

}