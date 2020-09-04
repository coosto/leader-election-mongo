# leader-election-mongo

A leader election package which uses MongoDB. A single leader is chosen from a
group of instances in a single, non-recurring election.

## Use cases

This package is useful when doing a single election for tasks such as a
once-daily cron job (as opposed to having a group of instances continuously
trying to determine a leader). It is intended for a relatively small number
of instances, such as 5 or 10, not 10,000.

## Install

```bash
npm install leader-election-mongo
```
## Example
Here is an example using promises:
```javascript
const crypto = require('crypto')
const { Leader } = require('leader-election-mongo')
const { MongoClient } = require('mongodb')

const url = 'mongodb://localhost:27017'

MongoClient.connect(
    url,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
    function (err, client) {
        const id = process.pid + '-' + crypto.randomBytes(8).toString('hex')
        const db = client.db('leadertest')
        const candidate = new Leader(db, { id, ttl: 10000 })

        candidate
            .initDatabase()
            .then(collectionExists => {
                if (collectionExists) {
                    return candidate.elect()
                }
                console.log(`${id} collection was not initialized!`)
                process.exit()
            })
            .then(isLeader => {
                if (isLeader) {
                    console.log(`${id} is the LEADER`)
                    // do your stuff here
                    return candidate.cleanup()
                } else {
                    console.log(`${id} is not the leader`)
                    process.exit()
                }
            })
            .then(() => {
                console.log(`${id} Cleanup finished`)
                process.exit()
            })
    }
)
```

This package can also be used with async/await:
```javascript
const crypto = require('crypto')
const { Leader } = require('leader-election-mongo')
const { MongoClient } = require('mongodb')

const url = 'mongodb://localhost:27017'

MongoClient.connect(
    url,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
    async function (err, client) {
        const id = process.pid + '-' + crypto.randomBytes(8).toString('hex')
        const db = client.db('leadertest')
        const candidate = new Leader(db, { id })

        const collectionExists = await candidate.initDatabase()
        if (!collectionExists) {
            console.log(`${id} collection was not initialized!`)
            process.exit()
        }

        const isLeader = await candidate.elect()
        if (!isLeader) {
            console.log(`${id} is not the leader`)
            process.exit()
        }

        console.log(`${id} is the LEADER`)
        // do your stuff here

        await candidate.cleanup()
        console.log(`${id} Cleanup finished`)
        process.exit()
    }
)
```
## API

### new Leader(db, options)

Create a new Leader class.

`db` is a MongoClient.Db object.

`options.id` is an optional ID for this instance. Default is a random hex string.

`options.ttl` is the lock time-to-live in milliseconds. Will be automatically
released after that time. The default and minimum value is 5000.

If the provided MongoClient.Db object doesn't have admin privileges, the TTL
cleanup will only happen every 60 seconds (the MongoDB default) which might
cause a problem if the leader doesn't call `cleanup()` and you try to run
multiple elections within 60 seconds.

`options.key` is a unique identifier for the group of instances trying to be
elected as leader. Default value is 'default'


### initDatabase()

Initializes the election collection. Returns a promise that resolves to a
boolean indicating whether the collection exists.

### elect()

Performs the election and returns a promise that resolves to `true` if the
instance is the leader; otherwise, `false`.

### cleanup()

Removes the election collection. Returns a promise that resolves to void.

### Events

`elected` The event fired when the instance becomes a leader.

`cleaned` The event fired when the cleanup is finished.

## License

See the LICENSE file (spoiler alert, it's Apache-2.0).

## Credits

Inspired by the [mongo-leader](https://github.com/andrewmolyuk/mongo-leader)
package, but with a modified API and different election algorithm.
