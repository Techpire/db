import async from 'async'

export class Executor {
    private _buffer: any[] = []
    private _ready = false

    private _queue = async.queue(function(task: any, cb: any): any {
        let newArguments = []

        task.arguments.each(() => {             // TODO: .each performance?
            newArguments.push(task.argument)
        })

        let lastArg = task.arguments[task.arguments.length - 1]

        // Always tell the queue task is complete. Execute callback if any was given.
        if(typeof lastArg === 'function') {
            // Callback was supplied
            newArguments[newArguments.length - 1] = function () {
                if(typeof setImmediate === 'function') {
                    setImmediate(cb)
                } else {
                    process.nextTick(cb)
                }

                lastArg.apply(null, arguments)
            }
        } else if(!lastArg && task.arguments.length !== 0) {
            // false/undefined/null supplied as callbback
            newArguments[newArguments.length - 1] = function () { cb() }
        } else {
            // Nothing supplied as callback
            newArguments.push(function () { cb() })
        }

        task.fn.apply(task.this, newArguments)
    }, 1)

    public push(task: any, forceQueuing: boolean = false) {
        if(this._ready || forceQueuing) {
            this._queue.push(task)
        } else {
            this._buffer.push(task)
        }
    }

    public processBuffer = function () {
        this.ready = true

        for(let i = 0; i < this._buffer.length; i += 1) { this.queue.push(this.buffer[i]) }
        this.buffer = []
    }
}
