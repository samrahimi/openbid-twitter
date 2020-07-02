const creds = require(process.env.TWITTER_CREDENTIALS || './creds.json')
const BOT_ACCOUNT_NAME = process.env.TWEETY_BOT || 'ArweaveAPI' 
const Twitter = require("twitter")
const client = new Twitter(creds)

import {arqlWithRetry, getTxWithRetry} from './lib/arweave'
import {and, equals} from 'arql-ops'; 

import {getNextBidFromQueue, updateBidQueue, markAsTweeted, createBid} from './model/bids'
import { db } from './lib/db'

const listenForTweets= () => {

  //TODO: use webhooks... this is not the right way to create an autoresponder
  //but this will be fine for POC
  var stream = client.stream('statuses/filter', {track: 'ArweaveAPI'});

  console.log('listening for tweets on @'+BOT_ACCOUNT_NAME)
  stream.on('data', (event) => {
    console.log("got incoming tweet!")
    if (!event.text.startsWith('@ArweaveAPI'))
    {
      console.log("not a bid. tweet contents: "+ event.text)
      return
    }

    console.log("tweet text: "+event.text)

    var tokenized = event.text.toLowerCase().split(' ')
    var twitterUser = event.user.screen_name

    if (tokenized.length >= 6 && (tokenized[1] == 'buy' || tokenized[1] == 'sell'))
    {
          console.log(tokenized[1]+" received from "+twitterUser)
          createBid(twitterUser, tokenized[1], tokenized[2], tokenized[3], tokenized[4], tokenized[5])
          .then((txid) => {
            if (txid != null)
              tweetConfirmation(twitterUser, txid)
            else {
              console.log("parse error. bid failed")
            }
          })
    } else {
      console.log("parse error. bid failed")
    }
  })

  stream.on('error', function(error) {
    console.log(`Twitter API error: `+JSON.stringify(error))
  });        
}

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
  const tweetConfirmation = (bidder, txid) => {
    client.post('statuses/update', 
      {
        status: `New bid from @${bidder} received, posting to Arweave. Status: https://viewblock.io/arweave/tx/${txid}`
      }
    ).then((tweet => {
      console.log(JSON.stringify(tweet, null, 2))
    }))
  }
  const tweetNextBid = () => {
    getNextBidFromQueue().then(bid => {
      if (bid == null)
        console.log("Nothing in queue")
      else {
        console.log("Tweeting bid txid "+bid.txid)
        client.post('statuses/update', {status: `Offer to ${bid.bid_type} ${bid.bid_token_quantity} ${bid.token_name} for ${bid.bid_amount} ${bid.bid_currency}. MSG: ${bid.contact_url}`})
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

  listenForTweets()

  //that's all folks.