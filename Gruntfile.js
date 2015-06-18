module.exports = function (grunt) {
    var loader = require("load-grunt-tasks")(grunt);

    grunt.initConfig({
        config: {
            assets: "raw-assets",
            src: "src",
            dev: ".tmp",
            dist: "release",
            libs: "",
            remote: "104.131.144.64/dev/"
        },
        less: {
            dev: {
                files: {
                    "<%= config.dev %>/css/main.css": "<%= config.src %>/less/main.less"
                }
            },
            dist: {
                options: {
                    compress: true,
                    cleancss: true
                },
                files: {
                    "<%= config.dist %>/css/main.css": "<%= config.src %>/less/main.less"
                }
            }
        },
        browserify: {
            dev: {
                src: "index.js",
                dest: "<%= config.dev %>/js/bundle.js",
                options: {
                    debug: true,
                    watch: true,
                    verbose: true,
                    open: true,
                    browserifyOptions: {
                        debug: true
                    }
                }
            },
            dist: {
                src: "index.js",
                dest: "<%= config.dist %>/js/bundle.js",
                options: {
                    debug: false,
                    verbose: false
                }
            }
        },
        connect: {
            dev: {
                options: {
                    base: [
                        "<%= config.dev %>/",
                        "app/",
                        "*"
                    ],
                    keepalive: false,
                    hostname: "localhost"
                }
            }
        },
        pngmin: {
            dynamic: {
                options: {
                    force: true,
                    ext: ".png"
                },
                files: [{
                    expand: true,
                    cwd: "<%= config.dev %>/assets/images/",
                    src: [
                        "*.png",
                        "tp/*.png"
                    ],
                    dest: "<%= config.dist %>/assets/images/"
                }]
            }
        },
        handlebars: {
            all: {
                options: {
                    namespace: "templates",
                    commonjs: true,
                    processName: function (filePath) {
                        return filePath.replace(/.*\/(\w+)\/\w+\.hbs/, "$1");
                    }
                },
                files: {
                    "src/libs/templates.js": ["src/**/*.hbs"]
                }
            }
        },
        watch: {
            options: {
                livereload: true
            },
            less: {
                files: [
                    "<%= config.src %>/less/**/*.less",
                    "<%= config.src %>/sections/**/*.less",
                    "<%= config.src %>/components/**/*.less"
                ],
                tasks: ["less:dev"],
                options: {
                    livereload: false
                }
            },
            handlebars: {
                files: [
                    "<%= config.src %>/sections/**/*.hbs",
                    "<%= config.src %>/components/**/*.hbs"
                ],
                tasks: ["handlebars"]
            },
            browserify: {
                files: [
                    "<%= config.src %>/**/*.js",
                    "*.js"
                ],
                tasks: ["browserify:dev"]
            },
            assets: {
                files: ["<%= config.assets %>/**/*"],
                tasks: ["copy:dev"]
            },
            css: {
                files: ["<%= config.dev %>/css/*.css"]
            }
        },
        copy: {
            dev: {
                files: [{
                    expand: true,
                    cwd: "<%= config.assets %>/json/",
                    src: "**",
                    dest: "<%= config.dev %>/assets/json/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/images/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/images/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/sounds/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/sounds/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/videos/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/videos/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/midi/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/midi/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/bin/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/bin/"
                }, {
                    expand: true,
                    cwd: "<%= config.assets %>/fonts/",
                    src: ["**"],
                    dest: "<%= config.dev %>/assets/fonts/"
                }]
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: "<%= config.dev %>/assets/json/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/json/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/images/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/images/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/sounds/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/sounds/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/videos/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/videos/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/fonts/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/fonts/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/midi/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/midi/"
                }, {
                    expand: true,
                    cwd: "<%= config.dev %>/assets/bin/",
                    src: ["**"],
                    dest: "<%= config.dist %>/assets/bin/"
                }, {
                    expand: true,
                    cwd: "app/",
                    src: ["**"],
                    dest: "<%= config.dist %>"
                }]
            }
        }
    });
    grunt.registerTask("rsync", function () {
        console.log("starting sync with remote");
        var cmd = "rsync -vha ./release/ root@104.131.144.64:/var/www/html/dev/ && rm -rf ./release";
        var exec = require("child_process").exec;
        var sys = require("sys");
        var done = this.async();

        exec(cmd, callback);

        function callback (error, stdout, stderr) {
            console.log("rsync has completed");
            if (error === null) {
                if (stdout) {
                    console.log("stdout:\n" + stdout);
                }
                if (stderr) {
                    console.log("stderr:\n" + stderr);
                }
            } else {
                console.error("exec error", error);
            }
            done();
        }
    });
    grunt.registerTask("default", [
        "copy:dev",
        "browserify:dev",
        "less:dev",
        "connect",
        "handlebars",
        "watch"
    ]);
    grunt.registerTask("release", [
        "browserify:dist",
        "pngmin",
        "copy:dist",
        "less:dist",
        "rsync"
    ]);
};
