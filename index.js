const redis = require("redis"),
    async = require("async"),
    redisOptions = {
        host: "localhost",
        post: "6379",
        db: 1
    },
    Deferred = require('deferred');

const EVENTS = [
    "__keyevent@" + redisOptions.db + "__:set",
    "__keyevent@" + redisOptions.db + "__:del"
];

class redisJSer {
    constructor(data, options, events, rc) {
        this.redisDump = data;
        this.options = options;
        this.events = events;
        this.redisController = rc;
        this.startUpdater();
    }

    static async createInstance(args = undefined) {
        let options = redisOptions,
            events = EVENTS;
        if (args !== undefined) {
            Object.keys(args).forEach(arg => {
                options[arg] = args[arg];
                if (arg === "db") {
                    events.forEach((ev, i) => {
                        let dbIndex = ev.indexOf("@");
                        if (dbIndex !== -1) {
                            events[i] = ev.slice(0, dbIndex + 1) + args.db + ev.slice(dbIndex + 2);
                        }
                    });
                }
            });
        }

        let rc = redis.createClient(options);

        return redisJSer.loadRedisData(rc)(redisDump => {
            return new redisJSer(redisDump, options, events, rc);
        });
    }

    static loadRedisData(rc) {
        let redisDump = {},
            redisParser = new Deferred();

        rc.keys("*", (err, keys) => {
            async.each(keys, (key, callback) => {
                new Promise((resolve, reject) => {
                    try {
                        rc.get(key, (err, value) => {
                            if (typeof value === "string") {
                                resolve(value);
                            } else {
                                reject(err);
                            }
                        });
                    }
                    catch (err) {
                        reject(err);
                    }
                }).then((res) => {
                    redisDump[key] = JSON.parse(res);
                    callback();
                }).catch((err) => {
                    callback();
                });
            }, err => {
                if (!err) {
                    redisParser.resolve(redisDump);
                } else {
                    console.log(err);
                }
            });

        });

        return redisParser.promise;
    }

    startUpdater() {
        let rc = this.redisController,
            self = this;

        let pubSubClient = new redis.createClient(self.options)
            // this client will be used only for announcing changes
            .on('message', function (channel, key) {
                let actionType = channel.split(":")[1],
                    parseMsg = new Deferred;
                switch (actionType) {
                    case "set":
                        new Promise((resolve, reject) => {
                            rc.get(key, function (err, value) {
                                if (typeof value === "string") {
                                    resolve(value);
                                } else {
                                    reject();
                                }
                            });
                        }).then((newData) => {
                            // check if JSON
                            try {
                                self.redisDump[key] = JSON.parse(newData);
                                parseMsg.resolve(1);
                            } catch (err) {
                                parseMsg.resolve(0);
                            }
                        }).catch(err => {
                            console.trace(err);
                            parseMsg.resolve(0);
                        });
                        break;
                    case "del":
                        console.log('Key "' + key + '" deleted!');
                        delete self.redisDump[key];
                        parseMsg.resolve(1);
                        break;
                    default:
                        parseMsg.resolve(0);
                }
                parseMsg.promise.then(status => {
                    switch (status) {
                        case 0:
                            // console.log("Error on this channel: " + channel);
                            break;
                        case 1:
                            console.log("Update ", key);
                            break;                        
                    }
                });
            });

        self.events.forEach(ev => {
            console.log("Sub to ", ev);
            pubSubClient.subscribe(ev);
        });
    }
}

module.exports = redisJSer;
