import util from 'util'
import * as _ from 'lodash'

/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 * Querying, update
 */
export module Model {
    let modifierFunctions: any = {}

    /**
     * Check a key, throw an error if the key is non valid
     * @param {String} k key
     * @param {Model} v value, needed to treat the Date edge case
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    function checkKey(k: string, v: any) {
        if(typeof k === 'number') {
            k = (k as number).toString()
        }

        if(k[0] === '$' && !(k === '$$date' && typeof v === 'number') && !(k === '$$deleted' && v === true) && !(k === '$$indexCreated') && !(k === '$$indexRemoved')) {
            throw new Error('Field names cannot begin with the $ character')
        }

        if(k.indexOf('.') !== -1) {
            // console.log('check key: ' + k)
            throw new Error('Field names cannot contain a .')
        }
    }

    /**
     * Check a DB object and throw an error if it's not valid
     * Works by applying the above checkKey function to all fields recursively
     */
    export function checkObject(obj: any): any {
        // a little 'future proofing' https://dmitripavlutin.com/is-array-javascript/
        if(_.isArray(obj)) {
            obj.forEach(function(o: any) {
                checkObject(o)
            })
        }

        if(typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(function(k) {
                checkKey(k, obj[k])
                checkObject(obj[k])
            })
        }
    }

    /**
     * Serialize an object to be persisted to a one-line string
     * For serialization/deserialization, we use the native JSON parser and not eval or Function
     * That gives us less freedom but data entered in the database may come from users
     * so eval and the like are not safe
     * Accepted primitive types: Number, String, Boolean, Date, null
     * Accepted secondary types: Objects, Arrays
     */
    export function serialize(obj: any): string {
        var res

        res = JSON.stringify(obj, function (k, v) {
            checkKey(k, v)

            if(v === undefined) { return undefined }
            if(v === null) { return null }

            // Hackish way of checking if object is Date (this way it works between execution contexts in node-webkit).
            // We can't use value directly because for dates it is already string in this function (date.toJSON was already called), so we use this
            if(typeof this[k].getTime === 'function') { return { $$date: this[k].getTime() } }

            return v
        })

        return res
    }

    /**
     * From a one-line representation of an object generate by the serialize function
     * Return the object itself
     */
    export function deserialize(rawData: string): any {
        return JSON.parse(rawData, function (k, v) {
            if(k === '$$date') { return new Date(v) }
            if(typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v }
            if(v && v.$$date) { return v.$$date }

            return v
        })
    }

    /**
     * Deep copy a DB object
     * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
     * where the keys are valid, i.e. don't begin with $ and don't contain a .
     */
    export function deepCopy(obj: any, strictKeys: boolean = false) {
        let res: any = null

        if(typeof obj === 'boolean'
                || typeof obj === 'number'
                || typeof obj === 'string'
                || obj === null
                || (util.types.isDate(obj))) {
            return obj
        } else if(_.isArray(obj)) {
            res = []

            obj.forEach(function(o: any) {
                res.push(deepCopy(o, strictKeys))
            })

            return res
        } else if(typeof obj === 'object') {
            res = {}

            Object.keys(obj).forEach(function (k) {
                if(!strictKeys || (k[0] !== '$' && k.indexOf('.') === -1)) {
                    //console.log(k)
                    res[k] = deepCopy(obj[k], strictKeys)
                }
            })

            return res
        }

        // For now everything else is undefined. We should probably throw an error instead
        return undefined
    }

    /**
     * Tells if an object is a primitive type or a "real" object
     * Arrays are considered primitive
     */
    export function isPrimitiveType(obj: any) {
        // TODO: revisit the ordering here for slight performance gain order from most likely to least likely
        return (typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string'
            || obj === null || util.types.isDate(obj) || _.isArray(obj))
    }

    /**
     * Utility functions for comparing things
     * Assumes type checking was already done (a and b already have the same type)
     * compareNSB works for numbers, strings and booleans
     */
    function compareNSB(a: number | string | boolean, b: number | string | boolean ) {
        if (a < b) { return -1 }
        if (a > b) { return 1 }

        return 0
    }

    function compareArrays(a: Array<any>, b: Array<any>) {
        var i, comp

        for(i = 0; i < Math.min(a.length, b.length); i += 1) {
            comp = compareThings(a[i], b[i])

            if(comp !== 0) { return comp }
        }

        // Common section was identical, longest one wins
        return compareNSB(a.length, b.length)
    }

    /**
     * Compare { things U undefined }
     * Things are defined as any native types (string, number, boolean, null, date) and objects
     * We need to compare with undefined as it will be used in indexes
     * In the case of objects and arrays, we deep-compare
     * If two objects dont have the same type, the (arbitrary) type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
     * Return -1 if a < b, 1 if a > b and 0 if a = b (note that equality here is NOT the same as defined in areThingsEqual!)
     *
     * @param {Function} compareStrings String comparing function, returning -1, 0 or 1, overriding default string comparison (useful for languages with accented letters)
     */
    export function compareThings(a: any, b: any, compareStrings?: Function): number {
        let aKeys, bKeys, comp, i
        compareStrings = compareStrings ?? compareNSB

        // undefined
        if(a === undefined) { return b === undefined ? 0 : -1 }
        else if(b === undefined) { return a === undefined ? 0 : 1 }

        // null
        else if(a === null) { return b === null ? 0 : -1 }
        else if(b === null) { return a === null ? 0 : 1 }

        // Numbers
        else if(typeof a === 'number') { return typeof b === 'number' ? compareNSB(a, b) : -1 }
        else if(typeof b === 'number') { return typeof a === 'number' ? compareNSB(a, b) : 1 }

        // Strings
        else if(typeof a === 'string') { return typeof b === 'string' ? compareStrings(a, b) : -1; }
        else if(typeof b === 'string') { return typeof a === 'string' ? compareStrings(a, b) : 1; }

        // Booleans
        else if(typeof a === 'boolean') { return typeof b === 'boolean' ? compareNSB(a, b) : -1; }
        else if(typeof b === 'boolean') { return typeof a === 'boolean' ? compareNSB(a, b) : 1; }

        // Dates
        else if(util.types.isDate(a)) { return util.types.isDate(b) ? compareNSB(a.getTime(), b.getTime()) : -1; }
        else if(util.types.isDate(b)) { return util.types.isDate(a) ? compareNSB(a.getTime(), b.getTime()) : 1; }

        // Arrays (first element is most significant and so on)
        else if(_.isArray(a)) { return _.isArray(b) ? compareArrays(a, b) : -1 }
        else if(_.isArray(b)) { return _.isArray(a) ? compareArrays(a, b) : 1 }

        // Objects
        aKeys = Object.keys(a).sort()
        bKeys = Object.keys(b).sort()

        for(i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
            comp = compareThings(a[aKeys[i]], b[bKeys[i]])

            if (comp !== 0) { return comp }
        }

        return compareNSB(aKeys.length, bKeys.length)
    }

    // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     * @param {Object} obj The model to modify
     * @param {String} field Can contain dots, in that case that means we will set a subfield recursively
     * @param {Model} value
     */
    const lastStepModifierFunctions = {
        /**
         * Set a field to a new value
         */
        $set: function(obj: any, field: string, value: any): void {
            let canSet = true

            // NOTE: This may be flawed logic, but the unit tests work
            if(field.indexOf('.') > -1) {
                let path = ''
                let val

                for(let x of field.split('.').slice(0, -1)) {
                    path += x
                    val = _.get(obj, path)

                    if(val == undefined) {
                        canSet = true
                        break
                    } else if(typeof val == 'object' || _.isArray(val)) {
                        canSet = true
                    } else {
                        canSet = false
                    }

                    path += '.'
                }
            }

            if(canSet)
                _.set(obj, field, value)
        },

        /**
         * Unset a field
         */
        $unset: function(obj: any, field: string): void {
            _.unset(obj, field)
        },

        /**
         * Push an element to the end of an array field
         * Optional modifier $each instead of value to push several values
         * Optional modifier $slice to slice the resulting array, see https://docs.mongodb.org/manual/reference/operator/update/slice/
         * Différeence with MongoDB: if $slice is specified and not $each, we act as if value is an empty array
         */
        $push: function(obj: any, field: string, value: any): void {
            // Create the array if it doesn't exist
            if(!_.has(obj, field)) { _.set(obj, field, []) }

            const arrayField = _.get(obj, field)
            if(!_.isArray(arrayField)) { throw new Error("Can't $push an element on non-array values") }

            if(value !== null && typeof value === 'object' && value.$slice && value.$each === undefined) {
                value.$each = []
            }

            if(value !== null && typeof value === 'object' && value.$each) {
                if(Object.keys(value).length >= 3 || (Object.keys(value).length === 2 && value.$slice === undefined)) {
                    throw new Error("Can only use $slice in cunjunction with $each when $push to array")
                }

                if(!_.isArray(value.$each)) {
                    throw new Error("$each requires an array value")
                }

                value.$each.forEach(function (v: any) {
                    obj[field].push(v)
                })

                if(value.$slice === undefined || typeof value.$slice !== 'number') { return }

                if(value.$slice === 0) {
                    _.set(obj, field, [])
                } else {
                    var start, end, n = arrayField.length

                    if(value.$slice < 0) {
                        start = Math.max(0, n + value.$slice)
                        end = n
                    } else if (value.$slice > 0) {
                        start = 0
                        end = Math.min(n, value.$slice)
                    }

                    _.set(obj, field, arrayField.slice(start, end))
                }
            } else {
                arrayField.push(value)
            }
        },

        /**
         * Add an element to an array field only if it is not already in it
         * No modification if the element is already in the array
         * Note that it doesn't check whether the original array contains duplicates
         */
        $addToSet: function(obj: any, field: string, value: any): void {
            var addToSet = true

            // Create the array if it doesn't exist
            if(!obj.hasOwnProperty(field)) { obj[field] = [] }

            if(!_.isArray(obj[field])) { throw new Error("Can't $addToSet an element on non-array values") }

            if(value !== null && typeof value === 'object' && value.$each) {
                if(Object.keys(value).length > 1) { throw new Error("Can't use another field in conjunction with $each") }
                if(!_.isArray(value.$each)) { throw new Error("$each requires an array value") }

                value.$each.forEach(function (v: any | any[]) {
                    lastStepModifierFunctions.$addToSet(obj, field, v)
                })
            } else {
                obj[field].forEach(function (v: any | any[]) {
                    if(compareThings(v, value) === 0) { addToSet = false; }
                })

                if(addToSet) { obj[field].push(value) }
            }
        },

        /**
         * Remove the first or last element of an array
         */
        $pop: function(obj: any, field: string, value: any): void {
            if (!_.isArray(obj[field])) { throw new Error("Can't $pop an element from non-array values") }
            if (typeof value !== 'number') { throw new Error(value + " isn't an integer, can't use it with $pop") }
            if (value === 0) { return }

            if (value > 0) {
                obj[field] = obj[field].slice(0, obj[field].length - 1)
            } else {
                obj[field] = obj[field].slice(1)
            }
        },

        /**
         * Removes all instances of a value from an existing array
         */
        $pull(obj: any, field: string, value: any) {
            if(!_.isArray(obj[field])) { throw new Error("Can't $pull an element from non-array values"); }

            const arr = obj[field]
            for(let i = arr.length - 1; i >= 0; i -= 1) {
                if(match(arr[i], value)) {
                    arr.splice(i, 1)
                }
            }
        },

        /**
         * Increment a numeric field's value
         */
        $inc: function(obj: any, field: string, value: number): void {
            if(typeof value !== 'number') { throw new Error(value + " must be a number") }

            let val = _.get(obj, field)
            if(val != null && typeof val !== 'number') { throw new Error("Don't use the $inc modifier on non-number fields") }

            if(_.has(obj, field))
                _.set(obj, field, val += value)
            else
                _.set(obj, field, value)
        },

        /**
         * Updates the value of the field, only if specified field is greater than the current value of the field
         */
        $max: function(obj: any, field: string, value: any): void {
            if(!_.has(obj, field) || value > _.get(obj, field))
                _.set(obj, field, value)
        },

        /**
         * Updates the value of the field, only if specified field is smaller than the current value of the field
         */
        $min: function(obj: any, field: string, value: any): void {
            if(!_.has(obj, field) || value < _.get(obj, field))
                _.set(obj, field, value)
        }
    } as const

    // Given its name, create the complete modifier function
    function createModifierFunction(modifier: string): any {
        return function(obj: any, field: string, value: any) {
            const fieldParts = typeof field === 'string' ? field.split('.') : field

            if(fieldParts.length === 1) {
                (lastStepModifierFunctions as any)[modifier](obj, field, value);
            } else {
                if(obj[fieldParts[0]] === undefined) {
                    if(modifier === '$unset') // Bad looking specific fix, needs to be generalized modifiers that behave like $unset are implemented
                        return

                    obj[fieldParts[0]] = {}
                }

                modifierFunctions[modifier](obj[fieldParts[0]], fieldParts.slice(1), value)
            }
        }
    }

    // Actually create all modifier functions
    Object.keys(lastStepModifierFunctions).forEach(function(modifier) {
        modifierFunctions[modifier] = createModifierFunction(modifier)
    })

    /**
     * Modify a DB object according to an update query
     */
    export function modify(obj: any, updateQuery: any) {
        let keys = Object.keys(updateQuery)
        const firstChars = _.map(keys, function (item) { return item[0] })
        const dollarFirstChars = _.filter(firstChars, function (c) { return c === '$' })
        let newDoc: any

        if(keys.indexOf('_id') !== -1 && updateQuery._id !== obj._id) { throw new Error("You cannot change a document's _id"); }

        if(dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
            throw new Error("You cannot mix modifiers and normal fields")
        }

        if(dollarFirstChars.length === 0) {
            // Simply replace the object with the update query contents
            newDoc = deepCopy(updateQuery)
            newDoc._id = obj._id
        } else {
            // Apply modifiers
            const modifiers = _.uniq(keys)
            newDoc = deepCopy(obj)

            modifiers.forEach(function(m: any) {
                if(!modifierFunctions[m]) { throw new Error("Unknown modifier " + m) }

                // Can't rely on Object.keys throwing on non objects since ES6
                // Not 100% satisfying as non objects can be interpreted as objects but no false negatives so we can live with it
                if(typeof updateQuery[m] !== 'object') {
                    throw new Error("Modifier " + m + "'s argument must be an object")
                }

                keys = Object.keys(updateQuery[m])
                keys.forEach(function(k) {
                    (lastStepModifierFunctions as any)[m](newDoc, k, updateQuery[m][k])
                })
            })
        }

        // Check result is valid and return it
        checkObject(newDoc)

        if(obj._id !== newDoc._id) { throw new Error("You can't change a document's _id") }

        return newDoc
    }

    // ==============================================================
    // Finding documents
    // ==============================================================
    /**
     * @deprecated - After clearing matchQueryPart of the reference to this, it will be removed.
     * Get a value from object with dot notation
     * @param {Object} obj
     * @param {String} field
     */
    export function getDotValue(obj: any, field: any): any {
        const fieldParts = typeof field === 'string' ? field.split('.') : field

        if(!obj) { return undefined }   // field cannot be empty so that means we should return undefined so that nothing can match

        if(fieldParts.length === 0) { return obj }

        if(fieldParts.length === 1) { return obj[fieldParts[0]] }

        if(_.isArray(obj[fieldParts[0]])) {
            // If the next field is an integer, return only this item of the array
            let i = parseInt(fieldParts[1], 10)
            if(typeof i === 'number' && !isNaN(i)) {
                return getDotValue(obj[fieldParts[0]][i], fieldParts.slice(2))
            }

            // Return the array of values
            const objs = new Array()
            for(let x = 0; x < obj[fieldParts[0]].length; x += 1) {
                objs.push(getDotValue(obj[fieldParts[0]][x], fieldParts.slice(1)))
            }

            return objs
        } else {
            return getDotValue(obj[fieldParts[0]], fieldParts.slice(1))
        }
    }

    /**
     * Check whether 'things' are equal
     * Things are defined as any native types (string, number, boolean, null, date) and objects
     * In the case of object, we check deep equality
     * Returns true if they are, false otherwise
     */
    export function areThingsEqual(a: any | any[], b: any | any[]) {
        let aKeys, bKeys

        // Strings, booleans, numbers, null
        if(a === null || typeof a === 'string' || typeof a === 'boolean' || typeof a === 'number'
                || b === null || typeof b === 'string' || typeof b === 'boolean' || typeof b === 'number')
            return a === b

        // Dates
        if(util.types.isDate(a) || util.types.isDate(b))
            return util.types.isDate(a) && util.types.isDate(b) && a.getTime() === b.getTime()

        // Arrays (no match since arrays are used as a $in)
        // undefined (no match since they mean field doesn't exist and can't be serialized)
        if((!(_.isArray(a) && _.isArray(b)) && (_.isArray(a) || _.isArray(b))) || a === undefined || b === undefined)
            return false

        // General objects (check for deep equality)
        // a and b should be objects at this point
        try {
            aKeys = Object.keys(a)
            bKeys = Object.keys(b)
        } catch (e) {
            return false
        }

        if(aKeys.length !== bKeys.length)
            return false

        for(let i = 0; i < aKeys.length; i++) {
            if(bKeys.indexOf(aKeys[i]) === -1) { return false }
            if(!areThingsEqual(a[aKeys[i]], b[aKeys[i]])) { return false }
        }

        return true
    }

    /**
     * Check that two values are comparable
     */
    function areComparable(a: any | any[], b: any | any[]) {
        if(typeof a !== 'string' && typeof a !== 'number' && !util.types.isDate(a)
                && typeof b !== 'string' && typeof b !== 'number' && !util.types.isDate(b)) {
            return false
        }

        if(typeof a !== typeof b) { return false; }

        return true
    }


    /**
     * Arithmetic and comparison operators
     * @param {Native value} a Value in the object
     * @param {Native value} b Value in the query
     */
    const comparisonFunctions = {
        $lt(a: any, b: any) {
            return areComparable(a, b) && a < b
        }
        , $lte(a: any, b: any) {
            return areComparable(a, b) && a <= b
        }, $gt(a: any, b: any) {
            return areComparable(a, b) && a > b
        }, $gte(a: any, b: any) {
            return areComparable(a, b) && a >= b
        }, $ne(a: any, b: any) {
            if (a === undefined) { return true }
            return !areThingsEqual(a, b)
        }, $in(a: any, b: any) {
            var i

            if(!_.isArray(b)) { throw new Error("$in operator called with a non-array") }

            for(i = 0; i < b.length; i += 1) {
                if(areThingsEqual(a, b[i])) { return true }
            }

            return false
        }, $nin(a: any, b: any) {
            if (!_.isArray(b)) { throw new Error("$nin operator called with a non-array"); }

            return !comparisonFunctions.$in(a, b) // TODO: this.$in?
        }, $regex(a: any, b: any) {
            if(!util.types.isRegExp(b)) { throw new Error("$regex operator called with non regular expression") }

            if(typeof a !== 'string') {
                return false
            } else {
                return b.test(a)
            }
        }, $exists(value: any, exists: any) {
            if(exists || exists === '') {   // This will be true for all values of exists except false, null, undefined and 0
                exists = true               // That's strange behaviour (we should only use true/false) but that's the way Mongo does it...
            } else {
                exists = false
            }

            if(value === undefined) {
                return !exists
            } else {
                return exists
            }
        }, $size(obj: any, value: any) { // Specific to arrays
            if(!_.isArray(obj)) { return false }
            if(value % 1 !== 0) { throw new Error("$size operator called without an integer") }

            return (obj.length == value)
        }
        , $elemMatch(obj: any, value: any) {
            if(!_.isArray(obj)) { return false }
            let  i = obj.length
            let result = false   // Initialize result

            while(i--) {
                if (match(obj[i], value)) {   // If match for array element, return true
                    result = true
                    break
                }
            }

            return result
        }
    }

    const arrayComparisonFunctions = {
        $size: true
        , $elemMatch: true
    }

    /**
     * Match any of the subqueries
     * @param {Model} obj
     * @param {Array of Queries} query
     */
    const logicalOperators = {
        $or: function(obj: any, query: any) {
            if (!_.isArray(query)) { throw new Error("$or operator used without an array"); }

            for(let i = 0; i < query.length; i += 1) {
                if(match(obj, query[i])) { return true; }
            }

            return false
        },

        /**
         * Match all of the subqueries
         * @param {Model} obj
         * @param {Array of Queries} query
         */
        $and: function(obj: any, query: any) {
            if (!_.isArray(query)) { throw new Error("$and operator used without an array"); }

            for (let i = 0; i < query.length; i += 1) {
                if(!match(obj, query[i]))
                    return false
            }

            return true
        },

        /**
         * Inverted match of the query
         * @param {Model} obj
         * @param {Query} query
         */
        $not: function(obj: any, query: any) {
            return !match(obj, query)
        },

        /**
         * Use a function to match
         * @param {Model} obj
         * @param {Query} query
         */
        $where: function(obj: any, fn: any) {
            var result

            if(!_.isFunction(fn)) { throw new Error("$where operator used without a function") }

            result = fn.call(obj)
            if(!_.isBoolean(result)) { throw new Error("$where function must return boolean") }

            return result
        }
    }

    /**
     * Tell if a given document matches a query
     * @param {Object} obj Document to check
     * @param {Object} query
     */
    export function match(obj: any, query: any): boolean {
        // Primitive query against a primitive type
        // This is a bit of a hack since we construct an object with an arbitrary key only to dereference it later
        // But I don't have time for a cleaner implementation now
        if(isPrimitiveType(obj) || isPrimitiveType(query)) {
            return matchQueryPart({ needAKey: obj }, 'needAKey', query)
        }

        // Normal query
        const queryKeys = Object.keys(query)
        for(let i = 0; i < queryKeys.length; i += 1) {
            const queryKey = queryKeys[i]
            const queryValue = query[queryKey]

            if (queryKey[0] === '$') {
                if (!(logicalOperators as any)[queryKey]) { throw new Error("Unknown logical operator " + queryKey); }
                if (!(logicalOperators as any)[queryKey](obj, queryValue)) { return false; }
            } else {
                if (!matchQueryPart(obj, queryKey, queryValue)) { return false; }
            }
        }

        return true
    }

    /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
    function matchQueryPart(obj: any, queryKey: string, queryValue: any, treatObjAsValue?: boolean): any {
        const objValue = getDotValue(obj, queryKey)

        // Check if the value is an array if we don't force a treatment as value
        if(_.isArray(objValue) && !treatObjAsValue) {
            // If the queryValue is an array, try to perform an exact match
            if(_.isArray(queryValue)) {
                return matchQueryPart(obj, queryKey, queryValue, true)
            }

            // Check if we are using an array-specific comparison function
            if(queryValue !== null && typeof queryValue === 'object' && !util.types.isRegExp(queryValue)) {
                const keys = Object.keys(queryValue)

                for(let i = 0; i < keys.length; i += 1) {
                    if((arrayComparisonFunctions as any)[keys[i]]) { return matchQueryPart(obj, queryKey, queryValue, true) }
                }
            }

            // If not, treat it as an array of { obj, query } where there needs to be at least one match
            for(let i = 0; i < objValue.length; i += 1) {
                if(matchQueryPart({ k: objValue[i] }, 'k', queryValue)) { return true }   // k here could be any string
            }

            return false
        }

        // queryValue is an actual object. Determine whether it contains comparison operators
        // or only normal fields. Mixed objects are not allowed
        if(queryValue !== null && typeof queryValue === 'object' && !util.types.isRegExp(queryValue) && !_.isArray(queryValue)) {
            const keys = Object.keys(queryValue)
            const firstChars = _.map(keys, function (item) { return item[0]; })
            const dollarFirstChars = _.filter(firstChars, function (c) { return c === '$'; })

            if(dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
                throw new Error("You cannot mix operators and normal fields")
            }

            // queryValue is an object of this form: { $comparisonOperator1: value1, ... }
            if(dollarFirstChars.length > 0) {
                for(let i = 0; i < keys.length; i += 1) {
                    if(!(comparisonFunctions as any)[keys[i]]) { throw new Error("Unknown comparison function " + keys[i]) }

                    if(!(comparisonFunctions as any)[keys[i]](objValue, queryValue[keys[i]])) { return false }
                }

                return true
            }
        }

        // Using regular expressions with basic querying
        if(util.types.isRegExp(queryValue)) { return comparisonFunctions.$regex(objValue, queryValue) }

        // queryValue is either a native value or a normal object
        // Basic matching is possible
        if(!areThingsEqual(objValue, queryValue)) { return false }

        return true
    }
}
