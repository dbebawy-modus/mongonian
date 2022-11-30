Mongonian
=========

Mongonian is a Perigress output format for an API that closely matches mongo's format and output.

Usage
-----

```js
	const app = express();
	app.use(express.json({strict: false}));
	const api = new Perigress.API({
		subpath : 'verifier-subdirectory',
		dir: __dirname
	}, new Mongoish());
	api.ready.then(()=>{
		api.attach(app);
		// express is now serving a mock API using the Mongoish format
		// request `<root>/spec` for documentation
	}).catch((ex)=>{
		should.not.exist(ex);
	});;
```

Testing

```bash
	npm test
```