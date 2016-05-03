var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var util = require('util')
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var program = require('commander');
var sleep = require('sleep');
var path = require('path')
var premailer = require('premailer-api') // this should inline our css automatically
var htmlToText = require('nodemailer-html-to-text').htmlToText;

var db = new sqlite3.Database('uit.db');


function attach(val) {
  return val.split(',');
}

program
	.version('0.0.1')
	.option('-s, --subject ["subject line"]', 'j0')
    .option('-f, --file <path>')
    .option('-m, --from <sender>')
	.option('-a, --attach <items>', 'Attachments', attach)
    .option('-t, --to <recips>', 'Recipients')
    .parse(process.argv);

if (typeof program.subject == 'undefined') {
    console.log('No subject — exiting');
    process.exit(1);
}

var contentFilename = '';

if (typeof program.file == 'undefined') {
    console.log('No email content — exiting');
    process.exit(1);
}
else {
    contentFilename = program.file;
    console.log('  - Sending %s', contentFilename)
}

console.log('About to send an email!')
console.log('  - Using this file as the source: %s', program.file);
console.log('  - With subject: %s', program.subject);
console.log('  - With these attachments: %j', program.attach);
//console.log(' list: %j', program.attach);

if (typeof program.to != 'undefined') {
    console.log('  - With this recipient: %s', program.to);
}

if (typeof program.to == 'undefined') {
    db.serialize(function () { // Give ourselves some feedback
        var recipCount = 0;
        var getCount = "SELECT COUNT(*) AS runcount FROM maintargets WHERE status = 'go'"
        db.each(getCount, function (err, row) {
            recipCount = row.runcount;
            if (recipCount < 1) {
                console.log('**** Exiting: No recipients! ****');
                process.exit(0);
            }
            else if (recipCount == 1) {
                console.log("To %s recipient", recipCount)
            }
            else {
                console.log('To %s recipients', recipCount);    
            }
            
            for (var i = 5; i >= 0; i--) {
                sleep.sleep(1)
                console.log('In %s seconds — press ctrl-c to cancel!', i);
            };
        });
    });
}

if (typeof program.attach != 'undefined') {
    var attachmentList = program.attach;

    var i = 0
    var attachmentObject = [];
    attachmentList.forEach(function(value) {
        // having the cid without the extension looks cleaner, I think, so
        // let's not assume a 3 character extension
        extension = path.extname(value); // find the extension name
        var cidname = value.substring(0, value.indexOf(extension)); // find the location in the string and chop there
        attachmentObject.push({filename: value, path: __dirname + '/' + value, cid: cidname})
    });
}


console.log('ao: %j', attachmentObject)

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport(smtpTransport({
    host: 'mailfwd.miamioh.edu',
    port: 25
}));

function sendPersonalEmail(runNo, name, lastname, emailAddr, data) {
    // inline the css and send
    premailer.prepare({ html: data }, function(err, email) {
        var mailOptions = {
            from: 'Firstname Lastname <addr@domain.edu>', // sender address
            //to: util.format("%s %s <%s>", name, lastname, emailAddr), // list of receivers
            //to: emailAddr,
            subject: program.subject, // Subject line
            //text: 'Where you put the plaintext body', // plaintext body
            //html: '<b>Hello world ✔</b>' // html body
            html: email.html,
            //html: '<p><b> hellow, world </b> Here is a graphic: <img src="cid:grasschat"/></p>',
            //attachments: attachmentObject
        };



        if (typeof program.attach != 'undefined') {
            //mailOptions.attachments = attachmentObject;
            mailOptions['attachments'] = attachmentObject
        }

        if (typeof program.to == 'undefined') {
            mailOptions['to'] = util.format("%s %s <%s>", name, lastname, emailAddr) // list of receivers
        } else {
            mailOptions['to'] = program.to;
        }

        if (typeof program.from == 'undefined') {
            process.exit(1);
            //mailOptions.to = util.format("%s %s <%s>", name, lastname, emailAddr), // list of receivers
        } else {
            mailOptions['from'] = program.from;
        }

        // set up to use htmlToText to make the plaintext version automatically
        transporter.use('compile', htmlToText());
        // send mail with defined transport object
        transporter.sendMail(mailOptions, function(error, info){            
            var date = new Date();
            if (typeof program.to == 'undefined') {
                if(error){
                    console.log(error);
                    var stmt = db.prepare("INSERT INTO runlog VALUES(?,?,?,?,?)")   
                    stmt.run(date, runNo, mailOptions['to'], error.responseCode, error.response);
                }else{
                    var stmt = db.prepare("INSERT INTO runlog VALUES(?,?,?,?,?)")   
                    stmt.run(date, runNo, mailOptions['to'], 200, info.response);
                    
                    if (mailOptions['to'].toUpperCase() === mailOptions['from'].toUpperCase()) { // make it so I don't have to keep re-enabling myself
                        console.log("Sending email to yourself, j0!")
                    }
                    else { 
                        console.log("to: %s; from: %s", mailOptions['to'].toUpperCase(), mailOptions['from'].toUpperCase());
                        var stmtUpdate = db.prepare("UPDATE maintargets SET status='no' WHERE name=? AND lastname=?")
                        stmtUpdate.run(name,lastname)   
                    }

                    console.log('Message to ' + info.envelope.to + ' sent: ' + info.response);              
                }
            }
        });


    });


    
}

if (typeof program.to == 'undefined') {
    db.serialize(function () {
    	var createsql = 'CREATE TABLE IF NOT EXISTS runlog (gotime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, run INTEGER, recipient VARCHAR(255), status INTEGER, theresult TEXT)';
    	db.run(createsql, function (err, row) {
    		if (err) {
    			console.log('Failed to create runlog table');
    		}
    		else {
    			console.log('done?')
    		}
    	});

    	var runNo = 0;
    	var getMax = "SELECT MAX(run) AS runmax FROM runlog"
    	db.each(getMax, function (err, row) {
    		runmax = row.runmax;

    		runNo = runmax + 1;
    		console.log('hi')
    	});

    	fs.readFile(contentFilename, 'utf8', function (err, data) { // read the html file in once
    		
    		db.each ('SELECT name, lastname, emailAddr, dept, bldg FROM maintargets WHERE status = "go"', function(err, row) {
                var thisdata = data; // separate the data
                thisdata = thisdata.replace(/{{name}}/gi, row.name);
                thisdata = thisdata.replace(/{{lastname}}/gi, row.lastname);
                thisdata = thisdata.replace(/{{dept}}/gi, row.dept);
                thisdata = thisdata.replace(/{{bldg}}/gi, row.bldg);

    			sendPersonalEmail(runNo, row.name, row.lastname, row.emailAddr, thisdata);
    		});
    	});
    });
} else {
    fs.readFile(contentFilename, 'utf8', function (err, data) {
        sendPersonalEmail(0, program.to, program.to, program.to, data);
    });
}