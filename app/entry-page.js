"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var frameModule = require("ui/frame");
var permissions = require("nativescript-permissions");
function pageLoaded(args) {
    return permissions.requestPermission("android.permission.CAMERA", "Your camera is used to provide an augmented reality experience")
        .then(function () {
        return permissions.requestPermission("android.permission.ACCESS_FINE_LOCATION", "TBD")
            .then(function () {
            startApp();
        })
            .catch(function (e) {
            console.log("Error on startApp: " + e);
            console.log(e.stack);
        });
    })
        .catch(function () {
        console.log("Camera permission refused, Vuforia will not initialize correctly");
        startApp();
    });
}
exports.pageLoaded = pageLoaded;
function startApp() {
    var topmost = frameModule.topmost();
    var navigationEntry = {
        moduleName: "main-page",
        backstackVisible: false
    };
    topmost.navigate(navigationEntry);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50cnktcGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVudHJ5LXBhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxzQ0FBeUM7QUFDekMsc0RBQXlEO0FBRXpELG9CQUEyQixJQUFJO0lBQzNCLE1BQU0sQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLEVBQUUsZ0VBQWdFLENBQUM7U0FDOUgsSUFBSSxDQUFDO1FBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyx5Q0FBeUMsRUFBRSxLQUFLLENBQUM7YUFDckYsSUFBSSxDQUFDO1lBQ0YsUUFBUSxFQUFFLENBQUM7UUFDZixDQUFDLENBQUM7YUFDRCxLQUFLLENBQUMsVUFBUyxDQUFDO1lBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN2QyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUMsQ0FBQztTQUNELEtBQUssQ0FBQztRQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsa0VBQWtFLENBQUMsQ0FBQztRQUNoRixRQUFRLEVBQUUsQ0FBQztJQUNmLENBQUMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQWhCRCxnQ0FnQkM7QUFFRDtJQUNJLElBQUksT0FBTyxHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNwQyxJQUFJLGVBQWUsR0FBRztRQUNsQixVQUFVLEVBQUUsV0FBVztRQUN2QixnQkFBZ0IsRUFBRSxLQUFLO0tBQzFCLENBQUM7SUFDRixPQUFPLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnJhbWVNb2R1bGUgPSByZXF1aXJlKFwidWkvZnJhbWVcIik7XHJcbmltcG9ydCBwZXJtaXNzaW9ucyA9IHJlcXVpcmUoJ25hdGl2ZXNjcmlwdC1wZXJtaXNzaW9ucycpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBhZ2VMb2FkZWQoYXJncykge1xyXG4gICAgcmV0dXJuIHBlcm1pc3Npb25zLnJlcXVlc3RQZXJtaXNzaW9uKFwiYW5kcm9pZC5wZXJtaXNzaW9uLkNBTUVSQVwiLCBcIllvdXIgY2FtZXJhIGlzIHVzZWQgdG8gcHJvdmlkZSBhbiBhdWdtZW50ZWQgcmVhbGl0eSBleHBlcmllbmNlXCIpXHJcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwZXJtaXNzaW9ucy5yZXF1ZXN0UGVybWlzc2lvbihcImFuZHJvaWQucGVybWlzc2lvbi5BQ0NFU1NfRklORV9MT0NBVElPTlwiLCBcIlRCRFwiKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHN0YXJ0QXBwKCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVycm9yIG9uIHN0YXJ0QXBwOiBcIiArIGUpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZS5zdGFjayk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNhbWVyYSBwZXJtaXNzaW9uIHJlZnVzZWQsIFZ1Zm9yaWEgd2lsbCBub3QgaW5pdGlhbGl6ZSBjb3JyZWN0bHlcIik7XHJcbiAgICAgICAgICAgIHN0YXJ0QXBwKCk7XHJcbiAgICAgICAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0YXJ0QXBwKCkge1xyXG4gICAgdmFyIHRvcG1vc3QgPSBmcmFtZU1vZHVsZS50b3Btb3N0KCk7XHJcbiAgICB2YXIgbmF2aWdhdGlvbkVudHJ5ID0ge1xyXG4gICAgICAgIG1vZHVsZU5hbWU6IFwibWFpbi1wYWdlXCIsXHJcbiAgICAgICAgYmFja3N0YWNrVmlzaWJsZTogZmFsc2VcclxuICAgIH07XHJcbiAgICB0b3Btb3N0Lm5hdmlnYXRlKG5hdmlnYXRpb25FbnRyeSk7XHJcbn1cclxuIl19