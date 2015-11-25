/*jslint node: true, vars: true, nomen: true */
'use strict';

var commander = require('commander');
var debug = require('debug')('freebox-jasmin');
var ip = require('ip');
var connect = require('connect');
var http = require('http');
var UUID = require('uuid');
var serve_static = require('serve-static');
var fs = require('fs');
var SSDP = require('node-ssdp');
var Path = require('path');

function Server(configuration) {
  this.configuration = configuration || {};

  this.connect = connect();
  this.server = http.createServer(this.connect);

  debug("Create server and connect");

  if (debug.enabled) {
    var logger = function(request, response, next) {
      debug("Request: ", request.url, " from ",
          request.connection.remoteAddress);
      next();
    };

    this.connect.use(logger);
  }

  // this.connect.use('/description.xml', this._processDescription.bind(this));

  this._staticsPath = Path.join(__dirname, "statics");
  debug("Serve static path=", this._staticsPath);
  this.connect.use(serve_static(this._staticsPath));
}

module.exports = Server;

Server.prototype._processDescription = function(request, response, next) {

  var agent = request.headers["user-agent"];

  debug("Agent=", agent);

  // C'est une freebox !
  if (/[fbxupnpav|fbxlanbrowser]/i.exec(agent)) {
    debug("Send Freebox Player description");

    return next();
  }

  debug("Send no freebox player description");

  response.writeHead(200, {
    'Content-Type' : 'text/xml; charset=\"utf-8\"'
  });

  fs
      .createReadStream(
          Path.join(this._staticsPath, "description-nofreebox.xml")).pipe(
          response);
}

Server.prototype.listen = function(callback) {
  var server = this.server;
  var self = this;
  server.listen(function(error) {
    if (error) {
      console.error(error);
      return callback(error);
    }

    var locationURL = 'http://' + ip.address() + ':' + server.address().port +
        "/description.xml";

    debug("Listen ... serverAddress=", server.address(), "locationURL=",
        locationURL);

    var uuid = "1b8a1df7-2706-4518-a5b7-133c88baf635"; // self.configuration.uuid || UUID.v4();
    this.uuid = uuid;

    var ssdConfig = {
      // logLevel : 'trace',
      // log : true,
      udn : "uuid:" + uuid,
      description : "/description.xml",
      location : locationURL,
      ssdpSig : "Node/" + process.versions.node + " UPnP/1.0 FreeboxJasmin/" +
          require("../package.json").version + " Jasmin/" +
          require("../package.json").version
    }
    debug("SsdServer config=", ssdConfig);

    var ssdpServer = new SSDP.Server(ssdConfig);
    this.ssdpServer = ssdpServer;

    ssdpServer.addUSN('upnp:rootdevice');
    ssdpServer.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
    ssdpServer.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1');
    ssdpServer.addUSN('urn:schemas-upnp-org:service:ConnectionManager:1');

    ssdpServer.start();

    callback();
  });
}
