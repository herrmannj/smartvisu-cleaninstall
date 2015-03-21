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
  offline:         false,
  gadFilter:       "", // regex, to hide these GADs to FHEM
  addonDriverFile: "",  // filename of an optional addon driver
  // -----------------------------------------------------------------------------

  // -----------------------------------------------------------------------------
  // P U B L I C   F U N C T I O N S
  // -----------------------------------------------------------------------------
  driverVersion: "1.07",
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
    if(io.offline) {
    
    }
    else {
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
    }
    
    io.updateWidget(gad, val);
  },


  // -----------------------------------------------------------------------------
  // Trigger a logic
  // -----------------------------------------------------------------------------
  trigger: function (name, val) {
    // fronthem does not want to get trigger, so simply send it the addon driver
    if(io.addon) {
      io.addon.trigger(name, val);
    }
  },


  // -----------------------------------------------------------------------------
  // Initialization of the driver
  // -----------------------------------------------------------------------------
  init: function (address, port) {
    io.log(0, "init [V" + io.driverVersion + "] (address=" + address + " port=" + port + ")");
    io.address = address;
    io.port = port;

    if(address === "offline") {
      io.offline = true;
    }

    if(io.offline) {
      io.log(0, "DRIVER IS IN OFFLINE MODE");
    }
    else {
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
    }
  },


  // -----------------------------------------------------------------------------
  // Called after each page change
  // -----------------------------------------------------------------------------
  run: function (realtime) {
    if(io.offline) {
      io.log(1, "run (OFFLINE)");
      io.monitor();
      io.simulateData();

      if(io.timer) {
        clearInterval(io.timer);
      }
      io.timer = setInterval(function () {
        io.simulateData();
      }, 5000);

    }
    else {
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
  // Try to call the update handler of a widget
  // -----------------------------------------------------------------------------
  callUpdateHandler: function(item, values) {
    var cachedWidget = io.action[$(item).attr('data-widget')];
    if(cachedWidget) {
      cachedWidget.handler.call(item, 'update', values);
    }
    else {
      $(item).trigger('update', values);
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
          io.callUpdateHandler(this, values);
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
                  io.callUpdateHandler(this, values);
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
  updateChart: function(gad, series, updatemode) {
    $('[data-item*="' + gad + '"]').each(function (idx) {
      var items = widget.explode($(this).attr('data-item'));
      for (var i = 0; i < items.length; i++) {
        if (items[i] === gad) {
          var seriesData = {
            "gad": gad,
            "data": series
          };

          io.callUpdateHandler(this, seriesData);
          io.log(2, "series updated: " + seriesData.gad + " size: " + seriesData.data.length);
          break;
        }
      }
    });

  },

  // -----------------------------------------------------------------------------
  // Handle the received data
  // -----------------------------------------------------------------------------
  handleReceivedData: function (eventdata) {
    var i = 0;
    var data = JSON.parse(eventdata);
    switch (data.cmd) {
      case 'reloadPage':
        location.reload(true);
        break;

      case 'item':
        // We get:
        // {
        //   "cmd": "item",
        //   "items": ["Temperature_LivingRoom.temperature","21"]
        // }
        for (i = 0; i < data.items.length; i = i + 2) {
          var item = data.items[i];
          var val = data.items[i + 1];
          io.updateWidget(item, val);
        }
        break;

      case 'series':
        // We get:
        // {
        //   "cmd": "series",
        //   "items": {
        //     "gad": "hcs.data.Heating.WaterTemperatureChart",
        //     "updatemode": "complete",
        //     "plotdata": [
        //       [
        //         1426374304000,
        //         45
        //       ],
        //       [
        //         1426376105000,
        //         45
        //       ],
        //       [
        //         1426377905000,
        //         44.5
        //       ],
        //     ]
        //   }
        // }          
        for (i = 0; i < data.items.length; i++) {
          var gad = data.items[i].gad;
          var plotData = data.items[i].plotdata;
          var updateMode = data.items[i].updatemode;
          io.updateChart(gad, plotData, updateMode);
        }
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
  },

  // -----------------------------------------------------------------------------
  // Open the connection and listen what fronthem sends
  // -----------------------------------------------------------------------------
  open: function () {
    io.socket = new WebSocket('ws://' + io.address + ':' + io.port + '/');

    io.socket.onopen = function () {
      io.log(2, "socket.onopen");
      io.stopReconnectTimer();
      io.send({'cmd': 'proto', 'ver': io.protocolVersion});
      io.monitor();
      if (notify.exists()) {
        notify.remove();
      }
    };

    io.socket.onmessage = function (event) {
      io.log(2, "socket.onmessage: data= " + event.data);
      io.handleReceivedData(event.data);
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
    if (io.offline) {
      io.log(2, 'OFFLINE send() data: ' + JSON.stringify(data));
    }
    else {
      if (io.socket.readyState == 1) {
        io.socket.send(unescape(encodeURIComponent(JSON.stringify(data))));
        io.log(2, 'send() data: ' + JSON.stringify(data));
      }
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
      if(io.offline) {
        io.offlineGADs.push(item);
      }
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
          var gads = $(item).attr('data-item').split(',');
          var dataModes = $(item).attr('data-modes');
          var modes = dataModes.split(',');

          for (var i = 0; i < gads.length; i++) {
            var plotInfo = {
              "gad": gads[i].trim(),
              "mode": modes.length > 1 ? modes[i].trim() : dataModes,
              "start": $(item).attr('data-tmin'),
              "end": $(item).attr('data-tmax'),
              "interval": $(item).attr('data-interval'),
              "minzoom": $(item).attr('data-zoom'),
              "updatemode": "complete"
            };
            
            if(io.offline) {
              io.offlineSeries.push(plotInfo);
            }

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
            
            if(io.offline) {
              io.offlineLogs.push(logInfo);
            }

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

    if (io.offline || io.socket.readyState == 1) {
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
  },
  
  // -----------------------------------------------------------------------------
  // offline data
  // -----------------------------------------------------------------------------
  timer: null,
  offlineGADs:   [],
  offlineSeries: [],
  offlineLogs: [],
  simulateData: function() {
    for(i=0; i<io.offlineGADs.length; i++) {
      var data = [];
      data.push(io.offlineGADs[i]);
      data.push((Math.random() * 100).toFixed(1));
      io.handleReceivedData('{"cmd":"item", "items": ' + JSON.stringify(data) + '}');
    }

    var dt = new Date().getTime();
    for(var i=0; i<io.offlineSeries.length; i++) {
      var widget = $('[data-item*="' + io.offlineSeries[i].gad + '"]')[0];
      var steps = 100;
      var yMin = $(widget).attr('data-ymin'); yMin = yMin ? yMin *1 : 0;
      var yMax = $(widget).attr('data-ymax'); yMax = yMax ? yMax *1 : 255;

      var xMin = new Date().getTime() - new Date().duration($(widget).attr('data-tmin'));
      var xMax = new Date().getTime() - new Date().duration($(widget).attr('data-tmax'));
      var step = Math.round((xMax - xMin) / steps);
      var val = yMin + ((yMax - yMin) / 2);
      var delta = (yMax - yMin) / 20;

      var series = [];
      while (xMin <= xMax) {
        val += Math.random() * (2 * delta) - delta;
        series.push([xMin, val.toFixed(2) * 1.0]);
        xMin += step;
      }

      var dataString = '{"cmd":"series", "items": [{"gad": "' + io.offlineSeries[i].gad + '", "updatemode": "complete", "plotdata": ' + JSON.stringify(series) + ' }]}';
      io.handleReceivedData(dataString);
    }

  }


};

