var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var util = require('util')
var sqlite3 = require('sqlite3').verbose();
var emailify = require('emailify');
var fs = require('fs');
var program = require('commander');
var sleep = require('sleep');
var path = require('path')
var premailer = require('premailer-api') // this should inline our css automatically
var htmlToText = require('nodemailer-html-to-text').htmlToText;
var async = require('async');
var marked = require('marked');
yaml = require('js-yaml');

var db = new sqlite3.Database('uit.db');


function attach(val) {
  return val.split(',');
}

try {
    var ymlconfig = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
    //console.log(ymlconfig);
} catch (e) {
    console.log(e);
}

program
	.version('0.0.2')
	.option('-s, --subject ["subject line"]', 'j0')
    .option('-f, --file <path>')
    .option('-m, --from <sender>')
	.option('-a, --attach <items>', 'Attachments', attach)
    .option('-t, --to <recips>', 'Recipients')
    .option('-h, --hook <hook>', 'External application to generate dynamic content')
    .parse(process.argv);

marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false
});

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
                for (var i = 5; i >= 0; i--) {
                    sleep.sleep(1)
                    console.log('In %s seconds — press ctrl-c to cancel!', i);
                };   
            }
            
            
        });
    });
}

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport(smtpTransport({
    host: ymlconfig['host'],
    port: ymlconfig['port']
}));

function sendPersonalEmail(runNo, name, lastname, emailAddr, data) {


    var str = "The quick brown fox jumped over the box like an ox with a sox in its mouth";

    str.match(/\w(ox)/g); // ["fox", "box", "sox"]

    // match (when used with a 'g' flag) returns an Array with all matches found
    // if you don't use the 'g' flag then it acts the same as the 'exec' method.

    str.match(/\w(ox)/); // ["fox", "ox"]
    /\w(ox)/.exec(str);  // ["fox", "ox"]

    // the exec method returns an Array where the first index is the match and all other indexes are capturing groups
    // note: adding a 'g' flag has no effect on the returned Array

    /\w(ox)/g.exec(str);  // ["fox", "ox"]

    // although you can use a while loop with the exec method to find successive matches


    var myString = "something format_abc something format_abc something format_abc";
    var replstr = '!-@-(.*)-@-!'
    var reg = new RegExp(replstr, "gi");
    // var myRegexp = /(?:^|\s)format_(.*?)(?:\s|$)/g;
    match = reg.exec(data);
    while (match != null) {
      // matched text: match[0]
      // match start: match.index
      // capturing group n: match[n]
      var regstr = match[0]
      var mdfile = match[1]
      // console.log(regstr)
      // console.log(mdfile)
      // console.log(match.index)
      // console.log(reg.lastIndex)

      var mddata = fs.readFileSync(mdfile, 'utf8')
      var mdrendered = marked(mddata)
      // console.log(mdrendered)
      data = data.replace(regstr, mdrendered)


      match = reg.exec(data);
    }

    // inline the css and send
    emailify.parse({ data }, function(err, email) {
    // premailer.prepare({ html: data }, function(err, email) {
        // console.log('email: ' + email)
        var mailOptions = {
            from: 'Firstname Lastname <addr@domain.edu>', // sender address
            //to: util.format("%s %s <%s>", name, lastname, emailAddr), // list of receivers
            //to: emailAddr,
            subject: program.subject, // Subject line
            //text: 'Where you put the plaintext body', // plaintext body
            //html: '<b>Hello world ✔</b>' // html body
            // html: email.html,
            html: data
            //html: '<p><b> hellow, world </b> Here is a graphic: <img src="cid:grasschat"/></p>',
            //attachments: attachmentObject
        };
//"/Users/coopermj/Dropbox/mailer/LoveableSpammer/hookout/Micah_Cooper.png"
        var attachmentObject = [];

        if (typeof program.attach != 'undefined') {
            var attachmentList = program.attach;

            var i = 0
            
            attachmentList.forEach(function(value) {
                // having the cid without the extension looks cleaner, I think, so
                // let's not assume a 3 character extension
                // extension = path.extname(value); // find the extension name
                // var cidname = value.substring(0, value.indexOf(extension)); // find the location in the string and chop there
                // Changed my mind – let's leave the extension on the cid name
                cidname = value
                attachmentObject.push({filename: value, path: __dirname + '/' + value, cid: cidname})
            });
        }

        console.log('ao: %j', attachmentObject)



        if (typeof program.hook != 'undefined') {
            //var tmpfile = mailOptions['to'] + '.png'
            var execSync = require('child_process').execSync;
            var hookcmd = program.hook + ' ' + name + ' ' + lastname;
            var imgname = execSync(hookcmd, { encoding: 'utf8' });
            imgname = imgname.replace(/\n$/, '')
            console.log('img name: ' + imgname)
            attachmentObject.push({filename: imgname, path: __dirname + '/' + imgname, cid: 'hook'})
        }

        console.log(attachmentObject);

        if ( (typeof program.attach != 'undefined') || (typeof program.hook != 'undefined') ) {
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

    })

// Messy way of handling removing our hook attachment. :/
    // if (typeof program.hook != 'undefined') {
    //     attachmentObject.pop();
    //     console.log('pop pop pop')
    //     console.log(attachmentObject)
    // } 
    
}

if (typeof program.to == 'undefined') {
    db.serialize(function () {
    	var createsql = 'CREATE TABLE IF NOT EXISTS runlog (gotime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, run INTEGER, recipient VARCHAR(255), status INTEGER, theresult TEXT)';
    	db.run(createsql, function (err, row) {
    		if (err) {
    			console.log('Failed to create runlog table');
    		}
    		else {
    			// console.log('done?')
    		}
    	});

    	var runNo = 0;
    	var getMax = "SELECT MAX(run) AS runmax FROM runlog"
    	db.each(getMax, function (err, row) {
    		runmax = row.runmax;

    		runNo = runmax + 1;
    		// console.log('hi')
    	});

    	fs.readFile(contentFilename, 'utf8', function (err, data) { // read the html file in once
            if(err) {
                console.log('unable to read file: ', mdfile)
                process.exit(1)
            }
    		
    		db.each ('SELECT * FROM maintargets WHERE status = "go"', function(err, row) {
                // console.log(typeof row);
                // console.log(row);
                var thisdata = data; // separate the data

                async.forEachOf(Object.keys(row), function (item, key, callback){
                    console.log(item);
                    console.log(row[item]);

                    // Build our replacement string
                    replstr = '{{' + item + '}}';
                    // And our RegExp object
                    var reg = new RegExp(replstr, "gi");

                    // Replace all instances with the updated data
                    thisdata = thisdata.replace(reg, row[item]);

                    callback();

                }, function(err) {
                    console.log('iterating done');
                    console.log(thisdata);
                });

                // console.log('and specifically:');
                // row.forEach(function(value){
    		     //    console.log(value);
                // })

                var thisdata = data; // separate the data

    			sendPersonalEmail(runNo, row.name, row.lastname, row.emailAddr, thisdata);
    		});
    	});
    });
} else {
    fs.readFile(contentFilename, 'utf8', function (err, data) {
        sendPersonalEmail(0, program.to, program.to, program.to, data);
    });
}