import { Db } from 'mongodb'

declare interface LeaderConstructorOptions {
    id?: string,
    ttl?: number,
    key?: string,
}

declare class Leader {
    constructor(db: Db, options?: LeaderConstructorOptions)
    initDatabase(): Promise<boolean>
    elect(): Promise<boolean>
    cleanup(): Promise<void>
}
