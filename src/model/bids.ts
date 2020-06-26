import {db} from '../lib/db'
const AppVersion = process.env.APP_VERSION || null //used in ARQL query if not null

//The main idea: we have a db table that we use to store the bids
//as they are discovered through polling or manual querying of arweave
//we can then tweet each bid only once, and not repeat ourselves
//this also gives us a local store of all bids for other apps to query

//call this every 15 mins or so to check for new bids
const updateBidQueue = async() => {
    //use arql to get all open bid txids
    //query the db for txids we already have, and remove those from the result set
    //get bid details for each new txid
    //write them to the db, table "queue" with status "queued"
}

//call no more than once a minute if you're not buffering...
//the twitter API will rate limit you for tweeting more often than that
//note that bursts of up to 15 tweets are OK, in any 15 minute period
const getBidFromQueue = async() => {
    //query db for oldest bid that's still queued
    //update status to "pending"
    //return the bid
}

const markAsTweeted = async(txid) => {
    //update the specified bid after you tweet it out
}