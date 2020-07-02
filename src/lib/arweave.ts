import Arweave from "arweave/node";
import retry  from 'async-retry';
import axios from "axios"
const fs= require('fs')
const WALLET_FILE = process.env.WALLET_FILE
const privateKey = JSON.parse(fs.readFileSync(WALLET_FILE))

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
const writeTagsOnlyTx =async(tags: Array<any>) => {
    console.log("wallet private key is "+ privateKey)
    try 
    {
        const tx = await client.createTransaction({data: "{}"}, privateKey)
        tx.addTag("Content-Type", "application/json")
        tx.addTag("App-Name", "OpenBid")
        tx.addTag("App-Version", "0.0.1")
        tx.addTag("Source", "Twitter")


        tags.forEach(tag => {
            tx.addTag(tag.name, tag.value)
        })
        await client.transactions.sign(tx, privateKey)
        console.log(JSON.stringify(tx, null, 2))
        await client.transactions.post(tx);
        console.log(`Transaction is posted and will be mined shortly. Check status at https://viewblock.io/arweave/tx/${tx.id}`);
        return tx.id
    }
    catch (err){
        console.log('Error, transaction not posted')
        console.log(err.message)
        return null
    }
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


export { client, arqlWithRetry, getTxWithRetry, writeTagsOnlyTx }