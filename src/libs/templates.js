module.exports = function(Handlebars) {

this["templates"] = this["templates"] || {};

this["templates"]["landing"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "<div class=\"section\">\n    <h1>perideus</h1>\n    <div class=\"content\">\n        <div class=\"item\">one</div>\n        <div class=\"item\">two</div>\n        <div class=\"item\">three</div>\n        <div class=\"item\">four</div>\n        <div class=\"item\">five</div>\n        <div class=\"item\">six</div>\n    </div>\n</div>\n";
},"useData":true});

return this["templates"];

};