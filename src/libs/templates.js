module.exports = function(Handlebars) {

this["templates"] = this["templates"] || {};

this["templates"]["loader"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"overlay loader\">\n    <canvas></canvas>\n    <span class=\"loader-perc\">0%</span>\n</div>\n";
},"useData":true});

this["templates"]["landing"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"section landing\">\n    <div class=\"starbound-logo\">\n        <h1>STARBOUND</h1>\n    </div>\n    <div class=\"x\">\n        <button data-event=\"about\" class=\"desk-nav-btn\">ABOUT</button>\n        <button data-event=\"gallery\" class=\"desk-nav-btn\">GALLERY</button>\n        <button class=\"desk-nav-btn x-icon\"></button>\n        <button data-event=\"comic\" class=\"desk-nav-btn\">COMIC</button>\n        <button data-event=\"contact\" class=\"desk-nav-btn\">CONTACT</button>\n    </div>\n    <p class=\"subheader\">the remix to earthbound by copperwire</p>\n    <p class=\"produced-by\">produced by appsynth media</p>\n</div>\n";
},"useData":true});

this["templates"]["nav"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<nav class=\"widget-nav\">\n    <nav class=\"hamburger inactive\"></nav>\n    <p class=\"select-remix\">select remix</p>\n    <div class=\"nav-btns\">\n        <button id=\"phone\" data-event=\"phone\">phone home</button>\n        <button id=\"wake\" data-event=\"wake\">wake up</button>\n        <button id=\"stories\" data-event=\"stories\">stories</button>\n    </div>\n</nav>\n";
},"useData":true});

this["templates"]["phone"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"section phone\">\n    <div class=\"content\">\n        <span class=\"title\">PHONE HOME</span>\n        <span class=\"description\">DESCRIPTION</span>\n        <div class=\"progress\">\n            <div class=\"progress-inner\"></div>\n        </div>\n        <div class=\"drum-vocals\">\n            <button data-event=\"drum\" class=\"drum\">DRUM</button>\n            <button data-event=\"vocals\" class=\"vocals\">VOCALS</button>\n        </div>\n        <div class=\"green-btns\">\n            <button data-event=\"green-btn-0\" class=\"green-btn\"></button>\n            <button data-event=\"green-btn-1\" class=\"green-btn\"></button>\n            <button data-event=\"green-btn-2\" class=\"green-btn\"></button>\n            <button data-event=\"green-btn-3\" class=\"green-btn\"></button>\n        </div>\n        <div class=\"keypad\">\n            <div class=\"keypad-row\">\n                <button data-event=\"keypad-1\" class=\"num-btn\">1</button>\n                <button data-event=\"keypad-2\" class=\"num-btn\">2</button>\n                <button data-event=\"keypad-3\" class=\"num-btn\">3</button>\n            </div>\n            <div class=\"keypad-row\">\n                <button data-event=\"keypad-4\" class=\"num-btn\">4</button>\n                <button data-event=\"keypad-5\" class=\"num-btn\">5</button>\n                <button data-event=\"keypad-6\" class=\"num-btn\">6</button>\n            </div>\n            <div class=\"keypad-row\">\n                <button data-event=\"keypad-7\" class=\"num-btn\">7</button>\n                <button data-event=\"keypad-8\" class=\"num-btn\">8</button>\n                <button data-event=\"keypad-9\" class=\"num-btn\">9</button>\n            </div>\n            <div class=\"keypad-row\">\n                <button data-event=\"keypad-back\" class=\"text-btn\">BACK</button>\n                <button data-event=\"keypad-0\" class=\"num-btn\">0</button>\n                <button data-event=\"keypad-clear\" class=\"text-btn\">CLEAR</button>\n            </div>\n        </div>\n        <button data-event=\"start\" class=\"large-btn\">START</button>\n    </div>\n</div>\n";
},"useData":true});

this["templates"]["stories"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"section stories\">\n    <div class=\"content\">\n        <span class=\"title\">STORIES</span>\n        <span class=\"description\">YOUR STORY = REMIX</span>\n        <div class=\"progress\">\n            <div class=\"progress-inner\"></div>\n        </div>\n        <div class=\"story-box\">\n            _Tell a story in a 140 characters or less then  press START to listen to your remix or press  TWEET to send to friends #starbound.\n        </div>\n        <div class=\"start large-btn\">START</div>\n        <div class=\"large-btn\">TWEET</div>\n    </div>\n</div>\n";
},"useData":true});

this["templates"]["wake"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"section wake\">\n    <div class=\"content\">\n        <span class=\"title\">WAKE UP</span>\n        <span class=\"description\">time = remix</span>\n        <div class=\"progress\">\n            <div class=\"progress-inner\"></div>\n        </div>\n        <div class=\"drum-vocals\">\n            <button class=\"drum\">DRUM</button>\n            <button class=\"vocals\">VOCALS</button>\n        </div>\n        <div class=\"clock-container\">\n            <canvas class=\"clock\"></canvas>\n        </div>\n        <button data-event=\"stop\" class=\"large-btn\">STOP</button>\n    </div>\n</div>\n";
},"useData":true});

return this["templates"];

};