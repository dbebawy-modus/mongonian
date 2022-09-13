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

module.exports = {testAPI, rqst, hasConsistentObjectOfType, port, dir};