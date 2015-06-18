module.exports = {
    "/": {
        section: [
            require("../sections/landing"),
            require("../sections/nav")
        ]
    },
    "/phone": {
        section: [
            require("../sections/phone"),
            require("../sections/nav")
        ]
    },
    "/wake": {
        section: [
            require("../sections/wake"),
            require("../sections/nav")
        ]
    },
    "/stories": {
        section: [
            require("../sections/stories"),
            require("../sections/nav")
        ]
    }
};
