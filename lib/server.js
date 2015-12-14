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
var bodyParser = require('body-parser');
var compression = require('compression')

function Server(configuration, clientsList) {
  this.configuration = configuration || {};

  this._usersSettings = {};

  this._etag = Date.now();
  var app = Connect();
  this.app = app;
  this.server = http.createServer(app);

  debug("Create server and connect");

  app.use(bodyParser.json())
  app.use(compression())

  if (debug.enabled) {
    var logger = function(request, response, next) {
      debug("Request :", request.url, "from", request.connection.remoteAddress);
      next();
    };

    app.use(logger);
  }

  app.use('/description.xml', this._processDescription.bind(this));

  app
      .use('/contentDirectory_control', this._processContentDirectory
          .bind(this));

  this._staticsPath = Path.join(__dirname, "statics");
  debug("Serve static path=", this._staticsPath);
  app.use(serve_static(this._staticsPath, {
    'index' : false
  }));

  var jasminPath = this.configuration.jasminPath ||
      Path.join(__dirname, "..", "node_modules", "qml-jasmin");
  this._jasminPath = jasminPath;
  debug("JasminPath=" + jasminPath);

  app.use("/jasmin", serve_static(jasminPath, {
    'index' : false
  }));

  if (clientsList) {
    app.use("/services/upnpClientsList", this._processUpnpList.bind(this,
        clientsList));
  }
  app.use("/services/myIP", this._processMyIP.bind(this));

  app.use("/services/loadSettings", this._processLoadSettings.bind(this));

  app.use("/services/saveSettings", this._processSaveSettings.bind(this));
}

module.exports = Server;

Server.prototype._processLoadSettings = function(request, response) {
  var settings = this._usersSettings[request.connection.remoteAddress];
  if (!settings) {
    settings = {};
  }

  debug("LoadSettings: returns", settings);

  var json = JSON.stringify(settings);

  response.writeHead(200, {
    'Content-Type' : 'application/json'
  });
  response.end(json, "utf-8");
}

Server.prototype._processSaveSettings = function(request, response) {
  var body = request.body;
  debug("Save settings ", body);

  var current = this._usersSettings[request.connection.remoteAddress];
  if (!current) {
    current = {};
    this._usersSettings[request.connection.remoteAddress] = current;
  }

  for ( var i in body) {
    var v = body[i];
    if (v === "") {
      delete current[i];
      continue;
    }

    current[i] = v;
  }

  var ret = {
    result : "ok"
  };

  var json = JSON.stringify(ret);

  response.writeHead(200, {
    'Content-Type' : 'application/json'
  });
  response.end(json, "utf-8");
}

Server.prototype._processMyIP = function(request, response) {
  var ret = {
    address : request.connection.remoteAddress
  };
  var json = JSON.stringify(ret);

  response.writeHead(200, {
    'Content-Type' : 'application/json'
  });
  response.end(json, "utf-8");
}

Server.prototype._processUpnpList = function(clientsList, request, response) {

  var etag = this._etag + ":" + clientsList.getModificationTag();
  var match = request.headers['if-none-match'];

  debug("processUpnpList: Match=" + match + " etag=" + etag);
  if (match && match === etag) {
    response.writeHead(304);
    response.end();
    return;
  }

  var list = clientsList.list();

  list = list.filter(function(server) {
    return (server.SERVER.indexOf(" Jasmin/") < 0);
  });

  var json = JSON.stringify(list);

  response.writeHead(200, {
    'Content-Type' : 'application/json',
    'ETag' : etag
  });
  response.end(json, "utf-8");
};

Server.prototype._processContentDirectory = function(request, response, next) {
  debug("Process content directory");

  var localAddress = request.connection.localAddress;
  var remoteAddress = request.connection.remoteAddress;

  setTimeout(this._run.bind(this, localAddress, remoteAddress), 1000);

  next();
};

Server.prototype._run = function(localAddress, remoteAddress) {
  if (this._runningInstance && this._runningInstance.running) {
    // return;
  }

  var jasminURL = 'http://' + localAddress + ':' + this.server.address().port +
      "/jasmin";

  debug("Run jasmin url=", jasminURL);

  var self = this;

  QmlRun.run(null, {
    freeboxAddress : remoteAddress,
    url : jasminURL

  }, function(error, run) {
    if (error) {
      console.error(error);
      return;
    }

    debug("Jasmin is running", run);

    self._runningInstance = run;
    run.on('end', function() {
      debug("Jasmin has been terminated");

      if (self._runningInstance === run) {
        self._runningInstance = undefined;
      }
    });
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

  var httpAddress = this.configuration.httpAddress || ip.address();
  var httpPort = this.configuration.httpPort || 0;

  debug("Listen: address=", httpAddress, " port=", httpPort);

  server.listen(httpPort, httpAddress, function(error) {
    if (error) {
      console.error(error);
      return callback(error);
    }

    var locationURL = 'http://' + server.address().address + ':' +
        server.address().port + "/description.xml";

    debug("Listening : serverAddress=", server.address(), "locationURL=",
        locationURL);

    var uuid = self.configuration.uuid ||
        "27aaacec-e3e6-4962-bcbc-d0e23891bbcf"; // UUID.v4();
    this.uuid = uuid;

    var ssdConfig = {
      // logLevel : 'trace',
      // log : true,
      udn : "uuid:" + uuid,
      description : "/description.xml",
      location : locationURL,
      ssdpSig : "Node/" + process.versions.node + " UPnP/1.0 FreeboxJasmin/" +
          require("../package.json").version + " Jasmin/" +
          require(self._jasminPath + "/package.json").version
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
