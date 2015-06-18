"use-strict";
var section = require("../../components/section"),
    framework = require("../../framework"),
    $ = require("jquery"),
    _ = require("../../libs/util");



module.exports = section({
    name: "landing",
    resize: function resize (w, h) {
        // original image dimentions 1440 × 938
        if (/*w < 800*/true) {
            return;
        }
        requestAnimationFrame(function () {
            var scalar = h / 938;
            var bgH = h;
            var bgW = 1440 * scalar;
            var top = 0;
            var left = -((bgW - w) / 2);
            if (bgW < w) {
                scalar = w / 1440;
                bgW = w;
                bgH = h * scalar;
                top = -((bgH - h) / 2);
                left = 0;
            }
            $(".landing").css({
                "backgroundSize": bgW + "px " + bgH + "px",
                "backgroundPosition": left + "px " + top + "px"
            });
        });
    },
    animateIn: function animateIn (req, done) {
        this.compile();
        this.appendToDom();
        $("body").scrollTop(1);
        done();
    }
});
