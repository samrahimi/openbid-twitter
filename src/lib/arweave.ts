import Arweave from "arweave/node";
import retry  from 'async-retry';
import axios from "axios"
const fs= require('fs')
//const WALLET_FILE = process.env.WALLET_FILE
//const privateKey = JSON.parse(fs.readFileSync(WALLET_FILE))

const client = Arweave.init({host: 'arweave.net', port: 443, protocol: 'https' });
client.api.config.timeout = 1000 * 60 * 1.5;


const arqlWithRetry=async(query, numRetries = 10) =>{
    var txids = []
    await retry(async() => {
      txids = await client.arql(query)
      if (txids.length == 0) {
          throw new Error("0 results, assuming error")
          console.log("no results, will retry")
      }
      console.log("retrieved "+txids.length+" transaction ids matching your query")
    }, {retries: numRetries})
    return txids
}

const getTxWithRetry=async(txid, part="all", decode = true, numRetries = 10) => {
    
    var tx = null
    await retry(async() => {
        tx = await client.transactions.get(txid)
    }, {retries: numRetries})

    if (!decode)
        return tx 

    else {
        var decoded = 
        {
            id: tx.id,
            owner: tx.owner, 
            data: part == 'all' ? JSON.parse(tx.get('data', {decode: true, string: true})) : null,
            tags: {}
        }
        tx.get('tags').forEach(tag => {
            let key = tag.get('name', {decode: true, string: true});
            let value = tag.get('value', {decode: true, string: true});
            console.log(`${key} : ${value}`);
            decoded.tags[key]=value
        });

        return decoded
    }

    return tx
}


export { client, arqlWithRetry, getTxWithRetry }