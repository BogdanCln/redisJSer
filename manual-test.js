// Manual testing cuz i m lazy
const redisJSer = require("./index.js");

async function main() {
	let testRedis = await redisJSer.createInstance({
        host: "localhost",
        post: "6379",
        db: 0
    });
    console.log(JSON.stringify(testRedis.redisDump, 0, 2));
    // If you update / delete a key you should get a message about it.
}

main();