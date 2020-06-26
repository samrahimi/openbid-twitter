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
    //return # of new bids added
}

//call no more than once a minute if you're not buffering...
//the twitter API will rate limit you for tweeting more often than that
//note that bursts of up to 15 tweets are OK, in any 15 minute period
const getNextBidFromQueue = async() => {
    //last in first out: get the oldest queued bid
    var result = await db.query(`
    select * from openbid.open_bids 
    where status='pending'
    order by id asc limit 1`)

    if (result.rows.length == 0)
        return null //nothing in queue

    var bid = result.rows[0]

    //mark the status as pending, removing it from the queue
    await updateBidStatus(bid.id, 'pending')

    var obj = {
            id: bid.id,
            txid: bid.bid_txid,
            bidder_id: bid.bidder_user_id,
            bidder_platform: bid.bidder_user_id.startsWith('@' ? 'twitter':'weve'),
            bid_type: bid.bid_type,
            bid_amount: bid.bid_amount,
            bid_currency: bid.bid_currency,
            bid_token_quantity: bid.bid_quantity,
            token_id: bid.bid_token_id,
            token_name: bid.bid_token_name
    }
    return obj
}


const updateBidStatus = async(id, status) => {
    var result = await db.query(`
                update openbid.open_bids
                set status='pending'
                where id='${id}'`
            )
    return result

}

const markAsTweeted = async(bid_id, tweet_id) => {
    //update the specified bid after you tweet it out
    var result = await db.query(`
        update openbid.open_bids
        set status='tweeted', twitter_id_str='${tweet_id}'
        where id='${bid_id}'`
    )
    return result

}

export {markAsTweeted, getNextBidFromQueue, updateBidQueue, updateBidStatus}