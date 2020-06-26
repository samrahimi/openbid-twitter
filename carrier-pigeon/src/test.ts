import axios from "axios"
var uuid = require("uuid")

var appName="Recursive-Test"
var appVersion = "0.1.0"
import {createSignedTx} from './lib/arweaveManager'
import {writeRecursiveTx} from './lib/bundle'



const doit = async() => {
    var nums = [1,2,3,4,5]
    var signedTransactions = await Promise.all(
        nums.map(async(num) => {
            var data = uuid.v4()+"But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?"
            var tags = [{"my-test-id": uuid.v4()}]
    
            return createSignedTx(data, tags, false)
        })
    )
    
    var result = await writeRecursiveTx(appName, appVersion, signedTransactions)
}


for (var i=1; i<=2; i++) {
    doit()
}