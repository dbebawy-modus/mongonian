const jsonSchemaFaker = require('json-schema-faker');
const Pop = require('tree-pop');
const arrays = require('async-arrays');
const access = require('object-accessor');
//const sift = require('sift').default;

//UTIL

const handleListPage = (ob, pageNumber, req, res, urlPath, instances, options = {})=>{
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
	if(ob.api.actions && ob.api.actions.lookup){
		lookup = ob.api.actions.lookup;
	}
	if(ob.options.actions && ob.options.actions.lookup){
		lookup = ob.options.actions.lookup;
	}
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
					if(!result[type]) result[type] = [];
					result[type].push(saved);
					Object.keys(object).forEach((key)=>{
						if(typeof object[key] === 'function'){
							if(saved[key]){
								object[key](saved[key]);
							}else{
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
				//console.log('???!', ob.api.internalData());
				ob.returnContent(res, result, errorConfig, config);
			}else{
				//console.log('????', result);
				callback(null, result);
			}
		});
	});
};

const makeLookup = (ob, primaryKey, identifier)=>{
	const lookup = (type, context, cb) => {
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
			if( //todo: better criteria
				keys.length === 1
			){
				let parts = ob.options.expandable(type, keys[0], criteria[keys[0]]);
				if(parts){ //is a foreign key
					let ep = ob.api.endpoints.find((item)=>{
						return item.options.name === parts.type;
					});
					let instanceList = Object.keys(res.instances).map((key)=> res.instances[key]);
					let instancesMeetingCriteria = instanceList.filter(ob.api.sift(criteria));
					if(instancesMeetingCriteria.length){
						cb && cb(null, instancesMeetingCriteria);
					}else{
						let id;
						if(criteria[keys[0]]['$in'] && criteria[keys[0]]['$in'].length){
							id = criteria[keys[0]]['$in'].shift();
						}else{
							id = res.nextId(res)
						}
						res.generate(id, (err, generated)=>{
							Object.keys(criteria).forEach((key)=>{
								if(key === identifier) return;
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
					return lookup(type, criteria[identifier]['$in'], cb, {config, options})
				}
			}else{
				/*ob.api.internal(type, 'list', {}, (err, results)=>{
					let endpoint = res;
					let allResults = results.concat(res.instances);
					let matchingResults = allResults.filter(ob.api.sift(criteria));
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
				});*/
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
	if(ob.api.actions && ob.api.actions.lookup){
		lookup = ob.api.actions.lookup;
	}
	if(ob.options.actions && ob.options.actions.lookup){
		lookup = ob.options.actions.lookup;
	}
	let seeds = [];
	let seed = options.seed|| ob.options.seed || config.seed || '3c38adefd2f5bf4';
	let pageSize = (options.page && options.page.size) || config.defaultSize || 30;
	let gen = ob.makeGenerator(seed);
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
	let length = pageSize * gen.randomInt(1, 2) + gen.randomInt(0, pageSize);
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
		lookup(ob.options.name, seeds, (err, res)=>{
			if(
				config.foreignKey &&
				(options.internal || options.link || options.external)
			){
				//tpe is like: ['userTransaction:user:transaction']
				let tpe = getExpansions(options, config);
				arrays.forEachEmission(res, (item, index, finish)=>{
					populate.tree(ob.options.name, item, tpe, (err, tree)=>{
						items[index] = tree;
						finish();
					});
				}, ()=>{
					cb(err, items);
				});
			}else{
				items = items.concat(res)
				cb(err, items);
			}
		}, {config, options});
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
		let pageOpts = options.page || {};
		let size = pageOpts.size || config.defaultSize || 30;
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
				let set = filled.filter(ob.api.sift(options.query));
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
	let map =  strs.map((v)=>{
		let res = { type };
		res[field] = v;
		return res;
	});
	return map;
};

module.exports = {
	stringsToStructs, 
	copyJSON, 
	handleList, 
	getExpansions, 
	makeLookup, 
	handleBatch, 
	handleListPage
};
