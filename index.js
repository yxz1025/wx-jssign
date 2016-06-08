//微信js-sdk签名
var sha1 = require('sha1');
var crypto = require('crypto');
var Q = require('q');
var Redis = require('ioredis');
var request = require('request');

function WxSignPackage(opts) {
    this.opts = opts || {};
    this.appid = this.opts.appid || "";
    this.secret = this.opts.secret || "";
    this.token = this.opts.token || "";
    this.access_token_prefix = this.opts.access_token_prefix || "access_token_prefix_";
    this.jsticket_prefix = this.opts.jsticket_prefix || "jsticket_prefix_";
    this.clientRedis = new Redis('redis://:' + this.opts.redis_auth + '@' + this.opts.redis_host + ':6379/' + this.opts.redis_db);
}

//随即字符串
WxSignPackage.prototype.createNonceStr = function() {
    return Math.random().toString(36).substr(2, 15);
}

//时间戳产生函数
WxSignPackage.prototype.createTimeStamp = function() {
    return parseInt(new Date().getTime() / 1000) + '';
}

//计算签名
WxSignPackage.prototype.calcSignature = function(ticket, noncestr, ts, url) {
    var str = 'jsapi_ticket=' + ticket + '&noncestr=' + noncestr + '&timestamp=' + ts + '&url=' + url;
    var signature = crypto.createHash('sha1').update(str).digest('hex');
    return sha1(str);
}

//获取微信access_token
WxSignPackage.prototype.getAccessToken = function() {
    var self = this;
    var deferred = Q.defer();
    var key = self.access_token_prefix + self.token;
    self.clientRedis.get(key).then(function(redisData) {
        if (redisData) {
            var args = JSON.parse(redisData);
            deferred.resolve(args);
        } else {
            request('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + self.appid + '&secret=' + self.secret, function(err, response, data) {
                if (err) {
                    deferred.reject(err);
                }
                if (!err && response.statusCode == 200) {
                    try {
                        var resp = JSON.parse(data);
                        self.clientRedis.setex(key, 3600, JSON.stringify(resp));
                        deferred.resolve(resp);
                    } catch (e) {
                        deferred.reject(e.message);
                    }
                }
            });

        }
    });
    return deferred.promise;
}

//获取ticket
WxSignPackage.prototype.getTicket = function() {
    var self = this;
    var deferred = Q.defer();
    var key = self.jsticket_prefix + self.token;
    self.clientRedis.get(key).then(function(redisData) {
        if (redisData) {
            var args = JSON.parse(redisData);
            deferred.resolve(args);
        } else {
            self.getAccessToken().then(function(ret) {
                if (!ret) {
                    deferred.reject(null);
                } else {
                    request('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + ret.access_token + '&type=jsapi', function(err, response, data) {
                        if (err) {
                            deferred.reject(null);
                        }
                        if (!err && response.statusCode == 200) {
                            try {
                                var resp = JSON.parse(data);
                                self.clientRedis.setex(key, 3600, JSON.stringify(resp));
                                deferred.resolve(resp);
                            } catch (e) {
                                deferred.reject(null);
                            }
                        }
                    });
                }
            });
        }
    });
    return deferred.promise;
}

//获取签名package
WxSignPackage.prototype.getSignPackage = function(url) {
    var self = this;
    var deferred = Q.defer();
    var appid = config.member_config.appid;
    var ts = self.createTimeStamp();
    var nonceStr = self.createNonceStr();

    //获取ticket
    self.getTicket().then(function(ticket) {
        if (!ticket) {
            deferred.reject(null);
        } else {
            var signature = self.calcSignature(ticket.ticket, nonceStr, ts, url);
            var package = {
                appid: appid,
                nonceStr: nonceStr,
                timestamp: ts,
                signature: signature,
                url: url
            };
            deferred.resolve(package);
        }
    });
    return deferred.promise;
}

module.exports = WxSignPackage;
