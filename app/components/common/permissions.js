"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dialogs = require("ui/dialogs");
var URI = require("urijs");
var applicationSettings = require("application-settings");
var AppViewModel_1 = require("./AppViewModel");
var argon_1 = require("@argonjs/argon");
var PERMISSION_KEY = 'permission_history';
exports.PermissionNames = {
    'geolocation': 'Location',
    'camera': 'Camera',
    'world-structure': 'Structural mesh'
};
exports.PermissionDescriptions = {
    'geolocation': 'your location',
    'camera': 'your camera',
    'world-structure': 'the structure of your surroundings'
};
var PermissionManager = (function () {
    function PermissionManager() {
        var _this = this;
        this.permissionMap = {}; // Key: identifier(=hostname+port), Value: List of Permissions
        this.lastUsedOptions = {}; // Key: identifier(=hostname+port), Value: List of last used Options
        this.getPermissionFromMap = function (identifier, type) {
            var newPermissionMapping = _this.permissionMap[identifier];
            if (newPermissionMapping) {
                var newPermissionMap = newPermissionMapping[type];
                if (newPermissionMap) {
                    return newPermissionMap.state;
                }
            }
            return argon_1.PermissionState.PROMPT; //Default to prompt if the permissions has not been asked before
        };
        this.savePermissionOnMap = function (identifier, type, newState) {
            var newPermissionMapping = _this.permissionMap[identifier] || {};
            newPermissionMapping[type] = new argon_1.Permission(type, newState);
            _this.permissionMap[identifier] = newPermissionMapping;
            _this.savePermissionsOnApp();
        };
        this.loadPermissionsToUI = function (uri) {
            // clear permission icons
            for (var i in AppViewModel_1.appViewModel.permissions) {
                AppViewModel_1.appViewModel.setPermission(new argon_1.Permission(i, argon_1.PermissionState.NOT_REQUIRED));
            }
            if (uri) {
                var identifier = URI(uri).hostname() + URI(uri).port();
                if (identifier) {
                    // load permissions to UI from map
                    for (var type in _this.permissionMap[identifier]) {
                        AppViewModel_1.appViewModel.setPermission(_this.permissionMap[identifier][type]);
                    }
                }
            }
        };
        // Initially load permissions to map from local storage
        if (applicationSettings.hasKey(PERMISSION_KEY)) {
            this.permissionMap = JSON.parse(applicationSettings.getString(PERMISSION_KEY));
            // console.log("Permissions loaded from storage: " + applicationSettings.getString(PERMISSION_KEY));
        }
    }
    PermissionManager.prototype.handlePermissionRequest = function (session, id, options) {
        var _this = this;
        // Always allow when the request is about Vuforia subscriptions & manager subscriptions
        if ((id !== 'ar.stage' && id !== 'camera' && id !== 'world-structure') || session.uri === 'argon:manager')
            return Promise.resolve();
        id = id === 'ar.stage' ? 'geolocation' : id;
        var type = id;
        console.log("Permission requested {Source: " + session.uri + ", Type: " + type + "}");
        if (session.uri === undefined)
            return Promise.reject(new Error("Invalid uri for permission request"));
        var hostname = URI(session.uri).hostname();
        var port = URI(session.uri).port();
        var identifier = hostname + port;
        var requestedPermission = new argon_1.Permission(type, this.getPermissionFromMap(identifier, type));
        this.saveLastUsedOption(session.uri, requestedPermission.type, options);
        if (requestedPermission.state === argon_1.PermissionState.PROMPT || requestedPermission.state === argon_1.PermissionState.NOT_REQUIRED) {
            return dialogs.confirm({
                title: exports.PermissionNames[requestedPermission.type] + " Request",
                message: "Will you allow " + hostname + (port ? (":" + port) : "") + " to access " + exports.PermissionDescriptions[requestedPermission.type] + "?",
                cancelButtonText: "Not now",
                neutralButtonText: "Deny access",
                okButtonText: "Grant access"
            }).then(function (result) {
                var newState;
                if (result === undefined) {
                    newState = argon_1.PermissionState.DENIED;
                }
                else if (result) {
                    newState = argon_1.PermissionState.GRANTED;
                }
                else {
                    newState = argon_1.PermissionState.PROMPT;
                }
                console.log("Permission request for : " + exports.PermissionNames[requestedPermission.type] + " -> resulted in : " + argon_1.PermissionState[newState]);
                _this.savePermissionOnMap(identifier, requestedPermission.type, newState);
                AppViewModel_1.appViewModel.setPermission(new argon_1.Permission(requestedPermission.type, newState));
                switch (newState) {
                    case argon_1.PermissionState.GRANTED:
                        return Promise.resolve();
                    case argon_1.PermissionState.DENIED:
                    case argon_1.PermissionState.PROMPT:
                        return Promise.reject(new Error("Permission denied by user"));
                    default:
                        return Promise.reject(new Error("Permission not handled properly!"));
                }
            });
        }
        else {
            console.log("Permission request for : " + exports.PermissionNames[requestedPermission.type] + " -> resulted in : " + argon_1.PermissionState[requestedPermission.state] + " (no change)");
            AppViewModel_1.appViewModel.setPermission(requestedPermission);
            switch (requestedPermission.state) {
                case argon_1.PermissionState.GRANTED:
                    return Promise.resolve();
                case argon_1.PermissionState.DENIED:
                    return Promise.reject(new Error("Permission has not been granted"));
            }
        }
        return Promise.reject(new Error("Permission not handled properly!"));
    };
    // public handlePermissionRevoke(session: SessionPort, id: string) {
    //     console.log("Handle permission revoke");
    //     if (request.uri === undefined) return Promise.reject(new Error("Illegal URI when requesting permission revoke."));
    //     const hostname = URI(request.uri).hostname();
    //     // const newPermissionItem = PermissionManager.permissionMap.get(hostname + request.type);
    //     // if (newPermissionItem === undefined) return Promise.reject(new Error("Requested revoke on not given permission! "));
    //     // let i = PermissionManager.permissionList.indexOf(<PermissionItem>newPermissionItem)
    //     // let currentState = PermissionManager.permissionList.getItem(i).state;
    //     const savePermission = (type:string, hostname:string, newState: PermissionState) => {
    //         const newPermissionItem = PermissionManager.permissionMap.get(hostname+type);
    //         if (newPermissionItem) {
    //             let i = PermissionManager.permissionList.indexOf(newPermissionItem);
    //             PermissionManager.permissionList.getItem(i).state = newState;
    //         } else {
    //             PermissionManager.permissionList.push(new PermissionItem({
    //                 hostname: hostname,
    //                 type: type,
    //                 state: newState
    //             }))
    //         }
    //     }
    //     savePermission(request.type, hostname, PermissionState.Denied);  // save using hostname & permission type
    //     appViewModel.setPermission({type: request.type, state: PermissionState.Denied});
    //     return Promise.resolve();
    // }
    PermissionManager.prototype.savePermissionsOnApp = function () {
        applicationSettings.setString(PERMISSION_KEY, JSON.stringify(this.permissionMap));
    };
    PermissionManager.prototype.getPermissionStateBySession = function (session, type) {
        if (session && session.uri && session.uri != "") {
            var identifier = URI(session.uri).hostname() + URI(session.uri).port();
            ;
            var state = this.getPermissionFromMap(identifier, type);
            return state;
        }
        return argon_1.PermissionState.NOT_REQUIRED;
    };
    PermissionManager.prototype.saveLastUsedOption = function (uri, type, option) {
        var identifier = URI(uri).hostname() + URI(uri).port();
        var tempMap = this.lastUsedOptions[identifier] || {};
        tempMap[type] = option;
        this.lastUsedOptions[identifier] = tempMap;
    };
    PermissionManager.prototype.getLastUsedOption = function (uri, type) {
        if (uri) {
            var identifier = URI(uri).hostname() + URI(uri).port();
            return this.lastUsedOptions[identifier][type];
        }
    };
    return PermissionManager;
}());
exports.permissionManager = new PermissionManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwZXJtaXNzaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9DQUFzQztBQUN0QywyQkFBNkI7QUFDN0IsMERBQTZEO0FBQzdELCtDQUE0QztBQUM1Qyx3Q0FLdUI7QUFFdkIsSUFBTSxjQUFjLEdBQUcsb0JBQW9CLENBQUM7QUFFL0IsUUFBQSxlQUFlLEdBQUc7SUFDdkIsYUFBYSxFQUFFLFVBQVU7SUFDekIsUUFBUSxFQUFFLFFBQVE7SUFDbEIsaUJBQWlCLEVBQUUsaUJBQWlCO0NBQ3ZDLENBQUM7QUFFTyxRQUFBLHNCQUFzQixHQUFHO0lBQzlCLGFBQWEsRUFBRSxlQUFlO0lBQzlCLFFBQVEsRUFBRSxhQUFhO0lBQ3ZCLGlCQUFpQixFQUFFLG9DQUFvQztDQUMxRCxDQUFDO0FBRU47SUFHSTtRQUFBLGlCQU1DO1FBUk8sa0JBQWEsR0FBRyxFQUFFLENBQUMsQ0FBUyw4REFBOEQ7UUFDMUYsb0JBQWUsR0FBRyxFQUFFLENBQUMsQ0FBUSxvRUFBb0U7UUFzRXpHLHlCQUFvQixHQUFHLFVBQUMsVUFBa0IsRUFBRSxJQUFvQjtZQUM1RCxJQUFNLG9CQUFvQixHQUFHLEtBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDNUQsRUFBRSxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO2dCQUN2QixJQUFNLGdCQUFnQixHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNwRCxFQUFFLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7b0JBQ25CLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7Z0JBQ2xDLENBQUM7WUFDTCxDQUFDO1lBQ0QsTUFBTSxDQUFDLHVCQUFlLENBQUMsTUFBTSxDQUFDLENBQUksZ0VBQWdFO1FBQ3RHLENBQUMsQ0FBQTtRQUVELHdCQUFtQixHQUFHLFVBQUMsVUFBaUIsRUFBRSxJQUFv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SUFvS0M7QUFFWSxRQUFBLGlCQUFpQixHQUFHLElBQUksaUJBQWlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkaWFsb2dzIGZyb20gJ3VpL2RpYWxvZ3MnO1xyXG5pbXBvcnQgKiBhcyBVUkkgZnJvbSAndXJpanMnO1xyXG5pbXBvcnQgYXBwbGljYXRpb25TZXR0aW5ncyA9IHJlcXVpcmUoJ2FwcGxpY2F0aW9uLXNldHRpbmdzJyk7XHJcbmltcG9ydCB7YXBwVmlld01vZGVsfSBmcm9tICcuL0FwcFZpZXdNb2RlbCc7XHJcbmltcG9ydCB7XHJcbiAgICBTZXNzaW9uUG9ydCxcclxuICAgIFBlcm1pc3Npb24sXHJcbiAgICBQZXJtaXNzaW9uVHlwZSxcclxuICAgIFBlcm1pc3Npb25TdGF0ZVxyXG59IGZyb20gJ0BhcmdvbmpzL2FyZ29uJ1xyXG5cclxuY29uc3QgUEVSTUlTU0lPTl9LRVkgPSAncGVybWlzc2lvbl9oaXN0b3J5JztcclxuXHJcbmV4cG9ydCBjb25zdCBQZXJtaXNzaW9uTmFtZXMgPSB7XHJcbiAgICAgICAgJ2dlb2xvY2F0aW9uJzogJ0xvY2F0aW9uJyxcclxuICAgICAgICAnY2FtZXJhJzogJ0NhbWVyYScsXHJcbiAgICAgICAgJ3dvcmxkLXN0cnVjdHVyZSc6ICdTdHJ1Y3R1cmFsIG1lc2gnXHJcbiAgICB9O1xyXG5cclxuZXhwb3J0IGNvbnN0IFBlcm1pc3Npb25EZXNjcmlwdGlvbnMgPSB7XHJcbiAgICAgICAgJ2dlb2xvY2F0aW9uJzogJ3lvdXIgbG9jYXRpb24nLCBcclxuICAgICAgICAnY2FtZXJhJzogJ3lvdXIgY2FtZXJhJyxcclxuICAgICAgICAnd29ybGQtc3RydWN0dXJlJzogJ3RoZSBzdHJ1Y3R1cmUgb2YgeW91ciBzdXJyb3VuZGluZ3MnXHJcbiAgICB9O1xyXG5cclxuY2xhc3MgUGVybWlzc2lvbk1hbmFnZXIge1xyXG4gICAgcHJpdmF0ZSBwZXJtaXNzaW9uTWFwID0ge307ICAgICAgICAgLy8gS2V5OiBpZGVudGlmaWVyKD1ob3N0bmFtZStwb3J0KSwgVmFsdWU6IExpc3Qgb2YgUGVybWlzc2lvbnNcclxuICAgIHByaXZhdGUgbGFzdFVzZWRPcHRpb25zID0ge307ICAgICAgICAvLyBLZXk6IGlkZW50aWZpZXIoPWhvc3RuYW1lK3BvcnQpLCBWYWx1ZTogTGlzdCBvZiBsYXN0IHVzZWQgT3B0aW9uc1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgLy8gSW5pdGlhbGx5IGxvYWQgcGVybWlzc2lvbnMgdG8gbWFwIGZyb20gbG9jYWwgc3RvcmFnZVxyXG4gICAgICAgIGlmIChhcHBsaWNhdGlvblNldHRpbmdzLmhhc0tleShQRVJNSVNTSU9OX0tFWSkpIHtcclxuICAgICAgICAgICAgdGhpcy5wZXJtaXNzaW9uTWFwID0gSlNPTi5wYXJzZShhcHBsaWNhdGlvblNldHRpbmdzLmdldFN0cmluZyhQRVJNSVNTSU9OX0tFWSkpO1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlBlcm1pc3Npb25zIGxvYWRlZCBmcm9tIHN0b3JhZ2U6IFwiICsgYXBwbGljYXRpb25TZXR0aW5ncy5nZXRTdHJpbmcoUEVSTUlTU0lPTl9LRVkpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaGFuZGxlUGVybWlzc2lvblJlcXVlc3Qoc2Vzc2lvbjogU2Vzc2lvblBvcnQsIGlkOiBzdHJpbmcsIG9wdGlvbnM6IGFueSkge1xyXG4gICAgICAgIC8vIEFsd2F5cyBhbGxvdyB3aGVuIHRoZSByZXF1ZXN0IGlzIGFib3V0IFZ1Zm9yaWEgc3Vic2NyaXB0aW9ucyAmIG1hbmFnZXIgc3Vic2NyaXB0aW9uc1xyXG4gICAgICAgIGlmICgoaWQgIT09ICdhci5zdGFnZScgJiYgaWQgIT09ICdjYW1lcmEnICYmIGlkICE9PSd3b3JsZC1zdHJ1Y3R1cmUnKSB8fCBzZXNzaW9uLnVyaSA9PT0gJ2FyZ29uOm1hbmFnZXInKVxyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcblxyXG4gICAgICAgIGlkID0gaWQgPT09ICdhci5zdGFnZScgPyAnZ2VvbG9jYXRpb24nIDogaWQ7XHJcbiAgICAgICAgbGV0IHR5cGU6IFBlcm1pc3Npb25UeXBlID0gPFBlcm1pc3Npb25UeXBlPmlkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiUGVybWlzc2lvbiByZXF1ZXN0ZWQge1NvdXJjZTogXCIgKyBzZXNzaW9uLnVyaSArIFwiLCBUeXBlOiBcIiArIHR5cGUgKyBcIn1cIik7XHJcblxyXG4gICAgICAgIGlmIChzZXNzaW9uLnVyaSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiSW52YWxpZCB1cmkgZm9yIHBlcm1pc3Npb24gcmVxdWVzdFwiKSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGhvc3RuYW1lID0gVVJJKHNlc3Npb24udXJpKS5ob3N0bmFtZSgpO1xyXG4gICAgICAgIGNvbnN0IHBvcnQgPSBVUkkoc2Vzc2lvbi51cmkpLnBvcnQoKTtcclxuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gaG9zdG5hbWUgKyBwb3J0O1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3RlZFBlcm1pc3Npb24gPSBuZXcgUGVybWlzc2lvbih0eXBlLCB0aGlzLmdldFBlcm1pc3Npb25Gcm9tTWFwKGlkZW50aWZpZXIsIHR5cGUpKTtcclxuICAgICAgICB0aGlzLnNhdmVMYXN0VXNlZE9wdGlvbihzZXNzaW9uLnVyaSwgcmVxdWVzdGVkUGVybWlzc2lvbi50eXBlLCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgaWYgKHJlcXVlc3RlZFBlcm1pc3Npb24uc3RhdGUgPT09IFBlcm1pc3Npb25TdGF0ZS5QUk9NUFQgfHwgcmVxdWVzdGVkUGVybWlzc2lvbi5zdGF0ZSA9PT0gUGVybWlzc2lvblN0YXRlLk5PVF9SRVFVSVJFRCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZGlhbG9ncy5jb25maXJtKHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBQZXJtaXNzaW9uTmFtZXNbcmVxdWVzdGVkUGVybWlzc2lvbi50eXBlXSArIFwiIFJlcXVlc3RcIixcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiV2lsbCB5b3UgYWxsb3cgXCIgKyBob3N0bmFtZSArICggcG9ydCA/IChcIjpcIiArIHBvcnQpOlwiXCIpICsgXCIgdG8gYWNjZXNzIFwiICsgUGVybWlzc2lvbkRlc2NyaXB0aW9uc1tyZXF1ZXN0ZWRQZXJtaXNzaW9uLnR5cGVdICsgXCI/XCIsXHJcbiAgICAgICAgICAgICAgICBjYW5jZWxCdXR0b25UZXh0OiBcIk5vdCBub3dcIixcclxuICAgICAgICAgICAgICAgIG5ldXRyYWxCdXR0b25UZXh0OiBcIkRlbnkgYWNjZXNzXCIsXHJcbiAgICAgICAgICAgICAgICBva0J1dHRvblRleHQ6IFwiR3JhbnQgYWNjZXNzXCJcclxuICAgICAgICAgICAgfSkudGhlbihyZXN1bHQgPT4ge1xyXG4gICAgICAgICAgICAgICAgbGV0IG5ld1N0YXRlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7IC8vIG5ldXRyYWwgYnV0dG9uICgybmQgYnV0dG9uIG9uIGlPUylcclxuICAgICAgICAgICAgICAgICAgICBuZXdTdGF0ZSA9IFBlcm1pc3Npb25TdGF0ZS5ERU5JRUQ7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkgeyAgICAgICAgLy8gb2sgYnV0dG9uICgzcmQgYnV0dG9uIG9uIGlPUylcclxuICAgICAgICAgICAgICAgICAgICBuZXdTdGF0ZSA9IFBlcm1pc3Npb25TdGF0ZS5HUkFOVEVEO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgICAgICAgICAgICAgICAgICAgIC8vIGNhbmNlbCBidXR0b24gKDFzdCBidXR0b24gb24gaU9TKVxyXG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXRlID0gUGVybWlzc2lvblN0YXRlLlBST01QVDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUGVybWlzc2lvbiByZXF1ZXN0IGZvciA6IFwiICsgUGVybWlzc2lvbk5hbWVzW3JlcXVlc3RlZFBlcm1pc3Npb24udHlwZV0gKyBcIiAtPiByZXN1bHRlZCBpbiA6IFwiICsgUGVybWlzc2lvblN0YXRlW25ld1N0YXRlXSlcclxuICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVBlcm1pc3Npb25Pbk1hcChpZGVudGlmaWVyLCByZXF1ZXN0ZWRQZXJtaXNzaW9uLnR5cGUsIG5ld1N0YXRlKTtcclxuICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zZXRQZXJtaXNzaW9uKG5ldyBQZXJtaXNzaW9uKHJlcXVlc3RlZFBlcm1pc3Npb24udHlwZSwgbmV3U3RhdGUpKTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaChuZXdTdGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgUGVybWlzc2lvblN0YXRlLkdSQU5URUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFBlcm1pc3Npb25TdGF0ZS5ERU5JRUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBQZXJtaXNzaW9uU3RhdGUuUFJPTVBUOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiUGVybWlzc2lvbiBkZW5pZWQgYnkgdXNlclwiKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIlBlcm1pc3Npb24gbm90IGhhbmRsZWQgcHJvcGVybHkhXCIpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJQZXJtaXNzaW9uIHJlcXVlc3QgZm9yIDogXCIgKyBQZXJtaXNzaW9uTmFtZXNbcmVxdWVzdGVkUGVybWlzc2lvbi50eXBlXSArIFwiIC0+IHJlc3VsdGVkIGluIDogXCIgKyBQZXJtaXNzaW9uU3RhdGVbcmVxdWVzdGVkUGVybWlzc2lvbi5zdGF0ZV0gKyBcIiAobm8gY2hhbmdlKVwiKVxyXG4gICAgICAgICAgICBhcHBWaWV3TW9kZWwuc2V0UGVybWlzc2lvbihyZXF1ZXN0ZWRQZXJtaXNzaW9uKTtcclxuICAgICAgICAgICAgc3dpdGNoKHJlcXVlc3RlZFBlcm1pc3Npb24uc3RhdGUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgUGVybWlzc2lvblN0YXRlLkdSQU5URUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBQZXJtaXNzaW9uU3RhdGUuREVOSUVEOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJQZXJtaXNzaW9uIGhhcyBub3QgYmVlbiBncmFudGVkXCIpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiUGVybWlzc2lvbiBub3QgaGFuZGxlZCBwcm9wZXJseSFcIikpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBlcm1pc3Npb25Gcm9tTWFwID0gKGlkZW50aWZpZXI6IHN0cmluZywgdHlwZTogUGVybWlzc2lvblR5cGUpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdQZXJtaXNzaW9uTWFwcGluZyA9IHRoaXMucGVybWlzc2lvbk1hcFtpZGVudGlmaWVyXTtcclxuICAgICAgICBpZiAobmV3UGVybWlzc2lvbk1hcHBpbmcpIHtcclxuICAgICAgICAgICAgY29uc3QgbmV3UGVybWlzc2lvbk1hcCA9IG5ld1Blcm1pc3Npb25NYXBwaW5nW3R5cGVdO1xyXG4gICAgICAgICAgICBpZiAobmV3UGVybWlzc2lvbk1hcCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ld1Blcm1pc3Npb25NYXAuc3RhdGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFBlcm1pc3Npb25TdGF0ZS5QUk9NUFQ7ICAgIC8vRGVmYXVsdCB0byBwcm9tcHQgaWYgdGhlIHBlcm1pc3Npb25zIGhhcyBub3QgYmVlbiBhc2tlZCBiZWZvcmVcclxuICAgIH1cclxuXHJcbiAgICBzYXZlUGVybWlzc2lvbk9uTWFwID0gKGlkZW50aWZpZXI6c3RyaW5nLCB0eXBlOiBQZXJtaXNzaW9uVHlwZSwgbmV3U3RhdGU6IFBlcm1pc3Npb25TdGF0ZSkgPT4ge1xyXG4gICAgICAgIGxldCBuZXdQZXJtaXNzaW9uTWFwcGluZyA9IHRoaXMucGVybWlzc2lvbk1hcFtpZGVudGlmaWVyXSB8fCB7fTtcclxuICAgICAgICBuZXdQZXJtaXNzaW9uTWFwcGluZ1t0eXBlXSA9IG5ldyBQZXJtaXNzaW9uKHR5cGUsIG5ld1N0YXRlKTtcclxuICAgICAgICB0aGlzLnBlcm1pc3Npb25NYXBbaWRlbnRpZmllcl0gPSBuZXdQZXJtaXNzaW9uTWFwcGluZztcclxuICAgICAgICB0aGlzLnNhdmVQZXJtaXNzaW9uc09uQXBwKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcHVibGljIGhhbmRsZVBlcm1pc3Npb25SZXZva2Uoc2Vzc2lvbjogU2Vzc2lvblBvcnQsIGlkOiBzdHJpbmcpIHtcclxuICAgIC8vICAgICBjb25zb2xlLmxvZyhcIkhhbmRsZSBwZXJtaXNzaW9uIHJldm9rZVwiKTtcclxuICAgICAgICBcclxuICAgIC8vICAgICBpZiAocmVxdWVzdC51cmkgPT09IHVuZGVmaW5lZCkgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIklsbGVnYWwgVVJJIHdoZW4gcmVxdWVzdGluZyBwZXJtaXNzaW9uIHJldm9rZS5cIikpO1xyXG5cclxuICAgIC8vICAgICBjb25zdCBob3N0bmFtZSA9IFVSSShyZXF1ZXN0LnVyaSkuaG9zdG5hbWUoKTtcclxuXHJcbiAgICAvLyAgICAgLy8gY29uc3QgbmV3UGVybWlzc2lvbkl0ZW0gPSBQZXJtaXNzaW9uTWFuYWdlci5wZXJtaXNzaW9uTWFwLmdldChob3N0bmFtZSArIHJlcXVlc3QudHlwZSk7XHJcbiAgICAvLyAgICAgLy8gaWYgKG5ld1Blcm1pc3Npb25JdGVtID09PSB1bmRlZmluZWQpIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJSZXF1ZXN0ZWQgcmV2b2tlIG9uIG5vdCBnaXZlbiBwZXJtaXNzaW9uISBcIikpO1xyXG4gICAgLy8gICAgIC8vIGxldCBpID0gUGVybWlzc2lvbk1hbmFnZXIucGVybWlzc2lvbkxpc3QuaW5kZXhPZig8UGVybWlzc2lvbkl0ZW0+bmV3UGVybWlzc2lvbkl0ZW0pXHJcbiAgICAvLyAgICAgLy8gbGV0IGN1cnJlbnRTdGF0ZSA9IFBlcm1pc3Npb25NYW5hZ2VyLnBlcm1pc3Npb25MaXN0LmdldEl0ZW0oaSkuc3RhdGU7XHJcblxyXG4gICAgLy8gICAgIGNvbnN0IHNhdmVQZXJtaXNzaW9uID0gKHR5cGU6c3RyaW5nLCBob3N0bmFtZTpzdHJpbmcsIG5ld1N0YXRlOiBQZXJtaXNzaW9uU3RhdGUpID0+IHtcclxuICAgIC8vICAgICAgICAgY29uc3QgbmV3UGVybWlzc2lvbkl0ZW0gPSBQZXJtaXNzaW9uTWFuYWdlci5wZXJtaXNzaW9uTWFwLmdldChob3N0bmFtZSt0eXBlKTtcclxuICAgIC8vICAgICAgICAgaWYgKG5ld1Blcm1pc3Npb25JdGVtKSB7XHJcbiAgICAvLyAgICAgICAgICAgICBsZXQgaSA9IFBlcm1pc3Npb25NYW5hZ2VyLnBlcm1pc3Npb25MaXN0LmluZGV4T2YobmV3UGVybWlzc2lvbkl0ZW0pO1xyXG4gICAgLy8gICAgICAgICAgICAgUGVybWlzc2lvbk1hbmFnZXIucGVybWlzc2lvbkxpc3QuZ2V0SXRlbShpKS5zdGF0ZSA9IG5ld1N0YXRlO1xyXG4gICAgLy8gICAgICAgICB9IGVsc2Uge1xyXG4gICAgLy8gICAgICAgICAgICAgUGVybWlzc2lvbk1hbmFnZXIucGVybWlzc2lvbkxpc3QucHVzaChuZXcgUGVybWlzc2lvbkl0ZW0oe1xyXG4gICAgLy8gICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBob3N0bmFtZSxcclxuICAgIC8vICAgICAgICAgICAgICAgICB0eXBlOiB0eXBlLFxyXG4gICAgLy8gICAgICAgICAgICAgICAgIHN0YXRlOiBuZXdTdGF0ZVxyXG4gICAgLy8gICAgICAgICAgICAgfSkpXHJcbiAgICAvLyAgICAgICAgIH1cclxuICAgIC8vICAgICB9XHJcblxyXG4gICAgLy8gICAgIHNhdmVQZXJtaXNzaW9uKHJlcXVlc3QudHlwZSwgaG9zdG5hbWUsIFBlcm1pc3Npb25TdGF0ZS5EZW5pZWQpOyAgLy8gc2F2ZSB1c2luZyBob3N0bmFtZSAmIHBlcm1pc3Npb24gdHlwZVxyXG4gICAgLy8gICAgIGFwcFZpZXdNb2RlbC5zZXRQZXJtaXNzaW9uKHt0eXBlOiByZXF1ZXN0LnR5cGUsIHN0YXRlOiBQZXJtaXNzaW9uU3RhdGUuRGVuaWVkfSk7XHJcbiAgICAvLyAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgLy8gfVxyXG5cclxuICAgIHByaXZhdGUgc2F2ZVBlcm1pc3Npb25zT25BcHAoKSB7ICAgIC8vc2F2ZSBwZXJtaXNzaW9ucyB0byBsb2NhbCBzdG9yYWdlXHJcbiAgICAgICAgYXBwbGljYXRpb25TZXR0aW5ncy5zZXRTdHJpbmcoUEVSTUlTU0lPTl9LRVksIEpTT04uc3RyaW5naWZ5KHRoaXMucGVybWlzc2lvbk1hcCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBlcm1pc3Npb25TdGF0ZUJ5U2Vzc2lvbihzZXNzaW9uOiBTZXNzaW9uUG9ydCwgdHlwZTogUGVybWlzc2lvblR5cGUpIHtcclxuICAgICAgICBpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLnVyaSAmJiBzZXNzaW9uLnVyaSAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBVUkkoc2Vzc2lvbi51cmkpLmhvc3RuYW1lKCkgKyBVUkkoc2Vzc2lvbi51cmkpLnBvcnQoKTs7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRQZXJtaXNzaW9uRnJvbU1hcChpZGVudGlmaWVyLCB0eXBlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gUGVybWlzc2lvblN0YXRlLk5PVF9SRVFVSVJFRDtcclxuICAgIH1cclxuXHJcbiAgICBsb2FkUGVybWlzc2lvbnNUb1VJID0gKHVyaT86IHN0cmluZykgPT4ge1xyXG4gICAgICAgIC8vIGNsZWFyIHBlcm1pc3Npb24gaWNvbnNcclxuICAgICAgICBmb3IgKGxldCBpIGluIGFwcFZpZXdNb2RlbC5wZXJtaXNzaW9ucykge1xyXG4gICAgICAgICAgICBhcHBWaWV3TW9kZWwuc2V0UGVybWlzc2lvbihuZXcgUGVybWlzc2lvbig8UGVybWlzc2lvblR5cGU+aSwgUGVybWlzc2lvblN0YXRlLk5PVF9SRVFVSVJFRCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHVyaSkge1xyXG4gICAgICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gVVJJKHVyaSkuaG9zdG5hbWUoKSArIFVSSSh1cmkpLnBvcnQoKTtcclxuICAgICAgICAgICAgaWYgKGlkZW50aWZpZXIpIHtcclxuICAgICAgICAgICAgICAgIC8vIGxvYWQgcGVybWlzc2lvbnMgdG8gVUkgZnJvbSBtYXBcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IHR5cGUgaW4gdGhpcy5wZXJtaXNzaW9uTWFwW2lkZW50aWZpZXJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXBwVmlld01vZGVsLnNldFBlcm1pc3Npb24odGhpcy5wZXJtaXNzaW9uTWFwW2lkZW50aWZpZXJdW3R5cGVdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzYXZlTGFzdFVzZWRPcHRpb24odXJpOiBzdHJpbmcsIHR5cGU6IFBlcm1pc3Npb25UeXBlLCBvcHRpb246IGFueSkge1xyXG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBVUkkodXJpKS5ob3N0bmFtZSgpICsgVVJJKHVyaSkucG9ydCgpO1xyXG4gICAgICAgIGxldCB0ZW1wTWFwID0gdGhpcy5sYXN0VXNlZE9wdGlvbnNbaWRlbnRpZmllcl0gfHwge307XHJcbiAgICAgICAgdGVtcE1hcFt0eXBlXSA9IG9wdGlvbjtcclxuICAgICAgICB0aGlzLmxhc3RVc2VkT3B0aW9uc1tpZGVudGlmaWVyXSA9IHRlbXBNYXA7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0TGFzdFVzZWRPcHRpb24odXJpOiBzdHJpbmd8dW5kZWZpbmVkLCB0eXBlOiBQZXJtaXNzaW9uVHlwZSkge1xyXG4gICAgICAgIGlmICh1cmkpIHtcclxuICAgICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IFVSSSh1cmkpLmhvc3RuYW1lKCkgKyBVUkkodXJpKS5wb3J0KCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxhc3RVc2VkT3B0aW9uc1tpZGVudGlmaWVyXVt0eXBlXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBwZXJtaXNzaW9uTWFuYWdlciA9IG5ldyBQZXJtaXNzaW9uTWFuYWdlcjsiXX0=