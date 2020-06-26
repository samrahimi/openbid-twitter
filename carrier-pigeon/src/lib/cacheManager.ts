import {client, getTxWithRetry, arqlWithRetry, createSignedTx} from './arweaveManager'
import {CacheEntry} from './cacheEntry'
import {Bundle, writeRecursiveTx} from './bundle'

const cacheSize = () => cache.cacheEntries.reduce((a,b) => a + b.size, 0)
const defaultQueryMaxAge = 12*3600*1000
const maxConcurrentTxRequests = 50      //when getting a dataset, this is the batch size for parallelizing requests
const DELIMITER = '||' 
const defaultBundleSize = 100

const cache = {
    "transactions" : {},
    "query_results": {},
    "cacheEntries": new Array<CacheEntry>(),
    config: {
        maxSize: 1000 * 1024 * 1024,    //1GB maximum total cache size. 
        evictionStrategy: "lru",        //when cache is full, remove least recently accessed items first
        cleanupInterval: 30 * 1000,    //how often to purge expired and other items prioritized under chosen evictionStrategy
    },

    stats: {
        hits: 0,                        //each request where data was already in the cache
        misses: 0,                      //each request where data was retrieved from Arweave
    }
};


const cacheKey = (bucket, identifier) => `${bucket}||${identifier}`
const purgeExpiredEntries = () => {
    var nonExpired = cache.cacheEntries.filter(x => x.expiresAt == 0 || x.expiresAt > Date.now())
    var expired = cache.cacheEntries.filter(x => x.expiresAt > 0 && x.expiresAt < Date.now())

    console.log(
   `${cache.cacheEntries.length} total items in cache.  
    ${expired.length} have expired and will be removed.`)
    expired.forEach(entry => {
        var [bucket, identifier] = entry.key.split(DELIMITER)
        if (cache[bucket][identifier]) {
            delete cache[bucket][identifier]
        }
    })
    cache.cacheEntries = nonExpired
}
setInterval(purgeExpiredEntries, cache.config.cleanupInterval)


export default {
    _add(key, item, maxAge) {
        var entry = new CacheEntry(key, item, maxAge)
        cache.cacheEntries.push(entry)

        var [bucket, identifier] = key.split(DELIMITER)
        cache[bucket][identifier] = item

        console.log(`added ${key} to cache`)
    },
    _remove(key) {
        var [bucket, identifier] = key.split(DELIMITER)
        if (cache[bucket][identifier]) {
            delete cache[bucket][identifier]
            cache.cacheEntries = cache.cacheEntries.filter(entry => entry.key != key) 
        }
    },
    //bucket: either 'transactions' or 'query_results'
    //identifier: for arql queries, pass the stringified query; for transactions, use the txid
    addToCache(bucket, identifier, item, maxAge=0) {
        var key = cacheKey(bucket, identifier)
        this._add(key, item, maxAge)
    },
    logAccess(key) {
        setTimeout(() => {
            var entry = cache.cacheEntries.find(x => x.key == key)
            entry.lastAccessedAt = Date.now()
            entry.accessCount++
        }, 0)
    },
    getInfo() {
        const {cacheEntries, stats, config} = cache
        return {cacheEntries, stats, config, size: cacheSize()}
    },
    async getTransaction(txid: string, part="all", requestMode = "proxy") {
        if (!txid || txid == 'undefined') 
            return null

        var tx = cache.transactions[txid+part]
        var key = cacheKey('transactions', txid+part)

        if (tx) {
            cache.stats.hits++
            this.logAccess(key)
            console.log(`Found tx ${txid+part} in cache`)
        } else {
            cache.stats.misses++
            if (requestMode === "proxy") {
                console.log(`Requesting tx ${txid} from Arweave gateway`)
                tx = await getTxWithRetry(txid, part)
                console.log(`got tx ${txid}, adding to cache`)
                this._add(key, tx, 0)
            } else {
                console.log(`item not found in cache... not requesting from Arweave because requestMode != 'proxy'`)
            }
        }
        return tx
    },
    async arql(arqlQueryObj,maxAge = defaultQueryMaxAge, requestMode = "proxy") {
        var results= cache.query_results[JSON.stringify(arqlQueryObj)] || null
        var key = cacheKey('query_results', JSON.stringify(arqlQueryObj))

        if (results) {
            cache.stats.hits++
            this.logAccess(key)
            console.log(`Found query results in cache`)
        } else {
            cache.stats.misses++
            if (requestMode === "proxy") {
                console.log(`sending arql query to Arweave gateway`)
                results = await arqlWithRetry(arqlQueryObj)
                if (results.length == 0) {
                    console.log("got no results. this may be an error at the gateway, or maybe not. try again!")
                    return results
                }
                console.log(`got query results, adding to cache`)
                this._add(key, results, maxAge)
            } else {
                console.log(`results not found in cache... not requesting from Arweave because requestMode != 'proxy'`)
            }
        }
        return results
    },

    //run an arql query, and get the tx for each id in the query results from offset to limit
    async dataset(arqlQueryObj, part="all", offset, limit, maxAge) {
        const ids = await this.arql(arqlQueryObj, maxAge)
        if (ids.length == 0)
            return []
        
        var results = []
        for (var i=offset; i<Math.min(offset+limit, ids.length); i+=maxConcurrentTxRequests) {
            var chunk = await Promise.all(ids.slice(i, Math.min(offset+limit, i+maxConcurrentTxRequests))
                                             .map(txid => this.getTransaction(txid, part)))
            results = results.concat(chunk)
            console.log(`got chunk ${i} - ${i+maxConcurrentTxRequests} (actual chunk size: ${chunk.length})`)
        }
        console.log(`retrieved ${results.length} rows`)
        return results
    },

    //gets the most recent tx for the given arql query
    //since arql results are most recent -> least, we're just getting a dataset with offset=0, limit=1
    async latest(arqlQueryObj, part="all", maxAge) {
        var ds= await this.dataset(arqlQueryObj, part, 0, 1, maxAge)
        if (ds.length > 0)
            return ds[0]
        else
            return []
    },

    invalidate(arqlQueryObj, refresh = false, maxAge = defaultQueryMaxAge) {
        this._remove(cacheKey('query_results', JSON.stringify(arqlQueryObj)))
        if (refresh) 
            this.arql(arqlQueryObj, maxAge)
    },
    reset() {
        cache.transactions = {}
        cache.query_results = {}
        cache.cacheEntries = new Array<CacheEntry>()
        cache.stats = {hits: 0, misses: 0}
    },
    async write(data, tags, affectedArqlQueries: [] = []) {
        var pendingTx = await createSignedTx(data, tags, true) 
        this.addToCache("transactions", pendingTx.id, pendingTx, 0)
        return pendingTx

        //todo: invalidate all affectedArqlQueries if cached in query_results
    },

    //adds a single transaction to a temporary Bundle, where it is cached until the Bundle is full and gets written to Arweave
    async writeRecursive(appName, appVersion, data, tags, bundleSize = defaultBundleSize)
    {
        var bundle= Bundle.getOrCreate(appName, appVersion, bundleSize)
        if (bundle.transactions.length = 0) {
            bundle.on('write_bundle', bundled_tx => {
                this.addToCache("transactions", bundled_tx.id, bundled_tx, 0)
                //TODO: write an index of the internal txs mapping their IDs to the bundle
            })
        }
        var signedTx = await createSignedTx(data, tags, true)
        bundle.addTransaction(signedTx)
        this.addToCache("transactions", signedTx.id, signedTx, 0) //immediately cache the child tx
        return signedTx
    },
    //writes a batch of transactions, as a single recursive tx
    async writeBundle(appName, appVersion, arrayOfSignedTransactions) {
        var results = await writeRecursiveTx(appName, appVersion, arrayOfSignedTransactions)
        return results

    }
}