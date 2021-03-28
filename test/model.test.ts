import * as chai from 'chai'
import { expect } from 'chai'
import Datastore from '../src/Datastore'
import fs from 'fs'
import { Model } from '../src/Model'
import util from 'util'

const assert = require('assert')

describe('Model', function() {
    describe('Serialization, deserialization', function() {
        it('Can serialize and deserialize strings', function() {
            let a = { test: "Some string" }
            let b = Model.serialize(a)
            let c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal("Some string", c.test)

            // Even if a property is a string containing a new line, the serialized
            // version doesn't. The new line must still be there upon deserialization
            a = { test: "With a new\nline" }
            b = Model.serialize(a)
            c = Model.deserialize(b)

            assert.equal("With a new\nline", c.test)
            assert.notEqual(-1, a.test.indexOf('\n'))
            assert.equal(-1, b.indexOf('\n'))
            assert.notEqual(-1, c.test.indexOf('\n'))
        })


        it('Can serialize and deserialize booleans', function() {
            const a = { test: true }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(true, c.test)
        })

        it('Can serialize and deserialize numbers', function() {
            const a = { test: 5 }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(5, c.test)
        })

        it('Can serialize and deserialize null', function() {
            const a: any = { test: null }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(null, a.test)
        })

        it('undefined fields are removed when serialized', function() {
            const a: any = { bloup: undefined, hello: 'world' }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(1, Object.keys(c).length)
            assert.equal('world', c.hello)
            assert.equal(undefined, c.bloup)
        })

        it('Can serialize and deserialize a date', function() {
            const d = new Date()
            const a: any = { test: d }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(`{"test":{"$$date":${ d.getTime() }}}`, b)
            assert.equal(true, util.types.isDate(c.test))
            assert.equal(d.getTime(), c.test.getTime())
        })

        it('Can serialize and deserialize sub objects', function() {
            const d = new Date()
            const a: any = { test: { something: 39, also: d, yes: { again: 'yes' } } }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(39, c.test.something)
            assert.equal(d.getTime(), c.test.also.getTime())
            assert.equal('yes', c.test.yes.again)
        })

        it('Can serialize and deserialize sub arrays', function() {
            const d = new Date()
            const a = { test: [39, d, { again: 'yes' }] }
            const b = Model.serialize(a)
            const c = Model.deserialize(b)

            assert.equal(-1, b.indexOf('\n'))
            assert.equal(39, c.test[0])
            assert.equal(d.getTime(), c.test[1].getTime())
            assert.equal('yes', c.test[2].again)
        })

        it('Reject field names beginning with a $ sign or containing a dot, except the four edge cases', function() {
            const a1: any = { $something: 'totest' }
            const a2: any = { "with.dot": 'totest' }
            const e1: any = { $$date: 4321 }
            const e2: any = { $$deleted: true }
            const e3: any = { $$indexCreated: "indexName" }
            const e4: any = { $$indexRemoved: "indexName" }
            let b

            // Normal cases
            expect(function() { b = Model.serialize(a1) }).to.throw()
            expect(function() { b = Model.serialize(a2) }).to.throw()

            // Edge cases
            b = Model.serialize(e1)
            b = Model.serialize(e2)
            b = Model.serialize(e3)
            b = Model.serialize(e4)
        })
/*
        it('Can serialize string fields with a new line without breaking the DB', function(done) {
            var db1, db2
                , badString = "world\r\nearth\nother\rline"


            if (fs.existsSync('workspace/test1.db')) { fs.unlinkSync('workspace/test1.db'); }
            fs.existsSync('workspace/test1.db').assert.equal(false)
            db1 = new Datastore({ filename: 'workspace/test1.db' })

            db1.loadDatabase(function(err) {
                assert.isNull(err)
                db1.insert({ hello: badString }, function(err) {
                    assert.isNull(err)

                    db2 = new Datastore({ filename: 'workspace/test1.db' })
                    db2.loadDatabase(function(err) {
                        assert.isNull(err)
                        db2.find({}, function(err, docs) {
                            assert.isNull(err)
                            docs.length.assert.equal(1)
                            docs[0].hello.assert.equal(badString)

                            done()
                        })
                    })
                })
            })
        })
*/
        it('Can accept objects whose keys are numbers', function() {
            var o:any = { 42: true }

            expect(() => Model.serialize(o)).to.not.throw()
        })
    })


    describe('Object checking', function() {
        it('Field names beginning with a $ sign are forbidden', function() {
            expect(function () {
                Model.checkObject({ $bad: true })
            }).to.throw()

            expect(function () {
                Model.checkObject({ some: 42, nested: { again: "no", $worse: true } })
            }).to.throw()

            // This shouldn't throw since "$actuallyok" is not a field name
            expect(() => Model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true ] })).to.not.throw()

            expect(function () {
                Model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true, { $hidden: "useless" } ] })
            }).to.throw()
        })

        it('Field names cannot contain a .', function() {
            expect(function () {
                Model.checkObject({ "so.bad": true })
            }).to.throw()

            // Recursive behaviour testing done in the above test on $ signs
        })

        it('Properties with a null value dont trigger an error', function() {
            var obj: any = { prop: null }

            Model.checkObject(obj)
        })

        it('Can check if an object is a primitive or not', function() {
            assert.equal(true, Model.isPrimitiveType(5))
            assert.equal(true, Model.isPrimitiveType('sdsfdfs'))
            assert.equal(true, Model.isPrimitiveType(0))
            assert.equal(true, Model.isPrimitiveType(true))
            assert.equal(true, Model.isPrimitiveType(false))
            assert.equal(true, Model.isPrimitiveType(new Date()))
            assert.equal(true, Model.isPrimitiveType([]))
            assert.equal(true, Model.isPrimitiveType([3, 'try']))
            assert.equal(true, Model.isPrimitiveType(null))
            assert.equal(false, Model.isPrimitiveType({}))
            assert.equal(false, Model.isPrimitiveType({ a: 42 }))
        })
    })


    describe('Deep copying', function() {
        it('Should be able to deep copy any serializable model', function() {
            const d: any = new Date()
            const obj = { a: ['ee', 'ff', 42], date: d, subobj: { a: 'b', b: 'c' } }
            const res = Model.deepCopy(obj)

            assert.equal(3, res.a.length)
            assert.equal('ee', res.a[0])
            assert.equal('ff', res.a[1])
            assert.equal(42, res.a[2])
            assert.equal(d.getTime(), res.date.getTime())
            assert.equal('b', res.subobj.a)
            assert.equal('c', res.subobj.b)

            obj.a.push('ggg')
            obj.date = 'notadate'
            Object.assign(obj.subobj, [])

            // Even if the original object is modified, the copied one isn't
            assert.equal(3, res.a.length)
            assert.equal('ee', res.a[0])
            assert.equal('ff', res.a[1])
            assert.equal(42, res.a[2])
            assert.equal(d.getTime(), res.date.getTime())
            assert.equal('b', res.subobj.a)
            assert.equal('c', res.subobj.b)
        })

        it('Should deep copy the contents of an array', function() {
            const a = [{ hello: 'world' }]
            const b = Model.deepCopy(a)

            assert.equal('world', b[0].hello)

            b[0].hello = 'another'
            assert.equal('another', b[0].hello)
            assert.equal('world', a[0].hello)
        })

        it('Without the strictKeys option, everything gets deep copied', function() {
            const a = { a: 4, $e: 'rrr', 'eee.rt': 42, nested: { yes: 1, 'tt.yy': 2, $nopenope: 3 }, array: [{ 'rr.hh': 1 }, { yes: true }, { $yes: false }] }
            const b = Model.deepCopy(a)


            assert.deepEqual(a, b)
        })

        it('With the strictKeys option, only valid keys gets deep copied', function() {
            const a = { a: 4, $e: 'rrr', 'eee.rt': 42, nested: { yes: 1, 'tt.yy': 2, $nopenope: 3 }, array: [{ 'rr.hh': 1 }, { yes: true }, { $yes: false }] }
            const b = Model.deepCopy(a, true)

            assert.deepEqual(b, { a: 4, nested: { yes: 1 }, array: [{}, { yes: true }, {}] })
        })

    })

    describe('Modifying documents', function() {
        it('Queries not containing any modifier just replace the document by the contents of the query but keep its _id', function() {
            const obj: any = { some: 'thing', _id: 'keepit' }
            const updateQuery: any = { replace: 'done', bloup: [1, 8] }

            let t = Model.modify(obj, updateQuery)
            assert.equal('done', t.replace)
            assert.equal(2, t.bloup.length)
            assert.equal(1, t.bloup[0])
            assert.equal(8, t.bloup[1])

            assert.equal(undefined, t.some)
            assert.equal('keepit', t._id)
        })

        it('Throw an error if trying to change the _id field in a copy-type modification', function() {
            const obj: any = { some: 'thing', _id: 'keepit' }
            const updateQuery: any = { replace: 'done', bloup: [1, 8], _id: 'donttryit' }

            expect(function() {
                Model.modify(obj, updateQuery)
            }).to.throw("You cannot change a document's _id")

            updateQuery._id = 'keepit'

            expect(function () {
                Model.modify(obj, updateQuery)
            }).to.not.throw()
        })

        it('Throw an error if trying to use modify in a mixed copy+modify way', function() {
            const obj: any = { some: 'thing' }
            const updateQuery: any  = { replace: 'me', $modify: 'metoo' }

            expect(function() {
                Model.modify(obj, updateQuery)
            }).to.throw("You cannot mix modifiers and normal fields")
        })

        it('Throw an error if trying to use an inexistent modifier', function() {
            const obj: any = { some: 'thing' }
            const updateQuery: any = { $set: { it: 'exists' }, $modify: 'not this one' }

            expect(function() {
                Model.modify(obj, updateQuery)
            }).to.throw(/^Unknown modifier .modify/)
        })

        it('Throw an error if a modifier is used with a non-object argument', function() {
            const obj = { some: 'thing' }
            const updateQuery = { $set: 'this exists' }

            expect(function() {
                Model.modify(obj, updateQuery)
            }).to.throw(/Modifier .set's argument must be an object/)
        })

        describe('$set modifier', function () {

            it('Can change already set fields without modfifying the underlying object', function() {
                const obj = { some: 'thing', yup: 'yes', nay: 'noes' }
                const updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
                const modified = Model.modify(obj, updateQuery)

                assert.equal(3, Object.keys(modified).length)
                assert.equal('changed', modified.some)
                assert.equal('yes', modified.yup)
                assert.equal('yes indeed', modified.nay)

                assert.equal(3, Object.keys(obj).length)
                assert.equal('thing', obj.some)
                assert.equal('yes', obj.yup)
                assert.equal('noes', obj.nay)
            })

            it('Creates fields to set if they dont exist yet', function() {
                const obj = { yup: 'yes' }
                const updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
                const modified = Model.modify(obj, updateQuery)

                assert.equal(3, Object.keys(modified).length)
                assert.equal('changed', modified.some)
                assert.equal('yes', modified.yup)
                assert.equal('yes indeed', modified.nay)
            })

            it('Can set sub-fields and create them if necessary', function() {
                const obj = { yup: { subfield: 'bloup' } }
                const updateQuery = { $set: { "yup.subfield": 'changed', "yup.yop": 'yes indeed', "totally.doesnt.exist": 'now it does' } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ yup: { subfield: 'changed', yop: 'yes indeed' }, totally: { doesnt: { exist: 'now it does' } } }, modified)
            })

            /* ???
            it("Doesn't replace a falsy field by an object when recursively following dot notation", function() {
                const obj = { nested: false }
                const updateQuery = { $set: { "nested.now": 'it is' } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ nested: false }, modified);   // Object not modified as the nested field doesn't exist
            })
            */
        })

        describe('$unset modifier', function () {
            it('Can delete a field, not throwing an error if the field doesnt exist', function() {
                let obj = { yup: 'yes', other: 'also' }
                let updateQuery: any = { $unset: { yup: true } }
                let modified = Model.modify(obj, updateQuery)
                assert.deepEqual(modified, { other: 'also' })

                obj = { yup: 'yes', other: 'also' }
                updateQuery = { $unset: { nope: true } }
                modified = Model.modify(obj, updateQuery)
                assert.deepEqual(modified, obj)

                obj = { yup: 'yes', other: 'also' }
                updateQuery = { $unset: { nope: true, other: true } }
                modified = Model.modify(obj, updateQuery)
                assert.deepEqual(modified, { yup: 'yes' })
            })

            it('Can unset sub-fields and entire nested documents', function() {
                let obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } }
                let updateQuery: any = { $unset: { nested: true } }
                let modified = Model.modify(obj, updateQuery)

                assert.deepEqual(modified, { yup: 'yes' })

                obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } }
                updateQuery = { $unset: { 'nested.a': true } }
                modified = Model.modify(obj, updateQuery)

                assert.deepEqual(modified, { yup: 'yes', nested: { b: 'yeah' } })

                obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } }
                updateQuery = { $unset: { 'nested.a': true, 'nested.b': true } }
                modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ yup: 'yes', nested: {} }, modified)
            })

            it("When unsetting nested fields, should not create an empty parent to nested field", function() {
                var obj = Model.modify({ argh: true }, { $unset: { 'bad.worse': true } })
                assert.deepEqual(obj, { argh: true })

                obj = Model.modify({ argh: true, bad: { worse: 'oh' } }, { $unset: { 'bad.worse': true } })
                assert.deepEqual(obj, { argh: true, bad: {} })

                obj = Model.modify({ argh: true, bad: {} }, { $unset: { 'bad.worse': true } })
                assert.deepEqual(obj, { argh: true, bad: {} })
            })
        })

        describe('$inc modifier', function () {
/*
            it('Throw an error if you try to use it with a non-number or on a non number field', function() {
                let obj: any = { some: 'thing', yup: 'yes', nay: 2 }
                let updateQuery = { $inc: { nay: 'notanumber' } }

                expect(Model.modify(obj, updateQuery)).to.throw()

                obj = { some: 'thing', yup: 'yes', nay: 'nope' }
                updateQuery = ({ $inc: { nay: 1 } } as any)

                expect(Model.modify(obj, updateQuery)).to.throw()
            })
*/
            it('Can increment number fields or create and initialize them if needed', function() {
                const obj = { some: 'thing', nay: 40 }
                let modified = Model.modify(obj, { $inc: { nay: 2 } })
                assert.deepEqual({ some: 'thing', nay: 42 }, modified)

                // Incidentally, this tests that obj was not modified
                modified = Model.modify(obj, { $inc: { inexistent: -6 } })
                assert.deepEqual({ some: 'thing', nay: 40, inexistent: -6 }, modified)
            })

/*
            it('Works recursively', function() {
                const obj = { some: 'thing', nay: { nope: 40 } }
                const modified = Model.modify(obj, { $inc: { "nay.nope": -2, "blip.blop": 123 } })

                assert.equal({ some: 'thing', nay: { nope: 38 }, blip: { blop: 123 } }, modified)
            })
*/
        });

        describe('$push modifier', function() {
            it('Can push an element to the end of an array', function() {
                const obj = { arr: ['hello'] }
                const modified = Model.modify(obj, { $push: { arr: 'world' } })

                assert.deepEqual(modified, { arr: ['hello', 'world'] })
            })

            it('Can push an element to a non-existent field and will create the array', function() {
                const obj = {}
                const modified = Model.modify(obj, { $push: { arr: 'world' } })

                assert.deepEqual(modified, { arr: ['world'] })
            })

/*
            it('Can push on nested fields', function() {
                let obj: any = { arr: { nested: ['hello'] } }
                let modified = Model.modify(obj, { $push: { "arr.nested": 'world' } })
                assert.deepEqual(modified, { arr: { nested: ['hello', 'world'] } })

                obj = { arr: { a: 2 } }
                modified = Model.modify(obj, { $push: { "arr.nested": 'world' } })
                assert.deepEqual(modified, { arr: { a: 2, nested: ['world'] } })
            })
*/
            it('Throw if we try to push to a non-array', function() {
                let obj: any = { arr: 'hello' }
                expect(() => Model.modify(obj, { $push: { arr: 'world' } })).to.throw()

                obj = { arr: { nested: 45 } }
                expect(() => Model.modify(obj, { $push: { "arr.nested": 'world' } })).to.throw()
            })

            it('Can use the $each modifier to add multiple values to an array at once', function() {
                const obj = { arr: ['hello'] }
                const modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'] } } })
                assert.deepEqual(modified, { arr: ['hello', 'world', 'earth', 'everything'] })

                expect(function() {
                    Model.modify(obj, { $push: { arr: { $each: 45 } } })
                }).to.throw()

                expect(function() {
                    Model.modify(obj, { $push: { arr: { $each: ['world'], unauthorized: true } } })
                }).to.throw()
            })

            it('Can use the $slice modifier to limit the number of array elements', function() {
                const obj = { arr: ['hello'] }
                let modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 1 } } })
                assert.deepEqual({ arr: ['hello'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -1 } } })
                assert.deepEqual({ arr: ['everything'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 0 } } })
                assert.deepEqual({ arr: [] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 2 } } })
                assert.deepEqual({ arr: ['hello', 'world'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -2 } } })
                assert.deepEqual({ arr: ['earth', 'everything'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -20 } } })
                assert.deepEqual({ arr: ['hello', 'world', 'earth', 'everything'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 20 } } })
                assert.deepEqual({ arr: ['hello', 'world', 'earth', 'everything'] }, modified)

                modified = Model.modify(obj, { $push: { arr: { $each: [], $slice: 1 } } })
                assert.deepEqual({ arr: ['hello'] }, modified)

                // $each not specified, but $slice is
                modified = Model.modify(obj, { $push: { arr: { $slice: 1 } } })
                assert.deepEqual(modified, { arr: ['hello'] })

                expect(function() {
                    modified = Model.modify(obj, { $push: { arr: { $slice: 1, unauthorized: true } } })
                }).to.throw()

                expect(function() {
                    modified = Model.modify(obj, { $push: { arr: { $each: [], unauthorized: true } } })
                }).to.throw()
            })
        })

        describe('$addToSet modifier', function() {
            it('Can add an element to a set', function() {
                let obj = { arr: ['hello'] }
                let modified = Model.modify(obj, { $addToSet: { arr: 'world' } })
                assert.deepEqual(modified, { arr: ['hello', 'world'] })

                obj = { arr: ['hello'] }
                modified = Model.modify(obj, { $addToSet: { arr: 'hello' } })
                assert.deepEqual(modified, { arr: ['hello'] })
            })

            it('Can add an element to a non-existent set and will create the array', function() {
                const obj: any = { arr: [] }
                const modified = Model.modify(obj, { $addToSet: { arr: 'world' } })

                assert.deepEqual(modified, { arr: ['world'] })
            })

            it('Throw if we try to addToSet to a non-array', function() {
                const obj = { arr: 'hello' }

                expect(function () {
                    Model.modify(obj, { $addToSet: { arr: 'world' } })
                }).to.throw()
            })

            it('Use deep-equality to check whether we can add a value to a set', function() {
                let obj = { arr: [{ b: 2 }] }
                let modified = Model.modify(obj, { $addToSet: { arr: { b: 3 } } })
                assert.deepEqual(modified, { arr: [{ b: 2 }, { b: 3 }] })

                obj = { arr: [{ b: 2 }] }
                modified = Model.modify(obj, { $addToSet: { arr: { b: 2 } } })
                assert.deepEqual(modified, { arr: [{ b: 2 }] })
            })

            it('Can use the $each modifier to add multiple values to a set at once', function() {
                const obj = { arr: ['hello'] }
                const modified = Model.modify(obj, { $addToSet: { arr: { $each: ['world', 'earth', 'hello', 'earth'] } } })

                assert.deepEqual(modified, { arr: ['hello', 'world', 'earth'] })

                expect(function() {
                    Model.modify(obj, { $addToSet: { arr: { $each: 45 } } })
                }).to.throw()

                expect(function() {
                    Model.modify(obj, { $addToSet: { arr: { $each: ['world'], unauthorized: true } } })
                }).to.throw()
            })
        })

        describe('$pop modifier', function() {
            it('Throw if called on a non array, a non defined field or a non integer', function() {
                let obj: any = { arr: 'hello' }

                expect(function() {
                    Model.modify(obj, { $pop: { arr: 1 } })
                }).to.throw()

                obj = { bloup: 'nope' }
                expect(function() {
                    Model.modify(obj, { $pop: { arr: 1 } })
                }).to.throw()

                obj = { arr: [1, 4, 8] }
                expect(function() {
                    Model.modify(obj, { $pop: { arr: true } })
                }).to.throw()
            })

            it('Can remove the first and last element of an array', function() {
                let obj: any = { arr: [1, 4, 8] }
                let modified = Model.modify(obj, { $pop: { arr: 1 } })
                assert.deepEqual(modified, { arr: [1, 4] })

                obj = { arr: [1, 4, 8] }
                modified = Model.modify(obj, { $pop: { arr: -1 } })
                assert.deepEqual(modified, { arr: [4, 8] })

                // Empty arrays are not changed
                obj = { arr: [] }
                modified = Model.modify(obj, { $pop: { arr: 1 } })
                assert.deepEqual(modified, { arr: [] })

                modified = Model.modify(obj, { $pop: { arr: -1 } })
                assert.deepEqual(modified, { arr: [] })
            })
        })

        describe('$pull modifier', function () {
            it('Can remove an element from a set', function() {
                let obj = { arr: ['hello', 'world'] }
                let modified = Model.modify(obj, { $pull: { arr: 'world' } })
                assert.deepEqual(modified, { arr: ['hello'] })

                obj = { arr: ['hello'] }
                modified = Model.modify(obj, { $pull: { arr: 'world' } })
                assert.deepEqual(modified, { arr: ['hello'] })
            })

            it('Can remove multiple matching elements', function() {
                const obj = { arr: ['hello', 'world', 'hello', 'world'] }
                const modified = Model.modify(obj, { $pull: { arr: 'world' } })

                assert.deepEqual(modified, { arr: ['hello', 'hello'] })
            })

            it('Throw if we try to pull from a non-array', function() {
                const obj = { arr: 'hello' }

                expect(function() {
                    Model.modify(obj, { $pull: { arr: 'world' } })
                }).to.throw()
            })

            it('Use deep-equality to check whether we can remove a value from a set', function() {
                let obj = { arr: [{ b: 2 }, { b: 3 }] }
                let modified = Model.modify(obj, { $pull: { arr: { b: 3 } } })

                assert.deepEqual(modified, { arr: [{ b: 2 }] })

                obj = { arr: [{ b: 2 }] }
                modified = Model.modify(obj, { $pull: { arr: { b: 3 } } })

                assert.deepEqual(modified, { arr: [{ b: 2 }] })
            })

            it('Can use any kind of nedb query with $pull', function() {
                let obj : any= { arr: [4, 7, 12, 2], other: 'yup' }
                let modified = Model.modify(obj, { $pull: { arr: { $gte: 5 } } })

                assert.deepEqual(modified, { arr: [4, 2], other: 'yup' })

                obj = { arr: [{ b: 4 }, { b: 7 }, { b: 1 }], other: 'yeah' }
                modified = Model.modify(obj, { $pull: { arr: { b: { $gte: 5 } } } })

                assert.deepEqual(modified, { arr: [{ b: 4 }, { b: 1 }], other: 'yeah' })
            })
        })

        describe('$max modifier', function () {
            it('Will set the field to the updated value if value is greater than current one, without modifying the original object', function() {
                const obj = { some: 'thing', number: 10 }
                const updateQuery = { $max: { number: 12 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 12 }, modified)
                assert.deepEqual({ some: 'thing', number: 10 }, obj)
            })

            it('Will not update the field if new value is smaller than current one', function() {
                const obj = { some: 'thing', number: 10 }
                const updateQuery = { $max: { number: 9 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 10 }, modified)
            })

            it('Will create the field if it does not exist', function() {
                const obj = { some: 'thing' }
                const updateQuery = { $max: { number: 10 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 10 }, modified)
            })

            /*
            it('Works on embedded documents', function() {
                const obj = { some: 'thing', somethingElse: { number: 10 } }
                const updateQuery = { $max: { 'somethingElse.number': 12 } }
                const modified = Model.modify(obj, updateQuery)

                assert.equal({ some: 'thing', somethingElse: { number: 12 } }, modified)
            })
            */
        })

        describe('$min modifier', function() {
            it('Will set the field to the updated value if value is smaller than current one, without modifying the original object', function() {
                const obj = { some: 'thing', number: 10 }
                const updateQuery = { $min: { number: 8 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 8 }, modified)
                assert.deepEqual({ some: 'thing', number: 10 }, obj)
            })

            it('Will not update the field if new value is greater than current one', function() {
                const obj = { some: 'thing', number: 10 }
                const updateQuery = { $min: { number: 12 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 10 }, modified)
            })

            it('Will create the field if it does not exist', function() {
                const obj = { some: 'thing' }
                const updateQuery = { $min: { number: 10 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', number: 10 }, modified)
            })
/*
            it('Works on embedded documents', function() {
                const obj = { some: 'thing', somethingElse: { number: 10 } }
                const updateQuery = { $min: { 'somethingElse.number': 8 } }
                const modified = Model.modify(obj, updateQuery)

                assert.deepEqual({ some: 'thing', somethingElse: { number: 8 } }, modified)
            })
*/
        })
    })

    describe('Comparing things', function() {
        it('undefined is the smallest', function() {
            const otherStuff = [null, "string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]]

            assert.equal(0, Model.compareThings(undefined, undefined))

            otherStuff.forEach(function(stuff) {
                assert.equal(-1, Model.compareThings(undefined, stuff))
                assert.equal(1, Model.compareThings(stuff, undefined))
            })
        })

        it('Then null', function() {
            const otherStuff = ["string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]]

            assert.equal(0, Model.compareThings(null, null))

            otherStuff.forEach(function(stuff) {
                assert.equal(-1, Model.compareThings(null, stuff))
                assert.equal(1, Model.compareThings(stuff, null))
            })
        })

        it('Then numbers', function() {
            const otherStuff = ["string", "", true, false, new Date(4312), {}, { hello: 'world' }, [], ['quite', 5]]
            const numbers = [-12, 0, 12, 5.7]

            assert.equal(-1, Model.compareThings(-12, 0))
            assert.equal(1, Model.compareThings(0, -3))
            assert.equal(1, Model.compareThings(5.7, 2))
            assert.equal(-1, Model.compareThings(5.7, 12.3))
            assert.equal(0, Model.compareThings(0, 0))
            assert.equal(0, Model.compareThings(-2.6, -2.6))
            assert.equal(0, Model.compareThings(5, 5))

            otherStuff.forEach(function(stuff) {
                numbers.forEach(function(number) {
                    assert.equal(-1, Model.compareThings(number, stuff))
                    assert.equal(1, Model.compareThings(stuff, number))
                })
            })
        })

        it('Then strings', function() {
            const otherStuff = [true, false, new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
            const strings = ['', 'string', 'hello world']

            assert.equal(-1, Model.compareThings('', 'hey'))
            assert.equal(1, Model.compareThings('hey', ''))
            assert.equal(1, Model.compareThings('hey', 'hew'))
            assert.equal(0, Model.compareThings('hey', 'hey'))

            otherStuff.forEach(function(stuff) {
                strings.forEach(function(string) {
                    assert.equal(-1, Model.compareThings(string, stuff))
                    assert.equal(1, Model.compareThings(stuff, string))
                })
            })
        })

        it('Then booleans', function() {
            const otherStuff = [new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
            const bools = [true, false]

            assert.equal(0, Model.compareThings(true, true))
            assert.equal(0, Model.compareThings(false, false))
            assert.equal(1, Model.compareThings(true, false))
            assert.equal(-1, Model.compareThings(false, true))

            otherStuff.forEach(function(stuff) {
                bools.forEach(function(bool) {
                    assert.equal(-1, Model.compareThings(bool, stuff))
                    assert.equal(1, Model.compareThings(stuff, bool))
                })
            })
        })

        it('Then dates', function() {
            const otherStuff = [{}, { hello: 'world' }, [], ['quite', 5]]
            const dates = [new Date(-123), new Date(), new Date(5555), new Date(0)]
            const now = new Date()

            assert.equal(0, Model.compareThings(now, now))
            assert.equal(-1, Model.compareThings(new Date(54341), now))
            assert.equal(1, Model.compareThings(now, new Date(54341)))
            assert.equal(1, Model.compareThings(new Date(0), new Date(-54341)))
            assert.equal(-1, Model.compareThings(new Date(123), new Date(4341)))

            otherStuff.forEach(function(stuff) {
                dates.forEach(function(date) {
                    assert.equal(-1, Model.compareThings(date, stuff))
                    assert.equal(1, Model.compareThings(stuff, date))
                })
            })
        })

        it('Then arrays', function() {
            const otherStuff = [{}, { hello: 'world' }]
            const arrays = [[], ['yes'], ['hello', 5]]

            assert.equal(0, Model.compareThings([], []))
            assert.equal(1, Model.compareThings(['hello'], []))
            assert.equal(-1, Model.compareThings([], ['hello']))
            assert.equal(-1, Model.compareThings(['hello'], ['hello', 'world']))
            assert.equal(-1, Model.compareThings(['hello', 'earth'], ['hello', 'world']))
            assert.equal(1, Model.compareThings(['hello', 'zzz'], ['hello', 'world']))
            assert.equal(0, Model.compareThings(['hello', 'world'], ['hello', 'world']))

            otherStuff.forEach(function(stuff) {
                arrays.forEach(function(array) {
                    assert.equal(-1, Model.compareThings(array, stuff))
                    assert.equal(1, Model.compareThings(stuff, array))
                })
            })
        })

        it('And finally objects', function() {
            assert.equal(0, Model.compareThings({}, {}))
            assert.equal(-1, Model.compareThings({ a: 42 }, { a: 312 }))
            assert.equal(1, Model.compareThings({ a: '42' }, { a: '312' }))
            assert.equal(0, Model.compareThings({ a: 42, b: 312 }, { b: 312, a: 42 }))
            assert.equal(-1, Model.compareThings({ a: 42, b: 312, c: 54 }, { b: 313, a: 42 }))
        })

        it('Can specify custom string comparison function', function() {
            assert.equal(1, Model.compareThings('hello', 'bloup', function(a: string, b: string) { return a < b ? -1 : 1; }))
            assert.equal(-1, Model.compareThings('hello', 'bloup', function(a: string, b: string) { return a > b ? -1 : 1; }))
        })

    })

    describe('Querying', function() {
        describe('Comparing things', function () {
            it('Two things of different types cannot be equal, two identical native things are equal', function() {
                const toTest = [null, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]
                const toTestAgainst = [null, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]   // Use another array so that we don't test pointer equality

                for(let i = 0; i < toTest.length; i ++) {
                    for(let j = 0; j < toTestAgainst.length; j++) {
                        assert.equal(i === j, Model.areThingsEqual(toTest[i], toTestAgainst[j]))
                    }
                }
            })

            it('Can test native types null undefined string number boolean date equality', function() {
                const toTest = [null, undefined, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]
                const toTestAgainst = [undefined, null, 'someotherstring', 5, false, new Date(111111), { hello: 'mars' }]

                for(let i = 0; i < toTest.length; i += 1) {
                    assert.equal(false, Model.areThingsEqual(toTest[i], toTestAgainst[i]))
                }
            })

            it('If one side is an array or undefined, comparison fails', function() {
                const toTestAgainst = [null, undefined, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]

                for(let i = 0; i < toTestAgainst.length; i += 1) {
                    assert.equal(false, Model.areThingsEqual([1, 2, 3], toTestAgainst[i]))
                    assert.equal(false, Model.areThingsEqual(toTestAgainst[i], []))
                    assert.equal(false, Model.areThingsEqual(undefined, toTestAgainst[i]))
                    assert.equal(false, Model.areThingsEqual(toTestAgainst[i], undefined))
                }
            })

            it('Can test objects equality', function() {
                assert.equal(false, Model.areThingsEqual({ hello: 'world' }, {}))
                assert.equal(false, Model.areThingsEqual({ hello: 'world' }, { hello: 'mars' }))
                assert.equal(false, Model.areThingsEqual({ hello: 'world' }, { hello: 'world', temperature: 42 }))
                assert.equal(true, Model.areThingsEqual({ hello: 'world', other: { temperature: 42 } }, { hello: 'world', other: { temperature: 42 } }))
            })
        })

        describe('Getting a fields value in dot notation', function() {
            it('Return first-level and nested values', function() {
                assert.equal('world', Model.getDotValue({ hello: 'world' }, 'hello'))
                assert.equal(true, Model.getDotValue({ hello: 'world', type: { planet: true, blue: true } }, 'type.planet'))
            })

            it('Return undefined if the field cannot be found in the object', function() {
                assert.equal(null, Model.getDotValue({ hello: 'world' }, 'helloo'))
                assert.equal(null, Model.getDotValue({ hello: 'world', type: { planet: true } }, 'type.plane'))
            })

            it("Can navigate inside arrays with dot notation, and return the array of values in that case", function() {
                // Simple array of subdocuments
                let dv = Model.getDotValue({ planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] }, 'planets.name')
                assert.deepEqual(dv, ['Earth', 'Mars', 'Pluton'])

                // Nested array of subdocuments
                dv = Model.getDotValue({ nedb: true, data: { planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] } }, 'data.planets.number')
                assert.deepEqual(dv, [3, 2, 9])

                // Nested array in a subdocument of an array (yay, inception!)
                // TODO: make sure MongoDB doesn't flatten the array (it wouldn't make sense)
                dv = Model.getDotValue({ nedb: true, data: { planets: [{ name: 'Earth', numbers: [1, 3] }, { name: 'Mars', numbers: [7] }, { name: 'Pluton', numbers: [9, 5, 1] }] } }, 'data.planets.numbers')
                assert.deepEqual(dv, [[1, 3], [7], [9, 5, 1]])
            })

            it("Can get a single value out of an array using its index", function() {
                // Simple index in dot notation
                let dv = Model.getDotValue({ planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] }, 'planets.1')
                assert.deepEqual(dv, { name: 'Mars', number: 2 })

                // Out of bounds index
                dv = Model.getDotValue({ planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] }, 'planets.3')
                assert.equal(null , dv)

                // Index in nested array
                dv = Model.getDotValue({ nedb: true, data: { planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] } }, 'data.planets.2')
                assert.deepEqual(dv, { name: 'Pluton', number: 9 })

                // Dot notation with index in the middle
                dv = Model.getDotValue({ nedb: true, data: { planets: [{ name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 }] } }, 'data.planets.0.name')
                assert.equal('Earth', dv)
            })
        })

        describe('Field equality', function() {
            it('Can find documents with simple fields', function() {
                assert.equal(false, Model.match({ test: 'yeah' }, { test: 'yea' }))
                assert.equal(false, Model.match({ test: 'yeah' }, { test: 'yeahh' }))
                assert.equal(true, Model.match({ test: 'yeah' }, { test: 'yeah' }))
            })

            it('Can find documents with the dot-notation', function() {
                assert.equal(false, Model.match({ test: { ooo: 'yeah' } }, { "test.ooo": 'yea' }))
                assert.equal(false, Model.match({ test: { ooo: 'yeah' } }, { "test.oo": 'yeah' }))
                assert.equal(false, Model.match({ test: { ooo: 'yeah' } }, { "tst.ooo": 'yeah' }))
                assert.equal(true, Model.match({ test: { ooo: 'yeah' } }, { "test.ooo": 'yeah' }))
            })

            it('Cannot find undefined', function() {
                assert.equal(false, Model.match({ test: undefined }, { test: undefined }))
                assert.equal(false, Model.match({ test: { pp: undefined } }, { "test.pp": undefined }))
            })

            it('Nested objects are deep-equality matched and not treated as sub-queries', function() {
                assert.equal(true, Model.match({ a: { b: 5 } }, { a: { b: 5 } }))
                assert.equal(false, Model.match({ a: { b: 5, c: 3 } }, { a: { b: 5 } }))
                assert.equal(false, Model.match({ a: { b: 5 } }, { a: { b: { $lt: 10 } } }))

                expect(function() { Model.match({ a: { b: 5 } }, { a: { $or: [{ b: 10 }, { b: 5 }] } }) }).to.throw()
            })

            it("Can match for field equality inside an array with the dot notation", function() {
                assert.equal(false, Model.match({ a: true, b: ['node', 'embedded', 'database'] }, { 'b.1': 'node' }))
                assert.equal(true, Model.match({ a: true, b: ['node', 'embedded', 'database'] }, { 'b.1': 'embedded' }))
                assert.equal(false, Model.match({ a: true, b: ['node', 'embedded', 'database'] }, { 'b.1': 'database' }))
            })
        })

        describe('Regular expression matching', function() {
            it('Matching a non-string to a regular expression always yields false', function() {
                const d = new Date()
                const r = new RegExp(d.getTime().toString())

                assert.equal(false, Model.match({ test: true }, { test: /true/ }))
                assert.equal(false, Model.match({ test: null }, { test: /null/ }))
                assert.equal(false, Model.match({ test: 42 }, { test: /42/ }))
                assert.equal(false, Model.match({ test: d }, { test: r }))
            })

            it('Can match strings using basic querying', function() {
                assert.equal(true, Model.match({ test: 'true' }, { test: /true/ }))
                assert.equal(true, Model.match({ test: 'babaaaar' }, { test: /aba+r/ }))
                assert.equal(false, Model.match({ test: 'babaaaar' }, { test: /^aba+r/ }))
                assert.equal(false, Model.match({ test: 'true' }, { test: /t[ru]e/ }))
            })

            it('Can match strings using the $regex operator', function() {
                assert.equal(true, Model.match({ test: 'true' }, { test: { $regex: /true/ } }))
                assert.equal(true, Model.match({ test: 'babaaaar' }, { test: { $regex: /aba+r/ } }))
                assert.equal(false, Model.match({ test: 'babaaaar' }, { test: { $regex: /^aba+r/ } }))
                assert.equal(false, Model.match({ test: 'true' }, { test: { $regex: /t[ru]e/ } }))
            })

            it('Will throw if $regex operator is used with a non regex value', function() {
                expect(function() {
                    Model.match({ test: 'true' }, { test: { $regex: 42 } })
                }).to.throw()

                expect(function() {
                    Model.match({ test: 'true' }, { test: { $regex: 'true' } })
                }).to.throw()
            })

            it('Can use the $regex operator in cunjunction with other operators', function() {
                assert.equal(true, Model.match({ test: 'helLo' }, { test: { $regex: /ll/i, $nin: ['helL', 'helLop'] } }))
                assert.equal(false, Model.match({ test: 'helLo' }, { test: { $regex: /ll/i, $nin: ['helLo', 'helLop'] } }))
            })

            it('Can use dot-notation', function() {
                assert.equal(true, Model.match({ test: { nested: 'true' } }, { 'test.nested': /true/ }))
                assert.equal(false, Model.match({ test: { nested: 'babaaaar' } }, { 'test.nested': /^aba+r/ }))

                assert.equal(true, Model.match({ test: { nested: 'true' } }, { 'test.nested': { $regex: /true/ } }))
                assert.equal(false, Model.match({ test: { nested: 'babaaaar' } }, { 'test.nested': { $regex: /^aba+r/ } }))
            })
        })

        describe('$lt', function() {
            it('Cannot compare a field to an object, an array, null or a boolean, it will return false', function() {
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: { a: 6 } } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: [6, 7] } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: null } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: true } }))
            })

            it('Can compare numbers, with or without dot notation', function() {
                assert.equal(true, Model.match({ a: 5 }, { a: { $lt: 6 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: 5 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lt: 4 } }))

                assert.equal(true, Model.match({ a: { b: 5 } }, { "a.b": { $lt: 6 } }))
                assert.equal(false, Model.match({ a: { b: 5 } }, { "a.b": { $lt: 3 } }))
            })

            it('Can compare strings, with or without dot notation', function() {
                assert.equal(true, Model.match({ a: "nedb" }, { a: { $lt: "nedc" } }))
                assert.equal(false, Model.match({ a: "nedb" }, { a: { $lt: "neda" } }))

                assert.equal(true, Model.match({ a: { b: "nedb" } }, { "a.b": { $lt: "nedc" } }))
                assert.equal(false, Model.match({ a: { b: "nedb" } }, { "a.b": { $lt: "neda" } }))
            })

            it('If field is an array field, a match means a match on at least one element', function() {
                assert.equal(false, Model.match({ a: [5, 10] }, { a: { $lt: 4 } }))
                assert.equal(true, Model.match({ a: [5, 10] }, { a: { $lt: 6 } }))
                assert.equal(true, Model.match({ a: [5, 10] }, { a: { $lt: 11 } }))
            })

            it('Works with dates too', function() {
                assert.equal(false, Model.match({ a: new Date(1000) }, { a: { $gte: new Date(1001) } }))
                assert.equal(true, Model.match({ a: new Date(1000) }, { a: { $lt: new Date(1001) } }))
            })
        })

        // General behaviour is tested in the block about $lt. Here we just test operators work
        describe('Other comparison operators: $lte, $gt, $gte, $ne, $in, $exists', function() {
            it('$lte', function() {
                assert.equal(true, Model.match({ a: 5 }, { a: { $lte: 6 } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $lte: 5 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $lte: 4 } }))
            })

            it('$gt', function() {
                assert.equal(false, Model.match({ a: 5 }, { a: { $gt: 6 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $gt: 5 } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $gt: 4 } }))
            })

            it('$gte', function() {
                assert.equal(false, Model.match({ a: 5 }, { a: { $gte: 6 } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $gte: 5 } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $gte: 4 } }))
            })

            it('$ne', function() {
                assert.equal(true, Model.match({ a: 5 }, { a: { $ne: 4 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $ne: 5 } }))
                assert.equal(true, Model.match({ a: 5 }, { b: { $ne: 5 } }))
                assert.equal(false, Model.match({ a: false }, { a: { $ne: false } }))
            })

            it('$in', function() {
                assert.equal(false, Model.match({ a: 5 }, { a: { $in: [6, 8, 9] } }))
                assert.equal(true, Model.match({ a: 6 }, { a: { $in: [6, 8, 9] } }))
                assert.equal(false, Model.match({ a: 7 }, { a: { $in: [6, 8, 9] } }))
                assert.equal(true, Model.match({ a: 8 }, { a: { $in: [6, 8, 9] } }))
                assert.equal(true, Model.match({ a: 9 }, { a: { $in: [6, 8, 9] } }))

                expect(function() { Model.match({ a: 5 }, { a: { $in: 5 } }); }).to.throw()
            })

            it('$nin', function() {
                assert.equal(true, Model.match({ a: 5 }, { a: { $nin: [6, 8, 9] } }))
                assert.equal(false, Model.match({ a: 6 }, { a: { $nin: [6, 8, 9] } }))
                assert.equal(true, Model.match({ a: 7 }, { a: { $nin: [6, 8, 9] } }))
                assert.equal(false, Model.match({ a: 8 }, { a: { $nin: [6, 8, 9] } }))
                assert.equal(false, Model.match({ a: 9 }, { a: { $nin: [6, 8, 9] } }))

                // Matches if field doesn't exist
                assert.equal(true, Model.match({ a: 9 }, { b: { $nin: [6, 8, 9] } }))

                expect(function() { Model.match({ a: 5 }, { a: { $in: 5 } }); }).to.throw()
            })

            it('$exists', function() {
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: 1 } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: true } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: new Date() } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: '' } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: [] } }))
                assert.equal(true, Model.match({ a: 5 }, { a: { $exists: {} } }))

                assert.equal(false, Model.match({ a: 5 }, { a: { $exists: 0 } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $exists: false } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $exists: null } }))
                assert.equal(false, Model.match({ a: 5 }, { a: { $exists: undefined } }))

                assert.equal(false, Model.match({ a: 5 }, { b: { $exists: true } }))
                assert.equal(true, Model.match({ a: 5 }, { b: { $exists: false } }))
            })
        })

        describe('Comparing on arrays', function () {
            it("Can perform a direct array match", function() {
                assert.equal(false, Model.match({ planets: ['Earth', 'Mars', 'Pluto'], something: 'else' }, { planets: ['Earth', 'Mars'] }))
                assert.equal(true, Model.match({ planets: ['Earth', 'Mars', 'Pluto'], something: 'else' }, { planets: ['Earth', 'Mars', 'Pluto'] }))
                assert.equal(false, Model.match({ planets: ['Earth', 'Mars', 'Pluto'], something: 'else' }, { planets: ['Earth', 'Pluto', 'Mars'] }))
            })

            it('Can query on the size of an array field', function() {
                // Non nested documents
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $size: 0 } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $size: 1 } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $size: 2 } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $size: 3 } }))

                // Nested documents
                assert.equal(false, Model.match({ hello: 'world', description: { satellites: ['Moon', 'Hubble'], diameter: 6300 } }, { "description.satellites": { $size: 0 } }))
                assert.equal(false, Model.match({ hello: 'world', description: { satellites: ['Moon', 'Hubble'], diameter: 6300 } }, { "description.satellites": { $size: 1 } }))
                assert.equal(true, Model.match({ hello: 'world', description: { satellites: ['Moon', 'Hubble'], diameter: 6300 } }, { "description.satellites": { $size: 2 } }))
                assert.equal(false, Model.match({ hello: 'world', description: { satellites: ['Moon', 'Hubble'], diameter: 6300 } }, { "description.satellites": { $size: 3 } }))

                // Using a projected array
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.names": { $size: 0 } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.names": { $size: 1 } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.names": { $size: 2 } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.names": { $size: 3 } }))
            })

            it('$size operator works with empty arrays', function() {
                assert.equal(true, Model.match({ childrens: [] }, { "childrens": { $size: 0 } }))
                assert.equal(false, Model.match({ childrens: [] }, { "childrens": { $size: 2 } }))
                assert.equal(false, Model.match({ childrens: [] }, { "childrens": { $size: 3 } }))
            })

            it('Should throw an error if a query operator is used without comparing to an integer', function() {
                expect(function() { Model.match({ a: [1, 5] }, { a: { $size: 1.4 } }); }).to.throw()
                expect(function () { Model.match({ a: [1, 5] }, { a: { $size: 'fdf' } }); }).to.throw()
                expect(function () { Model.match({ a: [1, 5] }, { a: { $size: { $lt: 5 } } }); }).to.throw()
            })

            it('Using $size operator on a non-array field should prevent match but not throw', function() {
                assert.equal(false, Model.match({ a: 5 }, { a: { $size: 1 } }))
            })

/*
            it('Can use $size several times in the same matcher', function () {
                // Note: hack to get around Typescript strict mode
                const test1 = JSON.stringify("{ \"childrens\": { $size: 3, $size: 3 } }")
                const test2 = JSON.stringify("{ \"childrens\": { $size: 3, $size: 4 } }")

                assert.equal(true, Model.match({ childrens: ['Riri', 'Fifi', 'Loulou'] }, test1))
                assert.equal(false, Model.match({ childrens: ['Riri', 'Fifi', 'Loulou'] }, test2))   // Of course this can never be true
            })
*/

            it('Can query array documents with multiple simultaneous conditions', function() {
                // Non nested documents
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Dewey", age: 7 } } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Dewey", age: 12 } } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Louie", age: 3 } } }))

                // Nested documents
                assert.equal(true, Model.match({ outer: { childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] } }, { "outer.childrens": { $elemMatch: { name: "Dewey", age: 7 } } }))
                assert.equal(false, Model.match({ outer: { childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] } }, { "outer.childrens": { $elemMatch: { name: "Dewey", age: 12 } } }))
                assert.equal(false, Model.match({ outer: { childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] } }, { "outer.childrens": { $elemMatch: { name: "Louie", age: 3 } } }))
            })

            //??? Model.match({ a: new Date(1000) }, { a: { $lt: new Date(1001) } })
            it('$elemMatch operator works with empty arrays', function() {
                assert.equal(false, Model.match({ childrens: [] }, { "childrens": { $elemMatch: { name: "Mitsos" } } }))
                assert.equal(false, Model.match({ childrens: [] }, { "childrens": { $elemMatch: {} } }))
            })

            it('Can use more complex comparisons inside nested query documents', function() {
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Dewey", age: { $gt: 6, $lt: 8 } } } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Dewey", age: { $in: [6, 7, 8] } } } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Dewey", age: { $gt: 6, $lt: 7 } } } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens": { $elemMatch: { name: "Louie", age: { $gt: 6, $lte: 7 } } } }))
            })

        })

        describe('Logical operators $or, $and, $not', function () {
            it('Any of the subqueries should match for an $or to match', function() {
                assert.equal(true, Model.match({ hello: 'world' }, { $or: [{ hello: 'pluton' }, { hello: 'world' }] }))
                assert.equal(true, Model.match({ hello: 'pluton' }, { $or: [{ hello: 'pluton' }, { hello: 'world' }] }))
                assert.equal(false, Model.match({ hello: 'nope' }, { $or: [{ hello: 'pluton' }, { hello: 'world' }] }))
                assert.equal(true, Model.match({ hello: 'world', age: 15 }, { $or: [{ hello: 'pluton' }, { age: { $lt: 20 } }] }))
                assert.equal(false, Model.match({ hello: 'world', age: 15 }, { $or: [{ hello: 'pluton' }, { age: { $lt: 10 } }] }))
            })

            it('All of the subqueries should match for an $and to match', function() {
                assert.equal(true, Model.match({ hello: 'world', age: 15 }, { $and: [{ age: 15 }, { hello: 'world' }] }))
                assert.equal(false, Model.match({ hello: 'world', age: 15 }, { $and: [{ age: 16 }, { hello: 'world' }] }))
                assert.equal(true, Model.match({ hello: 'world', age: 15 }, { $and: [{ hello: 'world' }, { age: { $lt: 20 } }] }))
                assert.equal(false, Model.match({ hello: 'world', age: 15 }, { $and: [{ hello: 'pluton' }, { age: { $lt: 20 } }] }))
            })

            it('Subquery should not match for a $not to match', function() {
                assert.equal(true, Model.match({ a: 5, b: 10 }, { a: 5 }))
                assert.equal(false, Model.match({ a: 5, b: 10 }, { $not: { a: 5 } }))
            })

            it('Logical operators are all top-level, only other logical operators can be above', function() {
                expect(function() { Model.match({ a: { b: 7 } }, { a: { $or: [{ b: 5 }, { b: 7 }] } }) }).to.throw()
                assert.equal(true, Model.match({ a: { b: 7 } }, { $or: [{ "a.b": 5 }, { "a.b": 7 }] }))
            })

            it('Logical operators can be combined as long as they are on top of the decision tree', function() {
                assert.equal(true, Model.match({ a: 5, b: 7, c: 12 }, { $or: [{ $and: [{ a: 5 }, { b: 8 }] }, { $and: [{ a: 5 }, { c: { $lt: 40 } }] }] }))
                assert.equal(false, Model.match({ a: 5, b: 7, c: 12 }, { $or: [{ $and: [{ a: 5 }, { b: 8 }] }, { $and: [{ a: 5 }, { c: { $lt: 10 } }] }] }))
            })
/*
            it('Should throw an error if a logical operator is used without an array or if an unknown logical operator is used', function () {
                // Note: hack to get around Typescript strict mode
                const test1 = JSON.parse("{ $or: { a: 5, a: 6 } }")
                const test2 = JSON.parse("{ $and: { a: 5, a: 6 } }")

                expect(function () { Model.match({ a: 5 }, test1) }).to.throw()
                expect(function() { Model.match({ a: 5 }, test2) }).to.throw()
                expect(function() { Model.match({ a: 5 }, { $unknown: [{ a: 5 }] }); }).to.throw()
            })
*/
        })

        describe('Comparison operator $where', function () {
            it('Function should match and not match correctly', function() {
                assert.equal(true, Model.match({ a: 4 }, { $where: function() { return this.a === 4; } }))
                assert.equal(false, Model.match({ a: 4 }, { $where: function() { return this.a === 5; } }))
            })

            it('Should throw an error if the $where function is not, in fact, a function', function() {
                expect(function() { Model.match({ a: 4 }, { $where: 'not a function' }); }).to.throw()
            })

            it('Should throw an error if the $where function returns a non-boolean', function() {
                expect(function() { Model.match({ a: 4 }, { $where: function() { return 'not a boolean'; } }); }).to.throw()
            })

            it('Should be able to do the complex matching it must be used for', function() {
                const checkEmail = function() {
                    if (!this.firstName || !this.lastName) { return false; }
                    return this.firstName.toLowerCase() + "." + this.lastName.toLowerCase() + "@gmail.com" === this.email
                }

                assert.equal(true, Model.match({ firstName: "John", lastName: "Doe", email: "john.doe@gmail.com" }, { $where: checkEmail }))
                assert.equal(true, Model.match({ firstName: "john", lastName: "doe", email: "john.doe@gmail.com" }, { $where: checkEmail }))
                assert.equal(false, Model.match({ firstName: "Jane", lastName: "Doe", email: "john.doe@gmail.com" }, { $where: checkEmail }))
                assert.equal(false, Model.match({ firstName: "John", lastName: "Deere", email: "john.doe@gmail.com" }, { $where: checkEmail }))
                assert.equal(false, Model.match({ lastName: "Doe", email: "john.doe@gmail.com" }, { $where: checkEmail }))
            })
        })

        describe('Array fields', function () {
            it('Field equality', function() {
                assert.equal(false, Model.match({ tags: ['node', 'js', 'db'] }, { tags: 'python' }))
                assert.equal(false, Model.match({ tags: ['node', 'js', 'db'] }, { tagss: 'js' }))
                assert.equal(true, Model.match({ tags: ['node', 'js', 'db'] }, { tags: 'js' }))

                //const test1MatchA = JSON.parse("{ tags: ['node', 'js', 'db'] }")
                //const test1MatchB = JSON.parse("{ tags: 'js', tags: 'node' }")
                //assert.equal(true, Model.match(test1MatchA, test1MatchB))

                // Mixed matching with array and non array
                assert.equal(true, Model.match({ tags: ['node', 'js', 'db'], nedb: true }, { tags: 'js', nedb: true }))

                // Nested matching
                assert.equal(true, Model.match({ number: 5, data: { tags: ['node', 'js', 'db'] } }, { "data.tags": 'js' }))
                assert.equal(false, Model.match({ number: 5, data: { tags: ['node', 'js', 'db'] } }, { "data.tags": 'j' }))
            })

            it('With one comparison operator', function() {
                assert.equal(false, Model.match({ ages: [3, 7, 12] }, { ages: { $lt: 2 } }))
                assert.equal(false, Model.match({ ages: [3, 7, 12] }, { ages: { $lt: 3 } }))
                assert.equal(true, Model.match({ ages: [3, 7, 12] }, { ages: { $lt: 4 } }))
                assert.equal(true, Model.match({ ages: [3, 7, 12] }, { ages: { $lt: 8 } }))
                assert.equal(true, Model.match({ ages: [3, 7, 12] }, { ages: { $lt: 13 } }))
            })

            it('Works with arrays that are in subdocuments', function() {
                assert.equal(false, Model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 2 } }))
                assert.equal(false, Model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 3 } }))
                assert.equal(true, Model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 4 } }))
                assert.equal(true, Model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 8 } }))
                assert.equal(true, Model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 13 } }))
            })

            it('Can query inside arrays thanks to dot notation', function() {
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.age": { $lt: 2 } }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.age": { $lt: 3 } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.age": { $lt: 4 } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.age": { $lt: 8 } }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.age": { $lt: 13 } }))

                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.name": 'Louis' }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.name": 'Louie' }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.name": 'Lewi' }))
            })

            it('Can query for a specific element inside arrays thanks to dot notation', function() {
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.0.name": 'Louie' }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.1.name": 'Louie' }))
                assert.equal(true, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.2.name": 'Louie' }))
                assert.equal(false, Model.match({ childrens: [{ name: "Huey", age: 3 }, { name: "Dewey", age: 7 }, { name: "Louie", age: 12 }] }, { "childrens.3.name": 'Louie' }))
            })

            it('A single array-specific operator and the query is treated as array specific', function() {
                expect(function() { Model.match({ childrens: ['Riri', 'Fifi', 'Loulou'] }, { "childrens": { "Fifi": true, $size: 3 } }) }).to.throw()
            })

            it('Can mix queries on array fields and non array filds with array specific operators', function() {
                assert.equal(false, Model.match({ uncle: 'Donald', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 2 }, uncle: 'Donald' }))
                assert.equal(true, Model.match({ uncle: 'Donald', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 3 }, uncle: 'Donald' }))
                assert.equal(false, Model.match({ uncle: 'Donald', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 4 }, uncle: 'Donald' }))

                assert.equal(false, Model.match({ uncle: 'Donals', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 3 }, uncle: 'Picsou' }))
                assert.equal(true, Model.match({ uncle: 'Donald', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 3 }, uncle: 'Donald' }))
                assert.equal(false, Model.match({ uncle: 'Donald', nephews: ['Riri', 'Fifi', 'Loulou'] }, { nephews: { $size: 3 }, uncle: 'Daisy' }))
            })
        })
    })
})