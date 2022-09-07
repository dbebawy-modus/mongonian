#!/usr/bin/env node
const runCreator = require('@perigress/perigress/src/test-runner.js');
const Mongoish = require('../mongonian');
const path = require('path');

const format = new Mongoish();

let target = Array.prototype.slice.call(process.argv).pop();
if(target[0] !== '/'){ //if it's relative, lets append the current dir
	target = path.join(__dirname, target)
}

runCreator(target, format);