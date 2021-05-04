// , util = require('util')

import { AvlTree } from '@datastructures-js/binary-search-tree'
//import { BinarySearchTree } from '@datastructures-js/binary-search-tree'
import _ from 'lodash'
import { Model } from './Model'

export class Indexer {
    private _fieldName: string
    private _isUniqueKeys: boolean
    private _tree: any

    /**
     * Create a new index
     * All methods on an index guarantee that either the whole operation was successful and the index changed
     * or the operation was unsuccessful and an error is thrown while the index is unchanged
     * @param {String} fieldName On which field should the index apply (can use dot notation to index on sub fields)
     * @param {Boolean} unique Optional, enforce a unique constraint (default: false)
     * @param {Boolean} sparse Optional, allow a sparse index (we can have documents for which fieldName is undefined) (default: false)
     */
    constructor(fieldName: string, unique: boolean = false) {
        this._fieldName = fieldName
        this._isUniqueKeys = unique || false
        //this._tree = new BinarySearchTree()
        this._tree = new AvlTree()

        this.reset()   // No data in the beginning
    }

    /**
     * Reset an index
     * @param {Document or Array of documents} newData Optional, data to initialize the index with.  If an error is thrown during insertion, the index is not modified
     */
    public reset() {
        this._tree?.clear()
    }

    /**
     * Gets the number of nodes in the tree
     * @param doc
     * @returns
     */
    public count() {
        return this._tree.count()
    }

    /**
     * Get all elements in the index
     * @param {boolean} isFullTree For amusement.  This will return all the details of each node not really needed beyond testing purposes
     * @return {Array of documents}
     */
    public getAll(isFullTree: boolean = false) {
        const res: any[] = []

        this._tree.traverseInOrder(function(node: any) {
            if(!isFullTree)
                res.push(node.getValue())
            else
                res.push(node)
        })

        return res
    }

    /**
     * Insert a new document in the index
     * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
     * O(log(n))
     */
    public insert(doc: any) {
        if(_.isArray(doc)) {
            try {
                doc.forEach((d: any) => {
                    //const oldDoc = this._tree.find(Model.getDotValue(doc, this._fieldName))
                    this.insert(d)
                })

                return
            } catch(e) {
                // TODO: This doesn't work exactly right.  If a document fails, the old version should be restored.
                // If isUniqueKeys is false and doc 1 and 2 succeed, unique , and #3 fails, docs 1 and 2 are just lost despite already existing.
                doc.forEach((d: any) => {
                    this._tree.remove(Model.getDotValue(doc, this._fieldName))
                })

                throw e
            }
        }

        const key = Model.getDotValue(doc, this._fieldName)

        // We don't index documents that don't contain the field if the index is sparse
        if(key == null) { throw new Error("Key cannot be null or undefined") }

        // TODO: Not checking the key for primitive types would technically allow for objects as keys.
        if(_.isArray(key)) { throw new Error("Cannot use an array for an index") }
        if(this._isUniqueKeys && this._tree.has(key))
            throw new Error("Cannot insert key " + key + ", it violates the unique constraint")

        this._tree.insert(key, doc)
    }

    /**
     * Remove a document from the index
     * If an array is passed, we remove all its elements
     * The remove operation is safe with regards to the 'unique' constraint
     * O(log(n))
     * @param doc A document, array of documents, index value, or array of index values to remove.
     */
    public remove(doc: any) {
        let key

        if(_.isArray(doc)) {
            doc.forEach((d: any) => {
                this.remove(d)
            })
        } else if (typeof doc == 'object') {
            // TODO: This should probably only remove the object if it's a deep equal
            // if this._fieldName = x
            // insert { x: 1, y: 2 }, insert { x: 1, y: 3 }
            // remove { x: 1, y: 2 } would remove { x: 1, y: 3 }
            key = Model.getDotValue(doc, this._fieldName)
        } else {
            key = doc
        }

        //if(key == null) { return }
        if(this._tree.has(key)) {
            this._tree.remove(key)
        }
    }


    /**
     * Update a document in the index
     * If a constraint is violated, changes are rolled back and an error thrown
     * Naive implementation, still in O(log(n))
     */
    public update(oldDoc: any, newDoc?: any) {
        /*
        if(_.isArray(oldDoc)) {
            this.updateMultipleDocs([oldDoc])
            return
        }
        */

        this.remove(oldDoc)

        try {
            this.insert(newDoc)
        } catch(e) {
            this.insert(oldDoc)
            throw e
        }
    }

    /**
     * Update multiple documents in the index
     * If a constraint is violated, the changes need to be rolled back
     * and an error thrown
     * @param {Array of oldDoc, newDoc pairs} pairs
     *
     * @API private
     *
    public updateMultipleDocs(pairs: [any?, any?]) {
        let failingI
        let error

        for(let i = 0; i < pairs.length; i++) {
            this.remove(pairs[i].oldDoc)
        }

        for(let i = 0; i < pairs.length; i++) {
            try {
                this.insert(pairs[i].newDoc)
            } catch (e) {
                error = e
                failingI = i
                break
            }
        }

        // If an error was raised, roll back changes in the inverse order
        if(error) {
            for(let i = 0; i < failingI; i += 1) {
                this.remove(pairs[i].newDoc)
            }

            for(let i = 0; i < pairs.length; i += 1) {
                this.insert(pairs[i].oldDoc)
            }

            throw error
        }
    }


    /**
     * Revert an update
     *
    public revertUpdate(oldDoc: any, newDoc: any) {
        const revert: any[] = []

        if(!_.isArray(oldDoc)) {
            this.update(newDoc, oldDoc)
        } else {
            oldDoc.forEach(function (pair) {
                revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc })
            })

            this.update(revert)
        }
    }


    /**
     * Get document in tree whose key match the given key value (if it is a Thing)
     * Unlike the original NeDB implementation, this will not insert duplicate keys, so we expect 1 value to be returned.
     * @param {Thing} key Value to match the key against
     * @return {Array of documents}
     */
    public find(key: object | string | number | boolean): any {
        return this._tree.find(key)?.getValue()
    }

    public findAll(key: any[]) : any {
        let res = []

        key.forEach(e => {
            var val = this._tree.find(key)?.getValue()
            if(val) {
                res.push(val)
            }
        })
    }

    /**
     * Get all documents in index whose key is between bounds are they are defined by query
     * Documents are sorted by key
     * @param {Query} query
     * @return {Array of documents}
     *
    public getBetweenBounds(query: any) {
        return this._tree.betweenBounds(query)
    }



    /**
     * Two indexed pointers are equal iif they point to the same place
     *
    private checkValueEquality(a: any, b: any) {    // TODO: This should probably be number | string
        return a === b
    }

    /**
     * Type-aware projection
     *
    private projectForUnique(elt: any) {
        if (elt === null) { return '$null'; }
        if (typeof elt === 'string') { return '$string' + elt; }
        if (typeof elt === 'boolean') { return '$boolean' + elt; }
        if (typeof elt === 'number') { return '$number' + elt; }
// ???        if (_.isArray(elt)) { return '$date' + elt.getTime(); }

        return elt;   // Arrays and objects, will check for pointer equality
    }
    */
}
