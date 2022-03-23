/**
 * Manage access to data, be it to find, update or remove it
 *
 */
import * as _ from 'lodash'
import { Datastore } from "./Datastore"
import { Model } from './Model'

/**
 * Create a new cursor for this collection
 * @param {Datastore} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 * @param {Function} execFunction - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
 */
export class Cursor {
    private readonly _db: Datastore
    private readonly _query
    private readonly _execFn
    private _limit
    private _skip
    private _sort
    private _projection

    public constructor(db: Datastore, query?: object, execFunction?: Function) {
        this._db = db
        this._query = query || {}
        this._execFn = execFunction ?? null
    }

    /**
     * Set a limit to the number of results
     */
    public limit (limit) {
        this._limit = limit

        return this
    }

    public skip (skip) {
        this._skip = skip

        return this
    }

    /**
     * Sort results of the query
     * @param {SortQuery} sortQuery - SortQuery is { field: order }, field can use the dot-notation, order is 1 for ascending and -1 for descending
     */
    public sort(sortQuery) {
        this._sort = sortQuery

        return this
    };


    /**
     * Add the use of a projection
     * @param {Object} projection - MongoDB-style projection. {} means take all fields. Then it's { key1: 1, key2: 1 } to take only key1 and key2
     *                              { key1: 0, key2: 0 } to omit only key1 and key2. Except _id, you can't mix takes and omits
     */
    public projection(projection) {
        this._projection = projection

        return this
    };


    /**
     * Apply the projection
     */
    public project(candidates) {
        const res = []
        let keepId, action, keys

        if(this._projection === undefined || Object.keys(this._projection).length === 0) {
            return candidates
        }

        keepId = this._projection._id === 0 ? false : true
        this._projection = _.omit(this._projection, '_id')

        // Check for consistency
        keys = Object.keys(this._projection)
        _.each(keys, k => {
            if(action !== undefined && this._projection[k] !== action) {
                throw new Error("Can't both keep and omit fields except for _id")
            }

            action = this._projection[k]
        })

        // Do the actual projection
        _.each(candidates, candidate => {
            let toPush

            if(action === 1) {   // pick-type projection
                toPush = { $set: {} }

                _.each(keys, k => {
                    toPush.$set[k] = Model.getDotValue(candidate, k)

                    if(toPush.$set[k] === undefined) { delete toPush.$set[k] }
                })

                toPush = Model.modify({}, toPush)
            } else {   // omit-type projection
                toPush = { $unset: {} }
                keys.forEach(function (k) { toPush.$unset[k] = true })
                toPush = Model.modify(candidate, toPush)
            }

            if(keepId) {
                toPush._id = candidate._id;
            } else {
                delete toPush._id;
            }

            res.push(toPush);
        })

        return res
    }


    /**
     * Get all matching elements
     * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
     * This is an internal function, use exec which uses the executor
     *
     * @param {Function} callback - Signature: err, results
     */
    private _exec(_callback) {
        var res = []
            , added = 0
            , skipped = 0
            , error = null
            , keys
            , key
            ;

        function callback(error, res?) {
            if(this.execFn) {
                return this._execFn(error, res, _callback);
            } else {
                return _callback(error, res);
            }
        }

        this._db.getCandidates(this._query, function(err, candidates) {
            if(err) { return callback(err) }

            try {
                _.forEach(candidates, function(c) {
                    if(Model.match(c, this._query)) {
                        // If a sort is defined, wait for the results to be sorted before applying limit and skip
                        if(!this._sort) {
                            if(this._skip && this._skip > skipped) {
                                skipped += 1
                            } else {
                                res.push(c)
                                added += 1

                                if(this._limit && this._limit <= added) { return false }
                            }
                        } else {
                            res.push(c)
                        }
                    }
                })
            } catch (err) {
                return callback(err);
            }

            // Apply all sorts
            if(this._sort) {
                keys = Object.keys(this._sort)

                // Sorting
                var criteria = []

                _.each(keys, function(k) {
                    //criteria.push({ key: k, direction: this._sort[k] })
                    criteria.push({ key: k, direction: this._sort })
                })

                res.sort(function(a, b) {
                    let compare

                    _.each(criteria, function (c) {
                        compare = c.direction * Model.compareThings(Model.getDotValue(a, c.key), Model.getDotValue(b, c.key), this._db.compareStrings);

                        if(compare !== 0) {
                            return compare;
                        }
                    })

                    return 0
                })

                // Applying limit and skip
                var limit = this._limit || res.length
                    , skip = this._skip || 0

                res = res.slice(skip, skip + limit)
            }

            // Apply projection
            try {
                res = this.project(res)
            } catch (e) {
                error = e
                res = undefined
            }

            return callback(error, res)
        })
    }

    public exec(args?: any) {
        this._db.executor.push({ this: this, fn: this._exec, arguments: args })
    }
}1