# wx-jssign
微信js-sdk网页签名，支持express和koa-generator调用
### 后端调用,需要redis模块用于缓存access_token
    var WxSignPackage = require("wx-jssign");
    var opts = {
      appid: "appid",
      secret: "secret",
      token: "公众号token",
      access_token_prefix: "access_token_prefix_",//缓存access_token得前缀key
      jsticket_prefix: "jsticket_prefix_",
      redis_auth: "redis密码",
      redis_host: "redis地址",
      redis_db: "redis第几个库"
    };
    
    var wxsign = new WxSignPackage(opts);
    
    //支持json和jsonp
    var url = req.query.url;
    var callback = req.query.callback || "";
    wxsign.getSignPackage(url)
        .then(function(package) {
            if (callback == "") {
                res.json(package);
            }else{
                res.jsonp(package);
            }
        }, function(err) {
            res.jsonp(err);
        });
