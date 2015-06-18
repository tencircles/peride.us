"use-strict";
var domready  = require("detect-dom-ready"),
    framework = require("./src/framework" );

domready(onready);

function onready () {
    framework.init();
}
