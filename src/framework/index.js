"use strict";
var bigwheel = require("bigwheel");

console.log("framework init");
module.exports = bigwheel(bigwheelInit);
function bigwheelInit (done) {
    done({
        initSection: require("../components/init"),
        routes: require("./routes")
    });
}

