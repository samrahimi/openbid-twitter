const creds = require(process.env.TWITTER_CREDENTIALS || './creds.json')
const BOT_ACCOUNT_NAME = process.env.TWEETY_BOT || 'ArweaveAPI' 
const Twitter = require("twitter")
const client = new Twitter(creds)
import {getNextBidFromQueue, updateBidQueue, markAsTweeted} from './model/bids'



  const syncFromArweave = () => {
    updateBidQueue().then((count) => {
      console.log(`arweave sync complete. ${count} bids added to queue`)
    })
  }

  const tweetNextBid = () => {
    getNextBidFromQueue().then(bid => {
      if (bid == null)
        console.log("Nothing in queue")
      else {
        console.log("Tweeting bid txid "+bid.txid)
        client.post('statuses/update', {status: `${bid.bidder_id} wants to ${bid.bid_type} ${bid.bid_token_quantity} ${bid.token_name} for ${bid.bid_amount} ${bid.bid_currency}. Interested? Contact bidder. Learn more @ https://openbid.perma.website)`})
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


  setInterval(syncFromArweave, 15 * 60 * 1000)
  setInterval(tweetNextBid, 1 * 60 * 1000)

  //that's all folks.