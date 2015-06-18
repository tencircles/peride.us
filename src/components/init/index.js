var preloads = require("../../settings").preload.img;
var load = require("../../libs/load");
var _ = require("../../libs/util");
var Q = require("q");
var userEvents = require("../userEvents");

module.exports = Init;
function Init (done) {
    console.log("preloads starting");
    userEvents.setup();
    this.done = done;
}

Init.prototype.animateIn = animateIn;
function animateIn (req, done) {
    var promises = _.map(load.img, preloads);
    var complete = this.done;
    Q.all(promises).then(yes).catch(no);

    function yes (results) {
        console.log("preloads finished");
        done();
        complete();
    }
    function no (err) {
        console.error("preloading error", err);
    }
}
