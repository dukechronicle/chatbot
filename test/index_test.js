expect = require("chai").expect;
var request = require("request");

describe("webhook server", function() {
  describe("homepage", function() {
    var url = "http://localhost:8000/";

    it("responds with hello world message", function() {
      request(url, function(error, response, body) {
        expect(response).to.equal("Hello World, this is chatbot");
        done();
      });
    });
  });
});
