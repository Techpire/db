/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localforage which chooses the best option depending on user browser (IndexedDB then WebSQL then localStorage)
 *
 * This version is the Node.js/Node Webkit version
 * It's essentially fs, mkdirp and crash safe write and read functions
 */

/*
var fs = require('fs')
    , mkdirp = require('mkdirp')
    , async = require('async')
    , path = require('path')
    , storage = {}
    ;

storage.exists = fs.exists;
storage.rename = fs.rename;
storage.writeFile = fs.writeFile;
storage.unlink = fs.unlink;
storage.appendFile = fs.appendFile;
storage.readFile = fs.readFile;
storage.mkdirp = mkdirp;
*/

import { access, appendFile, constants, mkdir, readFile, rename, unlink, writeFile } from 'fs'

export class Storage {
    public rename = rename;
    public writeFile = writeFile;
    public unlink = unlink;
    public appendFile = appendFile;
    public readFile = readFile;

    /**
     * Explicit name ...
     */
    public static ensureFileDoesntExist(file, callback) {
        this.exists(file, function(err) {
            if(err) {
                return callback(null)
            }

            unlink(file, function(err) {
                return callback(err)
            })
        })
    }

    public static exists(file, callback) {
        // If the file is visible and writable to the executing process.
        access(file, constants.F_OK, (err) => {
            return callback(err)
        })
    }

    public static mkdirp(dir: string, callback?) {
        mkdir(dir, { recursive: true }, (err) => {
            if(err) {
                return callback(err)
            }

            return callback(null)
        })
    }

    /**
     * Flush data in OS buffer to storage if corresponding option is set
     * @param {String} options.filename
     * @param {Boolean} options.isDir Optional, defaults to false
     * If options is a string, it is assumed that the flush of the file (not dir) called options was requested
     */
    public static flushToStorage(options, callback) {
        /*
        var filename, flags;
        if (typeof options === 'string') {
            filename = options;
            flags = 'r+';
        } else {
            filename = options.filename;
            flags = options.isDir ? 'r' : 'r+';
        }

        // Windows can't fsync (FlushFileBuffers) directories. We can live with this as it cannot cause 100% dataloss
        // except in the very rare event of the first time database is loaded and a crash happens
        if (flags === 'r' && (process.platform === 'win32' || process.platform === 'win64')) { return callback(null); }

        fs.open(filename, flags, function (err, fd) {
            if (err) { return callback(err); }
            fs.fsync(fd, function (errFS) {
                fs.close(fd, function (errC) {
                    if (errFS || errC) {
                        var e = new Error('Failed to flush to storage');
                        e.errorOnFsync = errFS;
                        e.errorOnClose = errC;
                        return callback(e);
                    } else {
                        return callback(null);
                    }
                });
            });
        });
        */
    }

    /**
     * Fully write or rewrite the datafile, immune to crashes during the write operation (data will not be lost)
     * @param {String} filename
     * @param {String} data
     * @param {Function} cb Optional callback, signature: err
     */
    public static crashSafeWriteFile(filename: string, data: string, cb: Function) {
        /*
        var callback = cb || function () { }
            , tempFilename = filename + '~';

        async.waterfall([
            async.apply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true })
            , function (cb) {
                storage.exists(filename, function (exists) {
                    if (exists) {
                        storage.flushToStorage(filename, function (err) { return cb(err); });
                    } else {
                        return cb();
                    }
                });
            }
            , function (cb) {
                storage.writeFile(tempFilename, data, function (err) { return cb(err); });
            }
            , async.apply(storage.flushToStorage, tempFilename)
            , function (cb) {
                storage.rename(tempFilename, filename, function (err) { return cb(err); });
            }
            , async.apply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true })
        ], function (err) { return callback(err); })
        */
    }

    /**
     * Ensure the datafile contains all the data, even if there was a crash during a full file write
     * @param {String} filename
     * @param {Function} callback signature: err
     */
    public static ensureDatafileIntegrity(filename: string, callback: Function) {
        /*
        var tempFilename = filename + '~';

        storage.exists(filename, function (filenameExists) {
            // Write was successful
            if (filenameExists) { return callback(null); }

            storage.exists(tempFilename, function (oldFilenameExists) {
                // New database
                if (!oldFilenameExists) {
                    return storage.writeFile(filename, '', 'utf8', function (err) { callback(err); });
                }

                // Write failed, use old version
                storage.rename(tempFilename, filename, function (err) { return callback(err); });
            });
        });
        */
    }
}