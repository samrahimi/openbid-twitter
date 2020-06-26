const uuid = require("uuid")
import retry  from 'async-retry';

const appName="Viral-Tweet"
const appVersion = "0.1.3"
const bundleSize = 100
var rowCount
var offset=0

import {createSubTx} from './lib/arweaveManager'
import {writeRecursiveTx} from './lib/bundle'
const sizeOf = require('object-sizeof');

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("../../tweetbot/tweets.db");


const getChunk = () => {
    return new Promise<Array<any>>((resolve) => {
        db.all(`select  * from tweets limit ${bundleSize} offset ${offset}`, (res, rows) => {
            console.log("Offset: "+offset)
            //console.log(JSON.stringify(rows))
            offset += bundleSize
            resolve(rows)
        })
    })
}


db.all(`select count(*) from tweets`, async(res, rows) => {
        rowCount = rows[0]["count(*)"]
        console.log(`rowCount: ${rowCount}`)

        while (offset < rowCount) {
            var rowset = await getChunk()
            var transactions = await Promise.all(rowset.map(async(row) => {
                var data = JSON.parse(row["text"])

                var tags = [
                {name: "tweet_id", value: data["id_str"]}, 
                {name: data["screen_name"]}] 

                return createSubTx(data, tags)
            }))
            console.log("Writing tx bundle:")
            console.log(sizeOf(transactions))
            var result = null
            await retry(async() => {
                try{
                result = await writeRecursiveTx(appName, appVersion, transactions)
                }catch(err) {
                    throw err
                }
            }, {retries: 10})
            
            if (result == null)
                console.log("FAIL on chunk ending at "+offset)

        }
})