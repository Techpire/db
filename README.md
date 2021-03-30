# db
holding repo for nedb typescript conversion

# Differences from NeDB
* Index field with an array value are explicitly not supported.
* Inserting a duplicate key will overwrite the existing key.

# Issues
## Indexes
* If a document fails, the old version should be restored. If isUniqueKeys is false and doc 1 and 2 succeed, unique , and #3 fails, docs 1 and 2 are just lost despite already.