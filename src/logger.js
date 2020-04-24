function Logger(...args) {
    this.args = args;
}

/**
 *
 * @param {string} level
 * @param {any} msg
 * @private
 */
function _log(level,msg){
    //let d = new Date().toLocaleString()

    if(msg.req){
        msg = JSON.stringify({method:msg.req.method,url:msg.req.url,hostname:msg.req.hostname,ip:msg.req.ip})
    }
    if(msg.res){
        msg = JSON.stringify({statusCode:msg.res.statusCode,statusMessage:msg.res.statusMessage,responseTime:msg.responseTime})
    }
    console.log(msg)
}
Logger.prototype.info = function (msg) { _log("INFO", msg); };
Logger.prototype.error = function (msg) { _log("ERROR", msg); };
Logger.prototype.debug = function (msg) { _log("DEBUG", msg); };
Logger.prototype.fatal = function (msg) { _log("FATAL", msg); };
Logger.prototype.warn = function (msg) { _log("WARN", msg); };
Logger.prototype.trace = function (msg) {_log("TRACE", msg); };
Logger.prototype.child = function () { return new Logger() };

module.exports=Logger