import express from "express";
import cors from "cors";
import cacheManager from './lib/cacheManager'
import bodyParser from "body-parser";

const DEFAULT_MAX_AGE = 12 * 3600 * 1000
const DEFAULT_MAX_ROWS = 10000

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

if (process.env.PORT && parseInt(process.env.PORT)) {
  app.listen(parseInt(process.env.PORT), () => console.log(`Listening on ${process.env.PORT}`));
} else {
  app.listen(3000, () => console.log(`Listening on localhost:3000`));
}

//returns a tx from the cache
//if not found in the cache, gets tx from arweave, and adds it to the cache
//a cached tx is GUARANTEED to be valid because arweave transactions are permanent!
app.get('/tx/:txid', async(req, res, next) => {
  var tx = await cacheManager.getTransaction(req.params.txid, req.query["part"] || "all")
  res.contentType('application/json')
  console.log("sending response: "+JSON.stringify(tx))
  res.send(tx)
})

//returns arweave query results from cache
//if not found in the cache, executes the query on arweave, and adds results to cache
//IMPORTANT: arql query results are NOT guaranteed to be valid
//You must call /invalidate with the affected queries after writing a transaction
app.post('/arql', async(req, res, next) => {
  var results = await cacheManager.arql(req.body, parseInt(req.query["expires"]) || DEFAULT_MAX_AGE)
  res.contentType('application/json')
  res.send(results)
})

//returns a dataset (array of arweave transactions), of the sort you would expect when querying a DB
//behind the scenes, it runs the arql query that you pass it, and then gets /tx for each txid in the 
//arql results with an index between offset and limit
app.post('/dataset', async(req, res, next) => {
  var results = await cacheManager.dataset(req.body,
  req.query["part"] || "all", 
  parseInt(req.query["offset"]) || 0, 
  parseInt(req.query["limit"]) || DEFAULT_MAX_ROWS, 
  parseInt(req.query["expires"]) || DEFAULT_MAX_AGE)

  res.contentType('application/json')
  res.send(results)
})

app.post('/write', async(req, res, next) => {
  var data = req.body.data
  var tags = req.body.tags
  var parent = req.body.parent; //{"App-Name": 'x', "App-Version": 'y'} - if set then this will be part of a bundled meta-tx 
  var result
  if (parent)
    result = await cacheManager.writeRecursive(parent["App-Name"], parent["App-Version"], data, tags, req.query["bundleSize"] || 100)
  else
    result = await cacheManager.write(data, tags)
  
    res.contentType('application/json')
    res.send(result)
})

//gets the most recent transaction that matches the given arql query
//same as calling /dataset with offset=0 and limit=1
app.post('/latest', async(req, res, next) => {
    var doc = await cacheManager.latest(req.body,
    req.query["part"] || "all", 
    parseInt(req.query["expires"]) || DEFAULT_MAX_AGE)

    res.contentType('application/json')
    res.send(doc)
})

//returns currently cached keys and stats
//does not return the actual cached items
app.get('/info', (req, res, next) => {
  res.contentType('application/json')
  res.send(cacheManager.getInfo())
})

//accepts an array of arql query objects
//each query's results, if cached, are removed from the cache
//if ?refresh=true runs the query on arweave and adds the 
//updated results to the cache

//NOTE: THIS IS STILL WIP. the current implementation 
//only invalidates the exact queries that you specify 
app.post('/invalidate', (req, res, next) => {
  req.body.forEach(arqlQuery => {
    cacheManager.invalidate(arqlQuery, req.query["refresh"], parseInt(req.query["expires"]) || DEFAULT_MAX_AGE)
  })
})

//clears all cached data and resets the counters to 0
app.get('/reset', (req, res, next) => {
  cacheManager.reset()
})

//TODO: write-through caching.

export default app;
