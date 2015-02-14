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
  gadFilter:       "", // regex, to hide these GADs to FHEM
  addonDriverFile: "",  // filename of an optional addon driver
  // -----------------------------------------------------------------------------

  // -----------------------------------------------------------------------------
  // P U B L I C   F U N C T I O N S
  // -----------------------------------------------------------------------------
  driverVersion: "1.02",
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
  write: function (gad, val) {
    var isOwn = false;
    if(io.gadFilter) {
      var re = new RegExp(io.gadFilter);
      isOwn = re.test(gad);
    }

    if(isOwn) {
      if(io.addon) {
        io.addon.write(gad, val);
      }
    }
    else {
      io.log(2, "write (gad=" + gad + " val=" + val + ")");
      io.send({'cmd': 'item', 'id': gad, 'val': val});
    }
    io.updateWidget(gad, val);

  },

  /**
   * Trigger a logic
   *
   * @param      the logic
   * @param      the value
   */
  trigger: function (name, val) {
    // fronthem does not want to get trigger, so simple send it the addon driver
    if(io.addon) {
      io.addon.trigger(name, val);
    }
  },

  /**
   * Initialization of the driver
   *
   * @param      the ip or url to the system (optional)
   * @param      the port on which the connection should be made (optional)
   */
  init: function (address, port) {
    io.log(1, "init [V" + io.driverVersion + "] (address=" + address + " port=" + port + ")");
    io.address = address;
    io.port = port;
    io.open();

    if (io.addonDriverFile) {
      $.getScript("driver/" + io.addonDriverFile)
        .done(function (script, status) {
          io.addon = new addonDriver();
          io.addon.init(io);io.addon.run();
        })
        .fail(function (hdr, settings, exception) {
          io.addon = null;
        });
    }
  },


  /**
   * Lets the driver work
   */
  run: function (realtime) {
    io.log(1, "run (readyState=" + io.socket.readyState + ")");

    if(io.addon) {
      io.addon.run();
    }

    if (io.socket.readyState > 1) {
      io.open();
    }
    else {
      // old items
      io.refreshWidgets();

      // new items
      io.monitor();
    }

  },

  // -----------------------------------------------------------------------------
  // P R I V A T E   F U N C T I O N S
  // -----------------------------------------------------------------------------
  protocolVersion: '0.1',
  socket: null,
  rcTimer: null,
  addon: null,

  log: function (level, text) {
    if (io.logLevel >= level) {
      console.log("[io.fhem]: " + text);
    }
  },

  /**
   * Start timer
   */
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

  /**
   * Stop timer
   */
  stopReconnectTimer: function () {
    if (io.rcTimer) {
      clearInterval(io.rcTimer);
      io.rcTimer = null;
      io.log(1, "Reconnect timer stopped");
    }
  },

  /**
   * Refresh the widgets
   * The native SmartVISU method is blocking
   * Therefore we handle this here in a non blocking way
   */
  refreshWidgets: function () {
    $('[id^="' + $.mobile.activePage.attr('id') + '-"][data-item]').each(function (idx) {
      setTimeout(function(item) {
        var values = widget.get(widget.explode($(item).attr('data-item')));
        if (widget.check(values)) {
          $(item).trigger('update', [values]);
        }
      }, 2, this);
    })
  },

  /**
   * Update a widget
   *
   */
  updateWidget: function(item, val) {
    setTimeout(function(i, v) {
      widget.update(i, v);
      io.log(2, "item updated: " + i + " val: " + v);
    }, 1, item, val);
 },


  /**
   * Update a plot
   *
   */
  updatePlot: function(item, series) {
    setTimeout(function(i, v) {
      widget.update(i, v);
      io.log(2, "series updated: " + i + " size: " + v.length);

    }, 1, item, series);
  },

  /**
   * Open the connection and add some handlers
   */
  open: function () {
    io.socket = new WebSocket('ws://' + io.address + ':' + io.port + '/');

    io.socket.onopen = function () {
      io.log(2, "socket.onopen()");
      io.stopReconnectTimer();
      io.send({'cmd': 'proto', 'ver': io.protocolVersion});
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

        case 'item':
          for (var i = 0; i < data.items.length; i = i + 2) {
            item = data.items[i];
            val = data.items[i + 1];
            io.updateWidget(item, val);
          }
          break;

        case 'series':
          ////io.updatePlot("plot.LivingRoom", series);
          break;

        case 'dialog':
          notify.info(data.header, data.content);
          break;

        case 'proto':
          var proto = data.ver;
          if (proto != io.protocolVersion) {
            notify.info('Driver: fhem', 'Protocol mismatch<br />Driver is at version v' + io.protocolVersion + '<br />fhem is at version v' + proto);
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
   *  Slit the GADs into the FHEM-part and our own part
   */
  splitGADs: function() {
    io.ownGADs = [];
    io.fhemGADs = [];
    var gads = widget.listeners();
    if(io.gadFilter) {
      var re = new RegExp(io.gadFilter);
      for (var i=0; i < gads.length; i++) {
        var gad = gads[i];
        var own = re.test(gad);
        if(own){
          io.ownGADs.push(gad);
        }
        else {
          io.fhemGADs.push(gad);
        }
      }
    }
    else {
      io.fhemGADs = gads;
    }
  },

  /**
   *  Slit the plots into the FHEM-part and our own part
   */
  splitPlots: function() {
    io.ownSeries = [];
    io.fhemSeries = [];
    var plots = widget.plot();

    widget.plot().each(function (idx) {
      var dataItem = $(this).attr('data-item');
      var list = dataItem.split(',');

      for (var i = 0; i < list.length; i++) {
        var entryParts = list[i].split(".");
        var gad = "";
        for (var j = 0; j < entryParts.length - 3; j++) {
          gad += ((gad.length == 0 ? "" : ".") + entryParts[j]).trim();
        }

        var plotInfo = {
          'gad': gad,
          'mode': entryParts[entryParts.length - 3],
          'start': entryParts[entryParts.length - 2],
          'end': entryParts[entryParts.length - 1]
        };

        if (io.gadFilter) {
          var re = new RegExp(io.gadFilter);
          if (re.test(plotInfo.gad)) {
            io.ownSeries.push(plotInfo);
          }
          else {
            io.fhemSeries.push(plotInfo);
          }
        }
        else {
          io.fhemSeries.push(plotInfo);
        }
      }
    });

  },

  /**
   * Monitors the items
   */
  fhemGADs  : [],
  ownGADs   : [],
  fhemSeries : [],
  ownSeries  : [],
  monitor: function () {
    if (io.socket.readyState == 1) {
      io.splitGADs();
      io.splitPlots();
      io.log(1, "monitor (GADs:" + io.fhemGADs.length + ", Series:" + io.fhemSeries.length + ")");

      if (io.fhemGADs.length) {
        io.send({'cmd': 'monitor', 'items': io.fhemGADs});
      }

      if (io.fhemSeries.length) {
        ////io.send({'cmd': 'series', 'items': io.fhemSeries});
      }

      if (io.addon) {
        io.addon.monitor(io.ownGADs, io.ownSeries, []);
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
    }

  }

};

