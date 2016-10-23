'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();

// Wit.ai imports
const Wit = require('node-wit').Wit;
const log = require('node-wit').log;

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN;

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

// WIT.AI specific code
// ------------------------------------------------

/** 
 * These are the actions for the Wit.ai bot to use
 * They are mapped to certain inputs using wits NLP awesomeness
 */
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Giving the wheel back to our bot
    // We return a promise to let our bot know when we're done sending
    return Promise.resolve();
  },
  // This is the action that is called when a request
  // for stories is recognized by wit.ai...we can modify
  // the context object here
  getTopStories({context, entities}) {
    return Promise.resolve(context);
  }
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

//main chron url
var homeUrl = "http://www.dukechronicle.com/";

/** 
 * Recieve and handle webhook post request
 * We then make a call to the Wit.ai api to interpret the 
 * message and send back structured data about its intent
 */

app.post('/webhook/', function(req, res) {

  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  
  const messaging_events = req.body.entry[0].messaging

  // Iterate over each messaging event, send the message to wit.ai and 
  // deal with the resonse accordingly
  for (let i = 0; i < messaging_events.length; i++) {
    const event = req.body.entry[0].messaging[i];
    const sender = event.sender.id;
    if (event.message && event.message.text) {
      // We retrieve the user's current session, or create one if it doesn't exist
      // This is needed for our bot to figure out the conversation history
      // We retrieve the message content
      const {text, attachments} = event.message;

      if (attachments) {
        // We received an attachment
        // Let's reply with an automatic message
        fbMessage(sender, {
          text: "Sorry I can't currently process attachments - please send me a message" 
        });
      } else if (text) {
        // We received a text message
        // Let's forward the message to the Wit.ai Bot Engine
        // This will run all actions until our bot has nothing left to do
        wit.message(
          text, // the user's message
          {}
        ).then(context => {
          // Our bot did everything it has to do.
          // Now it's waiting for further messages to proceed.
          console.log('Waiting for next user messages');
          getTopStories(context, webhook_callback, sender, res);
        })
        .catch((err) => {
          console.error('Oops! Got an error from Wit: ', err.stack || err);
        })
      } else {
        console.log('received event', JSON.stringify(event));
      }
    }
  }
  // send an ok status
  res.sendStatus(200);
});

/**
 * Function called when the chronicle JSON response has been 
 * recieved
 * @param {Object} chron_json - The articles in JSON
 * @param {String} sender - The id of the sender - who will be the 
 *  recipient of the response
 * @param {Object} res - The res object from the /webhook/ post
 */
function webhook_callback (chron_json, sender, res) {
  if (chron_json) {
    console.log("chron_json");
  } else {
    console.log("chron_json is null");
  }
  sendNewsCards(sender, chron_json[0]['articles']);
}

// Helper functions
// ----------------------------------------------

//facebook app token
const token = process.env.token;

/**
 * News card to be sent to the user showing the top news
 * for a certain section.
 */
class Card {
  constructor(title, subtitle, image_url, article_url) {
    this.title = title;
    this.subtitle = subtitle;
    this.image_url = image_url;
    this.buttons = [{type: "web_url", url: article_url, title: "View article" }];
  }
}

/** 
 * Function to send a generic message to a facebook user
 * @param { String } recipientId - The id of the recipient
 * @param { Object } message - The structured message to send
 */
function fbMessage(recipientId, message) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: token },
    method: 'POST',
    json: { 
      recipient: { id: recipientId },
      message, 
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  })
}

/**
 * Template for messenger json response used in the
 * sendNewsCards fuction
 * @param {Array} elements - The card elements to be sent
 * @return {Object} - The template for a fb card message
 */
function buildJsonReponse(elements) {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements,
      }
    }
  }
}

/** 
 * Send news cards with the top chronicle stories in a 
 * certain topic back to the user
 * @param {String} sender - The id of the messenger recipient
 * @param {Object} items - The news items
 */
function sendNewsCards(sender, items) { 
  let elems = [];

  let i = 0;
  for (var key in items) {
    if (i > 5) { break }

    const elem = items[key];
    const title = finishDecode(decodeURIComponent(elem['headline']));
    const subtitle = finishDecode(decodeURIComponent(elem['subhead']));
    const url = finishDecode(decodeURIComponent(elem['getURL']));
    // Make the image URL either the image in the article of a default
    const image_url = '0' in elem['media'] ?
      finishDecode(decodeURIComponent(elem['media']['0']['urlPreview'])) :
      "http://ds4q8c259towh.cloudfront.net/20160415XJlq9-dXcb/dist/img/dtc-ph.png";
    elems.push(new Card(title, subtitle, image_url, url));
    i++;
  }
  // Send the message
  fbMessage(sender, buildJsonReponse(elems))
}


/** 
 * Function that returns the top stories of a given category back to 
 * a user.
 *
 * @param {Object} context - The wit.ai context object for the message
 *  reponse - contains WIT's interpretation of the message, including 
 *  which category it thinks the user wants to access
 * @param {Function} callback - callback function on completion
 * @param {String} sender - The id of the sender - who will be the 
 *  recipient of the response
 * @param {Object} webhook_response - The res object from the /webhook/
 *  post
 * @return {Object} - JSON of the first page of stories in the given
 *  category
 */
function getTopStories(context, callback, sender, webhook_response) {
  /** If we dont actually have a message */
  if (!context['entities']) { return }
  // show the user that you are getting the stories
  const { value, confidence } = context.entities.intent[0];
  const url = homeUrl + 'section/' + value + ".json"; 
  let chron_json = "";
  fbMessage(sender, {
    text: `Finding the top ${value} stories`
  });
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

/**
 * Safely decode the chron article text information recieved
 * from the API
 * @param {String} safe - Encoded URI
 */
function finishDecode(safe) {
  return safe.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#039;/g, "'");
}
