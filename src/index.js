const crypto = require('crypto')
const { EventEmitter } = require('events')

/**
 * Provides the ability to elect a leader from a group of instances.
 */
class Leader extends EventEmitter {
    /**
     * Sets the database client and options.
     *
     * @param {Db} db - A Db from MongoClient
     * @param {Object} options
     * @param {string} options.id - A unique ID for the instance
     * @param {number} options.ttl - Lock time-to-live in ms
     * @param {string} options.key - Key used to group instances. All instances
     * in the same election group should have the same key.
     */
    constructor(db, options) {
        super()
        options = options || {}
        this.db = db
        this.id = options.id || crypto.randomBytes(32).toString('hex')
        this.ttl = Math.max(options.ttl || 0, 5000)
        this.key =
            'leader-' +
            crypto
                .createHash('sha1')
                .update(options.key || 'default')
                .digest('hex')
        this.ttlTime = Date.now() + this.ttl
    }

    /**
     * Initializes the collection used for electing a leader.
     *
     * If the provided db connection doesn't have admin privileges, the TTL
     * cleanup will only happen every `ttlMonitorSleepSecs` seconds (60 by
     * default).
     *
     * @returns {Promise} Promise object which resolves to a boolean indicating
     * whether the database is initialized.
     */
    initDatabase() {
        return this.db
            .command({ ping: 1 })
            .then(() =>
                this.db.executeDbAdminCommand({
                    setParameter: 1,
                    ttlMonitorSleepSecs: 1
                })
            )
            .catch(() => {
                // Ignore errors from executeDbAdminCommand() as the db
                // connection may not have admin privileges
                return
            })
            .then(() => this.db.createCollection(this.key))
            .then(collection =>
                collection.createIndex(
                    { createdAt: 1 },
                    { expireAfterSeconds: this.ttl / 1000 }
                )
            )
            .then(() => true)
            .catch(err => {
                if (err.codeName === 'NamespaceExists') {
                    return true
                }
                throw err
            })
    }

    /**
     * Elects a leader.
     *
     * @fires Leader#elected
     * @returns {Promise} Promise object which resolves to a boolean indicating
     * whether this instance is the leader.
     */
    elect() {
        return this.db
            .collection(this.key)
            .insertOne({ leaderId: this.id, createdAt: new Date() })
            .then(() => {
                this.ttlTime = Date.now() + this.ttl
                return this.db.collection(this.key).findOne(
                    {},
                    {
                        sort: { createdAt: 1, _id: 1 },
                        projection: { leaderId: 1 }
                    }
                )
            })
            .then(result => {
                if (result.leaderId === this.id) {
                    this.emit('elected')
                    return true
                }
                return false
            })
    }

    /**
     * Removes the collection used for leader election. This should only be
     * called by the elected leader.
     *
     * @fires Leader#cleaned
     * @returns {Promise} Promise object which resolves to void.
     */
    cleanup() {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
        return wait(this.ttlTime - Date.now()).then(() => {
            this.db.dropCollection(this.key)
            this.emit('cleaned')
        })
    }
}

module.exports = { Leader }
