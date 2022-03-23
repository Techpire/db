import { StringUtil } from "../utils"
import { IPersistenceOptions, PersistenceOptions } from "./PersistenceOptions"

export interface IDataStoreOptions extends IPersistenceOptions {
    autoload?: boolean
    compareStrings?: Function
    filename?: string
    inMemoryOnly?: boolean
    onLoad?: Function
    timestampData?: boolean
}

export class DatastoreOptions extends PersistenceOptions {
    public autoload?: boolean = false
    public compareStrings?: Function
    public filename?: string
    public inMemoryOnly?: boolean = false
    public onload?: Function
    public timestampData?: boolean = false

    constructor(options?: IDataStoreOptions) {
        super(options)

        if(options) {
            if(StringUtil.IsNullOrWhiteSpace(this.filename)) {
                this.filename = options.filename ?? null
                this.inMemoryOnly = false
            } else {
                this.filename = options.filename
                this.inMemoryOnly = options.inMemoryOnly || false
            }

            this.autoload = options.autoload ?? false
            this.compareStrings = options.compareStrings ?? null
            this.filename = options.filename ?? null
            this.onload = options.onLoad ?? null
            this.timestampData = options.timestampData ?? false
        }
    }
}
