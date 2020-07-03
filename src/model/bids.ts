import {db} from '../lib/db'
import {client, arqlWithRetry, getTxWithRetry, writeTagsOnlyTx} from '../lib/arweave'

const AppVersion = process.env.APP_VERSION || null //used in ARQL query if not null

//The main idea: we have a db table that we use to store the bids
//as they are discovered through polling or manual querying of arweave
//we can then tweet each bid only once, and not repeat ourselves
//this also gives us a local store of all bids for other apps to query

const getContactUrlFromBidderId= (bidderId, bidderSource='arweave') => {
    if (bidderSource == 'arweave')
        return 'https://wqpddejmpwo6.arweave.net/RlUqMBb4NrvosxXV6e9kQkr2i4X0mqIAK49J_C3yrKg/index.html#/inbox/to='+bidderId
}
//adds new bids to the db
//assumes that the bids have been retrieved from arweave and filtered against existing bids in the db
const updateBidQueue = async(bids) => {
    //write them to the db, table "queue" with status "queued"
    //TODO
    console.log(JSON.stringify(bids, null, 2));

    
    for (var bid of bids) {
        await db.query(`insert into openbid.open_bids
                  (bidder_user_id, bid_txid, bidder_contact_url, status, bid_type, 
                   bid_token_id, bid_amount, bid_currency, bid_quantity, bid_token_name)
                  values
                  (
                      '${bid.tags.Source.toLowerCase() == "twitter"? bid.tags["Twitter-User"] : bid.owner}', '${bid.id}', '${bid.tags.Source.toLowerCase() != "twitter" ? getContactUrlFromBidderId(bid.owner): "@"+bid.tags["Twitter-User"]}', 'queued', '${bid.tags.Type == '0' ? "buy":"sell"}',
                      '${bid.tags.Token}', '${bid.tags.Price}', '${bid.tags.Currency}', '${bid.tags.Amount}', '${bid.tags.Token.substr(0, 10)}...'
                  )`)
    }
    return true
}

//call no more than once a minute if you're not buffering...
//the twitter API will rate limit you for tweeting more often than that
//note that bursts of up to 15 tweets are OK, in any 15 minute period
const getNextBidFromQueue = async() => {
    //last in first out: get the oldest queued bid
    var result = await db.query(`
    select * from openbid.open_bids 
    where status='queued'
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
            token_name: bid.bid_token_name,
            contact_url: bid.bidder_contact_url
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

const createBid = async(bidder, type, amount, token, price, currency) => {
    //TODO: write a tx tagged appropriately
    try 
    {
        var tags = [{
            "name": "Type",
            "value": type == "buy" ? "0" : "1"
        }, {
            "name": "Token", 
            "value": token
        },
        {
            "name": "Price",
            "value": price
        },
        {
            "name": "Currency",
            "value": currency
        },
        {
            "name": "Amount",
            "value": amount
        },
        {
            "name": "Twitter-User",
            "value": bidder
        }]
        console.log(JSON.stringify(tags, null, 2))
        const txid = await writeTagsOnlyTx(tags)
        return txid
    } catch (err) {
        console.log(err)
        return null
    }
}

export {markAsTweeted, getNextBidFromQueue, updateBidQueue, updateBidStatus, createBid}