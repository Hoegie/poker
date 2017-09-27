var express    = require('express');
var bodyParser = require('body-parser');
var join = require('path').join;
var http = require('http');
var path = require('path');
var exec = require('child_process').exec;

var app = express();

  app.set('port', process.env.PORT || 9003);
  console.log(app.get('port'));
  app.use(bodyParser.urlencoded({ extended: false}));
  app.use(bodyParser.json());


app.post("/",function(req,res){
  res.end(JSON.stringify("webhook successfull"));
  console.log("webhook successfull !!");

  exec("sh /app/nodeprojects/github/soccerkessel/pokerhook.sh", function(error, stdout, stderr) {
                    // Log success in some manner
                    console.log( 'exec complete' );
            });
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});