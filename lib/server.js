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

function Server(configuration) {
  this.configuration = configuration || {};

  this.connect = connect();
  this.server = http.createServer(this.connect);

  if (debug.enabled) {
    var logger = function(request, response, next) {
      debug("Request: " + request.url);
      next();
    };

    this.connect.use(logger);
  }

  this.connect.use('/description.xml', this._processDescription.bind(this));

  this.connect.use(serve_static(__dirname + "/statics/"));
}

module.exports = Server;

Server.prototype._processDescription = function(request, response, next) {

  var agent = request.headers["Agent"];

  // Ce n'est pas une freebox !
  if (/Freebox/i.exec(agent)) {
    return next();
  }

  response.writeHead(200, {
    'Content-Type' : 'text/xml'
  });

  response.pipe(fs.createReadStream(__dirname +
      "/statics/description-nofreebox.xml"));
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

    var uuid = self.configuration.uuid || UUID.v4();
    this.uuid = uuid;

    var ssdpServer = new SSDP.Server({
      // logLevel : self.configuration.ssdpLogLevel, // 'trace',
      // log : self.configuration.ssdpLog,
      udn : uuid,
      description : "/description.xml",
      location : locationURL,
      ssdpSig : "Node/" + process.versions.node + " UPnP/1.0 " + "Jasmin/" +
          require("../package.json").version
    });
    this.ssdpServer = ssdpServer;

    ssdpServer.addUSN('upnp:rootdevice');
    ssdpServer.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
    ssdpServer.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1');

    ssdpServer.start();

    callback();
  });
}
