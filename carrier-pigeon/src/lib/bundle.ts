const pendingBundles = {}
const WALLET_FILE = process.env.WALLET_FILE
const fs = require('fs')
const EventEmitter = require('events')
import {client} from './arweaveManager'

//transactions should be array of Transaction, signed but not paid for
//they will not be mined, they will be indexed on this server and as tags of the meta-tx
const writeRecursiveTx = async(appName, appVersion, transactions, useInternalTxidsAsTags=false) => {
        
        const arweave = client
        
        const privateKey = JSON.parse(fs.readFileSync(WALLET_FILE))
        const address= await arweave.wallets.jwkToAddress(privateKey)
        const tx = await arweave.createTransaction({data: JSON.stringify(transactions)}, privateKey)
        tx.addTag("Content-Type", "application/javascript")
        tx.addTag("App-Name", appName)
        tx.addTag("App-Version", appVersion)

        tx.addTag("Recursive-Tx-Version", "1")
        tx.addTag("Recursive-Tx-Encoding", "json")

        //compatibility with old-style arweave gateways for lookup
        if (useInternalTxidsAsTags) {
            transactions.forEach(transaction => {
                tx.addTag(transaction.id, "1")
            })
        }
        await arweave.transactions.sign(tx, privateKey);
        const response = await arweave.transactions.post(tx);
    
        console.log(`Recursive-Tx is posted and will be mined shortly. Check status at https://viewblock.io/arweave/tx/${tx.id}`);
        return response
    }

const bundleKey = (appName, appVersion) => {
    return `${appName}_${appVersion}`
}

class Bundle extends EventEmitter
{
    appName: string
    appVersion: string
    maxItems: number
    transactions: Array<any>

    addTransaction(signedTx) {
        this.transactions.push(signedTx)
        if (this.transactions.length >= this.maxItems) {
            writeRecursiveTx(this.appName, this.appVersion, this.transactions).then(pendingTx => {
                this.emit('write_bundle', pendingTx)
            })
            this.transactions = []
            this.emit("new_bundle")
        }
    }
    static getOrCreate(appName, appVersion, maxItems = 100) {
        var key = bundleKey(appName, appVersion)
        if (pendingBundles[key])
            return pendingBundles[key]
        else {
            pendingBundles[key] = new Bundle(appName, appVersion, maxItems)
            return pendingBundles[key]
        }
    }
    constructor(appName, appVersion, maxItems) {
        super()

        this.appName = appName
        this.appVersion = appVersion
        this.maxItems = maxItems
    }
}

export {Bundle, writeRecursiveTx}