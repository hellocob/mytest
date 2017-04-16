/*!
 * nodeclub - app.js
 */

/**
 * Module dependencies.
 */

var config = require('./config');
//https://www.npmjs.com/package/loader
//http://www.oneapm.com/
//oneApm用于网站监控的平台
if (!config.debug && config.oneapm_key) {
  require('oneapm');
} 

//NodeJS终端着色colors插件
//console.log('hello'.green); // outputs green text
require('colors');

//Node.js的Path对象
//如：path.join('///foo', 'bar', '//baz/asdf', 'quux', '..');
//=>'/foo/bar/baz/asdf'
var path = require('path');

//loader: ejs-view-helper, 静态资源加载处理
var Loader = require('loader'); 
//Loader Connect是一个适配Connect/Express的静态资源加载器，它基于静态文件的文件扩展名来对源文件进行编译。
var LoaderConnect = require('loader-connect')

var express = require('express');
var session = require('express-session');

//用于验证请求
var passport = require('passport');
require('./middlewares/mongoose_log'); // 打印 mongodb 查询日志

//github验证
var GitHubStrategy = require('passport-github').Strategy;
var githubStrategyMiddleware = require('./middlewares/github_strategy');

require('./models');//加载 数据模块
var webRouter = require('./web_router'); //加载web路由
var apiRouterV1 = require('./api_router_v1');//加载api 路由
var auth = require('./middlewares/auth');
var errorPageMiddleware = require('./middlewares/error_page');
var proxyMiddleware = require('./middlewares/proxy');
var RedisStore = require('connect-redis')(session);//Redis session store 
var _ = require('lodash');
var csurf = require('csurf');//csurf攻击的方法 http://www.cnblogs.com/y-yxh/p/5761941.html
var compress = require('compression');//压缩中间件
var bodyParser = require('body-parser');
var busboy = require('connect-busboy');//中间件实现上传 http://yijiebuyi.com/blog/63e459ea188e1ec2463cb0ebd7b06f4f.html
var errorhandler = require('errorhandler');//https://github.com/expressjs/errorhandler
var cors = require('cors');  //跨域请求CORS http://blog.csdn.net/baby97/article/details/50329491
var requestLog = require('./middlewares/request_log');
var renderMiddleware = require('./middlewares/render');
var logger = require('./common/logger');
var helmet = require('helmet');//，使用Helmet能帮助你的应用避免这些攻击 http://www.jdon.com/46839
var bytes = require('bytes') //https://www.npmjs.com/package/bytes


// 静态文件目录
var staticDir = path.join(__dirname, 'public');
// assets
var assets = {};

if (config.mini_assets) {  //是否启用静态文件压缩，调试时返回否
  try {
    assets = require('./assets.json');
  } catch (e) {
    logger.error('You must execute `make build` before start app when mini_assets is true.');
    throw e;
  }
}

var urlinfo = require('url').parse(config.host);
config.hostname = urlinfo.hostname || config.host;

var app = express();

// configuration in all env
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs-mate'));
app.locals._layoutFile = 'layout.html';
app.enable('trust proxy');

// Request logger。请求时间
app.use(requestLog);

if (config.debug) {
  // 渲染时间
  app.use(renderMiddleware.render); //debug状态控制台输出view的调试输出
}

// 静态资源
if (config.debug) {
  app.use(LoaderConnect.less(__dirname)); // 测试环境用，编译 .less on the fly
}
app.use('/public', express.static(staticDir));
app.use('/agent', proxyMiddleware.proxy);

// 通用的中间件
app.use(require('response-time')());//记录HTTP服务器中请求的响应时间
app.use(helmet.frameguard('sameorigin'));//frameguard阻止clickjacking
app.use(bodyParser.json({limit: '1mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(require('method-override')());   //http://blog.csdn.net/boyzhoulin/article/details/40146197
app.use(require('cookie-parser')(config.session_secret));//cookieParser中间件用于获取web浏览器发送的cookie中的内容 http://www.jb51.net/article/58168.htm
app.use(compress());
app.use(session({
  secret: config.session_secret,
  store: new RedisStore({
    port: config.redis_port,
    host: config.redis_host,
    db: config.redis_db,
    pass: config.redis_password,
  }),
  resave: false,
  saveUninitialized: false,
}));

// oauth 中间件
app.use(passport.initialize());

// github oauth
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});
passport.use(new GitHubStrategy(config.GITHUB_OAUTH, githubStrategyMiddleware));

// custom middleware
app.use(auth.authUser);
app.use(auth.blockUser());

if (!config.debug) {
  app.use(function (req, res, next) {
    if (req.path === '/api' || req.path.indexOf('/api') === -1) {
      csurf()(req, res, next);
      return;
    }
    next();
  });
  app.set('view cache', true);
}

// for debug
// app.get('/err', function (req, res, next) {
//   next(new Error('haha'))
// });

// set static, dynamic helpers
_.extend(app.locals, {
  config: config,
  Loader: Loader,
  assets: assets
});

app.use(errorPageMiddleware.errorPage);
_.extend(app.locals, require('./common/render_helper'));
app.use(function (req, res, next) {
  res.locals.csrf = req.csrfToken ? req.csrfToken() : '';
  next();
});

app.use(busboy({
  limits: {
    fileSize: bytes(config.file_limit)
  }
}));

// routes
app.use('/api/v1', cors(), apiRouterV1);
app.use('/', webRouter);

// error handler
if (config.debug) {
  app.use(errorhandler());
} else {
  app.use(function (err, req, res, next) {
    logger.error(err);
    return res.status(500).send('500 status');
  });
}

if (!module.parent) {
  app.listen(config.port, function () {
    logger.info('NodeClub listening on port', config.port);
    logger.info('God bless love....');
    logger.info('You can debug your app with http://' + config.hostname + ':' + config.port);
    logger.info('');
  });
}

module.exports = app;
