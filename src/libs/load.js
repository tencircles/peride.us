var Q = require("q");
var settings = require("../settings");
var dmaf = require("./dmaf");
var _ = require("./util");

module.exports.img = loadImg;
function loadImg (path) {
    return _.getImg(settings.path.img + path);
}
