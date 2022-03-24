import { Datastore } from "../Datastore"

export interface IPersistenceOptions {
    db?: Datastore
    nodeWebkitAppName?: string
    afterSerialization?: Function
    beforeDeserialization?: Function
    corruptAlertThreshold?: number
}

export class PersistenceOptions {
    public db?: Datastore
    public nodeWebkitAppName?: string
    public afterSerialization?: Function
    public beforeDeserialization?: Function
    public corruptAlertThreshold?: number

    constructor(options?: IPersistenceOptions) {
        if(options) {
            this.db = options.db ?? null
            this.nodeWebkitAppName = options.nodeWebkitAppName ?? null
            this.afterSerialization = options.afterSerialization ?? null
            this.beforeDeserialization = options.beforeDeserialization ?? null
            this.corruptAlertThreshold = options.corruptAlertThreshold ?? 0.1
        }
    }
}