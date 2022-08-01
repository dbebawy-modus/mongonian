const peri = '@perigress/perigress';
//const peri = 'perigress';
const OutputFormat = require(peri+'/src/output-format.js');
const template = require('es6-template-strings');
//const jsonSchemaFaker = require('json-schema-faker');
//const Pop = require('tree-pop');
const arrays = require('async-arrays');
const access = require('object-accessor');
const validate = require('jsonschema').validate;
//const sift = require('sift').default;
const ks = require('kitchen-sync');
const {
	stringsToStructs, 
	copyJSON, 
	handleList, 
	getExpansions, 
	makeLookup, 
	handleBatch, 
	handleListPage
} = require('./util.js');

const QueryDocumentSchema = {
	type: 'object',
	description: 'Any listing can be arbitrarily filtered using <a href="https://www.mongodb.com/docs/manual/core/document/#std-label-document-query-filter">Mongo Query Document Filters</a>',
	additionalProperties: {
		type: 'object',
		properties: {
			"$in": {type:'array', required:false},
			"$nin": {type:'array', required:false},
			"$exists": {type:'boolean', required:false},
			"$gte": {type:'number', required:false},
			"$gt": {type:'number', required:false},
			"$lte": {type:'number', required:false},
			"$lt": {type:'number', required:false},
			"$eq": { required:false},
			"$ne": { required:false},
			"$mod": {type:'array', required:false},
			"$all": {type:'array', required:false},
			"$and": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$or": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$nor": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$not": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$size": {type:'integer', required:false},
			"$type": {type:'object', required:false},
			"$lt": {type:'number', required:false},
			"$elemMatch": {type:'object', required:false}
		}
	}
};

const Mongonian = OutputFormat.extend({
	mutateEndpoint : function(endpoint){
		endpoint.list = function(options, cb){
			let callback = ks(cb);
			try{
			handleList(
				this, 
				(options.pageNumber?parseInt(options.pageNumber):1), 
				`js://${this.options.name}/`, 
				this.instances, 
				options, 
				(err, returnValue, set, len, write)=>{
					callback(null, set);
				}
			);
		}catch(ex){
			console.log(ex);
		}
			return callback.return;
		}
		
		endpoint.batch = function(options, tree, cb){
			let callback = ks(cb);
			try{
				handleBatch(
					this, 
					(options.pageNumber?parseInt(options.pageNumber):1), 
					`js://${this.options.name}/`, 
					this.instances, 
					options, 
					(err, returnValue, set, len, write)=>{
						callback(null, set);
					}
				);
			}catch(ex){
				console.log(ex);
			}
			return callback.return;
		}
		
		endpoint.create = function(options, cb){
			let callback = ks(cb);
			if(validate(options.body, this.originalSchema)){
				this.instances[options.body[primaryKey]] = options.body;
				callback(null, options.body);
			}else{
				callback(new Error("the provided data was not valid"));
			}
			return callback.return;
		}
		
		endpoint.read = function(options, cb){
			let callback = ks(cb);
			let config = this.config();
			let primaryKey = config.primaryKey || 'id';
			if(this.instances[options[primaryKey]]){
				callback(null, this.instances[options[primaryKey]])
			}else{
				this.generate(options[primaryKey], (err, generated)=>{
					callback(null, generated)
				});
			}
			return callback.return;
		}
		
		endpoint.update = function(options, cb){
			let callback = ks(cb);
			let config = this.config();
			let primaryKey = config.primaryKey || 'id';
			endpoint.getInstance(options[primaryKey], (err, item)=>{
				if(options.body && typeof options.body === 'object'){
					Object.keys(options.body).forEach((key)=>{
						item[key] = options.body[key];
					});
					//item is now the set of values to save
					if(validate(item, this.originalSchema)){
						this.instances[options[primaryKey]] = item;
						callback(null, item);
					}else{
						//fail
						callback(new Error('Failed to update item'))
					}
				}else{
					//fail
					callback(new Error('Failed to update item'))
				}
			})
			return callback.return;
		}
		
		endpoint.delete = function(options, cb){
			let callback = ks(cb);
			
			return callback.return;
		}
	},
	attachRoot : function(expressInstance, endpoint, {
		prefix, 
		urlPath, 
		config, 
		errorConfig, 
		primaryKey,
		resultSpec,
		cleaned,
		readOnly,
		pathOptions
	}){
		
	},
	attachEndpoint : function(expressInstance, endpoint, {
			prefix, 
			urlPath, 
			config, 
			errorConfig, 
			primaryKey,
			resultSpec,
			cleaned,
			readOnly,
			pathOptions
		}){
			
		let urls = {
			list : template(
				(
					(config.paths && config.paths.list) ||
					'${basePath}/list'
				),
				pathOptions
			),
			save : template(
				(
					(config.paths && config.paths.save) ||
					'${basePath}/save'
				),
				pathOptions
			),
			listPage : template(
				(
					(config.paths && config.paths.listPage) ||
					'${basePath}/list/:pageNumber'
				),
				pathOptions
			),
			create : template(
				(
					(config.paths && config.paths.create) ||
					'${basePath}/create'
				),
				pathOptions
			),
			edit : template(
				(
					(config.paths && config.paths.edit) ||
					'${basePath}/:${primaryKey}/edit'
				),
				pathOptions
			),
			display : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/:${primaryKey}'
				),
				pathOptions
			),
			listSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/list-schema.json'
				),
				pathOptions
			),
			itemSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/display-schema.json'
				),
				pathOptions
			),
			createSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/create-schema.json'
				),
				pathOptions
			),
			editSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/edit-schema.json'
				),
				pathOptions
			)
		};
			
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.list, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleListPage(endpoint, 1, req, res, urlPath, endpoint.instances, options);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.save, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleBatch(endpoint, 1, req, res, urlPath, endpoint.instances, options, true);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.listPage, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleListPage(endpoint, parseInt(req.params.pageNumber), req, res, urlPath, endpoint.instances, options);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.create, (req, res)=>{
			if(validate(req.body, endpoint.originalSchema)){
				let item = req.body;
				if(!item[primaryKey]) item[primaryKey] = Math.floor(Math.random()* 1000000000)
				endpoint.instances[item[primaryKey]] = item;
				endpoint.returnContent(res, {success: true, result: item}, errorConfig, config);
			}else{
				res.send('{"error":true, "message":"the provided data was not valid"}')
			}
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.edit, (req, res)=>{
			endpoint.getInstance(req.params[primaryKey], (err, item)=>{
				if(req.body && typeof req.body === 'object'){
					Object.keys(req.body).forEach((key)=>{
						item[key] = req.body[key];
					});
					//item is now the set of values to save
					if(validate(item, endpoint.originalSchema)){
						endpoint.instances[req.params[primaryKey]] = item;
						endpoint.returnContent(res, {success:true}, errorConfig, config);
					}else{
						//fail
						console.log('**')
					}
				}else{
					//fail
					console.log('*', req.body, req)
				}
			})
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.display, (req, res)=>{
			let config = endpoint.config();
			let primaryKey = config.primaryKey || 'id';
			if(endpoint.instances[req.params[primaryKey]]){
				res.send(JSON.stringify(endpoint.instances[req.params[primaryKey]], null, '    '))
			}else{
				endpoint.generate(req.params[primaryKey], (err, generated)=>{
					res.send(JSON.stringify(generated, null, '    '))
				});
			}
		});
	},
	attachSpec : function(){
		
	},
	attachEndpointSpec : function(){
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.listSchema, (req, res)=>{
			let cleanedCopy = JSON.parse(JSON.stringify(cleaned));
			if(cleanedCopy.properties && cleanedCopy.properties.results){
				cleanedCopy.properties.results.items = this.schema;
			}
			
			jsonSchemaFaker.resolve(cleaned, [], process.cwd()).then((exampleReturn)=>{
				this.generate(1, (err, generated)=>{
					exampleReturn.results = [generated];
					res.send(JSON.stringify({
						post:{
							summary: template('Request a list of ${objectName}s', opts ),
							description: template('Request a list of ${objectName}s with an optional filter and the ability to bind subobjects together into trees.', opts),
							requestBody: {
								required: false,
								content: {
									'application/json' : {
										schema : {
											type: "object",
											properties: {
												query : { $ref:'#/components/schemas/QueryDocumentFilter' },
												link: {type: "array", required: false, items:{ type: "string" }}
											}
										}
									}
								}
							},
							parameters:{
								
							},
							responses:{
								'200': {
									description: template('The ${objectName} that was saved.', opts ),
									content: {
										'application/json' : {
											schema : cleanedCopy,
											example: exampleReturn
										}
									}
								}
							}
						},
						components: {
							schemas: { QueryDocumentFilter : QueryDocumentSchema }
						}
					}));
				});
			}).catch((ex)=>{
				console.log(ex);
			});
			
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.itemSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				res.send(JSON.stringify({
					post:{
						summary: template('Request a single ${objectName}', opts ),
						description: template('Request a single ${objectName}, by it\'s id', opts),
						parameters:[
							{
								name: 'id',
								in: 'path',
								required: true,
								description: template('The id of the ${objectName}', opts),
								schema:{
									type : 'integer',
									format: 'int64',
									minimum: 1
								}
							}
						],
						responses:{
							'200': {
								description: template('The requested ${objectName}.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example: generated
									}
								}
							}
						}
					}
				}));
			});
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.editSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				let writable = {};
				Object.keys(generated).forEach((key)=>{
					if(readOnly.indexOf(key) === -1 ) writable[key] = generated[key];
				});
				res.send(JSON.stringify({
					post:{
						summary: template('Save an existing ${objectName}', opts ),
						description: template('Update an instance of ${objectName} with new values', opts),
						parameters:[
							{
								name: 'id',
								in: 'path',
								required: true,
								description: template('The id of the ${objectName}', opts),
								schema:{
									type : 'integer',
									format: 'int64',
									minimum: 1
								}
							}
						],
						requestBody: {
							required: true,
							content: {
								'application/json' : {
									schema : this.schema,
									example: writable
								}
							}
						},
						responses:{
							'200': {
								description: template('The ${objectName} that was saved.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example : generated
									}
								}
							}
						}
					}
				}))
			});
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.createSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				let writable = {};
				Object.keys(generated).forEach((key)=>{
					if(readOnly.indexOf(key) === -1 ) writable[key] = generated[key];
				});
				res.send(JSON.stringify({
					post:{
						summary: template('Save a new ${objectName}', opts ),
						description: template('Save a new instance of ${objectName}', opts),
						parameters:[],
						requestBody: {
							required: true,
							content: {
								'application/json' : {
									schema : this.schema,
									example: writable
								}
							}
						},
						responses:{
							'200': {
								description: template('The ${objectName} that was saved.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example : generated
									}
								}
							}
						}
					}
				}))
			});
		});
	}
}, function(opts){
	OutputFormat.call(this, opts);
});

//UTIL

/*const handleListPage = (ob, pageNumber, req, res, urlPath, instances, options = {})=>{
	let config = ob.config();
	let errorConfig = ob.errorSpec();
	handleList(ob, pageNumber, urlPath, instances, options, (err, returnValue, set, len, write)=>{
		write(returnValue, set, len);
		ob.returnContent(res, returnValue, errorConfig, config);
	});
};

const handleBatch = (ob, pageNumber, req, res, urlPath, instances, options, callback)=>{
	let config = ob.config();
	let errorConfig = ob.errorSpec();
	//TODO: make default come from datasource
	let primaryKey = config.primaryKey || 'id';
	let identifier = ob.options.identifier || 'id';
	let lookup = makeLookup(ob, primaryKey, identifier);
	const populate = new Pop({
		identifier,
		linkSuffix: '',
		expandable: ob.options.expandable,
		listSuffix: 'list',
		join: config.foreignKeyJoin,
		lookup
	});
	let tpe = getExpansions(options, config);
	populate.deconstruct(ob.options.name, options.objects[0], tpe, (err, objects)=>{
		let result = {};
		let order = populate.orderBatches(objects);
		arrays.forEachEmission(order, (type, index, complete)=>{
			arrays.forEachEmission(objects[type], (object, index, objectSaved)=>{
				let rendered = copyJSON(object);
				ob.save(ob, identifier, type, rendered, (err, saved)=>{
					Object.keys(object).forEach((key)=>{
						if(typeof object[key] === 'function'){
							if(saved[key]){
								object[key](saved[key]);
							}else{
								//let value = object[key]();
								//if(!value) 
									throw new Error('save executed, but no key returned for \''+key+'\'');
							}
						}
					});
					objectSaved();
				});
			}, ()=>{
				complete();
			});
		}, ()=>{
			if(callback === true){
				ob.returnContent(res, result, errorConfig, config);
			}else{
				callback(null, result);
			}
		});
	});
};

const makeLookup = (ob, primaryKey, identifier)=>{
	const lookup = (type, context, cb) => {
		//console.log('LOOKUP', type, context);
		let res = ob.api.endpoints.find((item)=>{
			return item.options.name === type;
		});
		if(!res) return cb(new Error('Type not Found!'));
		if(Array.isArray(context)){
			let items = [];
			arrays.forEachEmission(context, (seed, index, done)=>{
				if(res.instances[seed]){
					items[index] = res.instances[seed];
					done();
				}else{
					res.generate(seed, (err, generated)=>{
						generated[primaryKey] = seed;
						items[index] = generated;
						done();
					});
				}
			}, ()=>{
				let keys = Object.keys(res.instances);
				cb && cb(null, items);
				
			});
		}else{
			const criteria = context;
			// if the criteria is the lone id
			let keys = Object.keys(criteria);
			if(keys.length === 1 ){
				let parts = ob.options.expandable(type, keys[0], criteria[keys[0]]);
				if(parts){ //is a foreign key
					let ep = ob.api.endpoints.find((item)=>{
						return item.options.name === parts.type;
					});
					let instanceList = Object.keys(res.instances).map((key)=> res.instances[key]);
					let instancesMeetingCriteria = instanceList.filter(sift(criteria));
					if(instancesMeetingCriteria.length){
						cb && cb(null, instancesMeetingCriteria);
					}else{
						res.generate(res.nextId(res), (err, generated)=>{
							Object.keys(criteria).forEach((key)=>{
								generated[key] = criteria[key];
							});
							let items = [];
							res.instances[generated[identifier]] = generated;
							items[0] = generated;
							cb && cb(null, items);
						});
					}
					return;
				}
				if(criteria[identifier] && criteria[identifier]['$in']){
					return lookup(type, criteria[identifier]['$in'], cb)
				}
			}else{
				/*ob.api.internal(type, 'list', {}, (err, results)=>{
					let endpoint = res;
					let allResults = results.concat(res.instances);
					let matchingResults = allResults.filter(sift(criteria));
					//console.log('!!!');
					//console.log(criteria, matchingResults);
					if(matchingResults.length){
						cb && cb(null, matchingResults);
					}
					res.generate(res.nextId(res), (err, generated)=>{
						Object.keys(criteria).forEach((key)=>{
							generated[key] = criteria[key];
						});
						let items = [];
						res.instances[generated[identifier]] = generated;
						items[0] = generated;
						cb && cb(null, items);
					});
				});*//*
			}
		}
	}
	return lookup;
}

const getExpansions = (options, config)=>{
	let tpe;
	if(
		config.foreignKey &&
		(options.internal || options.link || options.external)
	){
		let expansions = [].concat(stringsToStructs(
			options.internal || [],
			'expand',
			'internal'
		)).concat(stringsToStructs(
			options.link || [],
			'expand',
			'link'
		)).concat(stringsToStructs(
			options.external || [],
			'expand',
			'external'
		));
		tpe = expansions.map((expansion)=>{
			switch(expansion.type){
				case 'internal':
					return expansion.expand;
					break;
				case 'link':
					let parts = expansion.expand.split('+');
					return parts[0]+parts[1][0].toUpperCase()+
						parts[1].substring(1)+':'+parts[0]+
						':'+parts[1];
					break;
				case 'external':
					return '<'+expansion.expand;
					break;
				default: throw new Error('Unrecognized type:'+expansion.type)
			}
		});
	}
	return tpe;
}

const handleList = (ob, pageNumber, urlPath, instances, options, callback)=>{
	let config = ob.config();
	let errorConfig = ob.errorSpec();
	//TODO: make default come from datasource
	let primaryKey = config.primaryKey || 'id';
	let identifier = ob.options.identifier || 'id';
	let lookup = makeLookup(ob, primaryKey, identifier);
	let seeds = [];
	let gen = ob.makeGenerator('3c38adefd2f5bf4');
	let idGen = null;
	if(ob.schema.properties[primaryKey].type === 'string'){
		idGen = ()=>{
			let value = gen.randomString(30);
			return value;
		}
	}
	if(
		ob.schema.properties[primaryKey].type === 'number' ||
		ob.schema.properties[primaryKey].type === 'integer'
	){
		idGen = ()=>{
			let v = gen.randomInt(0, 10000);
			return v;
		}
	}
	let length = 30 * gen.randomInt(1, 3) + gen.randomInt(0, 30);
	if(options.query && options.expand){ // generate more, so we have more potential results
		length = length * options.expand;
	}
	for(let lcv=0; lcv < length; lcv++){
		seeds.push(idGen());
	}
	if(options.includeSaved){
		let ids = Object.keys(instances).map(id => instances[id][primaryKey]);
		seeds = seeds.concat(ids);
	}
	//let items = [];
	jsonSchemaFaker.option('random', () => gen.randomInt(0, 1000)/1000);
	let resultSpec = ob.resultSpec();
	let cleaned = ob.cleanedSchema(resultSpec.returnSpec);
	const populate = new Pop({
		identifier,
		linkSuffix: '',
		expandable: ob.options.expandable,
		listSuffix: 'list',
		join: config.foreignKeyJoin,
		lookup
	});
	let fillList = (seeds, options, cb)=>{
		let items = [];
		arrays.forEachEmission(seeds, (seed, index, done)=>{
			if(instances[seed]){
				items[index] = instances[seed];
				if(
					config.foreignKey &&
					(options.internal || options.link || options.external)
				){
					let tpe = getExpansions(options, config);
					//tpe is like: ['userTransaction:user:transaction']
					populate.tree(ob.options.name, items[index], tpe, (err, tree)=>{
						items[index] = tree;
						done();
					});
				}else{
					done();
				}
			}else{
				if(
					config.foreignKey &&
					(options.internal || options.link || options.external)
				){
					let tpe = getExpansions(options, config);
					ob.getInstance(seed, (err, generated)=>{
						//tpe is like: ['userTransaction:user:transaction']
						populate.tree(ob.options.name, generated, tpe, (err, tree)=>{
							items[index] = tree;
							done();
						});
					});
				}else{
					ob.getInstance( seed, (err, generated)=>{
						generated[primaryKey] = seed;
						items[index] = generated;
						done();
					});
				}
			}
		}, ()=>{
			cb(null, items);
		});
	}
	let writeResults = (results, set, size)=>{
		if(config.total){
			access.set(results, config.total, size || seeds.length);
		}
		if(config.page){
			let opts = pageVars();
			if(config.page.size){
				access.set(results, config.page.size, opts.size);
			}
			if(config.page.count){
				access.set(results, config.page.count, opts.count);
			}
			if(config.page.next && pageNumber < opts.count){
				access.set(results, config.page.next, urlPath+'/list/'+(pageNumber+1));
			}
			if(config.page.previous && pageNumber > 1){
				access.set(results, config.page.previous, urlPath+'/list/'+(pageNumber-1));
			}
			if(config.page.number){
				access.set(results, config.page.number, pageNumber);
			}
		}
		access.set(results, resultSpec.resultSetLocation, set);
	}
	let pageVars = ()=>{
		let size = config.defaultSize || 30;
		let pageFrom0 = pageNumber - 1;
		let offset = pageFrom0 * size;
		let count = Math.ceil(seeds.length/size);
		return {size, pageFrom0, offset, count};
	};
	jsonSchemaFaker.resolve(cleaned, [], process.cwd()).then((returnValue)=>{
		if(!options.query){ // we are going to do only the work on the page
			try{
				let opts = pageVars();
				seeds = seeds.slice(opts.offset, opts.offset+opts.size);
				fillList(seeds, options, (err, filled)=>{
					callback(null, returnValue, filled, null, writeResults);
				});
			}catch(ex){ console.log(ex) }
		}else{ // we do all the work: we need to reduce using full values
			let opts = pageVars();
			fillList(seeds, options, (err, filled)=>{
				let set = filled.filter(sift(options.query));
				let len = set.length;
				set = set.slice(opts.offset, opts.offset+opts.size);
				let returnOptionValue = null;
				if(options.generate && (returnOptionValue = parseInt(options.generate))){
					let extraReturnSeeds = [];
					for(let lcv=0; lcv < returnOptionValue; lcv++){
						extraReturnSeeds.push(idGen());
					}
					fillList(extraReturnSeeds, options, (err, extraFilled)=>{
						extraFilled.forEach((item)=>{
							Object.keys(options.query).forEach((key)=>{
								if(options.query[key]['$eq']){
									item[key] = options.query[key]['$eq'];
								}
								if(options.query[key]['$in'] && Array.isArray(options.query[key]['$in'])){
									let index = Math.round(Math.random() * options.query[key]['$in'].length);
									item[key] = options.query[key]['$in'][index];
								}
								if(options.query[key]['$lt'] || options.query[key]['$gt']){
									if(Number.isInteger(options.query[key]['$lt'] || options.query[key]['$gt'])){
										const lower = options.query[key]['$gt'] !== null?options.query[key]['$gt']:Number.MIN_SAFE_INTEGER;
										const upper = options.query[key]['$lt'] || Number.MAX_SAFE_INTEGER;
										const diff =  upper - lower;
										let result = Math.floor(Math.random()*diff)+ lower;
										item[key] = result;
									}else{
										if( typeof (
												options.query[key]['$lt'] || 
												options.query[key]['$gt']
											) === 'string'
										){
											const lower = new Date(options.query[key]['$gt'] || '01/01/1970 00:00:00 UTC');
											const upper = new Date(options.query[key]['$lt']);
											const lowerLimit = lower.getTime()
											const diff =  upper.getTime() - lower.getTime();
											let result = Math.floor(Math.random() * diff) + lowerLimit;
											let resultDate = new Date();
											resultDate.setTime(result);
											item[key] = resultDate.toString();
										}else{
											const lower = options.query[key]['$gt'] || Number.MIN_VALUE;
											const upper = options.query[key]['$lt'] || Number.MAX_VALUE;
											const diff =  upper - lower;
											let result = Math.random() * diff + lower;
											item[key] = result;
										}
									}
								}
							});
							if(options.persistGenerated){
								ob.instances[item[identifier]] = item;
							}
							set.push(item);
						});
						callback(null, returnValue, set, null, writeResults)
						//writeResults(returnValue, set);
						//returnContent(res, returnValue, errorConfig, config);
					});
				}else{
					callback(null, returnValue, set, len, writeResults)
					//writeResults(returnValue, set, len);
					//returnContent(res, returnValue, errorConfig, config);
				}
			});
		}
	});
};

const copyJSON = (ob)=>{
	let copy = JSON.parse(JSON.stringify(ob));
	Object.keys(copy).forEach((key)=>{
		if(copy[key] === null) delete copy[key];
	});
	return copy;
}

const stringsToStructs = (strs, field, type)=>{
	return strs.map((v)=>{
		let res = { type };
		res[field] = v;
		return res;
	});
};*/

module.exports = Mongonian;