expect = require("chai").expect;
var request = require("request");

describe("webhook server", function() {
  describe("homepage", function() {
    var url = "http://localhost:8000/";

    it("responds with hello world message", function(done) {
      request(url, function(error, response, body) {
        console.log("Response body: " + response.body);
        expect(response.body).to.equal("Hello World, this is chatbot");
        done();
      });
    });
  });

  describe("GET verification", function () {
    var url = "http://localhost:8000/webhook";

    it("sends back the hub.challenge parameter", function(done) {
      var propertiesObject = { 'hub.verify_token': 'test',
                               'hub.challenge': '12345' };

      request({url:url, qs:propertiesObject}, 
              function(error, response, body) {
                console.log("Response body: " + response.body);
                expect(response.body).to.equal("12345");
                done();
              });
    });
  });
});
