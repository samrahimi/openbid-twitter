const creds = require(process.env.TWITTER_CREDENTIALS || './creds.json')
const BOT_ACCOUNT_NAME = process.env.TWEETY_BOT || 'ArweaveAPI' 
const Twitter = require("twitter")
const client = new Twitter(creds)

client.post('statuses/update', {status: 'sf5ei...oyss8 wants to BUY 6000 WEVE for AR 500. Interested? Reply "ACCEPT" (full details @ https://openbid.perma.website)'})
  .then(function (tweet) {
    console.log(tweet);
  })
  .catch(function (error) {
    throw error;
  })


  //listener: listen on @ArweaveAPI
  //check for keywords: ACCEPT, CREATE
  //on ACCEPT:
  //1: check DB: is it a reply to a "new open bid" bot tweet?
  //2: write to blockchain however cedrik's doing it on the web side
  //3: RT the accept: "@SamRahimi is buying 6000 weve for 300 USD from @TwitterUser / 0xarweaveAddr"
  //4: indicate in DB that the bid is no longer open

  //on CREATE: 
  // 1: validate bid creation syntax (CREATE buy|sell 6000 weve 300 USD) 
  //"weve" can also be the token address (and if the tokens are not searchable by symbol then we need to do that in the db)
  // 2: create a bid on the blockchain using cedrik's existing code
  // 3: directly write the new open bid to the DB, and tweet it out (MAYBE)
  // (or just wait for it to hit the blockchain, and let the blockchain watcher handle it)

  //   
  //
  //if msg is well formed
    //accept the bid 