var $ = require("jquery");
var env = require("../../libs/env");
var events = require("../../libs/events");

var evt = module.exports = events({});

evt.setup = setup;
function setup () {
    $(window).on(env.touch ? "touchstart" : "mousedown", onclick);
}

function onclick (e) {
    var event = $(e.target).data("event");
    if (event) {
        event = "click:" + event;
        console.log(event);
        evt.dispatch(event, e);
    }
}
