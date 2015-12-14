/*jslint node: true, vars: true, nomen: true */
'use strict';

var commander = require('commander');
var debug = require('debug')('freebox-jasmin:cli');
var Server = require('./lib/server');
var ClientsList = require('./lib/clientsList');

commander.version(require("./package.json").version);
commander.option("--jasminPath <path>", "Jasmin path");
commander.option("--httpPort <port>", "Http port", parseInt);
commander.option("--httpAddress <address>", "Http address");

commander.command('*').description("Run upnp jasmin server").action(
    function(programPath) {

      var clientsList = new ClientsList();

      var server = new Server(commander, clientsList);

      server.listen(function(error) {
        if (error) {
          console.error(error);
          return;
        }
      });
    });

commander.parse(process.argv);
