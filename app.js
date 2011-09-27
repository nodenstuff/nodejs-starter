
/**
 * Module dependencies.
 */

var express = require('express');
var RedisStore = require('connect-redis')(express);
var redis = require('redis').createClient();

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ store: new RedisStore({maxAge: 24*3600*1000}), secret: 'hookioisgreat' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res) {
  if(req.session.user) {
    res.render('index');
  } else {
    res.render('login');
  }
});

app.post('/', function(req, res) {
  res.render('index');
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.post('/register', function(req, res) {
  var emailaddr = req.param('emailaddr');
  if(emailaddr && req.param('password') && req.param('cpassword')) {
    if(req.param('password')==req.param('cpassword')) {
      if(!redis.exists('user:' + emailaddr)) {
        res.redirect('/');
      } else {
        req.flash('info', 'Username/Email already taken.');
        res.render('register', {locals: {flash: req.flash()}});
      }
    } else {
      req.flash('info', 'Passwords do not match.');
      res.render('register', {locals: {flash: req.flash()}});
    }
  } else {
    req.flash('info', 'Please fill all the fields.');
    res.render('register', {locals: {flash: req.flash()}});
  }
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

app.listen(process.env.VCAP_APP_PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
