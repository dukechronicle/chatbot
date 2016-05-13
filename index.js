var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
var token_json = require("./access_token.json");

app.set('port', (process.env.PORT || 8000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
     res.send('Hello World, this is chatbot');
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'test') {
		res.send(req.query['hub.challenge']);
	}
	res.send('Error, wrong token');
});

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'));
});

//template for messenger json response
var json_response = {
  "attachment": {
    "type": "template",
    "payload": {
      "template_type": "generic",
      "elements": []
    }
  }
}

//main chron url
var homeUrl = "http://www.dukechronicle.com/";

//recieve and handle webhook post request
app.post('/webhook/', function(req, res) {
	messaging_events = req.body.entry[0].messaging;
	for (i=0; i<messaging_events.length; i++) {
		event = req.body.entry[0].messaging[i];
		sender = event.sender.id;
		if (event.message && event.message.text) {
      var searchStr = event.message.text.toLowerCase();
      if (searchStr.includes("news")) {
        getTopStories(homeUrl + "section/news", webhook_callback, sender, res);
      } else if (searchStr.includes("sports")) {
        getTopStories(homeUrl + "section/sports", webhook_callback, sender, res);
      } else if (searchStr.includes("opinion")) {
        getTopStories(homeUrl + "section/opinion", webhook_callback, sender, res);
      } else {
        getTopStories(homeUrl, webhook_callback, sender, res);
      }    
    }
	}
});

//webhook callback
function webhook_callback (chron_json, sender, res) {
	if (chron_json) {
    console.log("chron_json");
  } else {
    console.log("chron_json is null");
  }

	sendTextMessage(sender, chron_json[0]['articles']);
  res.sendStatus(200); 
}


//helper functions

//facebook app token
var token = token_json["token"];

function Card (title, subtitle, image_url, article_url) {
  this.title = title;
  this.subtitle = subtitle;
  this.image_url = image_url;
  this.buttons = [{type: "web_url", url: article_url, title: "View article" }];
}

//send message back
function sendTextMessage(sender, items) { 
  //console.log(items[0]);
  elems = [];

  var i = 0;
  for (var key in items) {
    if (i > 5) { break; }

    elem = items[key];
    title = finishDecode(decodeURIComponent(elem['headline']));
    subtitle = finishDecode(decodeURIComponent(elem['subhead']));
    url = finishDecode(decodeURIComponent(elem['getURL']));

    if ('0' in elem['media']) {
    image_url = finishDecode(decodeURIComponent(elem['media']['0']['urlPreview']));
    } else {image_url = "http://ds4q8c259towh.cloudfront.net/20160415XJlq9-dXcb/dist/img/dtc-ph.png"}

    card = new Card(title, subtitle, image_url, url);
    elems.push(card);

    i++;
  }
  json_response.attachment.payload.elements = elems;
  console.log(json_response);

	messageData = json_response;
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error);
		} else if (response.body.error) {
			console.log('Error: ', response.body.error);
		}
	})
}


//return json of page one
function getTopStories(stories_url, callback, sender, webhook_response) {
  url = stories_url + ".json"; 
  var chron_json = "";
  request(url, function (error, response, body) {
            if (error) {
              console.log(error);
            } else if (response.body.error) {
              console.log(response.body.error);
            } else {  
              chron_json = JSON.parse(body);
            }

            callback(chron_json, sender, webhook_response);
  });
   
}

function finishDecode(safe) {
  return safe.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#039;/g, "'");
}
