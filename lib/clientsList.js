var SSDP = require('node-ssdp');
var debug = require('debug')('freebox-jasmin:clientsList');
var URL = require('url');
var Util = require('util');

function ClientsList() {
  var client = new SSDP.Client();
  this.client = client;

  var self = this;
  client.on('response', function(headers, statusCode, rinfo) {
    self._processResponse(headers, statusCode, rinfo);
  });

  // search for a service type
  setInterval(function() {
    debug("Search for ContentDirectory");
    client.search('urn:schemas-upnp-org:service:ContentDirectory:1');

    var now = Date.now();
    for ( var key in self._list) {
      var server = self._list[key];
      if (server.date + 1000 * 60 > now) {
        continue;
      }

      debug("Timeout for server", server);
      delete self._list[key];
    }

  }, 1000 * 30);

  client.search('urn:schemas-upnp-org:service:ContentDirectory:1');

  this._list = {};
}

module.exports = ClientsList;

function unescape(t) {
  var lookup = {
    lt : "<",
    gt : ">",
    quot : '"',
    apos : "'",
    amp : "&"
  };

  if (!t)
    return t
  return t.replace(/&([a-z]+);/g, function(whole, match) {
    return lookup[match] || whole;
  });
};

ClientsList.prototype._processResponse = function(headers, statusCode, rinfo) {
  debug("Headers=", headers, "statusCode=", statusCode, "rinfo=", rinfo);

  if (headers.ST !== 'urn:schemas-upnp-org:service:ContentDirectory:1') {
    // return;
  }

  var host = headers.LOCATION;
  headers.date = Date.now();

  this._list[host] = headers;
};

ClientsList.prototype.list = function() {
  var ret = [];
  var list = this._list;
  for ( var k in list) {
    var server = list[k];
    ret.push(server);
  }

  debug("Return list ", ret);
  return ret;
};