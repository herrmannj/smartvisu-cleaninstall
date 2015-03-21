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
  driverVersion: "1.06",
  address: '',
  port: '',

  // -----------------------------------------------------------------------------
  // Does a read-request and adds the result to the buffer
  // -----------------------------------------------------------------------------
  read: function (item) {
    io.log(1, "read (item=" + item + ")");
  },

  // -----------------------------------------------------------------------------
  // Does a write-request with a value
  // -----------------------------------------------------------------------------
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


  // -----------------------------------------------------------------------------
  // Trigger a logic
  // -----------------------------------------------------------------------------
  trigger: function (name, val) {
    // fronthem does not want to get trigger, so simple send it the addon driver
    if(io.addon) {
      io.addon.trigger(name, val);
    }
  },


  // -----------------------------------------------------------------------------
  // Initialization of the driver
  // -----------------------------------------------------------------------------
  init: function (address, port) {
    io.log(1, "init [V" + io.driverVersion + "] (address=" + address + " port=" + port + ")");
    io.address = address;
    io.port = port;
    io.open();

    if (io.addonDriverFile) {
      $.getScript("driver/" + io.addonDriverFile)
        .done(function (script, status) {
          io.addon = new addonDriver();
          io.addon.init(io);
          io.addon.run();
        })
        .fail(function (hdr, settings, exception) {
          io.addon = null;
        });
    }
  },


  // -----------------------------------------------------------------------------
  // Called after each page change
  // -----------------------------------------------------------------------------
  run: function (realtime) {
    io.log(1, "run (readyState=" + io.socket.readyState + ")");
    
    // ToDo: Remove after testing
    io.resetLoadTime();

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


  // -----------------------------------------------------------------------------
  // Start timer
  // -----------------------------------------------------------------------------
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


  // -----------------------------------------------------------------------------
  // Stop timer
  // -----------------------------------------------------------------------------
  stopReconnectTimer: function () {
    if (io.rcTimer) {
      clearInterval(io.rcTimer);
      io.rcTimer = null;
      io.log(1, "Reconnect timer stopped");
    }
  },


  // -----------------------------------------------------------------------------
  // Refresh the widgets
  // The native SmartVISU method is blocking
  // Therefore we handle this here in a non blocking way
  // -----------------------------------------------------------------------------
  refreshWidgets: function () {
    $('[id^="' + $.mobile.activePage.attr('id') + '-"][data-item]').each(function (idx) {
			var values = widget.get(widget.explode($(this).attr('data-item')));

			if (widget.check(values)) {
        var isPlot = $(this).attr('data-widget').substr(0, 5) == 'plot.';
        if(isPlot) {
          $(this).trigger('update', [values]);
        }
        else {
          // ToDo: This does not work with the highcharts in Chrom. FireFox works.
          var dw = io.action[$(this).attr('data-widget')];
          if(dw) {
            dw.handler.call(this, 'update', [values]);
          }
          else {
            io.log(0, $(this).attr('data-widget') + ": Handler not found")
          }
        }
			}
		})
    
  },

  // -----------------------------------------------------------------------------
  // Update a widget
  // -----------------------------------------------------------------------------
  updateWidget: function(item, value) {
  // ToDo: Remove after testing
    io.receivedGADs++;    
    io.logLoadTime("GAD #" + io.receivedGADs);
    
    var widgetType = "";

		if (value === undefined || widget.buffer[item] !== value || (widget.buffer[item] instanceof Array && widget.buffer[item].toString() != value.toString())) {
      widget.set(item, value);
      
			$('[data-item*="' + item + '"]').each(function (idx) {
        widgetType = $(this).attr('data-widget');
				var items = widget.explode($(this).attr('data-item'));

				for (var i = 0; i < items.length; i++) {
					if (items[i] == item) {
						var values = Array();
            var isPlot = widgetType.substr(0, 5) == 'plot.';
            
						// update to a plot: only add a point
            // ToDo: Point still unsolved
						if (isPlot && $('#' + this.id).highcharts()) {
							// if more than one item, only that with the value
              /*
							for (var j = 0; j < items.length; j++) {
								values.push(items[j] == item ? value : null);
							}
							if (value !== undefined && value != null) {
  						  $(this).trigger('point', [values]);
  						}
              */
						}

						// regular update to the widget with all items   
						else {
							values = widget.get(items);
							if (widget.check(values)) {
                if(isPlot) {
								  $(this).trigger('update', [values]);
                }
                else {  
                  // ToDo: This does not work with the highcharts in Chrome. FireFox works.
                  var dw = io.action[$(this).attr('data-widget')];
                  if(dw) {
                    dw.handler.call(this, 'update', [values]);
                  }
                  else {
                    io.log(0, widgetType + ": Handler not found")
                  }
                }
							}
						}
					}
				}
			});
		}
    
    // ToDo: Remove after testing
    io.logLoadTime("OK (" + widgetType + ")");
    io.showLoadTime();
  },


  // -----------------------------------------------------------------------------
  // Update a chart
  // -----------------------------------------------------------------------------
  updateChart: function(gad, series) {
    $('[data-item*="' + gad + '"]').each(function (idx) {
      var items = widget.explode($(this).attr('data-item'));
      for (var i = 0; i < items.length; i++) {
        if (items[i] === gad) {
          var seriesData = {
            "gad": gad,
            "data": series
          };

          ////$(this).trigger('update', seriesData);
          var dw = io.action[$(this).attr('data-widget')];
          if(dw) {
            dw.handler.call(this, 'update', seriesData);
          }
          else {
            io.log(0, widgetType + ": Handler not found")
          }

          io.log(2, "series updated: " + seriesData.gad + " size: " + seriesData.data.length);
          break;
        }
      }
    });

  },


  // -----------------------------------------------------------------------------
  // Open the connection and listen what fronthem sends
  // -----------------------------------------------------------------------------
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
          ////io.updateChart("plot.LivingRoom", series);
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


  // -----------------------------------------------------------------------------
  // Sends the data to fronthem
  // -----------------------------------------------------------------------------
  send: function (data) {
    if (io.socket.readyState == 1) {
      io.socket.send(unescape(encodeURIComponent(JSON.stringify(data))));
      io.log(2, 'send() data: ' + JSON.stringify(data));
    }
  },


  // -----------------------------------------------------------------------------
  // Split the GADs into the FHEM-part and our own part
  // -----------------------------------------------------------------------------
  splitGADs: function() {
    io.ownGADs = [];
    io.fhemGADs = [];
    var gads = Array();
    var unique = Array();

    io.allGADs.forEach(function (item) {
      var dataWidget = $(item).attr('data-widget');
      if (!(dataWidget == 'status.log' || dataWidget.lastIndexOf("chart.", 0) === 0) || dataWidget.lastIndexOf("plot.", 0) === 0 ) {
        var items = widget.explode($(item).attr('data-item'));
        for (var i = 0; i < items.length; i++) {
          if (!widget.checkseries(items[i])) {
            unique[items[i]] = '';
          }
        }
      }
    });

    for (var item in unique) {
      gads.push(item);
    }

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


  // -----------------------------------------------------------------------------
  // Split the charts into the FHEM-part and our own part
  // -----------------------------------------------------------------------------
  splitCharts: function() {
    io.ownSeries = [];
    io.fhemSeries = [];

    io.allGADs.forEach(function (item) {
      var dataWidget = $(item).attr('data-widget');
        if (dataWidget.lastIndexOf("chart.", 0) == 0 ) {
          var dataItem = $(item).attr('data-item');
          var list = dataItem.split(',');

          for (var i = 0; i < list.length; i++) {
            var plotInfo = {
              "gad": list[i].trim(),
              "mode": $(item).attr('data-modes'),
              "start": $(item).attr('data-tmin'),
              "end": $(this).attr('data-tmax'),
              "interval": $(item).attr('data-interval')
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
        }
    });

  },

  // -----------------------------------------------------------------------------
  // Split the Logs into the FHEM-part and our own part
  // -----------------------------------------------------------------------------
  splitLogs: function() {
    io.ownLogs = [];
    io.fhemLogs = [];
    
    io.allGADs.forEach(function (item) {
      var dataWidget = $(item).attr('data-widget');
        if (dataWidget === "status.log") {
          var dataItem = $(item).attr('data-item');
          var list = dataItem.split(',');

          for (var i = 0; i < list.length; i++) {
            var logInfo = {
              "gad": list[i].trim(),
              "size": $(item).attr('data-count'),
              "interval": $(item).attr('data-interval')
            };

            if (io.gadFilter) {
              var re = new RegExp(io.gadFilter);
              if (re.test(logInfo.gad)) {
                io.ownLogs.push(logInfo);
              }
              else {
                io.fhemLogs.push(logInfo);
              }
            }
            else {
              io.fhemLogs.push(logInfo);
            }
          }
        }
    });
    
  },

  // -----------------------------------------------------------------------------
  // Get and cache GADs
  // -----------------------------------------------------------------------------
  getAllGADs: function() {
  	io.action = {};
    io.allGADs = [];

		// get all delegate handlers
    var handlers = ($._data($(document)[0], "events") || {} )["update"];
				
		for ( var i = 0; i < handlers.delegateCount; i++) {
			var raw = handlers[i].selector;
			var regx = /.*?data-widget="(.+?)".*/; 
			regx.exec(raw);
			var widget = RegExp.$1;
			var handler = handlers[i].handler;
			io.action[widget] = {handler: handler};
		}

		// get all widgets at page
		$('[id^="' + $.mobile.activePage.attr('id') + '-"][data-item]').each(function (idx, e) {
      io.allGADs.push(this);
		});

	},


  // -----------------------------------------------------------------------------
  // Monitors the items
  // -----------------------------------------------------------------------------
  allGADs  : [],
  fhemGADs  : [],
  ownGADs   : [],
  fhemSeries : [],
  ownSeries  : [],
  fhemLogs : [],
  ownLogs  : [],
  monitor: function () {
    if (io.socket.readyState == 1) {
      // ToDo: Remove after testing
      io.logLoadTime("Monitor");

      io.getAllGADs();
      io.splitGADs();
      io.splitCharts();
      io.splitLogs();

      // ToDo: Remove after testing
      io.logLoadTime("Monitor done");
      
      io.log(1, "monitor (GADs:" + io.fhemGADs.length + ", Series:" + io.fhemSeries.length + ")");

      if (io.fhemGADs.length) {
        io.send({'cmd': 'monitor', 'items': io.fhemGADs});
      }

      if (io.fhemSeries.length) {
        io.send({'cmd': 'series', 'items': io.fhemSeries});
      }
      
      if (io.fhemLogs.length) {
        io.send({'cmd': 'log', 'items': io.fhemLogs});
      }

      if (io.addon) {
        io.addon.monitor(io.ownGADs, io.ownSeries, io.ownLogs);
      }


    }
  },


  // -----------------------------------------------------------------------------
  // Closes the connection
  // -----------------------------------------------------------------------------
  close: function () {
    if(io.socket != null) {
      io.socket.close();
      io.socket = null;
      io.log(1, "socket closed");
    }

  },

  // =============================================================================
  // H E L P E R S
  // =============================================================================
  
  // -----------------------------------------------------------------------------
  // Time measurement
  // -----------------------------------------------------------------------------
  gadsToMeasure:   20,
  loadTimeLog:     "Load-Times\n",
  timeStamp:       0,
  receivedGADs:    0,
  
  resetLoadTime: function() {
    io.receivedGADs = 0;
    io.loadTimeLog = "Load-Times\n";
    io.logLoadTime("Start");
  },
  logLoadTime: function (text) {
    var d = new Date();
    var diff = io.timeStamp == 0 ? 0 : (d.getTime() - io.timeStamp);
    io.loadTimeLog += d.toLocaleTimeString() + "." + ("000" + d.getMilliseconds()).slice(-3) + " (" + diff + " ms): " + text + "\n";
    io.timeStamp = d.getTime();
  },
  showLoadTime: function() {
    if(io.receivedGADs == io.gadsToMeasure) {
      if(io.loadTimeLog) {
        io.logLoadTime(io.receivedGADs + " GADs");
        ////alert(io.loadTimeLog);
      }
    }
  }

};

