//noinspection JSUnusedGlobalSymbols
/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU / FHEM
 * @author      HCS, original version by Martin Gleiß
 * @copyright   2015
 * @license     GPL [http://www.gnu.de]
 * -----------------------------------------------------------------------------
 *
 * This driver has enhancements for using smartVISU with FHEM
 */
 
var io = {
  // --- Driver configuration ----------------------------------------------------
  logLevel:        1,
  gadFilter:       "",  // regex, to hide these GADs to FHEM
  addonDriverFile: "",   // filename of an optional addon driver
  // -----------------------------------------------------------------------------

  // -----------------------------------------------------------------------------
  // P U B L I C   F U N C T I O N S
  // -----------------------------------------------------------------------------
  address: '',
  port: '',
  
  /**
   * Does a read-request and adds the result to the buffer
   *
   * @param      the item
   */
  read: function (item) {
    io.log(1, "read (item=" + item + ")");
  },

  /**
   * Does a write-request with a value
   *
   * @param      the item
   * @param      the value
   */
  write: function (item, val) {
    io.log(1, "write (item=" + item + " val=" + val + ")");
    io.send({'cmd': 'item', 'id': item, 'val': val});
    io.updateWidget(item, val);
  },

  /**
   * Trigger a logic
   *
   * @param      the logic
   * @param      the value
   */
  trigger: function (name, val) {
    // not supported
    io.log(1, "trigger");
  },

  /**
   * Initializion of the driver
   *
   * @param      the ip or url to the system (optional)
   * @param      the port on which the connection should be made (optional)
   */
  init: function (address, port) {
    io.log(1, "init (address=" + address + " port=" + port + ")");
    io.address = address;
    io.port = port;
    io.open();
  },


  /**
   * Lets the driver work
   */
  run: function (realtime) {
    io.log(1, "run (readyState=" + io.socket.readyState + ")");
    if (io.socket.readyState > 1) {
      io.open();
    }
    else {
      // old items
      widget.refresh();

      // new items
      io.monitor();
    }

  },

  // -----------------------------------------------------------------------------
  // P R I V A T E   F U N C T I O N S
  // -----------------------------------------------------------------------------
  version: '0.1',
  socket: null,
  rcTimer: null,

  log: function (level, text) {
    if (io.logLevel >= level) {
      console.log("[io.fhem]: " + text);
    }
  },

  startReconnectTimer: function () {
    if (!io.rcTimer) {
      io.log(1, "Reconnect timer started");
      io.rcTimer = setInterval(function () {
        io.log(1, "Reconnect timer fired");
        notify.add('ConnectionLost', 'connection', "Driver: fhem", "Connection to the fhem server lost!");
        notify.display();
        if (!io.socket) {
          io.open();
        }
      }, 60000);
    }
  },

  stopReconnectTimer: function () {
    if (io.rcTimer) {
      clearInterval(io.rcTimer);
      io.rcTimer = null;
      io.log(1, "Reconnect timer stopped");
    }
  },

  updateWidget: function(item, val) {
    widget.update(item, val);
  },

  /**
   * Open the connection and add some handlers
   */
  open: function () {
    io.socket = new WebSocket('ws://' + io.address + ':' + io.port + '/');

    io.socket.onopen = function () {
      io.log(1, "socket.onopen()");
      io.stopReconnectTimer();
      io.send({'cmd': 'proto', 'ver': io.version});
      io.monitor();
      if (notify.exists()) {
        notify.remove();
      }

    };

    io.socket.onmessage = function (event) {
      var item, val;
      var data = JSON.parse(event.data);
      io.log(2, "onmessage() data= " + event.data);
      switch (data.cmd) {
        case 'reloadPage':
          location.reload(true);
          break;

        case 'item': // item
          for (var i = 0; i < data.items.length; i = i + 2) {
            item = data.items[i];
            val = data.items[i + 1];
            io.updateWidget(item, val);
            io.log(2, "item updated: " + item + " val: " + val);
          }
          break;

        case 'dialog':
          notify.info(data.header, data.content);
          break;

        case 'proto':
          var proto = data.ver;
          if (proto != io.version) {
            notify.info('Driver: fhem', 'Protocol mismatch<br />Driver is at version v' + io.version + '<br />fhem is at version v' + proto);
          }
          break;

        case 'log':
          break;
      }
    };

    io.socket.onerror = function (error) {
      io.log(1, "socket.onerror: " + error);
    };

    io.socket.onclose = function () {
      io.log(1, "socket.onclose");
      io.close();
      io.startReconnectTimer();
    };
  },

  /**
   * Sends data to the connected system
   */
  send: function (data) {
    if (io.socket.readyState == 1) {
      io.socket.send(unescape(encodeURIComponent(JSON.stringify(data))));
      io.log(2, 'send() data: ' + JSON.stringify(data));
    }
  },

  /**
   * Monitors the items
   */
  monitor: function () {
    if (io.socket.readyState == 1) {
      var gads = widget.listeners();
      io.log(1, "Total-GADs: " + gads.length);
      var fhemGADs = [];
      var ownGADs = [];
      if(io.gadFilter) {
        var re = new RegExp(io.gadFilter);
        for (var i=0; i < gads.length; i++) {
          var l = gads[i];
          var own = re.test(l);
          if(own){
            ownGADs.push(l);
          }
          else {
            fhemGADs.push(l);
          }
        }
        io.log(1, "FHEM GADs: " + fhemGADs.length);
        io.log(1, "Own GADs: " + ownGADs.length);
      }
      else {
        fhemGADs = gads;
      }

      if (fhemGADs.length) {
        io.send({'cmd': 'monitor', 'items': fhemGADs});
      }

      if (ownGADs.length) {
        if (io.addonDriverFile) {
          $.getScript("driver/" + io.addonDriverFile)
            .done(function (script, status) {
              io.log(1, io.addonDriverFile + " loaded");
              io.addon = new addonDriver();
              io.addon.run(io, ownGADs);
            })
            .fail(function (hdr, settings, exception) {
              io.addon = null;
            });
        }
      }
    }
  },


  /**
   * Closes the connection
   */
  close: function () {
    if(io.socket != null) {
      io.socket.close();
      io.socket = null;
      io.log(1, "socket closed");

      if(io.addon) {
        io.addon.stop();
      }
    }
  }

};
