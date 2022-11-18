const peri = '@perigress/perigress';
const OutputFormat = require(peri+'/src/output-format.js');
const template = require('es6-template-strings');
const arrays = require('async-arrays');
const hash = require('object-hash');
const access = require('object-accessor');
const validate = require('jsonschema').validate;
const jsonSchemaFaker = require('json-schema-faker');
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

const getUrls = (config, pathOptions, endpoint)=>{
    if(endpoint.urls) return endpoint.urls;
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
        search : template(
            (
                (config.paths && config.paths.search) ||
                '${basePath}/search'
            ),
            pathOptions
        ),
        aggregation : template(
            (
                (config.paths && config.paths.aggregation) ||
                '${basePath}/aggregation'
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
                (config.paths && config.paths.listSchema) ||
                '${basePath}/list-schema.json'
            ),
            pathOptions
        ),
        itemSchema : template(
            (
                (config.paths && config.paths.itemSchema) ||
                '${basePath}/display-schema.json'
            ),
            pathOptions
        ),
        createSchema : template(
            (
                (config.paths && config.paths.createSchema) ||
                '${basePath}/create-schema.json'
            ),
            pathOptions
        ),
        editSchema : template(
            (
                (config.paths && config.paths.editSchema) ||
                '${basePath}/edit-schema.json'
            ),
            pathOptions
        ),
        delete : template(
            (
                (config.paths && config.paths.delete) ||
                '${basePath}/:${primaryKey}/delete'
            ),
            pathOptions
        )
    };
    endpoint.urls = urls;
    return endpoint.urls;
}

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
        if(endpoint.api.actions){
            Object.keys(endpoint.api.actions).forEach((key)=>{
                if(!endpoint[key]) endpoint[key] = endpoint.api.actions[key];
            });
        }
        if(!endpoint.list) endpoint.list = function(options, cb){
            let callback = ks(cb);
            const requestObject = options.req || {};
            delete options.req;
            try{
                handleList(
                    endpoint, 
                    (options.pageNumber?parseInt(options.pageNumber):1), 
                    `js://${endpoint.options.name}/`, 
                    endpoint.instances, 
                    options, 
                    requestObject,
                    (err, returnValue, set, len, write)=>{
                        callback(null, set);
                    }
                );
            }catch(ex){
                console.log(ex);
            }
            return callback.return;
        }
        
        if(!endpoint.batch) endpoint.batch = function(options, tree, cb){
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
        
        if(!endpoint.search) endpoint.search = function(options, cb){
            try{
                let searchToRegexOptions = JSON.parse(JSON.stringify(options));
                let callback = ks(cb);
                //implement
                let path = searchToRegexOptions.wildcard.path;
                if(!Array.isArray(path)){
                    path = [path];
                }
                let config = endpoint.config();
                let primaryKey = config.primaryKey || 'id';
                if(!searchToRegexOptions.wildcard){
                    return callback(new Error("searching requires the wildcard property"));
                }
                let regex = new RegExp(searchToRegexOptions.wildcard.query.replace(/\*/g, ".*"));
                let searchCriteria = options.query;
                searchCriteria["$or"] = [];
                path.forEach((path)=>{
                    let crit = {};
                    crit[path] = {$regex: regex};
                    searchCriteria["$or"].push(crit);
                });
                searchToRegexOptions.query = searchCriteria;
                endpoint.list(searchToRegexOptions, (err, results)=>{
                    callback(err, results);
                });
                return callback.return;
            }catch(ex){
                callback(ex);
            }
        }
        
        const aggOps = {
            sum : (aggregate, currentValue, currentItem, meta)=>{
                return (aggregate || 0) + currentValue;
            },
            count : (aggregate, currentValue, currentItem, meta)=>{
                return (aggregate || 0) + 1;
            }
        }
        if(!endpoint.aggregation) endpoint.aggregation = function(options, cb){
            let callback = ks(cb);
            //implement
            let identifiers = [];
            let aggregations = [];
            Object.keys(options.$group).forEach((key)=>{
                if(typeof options.$group[key] === 'object') aggregations.push({
                    field: key,
                    operation: (Object.keys(options.$group[key])[0]||'').slice(1),
                    target: (options.$group[key][Object.keys(options.$group[key])[0]]||'').slice(1)
                });
                else identifiers.push({
                    field: key,
                    source: options.$group[key]
                })
            });
            let result = {};
            endpoint.api.internal(endpoint.options.name, 'list', {
                query: options.$match,
                req: options.req,
            }, (err, results)=>{
                let aggregates = {};
                results.forEach((item)=>{
                    let idVals = {};
                    identifiers.forEach((identifier)=>{
                        idVals[identifier.field] = item[identifier.source];
                    });
                    let idHash = hash(idVals);
                    if(!aggregates[idHash]){
                        aggregates[idHash] = {
                            total: 0,
                            values: {}
                        }
                        Object.keys(idVals).forEach((key)=>{
                            aggregates[idHash].values[key] = idVals[key];
                        })
                    }
                    aggregations.forEach((aggregation)=>{
                        aggregates[idHash].values[aggregation.field] = aggOps[aggregation.operation](
                            aggregates[idHash].values[aggregation.field],
                            item[aggregation.target],
                            item,
                            aggregates[idHash]
                        )
                    });
                    aggregates[idHash].total++;
                });
                setTimeout(()=>{
                    callback(null, Object.keys(aggregates).map((key)=>{
                        return aggregates[key].values;
                    }));
                })
            });
            return callback.return;
        }
        
        if(!endpoint.create) endpoint.create = function(options, cb){
            let callback = ks(cb);
            let config = endpoint.config();
            let primaryKey = config.primaryKey || 'id';
            let item = options.body;
            if(!item[primaryKey]) item[primaryKey] = Math.floor(Math.random()* 1000000000);
            if(validate(options.body, endpoint.originalSchema)){
                endpoint.instances[item[primaryKey]] = item;
                callback(null, item);
            }else{
                callback(new Error("the provided data was not valid"));
            }
            return callback.return;
        }
        
        if(!endpoint.read) endpoint.read = function(options, cb){
            let callback = ks(cb);
            let config = endpoint.config();
            let primaryKey = config.primaryKey || 'id';
            endpoint.getInstance(options[primaryKey], (err, item)=>{
                callback(null, item);
            });
            return callback.return;
        }
        
        if(!endpoint.createUrl) endpoint.createUrl = function(instance, options){
            instance[options.method](options.url, options.handler);
        }
        
        if(!endpoint.update) endpoint.update = function(options, cb){
            let callback = ks(cb);
            let config = endpoint.config();
            let primaryKey = config.primaryKey || 'id';
            endpoint.getInstance(options[primaryKey], (err, item)=>{
                if(options.body && typeof options.body === 'object'){
                    Object.keys(options.body).forEach((key)=>{
                        item[key] = options.body[key];
                    });
                    //item is now the set of values to save
                    if(validate(item, endpoint.originalSchema)){
                        endpoint.instances[options.body[primaryKey]] = item;
                        
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
        
        if(!endpoint.delete) endpoint.delete = function(options, cb){
            let callback = ks(cb);
            let config = endpoint.config();
            let primaryKey = config.primaryKey || 'id';
            endpoint.getInstance(options[primaryKey], (err, item)=>{
                if(options[primaryKey]){
                    if(endpoint.instances[options[primaryKey]]){
                        delete endpoint.instances[options[primaryKey]];
                    }
                    if(endpoint.deleted && (endpoint.deleted.indexOf(options[primaryKey]) === -1)){
                        endpoint.deleted.push(options[primaryKey]);
                    }
                    callback(null, {});
                }else{
                    //fail
                    callback(new Error('Failed to update item'))
                }
            });
            return callback.return;
        }
    },
    attachRoot : function(instance, api, cb){
        api.ready.then(()=>{
            try{
                if(instance){
                    instance.get('/openapi.json', (req, res)=>{
                        let org = {
                            'list': '', 
                            'display': '', 
                            'create': '', 
                            'edit': ''
                        }
                        let serverList = [];
                        let pathReferenceDirectory = {};
                        api.endpoints.forEach((endpoint)=>{
                            org = {
                                'list': endpoint.urls.list, 
                                'display': endpoint.urls.display.replace(':id', '{id}'), 
                                'create': endpoint.urls.create, 
                                'edit': endpoint.urls.edit.replace(':id', '{id}')
                            }
                            Object.keys(org).forEach((key)=>{
                                pathReferenceDirectory[org[key]] = {$ref: endpoint.basePath+'/'+key+'-schema.json'};
                            });
                            //console.log(endpoint); 
                        });
                        res.send(JSON.stringify({
                            openapi: '3.0.0',
                            servers: serverList,
                            paths: pathReferenceDirectory
                        }));
                    });
                    let port = process.env.PERIGRESS_OPENAPI_PORT || 8080;
                    let host = process.env.PERIGRESS_OPENAPI_HOST || 'localhost';
                    let protocol = process.env.PERIGRESS_OPENAPI_PROTOCOL || 'http';
                    let staticSwaggerHost = process.env.PERIGRESS_OPENAPI_STATIC_HOST || 'unpkg.com/swagger-ui-dist@4.5.0';
                    instance.get('/spec', (req, res)=>{
                        res.send(`<!DOCTYPE html>
                        <html lang="en">
                        <head>
                          <meta charset="utf-8" />
                          <meta name="viewport" content="width=device-width, initial-scale=1" />
                          <meta
                            name="description"
                            content="SwaggerUI"
                          />
                          <title>SwaggerUI</title>
                          <link rel="stylesheet" href="${protocol}://${staticSwaggerHost}/swagger-ui.css" />
                        </head>
                        <body>
                        <div id="swagger-ui"></div>
                        <script src="${protocol}://${staticSwaggerHost}/swagger-ui-bundle.js" crossorigin></script>
                        <script>
                          window.onload = () => {
                            window.ui = SwaggerUIBundle({
                              url: '${protocol}://${host}:${port}/openapi.json',
                              deepLinking: true,
                              dom_id: '#swagger-ui',
                            });
                          };
                        </script>
                        </body>
                        </html>`);
                    });
                    /*instance.all('*', (req, res)=>{
                        res.send('{"error":true, "message":"Path not found."}');
                    });*/
                }
                if(cb) cb();
            }catch(ex){
                console.log('ERROR', ex);
            }
        });
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
            
        let urls = getUrls(config, pathOptions, endpoint);
        endpoint.basePath = urlPath
        
        endpoint.createUrl(expressInstance, {
            url: urls.list,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                let options = typeof req.body === 'string'?req.params:req.body;
                let page = (config.page && config.page.number)?
                    parseInt(access.get(options, config.page.number)||'1'):
                    1;
                handleListPage(endpoint, page, req, res, urlPath, endpoint.instances, options);
            }
        });
        
        endpoint.createUrl(expressInstance, {
            url: urls.listPage,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                let options = typeof req.body === 'string'?req.params:req.body;
                handleListPage(endpoint, parseInt(req.params.pageNumber), req, res, urlPath, endpoint.instances, options);
            }
        });
        
        endpoint.createUrl(expressInstance, {
            url: urls.delete,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                endpoint.delete(req, (err)=>{
                    if(err){
                        res.send('{"error":true, "message":"delete failed"}');
                    }else{
                        endpoint.returnContent(res, {success:true}, errorConfig, config);
                    }
                });
            }
        });
        
        if(this.options.search){
            endpoint.createUrl(expressInstance, {
                url: urls.search,
                method: endpoint.endpointOptions.method.toLowerCase(),
                handler: (req, res)=>{
                    let options = typeof req.body === 'string'?req.params:req.body;
                    endpoint.search(options, (err, results)=>{
                        endpoint.returnContent(res, {success: true, result: results}, errorConfig, config);
                    });
                }
            });
        }
        
        if(this.options.aggregation){
            endpoint.createUrl(expressInstance, {
                url: urls.aggregation,
                method: endpoint.endpointOptions.method.toLowerCase(),
                handler: (req, res)=>{
                    let options = typeof req.body === 'string'?req.params:req.body;
                    if(!(options['$group'] || options.group)) throw new Error('nothing to group');
                    endpoint.aggregation({
                        $group: (options['$group'] || options.group),
                        $match: (options['$match'] || options.query),
                        req: req
                    }, (err, result)=>{
                        endpoint.returnContent(res, {success: true, result: result}, errorConfig, config);
                    });
                }
            });
        }
        
        endpoint.createUrl(expressInstance, {
            url: urls.save,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                let options = typeof req.body === 'string'?req.params:req.body;
                handleBatch(endpoint, 1, req, res, urlPath, endpoint.instances, options, true);
            }
        });
        
        endpoint.createUrl(expressInstance, {
            url: urls.create,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                endpoint.create(req, (err, item)=>{
                    if(err){
                        res.send(`{"error":true, "message":"${
                            err.message ||
                            "the provided data could not be saved"
                        }"}`);
                    }
                    endpoint.returnContent(res, {success: true, result: item}, errorConfig, config);
                });
            }
        });
        
        endpoint.createUrl(expressInstance, {
            url: urls.edit,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                if(req.body && typeof req.body === 'object'){
                    endpoint.update(req, (err)=>{
                        if(err){
                            res.send(`{"error":true, "message":"${
                                err.message ||
                                "the provided data could not be saved"
                            }"}`);
                        }else{
                            endpoint.returnContent(res, {success:true}, errorConfig, config);
                        }
                    });
                }else{
                    //fail
                    res.send('{"error":true, "message":"no provided data to save"}');
                }
            }
        });
        
        endpoint.createUrl(expressInstance, {
            url: urls.display,
            method: endpoint.endpointOptions.method.toLowerCase(),
            handler: (req, res)=>{
                let config = endpoint.config();
                let primaryKey = config.primaryKey || 'id';
                let options = {};
                options[primaryKey] = req.params[primaryKey];
                endpoint.read(options, (err, results)=>{
                    if(err){
                        res.send(`{"error":true, "message":"${
                            err.message ||
                            "the provided data could not be saved"
                        }"}`);
                    }else{
                        res.send(JSON.stringify(results, null, '    '))
                    }
                });
            }
        });
        
    },
    attachSpec : function(){
        
    },
    attachEndpointSpec : function(expressInstance, endpoint, {
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
        let urls = getUrls(config, pathOptions, endpoint);
        let opts = {
            objectName: endpoint.options.name
        };
        if(!expressInstance) throw new Error('express not found!');
        expressInstance[
            endpoint.endpointOptions.method.toLowerCase()
        ](endpoint.urls.listSchema, (req, res)=>{
            let cleanedCopy = JSON.parse(JSON.stringify(cleaned));
            if(cleanedCopy.properties && cleanedCopy.properties.results){
                cleanedCopy.properties.results.items = this.schema;
            }
            jsonSchemaFaker.resolve(cleaned, [], process.cwd()).then((exampleReturn)=>{
                endpoint.generate(1, (err, generated)=>{
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
            endpoint.endpointOptions.method.toLowerCase()
        ](endpoint.urls.itemSchema, (req, res)=>{
            endpoint.generate(1, (err, generated)=>{
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
            endpoint.endpointOptions.method.toLowerCase()
        ](endpoint.urls.editSchema, (req, res)=>{
            endpoint.generate(1, (err, generated)=>{
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
            endpoint.endpointOptions.method.toLowerCase()
        ](endpoint.urls.createSchema, (req, res)=>{
            endpoint.generate(1, (err, generated)=>{
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

module.exports = Mongonian;