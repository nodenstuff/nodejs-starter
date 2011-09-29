
/**
 * Module dependencies.
 */

var express = require('express'),
    redis = require('redis'),
    crypto = require('crypto'),
    nconf = require('nconf'),
    redisStore = require('connect-redis')(express);

var _ = require('underscore');

var app = module.exports = express.createServer(),
    config = new nconf.Provider(),
    mode = process.env.NODE_ENV || 'development',
    port = 3000;

// Environments configuration

config.use('file', { file: './config.json' });
config.load();
config = config.file.store;

// Configuration

if(config.cloudfoundry) {
  var cmode = config.cloudfoundry.env;
  app.configure(cmode, function(){
    port = process.env.VCAP_APP_PORT || 3000;
    var service = JSON.parse(process.env.VCAP_SERVICES)['redis-2.2'][0].credentials;
    config[cmode].redis = { host: service.hostname, port: service.port, pass: service.password };
  });
}

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));

  redis = redis.createClient(config[mode].redis.port, config[mode].redis.host);
  if(config[mode].redis.pass) {
    redis.auth(config[mode].redis.pass);
  }
});

app.configure('development', function(){
  app.use(express.session({ secret: 'nodejsstarter' }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', 'staging', function(){
  var sessionStore = new redisStore(_.extend(config[mode].redis, {maxAge: 24*3600*1000}));
  app.use(express.session({ store: sessionStore, secret: 'nodejsstarter' }));
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res) {
  if(req.session && req.session.user) {
    res.render('index');
  } else {
    if(req.session) {
      res.render('login', {locals: {flash: req.flash()}});
    } else {
      res.render('login');
    }
  }
});

app.post('/', function(req, res) {
  var emailaddr = req.param('emailaddr');
  var password = req.param('password');
  if(emailaddr && password) {
    redis.exists('user:' + emailaddr, function(err, rep){
      if(rep) {
        password = crypto.createCipher('blowfish', password).final('base64');
        redis.hgetall('user:' + emailaddr, function(err, rep) {
          if(rep.password==password) {
            req.session.user = 'user:' + emailaddr;
            req.session.uid = rep.id;
            req.flash('success', 'Successfully logged in.');
            res.redirect('/');
          } else {
            req.flash('warning', 'Incorrect password.');
            res.render('login', {locals: {flash: req.flash()}});
          }
        });
      } else {
        req.flash('warning', 'Email address not found.');
        res.render('login', {locals: {flash: req.flash()}});
      }
    });
  } else {
    req.flash('warning', 'Please fill all the fields.');
    res.render('login', {locals: {flash: req.flash()}});
  }
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.post('/register', function(req, res) {
  var emailaddr = req.param('emailaddr');
  var password = req.param('password');
  var cpassword = req.param('cpassword');
  if(emailaddr && password && cpassword) {
    if(password==cpassword) {
      redis.exists('user:' + emailaddr, function(err, rep){
        if(!rep) {
          redis.incr('users');
          redis.get('users', function(err, rep){
            password = crypto.createCipher('blowfish', password).final('base64');
            redis.hmset('user:' + emailaddr, {
              "id": rep,
              "password" : password,
              "config" : ""
            });
            req.flash('success', 'Successfully registered.');
            res.redirect('/');
          });
        } else {
          req.flash('warning', 'Email Address already taken.');
          res.render('register', {locals: {flash: req.flash()}});
        }
      });
    } else {
      req.flash('warning', 'Passwords do not match.');
      res.render('register', {locals: {flash: req.flash()}});
    }
  } else {
    req.flash('warning', 'Please fill all the fields.');
    res.render('register', {locals: {flash: req.flash()}});
  }
});

app.get('/logout', function(req, res) {
  req.session.user = null;
  req.session.uid = null;
  req.flash('success', 'Successfully logged out.')
  res.redirect('/');
});

app.listen(port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
