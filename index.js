/*jslint node: true, vars: true, nomen: true */
'use strict';

var commander = require('commander');
var debug = require('debug')('freebox-qml-run:cli');
var freebox = require('freebox-qml-run');
var ip = require('ip');
var Server = require('./lib/server');

commander.version(require("./package.json").version);

commander.option("--host <host>", "Freebox host");
commander.option("--searchTimeout <milliseconds>",
    "Freebox search timout in milliseconds", parseInt);

commander.command('run').description("Run upnp jasmin server").action(
    function(programPath) {
      var server = new Server(commander);

      server.listen(function(error) {
        if (error) {
          console.error(error);
          return;
        }
      });
    });

commander.parse(process.argv);
