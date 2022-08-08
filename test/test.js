const should = require('chai').should();
const Perigress = require('@perigress/perigress');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('postman-request');
const ks = require('kitchen-sync');
const Mongoish = require('../mongonian');

const port = 8080;
const method = 'POST';

/*
	The basic form of a test is:
	
	it('saves changes', (done)=>{
		testAPI('test-api-to-load', async (err, app, closeAPI, getValidator)=>{
			should.not.exist(err);
			try{
				// test here
			}catch(ex){
				should.not.exist(ex)
			}
			closeAPI(done);
		});
	});
*/

describe('perigress', ()=>{
	describe('Works with a simple API', ()=>{
		it('loads an API definition', (done)=>{
			const api = new Perigress.API({ subpath : 'api', dir: __dirname });
			api.ready.then(()=>{
				done();
			}).catch((ex)=>{
				should.not.exist(ex);
			});
		});

		it('runs the demo API and requests a consistent object', (done)=>{
			testAPI('api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let url = `http://localhost:${port}/v1/transaction/F74bf5aF-aB23-4FCa-BfC5-ebA5480FDf64`
					let firstRequest = await rqst({ url, method });
					let transaction = JSON.parse(firstRequest.body);
					let joiSchema = getValidator('transaction');
					let valid = joiSchema.validate(transaction);
					valid.value.id.should.equal('F74bf5aF-aB23-4FCa-BfC5-ebA5480FDf64');
					valid.value.cardId.should.equal('814Ad8D5-F14e-4F20-9862-8fF01Cd40567');
					valid.value.total.should.equal('5729438717.91');
					valid.value.currency.should.equal('USD');
					valid.value.externalTransactionId.should.equal('873-347-8319');
					valid.value.network.should.equal('VISA');
					(!!valid).should.equal(true);
					should.not.exist(valid.error);
					closeAPI(done);
				}catch(ex){
					console.log('EX', ex)
					should.not.exist(ex);
				}
			});
		});

	});
	
	describe('works using well-known-regex overlay', ()=>{
	
		it('runs the demo API and requests a consistent object', (done)=>{
			testAPI('wkr-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let fetched = await rqst({ url: `http://localhost:${port}/v1/user/1`, method });
					let user = JSON.parse(fetched.body);
					let joiSchema = getValidator('user');
					let valid = joiSchema.validate(user);
					(!!valid).should.equal(true);
					should.not.exist(valid.error);
					should.exist(user);
					should.exist(user.id);
					user.id.should.equal(1);
					user.firstName.should.equal('Sim');
					user.lastName.should.equal('Ruecker');
					user.email.should.equal('Jared_Franey19@gmail.com');
					user.phone.should.equal('520-674-9557');
					should.exist(user.birthday);
					let date = new Date(user.birthday);
					date.getFullYear().should.equal(1976);
				}catch(ex){
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
	
	});
	
	describe('works using a paging API', ()=>{
	
		it('runs the demo API and requests a consistent object', (done)=>{
			testAPI('paged-wkr-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let fetched = await rqst({ url: `http://localhost:${port}/v1/user/list`, method });
					let result = JSON.parse(fetched.body);
					let joiSchema = getValidator('user');
					should.exist(result);
					should.exist(result.status);
					result.status.toLowerCase().should.equal('success');
					should.exist(result.results);
					Array.isArray(result.results).should.equal(true);
					should.exist(result.results[0]);
					should.exist(result.results[0].id);
					should.exist(result.results[0].firstName);
					should.exist(result.results[0].lastName);
					should.exist(result.results[0].email);
					should.exist(result.results[0].phone);
					should.exist(result.results[0].birthday);
					result.results.forEach((res)=>{
						let valid = joiSchema.validate(res);
						(!!valid).should.equal(true);
						should.not.exist(valid.error);
					});
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
	
		it('saves changes', (done)=>{
			testAPI('paged-wkr-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let firstListRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, 
						json: true 
					});
					item = firstListRequest.body.results[0];
					item.firstName = 'Bob';
					let editRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/${item.id}/edit`, 
						method, 
						json: item 
					});
					let identityRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/${item.id}`, 
						method, 
						json: true 
					});
					identityRequest.body.firstName.should.equal('Bob');
					let secondListRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, 
						json: true 
					});
					secondListRequest.body.results[0].firstName.should.equal('Bob');
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
	
	});
	
	describe('works using a paging API with audit columns and custom FK (underscore) handling', ()=>{
		
		it('loads and fetches generated objects through links', function(done){
			this.timeout(20000);
			testAPI('audit-fk-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let listRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, json: { query: {},
							link: ['user+transaction']
						} 
					});
					should.exist(listRequest.body);
					should.exist(listRequest.body.results);
					should.exist(listRequest.body.results[0]);
					should.exist(listRequest.body.results[0].transaction_list);
					listRequest.body.results[0].transaction_list.length.should.be.above(0);
					let item = listRequest.body.results[0].transaction_list[0];
					//item.card_id.should.equal( 'ACBF68d9-4AEA-4dd5-Aa3B-AE5F1cb7b8ad');
					item.card_id = 'SOMETHING_ELSE';
					let editRequest = await rqst({
						url: `http://localhost:${port}/v1/transaction/${item.id}/edit`,
						method, json: item
					});
					let secondListRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, json: { query: {},
							link: ['user+transaction']
						} 
					});
					should.exist(secondListRequest);
					should.exist(secondListRequest.body.results);
					should.exist(secondListRequest.body.results[0]);
					should.exist(secondListRequest.body.results[0].transaction_list);
					should.exist(secondListRequest.body.results[0].transaction_list.length);
					secondListRequest.body.results[0].transaction_list.length.should.be.above(0);
					secondListRequest.body.results[0].transaction_list[0].card_id.should.equal( 'SOMETHING_ELSE');
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
		
		it('loads independent links', function(done){
			this.timeout(20000);
			testAPI('audit-fk-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let contracts = await rqst({ 
						url: `http://localhost:${port}/v1/contract/list`, 
						method, json: { query: {},
							internal: [
								'avatar_user_id',
								'creator_user_id'
							]
						} 
					});
					should.exist(contracts.body);
					should.exist(contracts.body.results);
					Array.isArray(contracts.body.results).should.equal(true);
					contracts.body.results.forEach((contract)=>{
						should.exist(contract.avatar_user);
						should.exist(contract.creator_user);
					});
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
		
		it('Loads and saves a complex object', function(done){
			this.timeout(20000);
			testAPI('audit-fk-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let listRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, json: { query: {},
							link: ['user+transaction']
						} 
					});
					should.exist(listRequest.body);
					should.exist(listRequest.body.results);
					should.exist(listRequest.body.results[0]);
					let loadedUser = listRequest.body.results[0];
					should.exist(listRequest.body.results[0].transaction_list);
					listRequest.body.results[0].transaction_list.length.should.be.above(0);
					listRequest.body.results[0].transaction_list.push({
					  card_id: 'SOME_OTHER_THING',
					  total: '5894.21',
					  currency: 'USD',
					  externalTransactionId: '021-661-5622',
					  network: 'CHASE',
					  updatedBy: -73800000,
					  modifiedBy: 56200000,
					  isDeleted: false
					})
					let mutatedItem = listRequest.body.results[0].transaction_list[0];
					mutatedItem.card_id.should.equal( '23A81f36-78Fe-4Cd6-8B5F-66EAcD4cE1fB');
					mutatedItem.card_id = 'SOMETHING_ELSE';
					let saveRequest = await rqst({
						url: `http://localhost:${port}/v1/user/save`,
						method: 'POST',
						json: {
							objects: [loadedUser],
							link: ['user+transaction']
						}
					});
					let changedRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/list`, 
						method, json: { query: {},
							link: ['user+transaction']
						} 
					});
					should.exist(changedRequest.body);
					should.exist(changedRequest.body.results);
					should.exist(changedRequest.body.results[0]);
					let user = changedRequest.body.results[0];
					should.exist(user.transaction_list);
					user.transaction_list.length.should.be.above(1);
					let item = changedRequest.body.results[0].transaction_list.filter(
						(transaction)=>{
							return transaction.id === 62000000;
						}
					)[0]
					item.card_id.should.equal( 'SOMETHING_ELSE');
					let item2 = changedRequest.body.results[0].transaction_list.filter(
						(transaction)=>{
							return transaction.id !== 62000000;
						}
					)[0]
					item2.card_id.should.equal( 'SOME_OTHER_THING');
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
		
		it('can list objects it has saved consistently', function(done){
			this.timeout(20000);
			testAPI('paged-wkr-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					await hasConsistentObjectOfType(port, 'user', 23872837, 'firstName', 'Bob');
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
		
		it('returns a consistent type', function(done){
			this.timeout(20000);
			testAPI('paged-wkr-api', async (err, app, closeAPI, getValidator)=>{
				should.not.exist(err);
				try{
					let saveedRequest = await rqst({ 
						url: `http://localhost:${port}/v1/user/create`,
						method,
						json: {
							firstName: 'Ed',
							lastName: "Beggler",
							email: 'robble@rauser.com',
							phone: '404-555-4202',
							updatedBy: 0234,
							modifiedBy: 5555,
							birthday: '1956-10-29T00:00:00.0Z',
							updatedOn: '2015-04-23T06:00:00.0Z',
							isDeleted: false,
							modifiedOn: '1993-03-24T07:00:00.0Z'
						}
					});
					let selectedRequest = await rqst({
						url: `http://localhost:${port}/v1/user/list`,
						method,
						json: {
							includeSaved: true,
							query: { lastName: 'Beggler'}
						}
					});
					should.exist(selectedRequest.body);
					should.exist(selectedRequest.body.results);
					should.exist(selectedRequest.body.results[0]);
					selectedRequest.body.results[0].firstName.should.equal('Ed');
				}catch(ex){
					console.log(ex);
					should.not.exist(ex)
				}
				closeAPI(done);
			});
		});
		
	});
	
	describe('fetches internally', ()=>{
		
		it('runs the demo API and requests a consistent list', (done)=>{
			const api = new Perigress.DummyAPI({
				subpath : 'paged-wkr-api',
				dir: __dirname
			}, new Mongoish());
			api.attach(null, ()=>{
				api.internal('user', 'list', {}, (err, results)=>{
					let joiSchema = require(path.join(
						__dirname, 'paged-wkr-api', 'v1', 'user.spec.js'
					));
					should.exist(results);
					Array.isArray(results).should.equal(true);
					should.exist(results[0]);
					should.exist(results[0].id);
					should.exist(results[0].firstName);
					should.exist(results[0].lastName);
					should.exist(results[0].email);
					should.exist(results[0].phone);
					should.exist(results[0].birthday);
					results.forEach((res)=>{
						let valid = joiSchema.validate(res);
						(!!valid).should.equal(true);
						should.not.exist(valid.error);
					});
					done();
				});
			});
		});
		
		it('runs the demo API and requests a consistent object', async ()=>{
			try{
				const api = new Perigress.DummyAPI({
					subpath : 'wkr-api',
					dir: __dirname
				}, new Mongoish());
				api.attach(null, async ()=>{
					let joiSchema = require(path.join(
						__dirname, 'paged-wkr-api', 'v1', 'user.spec.js'
					));
					let user = await api.internal('user', 'read', { id : 1 });
					should.exist(user);
					let valid = joiSchema.validate(user);
					(!!valid).should.equal(true);
					user.id.should.equal(1);
					user.firstName.should.equal('Elizabeth');
					user.lastName.should.equal('Zulauf');
					user.email.should.equal('Zion.Reichel12@yahoo.com');
					user.phone.should.equal('520-674-9557');
				});
			}catch(ex){
				console.log(ex)
				should.not.exist(ex);
			}
		});
		
		it('saves changes', (done)=>{
			try{
				const api = new Perigress.DummyAPI({
					subpath : 'wkr-api',
					dir: __dirname
				}, new Mongoish());
				api.attach(null, ()=>{
					api.internal('user', 'list', {}, (err, users)=>{
						let item = users[0];
						item.firstName = 'Bob';
						api.internal('user', 'update', { 
							id : item.id, 
							body: item 
						}, (err, savedUser)=>{
							should.exist(savedUser);
							api.internal('user', 'read', { id : item.id}, (err, user)=>{
								user.firstName.should.equal('Bob');
								done();
							});
						});
					});
				});
			}catch(ex){
				console.log(ex)
				should.not.exist(ex);
			}
		});
		
	});

});

// UTIL

const testAPI = (p, cb)=>{
	const app = express();
	app.use(bodyParser.json({strict: false}));
	const api = new Perigress.API({
		subpath : p,
		dir: __dirname
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
						__dirname, p, 'v1', type+'.spec.js'
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
		request(opts, (err, res, body)=>{
			if(err) reject(err);
			else resolve({res, body});
		})
	});
}

const hasConsistentObjectOfType = (port, type, id, field, value, cb)=>{
	let callback = ks(cb);
	let joiSchema = require(path.join(
		__dirname, 'audit-fk-api', 'v1', type+'.spec.js'
	));
	request({
		url: `http://localhost:${port}/v1/${type}/${id}`,
		method: 'POST',
		json: true
	}, (err, res, result)=>{
		should.not.exist(err);
		request({
			url: `http://localhost:${port}/v1/${type}/${id}/edit`,
			method: 'POST',
			json: {
				firstName: 'Bob'
			}
		}, (editErr, editRes, editResult)=>{
			should.not.exist(editErr);
			request({
				url: `http://localhost:${port}/v1/${type}/${id}`,
				method: 'POST',
				json: true
			}, (secondErr, secondRes, secondResult)=>{
				should.not.exist(secondErr);
				Object.keys(result).should.deep.equal(Object.keys(secondResult))
				callback(null, true);
			});
		});
	});
	return callback.return;
};
