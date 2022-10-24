const express = require('express');
const bodyParser = require('body-parser');
const Perigress = require('@perigress/perigress');
const Mongoish = require('../mongonian');
const path = require('path');
const ks = require('kitchen-sync');

const port = 8080;
const dir = __dirname;
const testAPI = (p, cb)=>{
	const app = express();
	app.use(bodyParser.json({strict: false}));
	const api = new Perigress.API({
		subpath : p,
		dir: module.exports.dir
	}, new Mongoish());
	api.ready.then(()=>{
		api.attach(app, ()=>{
			const server = app.listen(port, ()=>{
				cb(null, app, (cb)=>{
					server.close(()=>{
						cb();
					});
				}, (type)=>{
					let joiSchema = require(path.join(
						module.exports.dir, p, 'v1', type+'.spec.js'
					));
					return joiSchema;
				})
			});
		});
	}).catch((ex)=>{
		should.not.exist(ex);
	});;
};

const rqst = (opts)=>{
	return new Promise((resolve, reject)=>{
		module.exports.request(opts, (err, res, body)=>{
			if(err) reject(err);
			else resolve({res, body});
		})
	});
}

const hasConsistentObjectOfType = (port, type, id, field, value, cb)=>{
	let callback = ks(cb);
	let joiSchema = require(path.join(
		module.exports.dir, 'audit-fk-api', 'v1', type+'.spec.js'
	));
	module.exports.request({
		url: `http://localhost:${module.exports.port}/v1/${type}/${id}`,
		method: 'POST',
		json: true
	}, (err, res, result)=>{
		(null === err).should.equal(true);
		module.exports.request({
			url: `http://localhost:${module.exports.port}/v1/${type}/${id}/edit`,
			method: 'POST',
			json: {
				firstName: 'Bob'
			}
		}, (editErr, editRes, editResult)=>{
			(null === editErr).should.equal(true);
			module.exports.request({
				url: `http://localhost:${module.exports.port}/v1/${type}/${id}`,
				method: 'POST',
				json: true
			}, (secondErr, secondRes, secondResult)=>{
				(null === secondErr).should.equal(true);
				Object.keys(result).should.deep.equal(Object.keys(secondResult))
				callback(null, true);
			});
		});
	});
	return callback.return;
};

const passthruAPIFromLookup = (basePort, baseDir, apiType, lookup, cb)=>{
	const app = express();
	const port = basePort;
	const backendPort = basePort + 1;
	
	app.use(bodyParser.json({strict: false}));
	// A replication of the internal lookup;
	let api;
	api = new Perigress.DummyAPI({
		subpath: apiType,
		dir: baseDir
	}, new Mongoish(), { lookup });
	api.doNotSeedLists = true;
	//const lookup = lookupGenerator(api);
	
	const backendApp = express();
	backendApp.use(bodyParser.json({strict: false}));
	const backendApi = new Perigress.DummyAPI({
		subpath : apiType,
		dir: baseDir
	}, new Mongoish());
	api.attach(app, ()=>{
		backendApi.attach(backendApp, ()=>{
			const server = app.listen(port, async (err)=>{
				const backendServer = backendApp.listen(backendPort, async (err2)=>{
					cb((err||err2), server, backendServer);
				});
			});
		});
	});
	return api
};

module.exports = {testAPI, passthruAPIFromLookup, rqst, hasConsistentObjectOfType, port, dir};