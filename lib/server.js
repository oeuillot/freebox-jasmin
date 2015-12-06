/*jslint node: true, vars: true, nomen: true */
'use strict';

var commander = require('commander');
var debug = require('debug')('freebox-jasmin:upnp');
var ip = require('ip');
var Connect = require('connect');
var http = require('http');
var UUID = require('uuid');
var serve_static = require('serve-static');
var fs = require('fs');
var SSDP = require('node-ssdp');
var Path = require('path');
var QmlRun = require('freebox-qml-run');

function Server(configuration, clientsList) {
  this.configuration = configuration || {};

  var connect = Connect();
  this.connect = connect;
  this.server = http.createServer(connect);

  debug("Create server and connect");

  if (debug.enabled) {
    var logger = function(request, response, next) {
      debug("Request :", request.url, "from", request.connection.remoteAddress);
      next();
    };

    connect.use(logger);
  }

  connect.use('/description.xml', this._processDescription.bind(this));

  connect.use('/contentDirectory_control', this._processContentDirectory
      .bind(this));

  this._staticsPath = Path.join(__dirname, "statics");
  debug("Serve static path=", this._staticsPath);
  connect.use(serve_static(this._staticsPath, {
    'index' : false
  }));

  var jasminPath = Path.join(__dirname, "..", "node_modules", "qml-jasmin");
  this._jasminPath = jasminPath;
  debug("JasminPath=" + jasminPath);

  connect.use("/jasmin", serve_static(jasminPath, {
    'index' : false
  }));

  if (clientsList) {
    connect.use("/services/upnpClientsList", this._processUpnpList.bind(this,
        clientsList));
  }
}

module.exports = Server;

Server.prototype._processUpnpList = function(clientsList, request, response) {
  var list = clientsList.list();

  list = list.filter(function(server) {
    return (server.SERVER.indexOf(" Jasmin/") < 0);
  });

  response.writeHead(200, {
    'Content-Type' : 'application/json'
  });
  response.end(JSON.stringify(list), "utf-8");
};

Server.prototype._processContentDirectory = function(request, response) {
  if (this._run && this._run.running) {
    return;
  }

  var jasminURL = 'http://' + request.connection.localAddress + ':' +
      this.server.address().port + "/jasmin";

  debug("Run jasmin url=", jasminURL);

  var run = QmlRun.run(null, {
    freeboxAddress : request.connection.remoteAddress,
    url : jasminURL
  });
  var self = this;
  this._run = run;
  run.on('stop', function() {
    debug("Jasmin has been terminated");
    self._run = null;
  });
};

Server.prototype._processDescription = function(request, response, next) {

  var agent = request.headers["user-agent"];

  debug("Agent=", agent);

  // C'est une freebox !
  if (/(fbxupnpav)/i.exec(agent)) { // |fbxlanbrowser
    debug("Send Freebox Player description (" + agent + ")");

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
  server.listen(0, ip.address(), function(error) {
    if (error) {
      console.error(error);
      return callback(error);
    }

    var locationURL = 'http://' + ip.address() + ':' + server.address().port +
        "/description.xml";

    debug("Listen ... serverAddress=", server.address(), "locationURL=",
        locationURL);

    var uuid = "3faaacec-e3e6-4962-bcbc-d0e23891bbcf"; // self.configuration.uuid || UUID.v4();
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
