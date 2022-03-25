import { assert } from 'chai'
import { Datastore } from '../src/Datastore'
import { access, constants, unlink } from 'fs'
import { waterfall } from 'async'
import { Persistence } from '../src/Persistence'
import path from 'path'
import { DatastoreOptions } from '../src/models/DataStoreOptions'
import _ from 'lodash'

describe('Executor', function () {
    const testDb = 'test/databases/test.db'

    // Note:  The following test does not have any assertion because it
    // is meant to address the deprecation warning:
    // (node) warning: Recursive process.nextTick detected. This will break in the next version of node. Please use setImmediate for recursive deferral.
    // see
    function testEventLoopStarvation(d, done) {
        let times = 1001

        for(let i = 0; i < times; i++) {
            d.find({ "bogus": "search" }, (err, docs) => { })
        }

        done()
    };

    // Test that operations are executed in the right order even with no callback
    function testExecutorWorksWithoutCallback(d, done) {
        d.insert({ a: 1 })
        d.insert({ a: 2 }, false)

        d.find({}, (err, docs) => {
            assert.equal(2, docs.length)
        })

        done()
    }

    // Test that if the callback is falsy, the next DB operations will still be executed
    function testFalsyCallback(d, done) {
        d.insert({ a: 1 }, null)

        process.nextTick(() =>{
            d.update({ a: 1 }, { a: 2 }, {}, null)

            process.nextTick(() => {
                d.update({ a: 2 }, { a: 1 }, null)

                process.nextTick(() => {
                    d.remove({ a: 2 }, {}, null)

                    process.nextTick(() => {
                        d.remove({ a: 2 }, null)

                        process.nextTick(() => {
                            d.find({}, done())
                        })
                    })
                })
            })
        })
    }

    // Test that operations are executed in the right order
    // We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
    function testRightOrder(d, done) {
        let currentUncaughtExceptionHandlers = process.listeners('uncaughtException')

        process.removeAllListeners('uncaughtException')
        process.on('uncaughtException', (err) => {
            // Do nothing with the error which is only there to test we stay on track
        });

        d.find({}, (err, docs) => {
            assert.equal(0, docs.length)

            d.insert({ a: 1 }, function() {
                d.update({ a: 1 }, { a: 2 }, {}, function() {
                    d.find({}, function (err, docs) {
                        docs[0].a.should.equal(2)

                        process.nextTick(function() {
                            d.update({ a: 2 }, { a: 3 }, {}, function() {
                                d.find({}, function(err, docs) {
                                    docs[0].a.should.equal(3)

                                    process.removeAllListeners('uncaughtException')

                                    for(let i = 0; i < currentUncaughtExceptionHandlers.length; i++) {
                                        process.on('uncaughtException', currentUncaughtExceptionHandlers[i])
                                    }
                                })
                            })
                        })

                        throw new Error('Some error')
                    })
                })
            })
        })

        done()
    }

    // Test that even if a callback throws an exception, the next DB operations will still be executed
    // We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
    function testThrowInCallback(d, done) {
        let currentUncaughtExceptionHandlers = process.listeners('uncaughtException')

        process.removeAllListeners('uncaughtException')
        process.on('uncaughtException', (err) => { /* Do nothing with the error which is only there to test we stay on track */ })

        d.find({}, (err) => {
            process.nextTick(() => {
                d.insert({ bar: 1 }, (err) => {
                    process.removeAllListeners('uncaughtException')

                    for(let i = 0; i < currentUncaughtExceptionHandlers.length; i += 1) {
                        process.on('uncaughtException', currentUncaughtExceptionHandlers[i])
                    }
                })
            })

            throw new Error('Some error')
        })

        done()
    }

    describe('With persistent database', function() {
        let d

        beforeEach(function(done) {
            d = new Datastore(new DatastoreOptions({ filename: testDb }))

            assert.equal(testDb, d.fileName)
            assert.equal(false, d.inMemoryOnly)

            waterfall([
                function(cb) {
                    Persistence.ensureDirectoryExists(path.dirname(testDb), () => {
                        access(testDb, constants.R_OK, function(err) {
                            if(err) { return cb }
                            else { unlink(testDb, cb) }
                        })
                    })
                }
                , function(cb) {
                    d.loadDatabase((err) => {
                        assert.isNull(err)
                        assert.equal(0, d.getAllData().length)

                        return cb
                    })
                }
            ])

            done()
        })

        it('A throw in a callback doesnt prevent execution of next operations', function(done) {
            testThrowInCallback(d, done)
        })

        it('A falsy callback doesnt prevent execution of next operations', function(done) {
            testFalsyCallback(d, done)
        })
        it('Operations are executed in the right order', function(done) {
            testRightOrder(d, done)
        })

        it('Does not starve event loop and raise warning when more than 1000 callbacks are in queue', function(done) {
            testEventLoopStarvation(d, done)
        })

        it('Works in the right order even with no supplied callback', function(done) {
            testExecutorWorksWithoutCallback(d, done)
        })
    })

    describe('With non persistent database', function() {
        let d

        beforeEach(function(done) {
            d = new Datastore({ inMemoryOnly: true })
            assert.equal(true, d.inMemoryOnly)

            d.loadDatabase(function(err) {
                assert.equal(null, err)
                assert.equal(0, d.getAllData().length)
            })

            done()
        })

        it('A throw in a callback doesnt prevent execution of next operations', function(done) {
            testThrowInCallback(d, done)
        })

        it('A falsy callback doesnt prevent execution of next operations', function(done) {
           testFalsyCallback(d, done)
        })

        it('Operations are executed in the right order', function(done) {
            testRightOrder(d, done)
        })

        it('Works in the right order even with no supplied callback', function(done) {
            testExecutorWorksWithoutCallback(d, done)
        })
    })
})