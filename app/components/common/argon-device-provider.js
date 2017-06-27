"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var application = require("application");
var utils = require("utils/utils");
var geolocation = require("speigg-nativescript-geolocation");
var dialogs = require("ui/dialogs");
var enums = require("ui/enums");
var platform = require("platform");
var vuforia = require("nativescript-vuforia");
var frames = require("ui/frame");
var Argon = require("@argonjs/argon");
var util_1 = require("./util");
var Cartesian3 = Argon.Cesium.Cartesian3;
var Quaternion = Argon.Cesium.Quaternion;
var CesiumMath = Argon.Cesium.CesiumMath;
var Matrix4 = Argon.Cesium.Matrix4;
var negX90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, -CesiumMath.PI_OVER_TWO);
var z90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, CesiumMath.PI_OVER_TWO);
var ONE = new Cartesian3(1, 1, 1);
var NativescriptDeviceService = (function (_super) {
    __extends(NativescriptDeviceService, _super);
    function NativescriptDeviceService(sessionService, entityService, viewService, visibilityService) {
        var _this = _super.call(this, sessionService, entityService, viewService, visibilityService) || this;
        _this._executeCallback = function (cb, now) {
            cb(now);
        };
        _this._application = application;
        _this._scratchDisplayOrientation = new Quaternion;
        _this._scratchDeviceOrientation = new Quaternion;
        _this._id = 0;
        _this._callbacks = {};
        _this._callbacks2 = {};
        _this.requestAnimationFrame = function (cb) {
            _this._id++;
            _this._callbacks[_this._id] = cb;
            return _this._id;
        };
        _this.cancelAnimationFrame = function (id) {
            delete _this._callbacks[id];
        };
        _this._motionQuaternionAndroid = new Quaternion;
        return _this;
    }
    NativescriptDeviceService.prototype.executeReqeustAnimationFrameCallbacks = function () {
        var now = global.performance.now();
        // swap callback maps
        var callbacks = this._callbacks;
        this._callbacks = this._callbacks2;
        this._callbacks2 = callbacks;
        for (var i in callbacks) {
            this._executeCallback(callbacks[i], now);
        }
        for (var i in callbacks) {
            delete callbacks[i];
        }
    };
    Object.defineProperty(NativescriptDeviceService.prototype, "screenOrientationDegrees", {
        get: function () {
            return util_1.screenOrientation;
        },
        enumerable: true,
        configurable: true
    });
    NativescriptDeviceService.prototype.onRequestPresentHMD = function () {
        var device = vuforia.api && vuforia.api.getDevice();
        device && device.setViewerActive(true);
        return Promise.resolve();
    };
    NativescriptDeviceService.prototype.onExitPresentHMD = function () {
        var device = vuforia.api && vuforia.api.getDevice();
        device && device.setViewerActive(false);
        return Promise.resolve();
    };
    NativescriptDeviceService.prototype.onUpdateFrameState = function () {
        if (this._application.ios) {
            var motionManager = this._getMotionManagerIOS();
            var motion = motionManager && motionManager.deviceMotion;
            if (motion) {
                var motionQuaternion = motion.attitude.quaternion;
                // Apple's orientation is reported in NWU, so we convert to ENU by applying a global rotation of
                // 90 degrees about +z to the NWU orientation (or applying the NWU quaternion as a local rotation 
                // to the starting orientation of 90 degress about +z). 
                // Note: With quaternion multiplication the `*` symbol can be read as 'rotates'. 
                // If the orientation (O) is on the right and the rotation (R) is on the left, 
                // such that the multiplication order is R*O, then R is a global rotation being applied on O. 
                // Likewise, the reverse, O*R, is a local rotation R applied to the orientation O. 
                var deviceOrientation = Quaternion.multiply(z90, motionQuaternion, this._scratchDeviceOrientation);
                // And then... convert to EUS!
                deviceOrientation = Quaternion.multiply(negX90, deviceOrientation, deviceOrientation);
                var screenOrientationDegrees = this.screenOrientationDegrees;
                var deviceUser = this.user;
                var deviceStage = this.stage;
                if (!deviceUser.position)
                    deviceUser.position = new Argon.Cesium.ConstantPositionProperty();
                if (!deviceUser.orientation)
                    deviceUser.orientation = new Argon.Cesium.ConstantProperty();
                deviceUser.position.setValue(Cartesian3.fromElements(0, this.suggestedUserHeight, 0, this._scratchCartesian), deviceStage);
                var screenOrientation_1 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, screenOrientationDegrees * CesiumMath.RADIANS_PER_DEGREE, this._scratchDisplayOrientation);
                var screenBasedDeviceOrientation = Quaternion.multiply(deviceOrientation, screenOrientation_1, this._scratchDeviceOrientation);
                deviceUser.orientation.setValue(screenBasedDeviceOrientation);
                var locationManager = this._getLocationManagerIOS();
                var heading = locationManager.heading;
                deviceUser['meta'] = deviceUser['meta'] || {};
                deviceUser['meta'].geoHeadingAccuracy = heading && heading.headingAccuracy;
            }
        }
        else if (this._application.android) {
            var motionManager = this._getMotionManagerAndroid();
            if (motionManager) {
                var deviceOrientation = this._motionQuaternionAndroid;
                // convert to EUS
                deviceOrientation = Quaternion.multiply(negX90, deviceOrientation, deviceOrientation);
                var screenOrientationDegrees = this.screenOrientationDegrees;
                var deviceUser = this.user;
                var deviceStage = this.stage;
                if (!deviceUser.position)
                    deviceUser.position = new Argon.Cesium.ConstantPositionProperty();
                if (!deviceUser.orientation)
                    deviceUser.orientation = new Argon.Cesium.ConstantProperty();
                deviceUser.position.setValue(Cartesian3.fromElements(0, this.suggestedUserHeight, 0, this._scratchCartesian), deviceStage);
                var screenOrientation_2 = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, screenOrientationDegrees * CesiumMath.RADIANS_PER_DEGREE, this._scratchDisplayOrientation);
                var screenBasedDeviceOrientation = Quaternion.multiply(deviceOrientation, screenOrientation_2, this._scratchDeviceOrientation);
                deviceUser.orientation.setValue(screenBasedDeviceOrientation);
            }
        }
    };
    NativescriptDeviceService.prototype._getMotionManagerIOS = function () {
        if (this._motionManagerIOS)
            return this._motionManagerIOS;
        var motionManager = CMMotionManager.alloc().init();
        motionManager.showsDeviceMovementDisplay = true;
        motionManager.deviceMotionUpdateInterval = 1.0 / 100.0;
        if (!motionManager.deviceMotionAvailable || !motionManager.magnetometerAvailable) {
            // console.log("NO Magnetometer and/or Gyro. " );
            return undefined;
        }
        else {
            var effectiveReferenceFrame = void 0;
            if (CMMotionManager.availableAttitudeReferenceFrames() & 8 /* XTrueNorthZVertical */) {
                effectiveReferenceFrame = 8 /* XTrueNorthZVertical */;
                motionManager.startDeviceMotionUpdatesUsingReferenceFrame(effectiveReferenceFrame);
            }
            else {
                // console.log("NO  CMAttitudeReferenceFrameXTrueNorthZVertical" );
                return undefined;
            }
        }
        this._motionManagerIOS = motionManager;
        return motionManager;
    };
    NativescriptDeviceService.prototype._getLocationManagerIOS = function () {
        if (!this._locationManagerIOS) {
            this._locationManagerIOS = CLLocationManager.alloc().init();
            switch (CLLocationManager.authorizationStatus()) {
                case 4 /* kCLAuthorizationStatusAuthorizedWhenInUse */:
                case 3 /* kCLAuthorizationStatusAuthorizedAlways */:
                    break;
                case 0 /* kCLAuthorizationStatusNotDetermined */:
                    this._locationManagerIOS.requestWhenInUseAuthorization();
                    break;
                case 2 /* kCLAuthorizationStatusDenied */:
                case 1 /* kCLAuthorizationStatusRestricted */:
                default:
                    dialogs.action({
                        title: "Location Services",
                        message: "In order to provide the best Augmented Reality experience,\nplease open this app's settings and enable location services",
                        cancelButtonText: "Cancel",
                        actions: ['Settings']
                    }).then(function (action) {
                        if (action === 'Settings') {
                            var url = NSURL.URLWithString(UIApplicationOpenSettingsURLString);
                            utils.ios.getter(UIApplication, UIApplication.sharedApplication).openURL(url);
                        }
                    });
            }
        }
        return this._locationManagerIOS;
    };
    NativescriptDeviceService.prototype._getMotionManagerAndroid = function () {
        var _this = this;
        if (this._motionManagerAndroid)
            return this._motionManagerAndroid;
        var sensorManager = application.android.foregroundActivity.getSystemService(android.content.Context.SENSOR_SERVICE);
        var rotationSensor = sensorManager.getDefaultSensor(android.hardware.Sensor.TYPE_ROTATION_VECTOR);
        var sensorEventListener = new android.hardware.SensorEventListener({
            onAccuracyChanged: function (sensor, accuracy) {
                //console.log("onAccuracyChanged: " + accuracy);
            },
            onSensorChanged: function (event) {
                Quaternion.unpack(event.values, 0, _this._motionQuaternionAndroid);
            }
        });
        sensorManager.registerListener(sensorEventListener, rotationSensor, android.hardware.SensorManager.SENSOR_DELAY_GAME);
        this._motionManagerAndroid = sensorEventListener;
        return sensorEventListener;
    };
    return NativescriptDeviceService;
}(Argon.DeviceService));
NativescriptDeviceService = __decorate([
    Argon.DI.autoinject,
    __metadata("design:paramtypes", [Argon.SessionService, Argon.EntityService, Argon.ViewService, Argon.VisibilityService])
], NativescriptDeviceService);
exports.NativescriptDeviceService = NativescriptDeviceService;
var NativescriptDeviceServiceProvider = (function (_super) {
    __extends(NativescriptDeviceServiceProvider, _super);
    function NativescriptDeviceServiceProvider(container, sessionService, deviceService, viewService, entityService, entityServiceProvider, focusServiceProvider, vuforiaServiceProvider) {
        var _this = _super.call(this, sessionService, deviceService, viewService, entityService, entityServiceProvider) || this;
        _this.focusServiceProvider = focusServiceProvider;
        _this._scratchPerspectiveFrustum = new Argon.Cesium.PerspectiveFrustum;
        _this._scratchVideoMatrix4 = new Argon.Cesium.Matrix4;
        _this._scratchVideoQuaternion = new Argon.Cesium.Quaternion;
        _this._scratchStageCartographic = new Argon.Cesium.Cartographic;
        application.on(application.orientationChangedEvent, function () {
            setTimeout(function () {
                _this.publishStableState();
            }, 600);
            _this.publishStableState();
        });
        var vsp = vuforiaServiceProvider;
        vsp.stateUpdateEvent.addEventListener(function () {
            _this.deviceService.executeReqeustAnimationFrameCallbacks();
        });
        if (!vuforia.api) {
            setInterval(function () { return vsp.stateUpdateEvent.raiseEvent(Argon.Cesium.JulianDate.now()); }, 34);
        }
        return _this;
    }
    NativescriptDeviceServiceProvider.prototype.onUpdateStableState = function (stableState) {
        var viewport = this.deviceService.frameState.viewport;
        var contentView = frames.topmost().currentPage.content;
        var contentSize = contentView.getActualSize();
        viewport.x = 0;
        viewport.y = 0;
        viewport.width = contentSize.width;
        viewport.height = contentSize.height;
        var subviews = this.deviceService.frameState.subviews;
        var device = vuforia.api.getDevice();
        var renderingPrimitives = device.getRenderingPrimitives();
        var renderingViews = renderingPrimitives.getRenderingViews();
        var numViews = renderingViews.getNumViews();
        var contentScaleFactor = vuforia.videoView.ios ? vuforia.videoView.ios.contentScaleFactor : platform.screen.mainScreen.scale;
        subviews.length = numViews;
        subviews.length = numViews;
        for (var i = 0; i < numViews; i++) {
            var view = renderingViews.getView(i);
            // TODO: support PostProcess rendering subview
            if (view === vuforia.View.PostProcess) {
                subviews.length--;
                continue;
            }
            var subview = subviews[i] = subviews[i] || {};
            // Set subview type
            switch (view) {
                case vuforia.View.LeftEye:
                    subview.type = Argon.SubviewType.LEFTEYE;
                    break;
                case vuforia.View.RightEye:
                    subview.type = Argon.SubviewType.RIGHTEYE;
                    break;
                case vuforia.View.Singular:
                    subview.type = Argon.SubviewType.SINGULAR;
                    break;
                default:
                    subview.type = Argon.SubviewType.OTHER;
                    break;
            }
            // Update subview viewport
            var vuforiaSubviewViewport = renderingPrimitives.getViewport(view);
            var subviewViewport = subview.viewport = subview.viewport || {};
            subviewViewport.x = vuforiaSubviewViewport.x / contentScaleFactor;
            subviewViewport.y = vuforiaSubviewViewport.y / contentScaleFactor;
            subviewViewport.width = vuforiaSubviewViewport.z / contentScaleFactor;
            subviewViewport.height = vuforiaSubviewViewport.w / contentScaleFactor;
            // Start with the projection matrix for this subview
            // Note: Vuforia uses a right-handed projection matrix with x to the right, y down, and z as the viewing direction.
            // So we are converting to a more standard convention of x to the right, y up, and -z as the viewing direction. 
            var projectionMatrix = renderingPrimitives.getProjectionMatrix(view, vuforia.CoordinateSystemType.Camera);
            if (!isFinite(projectionMatrix[0])) {
                // if our projection matrix is giving null values then the
                // surface is not properly configured for some reason, so reset it
                // (not sure why this happens, but it only seems to happen after or between 
                // vuforia initializations)
                if (i === 0) {
                    vuforia.api.onSurfaceChanged(viewport.width * contentScaleFactor, viewport.height * contentScaleFactor);
                }
                var frustum = this._scratchPerspectiveFrustum;
                frustum.fov = Math.PI / 2;
                frustum.near = 0.01;
                frustum.far = 10000;
                frustum.aspectRatio = subviewViewport.width / subviewViewport.height;
                if (!isFinite(frustum.aspectRatio) || frustum.aspectRatio === 0)
                    frustum.aspectRatio = 1;
                subview.projectionMatrix = Matrix4.clone(frustum.projectionMatrix, subview.projectionMatrix);
            }
            else {
                // Undo the video rotation since we already encode the interface orientation in our view pose
                // Note: the "base" rotation for vuforia's video (at least on iOS) is the landscape right orientation,
                // which is the orientation where the device is held in landscape with the home button on the right. 
                // This "base" video rotatation is -90 deg around +z from the portrait interface orientation
                // So, we want to undo this rotation which vuforia applies for us.  
                // TODO: calculate this matrix only when we have to (when the interface orientation changes)
                var inverseVideoRotationMatrix = Matrix4.fromTranslationQuaternionRotationScale(Cartesian3.ZERO, Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, (CesiumMath.PI_OVER_TWO - util_1.screenOrientation * Math.PI / 180), this._scratchVideoQuaternion), ONE, this._scratchVideoMatrix4);
                Argon.Cesium.Matrix4.multiply(projectionMatrix, inverseVideoRotationMatrix, projectionMatrix);
                // convert from the vuforia projection matrix (+X -Y +Z) to a more standard convention (+X +Y -Z)
                // by negating the appropriate columns. 
                // See https://developer.vuforia.com/library/articles/Solution/How-To-Use-the-Camera-Projection-Matrix
                projectionMatrix[0] *= -1; // x
                projectionMatrix[1] *= -1; // y
                projectionMatrix[2] *= -1; // z
                projectionMatrix[3] *= -1; // w
                projectionMatrix[8] *= -1; // x
                projectionMatrix[9] *= -1; // y
                projectionMatrix[10] *= -1; // z
                projectionMatrix[11] *= -1; // w
                // Argon.Cesium.Matrix4.multiplyByScale(projectionMatrix, Cartesian3.fromElements(1,-1,-1, this._scratchCartesian), projectionMatrix)
                // Scale the projection matrix to fit nicely within a subview of type SINGULAR
                // (This scale will not apply when the user is wearing a monocular HMD, since a
                // monocular HMD would provide a subview of type LEFTEYE or RIGHTEYE)
                // if (subview.type == Argon.SubviewType.SINGULAR) {
                //     const widthRatio = subviewWidth / videoMode.width;
                //     const heightRatio = subviewHeight / videoMode.height;
                //     // aspect fill
                //     const scaleFactor = Math.max(widthRatio, heightRatio);
                //     // or aspect fit
                //     // const scaleFactor = Math.min(widthRatio, heightRatio);
                //     // scale x-axis
                //     projectionMatrix[0] *= scaleFactor; // x
                //     projectionMatrix[1] *= scaleFactor; // y
                //     projectionMatrix[2] *= scaleFactor; // z
                //     projectionMatrix[3] *= scaleFactor; // w
                //     // scale y-axis
                //     projectionMatrix[4] *= scaleFactor; // x
                //     projectionMatrix[5] *= scaleFactor; // y
                //     projectionMatrix[6] *= scaleFactor; // z
                //     projectionMatrix[7] *= scaleFactor; // w
                // }
                subview.projectionMatrix = Matrix4.clone(projectionMatrix, subview.projectionMatrix);
            }
            // const eyeAdjustmentMatrix = renderingPrimitives.getEyeDisplayAdjustmentMatrix(view);
            // let projectionMatrix = Argon.Cesium.Matrix4.multiply(rawProjectionMatrix, eyeAdjustmentMatrix, []);
            // projectionMatrix = Argon.Cesium.Matrix4.fromRowMajorArray(projectionMatrix, projectionMatrix);
            // TODO: use eye adjustment matrix to set subview poses (for eye separation). See commented out code above...
        }
    };
    NativescriptDeviceServiceProvider.prototype.onStartGeolocationUpdates = function (options) {
        var _this = this;
        if (typeof this.locationWatchId !== 'undefined')
            return Promise.resolve();
        ;
        return new Promise(function (resolve, reject) {
            // Note: the d.ts for nativescript-geolocation is wrong. This call is correct. 
            // Casting the module as <any> here for now to hide annoying typescript errors...
            _this.locationWatchId = geolocation.watchLocation(function (location) {
                // Note: iOS documentation states that the altitude value refers to height (meters) above sea level, but 
                // if ios is reporting the standard gps defined altitude, then this theoretical "sea level" actually refers to 
                // the WGS84 ellipsoid rather than traditional mean sea level (MSL) which is not a simple surface and varies 
                // according to the local gravitational field. 
                // In other words, my best guess is that the altitude value here is *probably* GPS defined altitude, which 
                // is equivalent to the height above the WGS84 ellipsoid, which is exactly what Cesium expects...
                _this.configureStage(Argon.Cesium.Cartographic.fromDegrees(location.longitude, location.latitude, location.altitude, _this._scratchStageCartographic), location.horizontalAccuracy, location.verticalAccuracy);
            }, function (e) {
                reject(e);
            }, {
                desiredAccuracy: options && options.enableHighAccuracy ?
                    application.ios ?
                        kCLLocationAccuracyBest :
                        enums.Accuracy.high :
                    application.ios ?
                        kCLLocationAccuracyNearestTenMeters :
                        10,
                updateDistance: application.ios ? kCLDistanceFilterNone : 0,
                minimumUpdateTime: options && options.enableHighAccuracy ?
                    0 : 5000 // required on Android, ignored on iOS
            });
            console.log("Creating location watcher. " + _this.locationWatchId);
        });
    };
    NativescriptDeviceServiceProvider.prototype.onStopGeolocationUpdates = function () {
        if (Argon.Cesium.defined(this.locationWatchId)) {
            geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = undefined;
        }
    };
    NativescriptDeviceServiceProvider.prototype._ensurePermission = function (session) {
        if (this.focusServiceProvider.session == session)
            return;
        if (session == this.sessionService.manager)
            return;
        throw new Error('Session does not have focus.');
    };
    NativescriptDeviceServiceProvider.prototype.handleRequestPresentHMD = function (session) {
        this._ensurePermission(session);
        return Promise.resolve();
    };
    NativescriptDeviceServiceProvider.prototype.handleExitPresentHMD = function (session) {
        this._ensurePermission(session);
        return Promise.resolve();
    };
    return NativescriptDeviceServiceProvider;
}(Argon.DeviceServiceProvider));
NativescriptDeviceServiceProvider = __decorate([
    Argon.DI.autoinject,
    __metadata("design:paramtypes", [Object, Argon.SessionService, Argon.DeviceService, Argon.ViewService, Argon.EntityService, Argon.EntityServiceProvider, Argon.FocusServiceProvider, Argon.VuforiaServiceProvider])
], NativescriptDeviceServiceProvider);
exports.NativescriptDeviceServiceProvider = NativescriptDeviceServiceProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJnb24tZGV2aWNlLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXJnb24tZGV2aWNlLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUNBQTJDO0FBQzNDLG1DQUFxQztBQUNyQyw2REFBK0Q7QUFDL0Qsb0NBQXNDO0FBQ3RDLGdDQUFrQztBQUNsQyxtQ0FBcUM7QUFFckMsOENBQWdEO0FBQ2hELGlDQUFtQztBQUVuQyxzQ0FBd0M7QUFFeEMsK0JBQXdDO0FBRXhDLElBQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQzNDLElBQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQzNDLElBQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQzNDLElBQU0sT0FBTyxHQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0FBRXhDLElBQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNwRixJQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2hGLElBQU0sR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUM7QUFHbEMsSUFBYSx5QkFBeUI7SUFBUyw2Q0FBbUI7SUFFOUQsbUNBQ0ksY0FBbUMsRUFDbkMsYUFBaUMsRUFDakMsV0FBNkIsRUFDN0IsaUJBQXlDO1FBSjdDLFlBS0ksa0JBQU0sY0FBYyxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLENBQUMsU0FDdkU7UUFnQk8sc0JBQWdCLEdBQUcsVUFBQyxFQUFXLEVBQUUsR0FBVTtZQUMv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LEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO0lBQ25ELENBQUM7SUFFRCxtRUFBdUIsR0FBdkIsVUFBd0IsT0FBeUI7UUFDN0MsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDN0IsQ0FBQztJQUVELGdFQUFvQixHQUFwQixVQUFxQixPQUF5QjtRQUMxQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRUwsd0NBQUM7QUFBRCxDQUFDLEFBN1BELENBQXVELEtBQUssQ0FBQyxxQkFBcUIsR0E2UGpGO0FBN1BZLGlDQUFpQztJQUQ3QyxLQUFLLENBQUMsRUFBRSxDQUFDLFVBQVU7NkNBSUcsS0FBSyxDQUFDLGNBQWMsRUFDckIsS0FBSyxDQUFDLGFBQWEsRUFDckIsS0FBSyxDQUFDLFdBQVcsRUFDZixLQUFLLENBQUMsYUFBYSxFQUNYLEtBQUssQ0FBQyxxQkFBcUIsRUFDcEIsS0FBSyxDQUFDLG9CQUFvQixFQUNoQyxLQUFLLENBQUMsc0JBQXNCO0dBVDlDLGlDQUFpQyxDQTZQN0M7QUE3UFksOEVBQWlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXBwbGljYXRpb24gZnJvbSBcImFwcGxpY2F0aW9uXCI7XHJcbmltcG9ydCAqIGFzIHV0aWxzIGZyb20gJ3V0aWxzL3V0aWxzJztcclxuaW1wb3J0ICogYXMgZ2VvbG9jYXRpb24gZnJvbSAnc3BlaWdnLW5hdGl2ZXNjcmlwdC1nZW9sb2NhdGlvbic7XHJcbmltcG9ydCAqIGFzIGRpYWxvZ3MgZnJvbSAndWkvZGlhbG9ncyc7XHJcbmltcG9ydCAqIGFzIGVudW1zIGZyb20gJ3VpL2VudW1zJztcclxuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAncGxhdGZvcm0nO1xyXG5cclxuaW1wb3J0ICogYXMgdnVmb3JpYSBmcm9tICduYXRpdmVzY3JpcHQtdnVmb3JpYSc7XHJcbmltcG9ydCAqIGFzIGZyYW1lcyBmcm9tICd1aS9mcmFtZSc7XHJcbmltcG9ydCB7TmF0aXZlc2NyaXB0VnVmb3JpYVNlcnZpY2VQcm92aWRlcn0gZnJvbSAnLi9hcmdvbi12dWZvcmlhLXByb3ZpZGVyJ1xyXG5pbXBvcnQgKiBhcyBBcmdvbiBmcm9tIFwiQGFyZ29uanMvYXJnb25cIjtcclxuXHJcbmltcG9ydCB7c2NyZWVuT3JpZW50YXRpb259IGZyb20gJy4vdXRpbCdcclxuXHJcbmNvbnN0IENhcnRlc2lhbjMgPSBBcmdvbi5DZXNpdW0uQ2FydGVzaWFuMztcclxuY29uc3QgUXVhdGVybmlvbiA9IEFyZ29uLkNlc2l1bS5RdWF0ZXJuaW9uO1xyXG5jb25zdCBDZXNpdW1NYXRoID0gQXJnb24uQ2VzaXVtLkNlc2l1bU1hdGg7XHJcbmNvbnN0IE1hdHJpeDQgICAgPSBBcmdvbi5DZXNpdW0uTWF0cml4NDtcclxuXHJcbmNvbnN0IG5lZ1g5MCA9IFF1YXRlcm5pb24uZnJvbUF4aXNBbmdsZShDYXJ0ZXNpYW4zLlVOSVRfWCwgLUNlc2l1bU1hdGguUElfT1ZFUl9UV08pO1xyXG5jb25zdCB6OTAgPSBRdWF0ZXJuaW9uLmZyb21BeGlzQW5nbGUoQ2FydGVzaWFuMy5VTklUX1osIENlc2l1bU1hdGguUElfT1ZFUl9UV08pO1xyXG5jb25zdCBPTkUgPSBuZXcgQ2FydGVzaWFuMygxLDEsMSk7XHJcblxyXG5AQXJnb24uREkuYXV0b2luamVjdFxyXG5leHBvcnQgY2xhc3MgTmF0aXZlc2NyaXB0RGV2aWNlU2VydmljZSBleHRlbmRzIEFyZ29uLkRldmljZVNlcnZpY2Uge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgIHNlc3Npb25TZXJ2aWNlOkFyZ29uLlNlc3Npb25TZXJ2aWNlLCBcclxuICAgICAgICBlbnRpdHlTZXJ2aWNlOkFyZ29uLkVudGl0eVNlcnZpY2UsIFxyXG4gICAgICAgIHZpZXdTZXJ2aWNlOkFyZ29uLlZpZXdTZXJ2aWNlLFxyXG4gICAgICAgIHZpc2liaWxpdHlTZXJ2aWNlOkFyZ29uLlZpc2liaWxpdHlTZXJ2aWNlKSB7XHJcbiAgICAgICAgc3VwZXIoc2Vzc2lvblNlcnZpY2UsIGVudGl0eVNlcnZpY2UsIHZpZXdTZXJ2aWNlLCB2aXNpYmlsaXR5U2VydmljZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGV4ZWN1dGVSZXFldXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MoKSB7XHJcbiAgICAgICAgY29uc3Qgbm93ID0gZ2xvYmFsLnBlcmZvcm1hbmNlLm5vdygpO1xyXG4gICAgICAgIC8vIHN3YXAgY2FsbGJhY2sgbWFwc1xyXG4gICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcztcclxuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MyO1xyXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrczIgPSBjYWxsYmFja3M7XHJcbiAgICAgICAgZm9yIChsZXQgaSBpbiBjYWxsYmFja3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fZXhlY3V0ZUNhbGxiYWNrKGNhbGxiYWNrc1tpXSwgbm93KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yIChsZXQgaSBpbiBjYWxsYmFja3MpIHtcclxuICAgICAgICAgICAgZGVsZXRlIGNhbGxiYWNrc1tpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZXhlY3V0ZUNhbGxiYWNrID0gKGNiOkZ1bmN0aW9uLCBub3c6bnVtYmVyKSA9PiB7XHJcbiAgICAgICAgY2Iobm93KTtcclxuICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBfYXBwbGljYXRpb24gPSBhcHBsaWNhdGlvbjtcclxuICAgIHByaXZhdGUgX3NjcmF0Y2hEaXNwbGF5T3JpZW50YXRpb24gPSBuZXcgUXVhdGVybmlvbjtcclxuICAgIHByaXZhdGUgX3NjcmF0Y2hEZXZpY2VPcmllbnRhdGlvbiA9IG5ldyBRdWF0ZXJuaW9uO1xyXG5cclxuICAgIHByaXZhdGUgX2lkID0gMDtcclxuICAgIHByaXZhdGUgX2NhbGxiYWNrczp7W2lkOm51bWJlcl06RnVuY3Rpb259ID0ge307XHJcbiAgICBwcml2YXRlIF9jYWxsYmFja3MyOntbaWQ6bnVtYmVyXTpGdW5jdGlvbn0gPSB7fTtcclxuXHJcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSAoY2I6KHRpbWVzdGFtcDpudW1iZXIpPT52b2lkKSA9PiB7XHJcbiAgICAgICAgdGhpcy5faWQrKztcclxuICAgICAgICB0aGlzLl9jYWxsYmFja3NbdGhpcy5faWRdID0gY2I7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gKGlkOm51bWJlcikgPT4ge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbaWRdO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBnZXQgc2NyZWVuT3JpZW50YXRpb25EZWdyZWVzKCkge1xyXG4gICAgICAgIHJldHVybiBzY3JlZW5PcmllbnRhdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICBvblJlcXVlc3RQcmVzZW50SE1EKCkge1xyXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHZ1Zm9yaWEuYXBpICYmIHZ1Zm9yaWEuYXBpLmdldERldmljZSgpO1xyXG4gICAgICAgIGRldmljZSAmJiBkZXZpY2Uuc2V0Vmlld2VyQWN0aXZlKHRydWUpO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBvbkV4aXRQcmVzZW50SE1EKCkge1xyXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHZ1Zm9yaWEuYXBpICYmIHZ1Zm9yaWEuYXBpLmdldERldmljZSgpO1xyXG4gICAgICAgIGRldmljZSAmJiBkZXZpY2Uuc2V0Vmlld2VyQWN0aXZlKGZhbHNlKTtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgb25VcGRhdGVGcmFtZVN0YXRlKCkge1xyXG5cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2FwcGxpY2F0aW9uLmlvcykge1xyXG4gICAgICAgICAgICBjb25zdCBtb3Rpb25NYW5hZ2VyID0gdGhpcy5fZ2V0TW90aW9uTWFuYWdlcklPUygpO1xyXG4gICAgICAgICAgICBjb25zdCBtb3Rpb24gPSBtb3Rpb25NYW5hZ2VyICYmIG1vdGlvbk1hbmFnZXIuZGV2aWNlTW90aW9uO1xyXG5cclxuICAgICAgICAgICAgaWYgKG1vdGlvbikge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbW90aW9uUXVhdGVybmlvbiA9IDxBcmdvbi5DZXNpdW0uUXVhdGVybmlvbj5tb3Rpb24uYXR0aXR1ZGUucXVhdGVybmlvbjtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBBcHBsZSdzIG9yaWVudGF0aW9uIGlzIHJlcG9ydGVkIGluIE5XVSwgc28gd2UgY29udmVydCB0byBFTlUgYnkgYXBwbHlpbmcgYSBnbG9iYWwgcm90YXRpb24gb2ZcclxuICAgICAgICAgICAgICAgIC8vIDkwIGRlZ3JlZXMgYWJvdXQgK3ogdG8gdGhlIE5XVSBvcmllbnRhdGlvbiAob3IgYXBwbHlpbmcgdGhlIE5XVSBxdWF0ZXJuaW9uIGFzIGEgbG9jYWwgcm90YXRpb24gXHJcbiAgICAgICAgICAgICAgICAvLyB0byB0aGUgc3RhcnRpbmcgb3JpZW50YXRpb24gb2YgOTAgZGVncmVzcyBhYm91dCAreikuIFxyXG4gICAgICAgICAgICAgICAgLy8gTm90ZTogV2l0aCBxdWF0ZXJuaW9uIG11bHRpcGxpY2F0aW9uIHRoZSBgKmAgc3ltYm9sIGNhbiBiZSByZWFkIGFzICdyb3RhdGVzJy4gXHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgb3JpZW50YXRpb24gKE8pIGlzIG9uIHRoZSByaWdodCBhbmQgdGhlIHJvdGF0aW9uIChSKSBpcyBvbiB0aGUgbGVmdCwgXHJcbiAgICAgICAgICAgICAgICAvLyBzdWNoIHRoYXQgdGhlIG11bHRpcGxpY2F0aW9uIG9yZGVyIGlzIFIqTywgdGhlbiBSIGlzIGEgZ2xvYmFsIHJvdGF0aW9uIGJlaW5nIGFwcGxpZWQgb24gTy4gXHJcbiAgICAgICAgICAgICAgICAvLyBMaWtld2lzZSwgdGhlIHJldmVyc2UsIE8qUiwgaXMgYSBsb2NhbCByb3RhdGlvbiBSIGFwcGxpZWQgdG8gdGhlIG9yaWVudGF0aW9uIE8uIFxyXG4gICAgICAgICAgICAgICAgbGV0IGRldmljZU9yaWVudGF0aW9uID0gUXVhdGVybmlvbi5tdWx0aXBseSh6OTAsIG1vdGlvblF1YXRlcm5pb24sIHRoaXMuX3NjcmF0Y2hEZXZpY2VPcmllbnRhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAvLyBBbmQgdGhlbi4uLiBjb252ZXJ0IHRvIEVVUyFcclxuICAgICAgICAgICAgICAgIGRldmljZU9yaWVudGF0aW9uID0gUXVhdGVybmlvbi5tdWx0aXBseShuZWdYOTAsIGRldmljZU9yaWVudGF0aW9uLCBkZXZpY2VPcmllbnRhdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuT3JpZW50YXRpb25EZWdyZWVzID0gdGhpcy5zY3JlZW5PcmllbnRhdGlvbkRlZ3JlZXM7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgZGV2aWNlVXNlciA9IHRoaXMudXNlcjtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRldmljZVN0YWdlID0gdGhpcy5zdGFnZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWRldmljZVVzZXIucG9zaXRpb24pIGRldmljZVVzZXIucG9zaXRpb24gPSBuZXcgQXJnb24uQ2VzaXVtLkNvbnN0YW50UG9zaXRpb25Qcm9wZXJ0eSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFkZXZpY2VVc2VyLm9yaWVudGF0aW9uKSBkZXZpY2VVc2VyLm9yaWVudGF0aW9uID0gbmV3IEFyZ29uLkNlc2l1bS5Db25zdGFudFByb3BlcnR5KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgKGRldmljZVVzZXIucG9zaXRpb24gYXMgQXJnb24uQ2VzaXVtLkNvbnN0YW50UG9zaXRpb25Qcm9wZXJ0eSkuc2V0VmFsdWUoXHJcbiAgICAgICAgICAgICAgICAgICAgQ2FydGVzaWFuMy5mcm9tRWxlbWVudHMoMCx0aGlzLnN1Z2dlc3RlZFVzZXJIZWlnaHQsMCwgdGhpcy5fc2NyYXRjaENhcnRlc2lhbiksXHJcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlU3RhZ2VcclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuT3JpZW50YXRpb24gPSBcclxuICAgICAgICAgICAgICAgICAgICBRdWF0ZXJuaW9uLmZyb21BeGlzQW5nbGUoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIENhcnRlc2lhbjMuVU5JVF9aLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NyZWVuT3JpZW50YXRpb25EZWdyZWVzICogQ2VzaXVtTWF0aC5SQURJQU5TX1BFUl9ERUdSRUUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JhdGNoRGlzcGxheU9yaWVudGF0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JlZW5CYXNlZERldmljZU9yaWVudGF0aW9uID0gXHJcbiAgICAgICAgICAgICAgICAgICAgUXVhdGVybmlvbi5tdWx0aXBseShcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlT3JpZW50YXRpb24sIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JlZW5PcmllbnRhdGlvbiwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmF0Y2hEZXZpY2VPcmllbnRhdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgKGRldmljZVVzZXIub3JpZW50YXRpb24gYXMgQXJnb24uQ2VzaXVtLkNvbnN0YW50UHJvcGVydHkpLnNldFZhbHVlKHNjcmVlbkJhc2VkRGV2aWNlT3JpZW50YXRpb24pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2NhdGlvbk1hbmFnZXIgPSB0aGlzLl9nZXRMb2NhdGlvbk1hbmFnZXJJT1MoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRpbmcgPSBsb2NhdGlvbk1hbmFnZXIuaGVhZGluZztcclxuICAgICAgICAgICAgICAgIGRldmljZVVzZXJbJ21ldGEnXSA9IGRldmljZVVzZXJbJ21ldGEnXSB8fCB7fTtcclxuICAgICAgICAgICAgICAgIGRldmljZVVzZXJbJ21ldGEnXS5nZW9IZWFkaW5nQWNjdXJhY3kgPSBoZWFkaW5nICYmIGhlYWRpbmcuaGVhZGluZ0FjY3VyYWN5O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXBwbGljYXRpb24uYW5kcm9pZCkge1xyXG5cclxuICAgICAgICAgICAgY29uc3QgbW90aW9uTWFuYWdlciA9IHRoaXMuX2dldE1vdGlvbk1hbmFnZXJBbmRyb2lkKCk7XHJcbiAgICAgICAgICAgIGlmIChtb3Rpb25NYW5hZ2VyKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZGV2aWNlT3JpZW50YXRpb24gPSB0aGlzLl9tb3Rpb25RdWF0ZXJuaW9uQW5kcm9pZDtcclxuICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gRVVTXHJcbiAgICAgICAgICAgICAgICBkZXZpY2VPcmllbnRhdGlvbiA9IFF1YXRlcm5pb24ubXVsdGlwbHkobmVnWDkwLCBkZXZpY2VPcmllbnRhdGlvbiwgZGV2aWNlT3JpZW50YXRpb24pO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmVlbk9yaWVudGF0aW9uRGVncmVlcyA9IHRoaXMuc2NyZWVuT3JpZW50YXRpb25EZWdyZWVzO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGRldmljZVVzZXIgPSB0aGlzLnVzZXI7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkZXZpY2VTdGFnZSA9IHRoaXMuc3RhZ2U7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFkZXZpY2VVc2VyLnBvc2l0aW9uKSBkZXZpY2VVc2VyLnBvc2l0aW9uID0gbmV3IEFyZ29uLkNlc2l1bS5Db25zdGFudFBvc2l0aW9uUHJvcGVydHkoKTtcclxuICAgICAgICAgICAgICAgIGlmICghZGV2aWNlVXNlci5vcmllbnRhdGlvbikgZGV2aWNlVXNlci5vcmllbnRhdGlvbiA9IG5ldyBBcmdvbi5DZXNpdW0uQ29uc3RhbnRQcm9wZXJ0eSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIChkZXZpY2VVc2VyLnBvc2l0aW9uIGFzIEFyZ29uLkNlc2l1bS5Db25zdGFudFBvc2l0aW9uUHJvcGVydHkpLnNldFZhbHVlKFxyXG4gICAgICAgICAgICAgICAgICAgIENhcnRlc2lhbjMuZnJvbUVsZW1lbnRzKDAsdGhpcy5zdWdnZXN0ZWRVc2VySGVpZ2h0LDAsIHRoaXMuX3NjcmF0Y2hDYXJ0ZXNpYW4pLFxyXG4gICAgICAgICAgICAgICAgICAgIGRldmljZVN0YWdlXHJcbiAgICAgICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmVlbk9yaWVudGF0aW9uID0gXHJcbiAgICAgICAgICAgICAgICAgICAgUXVhdGVybmlvbi5mcm9tQXhpc0FuZ2xlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBDYXJ0ZXNpYW4zLlVOSVRfWiwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmVlbk9yaWVudGF0aW9uRGVncmVlcyAqIENlc2l1bU1hdGguUkFESUFOU19QRVJfREVHUkVFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyYXRjaERpc3BsYXlPcmllbnRhdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuQmFzZWREZXZpY2VPcmllbnRhdGlvbiA9IFxyXG4gICAgICAgICAgICAgICAgICAgIFF1YXRlcm5pb24ubXVsdGlwbHkoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZU9yaWVudGF0aW9uLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NyZWVuT3JpZW50YXRpb24sIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JhdGNoRGV2aWNlT3JpZW50YXRpb25cclxuICAgICAgICAgICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgICAgIChkZXZpY2VVc2VyLm9yaWVudGF0aW9uIGFzIEFyZ29uLkNlc2l1bS5Db25zdGFudFByb3BlcnR5KS5zZXRWYWx1ZShzY3JlZW5CYXNlZERldmljZU9yaWVudGF0aW9uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9tb3Rpb25NYW5hZ2VySU9TPzpDTU1vdGlvbk1hbmFnZXI7XHJcblxyXG4gICAgcHJpdmF0ZSBfZ2V0TW90aW9uTWFuYWdlcklPUygpIDogQ01Nb3Rpb25NYW5hZ2VyfHVuZGVmaW5lZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuX21vdGlvbk1hbmFnZXJJT1MpIHJldHVybiB0aGlzLl9tb3Rpb25NYW5hZ2VySU9TO1xyXG5cclxuICAgICAgICBjb25zdCBtb3Rpb25NYW5hZ2VyID0gQ01Nb3Rpb25NYW5hZ2VyLmFsbG9jKCkuaW5pdCgpO1xyXG4gICAgICAgIG1vdGlvbk1hbmFnZXIuc2hvd3NEZXZpY2VNb3ZlbWVudERpc3BsYXkgPSB0cnVlXHJcbiAgICAgICAgbW90aW9uTWFuYWdlci5kZXZpY2VNb3Rpb25VcGRhdGVJbnRlcnZhbCA9IDEuMCAvIDEwMC4wO1xyXG4gICAgICAgIGlmICghbW90aW9uTWFuYWdlci5kZXZpY2VNb3Rpb25BdmFpbGFibGUgfHwgIW1vdGlvbk1hbmFnZXIubWFnbmV0b21ldGVyQXZhaWxhYmxlKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiTk8gTWFnbmV0b21ldGVyIGFuZC9vciBHeXJvLiBcIiApO1xyXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxldCBlZmZlY3RpdmVSZWZlcmVuY2VGcmFtZTpDTUF0dGl0dWRlUmVmZXJlbmNlRnJhbWU7XHJcbiAgICAgICAgICAgIGlmIChDTU1vdGlvbk1hbmFnZXIuYXZhaWxhYmxlQXR0aXR1ZGVSZWZlcmVuY2VGcmFtZXMoKSAmIENNQXR0aXR1ZGVSZWZlcmVuY2VGcmFtZS5YVHJ1ZU5vcnRoWlZlcnRpY2FsKSB7XHJcbiAgICAgICAgICAgICAgICBlZmZlY3RpdmVSZWZlcmVuY2VGcmFtZSA9IENNQXR0aXR1ZGVSZWZlcmVuY2VGcmFtZS5YVHJ1ZU5vcnRoWlZlcnRpY2FsO1xyXG4gICAgICAgICAgICAgICAgbW90aW9uTWFuYWdlci5zdGFydERldmljZU1vdGlvblVwZGF0ZXNVc2luZ1JlZmVyZW5jZUZyYW1lKGVmZmVjdGl2ZVJlZmVyZW5jZUZyYW1lKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiTk8gIENNQXR0aXR1ZGVSZWZlcmVuY2VGcmFtZVhUcnVlTm9ydGhaVmVydGljYWxcIiApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9tb3Rpb25NYW5hZ2VySU9TID0gbW90aW9uTWFuYWdlcjtcclxuICAgICAgICByZXR1cm4gbW90aW9uTWFuYWdlcjtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9sb2NhdGlvbk1hbmFnZXJJT1M/OkNMTG9jYXRpb25NYW5hZ2VyO1xyXG5cclxuICAgIHByaXZhdGUgX2dldExvY2F0aW9uTWFuYWdlcklPUygpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xvY2F0aW9uTWFuYWdlcklPUykge1xyXG4gICAgICAgICAgICB0aGlzLl9sb2NhdGlvbk1hbmFnZXJJT1MgPSBDTExvY2F0aW9uTWFuYWdlci5hbGxvYygpLmluaXQoKTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoQ0xMb2NhdGlvbk1hbmFnZXIuYXV0aG9yaXphdGlvblN0YXR1cygpKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIENMQXV0aG9yaXphdGlvblN0YXR1cy5rQ0xBdXRob3JpemF0aW9uU3RhdHVzQXV0aG9yaXplZFdoZW5JblVzZTpcclxuICAgICAgICAgICAgICAgIGNhc2UgQ0xBdXRob3JpemF0aW9uU3RhdHVzLmtDTEF1dGhvcml6YXRpb25TdGF0dXNBdXRob3JpemVkQWx3YXlzOiBcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgQ0xBdXRob3JpemF0aW9uU3RhdHVzLmtDTEF1dGhvcml6YXRpb25TdGF0dXNOb3REZXRlcm1pbmVkOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2F0aW9uTWFuYWdlcklPUy5yZXF1ZXN0V2hlbkluVXNlQXV0aG9yaXphdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBDTEF1dGhvcml6YXRpb25TdGF0dXMua0NMQXV0aG9yaXphdGlvblN0YXR1c0RlbmllZDpcclxuICAgICAgICAgICAgICAgIGNhc2UgQ0xBdXRob3JpemF0aW9uU3RhdHVzLmtDTEF1dGhvcml6YXRpb25TdGF0dXNSZXN0cmljdGVkOlxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBkaWFsb2dzLmFjdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkxvY2F0aW9uIFNlcnZpY2VzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBJbiBvcmRlciB0byBwcm92aWRlIHRoZSBiZXN0IEF1Z21lbnRlZCBSZWFsaXR5IGV4cGVyaWVuY2UsXHJcbnBsZWFzZSBvcGVuIHRoaXMgYXBwJ3Mgc2V0dGluZ3MgYW5kIGVuYWJsZSBsb2NhdGlvbiBzZXJ2aWNlc2AsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbmNlbEJ1dHRvblRleHQ6IFwiQ2FuY2VsXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnU2V0dGluZ3MnXVxyXG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGFjdGlvbik9PntcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ1NldHRpbmdzJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsID0gTlNVUkwuVVJMV2l0aFN0cmluZyhVSUFwcGxpY2F0aW9uT3BlblNldHRpbmdzVVJMU3RyaW5nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV0aWxzLmlvcy5nZXR0ZXIoVUlBcHBsaWNhdGlvbiwgVUlBcHBsaWNhdGlvbi5zaGFyZWRBcHBsaWNhdGlvbikub3BlblVSTCh1cmwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYXRpb25NYW5hZ2VySU9TO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX21vdGlvbk1hbmFnZXJBbmRyb2lkPzphbmRyb2lkLmhhcmR3YXJlLlNlbnNvckV2ZW50TGlzdGVuZXI7XHJcbiAgICBwcml2YXRlIF9tb3Rpb25RdWF0ZXJuaW9uQW5kcm9pZCA9IG5ldyBRdWF0ZXJuaW9uO1xyXG5cclxuICAgIHByaXZhdGUgX2dldE1vdGlvbk1hbmFnZXJBbmRyb2lkKCkgOiBhbmRyb2lkLmhhcmR3YXJlLlNlbnNvckV2ZW50TGlzdGVuZXJ8dW5kZWZpbmVkIHtcclxuICAgICAgICBpZiAodGhpcy5fbW90aW9uTWFuYWdlckFuZHJvaWQpIHJldHVybiB0aGlzLl9tb3Rpb25NYW5hZ2VyQW5kcm9pZDtcclxuXHJcbiAgICAgICAgdmFyIHNlbnNvck1hbmFnZXIgPSBhcHBsaWNhdGlvbi5hbmRyb2lkLmZvcmVncm91bmRBY3Rpdml0eS5nZXRTeXN0ZW1TZXJ2aWNlKGFuZHJvaWQuY29udGVudC5Db250ZXh0LlNFTlNPUl9TRVJWSUNFKTtcclxuICAgICAgICB2YXIgcm90YXRpb25TZW5zb3IgPSBzZW5zb3JNYW5hZ2VyLmdldERlZmF1bHRTZW5zb3IoYW5kcm9pZC5oYXJkd2FyZS5TZW5zb3IuVFlQRV9ST1RBVElPTl9WRUNUT1IpO1xyXG5cclxuICAgICAgICB2YXIgc2Vuc29yRXZlbnRMaXN0ZW5lciA9IG5ldyBhbmRyb2lkLmhhcmR3YXJlLlNlbnNvckV2ZW50TGlzdGVuZXIoe1xyXG4gICAgICAgICAgICBvbkFjY3VyYWN5Q2hhbmdlZDogKHNlbnNvciwgYWNjdXJhY3kpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coXCJvbkFjY3VyYWN5Q2hhbmdlZDogXCIgKyBhY2N1cmFjeSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG9uU2Vuc29yQ2hhbmdlZDogKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBRdWF0ZXJuaW9uLnVucGFjayg8bnVtYmVyW10+ZXZlbnQudmFsdWVzLCAwLCB0aGlzLl9tb3Rpb25RdWF0ZXJuaW9uQW5kcm9pZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2Vuc29yTWFuYWdlci5yZWdpc3Rlckxpc3RlbmVyKHNlbnNvckV2ZW50TGlzdGVuZXIsIHJvdGF0aW9uU2Vuc29yLCBhbmRyb2lkLmhhcmR3YXJlLlNlbnNvck1hbmFnZXIuU0VOU09SX0RFTEFZX0dBTUUpO1xyXG4gICAgICAgIHRoaXMuX21vdGlvbk1hbmFnZXJBbmRyb2lkID0gc2Vuc29yRXZlbnRMaXN0ZW5lcjtcclxuICAgICAgICByZXR1cm4gc2Vuc29yRXZlbnRMaXN0ZW5lcjtcclxuICAgIH1cclxufVxyXG5cclxuQEFyZ29uLkRJLmF1dG9pbmplY3RcclxuZXhwb3J0IGNsYXNzIE5hdGl2ZXNjcmlwdERldmljZVNlcnZpY2VQcm92aWRlciBleHRlbmRzIEFyZ29uLkRldmljZVNlcnZpY2VQcm92aWRlciB7XHJcbiAgICBjb25zdHJ1Y3RvcihcclxuICAgICAgICBjb250YWluZXIsIFxyXG4gICAgICAgIHNlc3Npb25TZXJ2aWNlOkFyZ29uLlNlc3Npb25TZXJ2aWNlLCBcclxuICAgICAgICBkZXZpY2VTZXJ2aWNlOkFyZ29uLkRldmljZVNlcnZpY2UsXHJcbiAgICAgICAgdmlld1NlcnZpY2U6QXJnb24uVmlld1NlcnZpY2UsXHJcbiAgICAgICAgZW50aXR5U2VydmljZTpBcmdvbi5FbnRpdHlTZXJ2aWNlLFxyXG4gICAgICAgIGVudGl0eVNlcnZpY2VQcm92aWRlcjpBcmdvbi5FbnRpdHlTZXJ2aWNlUHJvdmlkZXIsXHJcbiAgICAgICAgcHJpdmF0ZSBmb2N1c1NlcnZpY2VQcm92aWRlcjpBcmdvbi5Gb2N1c1NlcnZpY2VQcm92aWRlcixcclxuICAgICAgICB2dWZvcmlhU2VydmljZVByb3ZpZGVyOkFyZ29uLlZ1Zm9yaWFTZXJ2aWNlUHJvdmlkZXIpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoXHJcbiAgICAgICAgICAgIHNlc3Npb25TZXJ2aWNlLCBcclxuICAgICAgICAgICAgZGV2aWNlU2VydmljZSxcclxuICAgICAgICAgICAgdmlld1NlcnZpY2UsXHJcbiAgICAgICAgICAgIGVudGl0eVNlcnZpY2UsIFxyXG4gICAgICAgICAgICBlbnRpdHlTZXJ2aWNlUHJvdmlkZXJcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBhcHBsaWNhdGlvbi5vbihhcHBsaWNhdGlvbi5vcmllbnRhdGlvbkNoYW5nZWRFdmVudCwgKCk9PntcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKT0+e1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wdWJsaXNoU3RhYmxlU3RhdGUoKTtcclxuICAgICAgICAgICAgfSwgNjAwKTtcclxuICAgICAgICAgICAgdGhpcy5wdWJsaXNoU3RhYmxlU3RhdGUoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgdnNwID0gPE5hdGl2ZXNjcmlwdFZ1Zm9yaWFTZXJ2aWNlUHJvdmlkZXI+dnVmb3JpYVNlcnZpY2VQcm92aWRlcjtcclxuXHJcbiAgICAgICAgdnNwLnN0YXRlVXBkYXRlRXZlbnQuYWRkRXZlbnRMaXN0ZW5lcigoKT0+e1xyXG4gICAgICAgICAgICAodGhpcy5kZXZpY2VTZXJ2aWNlIGFzIE5hdGl2ZXNjcmlwdERldmljZVNlcnZpY2UpLmV4ZWN1dGVSZXFldXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCF2dWZvcmlhLmFwaSkge1xyXG4gICAgICAgICAgICBzZXRJbnRlcnZhbCgoKSA9PiB2c3Auc3RhdGVVcGRhdGVFdmVudC5yYWlzZUV2ZW50KEFyZ29uLkNlc2l1bS5KdWxpYW5EYXRlLm5vdygpKSwgMzQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY3JhdGNoUGVyc3BlY3RpdmVGcnVzdHVtID0gbmV3IEFyZ29uLkNlc2l1bS5QZXJzcGVjdGl2ZUZydXN0dW07XHJcbiAgICBwcml2YXRlIF9zY3JhdGNoVmlkZW9NYXRyaXg0ID0gbmV3IEFyZ29uLkNlc2l1bS5NYXRyaXg0O1xyXG4gICAgcHJpdmF0ZSBfc2NyYXRjaFZpZGVvUXVhdGVybmlvbiA9IG5ldyBBcmdvbi5DZXNpdW0uUXVhdGVybmlvbjtcclxuXHJcbiAgICBwdWJsaWMgb25VcGRhdGVTdGFibGVTdGF0ZShzdGFibGVTdGF0ZTpBcmdvbi5EZXZpY2VTdGFibGVTdGF0ZSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHZpZXdwb3J0ID0gdGhpcy5kZXZpY2VTZXJ2aWNlLmZyYW1lU3RhdGUudmlld3BvcnQ7XHJcbiAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBmcmFtZXMudG9wbW9zdCgpLmN1cnJlbnRQYWdlLmNvbnRlbnQ7XHJcbiAgICAgICAgY29uc3QgY29udGVudFNpemUgPSBjb250ZW50Vmlldy5nZXRBY3R1YWxTaXplKCk7XHJcblxyXG4gICAgICAgIHZpZXdwb3J0LnggPSAwO1xyXG4gICAgICAgIHZpZXdwb3J0LnkgPSAwO1xyXG4gICAgICAgIHZpZXdwb3J0LndpZHRoID0gY29udGVudFNpemUud2lkdGg7XHJcbiAgICAgICAgdmlld3BvcnQuaGVpZ2h0ID0gY29udGVudFNpemUuaGVpZ2h0O1xyXG5cclxuICAgICAgICBjb25zdCBzdWJ2aWV3cyA9IHRoaXMuZGV2aWNlU2VydmljZS5mcmFtZVN0YXRlLnN1YnZpZXdzO1xyXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHZ1Zm9yaWEuYXBpLmdldERldmljZSgpO1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmluZ1ByaW1pdGl2ZXMgPSBkZXZpY2UuZ2V0UmVuZGVyaW5nUHJpbWl0aXZlcygpO1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmluZ1ZpZXdzID0gcmVuZGVyaW5nUHJpbWl0aXZlcy5nZXRSZW5kZXJpbmdWaWV3cygpO1xyXG4gICAgICAgIGNvbnN0IG51bVZpZXdzID0gcmVuZGVyaW5nVmlld3MuZ2V0TnVtVmlld3MoKTtcclxuXHJcbiAgICAgICAgY29uc3QgY29udGVudFNjYWxlRmFjdG9yID0gdnVmb3JpYS52aWRlb1ZpZXcuaW9zID8gKDxVSVZpZXc+dnVmb3JpYS52aWRlb1ZpZXcuaW9zKS5jb250ZW50U2NhbGVGYWN0b3IgOiBwbGF0Zm9ybS5zY3JlZW4ubWFpblNjcmVlbi5zY2FsZTtcclxuXHJcbiAgICAgICAgc3Vidmlld3MubGVuZ3RoID0gbnVtVmlld3M7c3Vidmlld3MubGVuZ3RoID0gbnVtVmlld3M7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVmlld3M7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gcmVuZGVyaW5nVmlld3MuZ2V0VmlldyhpKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgUG9zdFByb2Nlc3MgcmVuZGVyaW5nIHN1YnZpZXdcclxuICAgICAgICAgICAgaWYgKHZpZXcgPT09IHZ1Zm9yaWEuVmlldy5Qb3N0UHJvY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3Vidmlld3MubGVuZ3RoLS07XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3Qgc3VidmlldyA9IHN1YnZpZXdzW2ldID0gc3Vidmlld3NbaV0gfHwgPEFyZ29uLlNlcmlhbGl6ZWRTdWJ2aWV3Pnt9O1xyXG5cclxuICAgICAgICAgICAgLy8gU2V0IHN1YnZpZXcgdHlwZVxyXG4gICAgICAgICAgICBzd2l0Y2ggKHZpZXcpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgdnVmb3JpYS5WaWV3LkxlZnRFeWU6XHJcbiAgICAgICAgICAgICAgICAgICAgc3Vidmlldy50eXBlID0gQXJnb24uU3Vidmlld1R5cGUuTEVGVEVZRTsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIHZ1Zm9yaWEuVmlldy5SaWdodEV5ZTpcclxuICAgICAgICAgICAgICAgICAgICBzdWJ2aWV3LnR5cGUgPSBBcmdvbi5TdWJ2aWV3VHlwZS5SSUdIVEVZRTsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIHZ1Zm9yaWEuVmlldy5TaW5ndWxhcjpcclxuICAgICAgICAgICAgICAgICAgICBzdWJ2aWV3LnR5cGUgPSBBcmdvbi5TdWJ2aWV3VHlwZS5TSU5HVUxBUjsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHN1YnZpZXcudHlwZSA9IEFyZ29uLlN1YnZpZXdUeXBlLk9USEVSOyBicmVhaztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gVXBkYXRlIHN1YnZpZXcgdmlld3BvcnRcclxuICAgICAgICAgICAgY29uc3QgdnVmb3JpYVN1YnZpZXdWaWV3cG9ydCA9IHJlbmRlcmluZ1ByaW1pdGl2ZXMuZ2V0Vmlld3BvcnQodmlldyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1YnZpZXdWaWV3cG9ydCA9IHN1YnZpZXcudmlld3BvcnQgPSBzdWJ2aWV3LnZpZXdwb3J0IHx8IDxBcmdvbi5WaWV3cG9ydD57fTtcclxuICAgICAgICAgICAgc3Vidmlld1ZpZXdwb3J0LnggPSB2dWZvcmlhU3Vidmlld1ZpZXdwb3J0LnggLyBjb250ZW50U2NhbGVGYWN0b3I7XHJcbiAgICAgICAgICAgIHN1YnZpZXdWaWV3cG9ydC55ID0gdnVmb3JpYVN1YnZpZXdWaWV3cG9ydC55IC8gY29udGVudFNjYWxlRmFjdG9yO1xyXG4gICAgICAgICAgICBzdWJ2aWV3Vmlld3BvcnQud2lkdGggPSB2dWZvcmlhU3Vidmlld1ZpZXdwb3J0LnogLyBjb250ZW50U2NhbGVGYWN0b3I7XHJcbiAgICAgICAgICAgIHN1YnZpZXdWaWV3cG9ydC5oZWlnaHQgPSB2dWZvcmlhU3Vidmlld1ZpZXdwb3J0LncgLyBjb250ZW50U2NhbGVGYWN0b3I7XHJcblxyXG4gICAgICAgICAgICAvLyBTdGFydCB3aXRoIHRoZSBwcm9qZWN0aW9uIG1hdHJpeCBmb3IgdGhpcyBzdWJ2aWV3XHJcbiAgICAgICAgICAgIC8vIE5vdGU6IFZ1Zm9yaWEgdXNlcyBhIHJpZ2h0LWhhbmRlZCBwcm9qZWN0aW9uIG1hdHJpeCB3aXRoIHggdG8gdGhlIHJpZ2h0LCB5IGRvd24sIGFuZCB6IGFzIHRoZSB2aWV3aW5nIGRpcmVjdGlvbi5cclxuICAgICAgICAgICAgLy8gU28gd2UgYXJlIGNvbnZlcnRpbmcgdG8gYSBtb3JlIHN0YW5kYXJkIGNvbnZlbnRpb24gb2YgeCB0byB0aGUgcmlnaHQsIHkgdXAsIGFuZCAteiBhcyB0aGUgdmlld2luZyBkaXJlY3Rpb24uIFxyXG4gICAgICAgICAgICBsZXQgcHJvamVjdGlvbk1hdHJpeCA9IDxhbnk+cmVuZGVyaW5nUHJpbWl0aXZlcy5nZXRQcm9qZWN0aW9uTWF0cml4KHZpZXcsIHZ1Zm9yaWEuQ29vcmRpbmF0ZVN5c3RlbVR5cGUuQ2FtZXJhKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghaXNGaW5pdGUocHJvamVjdGlvbk1hdHJpeFswXSkpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBpZiBvdXIgcHJvamVjdGlvbiBtYXRyaXggaXMgZ2l2aW5nIG51bGwgdmFsdWVzIHRoZW4gdGhlXHJcbiAgICAgICAgICAgICAgICAvLyBzdXJmYWNlIGlzIG5vdCBwcm9wZXJseSBjb25maWd1cmVkIGZvciBzb21lIHJlYXNvbiwgc28gcmVzZXQgaXRcclxuICAgICAgICAgICAgICAgIC8vIChub3Qgc3VyZSB3aHkgdGhpcyBoYXBwZW5zLCBidXQgaXQgb25seSBzZWVtcyB0byBoYXBwZW4gYWZ0ZXIgb3IgYmV0d2VlbiBcclxuICAgICAgICAgICAgICAgIC8vIHZ1Zm9yaWEgaW5pdGlhbGl6YXRpb25zKVxyXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB2dWZvcmlhLmFwaS5vblN1cmZhY2VDaGFuZ2VkKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3cG9ydC53aWR0aCAqIGNvbnRlbnRTY2FsZUZhY3RvcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld3BvcnQuaGVpZ2h0ICogY29udGVudFNjYWxlRmFjdG9yXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBmcnVzdHVtID0gdGhpcy5fc2NyYXRjaFBlcnNwZWN0aXZlRnJ1c3R1bTtcclxuICAgICAgICAgICAgICAgIGZydXN0dW0uZm92ID0gTWF0aC5QSS8yO1xyXG4gICAgICAgICAgICAgICAgZnJ1c3R1bS5uZWFyID0gMC4wMTtcclxuICAgICAgICAgICAgICAgIGZydXN0dW0uZmFyID0gMTAwMDA7XHJcbiAgICAgICAgICAgICAgICBmcnVzdHVtLmFzcGVjdFJhdGlvID0gc3Vidmlld1ZpZXdwb3J0LndpZHRoIC8gc3Vidmlld1ZpZXdwb3J0LmhlaWdodDtcclxuICAgICAgICAgICAgICAgIGlmICghaXNGaW5pdGUoZnJ1c3R1bS5hc3BlY3RSYXRpbykgfHwgZnJ1c3R1bS5hc3BlY3RSYXRpbyA9PT0gMCkgZnJ1c3R1bS5hc3BlY3RSYXRpbyA9IDE7XHJcbiAgICAgICAgICAgICAgICBzdWJ2aWV3LnByb2plY3Rpb25NYXRyaXggPSBNYXRyaXg0LmNsb25lKGZydXN0dW0ucHJvamVjdGlvbk1hdHJpeCwgc3Vidmlldy5wcm9qZWN0aW9uTWF0cml4KTtcclxuXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gVW5kbyB0aGUgdmlkZW8gcm90YXRpb24gc2luY2Ugd2UgYWxyZWFkeSBlbmNvZGUgdGhlIGludGVyZmFjZSBvcmllbnRhdGlvbiBpbiBvdXIgdmlldyBwb3NlXHJcbiAgICAgICAgICAgICAgICAvLyBOb3RlOiB0aGUgXCJiYXNlXCIgcm90YXRpb24gZm9yIHZ1Zm9yaWEncyB2aWRlbyAoYXQgbGVhc3Qgb24gaU9TKSBpcyB0aGUgbGFuZHNjYXBlIHJpZ2h0IG9yaWVudGF0aW9uLFxyXG4gICAgICAgICAgICAgICAgLy8gd2hpY2ggaXMgdGhlIG9yaWVudGF0aW9uIHdoZXJlIHRoZSBkZXZpY2UgaXMgaGVsZCBpbiBsYW5kc2NhcGUgd2l0aCB0aGUgaG9tZSBidXR0b24gb24gdGhlIHJpZ2h0LiBcclxuICAgICAgICAgICAgICAgIC8vIFRoaXMgXCJiYXNlXCIgdmlkZW8gcm90YXRhdGlvbiBpcyAtOTAgZGVnIGFyb3VuZCAreiBmcm9tIHRoZSBwb3J0cmFpdCBpbnRlcmZhY2Ugb3JpZW50YXRpb25cclxuICAgICAgICAgICAgICAgIC8vIFNvLCB3ZSB3YW50IHRvIHVuZG8gdGhpcyByb3RhdGlvbiB3aGljaCB2dWZvcmlhIGFwcGxpZXMgZm9yIHVzLiAgXHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBjYWxjdWxhdGUgdGhpcyBtYXRyaXggb25seSB3aGVuIHdlIGhhdmUgdG8gKHdoZW4gdGhlIGludGVyZmFjZSBvcmllbnRhdGlvbiBjaGFuZ2VzKVxyXG4gICAgICAgICAgICAgICAgY29uc3QgaW52ZXJzZVZpZGVvUm90YXRpb25NYXRyaXggPSBNYXRyaXg0LmZyb21UcmFuc2xhdGlvblF1YXRlcm5pb25Sb3RhdGlvblNjYWxlKFxyXG4gICAgICAgICAgICAgICAgICAgIENhcnRlc2lhbjMuWkVSTyxcclxuICAgICAgICAgICAgICAgICAgICBRdWF0ZXJuaW9uLmZyb21BeGlzQW5nbGUoQ2FydGVzaWFuMy5VTklUX1osIChDZXNpdW1NYXRoLlBJX09WRVJfVFdPIC0gc2NyZWVuT3JpZW50YXRpb24gKiBNYXRoLlBJIC8gMTgwKSwgdGhpcy5fc2NyYXRjaFZpZGVvUXVhdGVybmlvbiksXHJcbiAgICAgICAgICAgICAgICAgICAgT05FLFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmF0Y2hWaWRlb01hdHJpeDRcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICBBcmdvbi5DZXNpdW0uTWF0cml4NC5tdWx0aXBseShwcm9qZWN0aW9uTWF0cml4LCBpbnZlcnNlVmlkZW9Sb3RhdGlvbk1hdHJpeCwgcHJvamVjdGlvbk1hdHJpeCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gY29udmVydCBmcm9tIHRoZSB2dWZvcmlhIHByb2plY3Rpb24gbWF0cml4ICgrWCAtWSArWikgdG8gYSBtb3JlIHN0YW5kYXJkIGNvbnZlbnRpb24gKCtYICtZIC1aKVxyXG4gICAgICAgICAgICAgICAgLy8gYnkgbmVnYXRpbmcgdGhlIGFwcHJvcHJpYXRlIGNvbHVtbnMuIFxyXG4gICAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLnZ1Zm9yaWEuY29tL2xpYnJhcnkvYXJ0aWNsZXMvU29sdXRpb24vSG93LVRvLVVzZS10aGUtQ2FtZXJhLVByb2plY3Rpb24tTWF0cml4XHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0aW9uTWF0cml4WzBdICo9IC0xOyAvLyB4XHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0aW9uTWF0cml4WzFdICo9IC0xOyAvLyB5XHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0aW9uTWF0cml4WzJdICo9IC0xOyAvLyB6XHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0aW9uTWF0cml4WzNdICo9IC0xOyAvLyB3XHJcblxyXG4gICAgICAgICAgICAgICAgcHJvamVjdGlvbk1hdHJpeFs4XSAqPSAtMTsgIC8vIHhcclxuICAgICAgICAgICAgICAgIHByb2plY3Rpb25NYXRyaXhbOV0gKj0gLTE7ICAvLyB5XHJcbiAgICAgICAgICAgICAgICBwcm9qZWN0aW9uTWF0cml4WzEwXSAqPSAtMTsgLy8gelxyXG4gICAgICAgICAgICAgICAgcHJvamVjdGlvbk1hdHJpeFsxMV0gKj0gLTE7IC8vIHdcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBBcmdvbi5DZXNpdW0uTWF0cml4NC5tdWx0aXBseUJ5U2NhbGUocHJvamVjdGlvbk1hdHJpeCwgQ2FydGVzaWFuMy5mcm9tRWxlbWVudHMoMSwtMSwtMSwgdGhpcy5fc2NyYXRjaENhcnRlc2lhbiksIHByb2plY3Rpb25NYXRyaXgpXHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU2NhbGUgdGhlIHByb2plY3Rpb24gbWF0cml4IHRvIGZpdCBuaWNlbHkgd2l0aGluIGEgc3VidmlldyBvZiB0eXBlIFNJTkdVTEFSXHJcbiAgICAgICAgICAgICAgICAvLyAoVGhpcyBzY2FsZSB3aWxsIG5vdCBhcHBseSB3aGVuIHRoZSB1c2VyIGlzIHdlYXJpbmcgYSBtb25vY3VsYXIgSE1ELCBzaW5jZSBhXHJcbiAgICAgICAgICAgICAgICAvLyBtb25vY3VsYXIgSE1EIHdvdWxkIHByb3ZpZGUgYSBzdWJ2aWV3IG9mIHR5cGUgTEVGVEVZRSBvciBSSUdIVEVZRSlcclxuICAgICAgICAgICAgICAgIC8vIGlmIChzdWJ2aWV3LnR5cGUgPT0gQXJnb24uU3Vidmlld1R5cGUuU0lOR1VMQVIpIHtcclxuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCB3aWR0aFJhdGlvID0gc3Vidmlld1dpZHRoIC8gdmlkZW9Nb2RlLndpZHRoO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnN0IGhlaWdodFJhdGlvID0gc3Vidmlld0hlaWdodCAvIHZpZGVvTW9kZS5oZWlnaHQ7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gICAgIC8vIGFzcGVjdCBmaWxsXHJcbiAgICAgICAgICAgICAgICAvLyAgICAgY29uc3Qgc2NhbGVGYWN0b3IgPSBNYXRoLm1heCh3aWR0aFJhdGlvLCBoZWlnaHRSYXRpbyk7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgLy8gb3IgYXNwZWN0IGZpdFxyXG4gICAgICAgICAgICAgICAgLy8gICAgIC8vIGNvbnN0IHNjYWxlRmFjdG9yID0gTWF0aC5taW4od2lkdGhSYXRpbywgaGVpZ2h0UmF0aW8pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vICAgICAvLyBzY2FsZSB4LWF4aXNcclxuICAgICAgICAgICAgICAgIC8vICAgICBwcm9qZWN0aW9uTWF0cml4WzBdICo9IHNjYWxlRmFjdG9yOyAvLyB4XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgcHJvamVjdGlvbk1hdHJpeFsxXSAqPSBzY2FsZUZhY3RvcjsgLy8geVxyXG4gICAgICAgICAgICAgICAgLy8gICAgIHByb2plY3Rpb25NYXRyaXhbMl0gKj0gc2NhbGVGYWN0b3I7IC8vIHpcclxuICAgICAgICAgICAgICAgIC8vICAgICBwcm9qZWN0aW9uTWF0cml4WzNdICo9IHNjYWxlRmFjdG9yOyAvLyB3XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgLy8gc2NhbGUgeS1heGlzXHJcbiAgICAgICAgICAgICAgICAvLyAgICAgcHJvamVjdGlvbk1hdHJpeFs0XSAqPSBzY2FsZUZhY3RvcjsgLy8geFxyXG4gICAgICAgICAgICAgICAgLy8gICAgIHByb2plY3Rpb25NYXRyaXhbNV0gKj0gc2NhbGVGYWN0b3I7IC8vIHlcclxuICAgICAgICAgICAgICAgIC8vICAgICBwcm9qZWN0aW9uTWF0cml4WzZdICo9IHNjYWxlRmFjdG9yOyAvLyB6XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgcHJvamVjdGlvbk1hdHJpeFs3XSAqPSBzY2FsZUZhY3RvcjsgLy8gd1xyXG4gICAgICAgICAgICAgICAgLy8gfVxyXG5cclxuICAgICAgICAgICAgICAgIHN1YnZpZXcucHJvamVjdGlvbk1hdHJpeCA9IE1hdHJpeDQuY2xvbmUocHJvamVjdGlvbk1hdHJpeCwgc3Vidmlldy5wcm9qZWN0aW9uTWF0cml4KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIC8vIGNvbnN0IGV5ZUFkanVzdG1lbnRNYXRyaXggPSByZW5kZXJpbmdQcmltaXRpdmVzLmdldEV5ZURpc3BsYXlBZGp1c3RtZW50TWF0cml4KHZpZXcpO1xyXG4gICAgICAgICAgICAvLyBsZXQgcHJvamVjdGlvbk1hdHJpeCA9IEFyZ29uLkNlc2l1bS5NYXRyaXg0Lm11bHRpcGx5KHJhd1Byb2plY3Rpb25NYXRyaXgsIGV5ZUFkanVzdG1lbnRNYXRyaXgsIFtdKTtcclxuICAgICAgICAgICAgLy8gcHJvamVjdGlvbk1hdHJpeCA9IEFyZ29uLkNlc2l1bS5NYXRyaXg0LmZyb21Sb3dNYWpvckFycmF5KHByb2plY3Rpb25NYXRyaXgsIHByb2plY3Rpb25NYXRyaXgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVE9ETzogdXNlIGV5ZSBhZGp1c3RtZW50IG1hdHJpeCB0byBzZXQgc3VidmlldyBwb3NlcyAoZm9yIGV5ZSBzZXBhcmF0aW9uKS4gU2VlIGNvbW1lbnRlZCBvdXQgY29kZSBhYm92ZS4uLlxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGxvY2F0aW9uV2F0Y2hJZD86bnVtYmVyO1xyXG5cclxuICAgIHByaXZhdGUgX3NjcmF0Y2hTdGFnZUNhcnRvZ3JhcGhpYyA9IG5ldyBBcmdvbi5DZXNpdW0uQ2FydG9ncmFwaGljO1xyXG5cclxuICAgIHB1YmxpYyBvblN0YXJ0R2VvbG9jYXRpb25VcGRhdGVzKG9wdGlvbnM6QXJnb24uR2VvbG9jYXRpb25PcHRpb25zKSA6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5sb2NhdGlvbldhdGNoSWQgIT09ICd1bmRlZmluZWQnKSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KT0+e1xyXG5cclxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIGQudHMgZm9yIG5hdGl2ZXNjcmlwdC1nZW9sb2NhdGlvbiBpcyB3cm9uZy4gVGhpcyBjYWxsIGlzIGNvcnJlY3QuIFxyXG4gICAgICAgICAgICAvLyBDYXN0aW5nIHRoZSBtb2R1bGUgYXMgPGFueT4gaGVyZSBmb3Igbm93IHRvIGhpZGUgYW5ub3lpbmcgdHlwZXNjcmlwdCBlcnJvcnMuLi5cclxuICAgICAgICAgICAgdGhpcy5sb2NhdGlvbldhdGNoSWQgPSAoPGFueT5nZW9sb2NhdGlvbikud2F0Y2hMb2NhdGlvbigobG9jYXRpb246Z2VvbG9jYXRpb24uTG9jYXRpb24pPT57XHJcbiAgICAgICAgICAgICAgICAvLyBOb3RlOiBpT1MgZG9jdW1lbnRhdGlvbiBzdGF0ZXMgdGhhdCB0aGUgYWx0aXR1ZGUgdmFsdWUgcmVmZXJzIHRvIGhlaWdodCAobWV0ZXJzKSBhYm92ZSBzZWEgbGV2ZWwsIGJ1dCBcclxuICAgICAgICAgICAgICAgIC8vIGlmIGlvcyBpcyByZXBvcnRpbmcgdGhlIHN0YW5kYXJkIGdwcyBkZWZpbmVkIGFsdGl0dWRlLCB0aGVuIHRoaXMgdGhlb3JldGljYWwgXCJzZWEgbGV2ZWxcIiBhY3R1YWxseSByZWZlcnMgdG8gXHJcbiAgICAgICAgICAgICAgICAvLyB0aGUgV0dTODQgZWxsaXBzb2lkIHJhdGhlciB0aGFuIHRyYWRpdGlvbmFsIG1lYW4gc2VhIGxldmVsIChNU0wpIHdoaWNoIGlzIG5vdCBhIHNpbXBsZSBzdXJmYWNlIGFuZCB2YXJpZXMgXHJcbiAgICAgICAgICAgICAgICAvLyBhY2NvcmRpbmcgdG8gdGhlIGxvY2FsIGdyYXZpdGF0aW9uYWwgZmllbGQuIFxyXG4gICAgICAgICAgICAgICAgLy8gSW4gb3RoZXIgd29yZHMsIG15IGJlc3QgZ3Vlc3MgaXMgdGhhdCB0aGUgYWx0aXR1ZGUgdmFsdWUgaGVyZSBpcyAqcHJvYmFibHkqIEdQUyBkZWZpbmVkIGFsdGl0dWRlLCB3aGljaCBcclxuICAgICAgICAgICAgICAgIC8vIGlzIGVxdWl2YWxlbnQgdG8gdGhlIGhlaWdodCBhYm92ZSB0aGUgV0dTODQgZWxsaXBzb2lkLCB3aGljaCBpcyBleGFjdGx5IHdoYXQgQ2VzaXVtIGV4cGVjdHMuLi5cclxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlndXJlU3RhZ2UoXHJcbiAgICAgICAgICAgICAgICAgICAgQXJnb24uQ2VzaXVtLkNhcnRvZ3JhcGhpYy5mcm9tRGVncmVlcyhsb2NhdGlvbi5sb25naXR1ZGUsIGxvY2F0aW9uLmxhdGl0dWRlLCBsb2NhdGlvbi5hbHRpdHVkZSwgdGhpcy5fc2NyYXRjaFN0YWdlQ2FydG9ncmFwaGljKSxcclxuICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbi5ob3Jpem9udGFsQWNjdXJhY3ksIFxyXG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uLnZlcnRpY2FsQWNjdXJhY3lcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH0sIFxyXG4gICAgICAgICAgICAoZSk9PntcclxuICAgICAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgICAgfSwgPGdlb2xvY2F0aW9uLk9wdGlvbnM+e1xyXG4gICAgICAgICAgICAgICAgZGVzaXJlZEFjY3VyYWN5OiBvcHRpb25zICYmIG9wdGlvbnMuZW5hYmxlSGlnaEFjY3VyYWN5ID8gXHJcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb24uaW9zID8gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtDTExvY2F0aW9uQWNjdXJhY3lCZXN0IDogXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW1zLkFjY3VyYWN5LmhpZ2ggOiBcclxuICAgICAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5pb3MgPyBcclxuICAgICAgICAgICAgICAgICAgICAgICAga0NMTG9jYXRpb25BY2N1cmFjeU5lYXJlc3RUZW5NZXRlcnMgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAxMCxcclxuICAgICAgICAgICAgICAgIHVwZGF0ZURpc3RhbmNlOiBhcHBsaWNhdGlvbi5pb3MgPyBrQ0xEaXN0YW5jZUZpbHRlck5vbmUgOiAwLFxyXG4gICAgICAgICAgICAgICAgbWluaW11bVVwZGF0ZVRpbWUgOiBvcHRpb25zICYmIG9wdGlvbnMuZW5hYmxlSGlnaEFjY3VyYWN5ID9cclxuICAgICAgICAgICAgICAgICAgICAwIDogNTAwMCAvLyByZXF1aXJlZCBvbiBBbmRyb2lkLCBpZ25vcmVkIG9uIGlPU1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQ3JlYXRpbmcgbG9jYXRpb24gd2F0Y2hlci4gXCIgKyB0aGlzLmxvY2F0aW9uV2F0Y2hJZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgXHJcbiAgICBwdWJsaWMgb25TdG9wR2VvbG9jYXRpb25VcGRhdGVzKCkgOiB2b2lkIHtcclxuICAgICAgICBpZiAoQXJnb24uQ2VzaXVtLmRlZmluZWQodGhpcy5sb2NhdGlvbldhdGNoSWQpKSB7XHJcbiAgICAgICAgICAgIGdlb2xvY2F0aW9uLmNsZWFyV2F0Y2godGhpcy5sb2NhdGlvbldhdGNoSWQpO1xyXG4gICAgICAgICAgICB0aGlzLmxvY2F0aW9uV2F0Y2hJZCA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZW5zdXJlUGVybWlzc2lvbihzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZm9jdXNTZXJ2aWNlUHJvdmlkZXIuc2Vzc2lvbiA9PSBzZXNzaW9uKSByZXR1cm47IFxyXG4gICAgICAgIGlmIChzZXNzaW9uID09IHRoaXMuc2Vzc2lvblNlcnZpY2UubWFuYWdlcikgcmV0dXJuO1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2Vzc2lvbiBkb2VzIG5vdCBoYXZlIGZvY3VzLicpXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGhhbmRsZVJlcXVlc3RQcmVzZW50SE1EKHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQpIHtcclxuICAgICAgICB0aGlzLl9lbnN1cmVQZXJtaXNzaW9uKHNlc3Npb24pO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBoYW5kbGVFeGl0UHJlc2VudEhNRChzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KSB7XHJcbiAgICAgICAgdGhpcy5fZW5zdXJlUGVybWlzc2lvbihzZXNzaW9uKTtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9XHJcblxyXG59Il19