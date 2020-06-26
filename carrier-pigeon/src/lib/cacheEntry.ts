const sizeOf = require('object-sizeof');


class CacheEntry {
    key: string
    size: number
    createdAt: number
    expiresAt: number = 0
    lastAccessedAt: number = 0
    accessCount: number = 0

    constructor(key, item, maxAge = 0) {
        this.key = key
        this.size = sizeOf(item)
        this.createdAt = Date.now()
        if (maxAge != 0)
            this.expiresAt = this.createdAt + maxAge
    }
}
export {CacheEntry}
