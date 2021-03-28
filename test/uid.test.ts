import { Uid } from '../src/Uid'

const assert = require('assert')

describe('Uid tests', function () {
    describe('uid', function () {
        it('Generates a string of the expected length', function () {
            assert.equal(24, Uid.newUid().length)
        })

        it('Generates a string of the expected length', function () {
            assert.equal(3, Uid.newUid(3).length)
            assert.equal(16, Uid.newUid(16).length)
            assert.equal(42, Uid.newUid(42).length)
            assert.equal(1000, Uid.newUid(1000).length)
        })

        // Very small probability of conflict
        it('Generated uids should not be the same', function () {
            assert.equal(false, Uid.newUid(56) == Uid.newUid(56))
        })

    });

});