"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
module.exports = function init(_a) {
    var logger;
    return {
        create: function (info) {
            logger = info.project.projectService.logger;
            info.project.projectService.logger.info("[abracadabra] Hello from Abracadabra ts-server-plugin 👋");
            // typescript.
            // info.
            // Set up decorator object
            var proxy = Object.create(null);
            var _loop_1 = function (k) {
                var x = info.languageService[k];
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return x.apply(info.languageService, args);
                };
            };
            for (var _i = 0, _a = Object.keys(info.languageService); _i < _a.length; _i++) {
                var k = _a[_i];
                _loop_1(k);
            }
            // Remove specified entries from completion list
            proxy.getCompletionsAtPosition = function (fileName, position, options) {
                var prior = info.languageService.getCompletionsAtPosition(fileName, position, options);
                if (!prior)
                    return;
                info.project.projectService.logger.info("[abracadabra] I read your completion entries: " + prior.entries
                    .map(function (e) { return e.name; })
                    .join(", "));
                prior.entries = prior.entries.map(function (e) { return (__assign(__assign({}, e), { name: "MAGIC \u2728 " + e.name })); });
                return prior;
            };
            return proxy;
        },
        onConfigurationChanged: function (config) {
            // Receive configuration changes sent from VS Code
            if (logger) {
                logger.info("[abracadabra] Received config!");
                logger.info("[abracadabra] " + config.someValue);
                logger.info("[abracadabra] " + typeof config.someFunction + " => " + config.someFunction("hello"));
            }
        }
    };
};
