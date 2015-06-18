var hbs = require("handlebars");
var templates = require("./templates")(hbs);
var domify = require("domify");
module.exports = require("./dmaf").core.require("_");

module.exports.compile = function (name, ctx) {
    return domify(templates[name](ctx));
};
