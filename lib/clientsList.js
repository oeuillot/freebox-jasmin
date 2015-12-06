var SSDP = require('node-ssdp');
var debug = require('debug')('freebox-jasmin:clientsList');
var request = require('request');
var URL = require('url');

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
    return;
  }

  var host = headers.LOCATION;
  headers.date = Date.now();

  request({
    url : headers.LOCATION

  }, function(error, response, body) {
    //console.log("body=", body, headers);

    var reg = /<friendlyName>([^<]*)<\/friendlyName>/i.exec(body);
    if (reg) {
      headers.name = unescape(reg[1]);
    }

    var r = /<icon>(.*)<\/icon>/img;
    for (;;) {
      reg = r.exec(body);

      if (!reg) {
        break;
      }

      var iconBody = reg[1];

      w = /<width>([^<]*)<\/width>/i.exec(iconBody);
      h = /<height>([^<]*)<\/height>/i.exec(iconBody);
      url = /<url>([^<]*)<\/url>/i.exec(iconBody);
      if (!url) {
        continue;
      }

      var k = "iconURL";
      if (w && h) {
        k += "-" + w[1].trim() + "x" + h[1].trim();
      }
      headers[k] = URL.resolve(host, url[1].trim());
    }

    debug("Headers=", headers);

  });

  this._list[host] = headers;
};

ClientsList.prototype.list = function() {
  var ret = [];
  var list = this._list;
  for ( var k in list) {
    var server = list[k];
    if (!server.name) {
      continue;
    }
    ret.push(server);
  }

  debug("Return list ", ret);
  return ret;
};