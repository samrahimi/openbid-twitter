# carrier-pigeon.
In-memory caching layer for Arweave transaction data and arql query results.
Currently pass-through / reverse proxy that sits 
between a client dApp and the Arweave public gateway. 

# dev setup
npm install && npm start

# run as a service for production
npm install && npm run service

Note: runs on port 8888 by default when running as a service, to match the settings in co-reverse-proxy... 
you can change the port in package.json

# usage

See comments in [src/api.ts](src/api.ts) for each route. Note that /invalidate is not yet supporte


Next version to support pass-through writing of transactions, adding them to the 
cache and posting them to the Arweave network to be mined. 

This uses express and a couple of middleware helpers to do reverse proxying and/or mounting of other express
apps and express-greenlock for LE cert renewel.

With this we can choose either  

- proxy to any other service, local or remote. Based on vhost + path.
- import sibling project that uses express and mount as an express app, on vhost + path.

See [src/app.ts](src/app.ts) for examples of both.
