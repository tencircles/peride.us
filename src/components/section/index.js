var $ = require("jquery"),
    _ = require("../../libs/util"),
    userEvents = require("../userEvents");

module.exports = constructor;
function constructor (proto) {
    console.log("create new section", proto.name);
    var c, p;
    c = makeFn();
    proto.constructor = c;
    p = Object.create(section, valmap(proto));
    c.prototype = p;
    return c;
}

var section = Object.create({});
section.animateIn = section.animateOut = def;
function def (req, done) {
    done();
}

section.init = init;
function init (req, done) {
    console.log("init", this.name);
    _.bindAll(this);
    this.listen();
    done();
    function listen (fn, name) {
        userEvents.on(name, fn.bind(this));
    }
}

section.destroy = destroy;
function destroy (req, done) {
    console.log("destroy", this.name);
    this.unlisten && this.unlisten();
    this.$el.remove();
    done();
}

section.compile = compile;
function compile (context) {
    console.log("compile", this.name);
    this.$el = $(_.compile(this.name, context));
}

section.appendToDom = appendToDom;
function appendToDom (selector) {
    console.log("appendToDom", this.name);
    $(selector || "body").append(this.$el);
}
section.listen = listen;
function listen () {
    _.each(attach, this.events, this);
    this.unlisten = _.each.curry(unattach, this.events, this);
    function attach (fn, name) {
        this.events[name] = fn.bind(this);
        userEvents.on(name, this.events[name]);
    }
    function unattach (fn, name) {
        userEvents.off(name, this.events[name]);
    }
}
// util
function valmap (obj) {
    return _.map(map, obj);
    function map (value) {
        return {value: value};
    }
}
function makeFn () {
    return function Section () {};
}
