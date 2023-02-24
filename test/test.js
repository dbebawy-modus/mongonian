const should = require('chai').should();
const Perigress = require('@perigress/perigress');
const Tests = require('@perigress/perigress/test/util.js');
const path = require('path');
const arrays = require('async-arrays');
const express = require('express');
const request = require('postman-request');
const ks = require('kitchen-sync');
const Mongoish = require('../mongonian');
const util = require('../test-util.js');
const { makeLookup } = require('../util');
const {testAPI, rqst, hasConsistentObjectOfType, passthruAPIFromLookup} = util;
util.dir = __dirname;
util.request = request;

const port = 8080;
const method = 'POST';

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
                    user.email.should.equal('Jaren_Franecki19@gmail.com');
                    user.phone.should.equal('520-674-9557');
                    should.exist(user.birthday);
                    let date = new Date(user.birthday);
                    date.getFullYear().should.equal(1976);
                }catch(ex){
                    should.not.exist(ex)
                    console.log("ex");
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
                    mutatedItem.card_id.should.equal('23A81f36-78Fe-4Cd6-8B5F-66EAcD4cE1fB');
                    mutatedItem.card_id = 'SOMETHING_ELSE';
                    let saveRequest = await rqst({
                        url: `http://localhost:${port}/v1/user/save`,
                        method: 'POST',
                        json: {
                            objects: [loadedUser],
                            link: ['user+transaction']
                        }
                    });
                    //console.log('>>>>', loadedUser, saveRequest.body);
                    //process.exit();
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
                    //console.log(user.transaction_list);
                    //process.exit();
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

        it('Can transfer header information on nested save', function(done){
            this.timeout(20000);
            testAPI('audit-fk-api', async (err, app, closeAPI, getValidator, api)=>{
                const endpoint = api.getInstance('user');
                const seenHeaders = [];
                endpoint.monitor = (options)=>{
                    seenHeaders.push(options?.req?.headers);
                };
                endpoint.save = (options, cb) => {
                    const {ob: calledEndpoint, identifier, type: saveType, item, req} = options;
                    const targetEndpoint = calledEndpoint.api.getInstance(saveType);
                    if(targetEndpoint.monitor) targetEndpoint.monitor(options, 'create');
                    if (!item[identifier]) {
                        targetEndpoint.create({req, body: item}, (err, resultingItem) => {
                            cb(err, resultingItem);
                        });
                    } else {
                        targetEndpoint.update({req, body: item }, (err, resultingItem) => {
                            cb(err, resultingItem);
                        });
                    }
                };
                should.not.exist(err);
                let tokenValue = "some-token-value"
                try{
                    let saveRequest = await rqst({
                        url: `http://localhost:${port}/v1/user/save`,
                        method: 'POST',
                        json: {
                            objects: [{
                                card_id: 'SOME_OTHER_THING',
                                total: '5894.21',
                                currency: 'USD',
                                externalTransactionId: '021-661-5622',
                                network: 'CHASE',
                                updatedBy: -73800000,
                                modifiedBy: 56200000,
                                isDeleted: false
                            }],
                        },
                        headers: {
                            cookie: `token=${tokenValue}`
                        }
                    });
                    seenHeaders.length.should.be.above(0);
                    const aHeader = seenHeaders[0];
                    should.exist(aHeader);
                    seenHeaders.forEach((headers)=>{
                        headers.should.deep.equal(aHeader);
                    });
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
                    let savedRequest = await rqst({
                        url: `http://localhost:${port}/v1/user/create`,
                        method,
                        json: {
                            firstName: 'Ed',
                            lastName: 'Beggler',
                            email: 'robble@rauser.com',
                            phone: '404-555-4202',
                            updatedBy: 234,
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

        it('saves changes + deletes', (done)=>{
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
                                api.internal('user', 'delete', { id : item.id}, (err, result)=>{
                                    api.internal('user', 'read', { id : item.id}, (err, user)=>{
                                        should.not.exist(err);
                                        should.not.exist(user);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            }catch(ex){
                console.log(ex)
                should.not.exist(ex);
            }
        });

        it('saves changes + does not return the generated copy', (done)=>{
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
                                api.internal('user', 'list', { query:{id : item.id}}, (err, userLists)=>{
                                    should.exist(userLists);
                                    Array.isArray(userLists).should.equal(true);
                                    userLists.length.should.equal(1);
                                    done();
                                });
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
    // Disable the following block for vanilla mocha compatibility
    //*
    if(global.perigressAPI){ //this is set if called with test-runner
        Tests.generateAllEndpointTestsFromAPI(perigressAPI, (endpoint, api)=>{
            it(endpoint.options.name+' passes an extra test', (finish)=>{
                finish();
            });
        }, 'test/api', new Mongoish());
    }else{
        describe('[API SUITE]', ()=>{ it('were the tests run directly with mocha?') });
    }

    describe('optional endpoints', ()=>{

        it('can perform aggregations', (done)=>{
            try{
                const app = express();
                app.use(express.json({strict: false}));
                const api = new Perigress.DummyAPI({
                    subpath : 'audit-fk-api',
                    dir: __dirname
                }, new Mongoish({
                    aggregation: true
                }));
                api.attach(app, ()=>{
                    const server = app.listen(port, async (err)=>{
                        let listRequest = await rqst({
                            url: `http://localhost:${port}/v1/transaction/aggregation`,
                            method, json: {
                                query: {},
                                group: {
                                    _id: "card_id",
                                    sumTotal: {$sum: "$total"},
                                    countTotal: {$count: "$total"}
                                }
                            }
                        });
                        listRequest.body.result.length.should.equal(20);
                        server.close(()=>{
                            done();
                        });
                    });
                });
            }catch(ex){
                console.log(ex)
                should.not.exist(ex);
            }
        });

        it('aggregation should forward request to lookup hook', (done)=>{
            try{
                const app = express();
                app.use(express.json({strict: false}));
                const api = new Perigress.DummyAPI({
                    subpath : 'audit-fk-api',
                    dir: __dirname
                }, new Mongoish({
                    aggregation: true
                }));
                api.actions.lookup = (type, context, req, cb, config) => {
                    should.exist(req);
                    let primaryKey = config.primaryKey || 'id';
                    let identifier = 'id';
                    let endpoint = api.endpoints.find((e)=>{
                        return e.options.name === type
                    });
                    let lookup = makeLookup(endpoint, primaryKey, identifier);
                    return lookup(type, context, req, cb, config);
                }
                api.attach(app, ()=>{
                    const server = app.listen(port, async (err)=>{
                        let listRequest = await rqst({
                            url: `http://localhost:${port}/v1/transaction/aggregation`,
                            method, json: {
                                query: {},
                                group: {
                                    _id: "card_id",
                                    sumTotal: {$sum: "$total"},
                                    countTotal: {$count: "$total"}
                                }
                            }
                        });
                        listRequest.body.result.length.should.equal(20);
                        server.close(()=>{
                            done();
                        });
                    });
                });
            }catch(ex){
                console.log(ex)
                should.not.exist(ex);
            }
        });

        it('can perform wildcard searches', (done)=>{
            try{
                const app = express();
                app.use(express.json({strict: false}));
                const api = new Perigress.DummyAPI({
                    subpath : 'audit-fk-api',
                    dir: __dirname
                }, new Mongoish({
                    search: true
                }));
                api.attach(app, ()=>{
                    const server = app.listen(port, async (err)=>{
                        request({
                            url: `http://localhost:${port}/v1/transaction/search`,
                            method, json: {
                                query: {
                                    total: {$eq:32.29177}
                                },
                                wildcard: {
                                    query: "CHA*",
                                    path: "network"
                                }
                            }
                        }, (err, res, response)=>{
                            should.not.exist(err);
                            should.exist(response);
                            should.not.exist(response.error);
                            should.exist(response.result);
                            should.exist(response.result.length);
                            response.result.length.should.be.above(0);
                            server.close(()=>{
                                done();
                            });
                        });
                    });
                });
            }catch(ex){
                console.log(ex)
                should.not.exist(ex);
                server.close(()=>{
                    done();
                });
            }
        });

    });

    describe('pluggable logic', ()=>{

        it('runs a custom lookup that dumps static objects', (done)=>{
            const app = express();
            app.use(express.json({strict: false}));
            // A replication of the internal lookup;
            let lookupCounter = 0;
            let deleteCounter = 0;
            const lookup = (type, context, req, cb)=>{
                let endpoint = api.getInstance(type);
                let id = endpoint.options.identifier || 'id';
                lookupCounter++;
                if(Array.isArray(context)){
                    let results = context.slice();
                    arrays.forEachEmission(results, (id, index, done)=>{
                        lookup(type, id, req, (err, item)=>{
                            results[index] = item[0];
                            done();
                        });
                    }, ()=>{
                        cb(null, results);
                    });
                }else{
                    let setContext = context;
                    if(
                        Object.keys(setContext).length === 1 &&
                        setContext[id]
                    ){
                        setContext = setContext[id];
                    }
                    if(setContext['$in'] && setContext['$in'].length === 1){
                        setContext = setContext['$in'][0];
                    }
                    let formalContext = (typeof context !== 'object')?{id:context}:context;
                    setTimeout(()=>{
                        let set = [{
                            id: setContext,
                            static: "object",
                            some: "field"
                        }].concat(endpoint.instances).filter(api.sift(formalContext));
                        cb(null, set);
                    })
                }
            };
            const api = new Perigress.DummyAPI({
                subpath : 'audit-fk-api',
                dir: __dirname
            }, new Mongoish(), { lookup });
            api.attach(app, ()=>{
                let endpoint = api.getInstance('user');
                endpoint.delete = (o, cb)=>{
                    deleteCounter++;
                    cb()
                }
                const server = app.listen(8081, async (err)=>{
                    let listRequest = await rqst({
                        url: `http://localhost:8081/v1/user/list`,
                        method, json: { query: {},
                            link: ['user+transaction']
                        }
                    });
                    let deleteRequest = await rqst({
                        url: `http://localhost:8081/v1/user/foo/delete`,
                        method, json: {}
                    });
                    lookupCounter.should.be.above(0);
                    deleteCounter.should.be.above(0);
                    server.close(()=>{
                        done();
                    });
                });
            });
        });

        it('runs a custom lookup as a passthrough', function(done){
            this.timeout(10000);
            let lookupCounter = 0;
            let contexts = [];
            let api = passthruAPIFromLookup(8081, __dirname, 'audit-fk-api', (type, context, req, cb)=>{
                try{
                    let endpoint = api.getInstance(type);
                    let localIdentifier = endpoint.options.identifier||'id';
                    let outboundContext = context;
                    if(Array.isArray(context)){
                        let ctx = {};
                        ctx[localIdentifier] = {$in: context};
                        outboundContext = ctx;
                    }
                    contexts.push(outboundContext);
                    request({
                        url: `http://localhost:8082/v1/${type}/list`,
                        method,
                        json: {
                            query: outboundContext,
                            generate: req.body.generate, // passthru
                            saveGenerated: req.body.saveGenerated // passthru
                        }
                    }, (err, res, results)=>{
                        cb(err, results.results);
                    });
                }catch(ex){ console.log(ex); should.not.exist(ex) }
            }, async (err, server, backendServer)=>{
                let listRequest = await rqst({
                    url: `http://localhost:8081/v1/user/list`,
                    method, json: { query: {},
                        link: [
                            'user+transaction',
                        ],
                        generate: 1,
                        saveGenerated: true
                    }
                });
                try{
                    contexts.length.should.equal(3);
                    should.exist(contexts[1].user_id);
                    Array.isArray(contexts[1].user_id['$in']).should.equal(true);
                    contexts[1].user_id['$in'].length.should.equal(
                        listRequest.body.results.length
                    );
                    should.exist(contexts[2].id);
                    Array.isArray(contexts[2].id['$in']).should.equal(true);
                    server.close(()=>{
                        backendServer.close(()=>{
                            done();
                        });
                    });
                }catch(ex){
                    should.not.exist(ex);
                }
            });
        });

        it('can push custom page data from a lookup configured as a passthru', function(done){
            this.timeout(10000);
            let lookupCounter = 0;
            let contexts = [];
            let api = passthruAPIFromLookup(8081, __dirname, 'audit-fk-api', (type, context, req, cb)=>{
                try{
                    let endpoint = api.getInstance(type);
                    let localIdentifier = endpoint.options.identifier||'id';
                    let outboundContext = context;
                    if(Array.isArray(context)){
                        let ctx = {};
                        ctx[localIdentifier] = {$in: context};
                        outboundContext = ctx;
                    }
                    contexts.push(outboundContext);
                    request({
                        url: `http://localhost:8082/v1/${type}/list`,
                        method,
                        json: {
                            query: outboundContext,
                            generate: req.body.generate, // passthru
                            saveGenerated: req.body.saveGenerated // passthru
                        }
                    }, (err, res, results)=>{
                        cb(err, results.results, {page:{total: 230}});
                    });
                }catch(ex){ console.log(ex); should.not.exist(ex) }
            }, async (err, server, backendServer)=>{
                let listRequest = await rqst({
                    url: `http://localhost:8081/v1/user/list`,
                    method, json: { query: {},
                        link: [
                            'user+transaction',
                        ],
                        generate: 1,
                        saveGenerated: true
                    }
                });
                try{
                    should.exist(listRequest.body.total);
                    listRequest.body.total.should.equal(230);
                    contexts.length.should.equal(3);
                    should.exist(contexts[1].user_id);
                    Array.isArray(contexts[1].user_id['$in']).should.equal(true);
                    contexts[1].user_id['$in'].length.should.equal(
                        listRequest.body.results.length
                    );
                    should.exist(contexts[2].id);
                    Array.isArray(contexts[2].id['$in']).should.equal(true);
                    //*
                    server.close(()=>{
                        backendServer.close(()=>{
                            done();
                        });
                    }); // */
                    //done();
                }catch(ex){
                    should.not.exist(ex);
                }
            });
        });
    });

});
