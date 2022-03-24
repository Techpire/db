import { waterfall } from "async"
import _ from "lodash"
import path from "path"
import { Datastore } from "./Datastore"
import { Indexer } from "./Indexer"
import { Model } from "./Model"
import { PersistenceOptions } from "./models/PersistenceOptions"
import { Storage } from "./Storage"

/**
 * Create a new Persistence object for database options.db
 * @param {Datastore} options.db
 * @param {Boolean} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 */
export class Persistence {
    private _autocompactionIntervalId: any  // TS has new errors every time when trying to pin down a specific type here
    private _options: PersistenceOptions
    private _db: Datastore
    private _afterSerialization
    private _corruptAlertThreshold
    private _beforeDeserialization

    public constructor(options: PersistenceOptions) {
        this._options = options
        this._db = options.db

        // TODO: handle null database option

        /*
        var i, j, randomString;

        ;
        this.inMemoryOnly = this.db.inMemoryOnly;
        this.filename = this.db.filename;
        this.corruptAlertThreshold = options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;

        if (!this.inMemoryOnly && this.filename && this.filename.charAt(this.filename.length - 1) === '~') {
            throw new Error("The datafile name can't end with a ~, which is reserved for crash safe backup files");
        }
        */

        // After serialization and before deserialization hooks with some basic sanity checks
        if(options.afterSerialization && !options.beforeDeserialization) {
            throw new Error("Serialization hook defined but deserialization hook undefined, cautiously refusing to start NeDB to prevent dataloss")
        }

        if(!options.afterSerialization && options.beforeDeserialization) {
            throw new Error("Serialization hook undefined but deserialization hook defined, cautiously refusing to start NeDB to prevent dataloss")
        }

        this._afterSerialization = options.afterSerialization || function (s) { return s; }
        this._beforeDeserialization = options.beforeDeserialization || function (s) { return s; }

        let randomString = "ASLDKFJ19084737z*(S7D68761239874RSD7F*)&^967858 ~!@#$%^&*(qieybadfobiupbqiutyhasd;hty!"

        if(this._beforeDeserialization(this._afterSerialization(randomString)) !== randomString) {
            throw new Error("beforeDeserialization is not the reverse of afterSerialization, cautiously refusing to start NeDB to prevent dataloss")
        }



        /*
        // For NW apps, store data in the same directory where NW stores application data
        if (this.filename && options.nodeWebkitAppName) {
            console.log("==================================================================");
            console.log("WARNING: The nodeWebkitAppName option is deprecated");
            console.log("To get the path to the directory where Node Webkit stores the data");
            console.log("for your app, use the internal nw.gui module like this");
            console.log("require('nw.gui').App.dataPath");
            console.log("See https://github.com/rogerwang/node-webkit/issues/500");
            console.log("==================================================================");
            this.filename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.filename);
        }
        */
    }

    /**
     * Check if a directory exists and create it on the fly if it is not the case
     * cb is optional, signature: err
     */
    public static ensureDirectoryExists = function(dir, cb) {
        var callback = cb ?? function () {}

        Storage.mkdirp(dir, function(err) {
            return callback(err)
        })
    };

    /**
     * Return the path the datafile if the given filename is relative to the directory where Node Webkit stores
     * data for this application. Probably the best place to store data
     *
    Persistence.getNWAppFilename = function (appName, relativeFilename) {
        var home;

        switch (process.platform) {
            case 'win32':
            case 'win64':
                home = process.env.LOCALAPPDATA || process.env.APPDATA;
                if (!home) { throw new Error("Couldn't find the base application data folder"); }
                home = path.join(home, appName);
                break;
            case 'darwin':
                home = process.env.HOME;
                if (!home) { throw new Error("Couldn't find the base application data directory"); }
                home = path.join(home, 'Library', 'Application Support', appName);
                break;
            case 'linux':
                home = process.env.HOME;
                if (!home) { throw new Error("Couldn't find the base application data directory"); }
                home = path.join(home, '.config', appName);
                break;
            default:
                throw new Error("Can't use the Node Webkit relative path for platform " + process.platform);
                break;
        }

        return path.join(home, 'nedb-data', relativeFilename);
    }


    /**
     * Persist cached database
     * This serves as a compaction function since the cache always contains only the number of documents in the collection
     * while the data file is append-only so it may grow larger
     * @param {Function} cb Optional callback, signature: err
     */
    public persistCachedDatabase(cb: Function) {
        /*
        var callback = cb || function () { }
            , toPersist = ''
            , self = this
            ;

        if (this.inMemoryOnly) { return callback(null); }

        this.db.getAllData().forEach(function (doc) {
            toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
        });
        Object.keys(this.db.indexes).forEach(function (fieldName) {
            if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
                toPersist += self.afterSerialization(model.serialize({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse } })) + '\n';
            }
        });

        storage.crashSafeWriteFile(this.filename, toPersist, function (err) {
            if (err) { return callback(err); }
            self.db.emit('compaction.done');
            return callback(null);
        });
        */
    }


    /**
     * Queue a rewrite of the datafile
     */
    public compactDatafile() {
        this._db.executor.push({ this: this, fn: this.persistCachedDatabase, arguments: [] });
    };


    /**
     * Set automatic compaction every interval ms
     * @param {number} interval in milliseconds, with an enforced minimum of 5 seconds
     */
    public setAutocompactionInterval(interval: number) {
        const minInterval = 5000
        const realInterval = Math.max((interval ?? 0), minInterval)

        this.stopAutocompaction()

        this._autocompactionIntervalId = setInterval(function() {
            this.compactDatafile()
        }, realInterval)
    }


    /**
     * Stop autocompaction (do nothing if autocompaction was not running)
     */
    public stopAutocompaction() {
        if(this._autocompactionIntervalId)
            clearInterval(this._autocompactionIntervalId)
    }

    /**
     * Persist new state for the given newDocs (can be insertion, update or removal)
     * Use an append-only format
     * @param {Array} newDocs Can be empty if no doc was updated/removed
     * @param {Function} cb Optional, signature: err
     */
    public persistNewState(newDocs: any[], cb: Function) {
        /*
        var self = this
            , toPersist = ''
            , callback = cb || function () { }
            ;

        // In-memory only datastore
        if (self.inMemoryOnly) { return callback(null); }

        newDocs.forEach(function (doc) {
            toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
        });

        if (toPersist.length === 0) { return callback(null); }

        storage.appendFile(self.filename, toPersist, 'utf8', function (err) {
            return callback(err);
        });
        */
    }


    /**
     * From a database's raw data, return the corresponding
     * machine understandable collection
     */
    public treatRawData(rawData: string) {
        let data = rawData.split('\n')
        let dataById = {}
        let tdata = []
        let indexes = {}
        let corruptItems = -1   // Last line of every data file is usually blank so not really corrupt

        _.each(data, (line) => {
            let doc

            try {
                doc = Model.deserialize(this._beforeDeserialization(line))

                if(doc._id) {
                    if(doc.$$deleted === true) {
                        delete dataById[doc._id]
                    } else {
                        dataById[doc._id] = doc
                    }
                } else if(doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
                    indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated
                } else if(typeof doc.$$indexRemoved === "string") {
                    delete indexes[doc.$$indexRemoved]
                }
            } catch (e) {
                corruptItems += 1
            }
        })

        // A bit lenient on corruption
        if(data.length > 0 && corruptItems / data.length > this._corruptAlertThreshold) {
            throw new Error(`More than ${ Math.floor(100 * this._corruptAlertThreshold) }% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start NeDB to prevent dataloss`);
        }

        _.each(Object.keys(dataById), k => {
            tdata.push(dataById[k])
        })

        return { data: tdata, indexes: indexes }
    }


    /**
     * Load the database
     * 1) Create all indexes
     * 2) Insert all data
     * 3) Compact the database
     * This means pulling data out of the data file or creating it if it doesn't exist
     * Also, all data is persisted right away, which has the effect of compacting the database file
     * This operation is very quick at startup for a big collection (60ms for ~10k docs)
     * @param {Function} cb Optional callback, signature: err
     */
    public loadDatabase(cb?: Function) {
        let callback = cb ?? function() { }
        let self = this

        this._db.resetIndexes()

        // In-memory only datastore
        if(this._db.inMemoryOnly && this._db.inMemoryOnly == true) { return callback(null) }

        waterfall([
            function(cb) {
                Persistence.ensureDirectoryExists(path.dirname(self._db.fileName), function(err) {
                    Storage.ensureDatafileIntegrity(self._db.fileName, function(err) {
                        Storage.readFile(self._db.fileName, 'utf8', function(err, rawData) {
                            if(err) { return cb(err) }

                            let treatedData

                            try {
                                treatedData = self.treatRawData(rawData)
                            } catch(e) {
                                return cb(e)
                            }

                            // Recreate all indexes in the datafile
                            _.each(Object.keys(treatedData.indexes), function(key) {
                                self._db.indexes[key] = new Indexer(treatedData.indexes[key])
                            })

                            // Fill cached database (i.e. all indexes) with data
                            try {
                                self._db.resetIndexes(treatedData.data)
                            } catch (e) {
                                self._db.resetIndexes() // Rollback any index which didn't fail
                                return cb(e)
                            }

                            self._db.persistence.persistCachedDatabase(cb)
                        })

                        cb(err)
                    })

                    cb(err)
                })
            }
        ], function(err) {
            if(err) { return callback(err) }

            self._db.executor.processBuffer()

            return callback(null)
        })
    }
}