# LoveableSpammer

LoveableSpammer should only be used for good — never ill!

Do you wish you could take html and easily send it out to a group of people?
LoveableSpammer is for you.

## Requirements
* [nodejs](http://nodejs.org) — install it first
* [SQLite](https://www.sqlite.org) — you already have it if you're on a Mac!

## Setup
1. First, create compelling content — this is always the hardest part. Design
your email in your favorite html utility, OR start with [MailChimp's excellent blueprints](https://github.com/mailchimp/email-blueprints),
which you can do with a
`git clone https://github.com/mailchimp/email-blueprints`
2. Create a sqlite database file named uit.db with the following schema:
  CREATE TABLE maintargets
  (name VARCHAR(255),
  lastname varchar(255),
  emailAddr VARCHAR(255),
  dept VARCHAR(255),
  bldg VARCHAR(255),
  status VARCHAR(25) default 'no');
3. Create a csv with corresponding columns (you can leave some blank) and follow
[these steps](http://www.sqlite.org/cli.html) to import it into your db.
4. Before you use LS for the first time, you'll need to run `npm install` to
download and install your files.

## Usage
`node app.js -s [Email Subject] -f [HTML Content] -a <attachments>`
eg: `node app.js -s "Please read my email" -f awesome.html -a joy.jpg,monkey.jpg`

**Important notes**
* A subject line is required
* The html file is required
* Multiple attachments must be separated by a comma (not spaces and not comma space)
* Attachments are automatically given cid tags without their extension, so
you can add as many as you'd like and have corresponding cids for the ones you want to use.
