(function () {

    if (typeof window === "undefined" || typeof window.Element === "undefined" || "classList" in document.documentElement) {
        return;
    }

    var prototype = Array.prototype,
        push = prototype.push,
        splice = prototype.splice,
        join = prototype.join;

    function DOMTokenList(el) {
        this.el = el;
        // The className needs to be trimmed and split on whitespace
        // to retrieve a list of classes.
        var classes = el.className.replace(/^\s+|\s+$/g, '').split(/\s+/);
        for (var i = 0; i < classes.length; i++) {
            push.call(this, classes[i]);
        }
    }

    DOMTokenList.prototype = {
        add: function (token) {
            if (this.contains(token)) {
                return;
            }
            push.call(this, token);
            this.el.className = this.toString();
        },
        contains: function (token) {
            return this.el.className.indexOf(token) !== -1;
        },
        item: function (index) {
            return this[index] || null;
        },
        remove: function (token) {
            if (!this.contains(token)){
                return;
            }
            for (var i = 0; i < this.length; i++) {
                if (this[i] === token){
                    break;
                }
            }
            splice.call(this, i, 1);
            this.el.className = this.toString();
        },
        toString: function () {
            return join.call(this, ' ');
        },
        toggle: function (token) {
            if (!this.contains(token)) {
                this.add(token);
            } else {
                this.remove(token);
            }

            return this.contains(token);
        }
    };

    window.DOMTokenList = DOMTokenList;

    function defineElementGetter(obj, prop, getter) {
        if (Object.defineProperty) {
            Object.defineProperty(obj, prop, {
                get: getter
            });
        } else {
            obj.__defineGetter__(prop, getter);
        }
    }

    defineElementGetter(Element.prototype, 'classList', function () {
        return new DOMTokenList(this);
    });

})();
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function () {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function () {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function () {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function (event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function () {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function (event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function () {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function () {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function () {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(new Function("return this")()));
(function () {
    if (typeof window === "undefined") {
        return;
    }

    function Empty() {}

    if (!Function.prototype.bind) {
        Function.prototype.bind = function bind(that) { // .length is 1
            var target = this;
            if (typeof target !== "function") {
                throw new TypeError("Function.prototype.bind called on incompatible " + target);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            var binder = function () {
                if (this instanceof bound) {
                    var result = target.apply(
                        this,
                        args.concat(Array.prototype.slice.call(arguments))
                    );
                    if (Object(result) === result) {
                        return result;
                    }
                    return this;

                } else {
                    return target.apply(
                        that,
                        args.concat(Array.prototype.slice.call(arguments))
                    );
                }
            };
            var boundLength = Math.max(0, target.length - args.length);
            var boundArgs = [];
            for (var i = 0; i < boundLength; i++) {
                boundArgs.push("$" + i);
            }
            var bound = new Function("binder", "return function(" + boundArgs.join(",") + "){return binder.apply(this,arguments)}")(binder);
            if (target.prototype) {
                Empty.prototype = target.prototype;
                bound.prototype = new Empty();
                // Clean up dangling references.
                Empty.prototype = null;
            }
            return bound;
        };
    }
    if (!Array.prototype.map) {
        Array.prototype.map = function (iterator, context) {
            var result = [];
            for (var i = 0, ii = this.length; i < ii; i++) {
                result[i] = iterator.call(context, this[i], i, this);
            }
            return result;
        };
    }
    if (!Date.now) {
        Date.now = function now() {
            return new Date().getTime();
        };
    }
    if (!navigator.getUserMedia) {
        navigator.getUserMedia = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia);
    }
    (function (win, raf) {
        var vendors = [
                "webkit",
                "moz",
                "ms",
                "o"
            ],
            currTime,
            timeToCall,
            lastTime = 0,
            vendor = vendors.shift();

        while (!win[raf] && vendor) {
            win[raf] = win[vendor + "RequestAnimationFrame"];
            win.cancelAnimationFrame = win[vendor + "CancelAnimationFrame"] || win[vendor + "CancelRequestAnimationFrame"];
            vendor = vendors.shift();
        }
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function (callback, element) {
                currTime = Date.now();
                timeToCall = Math.max(0, 16 - (currTime - lastTime));
                lastTime = currTime + timeToCall;

                function wrap() {
                    callback(currTime + timeToCall);
                }
                return setTimeout(wrap, timeToCall);
            };
        }
        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = function (id) {
                clearTimeout(id);
            };
        }
    })(window, "requestAnimationFrame");
})();

(function (global) {
    var core = {
        registered: {},
        modules: {}
    };
    var fnargs = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    var fnname = /function\s*([^\s\(]+)/;

    function dmaf (name, deps, definition) {
        var defType = typeof definition,
            depsType = typeof deps,
            nameType = typeof name;

        if (nameType === "string") {
            if (deps instanceof Array && defType === "function") {
                core.registered[name] = definition;
                definition.deps = deps;
            } else if (depsType === "function") {
                core.registered[name] = deps;
                deps.deps = parseDependencies(deps);
            } else if (depsType !== "undefined") {
                core.modules[name] = deps;
            }
        } else if (nameType === "function") {
            core.registered[parseName(name)] = name;
            name.deps = parseDependencies(name);
        }
        return dmaf;
    }
    function init (deps, f) {
        f.apply(null, deps.map(dmaf_require));
    }

    function dmaf_require (name) {
        return core.modules[name] || execute(name);
    }

    function execute (name) {
        var definition = core.registered[name];
        if (definition) {
            core.modules[name] = definition.apply(null, definition.deps.map(dmaf_require));
            delete core.registered[name];
        }
        return core.modules[name];
    }
    function parseName (fn) {
        var name,
            match;
        if (typeof fn.name === "string") {
            return fn.name;
        } else {
            match = fnname.exec(fn);
            if (match && match[1]) {
                return match[1];
            } else {
                throw new TypeError("Cannot parse function name!");
            }
        }
    }
    function parseDependencies (fn) {
        var args = fnargs.exec(fn),
            str = args && args[1] && args[1].replace(/\s/g, "");
        str = str || null;
        return str ? str.split(/,/) : [];
    }
    if (typeof define === "function") {
        define(dmaf);
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = dmaf;
    }
    dmaf.core = core;
    dmaf("core", core);
    core.require = dmaf_require;
    dmaf.init = init;
    global.dmaf = dmaf;
})(typeof window === "undefined" ? global : window);

dmaf("env", ["_"], function env (_) {
    var env = {};
    if (typeof window !== "undefined" && window.navigator && window.document) {
        env.web = true;
        environmentChecks();
        featureChecks();
        formatChecks();
    } else {
        env.web = false;
    }

    return env;
    function featureChecks () {
        env.xhr = _.isFunction(window.XMLHttpRequest);
        env.xhr2 = env.xhr && "responseType" in (new XMLHttpRequest());
        env.xdr = "XDomainRequest" in window;
        env.arraybuffer = _.isFunction(window.ArrayBuffer);
        env.webaudio = _.isFunction(window.AudioContext) || _.isFunction(window.webkitAudioContext);
        env.touch = "createTouch" in document;
        env.audioElement = _.isFunction(document.createElement("audio").canPlayType);
        env.webSockets = _.isFunction(window.WebSocket);
        env.speechToText = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
        env.textToSpeech = "speechSynthesis" in window;
        env.getUserMedia = !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        env.flash = !!navigator.plugins["Shockwave Flash"];
        if (!env.flash) {
            try {
                env.flash = !!(new window.ActiveXObject("ShockwaveFlash.ShockwaveFlash"));
            } catch (exception) {
                env.flash = (typeof navigator.mimeTypes["application/x-shockwave-flash"] !== "undefined");
            }
        }
        env.ok = env.audioElement && env.xhr;
    }

    function formatChecks () {
        var audio = [
                {
                    ext: ".ogg",
                    test: 'audio/ogg; codecs="vorbis"'
                }, {
                    ext: ".aac",
                    test: 'audio/mp4; codecs="mp4a.40.2"'
                }, {
                    ext: ".mp4",
                    test: "audio/mp4;"
                }
            ],
            video = [
                {
                    ext: ".mp4",
                    test: "video/mp4;"
                }, {
                    ext: ".webm",
                    test: "video/webm;"
                }
            ];


        var result = _.find(canplay, audio, document.createElement("audio"));
        env.audioFormat = result ? result.ext : "";
        env.audioType = result ? result.test : "";
        if (!env.webaudio) {
            env.audioFormat = ".mp4";
            env.audioType = "audio/mp4;";
        }
        result = _.find(canplay, video, document.createElement("video"));
        env.videoFormat = result ? result.ext : "";
        env.videoType = result ? result.test : "";
    }

    function canplay (format) {
        return this.canPlayType(format.test).replace(/^no$/, "") && format;
    }

    function firstMatch (string, regex) {
        var match = string.match(regex);
        return (match && match.length > 1 && match[1]) || "";
    }

    function environmentChecks () {
        var ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
            getFirstMatch = firstMatch.curry(ua),
            iosdevice = getFirstMatch(/(ipod|iphone|ipad)/i).toLowerCase(),
            likeAndroid = /like android/i.test(ua),
            android = !likeAndroid && /android/i.test(ua),
            versionIdentifier = getFirstMatch(/version\/(\d+(\.\d+)?)/i),
            tablet = /tablet/i.test(ua),
            mobile = !tablet && /[^-]mobi/i.test(ua),
            t = true,
            result;

        if (/opera|opr/i.test(ua)) {
            result = {
                name: "Opera",
                opera: t,
                version: versionIdentifier || getFirstMatch(/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i)
            };
        } else if (/windows phone/i.test(ua)) {
            result = {
                name: "Windows Phone",
                windowsphone: t,
                msie: t,
                version: getFirstMatch(/iemobile\/(\d+(\.\d+)?)/i)
            };
        } else if (/msie|trident/i.test(ua)) {
            result = {
                name: "Internet Explorer",
                msie: t,
                version: getFirstMatch(/(?:msie |rv:)(\d+(\.\d+)?)/i)
            };
        } else if (/chrome|crios|crmo/i.test(ua)) {
            result = {
                name: "Chrome",
                chrome: t,
                version: getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)
            };
        } else if (iosdevice) {
            result = {
                name: iosdevice === "iphone" ? "iPhone" : iosdevice === "ipad" ? "iPad" : "iPod"
            };
            if (versionIdentifier) {
                result.version = versionIdentifier;
            }
        } else if (/sailfish/i.test(ua)) {
            result = {
                name: "Sailfish",
                sailfish: t,
                version: getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i)
            };
        } else if (/seamonkey\//i.test(ua)) {
            result = {
                name: "SeaMonkey",
                seamonkey: t,
                version: getFirstMatch(/seamonkey\/(\d+(\.\d+)?)/i)
            };
        } else if (/firefox|iceweasel/i.test(ua)) {
            result = {
                name: "Firefox",
                firefox: t,
                version: getFirstMatch(/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i)
            };
            if (/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(ua)) {
                result.firefoxos = t;
            }
        } else if (/silk/i.test(ua)) {
            result = {
                name: "Amazon Silk",
                silk: t,
                version: getFirstMatch(/silk\/(\d+(\.\d+)?)/i)
            };
        } else if (android) {
            result = {
                name: "Android",
                version: versionIdentifier
            };
        } else if (/phantom/i.test(ua)) {
            result = {
                name: "PhantomJS",
                phantom: t,
                version: getFirstMatch(/phantomjs\/(\d+(\.\d+)?)/i)
            };
        } else if (/blackberry|\bbb\d+/i.test(ua) || /rim\stablet/i.test(ua)) {
            result = {
                name: "BlackBerry",
                blackberry: t,
                version: versionIdentifier || getFirstMatch(/blackberry[\d]+\/(\d+(\.\d+)?)/i)
            };
        } else if (/(web|hpw)os/i.test(ua)) {
            result = {
                name: "WebOS",
                webos: t,
                version: versionIdentifier || getFirstMatch(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)
            };
            /touchpad\//i.test(ua) && (result.touchpad = t);
        } else if (/bada/i.test(ua)) {
            result = {
                name: "Bada",
                bada: t,
                version: getFirstMatch(/dolfin\/(\d+(\.\d+)?)/i)
            };
        } else if (/tizen/i.test(ua)) {
            result = {
                name: "Tizen",
                tizen: t,
                version: getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i) || versionIdentifier
            };
        } else if (/safari/i.test(ua)) {
            result = {
                name: "Safari",
                safari: t,
                version: versionIdentifier
            };
        } else {
            result = {};
        }
        // set webkit or gecko flag for browsers based on these engines
        if (/(apple)?webkit/i.test(ua)) {
            result.name = result.name || "Webkit";
            result.webkit = t;
            if (!result.version && versionIdentifier) {
                result.version = versionIdentifier;
            }
        } else if (!result.opera && /gecko\//i.test(ua)) {
            result.name = result.name || "Gecko";
            result.gecko = t;
            result.version = result.version || getFirstMatch(/gecko\/(\d+(\.\d+)?)/i);
        }

        // set OS flags
        if (android || result.silk) {
            result.android = t;
            result.OS = "android";
        } else if (iosdevice) {
            result[iosdevice] = t;
            result.ios = t;
            result.OS = "ios";
        }

        if (/Mac OS X/i.test(ua)) {
            result.OS = result.OS || "osx";
            result.osx = t;
        } else {
            result.OS = result.OS || "windows";
            if (result.OS === "windows") {
                result.windows = t;
            }
        }
        // OS version extraction
        var osVersion = "";
        if (iosdevice) {
            osVersion = getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i);
            osVersion = osVersion.replace(/[_\s]/g, ".");
        } else if (android) {
            osVersion = getFirstMatch(/android[ \/-](\d+(\.\d+)*)/i);
        } else if (result.windowsphone) {
            osVersion = getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i);
        } else if (result.webos) {
            osVersion = getFirstMatch(/(?:web|hpw)os\/(\d+(\.\d+)*)/i);
        } else if (result.blackberry) {
            osVersion = getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i);
        } else if (result.bada) {
            osVersion = getFirstMatch(/bada\/(\d+(\.\d+)*)/i);
        } else if (result.tizen) {
            osVersion = getFirstMatch(/tizen[\/\s](\d+(\.\d+)*)/i);
        }
        if (osVersion) {
            result.osversion = osVersion;
        }

        var osMajorVersion = osVersion.split(".")[0];
        if (tablet || iosdevice === "ipad" || (android && !mobile) || result.silk) {
            result.tablet = t;
        } else if (mobile || iosdevice === "iphone" || iosdevice === "ipod" || android || result.blackberry || result.webos || result.bada) {
            result.mobile = t;
        }
        if (!result.tablet) {
            result.tablet = false;
        }
        if (!result.mobile) {
            result.mobile = false;
        }
        result.desktop = !result.mobile && !result.tablet;
        if (result.desktop) {
            result.device = "desktop";
        } else if (result.mobile) {
            result.device = "mobile";
        } else if (result.tablet) {
            result.device = "tablet";
        } else {
            result.device = "unknown";
        }
        result.browser = (result.name ? result.name.toLowerCase() : "").replace(/\s/, "_");
        _.extend(env, result);
    }
});

dmaf("_", [], function _ () {
    var _ = {};

    var ostring = Object.prototype.toString;

    // List of HTML entities for escaping.
    var entityMap = {
        escape: {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#x27;"
        },
        unescape: {
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#x27;": "'"
        }
    };

    //Regexes
    _.comma = /,/;
    _.colon = /:/;
    _.dot = /\./;
    _.plus = /\+/;
    _.bang = /\!/;
    _.separator = /[\:\.]/;
    _.whiteSpace = /\s+/g;
    _.accidental = /#|b/;
    _.digit = /-?\d/;
    _.cssUnit = /\%|px/;
    _.dynamic = /<%\=\s([a-zA-Z\.0-9\_\/]*)\s%>/;
    _.extension = /\.[a-z]{3,4}$/;
    _.directory = /[a-zA-Z0-9]+\/$/;
    _.args = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;

    //Constants
    _.E = "";
    _.NOTES = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11
    };
    _.ACCIDENTALS = {
        "#": 1,
        b: -1
    };
    _.SCALES = {
        off: null,
        major: [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0],
        majorTriad: [0, -1, -2, 1, 0, -1, 1, 0, -1, -2, 2, 1],
        minorTriad: [0, -1, -2, 0, -1, -2, 1, 0, -1, -2, 2, 1],
        harmonicMinor: [0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 1, 0],
        naturalMinor: [0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, -1],
        majorPentatonic: [0, 1, 0, 1, 0, -1, 1, 0, 1, 0, -1, 1],
        minorPentatonic: [0, -1, 1, 0, -1, 0, 1, 0, -1, 1, 0, -1],
        dorian: [0, 1, 0, 0, -1, 0, 1, 0, 1, 0, 0, -1],
        phrygian: [0, 0, -1, 0, -1, 0, 1, 0, 0, -1, 0, -1],
        lydian: [0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
        mixolydian: [0, 1, 0, 1, 0, 0, -1, 0, -1, 0, -1],
        locrian: [0, 0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1],
        doubleHarmonic: [0, 0, -1, 1, 0, 0, 1, 0, 0, -1, 1, 0],
        halfDim: [0, 1, 0, 0, -1, 0, 0, -1, 0, -1, 0, -1],
        pentatonic: [0, -1, -2, 0, -1, 0, -1, 0, -1, -2, 0, -1]
    };
    _.VENDOR_PREFIXES = ["webkit", "o", "ms", "moz"];
    _.CSS_PREFIXES = ["-ms-", "-webkit-", "-moz-", "-o-"];
    _.demethodize = Function.prototype.bind.bind(Function.prototype.call);
    _.slice = _.demethodize(Array.prototype.slice);
    _.break = {};

    Function.prototype.autocurry = function (n) {
        return autocurry(this, n);
    };
    Function.prototype.curry = function () {
        var that = this,
            args = _.slice(arguments);
        return function () {
            return that.apply(this, args.concat(_.slice(arguments)));
        };
    };
    Function.prototype.reverse = function () {
        return _.flipF(this);
    };

    function curry (f) {
        var args = _.slice(arguments, 1);
        return function () {
            return f.apply(this, args.concat(_.slice(arguments)));
        };
    }

    function autocurry (f, numArgs) {
        numArgs = numArgs || f.length;
        return function () {
            if (arguments.length < numArgs) {
                if (numArgs - arguments.length > 0) {
                    return autocurry(curry.apply(this, [f].concat(_.slice(arguments))), numArgs - arguments.length);
                } else {
                    return curry.apply(this, [f].concat(_.slice(arguments)));
                }
            } else {
                return f.apply(this, arguments);
            }
        };
    }

    function forEach (f, array, context) {
        var ii = array.length,
            br = _.break,
            i = -1;

        while (++i < ii) {
            if (f.call(context, array[i], i, array) === br) {
                break;
            }
        }
    }
    function forOwn (f, obj, context) {
        var keys = Object.keys(obj),
            ii = keys.length,
            br = _.break,
            i = -1;

        while (++i < ii) {
            if (f.call(context, obj[keys[i]], keys[i], obj) === br) {
                break;
            }
        }
    }
    function each (f, x, context) {
        if (f && x) {
            if (Array.isArray(x)) {
                forEach(f, x, context);
            } else if (_.isObject(x)) {
                forOwn(f, x, context);
            } else {
                forEach(f, _.toArray(x), context);
            }
        }
    }

    //Function
    _.curry = curry;
    _.autocurry = autocurry;
    _.compose = function () {
        var funcs = arguments;
        return function () {
            var args = arguments,
                length = funcs.length;

            while (length) {
                args = [funcs[--length].apply(this, args)];
            }
            return args[0];
        };
    };
    _.noop = function () {};
    _.identity = function (x) {
        return x;
    };
    _.truthy = function (x) {
        return !!x;
    };
    _.falsy = function (x) {
        return !x;
    };
    _.add = _.concat = function (a, b) {
        return a + b;
    }.autocurry();
    _.append = function (a, b) {
        return b + a;
    }.autocurry();
    _.subtract = function (a, b) {
        return a - b;
    }.autocurry();
    _.prop = function (name, obj) {
        return _.get(obj, name);
    }.autocurry();
    _.is = _["=="] = function (a, b) {
        return a === b;
    }.autocurry();
    _.isnt = _["!="] = function (a, b) {
        return a !== b;
    }.autocurry();
    _.lessThan = _["<"] = function (a, b) {
        return a < b;
    }.autocurry();
    _.greaterThan = _[">"] = function (a, b) {
        return a > b;
    }.autocurry();
    _.lessThanOrEqualTo = _.lte = _["<="] = function (a, b) {
        return a <= b;
    }.autocurry();
    _.greaterThanOrEqualTo = _.gte = _[">="] = function (a, b) {
        return a >= b;
    }.autocurry();
    _.propIs = function (name, value, obj) {
        return obj[name] === value;
    }.autocurry();
    _.propIsnt = function (name, value, obj) {
        return obj[name] !== value;
    }.autocurry();
    _.call = function (f) {
        return f.call(this);
    };
    _.callWith = function () {
        var args = _.slice(arguments);
        return function (f) {
            return f.apply(this, args);
        };
    };
    _.memoize = function (f, hasher) {
        var memo = {};
        hasher = hasher || _.identity;
        return function f2 () {
            var args = hasher.apply(this, arguments);
            if (typeof memo[args] === "undefined") {
                memo[args] = f.apply(this, arguments);
            }
            return memo[args];
        };
    };
    _.throttle = function (f, ms, context) {
        var lastExecution = -1;
        return function () {
            var time = Date.now();
            if (time - lastExecution > ms) {
                lastExecution = time;
                return f.apply(context, arguments);
            }
        };
    };
    _.debounce = function (f, ms, context) {
        var timeout,
            args = _.slice(arguments, 3),
            args2 = [];
        function execute() {
            return f.apply(context, args.concat(_.slice(args2)));
        }
        return function () {
            clearTimeout(timeout);
            args2 = arguments;
            timeout = setTimeout(execute, ms);
        };
    };
    _.onlyOnce = function (f) {
        var called = false;
        return function () {
            return called ? null : (called = true) && f.apply(this, arguments);
        };
    };
    _.change = function (f) {
        var memory = _.UID();

        function f2() {
            var args = JSON.stringify(arguments);
            if (args !== memory) {
                memory = args;
                return f.apply(this, arguments);
            }
        }
        f2.reset = function () {
            memory = _.UID();
        };
        return f2;
    };
    _.flipF = function (f) {
        return function () {
            return f.apply(this, _.slice(arguments).reverse());
        };
    };
    _.after = function (n, f) {
        var args = _.slice(arguments, 2),
            i = 0;
        return function () {
            return ++i >= n && f.apply(this, _.flatten(args, _.slice(arguments)));
        };
    };

    //Arrays
    _.forEach = _.each = each.autocurry(2);
    _.map = function (f, x, context) {
        var result;
        context = context || x;
        if (_.isArray(x)) {
            result = [];
            for (var i = 0, ii = x.length; i < ii; i++) {
                result[i] = f.call(context, x[i], i, x);
            }
        } else if (_.isObject(x)) {
            result = {};
            Object.keys(x).forEach(function (key) {
                result[key] = f.call(context, x[key], key, x);
            });
        }
        return result;
    }.autocurry(2);
    _.filter = function (f, x, context) {
        var result;
        context = context || x;
        if (_.isArray(x)) {
            result = [];
            for (var i = 0, ii = x.length; i < ii; i++) {
                if (f.call(context, x[i], i, x)) {
                    result.push(x[i]);
                }
            }
        } else if (_.isObject(x)) {
            result = {};
            Object.keys(x).forEach(function (key) {
                if (f.call(context, x[key], key, x)) {
                    result[key] = x[key];
                }
            });
        }
        return result;
    }.autocurry(2);
    _.reduce = function (f, x, result, context) {
        var index = -1,
            length = x.length,
            noaccum = arguments.length < 3;

        if (typeof length === "number") {
            if (noaccum) {
                result = x[++index];
            }
            while (++index < length) {
                result = f(result, x[index], index, x);
            }
        } else {
            each(function (value, key) {
                result = noaccum ? (noaccum = false, value) : f(result, value, key, x);
            }, x);
        }
        return result;
    }.autocurry(2);
    _.every = function (f, x, context) {
        var result = true;
        each(function (value, key, x) {
            if (!f.call(context, value, key, x)) {
                result = false;
                return _.break;
            }
        }, x);
        return result;
    }.autocurry(2);
    _.some = function (f, x, context) {
        var result = false;
        each(function (value, key, x) {
            if (f.call(context, value, key, x)) {
                result = true;
                return _.break;
            }
        }, x);
        return result;
    }.autocurry(2);
    _.reverse = function (array) {
        var left = 0,
            length = array.length,
            right,
            temp;
        for (; left < length / 2; left++) {
            right = length - 1 - left;
            temp = array[left];
            array[left] = array[right];
            array[right] = temp;
        }
        return array;
    };
    _.sort = function (f, array) {
        return array.sort(f);
    }.autocurry();
    _.sortBy = function (name, ascending, array) {
        var up = ascending ? -1 : 1,
            down = ascending ? 1 : -1;
        return array.sort(function (a, b) {
            return a[name] < b[name] ? up : down;
        });
    }.autocurry();
    _.first = function (array) {
        return array[0];
    }.autocurry();
    _.last = function (array) {
        return array[array.length - 1];
    }.autocurry();
    _.max = function (array) {
        return Math.max.apply(Math, array);
    };
    _.min = function (array) {
        return Math.min.apply(Math, array);
    };
    _.find = function (f, x, context) {
        var result;
        _.each(function (value, key) {
            if (f.call(context, value, key, x)) {
                result = value;
                return _.break;
            }
        }, x);
        return result;
    }.autocurry(2);
    _.partition = function (f, array, context) {
        var a = [],
            b = [],
            r;
        for (var i = 0, ii = array.length; i < ii; i++) {
            if (f.call(context, array[i], i, array)) {
                a.push(array[i]);
            } else {
                b.push(array[i]);
            }
        }
        return [a, b];
    }.autocurry(2);
    _.partitionBy = function (key, array) {
        var res = {},
            value;
        for (var i = 0, ii = array.length; i < ii; i++) {
            res[array[i][key]] = res[array[i][key]] || [];
            res[array[i][key]].push(array[i]);
        }
        return res;
    }.autocurry(2);
    _.compact = function (array) {
        return array.filter(_.truthy);
    };
    _.union = function () {
        return _.unique(_.flatten.apply(_, arguments));
    };
    _.unique = function (array) {
        return array.filter(_.uniq);
    };
    _.where = function (attrs, array) {
        return _.filter(_.matches(attrs), array);
    }.autocurry(2);
    _.findWhere = function (obj, attrs) {
        return _.find(_.matches(attrs), obj);
    }.autocurry();
    _.swap = function (array, i, ii) {
        var t = array[i];
        array[i] = array[ii];
        array[ii] = t;
        return array;
    }.autocurry(3);
    _.average = function (array) {
        return array.reduce(_.add) / array.length;
    };
    _.contains = function (array, element) {
        return array.indexOf(element) !== -1;
    }.autocurry();
    _.join = function (array) {
        if (arguments.length > 1) {
            array = _.slice(arguments);
        }
        return [].concat.apply([], array);
    };
    _.flatten = function () {
        var result = [];
        each(function flatten (item) {
            if (_.isArray(item)) {
                _.forEach(flatten, item);
            } else {
                result.push(item);
            }
        }, _.slice(arguments));
        return result;
    };
    _.pluck = function (name, array) {
        return _.map(_.prop(name), array);
    }.autocurry();
    _.mapToObj = _.map(function (value, i) {
        return {
            index: i,
            value: value
        };
    });
    _.uniq = function (value, index, self) {
        return self.indexOf(value) === index;
    };
    _.stringSort = function (name) {
        return function (a, b) {
            return a[name] < b[name] ? -1 : 1;
        };
    };
    _.propSort = function (name) {
        return function (a, b) {
            return a[name] - b[name];
        };
    };
    _.from = function (n, f) {
        var res = [];
        for (var i = 0; i < n; i++) {
            res[i] = f ? f(i, res) : undefined;
        }
        return res;
    };
    _.onemap = function (a, f) {
        var res = _.slice(a);
        for (var i = 0, ii = a.length; i < ii; i++) {
            res[i] = f(a[i]);
        }
        return res;
    };
    _.diff = function (a, b) {
        return a.filter(function (x) {
            return b.indexOf(x) === -1;
        });
    };
    _.indexBy = function (key, array) {
        return array.reduce(function (res, cur) {
            res[cur[key]] = cur;
            return res;
        }, {});
    }.autocurry();
    _.rmItem = function (item, array) {
        var index = array.indexOf(item);
        if (index > -1) {
            array.splice(index, 1);
        }
        return array;
    };

    //Number
    _.constrain = function (model, value) {
        if (value > model.max) {
            value = model.max;
        }
        if (value < model.min) {
            value = model.min;
        }
        return value;
    };
    _.inRange = function (model, value) {
        return value <= model.max && value >= model.min;
    };
    _.rand = function (min, max) {
        var range;
        if (!arguments.length) {
            return Math.random() >= 0.5;
        }
        if (typeof max === "undefined") {
            max = min;
            min = 0;
        }
        range = (max - min) - 0.0001;
        return parseInt(Math.random() * range) + min;
    };
    //RegExp
    _.test = function (exp, string) {
        exp = _.isRegExp(exp) ? exp : new RegExp(exp);
        return exp.test(string);
    }.autocurry();
    _.firstMatch = function (regex, string) {
        // TODO: figure out what this is supposed to return
        var match;
        if (!string) {
            match = "";
        } else {
            if (_.isRegExp(string)) {
                var temp = string;
                string = regex;
                regex = string;
            }
            if (typeof string.match !== "function") {
                match = "";
            } else {
                match = string.match(regex);
                match = (match && match.length > 1 && match[1]) || '';
            }
        }
        return match;
    }.autocurry();

    //String
    _.nameToPath = function (base, ext, name) {
        return base + name + ext;
    }.autocurry();
    _.noWhiteSpace = function (string) {
        return _.isString(string) ? string.replace(_.whiteSpace, "") : string;
    };
    _.joinArgs = function (c) {
        return _.slice(arguments, 1).join(c);
    }.autocurry(2);
    _.bool = function (x) {
        return x === "true" ? true : x === "false" ? false : x;
    };
    _.capitalize = function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };
    _.split = function (splitter, string) {
        return string.split(splitter);
    }.autocurry();
    _.replace = function (regex, replacer, string) {
        return string.replace(regex, replacer);
    }.autocurry();

    //Parsing
    _.toString = function (x) {
        return x ? x.toString() : "";
    };
    _.convert = function (descriptor, value) {
        if (_.isUndefined(value)) {
            return value;
        }
        switch (_.get(descriptor, "type")) {
        case "int":
            return parseFloat(value);
        case "float":
            return parseFloat(value);
        case "string":
            return (isNaN(value) || value === "") ? value + "" : parseFloat(value);
        case "list":
            return _.isArray(value) ? value : value.split(",").map(_.noWhiteSpace);
        case "enum":
            return value + "";
        case "boolean":
            return value === "true";
        case "array":
            return value;
        case undefined:
            console.error("Missing/Malformed descriptor", descriptor, value);
            break;
        default:
            console.error("Unknown Type", descriptor, value);
        }
    };
    _.coerce = function (value) {
        if (!isNaN(parseFloat(value))) {
            return parseFloat(value);
        }
        if (typeof value === "string") {
            value = value.toLowerCase().trim();
            if (value === "true") {
                return true;
            } else if (value === "false") {
                return false;
            }
        }
        return value;
    };
    _.validate = function (descriptor, value) {
        switch (_.get(descriptor, "type")) {
        case "int":
            return _.isInt(value) && _.inRange(descriptor, value);
        case "float":
            return _.isFloat(value) && _.inRange(descriptor, value);
        case "string":
            return _.isString(value);
        case "list":
            return _.isArray(value) && _.compact(_.filter(_.isString, value)).length === value.length;
        case "enum":
            return _.contains(descriptor.values, value);
        case "boolean":
            return _.isBoolean(value);
        case "array":
            return _.isArray(value);
        case undefined:
            console.error("Missing/Malformed descriptor", descriptor, value);
            break;
        default:
            console.error("Unknown Type", descriptor, value);
        }
    }.autocurry();
    _.default = function (defaults, obj) {
        each(function (value, key) {
            obj[key] = _.isUndefined(obj[key]) ? value : obj[key];
        }, defaults);
        return obj;
    };
    _.isValidJSON = function (string) {
        if (typeof string !== "string") {
            return false;
        }
        return (/^[\],:{}\s]*$/).test(string.replace(/\\["\\\/bfnrtu]/g, '@')
            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
            .replace(/(?:^|:|,)(?:\s*\[)+/g, ''));
    };

    //Object
    _.keys = function (obj) {
        if (_.isObject(obj)) {
            return Object.keys(obj);
        } else {
            return [];
        }
    };
    _.has = function (prop, obj) {
        return obj.hasOwnProperty(prop);
    };
    _.set = function (obj, keys, value) {
        var chain,
            key;

        if (!_.isTraversable(obj)) {
            return null;
        }

        chain = _.isArray(keys) ? keys.slice() : keys.split(_.separator);
        key = chain.shift();

        while (chain.length) {
            if (_.isInt(parseFloat(chain[0]))) {
                obj = typeof obj[key] === "undefined" ? (obj[key] = []) : obj[key];
            } else {
                obj = typeof obj[key] === "undefined" ? (obj[key] = {}) : obj[key];
            }
            key = chain.shift();
        }
        obj[key] = value;
        return value;
    }.autocurry(3);
    _.get = function (obj, keys) {
        var chain,
            key;
        if (typeof obj === "object") {
            chain = _.isArray(keys) ? keys.slice() : keys.split(_.separator);
            key = chain.shift();
            while (chain.length) {
                if (!obj[key]) {
                    return obj[key];
                }
                obj = obj[key];
                key = chain.shift();
            }
            if (!chain.length && obj[key] !== "undefined") {
                return obj[key];
            }
        }
        return undefined;
    }.autocurry(2);
    _.recurse = function (f, obj, context) {
        var path = [],
            i = 0;
        function iterate (value, key, object) {
            f(value, key, obj, path.concat([key]));
            if (_.isTraversable(value)) {
                path.push(key);
                if (value !== obj) {
                    _.forEach(iterate, value, context);
                }
                path.pop();
            }
        }
        if (_.isTraversable(obj)) {
            _.forEach(iterate, obj, context);
        }
    }.autocurry(2);
    _.extend = function (receiver) {
        each(function (provider) {
            each(function (value, key) {
                if (_.isObject(value)) {
                    _.extend(receiver[key] = {}, value);
                } else if (_.isArray(value)) {
                    _.extend(receiver[key] = [], value);
                } else {
                    receiver[key] = value;
                }
            }, provider);
        }, _.slice(arguments, 1));
        return receiver;
    };
    _.clone = function (obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : undefined;
    };
    _.toObj = function (name, value) {
        var obj = {};
        obj[name] = value;
        return obj;
    }.autocurry(2);
    _.toArray = function (x) {
        if (x && typeof x["length"] === "number") {
            return _.slice(x);
        } else if (_.isObject(x)) {
            return _.map(objMap, x);
        } else {
            return [];
        }
    };
    _.sortObj = function (obj) {
        function iterate(res, key) {
            res[key] = _.isObject(obj[key]) ? _.sortObj(obj[key]) : obj[key];
            return res;
        }
        return Object.keys(obj).sort().reduce(iterate, {});
    };
    _.invoke = function (method) {
        var args = _.slice(arguments, 1),
            isFunc = _.isFunction(method);

        return function (obj) {
            return (isFunc ? method : obj[method]).apply(obj, args);
        };
    };
    _.bindMethod = function (method, obj, overwrite) {
        if (overwrite) {
            obj[method] = obj[method].bind(obj);
            return obj[method];
        } else {
            return obj[method].bind(obj);
        }
    };
    _.bindAll = function (context) {
        for (var key in context) {
            if (_.isFunction(context[key])) {
                context[key] = context[key].bind(context);
            }
        }
    };
    _.matches = function (attrs, obj) {
        if (!obj) {
            return false;
        }
        for (var key in attrs) {
            if (attrs[key] !== obj[key]) {
                return false;
            }
        }
        return true;
    }.autocurry(2);
    function objMap (key) {
        return {
            key: key,
            value: this[key]
        };
    }
    //Async
    _.setImmediate = _.nextTick = function (f) {
        setTimeout(f.apply.bind(f, this, _.slice(arguments, 1)), 0);
    };

    //Audio
    _.dbToWAVolume = function (db) {
        return Math.max(0, Math.floor(100 * Math.pow(2, db / 6)) / 100);
    };
    _.dbToJSVolume = function (db) {
        return Math.min(1, _.dbToWAVolume(db));
    };
    _.toMidiNote = function (string) {
        var pitchClass,
            accidental,
            octave,
            result;

        if (typeof string === "number") {
            result = string;
        } else {
            string = string.replace(/s/, "#");
            pitchClass = _.NOTES[string[0]];
            accidental = _.accidental.exec(string);
            octave = _.digit.exec(string);
            accidental = accidental && accidental[0];
            octave = octave && parseInt(octave[0]);
            if (typeof pitchClass !== "undefined") {
                if (accidental) {
                    pitchClass = (pitchClass + _.ACCIDENTALS[accidental] + 12) % 12;
                }
                if (typeof octave !== "undefined") {
                    result = 24 + pitchClass + octave * 12;
                } else {
                    throw new Error("Malformed note string " + string);
                }
            } else {
                throw new Error("pitchClass was undefined " + string);
            }
        }
        return result;
    };
    _.mToF = function (midiNote) {
        return 8.1757989156 * Math.pow(2.0, midiNote / 12.0);
    };
    _.tanh = function (arg) {
        return (Math.exp(arg) - Math.exp(-arg)) / (Math.exp(arg) + Math.exp(-arg));
    };
    _.sign = function (x) {
        return x === 0 ? 1 : Math.abs(x) / x;
    };
    _.fmod = function (x, y) {
        var tmp, tmp2, p = 0,
            pY = 0,
            l = 0.0,
            l2 = 0.0;

        tmp = x.toExponential().match(/^.\.?(.*)e(.+)$/);
        p = parseInt(tmp[2], 10) - (tmp[1] + '').length;
        tmp = y.toExponential().match(/^.\.?(.*)e(.+)$/);
        pY = parseInt(tmp[2], 10) - (tmp[1] + '').length;

        if (pY > p) {
            p = pY;
        }

        tmp2 = (x % y);

        if (p < -100 || p > 20) {
            // toFixed will give an out of bound error so we fix it like this:
            l = Math.round(Math.log(tmp2) / Math.log(10));
            l2 = Math.pow(10, l);

            return (tmp2 / l2).toFixed(l - p) * l2;
        } else {
            return parseFloat(tmp2.toFixed(-p));
        }
    };
    _.scaleQuantize = function (scale, root, note) {
        var scaleArray,
            pitchClass,
            result;

        scaleArray = _.isArray(scale) ? scale : _.SCALES[scale];

        if (scaleArray) {
            root = _.toMidiNote(root + "-2");
            pitchClass = (note % 12) - root;
            if (pitchClass < 0) {
                pitchClass = 12 + pitchClass;
            }
            return note + scaleArray[pitchClass];
        } else {
            return null;
        }
    };
    _.makeNote = function (type, midiNote, velocity, duration) {
        return new MidiNote(type, midiNote, velocity, duration);
    };

    function MidiNote (type, midiNote, velocity, duration) {
        this.type = type || "noteOn";
        this.midiNote = midiNote || 0;
        this.velocity = velocity || 0;
        this.duration = duration || 0;
    }

    //General
    _.toKeys = function (keys) {
        return _.isArray(keys) ? keys.slice() : _.isString(keys) ? keys.split(_.separator) : [];
    };
    _.isInt = function (value) {
        return value === +value && value % 1 === 0;
    };
    _.isFloat = function (value) {
        return value === +value && isFinite(value);
    };
    _.isNumber = function (value) {
        return typeof value === "number";
    };
    _.isDefined = function (value) {
        return typeof value !== "undefined";
    };
    _.isUndefined = function (value) {
        return typeof value === "undefined";
    };
    _.isNull = function (value) {
        return value === null;
    };
    _.isBoolean = function (value) {
        return typeof value === "boolean";
    };
    _.isString = function (value) {
        return typeof value === "string";
    };
    _.isPrimitive  = function (value) {
        var type = typeof value;
        return type === "number"  ||
               type === "string"  ||
               type === "boolean" ||
               value === null     ||
               value === void 0; //undefined
    };
    _.isArray = function (value) {
        return Array.isArray(value);
    };
    _.isFunction = function (value) {
        return typeof value === "function" ||
            /Function|Constructor/.test(ostring.call(value));
    };
    _.isObject = function (value) {
        return ostring.call(value) === "[object Object]";
    };
    _.isRegExp = function (value) {
        return value instanceof RegExp;
    };
    _.isDate = function (value) {
        return value instanceof Date;
    };
    _.isArguments = function (obj) {
        return !!(obj && _.has(obj, "callee"));
    };
    _.isDynamic = function (string) {
        return _.isString(string) && /<%\=\s([a-zA-Z\.0-9\_\/]*)\s%>/g.test(string);
    };
    _.isNested = function (x) {
        return _.isArray(x) ? x.every(_.isString) : (_.isString(x) && /[\w]+\./.test(x));
    };
    _.isExtendable = function (value) {
        return value === Object(value);
    };
    _.isElement = _.isNode = function (obj) {
        return !!(obj && obj.nodeType === 1);
    };
    _.isHTML = function (string) {
        return (/^\s*<(\w+|!)[^>]*>/).test(string);
    };
    _.isNodeList = function (x) {
        return typeof NodeList !== "undefined" && x instanceof window.NodeList;
    };
    _.isFilePath = function (string) {
        return !!string && _.extension.test(string);
    };
    _.isDirectoryPath = function (string) {
        return !!string && _.diretory.test(string);
    };
    _.isTraversable = function (obj) {
        return !!obj && (_.isArray(obj) || _.isObject(obj));
    };
    _.UID = _.uid = function (n) {
        var hex = "0123456789ABCDEF",
            s = "";

        n = n || 16;
        for (var i = 0; i < n; i++) {
            s = s + hex.substr(~~(Math.random() * 0x10), 1);
        }
        return s;
    };
    var iteratorMethods = {
        ROUND_ROBIN: function () {
            this.index++;
            this.index %= this.array.length;
            return this.array[this.index];
        },
        RANDOM_FIRST: function () {
            if (this.index === -1) {
                this.index = Math.floor(Math.random() * this.array.length);
            } else {
                this.index = (this.index + 1) % this.array.length;
            }
            return this.array[this.index];
        },
        RANDOM: function () {
            return this.array[Math.floor(Math.random() * this.array.length)];
        },
        SHUFFLE: function () {
            var index = _.rand(this.A.length),
                element = this.A.splice(index, 1).pop();

            this.B.push(element);
            if (this.B.length === this.array.length) {
                this.A = this.array.slice(0);
                this.B = [];
            }
            return element;
        }
    };

    function Iterator (array, type) {
        this.index = -1;
        this.array = array;
        this.getNext = iteratorMethods[type];
        this.A = array.slice(0);
        this.B = [];
    }
    _.iterator = function (sounds, type) {
        return new Iterator(sounds, type);
    };
    _.vendorPrefix = function (obj, name) {
        var capitalized = _.capitalize(name);
        return _.VENDOR_PREFIXES.map(function (prefix) {
            return obj[prefix + capitalized];
        }).filter(_.truthy).shift() || obj[name] || null;
    };
    _.prefixCSS = function (object, property, value) {
        _.CSS_PREFIXES.forEach(function (prefix) {
            object[prefix + property] = value;
        });
        return object;
    };
    _.decodeEntities = function (string) {
        var p = document.createElement("p");
        p.innerHTML = string;
        return p.innerText || p.textContent;
    };

    //Date
    _.utcDate = function () {
        var date = new Date();
        var month = date.getUTCMonth() + 1;
        var array = [
            date.getUTCDate(),
            (month < 10 ? "0" : "") + month,
            date.getFullYear().toString().replace(/20/, "")
        ];
        return array.join("_");
    };

    var entityRegexes = {
        escape: new RegExp('[' + _.keys(entityMap.escape).join("") + "]", "g"),
        unescape: new RegExp('(' + _.keys(entityMap.unescape).join("|") + ")", "g")
    };

    each(function (method) {
        _[method] = function (string) {
            if (string) {
                return ("" + string).replace(entityRegexes[method], function (match) {
                    return entityMap[method][match];
                });
            } else {
                return "";
            }
        };
    }, ["escape", "unescape"]);
    return _;
});

dmaf("task", ["_","core"], function task (_, core) {
    var PENDING = void 0,
        SEALED = 0,
        FULFILLED = 1,
        REJECTED = 2;

    //Promise Constructor
    function Promise (resolver) {
        if (!_.isFunction(resolver)) {
            throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
        }
        this._subscribers = [];
        invokeResolver(resolver, this);
    }

    Promise.prototype = {
        constructor: Promise,
        _context: undefined,
        _state: undefined,
        _detail: undefined,
        _subscribers: undefined,
        then: function (onFulfillment, onRejection) {
            var promise = this,
                callbacks = arguments,
                thenPromise = new this.constructor(_.noop);

            if (this._context && onFulfillment) {
                onFulfillment = onFulfillment.bind(this._context);
                thenPromise._context = this.context;
            }
            if (onRejection) {
                onRejection = onRejection.bind(this._context);
            }
            if (this._state) {
                setImmediate(invokePromiseCallback);
            } else {
                subscribe(this, thenPromise, onFulfillment, onRejection);
            }
            return thenPromise;
            function invokePromiseCallback () {
                invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
            }
        },
        "catch": function (onRejection) {
            return this.then(null, onRejection);
        },
        "finally": function (callback) {
            var _promise = new Promise(_.noop);
            _promise._context = this._context;
            return this.then(onFulfillment, onRejection);
            function onFulfillment (result) {
                return _promise.then(function () {
                    callback(null, result);
                    return result;
                });
            }
            function onRejection (reason) {
                return _promise.then(function () {
                    callback(reason);
                    throw reason;
                });
            }
        },
        "bind": function (context) {
            this._context = context;
            return this.then(_.indentity);
        },
        "or": function (promise) {
            return this.catch(function (err) {
                if (promise instanceof promise) {
                    return promise;
                } else if (_.isFunction(promise)) {
                    return task.resolve().then(promise);
                }
            });
        },
        "resolveWithEvent": function (eventName) {
            var resolved = false,
                deferred = task.deferred(),
                _eventProperties,
                handler = core.once(eventName, onevent);
            deferred.promise.bind(this._context);
            return this.then(onFulfillment, onRejection);
            function onevent (eventName, eventTime, eventProperties) {
                resolved = true;
                eventProperties = eventProperties || {};
                eventProperties.eventName = eventName;
                eventProperties.eventTime = eventTime;
                _eventProperties = eventProperties;
                deferred.resolve(eventProperties);
            }
            function onFulfillment () {
                return deferred.promise;
            }
            function onRejection (error) {
                core.off(eventName, handler);
                deferred.reject(error);
            }
        },
        "reject": function (reason) {
            return this.then(function () {
                throw reason;
            });
        },
        "delay": function (ms) {
            return this.then(function () {
                var deferred = task.deferred();
                deferred.promise.bind(this._context);
                setTimeout(function () {
                    deferred.resolve(ms);
                }, ms);
                return deferred.promise;
            });
        }
    };

    //Promise Private Methods
    function invokeResolver (resolver, promise) {
        try {
            resolver(resolvePromise, rejectPromise);
        } catch (e) {
            rejectPromise(e);
        }
        function resolvePromise (value) {
            resolve(promise, value);
        }

        function rejectPromise (reason) {
            reject(promise, reason);
        }
    }

    function invokeCallback (settled, promise, callback, detail) {
        var hasCallback = _.isFunction(callback),
            succeeded,
            failed,
            value,
            error;

        if (hasCallback) {
            try {
                value = callback(detail);
                succeeded = true;
            } catch (e) {
                failed = true;
                error = e;
            }
        } else {
            value = detail;
            succeeded = true;
        }

        if (handleThenable(promise, value)) {
            return;
        } else if (hasCallback && succeeded) {
            resolve(promise, value);
        } else if (failed) {
            reject(promise, error);
        } else if (settled === FULFILLED) {
            resolve(promise, value);
        } else if (settled === REJECTED) {
            reject(promise, value);
        }
    }

    function subscribe (parent, child, onFulfillment, onRejection) {
        var subscribers = parent._subscribers,
            length = subscribers.length;

        child._context = parent._context;
        subscribers[length] = child;
        subscribers[length + FULFILLED] = onFulfillment;
        subscribers[length + REJECTED] = onRejection;
    }

    function publish (promise, settled) {
        var subscribers = promise._subscribers,
            detail = promise._detail,
            callback,
            child;

        for (var i = 0; i < subscribers.length; i += 3) {
            child = subscribers[i];
            callback = subscribers[i + settled];
            invokeCallback(settled, child, callback, detail);
        }

        promise._subscribers = null;
    }

    function handleThenable (promise, value) {
        var then = null,
            resolved;

        try {
            if (promise === value) {
                throw new TypeError("A promise callback cannot return that same promise.");
            }

            if (_.isExtendable(value)) {
                then = value.then;

                if (_.isFunction(then)) {
                    then.call(value, function (val) {
                        if (resolved) {
                            return true;
                        }
                        resolved = true;

                        if (value !== val) {
                            resolve(promise, val);
                        } else {
                            fulfill(promise, val);
                        }
                    }, function (val) {
                        if (resolved) {
                            return true;
                        }
                        resolved = true;
                        reject(promise, val);
                    });
                    return true;
                } else {
                    return false;
                }
            }
        } catch (error) {
            if (!resolved) {
                reject(promise, error);
            }
            return true;
        }
    }

    function resolve (promise, value) {
        if (promise === value) {
            fulfill(promise, value);
        } else if (!handleThenable(promise, value)) {
            fulfill(promise, value);
        }
    }

    function fulfill (promise, value) {
        if (promise._state !== PENDING) {
            return;
        }
        promise._state = SEALED;
        promise._detail = value;

        setImmediate(publishFulfillment, promise);
    }

    function reject (promise, reason) {
        if (promise._state !== PENDING) {
            return;
        }
        promise._state = SEALED;
        promise._detail = reason;

        setImmediate(publishRejection, promise);
    }

    function publishFulfillment(promise) {
        publish(promise, promise._state = FULFILLED);
    }

    function publishRejection(promise) {
        publish(promise, promise._state = REJECTED);
    }

    function returnWith (value) {
        return function () {
            return value;
        };
    }

    function resolveWith (value) {
        return function resolver (resolve) {
            return resolve(value);
        };
    }

    //Task Methods
    function task (resolver) {
        return new Promise(resolver);
    }
    task.Promise = Promise;
    task.resolve = function resolve (value) {
        return task(doresolve);
        function doresolve (resolve) {
            resolve(value);
        }
    };
    task.reject = function reject (reason) {
        return task(doreject);
        function doreject (resolve, reject) {
            reject(reason);
        }
    };
    task.all = function all (promises) {
        var Promise = this;
        if (!_.isArray(promises)) {
            throw new TypeError("You must pass an array to all.");
        }
        return task(_resolver);
        function _resolver (resolve, reject) {
            var results = [],
                remaining = promises.length,
                promise;

            if (remaining === 0) {
                resolve([]);
            }

            function resolver (index) {
                return function (value) {
                    resolveAll(index, value);
                };
            }

            function resolveAll(index, value) {
                results[index] = value;
                if (--remaining === 0) {
                    resolve(results);
                }
            }

            for (var i = 0; i < promises.length; i++) {
                promise = promises[i];

                if (promise && _.isFunction(promise.then)) {
                    promise.then(resolver(i), reject);
                } else {
                    resolveAll(i, promise);
                }
            }
        }
    };
    task.race = function race (promises) {
        promises = _.isArray(promises) ?  promises : _.slice(arguments);
        return task(dorace);
        function dorace (resolve, reject) {
            var results = [],
                promise;

            for (var i = 0; i < promises.length; i++) {
                promise = promises[i];

                if (promise && typeof promise.then === "function") {
                    promise.then(resolve, reject);
                } else {
                    resolve(promise);
                }
            }
        }
    };
    task.deferred = function deferred (context) {
        var _resolve,
            _reject,
            promise = task(grabResolvers).bind(context);

        function grabResolvers (resolve, reject) {
            _resolve = resolve;
            _reject = reject;
        }
        function makeNodeResolver () {
            return function nodeResolver (err, value) {
                if (err) {
                    _reject(err);
                } else {
                    _resolve(value);
                }
            };
        }
        return {
            resolve: _resolve,
            reject: _reject,
            promise: promise,
            makeNodeResolver: makeNodeResolver
        };
    };
    task.bind = function bind (context) {
        return task.resolve().bind(context);
    };
    task.peek = function peek (value) {
        (this["log"] ? this : console).log("task.peek", value);
        return value;
    };
    task.getStack = function stack (error) {
        (this["error"] ? this : console).error("\n" + (_.get(error, "stack") || error));
    };
    task.either = function either (promiseOne) {
        return {
            or: function (promiseTwo) {
                return task.race([promiseOne, promiseTwo]);
            }
        };
    };
    task.timeout = function timeout (ms) {
        var deferred = task.deferred(),
            id = setTimeout(ontimeout, ms);

        deferred.promise.clear = clear;
        return deferred.promise;
        function ontimeout () {
            deferred.reject(new Error("timed out after " + ms + "ms"));
        }
        function clear () {
            clearTimeout(id);
        }
    };
    task.delay = function timeout (ms) {
        var deferred = task.deferred(),
            id = setTimeout(ontimeout, ms);

        deferred.promise.clear = clear;
        return deferred.promise;
        function ontimeout () {
            deferred.resolve(ms);
        }
        function clear () {
            clearTimeout(id);
        }
    };
    task.event = function event (initEvent, resolveEvent, eventProperties) {
        if (!resolveEvent) {
            resolveEvent = initEvent;
            initEvent = void 0;
        }
        return initEvent ? makeTask : makeTask();
        function makeTask () {
            return task (function (resolve, reject) {
                core.once(resolveEvent, mediator);
                if (initEvent) {
                    core.dispatch(initEvent, 0, eventProperties || {});
                }
                function mediator (eventName, eventTime, eventProperties) {
                    if (/:fail/.test(eventName)) {
                        reject(eventProperties);
                    } else {
                        eventProperties = eventProperties || {};
                        eventProperties.eventName = eventName;
                        eventProperties.eventTime = eventTime;
                        resolve(eventProperties);
                    }
                }
            });
        }
    };
    task.denodeify = function denodeify (nodeFunction, context) {
        var args = [],
            counter = 0;
        return function denodeified () {
            var deferred = task.deferred();
            args = args.concat(_.slice(arguments));
            args.push(deferred.makeNodeResolver());
            setImmediate(invokeNodeFunction);
            return deferred.promise;
            function invokeNodeFunction () {
                try {
                    nodeFunction.apply(context, args);
                } catch (e) {
                    deferred.reject(e);
                }
            }
        };
    };
    task.thenify = function thenify (nodeFunction) {
        nodeFunction = task.denodeify(nodeFunction);
        return function () {
            var args = _.slice(arguments);
            return function () {
                return nodeFunction.apply(this, args);
            };
        };
    };
    task.lateBind = function lateBind (name, arity) {
        return function bound () {
            var args = _.slice(arguments),
                context = args.pop();
            return task.denodeify(context[name], context).apply(this, args);
        }.autocurry(arity || 1);
    };
    task.fcall = function (f) {
        var args = _.slice(arguments, 1);
        return function () {
            return f.apply(args.concat(_.slice(arguments)));
        };
    };
    return task;
});

dmaf("ajax", ["_","env","task"], function ajax (_, env, task) {
    var maxTimeout = 30000,
        xhrCallbacks,
        methods = {},
        xhrId = 0,
        host,
        head;

    function onunload () {
        _.each(_.call, xhrCallbacks);
        xhrCallbacks = null;
    }

    function clear (x) {
        x.onload = x.onerror = x.ontimeout = x.onabort = _.noop;
    }

    function createScript (src, callback) {
        var s = document.createElement("script");
        s.setAttribute("src", src);
        s.setAttribute("async", true);
        s.setAttribute("charset", "UTF-8");
        s.setAttribute("type", "text/javascript");
        s.onload = s.onerror = callback;
        return s;
    }

    function xhr (src, callback, verb, responseType, mimeType, override, headers, data) {
        var crossOrigin = !host.test(src) && src[0] !== ".",
            xdr,
            req,
            id;
        callback = _.onlyOnce(callback);

        if (typeof xhrCallbacks === "undefined" || !xhrCallbacks) {
            xhrCallbacks = {};
            xhrId = 0;
        }

        try {
            //User XDR if it exists and the origin is cross domain
            xdr = env.xdr;/* && crossOrigin;*/
            //Let IE10 use CORS
            if (env.browser === "Explorer" && env.browserVersion > 10) {
                xdr = false;
            }
            req = xdr ? new window.XDomainRequest() : new XMLHttpRequest();
            if (xdr) {
                // Suppport IE9, XDR does not work without an on progress listener :*(
                req.onprogress = _.noop;
            }
        } catch (e) {
            callback("Could not find transport: " + src);
        }

        //Open request
        req.open(verb, src, true);

        //Set responseType if not XDomain and is XHR level 2
        if (!xdr && env.xhr2 && responseType && responseType !== "json") {
            req.responseType = responseType;
        }

        //Override Mime type
        if (override && "overrideMimeType" in req) {
            req.overrideMimeType(override);
        }

        req.timeout = maxTimeout;

        function complete (type) {
            return function (e) {
                var statusOk = typeof this.status !== "undefined";
                if (statusOk) {
                    statusOk = this.status >= 200 && this.status < 300 || this.status === 304;
                } else if (xdr) {
                    statusOk = true; //XDomainRequest doesn't have status
                }
                delete xhrCallbacks[id];
                clear(this);
                if (type === "error" || !statusOk) {
                    return callback("AJAX Error: " + src);
                }
                if (type === "abort") {
                    callback("Request was aborted.");
                    return req.abort();
                }
                if (!responseType) {
                    if (_.isValidJSON(this.responseText)) {
                        responseType = "json";
                    } else {
                        return callback(null, this.response || this.responseText);
                    }
                }
                //Ok to get response
                switch (responseType) {
                case "document":
                    var res;
                    if (env.xhr2 && typeof this.response === "object") {
                        // chrome goes here for html
                        res = this.response;
                    } else if (typeof this.responseXML === "object" && !/html/.test(src)) {
                        res = this.responseXML;
                    } else {
                        // IE9 goes here for html
                        try {
                            // this needs to be a full document object,
                            // instead of a DOM element
                            res = document.implementation.createHTMLDocument("");
                            res.body.innerHTML = this.responseText;
                        } catch (er) {
                            try {
                                res = new DOMParser().parseFromString(this.responseText, mimeType);
                            } catch (e) {}
                        }
                    }
                    if (res) {
                        callback(null, res);
                    } else {
                        callback("Missing or malformed response: " + src);
                    }
                    break;
                case "json":
                    if (typeof this.response === "object") {
                        callback(null, this.response);
                    } else {
                        if (!!this.responseText) {
                            callback(null, JSON.parse(this.responseText));
                        } else {
                            callback("Missing responseText: " + src);
                        }
                    }
                    break;
                case "arraybuffer":
                    if (env.arraybuffer) {
                        if (this.response instanceof ArrayBuffer) {
                            callback(null, this.response);
                        } else {
                            callback("Malformed arraybuffer response: " + src);
                        }
                    } else {
                        callback("Your browser doesn't support responseType arraybuffer: " + src);
                    }
                    break;
                case "text":
                    if (typeof this.responseText === "string") {
                        callback(null, this.responseText);
                    } else {
                        callback("Malformed Response: " + src);
                    }
                    break;
                case "blob":
                    //TODO -- Implement?
                    break;
                }

            };
        }
        req.onload = complete();
        req.onerror = complete("error");
        req.ontimeout = complete("error");
        req.onabort = xhrCallbacks[(id = xhrId++)] = complete("abort");

        //Set request headers
        if (headers && !xdr) {
            for (var key in headers) {
                if (headers.hasOwnProperty(key)) {
                    req.setRequestHeader(key, headers[key]);
                }
            }
        }

        //Can throw an error in IE9
        try {
            req.send(data || null);
            return req;
        } catch (err) {
            callback("Error sending reqest: " + src);
        }
    }

    function encodePair (entry) {
        if (entry.value && entry.key) {
            return encodeURIComponent(entry.key.replace(" ", "+")) +
                "=" + encodeURIComponent(entry.value.toString().replace(" ", "+"));
        } else {
            return "";
        }
    }

    if (env.web) {
        /*Image.prototype.load = function (url, callback) {
            var that = this,
                xmlHTTP = new XMLHttpRequest();

            xmlHTTP.open("GET", url, true);
            xmlHTTP.responseType = "arraybuffer";

            xmlHTTP.onerror = function (e) {
                callback(e);
            };

            xmlHTTP.onload = function (e) {
                var h = xmlHTTP.getAllResponseHeaders(),
                    m = h.match(/^Content-Type\:\s*(.*?)$/mi),
                    mimeType = (m && m[1]) || "image/png";

                var blob = new Blob([this.response], {type: mimeType});
                that.src = window.URL.createObjectURL(blob);
                if (callback) {
                    callback(null, that);
                }
            };

            xmlHTTP.send();
            return xmlHTTP;
        };*/

        methods = {
            getScript: function (src, callback) {
                var deferred = task.deferred(),
                    _callback,
                    timeout,
                    s;

                callback = callback || _.noop;
                _callback = function (err, result) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve(result);
                    }
                    callback(result);
                };
                s = createScript(src, complete);
                document.head.appendChild(s);
                return deferred.promise;

                function complete (e) {
                    clear(s);
                    clearTimeout(timeout);
                    document.head.removeChild(s);
                    e = e || {
                        type: "noenv"
                    };
                    switch (e.type) {
                    case "load":
                        _callback(null);
                        break;
                    case "error":
                        _callback("404 (not found): " + src);
                        break;
                    default:
                        _callback("Unknown Error: " + src);
                    }
                }
            },
            getDocument: function (src, callback) {
                var mimeType = /\.html/.test(src) ? "text/html" : /\.xml/.test(src) ? "text/xml" : "";
                return xhr(src, callback, "GET", "document", mimeType);
            },
            getJSON: function (src, callback) {
                var deferred = task.deferred();
                if (typeof callback === "function") {
                    return xhr(src, callback, "GET", "json");
                } else {
                    return task(function (resolve, reject) {
                        xhr(src, function (err, result) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(result);
                            }
                        }, "GET", "json");
                    });
                }
            },
            sendJSON: function (src, callback, data) {
                return xhr(src, callback, "POST", null, null, null, {
                    "Content-type": "application/json; charset=utf-8"
                }, JSON.stringify(data));
            }.autocurry(),
            getArrayBuffer: function (src, callback) {
                return xhr(src, callback, "GET", "arraybuffer");
            },
            getMIDI: function (src, callback) {
                return xhr(src, callback, "GET", "text", "text/plain", "text/plain; charset=x-user-defined");
            },
            getImg: function (src, callback) {
                if (typeof callbck === "function") {
                    var img = new Image();
                    img.onload = function () {
                        callback(null, img);
                    };
                    img.onerror = function (err) {
                        callback(err);
                    };
                    img.src = src;
                    return img;
                } else {
                    return task(function (resolve, reject) {
                        var img = new Image();
                        img.onload = function () {
                            resolve(img);
                        };
                        img.onerror = reject;
                        img.src = src;
                    });
                }
            },
            getText: function (src, callback) {
                return xhr(src, callback, "GET", "text", "text/plain");
            },
            post: function (headers, src, callback, data) {
                return xhr(src, callback || _.noop, "POST", null, null, null, headers, data);
            },
            encodeQuery: function (data) {
                if (_.isObject(data)) {
                    _.toArray(data).map(encodePair).join("&");
                } else {
                    dmaf.error("encodeQuery: Missing parameters");
                    return "";
                }
            },
            href: function (url) {
                var re = /(?:\?|&(?:amp;)?)([^=&#]+)(?:=?([^&#]*))/g,
                    url = window.location.href,
                    params = {},
                    match = re.exec(url);

                function decode (s) {
                    return decodeURIComponent(s.replace(/\+/g, " "));
                }
                while (match) {
                    params[decode(match[1])] = decode(match[2]);
                    match = re.exec(url);
                }
                return params;
            },
            xhr: xhr
        };
        host = new RegExp(location.hostname || location.host);
        head = document.head || document.querySelector("head");
        xhrCallbacks = {};
        // Support: IE9
        // We need to keep track of outbound xhr and abort them manually
        // because IE is not smart enough to do it all by itself
        if ("ActiveXObject" in window) {
            window.addEventListener("unload", onunload);
        }
    } else {
        methods = {
            getScript: function (src, callback) {
                require(src);
                callback(null);
            },
            getJSON: function (src, callback) {
                var res = require(src);
                if (res) {
                    callback(null, res);
                } else {
                    callback("File not found");
                }
            }
        };
    }
    _.extend(_, methods);
});

dmaf("async", ["_"], function async (_) {
    var async = {
        each: function (x, iterator, callback) {
            var length = _.isArray(x) ? x.length : Object.keys(x).length,
                index = 0;

            callback = callback || _.noop;

            _.each(function (arg) {
                iterator(arg, _.onlyOnce(function (error) {
                    if (error) {
                        callback(error);
                        callback = _.noop;
                    } else {
                        return ++index >= length ? callback(null) : null;
                    }
                }));
            }, x);
        },
        eachSeries: function (x, iterator, callback) {
            var isArray = _.isArray(x),
                index = 0,
                length,
                keys;

            if (isArray) {
                length = x.length;
            } else {
                keys = Object.keys(x);
                length = keys.length;
            }
            callback = callback || _.noop;
            function next () {
                iterator(x[isArray ? index : x[keys[index]]], function (err) {
                    if (err) {
                        callback(err);
                        callback = _.noop;
                    } else {
                        return ++index >= length ? callback(null) : next();
                    }
                });
            }
            next();
        },
        iterator: function (tasks) {
            function makeCallback (index) {
                function f () {
                    if (tasks.length) {
                        tasks[index].apply(null, arguments);
                    }
                    return f.next();
                }
                f.next = function () {
                    return (index < tasks.length - 1) ? makeCallback(index + 1) : null;
                };
                return f;
            }
            return makeCallback(0);
        },
        map: parallel(asyncMap),
        mapSeries: series(asyncMap),
        parallel: function (tasks, callback) {
            parallelTasks({
                map: async.map,
                each: async.each
            }, tasks, callback);
        },
        series: function (tasks, callback) {
            callback = callback || _.noop;
            if (_.isArray(tasks)) {
                async.mapSeries(tasks, function (f, callback) {
                    if (f) {
                        f(function (error) {
                            var args = _.slice(arguments, 1);
                            if (args.length <= 1) {
                                args = args[0];
                            }
                            callback.call(null, error, args);
                        });
                    }
                }, callback);
            } else {
                var results = {};
                async.eachSeries(Object.keys(tasks), function (key, callback) {
                    tasks[key](function (error) {
                        var args = _.slice(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        results[key] = args;
                        callback(error);
                    });
                }, function (error) {
                    callback(error, results);
                });
            }
        },
        waterfall: function (tasks, callback) {
            callback = callback || _.noop;
            if (!tasks || !tasks.length) {
                return callback();
            }
            var wrapIterator = function (iterator) {
                return function (error) {
                    if (error) {
                        callback.apply(null, arguments);
                        callback = _.noop;
                    } else {
                        var args = _.slice(arguments, 1),
                            next = iterator.next();
                        if (next) {
                            args.push(wrapIterator(next));
                        } else {
                            args.push(callback);
                        }
                        _.setImmediate(function () {
                            iterator.apply(null, args);
                        });
                    }
                };
            };
            wrapIterator(async.iterator(tasks))();
        }
    };

    function parallel(f) {
        return function () {
            return f.apply(null, [async.each].concat(_.slice(arguments)));
        };
    }

    function series(f) {
        return function () {
            return f.apply(null, [async.eachSeries].concat(_.slice(arguments)));
        };
    }

    function asyncMap(eachf, x, iterator, callback) {
        var results;
        if (_.isArray(x)) {
            results = [];
            x = _.mapToObj(x);
            eachf(x, function (el, callback) {
                iterator(el.value, function (error, value) {
                    results[el.index] = value;
                    callback(error);
                });
            }, function (error) {
                callback(error, results);
            });
        } else {
            results = {};
            x = _.map(function (value, key) {
                return {
                    value: value,
                    key: key
                };
            }, x);
            eachf(x, function (el, callback) {
                iterator(el.value, function (error, value) {
                    results[el.key] = value;
                    callback(error);
                });
            }, function (error) {
                callback(error, results);
            });
        }
    }

    function parallelTasks(eachf, tasks, callback) {
        callback = callback || _.noop;
        if (_.isArray(tasks)) {
            eachf.map(tasks, function (f, callback) {
                if (f) {
                    f(function (error) {
                        var args = _.slice(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, error, args);
                    });
                }
            }, callback);
        } else {
            var results = {};
            eachf.each(Object.keys(tasks), function (k, callback) {
                tasks[k](function (error) {
                    var args = _.slice(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(error);
                });
            }, function (error) {
                callback(error, results);
            });
        }
    }
    return async;
});
dmaf.core.require("ajax");
