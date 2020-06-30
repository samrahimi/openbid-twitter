const creds = require(process.env.TWITTER_CREDENTIALS || './creds.json')
const BOT_ACCOUNT_NAME = process.env.TWEETY_BOT || 'ArweaveAPI' 
const Twitter = require("twitter")
const client = new Twitter(creds)

import {arqlWithRetry, getTxWithRetry} from './lib/arweave'
import {and, equals} from 'arql-ops'; 

import {getNextBidFromQueue, updateBidQueue, markAsTweeted} from './model/bids'
import { db } from './lib/db'



  const syncFromArweave = async() => {
    var query = and(
      equals('App-Name', 'OpenBid'),
      equals('App-Version', '0.0.1')
    )
    var bidTxids = await arqlWithRetry(query)
    console.log('total bids: '+ bidTxids.length)
    if (bidTxids.length == 0)
      return 0

    //filter out any txids already in our database
    var result = await db.query(`select * from openbid.open_bids`)
    if (result.rows.length > 0 ) {
      bidTxids = bidTxids.filter(txid => !(result.rows.map(row => row.bid_txid).includes(txid)))
    }

    console.log('new bids: '+ bidTxids.length)

    //get the tx data
    var bids = await Promise.all(bidTxids.map(txid => getTxWithRetry(txid, 'tags')))
    console.log('got bids from arweave')
    await updateBidQueue(bids)
    console.log(`arweave sync complete. ${bids.length} bids added to queue`)
    return bids.length
  }

  const tweetNextBid = () => {
    getNextBidFromQueue().then(bid => {
      if (bid == null)
        console.log("Nothing in queue")
      else {
        console.log("Tweeting bid txid "+bid.txid)
        client.post('statuses/update', {status: `Offer to ${bid.bid_type} ${bid.bid_token_quantity} ${bid.token_name} for ${bid.bid_amount} ${bid.bid_currency}. ${bid.contact_url}`})
        .then (function (tweet) {
          console.log(tweet);
          markAsTweeted(bid.id, tweet.id_str)
          console.log("All done")
        })
        .catch(function (error) {
          throw error;
        })
      }
    })
  }

  syncFromArweave().then((count) => {
    console.log('initial sync complete. queue will be processed at 1 bid per minute')
    console.log('setting timers')

    setInterval(syncFromArweave, 15 * 60 * 1000)
    setInterval(tweetNextBid, 1 * 60 * 1000)
  })
  //that's all folks.