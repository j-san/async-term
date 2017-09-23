#!/usr/bin/env node

var proc = require('child_process');
var path = require('path');
var electron = require('electron');

var args = [path.join(__dirname, '..')].concat(process.argv.slice(2));

var child = proc.spawn(electron, args, {stdio: 'inherit'});
child.on('close', function (code) {
    process.exit(code);
});
