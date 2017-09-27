var express    = require('express');
var mysql      = require('mysql');
var bodyParser = require('body-parser');

var apn = require('apn');
var gcm = require('node-gcm');
var fs = require('fs');
var nodemailer = require('nodemailer');
var join = require('path').join;
var http = require('http');
var https = require('https');
var path = require('path');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'Hoegaarden',
  database : 'poker'
});

var app = express();

  app.set('port', process.env.PORT || 5000);
  app.set('porthttps', 5001);
  app.use(bodyParser.urlencoded({ extended: false}));
  app.use(bodyParser.json());

/*IOS push message set up*/

var apnProvider = new apn.Provider({  
      token: {
          key: 'certs/apns.p8', // Path to the key p8 file
          keyId: 'AW53VE2WG7', // The Key ID of the p8 file (available at https://developer.apple.com/account/ios/certificate/key)
          teamId: '857J4HYVDU', // The Team ID of your Apple Developer Account (available at https://developer.apple.com/account/#/membership/)
      },
      production: true // Set to true if sending a notification to a production iOS app
  });  


/*GCM setup*/

var PGrequestMessage = new gcm.Message();
var sender = new gcm.Sender('AIzaSyB0339bSkfvQwxw7tvn_rdbIQ7Lmb6ILEk');


/*Email setup*/

var transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: 'pokergroupsinfo@gmail.com',
            pass: "4'Hoegaarden"
          }
});

/*Email handling*/

app.put("/email/recoverpassword/:accountid",function(req,res){
var toaddress = req.body.toaddress;
var newpassword = req.body.newpassword;
var put = {
      password: req.body.hashedpassword,
      passwordrecovered: 'Y'
};
var mailOptions = {
  from: 'pokergroupsinfo@gmail.com',
  to: toaddress,
  subject: 'Poker Groups password reset',
  text: 'Hello, \n\n Your password has been reset to ' + newpassword + '\n\n\n Kind regards, \n The Poker Groups team'
};
transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.log(error);
      res.end(JSON.stringify(error));
    }else{
      console.log('Message sent: ' + info.response);
      res.end(JSON.stringify(info.response));
      connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.accountid], function(err,result) {
        if (!err){
          console.log(result);
          res.end(JSON.stringify(result.changedRows));
        }else{
          console.log('Error while performing Query.');
        }
      });
    };
});
});


/*APN & GCM*/

app.post("/pokergroups/iospush/:pgid",function(req,res){
  var PGID = req.params.pgid;
  var pgname = req.body.pgname;
  var notification2 = new apn.Notification();
  notification2.topic = 'be.degronckel.PokerGroups';
  notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
  notification2.sound = 'ping.aiff';
  notification2.title = "Let's play poker !";
  notification2.body = 'New poker event created for ' + req.body.pgname;
  connection.query('SELECT DISTINCT apntokens.token FROM apntokens INNER JOIN users ON apntokens.accountID = users.accountID WHERE users.PGID = ? and apntokens.send = 1 and device_type = "apple"', PGID, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          apnProvider.send(notification2, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/pokergroups/androidpush/:pgid",function(req,res){
  var PGID = req.params.pgid;
  var pgname = req.body.pgname;
  PGrequestMessage.addNotification({
    title: "Let's play poker !",
    body: 'New poker event created for ' + req.body.pgname,
    icon: 'ic_add_alert_white_48dp'
  });
  connection.query('SELECT DISTINCT apntokens.token FROM apntokens INNER JOIN users ON apntokens.accountID = users.accountID WHERE users.PGID = ? and apntokens.send = 1 and device_type = "android"', PGID, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        sender.sendNoRetry(PGrequestMessage, { to : row.token }, function(err, response) {
        if(err) console.error(err);
        else {
          console.log(JSON.stringify(response));
        }
        });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/pokergroups/pgrequest/iospush",function(req,res){
  
  var accountID = req.body.accountid;
  var pgname = req.body.pgname;
  var pokername = req.body.pokername;
  var notification2 = new apn.Notification();
  notification2.topic = 'be.degronckel.PokerGroups';
  notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
  notification2.sound = 'ping.aiff';
  notification2.title = "Poker request";
  notification2.body = pokername + " want's to join " + pgname;
  connection.query('SELECT token FROM apntokens WHERE accountID = ? and apntokens.send = 1 and device_type = "apple"', accountID, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          apnProvider.send(notification2, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/pokergroups/pgrequest/androidpush",function(req,res){
  
  var accountID = req.body.accountid;
  var pgname = req.body.pgname;
  var pokername = req.body.pokername;
  PGrequestMessage.addNotification({
    title: "Poker request",
    body: pokername + " want's to join " + pgname,
    icon: 'ic_add_alert_white_48dp'
  });
  connection.query('SELECT token FROM apntokens WHERE accountID = ? and apntokens.send = 1 and device_type = "android"', accountID, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        sender.sendNoRetry(PGrequestMessage, { to : row.token }, function(err, response) {
        if(err) console.error(err);
        else {
          console.log(JSON.stringify(response));
        }
        });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

/*APNTOKENS*/

app.get("/apn/info/:accountid/:deviceid",function(req,res){
  var data = {
        accountID: req.params.accountid,
        deviceID: req.params.deviceid
    };
connection.query('SELECT COUNT(*) as controle from apntokens WHERE accountID = ? AND device = ?', [data.accountID, data.deviceID], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/apn/pgid/:pgid",function(req,res){
  var data = {
        PGID: req.params.pgid
    };
connection.query('SELECT DISTINCT apntokens.token FROM apntokens INNER JOIN users ON apntokens.accountID = users.accountID WHERE users.PGID = ? and apntokens.send = 1 and device_type = "apple"', data.PGID, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/apn/accountid/:accountid",function(req,res){
  var data = {
        accountID: req.params.accountid
    };
connection.query('SELECT token FROM apntokens WHERE accountID = ? and apntokens.send = 1 and device_type = "apple"', data.accountID, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/apn/new",function(req,res){
  var post = {
        accountID: req.body.accountID,
        device: req.body.device,
        token: req.body.token,
        send: req.body.send,
        device_type: 'apple'
    };
    console.log(post);
connection.query('INSERT INTO apntokens SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidapn/new",function(req,res){
  var post = {
        accountID: req.body.accountID,
        device: req.body.device,
        token: req.body.token,
        send: req.body.send,
        device_type: 'android'
    };
    console.log(post);
connection.query('INSERT INTO apntokens SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



app.put("/apn/:accountid/:deviceid",function(req,res){
  var put = {
        token: req.body.token,
        send: req.body.send
    };
    console.log(put);
connection.query('UPDATE apntokens SET ? WHERE accountID = ? and device = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/apn/:accountid/:token/:deviceid",function(req,res){
  var data = {
        accountid: req.params.accountid,
        token: req.params.token,
        deviceid: req.params.deviceid
    };
    console.log(data);
connection.query('DELETE FROM apntokens WHERE accountID = ? and token = ? and device = ?', [data.accountid, data.token, data.deviceid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



/*ACCOUNTS*/

app.get("/accounts/check/:email",function(req,res){
  var data = {
        email: req.params.email
    };
    console.log(data.email)
connection.query('SELECT COUNT(*) as controle from accounts WHERE emailaddress = ?', data.email, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/accounts/email/:email",function(req,res){
  var data = {
        email: req.params.email
    };
    console.log(data.id)
connection.query('SELECT CONVERT(account_ID,CHAR(50)) AS accountID, name, lastname, emailaddress, password, passwordrecovered from accounts WHERE emailaddress = ?', data.email, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/accounts/info/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id)
connection.query('SELECT * from accounts WHERE account_ID = ?', data.id, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.post("/accounts",function(req,res){
  var date = new Date();
  var post = {
        name: req.body.name,
        lastname: req.body.lastname,
        emailaddress: req.body.emailaddress,
        password: req.body.password,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO accounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidaccounts",function(req,res){
  var date = new Date();
  var post = {
        name: req.body.name,
        lastname: req.body.lastname,
        emailaddress: req.body.emailaddress,
        password: req.body.password,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO accounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/accounts/PGnotificaton/:id",function(req,res){
  var put = {
        PGrequestNotification: req.body.PGrequestNotification
    };
    console.log(put);
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/increasePGbadge/:id",function(req,res){
  
connection.query('UPDATE accounts SET PGnotifyBadge = PGnotifyBadge + 1 WHERE account_ID = ?',req.params.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/decreasePGbadge/:id",function(req,res){
  
connection.query('UPDATE accounts SET PGnotifyBadge = PGnotifyBadge - 1 WHERE account_ID = ?',req.params.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/newpassword/:accountid",function(req,res){
  var put = {
        password: req.body.password,
        passwordrecovered: 'N'
    };
    console.log(put);
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.accountid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/accounts/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM accounts WHERE account_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.affectedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/androidaccounts/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM accounts WHERE account_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*USERS*/

app.get("/users",function(req,res){
connection.query('SELECT * from users', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('1 The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/accountid/userid/:accountid/:userid",function(req,res){
  var data = {
        accountid: req.params.accountid,
        userid: req.params.userid
    };
connection.query('SELECT * from users WHERE accountID = ? AND user_ID = ?', [data.accountid, data.userid], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('2 The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/account/:accountid",function(req,res){
  var data = {
        accountid: req.params.accountid
    };
    console.log(data.accountid)
connection.query('SELECT CONVERT(user_ID,CHAR(50)) AS userID, pokername, PGID from users WHERE accountID = ?', data.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('3 The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
    console.log(data.accountid)
connection.query('SELECT CONVERT(user_ID,CHAR(50)) AS userID, pokername, PGapproved from users WHERE PGID = ?', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/approved/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
    console.log(data.accountid)
connection.query('SELECT CONVERT(user_ID,CHAR(50)) AS userID, pokername from users WHERE (PGID = ?) AND (PGapproved = "Y")', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/count/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
    
connection.query('SELECT COUNT(*) as controle from users WHERE PGID = ?', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/users/list/:list",function(req,res){
  var data = {
        list: "(" + req.params.list + ")",
        orderlist: "(user_ID," + req.params.list + ")"
    };
  var connquery = "SELECT pokername from users WHERE user_ID in " + data.list + " ORDER by FIELD" + data.orderlist;
connection.query(connquery, data.list, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/users/newevents/:userid",function(req,res){
  var data = {
        userid: req.params.userid
    };
connection.query('SELECT newEvents from users WHERE user_ID = ?', data.userid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/users",function(req,res){
  var date = new Date();
  var post = {
        pokername: req.body.pokername,
        accountID: req.body.accountID,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO users SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidusers",function(req,res){
  var date = new Date();
  var post = {
        pokername: req.body.pokername,
        accountID: req.body.accountID,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO users SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/users/PGID/:id",function(req,res){
  var put = {
        PGID: req.body.PGID,
        PGapproved: req.body.PGapproved
    };
    console.log(put);
connection.query('UPDATE users SET ? WHERE user_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/users/approved/:id",function(req,res){
  var put = {
        PGapproved: req.body.PGapproved
    };
    console.log(put);
connection.query('UPDATE users SET ? WHERE user_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/users/newevents/:id",function(req,res){
  var put = {
        newEvents: req.body.newEvents
    };
    console.log(put);
connection.query('UPDATE users SET ? WHERE user_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/users/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM users WHERE user_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.affectedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*POKERGROUPS*/

app.get("/groups/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
    console.log(data.accountid)
connection.query('SELECT groupname from pokergroups WHERE PG_ID = ?', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/groups/:memberid",function(req,res){
     var memberid = "%" + req.params.memberid + ";%";
    console.log(memberid)
connection.query('SELECT CONVERT(PG_ID,CHAR(50)) AS PGID, groupname from pokergroups WHERE memberIDs LIKE ?', memberid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/groups/search/:searchstring",function(req,res){

  if (req.params.searchstring == "all123") {
    var searchstring = "%";
  } else {
     var searchstring = "%" + req.params.searchstring + "%";
   }
    console.log(searchstring)
connection.query('SELECT CONVERT(PG_ID,CHAR(50)) AS PGID, groupname, adminID from pokergroups WHERE groupname LIKE ?', searchstring, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/groups/adminid/:adminid",function(req,res){
  var data = {
        adminid: req.params.adminid
    };
    console.log(data.accountid)
connection.query('SELECT CONVERT(PG_ID,CHAR(50)) AS PGID, groupname from pokergroups WHERE adminID = ?', data.adminid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/groups/pgname/:pgname",function(req,res){
  var data = {
        pgname: req.params.pgname
    };
    console.log(data.pgname)
connection.query('SELECT COUNT(*) as controle from pokergroups WHERE groupname = ?', data.pgname, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/groups/notapproved/:adminid",function(req,res){
  var data = {
        adminid: req.params.adminid
    };
    console.log(data.adminid)
connection.query("SELECT DISTINCT(pokergroups.PG_ID), pokergroups.groupname FROM pokergroups INNER JOIN users ON pokergroups.PG_ID = users.PGID WHERE users.PGapproved = 'N' and pokergroups.adminID = ?", data.adminid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



app.post("/groups",function(req,res){
  var date = new Date();
  var post = {
        groupname: req.body.groupname,
        adminID: req.body.adminID,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO pokergroups SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidgroups",function(req,res){
  var date = new Date();
  var post = {
        groupname: req.body.groupname,
        adminID: req.body.adminID,
        creationdate: date
    };
    console.log(post);
connection.query('INSERT INTO pokergroups SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/groups/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM pokergroups WHERE PG_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.affectedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*POKEREVENTS*/

app.get("/events/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
connection.query('SELECT *, CONVERT(DATE_FORMAT(eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, CONVERT(DATE_FORMAT(eventdate,"%H:%i"), CHAR(50)) as eventtime from pokerevents WHERE PGID = ? ORDER BY eventdate DESC LIMIT 60', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/pgid/year/:pgid/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        pgid: req.params.pgid,
        year: searchstring
    };
connection.query('SELECT *, CONVERT(DATE_FORMAT(eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, CONVERT(DATE_FORMAT(eventdate,"%H:%i"), CHAR(50)) as eventtime from pokerevents WHERE (PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) ORDER BY eventdate DESC', [data.pgid, data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/eventdates/pgid/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
connection.query('SELECT CONVERT(DATE_FORMAT(eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2 from pokerevents WHERE (PGID = ?) AND (YEAR(pokerevents.eventdate) = YEAR(CURDATE())) ORDER BY eventdate ASC', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/eventdates/pgidyear/:pgid/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        pgid: req.params.pgid,
        year: searchstring
    };
connection.query('SELECT CONVERT(DATE_FORMAT(eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2 from pokerevents WHERE (PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) ORDER BY eventdate ASC', [data.pgid, data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/events/eventid/:id",function(req,res){
  var data = {
        id: req.params.id
    };
connection.query('SELECT *, CONVERT(DATE_FORMAT(eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, CONVERT(DATE_FORMAT(eventdate,"%H:%i"), CHAR(50)) as eventtime from pokerevents WHERE event_ID = ? ORDER BY eventdate DESC LIMIT 20', data.id, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/years/:pgid",function(req,res){
  var data = {
        pgid: req.params.pgid
    };
connection.query('SELECT DISTINCT(CONVERT(year(eventdate), CHAR(50))) as year from pokerevents where PGID = ? ORDER by year DESC', data.pgid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.post("/events",function(req,res){
  var post = {
        PGID: req.body.PGID,
        creatorID: req.body.creatorID,
        eventhost: req.body.eventhost,
        comments: req.body.comments,
        confirmedplayers: req.body.confirmedplayers
    };
  var connquery = "INSERT INTO pokerevents SET PGID = '" +  req.body.PGID + "', comments = '" + req.body.comments + "', creatorID = '" + req.body.creatorID + "', eventhost = '" + req.body.eventhost + "', confirmedplayers = '" + req.body.confirmedplayers + "', eventdate = STR_TO_DATE('" + req.body.eventdate + "','%d-%m-%Y  %H:%i')";
  console.log(connquery)
connection.query(connquery, post, function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidevents",function(req,res){
  var post = {
        PGID: req.body.PGID,
        creatorID: req.body.creatorID,
        eventhost: req.body.eventhost,
        comments: req.body.comments,
        confirmedplayers: req.body.confirmedplayers
    };
  var connquery = "INSERT INTO pokerevents SET PGID = '" +  req.body.PGID + "', comments = '" + req.body.comments + "', creatorID = '" + req.body.creatorID + "', eventhost = '" + req.body.eventhost + "', confirmedplayers = '" + req.body.confirmedplayers + "', eventdate = STR_TO_DATE('" + req.body.eventdate + "','%d-%m-%Y  %H:%i')";
  console.log(connquery)
connection.query(connquery, post, function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/:id",function(req,res){
  var put = {
        eventdate: req.body.eventdate,
        eventhost: req.body.eventhost,
        comments: req.body.comments,
    };
    console.log(put);
    console.log(req.params.id);
  var connquery = "UPDATE pokerevents SET eventhost = '" + req.body.eventhost + "', comments = '" + req.body.comments + "', eventdate = STR_TO_DATE('" + req.body.eventdate + "','%d-%m-%Y  %H:%i') WHERE event_ID = " + req.params.id;
  console.log(connquery)
connection.query(connquery,[put, req.params.id], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/players/:id",function(req,res){
  var put = {
        confirmedplayers: req.body.confirmedplayers,
    };
    console.log(put);
    console.log(req.params.id);
connection.query('UPDATE pokerevents SET ? WHERE event_ID = ?',[put, req.params.id], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/events/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM pokerevents WHERE event_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.affectedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*RESULTS*/

app.get("/results/user/:id/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        id: req.params.id,
        year: searchstring
    };
connection.query('SELECT results.eventID, results.profitloss, CONVERT(DATE_FORMAT(pokerevents.eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, results.comments FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) ORDER BY pokerevents.eventdate ASC', [data.id, data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/userpgid/:id/:pgid/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        id: req.params.id,
        pgid: req.params.pgid,
        year: searchstring
    };
connection.query('SELECT results.eventID, results.profitloss, CONVERT(DATE_FORMAT(pokerevents.eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, results.comments FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (pokerevents.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) ORDER BY pokerevents.eventdate ASC', [data.id, data.pgid, data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/pgid/:id",function(req,res){
  var data = {
        id: req.params.id
    };
connection.query('SELECT results.eventID, results.profitloss, users.pokername, CONVERT(DATE_FORMAT(pokerevents.eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, results.comments FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID  INNER JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) = YEAR(CURDATE())) ORDER BY results.eventID ASC', [data.id,data.id], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/pgideventid/:pgid/:eventid",function(req,res){
  var data = {
        pgid: req.params.pgid,
        eventid: req.params.eventid
    };
connection.query('SELECT results.profitloss, users.pokername FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID  INNER JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (pokerevents.event_ID = ?)', [data.pgid,data.pgid,data.eventid], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/pgidyear/:id/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        id: req.params.id,
        year: searchstring
    };
connection.query('SELECT results.eventID, results.profitloss, users.pokername, CONVERT(DATE_FORMAT(pokerevents.eventdate,"%d-%m-%Y"), CHAR(50)) as eventdate2, results.comments FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID  INNER JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) ORDER BY results.eventID ASC', [data.id,data.id,data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/balance/pgid/:id",function(req,res){
  var data = {
        id: req.params.id
    };
connection.query('SELECT SUM(results.profitloss) as balance, users.pokername FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID INNER JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) = YEAR(CURDATE())) GROUP BY users.pokername', [data.id,data.id], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/balance/pgidyear/:id/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        id: req.params.id,
        year: searchstring
    };
connection.query('SELECT SUM(results.profitloss) as balance, users.pokername FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID INNER JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) GROUP BY users.pokername', [data.id,data.id,data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/results/user/event/:userid/:eventid",function(req,res){
  var data = {
        userid: req.params.userid,
        eventid: req.params.eventid
    };
connection.query('SELECT result_ID, profitloss FROM results WHERE userID = ? AND eventID = ?', [data.userid, data.eventid], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/results/personalstats/:id/:pgid/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        id: req.params.id,
        pgid: req.params.pgid,
        year: searchstring
    };
connection.query('SELECT MAX(results.profitloss) AS MaxProfit FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (pokerevents.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?)', [data.id, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    var maxValue = rows[0].MaxProfit;
    console.log("Max Value is:", maxValue);
    connection.query('SELECT MIN(results.profitloss) AS MinProfit FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (pokerevents.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?)', [data.id, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    var minValue = rows[0].MinProfit;
    console.log("Min Value is:", minValue);
    connection.query('SELECT AVG(results.profitloss) AS AverageProfit FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (pokerevents.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?)', [data.id, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    var avgValue = rows[0].AverageProfit;
    console.log("Avg Value is:", avgValue);
    connection.query('SELECT COUNT(*) as NumberOfGames FROM pokerevents WHERE (PGID = ?) and (YEAR(eventdate) LIKE ?)', [data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    var numberOfGames = rows[0].NumberOfGames;
    console.log('Number of Games is: ', numberOfGames);
connection.query('SELECT COUNT(*) as NumberOfPlayedGames FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID WHERE (results.userID = ?) AND (pokerevents.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?)', [data.id, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    var numberOfPlayedGames = rows[0].NumberOfPlayedGames;
    console.log('Number of Played Games is: ', numberOfPlayedGames);
    var output = {
      MaxProfit: maxValue,
      MinProfit: minValue,
      AvgProfit: avgValue,
      NumGames: numberOfGames,
      NumPlayedGames: numberOfPlayedGames
    };
    res.end(JSON.stringify(output));
  }else{
    console.log('Error while performing Query.');
  }
  });
  }else{
    console.log('Error while performing Query.');
  }
  });
  }else{
    console.log('Error while performing Query.');
  }
  });
  }else{
    console.log('Error while performing Query.');
  }
  });
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/results/groupstats/:pgid/:year",function(req,res){
  if (req.params.year == "0") {
    var searchstring = "%";
  } else {
     var searchstring = req.params.year;
   }
  var data = {
        pgid: req.params.pgid,
        year: searchstring
    };
    connection.query('SELECT results.profitloss as MaxProfit, users.pokername FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID LEFT JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) AND results.profitloss = (SELECT MAX(results.profitloss) FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID LEFT JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?))', [data.pgid, data.pgid, data.year, data.pgid, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    if (rows.length) {
      var maxValue = rows[0].MaxProfit;
      var maxUser = rows[0].pokername;
      console.log("Max Value is: ", maxValue);
      console.log("pokername max value: ", maxUser);
    } else {
      var maxValue = 0;
      var maxUser = "Not Available";
    }
    connection.query('SELECT results.profitloss as MinProfit, users.pokername FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID LEFT JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?) AND results.profitloss = (SELECT MIN(results.profitloss) FROM results INNER JOIN pokerevents ON results.eventID = pokerevents.event_ID LEFT JOIN users ON results.userID = users.user_ID WHERE (pokerevents.PGID = ?) AND (users.PGID = ?) AND (YEAR(pokerevents.eventdate) LIKE ?))', [data.pgid, data.pgid, data.year, data.pgid, data.pgid, data.year], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    if (rows.length) {
      var minValue = rows[0].MinProfit;
      var minUser = rows[0].pokername;
      console.log("Min Value is: ", minValue);
      console.log("pokername min value: ", minUser);
    } else {
      var minValue = 0;
      var minUser = "Not Available"
    }
    var output = {
      MaxProfit: maxValue,
      MaxUser: maxUser,
      MinProfit: minValue,
      MinUser: minUser
    };
    res.end(JSON.stringify(output));
    console.log(JSON.stringify(output));
  }else{
    console.log('Error while performing Query.');
  }
  });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/results",function(req,res){
  var post = {
        userID: req.body.userID,
        eventID: req.body.eventID,
        profitloss: req.body.profitloss
    };
    console.log(post);
connection.query('INSERT INTO results SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.insertId));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/androidresults",function(req,res){
  var post = {
        userID: req.body.userID,
        eventID: req.body.eventID,
        profitloss: req.body.profitloss
    };
    console.log(post);
connection.query('INSERT INTO results SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/results/:id",function(req,res){
  var put = {
        profitloss: req.body.profitloss
    };
    console.log(put);
    console.log(req.params.id);
connection.query('UPDATE results SET ? WHERE result_ID = ?',[put, req.params.id], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/results/:id",function(req,res){
  var data = {
        id: req.params.id
    };
    console.log(data.id);
connection.query('DELETE FROM results WHERE result_ID = ?', data.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.affectedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*HTML*/
/* www.pokergroups.ddns.us */
/* changeip.com */
app.use(express.static(__dirname + '/html/pokergroups'));

app.get('/ajax', function(req, res) {
    
  connection.query('SELECT COUNT(*) as controle from pokergroups', function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    rows.forEach(function(row, i) {
    console.log('The variable is: ', row.controle);
    res.send(row.controle.toString());
  });
  }else{
    console.log('Error while performing Query.');
    return "Error";
  }
  });

});

app.get("/",function(req,res){
  //res.sendFile(path.join(__dirname+'/html/pokergroups/index.html'));
  res.render('index.html', {val: getData()});
  //__dirname : It will resolve to your project folder.
});


http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


https.createServer({
            key: fs.readFileSync("/etc/letsencrypt/live/appskberlaar.be/privkey.pem"),
            cert: fs.readFileSync("/etc/letsencrypt/live/appskberlaar.be/fullchain.pem"),
            ca: fs.readFileSync("/etc/letsencrypt/live/appskberlaar.be/chain.pem")
     }, app).listen(app.get('porthttps'), function(){
  console.log("Express SSL server listening on port " + app.get('porthttps'));
});

