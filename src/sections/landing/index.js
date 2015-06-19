"use-strict";
var section = require("../../components/section"),
    framework = require("../../framework"),
    $ = require("jquery"),
    _ = require("../../libs/util");


window.$ = $;
module.exports = section({
    name: "landing",
    animateIn: function animateIn (req, done) {
        this.compile();
        this.appendToDom();
        setTimeout(function () {
            fall(".item", done);
        }, 1000)
        fall(".content");
        done();
    }
});
function rise (selector, callback) {
    $(selector).addClass("shadow-inset");
    setTimeout(function () {
        $(selector).removeClass("shadow-inset");
    }, 1000);
    setTimeout(function () {
        $(selector).addClass("shadow-outline-0");
        $(selector).offset().top;
        $(selector).removeClass("shadow-outline-0");
        $(selector).addClass("shadow-outline");
        callback && callback();
    }, 2000);
}
function fall (selector, callback) {
    $(selector).addClass("shadow-outline");
    setTimeout(function () {
        $(selector).removeClass("shadow-outline");
    }, 1000);
    setTimeout(function () {
        $(selector).addClass("shadow-inset-0");
        $(selector).offset().top;
        $(selector).removeClass("shadow-inset-0");
        $(selector).addClass("shadow-inset");
        callback && callback();
    }, 2000);
}

