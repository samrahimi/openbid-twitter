import Arweave from "arweave/node";
import retry  from 'async-retry';
import axios from "axios"
const fs= require('fs')
//const WALLET_FILE = process.env.WALLET_FILE
//const privateKey = JSON.parse(fs.readFileSync(WALLET_FILE))

const client = Arweave.init({host: 'arweave.net', port: 443, protocol: 'https' });
client.api.config.timeout = 1000 * 60 * 1.5;

const getTagsWithRetry= async(id, numRetries = 10) => {
    var tags = []


    await retry(async() => {

        var ax = axios.create()
        const response = await ax.get(`https://arweave.net/tx/${id}/tags`, {timeout: client.api.config.timeout }); 
        if (response.status === 200) {
            console.log(JSON.stringify(response.data))
            tags = response.data;
        } else {
            throw new Error("HTTP error "+response.status+" on get tx tags from Arweave Gateway")
        }
    },{retries: numRetries})

    return tags
}

const getDataWithRetry= async(id, numRetries = 10) => {
    var data = []


    await retry(async() => {

        var ax = axios.create()
        const response = await ax.get(`https://arweave.net/tx/${id}/data`, {timeout: client.api.config.timeout }); 
        if (response.status === 200) {
            console.log(JSON.stringify(response.data))
            data = response.data;
        } else {
            throw new Error("HTTP error "+response.status+" on get tx tags from Arweave Gateway")
        }
    },{retries: numRetries})

    return data
}


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

const getTxWithRetry=async(txid, part="all", numRetries = 10) => {
    
    var tx = null
    await retry(async() => {
        tx = await client.transactions.get(txid)
    }, {retries: numRetries})

    return tx
}


export { client, arqlWithRetry, getTxWithRetry }