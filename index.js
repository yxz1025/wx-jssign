//微信js-sdk签名
var sha1 = require('sha1');
var crypto = require('crypto');
var Promise = require('bluebird');
var Redis = require('ioredis');
var request = Promise.promisifyAll(require('request'));
var co = require("co");

function WxSignPackage(opts) {
    this.opts = opts || {};
    this.appid = this.opts.appid || "";
    this.secret = this.opts.secret || "";
    this.token = this.opts.token || "";
    this.access_token_prefix = this.opts.access_token_prefix || "access_token_prefix_";
    this.jsticket_prefix = this.opts.jsticket_prefix || "jsticket_prefix_";
    this.clientRedis = new Redis('redis://:' + this.opts.redis_auth + '@' + this.opts.redis_host + ':6379/' + this.opts.redis_db);
};

//随即字符串
WxSignPackage.prototype.createNonceStr = function() {
    return Math.random().toString(36).substr(2, 15);
};

//时间戳产生函数
WxSignPackage.prototype.createTimeStamp = function() {
    return parseInt(new Date().getTime() / 1000) + '';
};

//计算签名
WxSignPackage.prototype.calcSignature = function(ticket, noncestr, ts, url) {
    var str = 'jsapi_ticket=' + ticket + '&noncestr=' + noncestr + '&timestamp=' + ts + '&url=' + url;
    var signature = crypto.createHash('sha1').update(str).digest('hex');
    return sha1(str);
};

//获取微信access_token
WxSignPackage.prototype.getAccessToken = co.wrap(function*() {
    var self = this;
    var key = self.access_token_prefix + self.token;
    var redisData = yield self.clientRedis.get(key);
    if (redisData) {
        return JSON.parse(redisData);
    } else {
        redisData = yield request.getAsync('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + self.appid + '&secret=' + self.secret);
        if (redisData.statusCode == 200) {
            var data = redisData.body;
            self.clientRedis.setex(key, 3600, data);
            return JSON.parse(data);
        }

    }
    return false;
});

//获取ticket 此处为generator
WxSignPackage.prototype.getTicket = function*() {
    var self = this;
    var key = self.jsticket_prefix + self.token;
    var redisData = yield self.clientRedis.get(key);
    if (redisData) {
        return JSON.parse(redisData);
    } else {
        var ret = yield self.getAccessToken();
        redisData = yield request.getAsync('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + ret.access_token + '&type=jsapi');
        if (redisData.statusCode == 200) {
            var data = redisData.body;
            self.clientRedis.setex(key, 3600, data);
            return JSON.parse(data);
        }

    }
    return false;
};

//获取签名package
WxSignPackage.prototype.getSignPackage = co.wrap(function*(url) {
    var self = this;
    var appid = self.appid;
    var ts = self.createTimeStamp();
    var nonceStr = self.createNonceStr();
    var tickets = yield self.getTicket();
    var signature = self.calcSignature(tickets.ticket, nonceStr, ts, url);
    var package = {
        appid: appid,
        nonceStr: nonceStr,
        timestamp: ts,
        signature: signature,
        url: url
    };
    return package;
});

module.exports = WxSignPackage;
