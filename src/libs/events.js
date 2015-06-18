module.exports = function events (context) {
    var push = Array.prototype.push,
        dictionary = {names: {}},
        currentEvent = "",
        separator = /:/,
        doStop = false;

    function dispatch (eventName) {
        var listeners,
            oldEvent,
            oldStop,
            ii,
            i;

        if (eventName && typeof eventName === "string") {
            oldStop = doStop;
            doStop = false;
            oldEvent = currentEvent;
            currentEvent = eventName;
            listeners = getListeners(eventName);
            for (i = 0, ii = listeners.length; !doStop && i < ii; i++) {
                listeners[i].apply(this, arguments);
            }
            doStop = oldStop;
            currentEvent = oldEvent;
        }
        return context;
    }
    function getListeners (name) {
        var names = name.split(separator),
            events = dictionary,
            listeners = [],
            item,
            ii,
            i;
        for (i = 0, ii = names.length; i < ii; i++) {
            item = events.names && events.names[names[i]];
            if (item) {
                if (item.listeners) {
                    push.apply(listeners, item.listeners);
                }
                events = events.names[names[i]];
            } else {
                break;
            }
        }
        return listeners;
    }
    function stop () {
        doStop = true;
    }
    function addEach (names) {
    }
    function addEventListener (eventName, listener) {
        var events = dictionary,
            names,
            ii,
            i;
        if (Array.isArray(eventName)) {
            for (i = 0, ii = eventName.length; i < ii; i++) {
                addEventListener(eventName[i], listener);
            }
            return;
        }
        names = eventName.split(separator);
        for (i = 0, ii = names.length; i < ii; i++) {
            events = events.names;
            if (!events.hasOwnProperty(names[i]) || typeof events[names[i]] === "undefined") {
                events[names[i]] = {
                    names: {}
                };
            }
            events = events[names[i]];
        }
        events.listeners = events.listeners || [];
        for (i = 0, ii = events.listeners.length; i < ii; i++) {
            if (events.listeners[i] === listener) {
                return listener;
            }
        }
        events.listeners.push(listener);
        return listener;
    }
    function once (eventName, listener) {
        function wrapper () {
            removeEventListener(eventName, wrapper);
            return listener.apply(this, arguments);
        }
        return addEventListener(eventName, wrapper);
    }
    function removeEventListener (eventName, listener) {
        var names,
            events,
            ii,
            i;
        if (arguments.length === 0) {
            context._events = dictionary = {names: {}};
            return;
        }
        names = eventName.split(separator);
        events = dictionary;
        for (i = 0, ii = names.length; i < ii; i++) {
            events = events.names && events.names[names[i]];
        }
        if (listener) {
            i = events.listeners.indexOf(listener);
            if (i > -1) {
                events.listeners.splice(i, 1);
            }
        } else {
            recursiveRemove(events);
        }
    }
    function recursiveRemove (dictionary) {
        var names = Object.keys(dictionary.names),
            ii,
            i;
        delete dictionary.listeners;
        for (i = 0, ii = names.length; i < ii; i++) {
            recursiveRemove(dictionary.names[names[i]]);
        }
    }
    function current () {
        return currentEvent;
    }
    context.addEventListener = context.on = addEventListener;
    context.removeEventListener = context.off = removeEventListener;
    context.getListeners = getListeners;
    context.getCurrentEvent = current;
    context.stopEvents = stop;
    context.once = once;
    context.dispatch = dispatch;
    context._events = dictionary;
    return context;
};
