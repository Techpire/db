import * as chai from 'chai'
import { expect } from 'chai'
import { Indexer } from '../src/Indexer'
import { Model } from '../src/Model'

const assert = require('assert')

describe('Indexes', function() {
    describe('Insertion', function() {
        it('Can insert pointers to documents in the index correctly when they have the field', function() {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            idx.insert([doc1, doc2, doc3])

            // The underlying BST now has 3 nodes which contain the docs where it's expected
            assert.equal(3, idx.count())
            assert.deepEqual({ a: 5, tf: 'hello' }, idx.find('hello'))
            assert.deepEqual({ a: 8, tf: 'world' }, idx.find('world'))
            assert.deepEqual({ a: 2, tf: 'bloup' }, idx.find('bloup'))

            // The nodes contain pointers to the actual documents
            assert.equal(doc2, idx.find('world'))

            // Set the value in the tree
            idx.find('bloup').a = 42;
            assert.equal(42, idx.find('bloup').a)

            // The doc should have been modified
            assert.equal(42, doc3.a)
        })

        it('Inserting twice for the same fieldName in a unique index will result in an error', function() {
            const idx = new Indexer('tf', true)
            const doc1 = { a: 5, tf: 'hello' }

            idx.insert(doc1)
            assert.equal(1, idx.count())
            expect(function () { idx.insert(doc1) }).to.throw()
        })

        it('Inserting docs with a null unique index results in an error', function() {
            const idx = new Indexer('nope', true)
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 5, tf: 'world' }

            expect(function() { idx.insert(doc1) }).to.throw()
            expect(function() { idx.insert(doc2) }).to.throw()

            assert.equal(0, idx.count())
        })

        it('Works with dot notation', function() {
            const idx = new Indexer('tf.nested')
            const doc1 = { a: 5, tf: { nested: 'hello' } }
            const doc2 = { a: 8, tf: { nested: 'world', additional: true } }
            const doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            // The underlying BST now has 3 nodes which contain the docs where it's expected
            assert.equal(3, idx.count())
            assert.equal(idx.find('hello'), doc1)
            assert.equal(idx.find('world'), doc2)
            assert.equal(idx.find('bloup'), doc3)

            // The nodes contain pointers to the actual documents
            idx.find('bloup').a = 42
            assert.equal(42, doc3.a)
        })

        it('Can insert an array of documents', function() {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            idx.insert([doc1, doc2, doc3])
            assert.equal(3, idx.count())
            assert.equal(idx.find('hello'), doc1)
            assert.equal(idx.find('world'), doc2)
            assert.equal(idx.find('bloup'), doc3)
        })

        it('When inserting an array of elements, if an error is thrown all inserts need to be rolled back', function() {
            const idx = new Indexer('tf', true)
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc2b = { a: 84, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            expect(function() { idx.insert([doc1, doc2, doc2b, doc3]) }).to.throw()

            assert.equal(0, idx.count())
            assert.deepEqual(idx.find('hello'), null)
            assert.deepEqual(idx.find('world'), null)
            assert.deepEqual(idx.find('bloup'), null)
        })

        describe('Array fields', function() {
            it('Cannot use an array for an index', function() {
                const idx = new Indexer('tf')
                const obj = { tf: ['aa', 'bb'], really: 'yeah' }

                expect(function () { idx.insert(obj) }).to.throw()
            })
        })
    })

    describe('Removal', function () {
        it('Can remove pointers from the index, even when multiple documents have the same key', function() {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }
            const doc4 = { a: 23, tf: 'world' }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)
            assert.equal(3, idx.count())

            idx.remove(doc1)
            assert.equal(2, idx.count())
            assert.deepEqual(null, idx.find('hello'))
            assert.deepEqual(doc4, idx.find('world'))

            idx.remove(doc2)
            assert.equal(1, idx.count())
            assert.equal(null, idx.find('world'))
        })

        it('Works with dot notation', function() {
            const idx = new Indexer('tf.nested')
            const doc1 = { a: 5, tf: { nested: 'hello' } }
            const doc2 = { a: 8, tf: { nested: 'world', additional: true } }
            const doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }
            const doc4 = { a: 2, tf: { nested: 'world', fruits: ['apple', 'carrot'] } }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)
            assert.equal(idx.count(), 3)

            idx.remove(doc1)
            assert.equal(idx.count(), 2)
            assert.equal(idx.find('hello'), null)

            idx.remove(doc2)
            assert.equal(idx.count(), 1)
            assert.equal(idx.find('world'), null)
        })

        it('Can remove an array of documents', function() {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            idx.insert([doc1, doc2, doc3])
            assert.equal(3, idx.count())

            idx.remove([doc1, doc3])
            assert.equal(1, idx.count())

            assert.deepEqual(idx.find('hello'), null)
            assert.deepEqual(idx.find('world'), doc2)
            assert.deepEqual(idx.find('bloup'), null)
        })
    })


    describe('Update', function () {
/*
        it('Can update a document whose key did or didnt change', function () {
            var idx = new Index({ fieldName: 'tf' })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , doc4 = { a: 23, tf: 'world' }
                , doc5 = { a: 1, tf: 'changed' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('world'), [doc2])

            idx.update(doc2, doc4)
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('world'), [doc4])

            idx.update(doc1, doc5)
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('hello'), [])
            assert.deepEqual(idx.tree.search('changed'), [doc5])
        })

        it('If a simple update violates a unique constraint, changes are rolled back and an error thrown', function () {
            var idx = new Index({ fieldName: 'tf', unique: true })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , bad = { a: 23, tf: 'world' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('hello'), [doc1])
            assert.deepEqual(idx.tree.search('world'), [doc2])
            assert.deepEqual(idx.tree.search('bloup'), [doc3])

            try {
                idx.update(doc3, bad)
            } catch (e) {
                e.errorType.should.equal('uniqueViolated')
            }

            // No change
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('hello'), [doc1])
            assert.deepEqual(idx.tree.search('world'), [doc2])
            assert.deepEqual(idx.tree.search('bloup'), [doc3])
        })

        it('Can update an array of documents', function () {
            var idx = new Index({ fieldName: 'tf' })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , doc1b = { a: 23, tf: 'world' }
                , doc2b = { a: 1, tf: 'changed' }
                , doc3b = { a: 44, tf: 'bloup' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.tree.getNumberOfKeys().should.equal(3)

            idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }])

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc1b)
            idx.getMatching('changed').length.should.equal(1)
            idx.getMatching('changed')[0].should.equal(doc2b)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3b)
        })

        it('If a unique constraint is violated during an array-update, all changes are rolled back and an error thrown', function () {
            var idx = new Index({ fieldName: 'tf', unique: true })
                , doc0 = { a: 432, tf: 'notthistoo' }
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , doc1b = { a: 23, tf: 'changed' }
                , doc2b = { a: 1, tf: 'changed' }   // Will violate the constraint (first try)
                , doc2c = { a: 1, tf: 'notthistoo' }   // Will violate the constraint (second try)
                , doc3b = { a: 44, tf: 'alsochanged' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.tree.getNumberOfKeys().should.equal(3)

            try {
                idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }])
            } catch (e) {
                e.errorType.should.equal('uniqueViolated')
            }

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('hello').length.should.equal(1)
            idx.getMatching('hello')[0].should.equal(doc1)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc2)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3)

            try {
                idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }])
            } catch (e) {
                e.errorType.should.equal('uniqueViolated')
            }

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('hello').length.should.equal(1)
            idx.getMatching('hello')[0].should.equal(doc1)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc2)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3)
        })

        it('If an update doesnt change a document, the unique constraint is not violated', function () {
            var idx = new Index({ fieldName: 'tf', unique: true })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , noChange = { a: 8, tf: 'world' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('world'), [doc2])

            idx.update(doc2, noChange);   // No error thrown
            idx.tree.getNumberOfKeys().should.equal(3)
            assert.deepEqual(idx.tree.search('world'), [noChange])
        })

        it('Can revert simple and batch updates', function () {
            var idx = new Index({ fieldName: 'tf' })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 8, tf: 'world' }
                , doc3 = { a: 2, tf: 'bloup' }
                , doc1b = { a: 23, tf: 'world' }
                , doc2b = { a: 1, tf: 'changed' }
                , doc3b = { a: 44, tf: 'bloup' }
                , batchUpdate = [{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.tree.getNumberOfKeys().should.equal(3)

            idx.update(batchUpdate)

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc1b)
            idx.getMatching('changed').length.should.equal(1)
            idx.getMatching('changed')[0].should.equal(doc2b)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3b)

            idx.revertUpdate(batchUpdate)

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('hello').length.should.equal(1)
            idx.getMatching('hello')[0].should.equal(doc1)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc2)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3)

            // Now a simple update
            idx.update(doc2, doc2b)

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('hello').length.should.equal(1)
            idx.getMatching('hello')[0].should.equal(doc1)
            idx.getMatching('changed').length.should.equal(1)
            idx.getMatching('changed')[0].should.equal(doc2b)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3)

            idx.revertUpdate(doc2, doc2b)

            idx.tree.getNumberOfKeys().should.equal(3)
            idx.getMatching('hello').length.should.equal(1)
            idx.getMatching('hello')[0].should.equal(doc1)
            idx.getMatching('world').length.should.equal(1)
            idx.getMatching('world')[0].should.equal(doc2)
            idx.getMatching('bloup').length.should.equal(1)
            idx.getMatching('bloup')[0].should.equal(doc3)
        })
*/
    })

    describe('Get matching documents', function() {
        it('Get all documents where fieldName is equal to the given value, or an empty array if no match', function() {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }
            const doc4 = { a: 23, tf: 'world' }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)

            assert.deepEqual(idx.getMatching('bloup'), [ doc3 ])
            assert.deepEqual(idx.getMatching('world'), [ doc4 ])
            assert.deepEqual(idx.getMatching('nope'), [])
        })

        it('Can get all documents for a given key in a unique index', function() {
            const idx = new Indexer('tf', true)
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            assert.deepEqual(idx.getMatching('bloup'), [doc3])
            assert.deepEqual(idx.getMatching('world'), [doc2])
            assert.deepEqual(idx.getMatching('nope'), [])
        })

/*
        it('Can get all documents for which a field is null', function () {
            var idx = new Index({ fieldName: 'tf' })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 2, tf: null }
                , doc3 = { a: 8, tf: 'world' }
                , doc4 = { a: 7, tf: null }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            assert.deepEqual(idx.getMatching('bloup'), [])
            assert.deepEqual(idx.getMatching('hello'), [doc1])
            assert.deepEqual(idx.getMatching('world'), [doc3])
            assert.deepEqual(idx.getMatching('yes'), [])
            assert.deepEqual(idx.getMatching(null), [doc2])

            idx.insert(doc4)

            assert.deepEqual(idx.getMatching('bloup'), [])
            assert.deepEqual(idx.getMatching('hello'), [doc1])
            assert.deepEqual(idx.getMatching('world'), [doc3])
            assert.deepEqual(idx.getMatching('yes'), [])
            assert.deepEqual(idx.getMatching(null), [doc2, doc4])
        })

        it('Can get all documents for a given key in a sparse index, but not unindexed docs (= field undefined)', function () {
            var idx = new Index({ fieldName: 'tf', sparse: true })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 2, nottf: 'bloup' }
                , doc3 = { a: 8, tf: 'world' }
                , doc4 = { a: 7, nottf: 'yes' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)

            assert.deepEqual(idx.getMatching('bloup'), [])
            assert.deepEqual(idx.getMatching('hello'), [doc1])
            assert.deepEqual(idx.getMatching('world'), [doc3])
            assert.deepEqual(idx.getMatching('yes'), [])
            assert.deepEqual(idx.getMatching(undefined), [])
        })

        it('Can get all documents whose key is in an array of keys', function () {
            // For this test only we have to use objects with _ids as the array version of getMatching
            // relies on the _id property being set, otherwise we have to use a quadratic algorithm
            // or a fingerprinting algorithm, both solutions too complicated and slow given that live nedb
            // indexes documents with _id always set
            var idx = new Index({ fieldName: 'tf' })
                , doc1 = { a: 5, tf: 'hello', _id: '1' }
                , doc2 = { a: 2, tf: 'bloup', _id: '2' }
                , doc3 = { a: 8, tf: 'world', _id: '3' }
                , doc4 = { a: 7, tf: 'yes', _id: '4' }
                , doc5 = { a: 7, tf: 'yes', _id: '5' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)
            idx.insert(doc5)

            assert.deepEqual(idx.getMatching([]), [])
            assert.deepEqual(idx.getMatching(['bloup']), [doc2])
            assert.deepEqual(idx.getMatching(['bloup', 'yes']), [doc2, doc4, doc5])
            assert.deepEqual(idx.getMatching(['hello', 'no']), [doc1])
            assert.deepEqual(idx.getMatching(['nope', 'no']), [])
        })

        it('Can get all documents whose key is between certain bounds', function () {
            var idx = new Index({ fieldName: 'a' })
                , doc1 = { a: 5, tf: 'hello' }
                , doc2 = { a: 2, tf: 'bloup' }
                , doc3 = { a: 8, tf: 'world' }
                , doc4 = { a: 7, tf: 'yes' }
                , doc5 = { a: 10, tf: 'yes' }


            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)
            idx.insert(doc4)
            idx.insert(doc5)

            assert.deepEqual(idx.getBetweenBounds({ $lt: 10, $gte: 5 }), [doc1, doc4, doc3])
            assert.deepEqual(idx.getBetweenBounds({ $lte: 8 }), [doc2, doc1, doc4, doc3])
            assert.deepEqual(idx.getBetweenBounds({ $gt: 7 }), [doc3, doc5])
        })
*/
    })

    describe('Resetting', function () {
        it('Can reset an index without any new data, the index will be empty afterwards', function () {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            assert.equal(3, idx.count())

            assert.equal(doc1, idx.find('hello'))
            assert.equal(doc2, idx.find('world'))
            assert.equal(doc3, idx.find('bloup'))

            idx.reset()
            assert.equal(0, idx.count())
            assert.equal(null, idx.find('hello'))
            assert.equal(null, idx.find('world'))
            assert.equal(null, idx.find('bloup'))
        })

        it('Can reset an index and initialize it with an array of documents', function () {
            const idx = new Indexer('tf')
            const doc1 = { a: 5, tf: 'hello' }
            const doc2 = { a: 8, tf: 'world' }
            const doc3 = { a: 2, tf: 'bloup' }
            const newDocs = [{ a: 555, tf: 'new' }, { a: 777, tf: 'again' }]

            idx.insert(doc1)
            idx.insert(doc2)
            idx.insert(doc3)

            assert.equal(3, idx.count())
            assert.equal(doc1, idx.find('hello'))
            assert.equal(doc2, idx.find('world'))
            assert.equal(doc3, idx.find('bloup'))

            idx.reset()
            idx.insert(newDocs)
            assert.equal(2, idx.count())
            assert.equal(null, idx.find('hello'))
            assert.equal(null, idx.find('world'))
            assert.equal(null, idx.find('bloup'))
            assert.equal(555, idx.find('new').a)
            assert.equal(777, idx.find('again').a)
        })
    })

    it('Get all elements in the index', function () {
        const idx = new Indexer('a')
        const doc1 = { a: 5, tf: 'hello' }
        const doc2 = { a: 8, tf: 'world' }
        const doc3 = { a: 2, tf: 'bloup' }

        idx.insert(doc1)
        idx.insert(doc2)
        idx.insert(doc3)

        assert.deepEqual([{ a: 2, tf: 'bloup' }, { a: 5, tf: 'hello' }, { a: 8, tf: 'world' }], idx.getAll())
    })
})