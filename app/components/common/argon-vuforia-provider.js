"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Argon = require("@argonjs/argon");
var vuforia = require("nativescript-vuforia");
var http = require("http");
var file = require("file-system");
var platform = require("platform");
var absolute_layout_1 = require("ui/layouts/absolute-layout");
var util = require("./util");
var minimatch = require("minimatch");
var URI = require("urijs");
var config_1 = require("../../config");
exports.vuforiaCameraDeviceMode = vuforia.CameraDeviceMode.OptimizeSpeed; //application.android ? vuforia.CameraDeviceMode.OptimizeSpeed : vuforia.CameraDeviceMode.OpimizeQuality;
// if (vuforia.videoView.ios) {
//     (<UIView>vuforia.videoView.ios).contentScaleFactor = platform.screen.mainScreen.scale;
// }
exports.VIDEO_DELAY = -0.5 / 60;
var Matrix4 = Argon.Cesium.Matrix4;
var Cartesian3 = Argon.Cesium.Cartesian3;
var Quaternion = Argon.Cesium.Quaternion;
var JulianDate = Argon.Cesium.JulianDate;
var CesiumMath = Argon.Cesium.CesiumMath;
var x180 = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, CesiumMath.PI);
var VuforiaSessionData = (function () {
    function VuforiaSessionData(keyPromise) {
        this.keyPromise = keyPromise;
        this.commandQueue = new Argon.CommandQueue;
        this.loadedDataSets = new Set();
        this.activatedDataSets = new Set();
        this.dataSetUriById = new Map();
        this.dataSetIdByUri = new Map();
        this.dataSetInstanceById = new Map();
        this.hintValues = new Map();
    }
    return VuforiaSessionData;
}());
var NativescriptVuforiaServiceProvider = (function () {
    function NativescriptVuforiaServiceProvider(sessionService, focusServiceProvider, contextService, 
        // private deviceService:Argon.DeviceService,
        entityServiceProvider, realityService) {
        // this.sessionService.connectEvent.addEventListener(()=>{
        //     this.stateUpdateEvent.addEventListener(()=>{
        //         const reality = this.contextService.serializedFrameState.reality;
        //         if (reality === Argon.RealityViewer.LIVE) this.deviceService.update();
        //     });
        //     setTimeout(()=>{
        //         const reality = this.contextService.serializedFrameState.reality;
        //         if (reality !== Argon.RealityViewer.LIVE) this.deviceService.update();
        //     }, 60)
        // })
        var _this = this;
        this.sessionService = sessionService;
        this.focusServiceProvider = focusServiceProvider;
        this.contextService = contextService;
        this.entityServiceProvider = entityServiceProvider;
        this.stateUpdateEvent = new Argon.Event();
        this.vuforiaTrackerEntity = new Argon.Cesium.Entity({
            position: new Argon.Cesium.ConstantPositionProperty(Cartesian3.ZERO, this.contextService.user),
            orientation: new Argon.Cesium.ConstantProperty(Quaternion.IDENTITY)
        });
        this._scratchCartesian = new Argon.Cesium.Cartesian3();
        this._scratchQuaternion = new Argon.Cesium.Quaternion();
        this._scratchMatrix3 = new Argon.Cesium.Matrix3();
        this._sessionSwitcherCommandQueue = new Argon.CommandQueue();
        this._sessionData = new WeakMap();
        this._config = {};
        sessionService.connectEvent.addEventListener(function (session) {
            if (!vuforia.api) {
                session.on['ar.vuforia.isAvailable'] =
                    function () { return Promise.resolve({ available: false }); };
                session.on['ar.vuforia.init'] =
                    function (initOptions) { return Promise.reject(new Error("Vuforia is not supported on this platform")); };
            }
            else {
                session.on['ar.vuforia.isAvailable'] =
                    function () { return Promise.resolve({ available: !!vuforia.api }); };
                session.on['ar.vuforia.init'] =
                    function (initOptions) { return _this._handleInit(session, initOptions); };
                session.on['ar.vuforia.objectTrackerCreateDataSet'] =
                    function (_a) {
                        var url = _a.url;
                        return _this._handleObjectTrackerCreateDataSet(session, url);
                    };
                session.on['ar.vuforia.objectTrackerLoadDataSet'] =
                    function (_a) {
                        var id = _a.id;
                        return _this._handleObjectTrackerLoadDataSet(session, id);
                    };
                session.on['ar.vuforia.objectTrackerActivateDataSet'] =
                    function (_a) {
                        var id = _a.id;
                        return _this._handleObjectTrackerActivateDataSet(session, id);
                    };
                session.on['ar.vuforia.objectTrackerDeactivateDataSet'] =
                    function (_a) {
                        var id = _a.id;
                        return _this._handleObjectTrackerDeactivateDataSet(session, id);
                    };
                session.on['ar.vuforia.objectTrackerUnloadDataSet'] =
                    function (_a) {
                        var id = _a.id;
                        return _this._handleObjectTrackerUnloadDataSet(session, id);
                    };
                session.on['ar.vuforia.setHint'] =
                    function (options) { return _this._setHint(session, options); };
                // backwards compatability
                session.on['ar.vuforia.dataSetFetch'] = session.on['ar.vuforia.objectTrackerLoadDataSet'];
                session.on['ar.vuforia.dataSetLoad'] = function (_a) {
                    var id = _a.id;
                    return _this._handleObjectTrackerLoadDataSet(session, id);
                };
            }
            session.closeEvent.addEventListener(function () { return _this._handleClose(session); });
        });
        if (!vuforia.api)
            return;
        // // switch to AR mode when LIVE reality is presenting
        // realityService.changeEvent.addEventListener(({current})=>{
        //     this._setDeviceMode(
        //         current === Argon.RealityViewer.LIVE ? 
        //             vuforia.DeviceMode.AR : vuforia.DeviceMode.VR
        //     );
        // });
        var landscapeRightScreenOrientationRadians = -CesiumMath.PI_OVER_TWO;
        var stateUpdateCallback = function (state) {
            var time = JulianDate.now();
            // subtract a few ms, since the video frame represents a time slightly in the past.
            // TODO: if we are using an optical see-through display, like hololens,
            // we want to do the opposite, and do forward prediction (though ideally not here, 
            // but in each app itself to we are as close as possible to the actual render time when
            // we start the render)
            JulianDate.addSeconds(time, exports.VIDEO_DELAY, time);
            // Rotate the tracker to a landscape-right frame, 
            // where +X is right, +Y is down, and +Z is in the camera direction
            // (vuforia reports poses in this frame on iOS devices, not sure about android)
            var currentScreenOrientationRadians = util.screenOrientation * CesiumMath.RADIANS_PER_DEGREE;
            var trackerOrientation = Quaternion.multiply(Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, landscapeRightScreenOrientationRadians - currentScreenOrientationRadians, _this._scratchQuaternion), x180, _this._scratchQuaternion);
            _this.vuforiaTrackerEntity.orientation.setValue(trackerOrientation);
            var vuforiaFrame = state.getFrame();
            var frameTimeStamp = vuforiaFrame.getTimeStamp();
            // update trackable results in context entity collection
            var numTrackableResults = state.getNumTrackableResults();
            for (var i = 0; i < numTrackableResults; i++) {
                var trackableResult = state.getTrackableResult(i);
                var trackable = trackableResult.getTrackable();
                var name = trackable.getName();
                var id = _this._getIdForTrackable(trackable);
                var entity = contextService.entities.getById(id);
                if (!entity) {
                    entity = new Argon.Cesium.Entity({
                        id: id,
                        name: name,
                        position: new Argon.Cesium.SampledPositionProperty(_this.vuforiaTrackerEntity),
                        orientation: new Argon.Cesium.SampledProperty(Argon.Cesium.Quaternion)
                    });
                    var entityPosition = entity.position;
                    var entityOrientation = entity.orientation;
                    entityPosition.maxNumSamples = 10;
                    entityOrientation.maxNumSamples = 10;
                    entityPosition.forwardExtrapolationType = Argon.Cesium.ExtrapolationType.HOLD;
                    entityOrientation.forwardExtrapolationType = Argon.Cesium.ExtrapolationType.HOLD;
                    entityPosition.forwardExtrapolationDuration = 10 / 60;
                    entityOrientation.forwardExtrapolationDuration = 10 / 60;
                    contextService.entities.add(entity);
                    _this.entityServiceProvider.targetReferenceFrameMap.set(id, _this.contextService.user.id);
                }
                var trackableTime = JulianDate.clone(time);
                // add any time diff from vuforia
                var trackableTimeDiff = trackableResult.getTimeStamp() - frameTimeStamp;
                if (trackableTimeDiff !== 0)
                    JulianDate.addSeconds(time, trackableTimeDiff, trackableTime);
                var pose = trackableResult.getPose();
                var position = Matrix4.getTranslation(pose, _this._scratchCartesian);
                var rotationMatrix = Matrix4.getRotation(pose, _this._scratchMatrix3);
                var orientation = Quaternion.fromRotationMatrix(rotationMatrix, _this._scratchQuaternion);
                entity.position.addSample(trackableTime, position);
                entity.orientation.addSample(trackableTime, orientation);
            }
            // try {
            _this.stateUpdateEvent.raiseEvent(time);
            // } catch(e) {
            // this.sessionService.errorEvent.raiseEvent(e);
            // }
        };
        vuforia.api.setStateUpdateCallback(stateUpdateCallback);
        // make sure the currently focussed session has priority
        this.focusServiceProvider.sessionFocusEvent.addEventListener(function () {
            _this._selectControllingSession();
        });
    }
    // private _deviceMode = vuforia.DeviceMode.VR;
    // private _setDeviceMode(deviceMode: vuforia.DeviceMode) {
    //     this._deviceMode = deviceMode;
    //     // following may fail (return false) if vuforia is not currently initialized, 
    //     // but that's okay (since next time we initilaize we will use the saved mode). 
    //     vuforia.api.getDevice().setMode(deviceMode); 
    // } 
    NativescriptVuforiaServiceProvider.prototype._getSessionData = function (session) {
        var sessionData = this._sessionData.get(session);
        if (!sessionData)
            throw new Error('Vuforia must be initialized first');
        return sessionData;
    };
    NativescriptVuforiaServiceProvider.prototype._getCommandQueueForSession = function (session) {
        var sessionData = this._sessionData.get(session);
        if (!sessionData.commandQueue)
            throw new Error('Vuforia must be initialized first');
        return sessionData.commandQueue;
    };
    NativescriptVuforiaServiceProvider.prototype._selectControllingSession = function () {
        var focusSession = this.focusServiceProvider.session;
        if (focusSession &&
            focusSession.isConnected &&
            this._sessionData.has(focusSession)) {
            this._setControllingSession(focusSession);
            return;
        }
        if (this._controllingSession &&
            this._controllingSession.isConnected &&
            this._sessionData.has(this._controllingSession))
            return;
        // pick a different session as the controlling session
        // TODO: prioritize any sessions other than the focussed session?
        for (var _i = 0, _a = this.sessionService.managedSessions; _i < _a.length; _i++) {
            var session = _a[_i];
            if (this._sessionData.has(session)) {
                this._setControllingSession(session);
                return;
            }
        }
        // if no other session is available,
        // fallback to the manager as the controlling session
        if (this._sessionData.has(this.sessionService.manager))
            this._setControllingSession(this.sessionService.manager);
    };
    NativescriptVuforiaServiceProvider.prototype._setControllingSession = function (session) {
        var _this = this;
        if (this._controllingSession === session)
            return;
        console.log("VuforiaService: Setting controlling session to " + session.uri);
        if (this._controllingSession) {
            var previousSession_1 = this._controllingSession;
            this._controllingSession = undefined;
            this._sessionSwitcherCommandQueue.push(function () {
                return _this._pauseSession(previousSession_1);
            });
        }
        this._controllingSession = session;
        this._sessionSwitcherCommandQueue.push(function () {
            return _this._resumeSession(session);
        }, true).catch(function () {
            _this._controllingSession = undefined;
            _this._setControllingSession(_this.sessionService.manager);
        });
    };
    NativescriptVuforiaServiceProvider.prototype._pauseSession = function (session) {
        var _this = this;
        console.log('Vuforia: Pausing session ' + session.uri + '...');
        var sessionData = this._getSessionData(session);
        var commandQueue = sessionData.commandQueue;
        return commandQueue.push(function () {
            commandQueue.pause();
            // If the session is closed, we set the permanent flag to true.
            // Likewise, if the session is not closed, we set the permanent flat to false,
            // maintaining the current session state.
            var permanent = session.isClosed;
            var objectTracker = vuforia.api.getObjectTracker();
            if (objectTracker)
                objectTracker.stop();
            var activatedDataSets = sessionData.activatedDataSets;
            if (activatedDataSets) {
                activatedDataSets.forEach(function (id) {
                    _this._objectTrackerDeactivateDataSet(session, id, permanent);
                });
            }
            var loadedDataSets = sessionData.loadedDataSets;
            if (loadedDataSets) {
                loadedDataSets.forEach(function (id) {
                    _this._objectTrackerUnloadDataSet(session, id, permanent);
                });
            }
            console.log('Vuforia: deinitializing...');
            vuforia.api.getCameraDevice().stop();
            vuforia.api.getCameraDevice().deinit();
            vuforia.api.deinitObjectTracker();
            vuforia.api.deinit();
            if (permanent) {
                _this._sessionData.delete(session);
            }
        }, true);
    };
    NativescriptVuforiaServiceProvider.prototype._resumeSession = function (session) {
        var commandQueue = this._getCommandQueueForSession(session);
        console.log('Vuforia: Resuming session ' + session.uri + '...');
        return this._init(session).then(function () {
            commandQueue.execute();
        });
    };
    NativescriptVuforiaServiceProvider.prototype._init = function (session) {
        var _this = this;
        var sessionData = this._getSessionData(session);
        var keyPromise = sessionData.keyPromise;
        if (!keyPromise)
            throw new Error('Vuforia: Invalid State. Missing Key.');
        return keyPromise.then(function (key) {
            if (!vuforia.api.setLicenseKey(key)) {
                return Promise.reject(new Error('Vuforia: Unable to set the license key'));
            }
            console.log('Vuforia: initializing...');
            return vuforia.api.init().then(function (result) {
                console.log('Vuforia: Init Result: ' + result);
                var resolveInitResult = sessionData.initResultResolver;
                if (resolveInitResult) {
                    resolveInitResult(result);
                    sessionData.initResultResolver = undefined;
                }
                if (result !== vuforia.InitResult.SUCCESS) {
                    throw new Error(vuforia.InitResult[result]);
                }
                // must initialize trackers before initializing the camera device
                if (!vuforia.api.initObjectTracker()) {
                    throw new Error("Vuforia: Unable to initialize ObjectTracker");
                }
                var cameraDevice = vuforia.api.getCameraDevice();
                console.log("Vuforia: initializing camera device...");
                if (!cameraDevice.init(vuforia.CameraDeviceDirection.Default))
                    throw new Error('Unable to initialize camera device');
                if (!cameraDevice.selectVideoMode(exports.vuforiaCameraDeviceMode))
                    throw new Error('Unable to select video mode');
                if (!vuforia.api.getDevice().setMode(vuforia.DeviceMode.AR))
                    throw new Error('Unable to set device mode');
                // this.configureVuforiaVideoBackground({
                //     x:0,
                //     y:0,
                //     width:vuforia.videoView.getActualSize().width, //getMeasuredWidth(), 
                //     height:vuforia.videoView.getActualSize().height //getMeasuredHeight()
                // }, false);
                if (!vuforia.api.getCameraDevice().start())
                    throw new Error('Unable to start camera');
                if (sessionData.hintValues) {
                    sessionData.hintValues.forEach(function (value, hint, map) {
                        vuforia.api.setHint(hint, value);
                    });
                }
                var loadedDataSets = sessionData.loadedDataSets;
                var loadPromises = [];
                if (loadedDataSets) {
                    loadedDataSets.forEach(function (id) {
                        loadPromises.push(_this._objectTrackerLoadDataSet(session, id));
                    });
                }
                return Promise.all(loadPromises);
            }).then(function () {
                var activatedDataSets = sessionData.activatedDataSets;
                var activatePromises = [];
                if (activatedDataSets) {
                    activatedDataSets.forEach(function (id) {
                        activatePromises.push(_this._objectTrackerActivateDataSet(session, id));
                    });
                }
                return activatePromises;
            }).then(function () {
                var objectTracker = vuforia.api.getObjectTracker();
                if (!objectTracker)
                    throw new Error('Vuforia: Unable to get objectTracker instance');
                objectTracker.start();
            });
        });
    };
    NativescriptVuforiaServiceProvider.prototype._handleInit = function (session, options) {
        if (!options.key && !options.encryptedLicenseData)
            throw new Error('No license key was provided. Get one from https://developer.vuforia.com/');
        if (this._sessionData.has(session))
            throw new Error('Already initialized');
        var keyPromise = Promise.resolve(options.key ?
            options.key :
            util.canDecrypt ?
                this._decryptLicenseKey(options.encryptedLicenseData, session) :
                util.getInternalVuforiaKey());
        var sessionData = new VuforiaSessionData(keyPromise);
        this._sessionData.set(session, sessionData);
        var initResultPromise = new Promise(function (resolve) {
            sessionData.initResultResolver = resolve;
        });
        this._selectControllingSession();
        return keyPromise.then(function () { return initResultPromise; });
    };
    NativescriptVuforiaServiceProvider.prototype._handleClose = function (session) {
        if (this._controllingSession === session) {
            this._selectControllingSession();
        }
    };
    NativescriptVuforiaServiceProvider.prototype._handleObjectTrackerCreateDataSet = function (session, uri) {
        var _this = this;
        return fetchDataSet(uri).then(function () {
            var sessionData = _this._getSessionData(session);
            var id = sessionData.dataSetIdByUri.get(uri);
            if (!id) {
                id = Argon.Cesium.createGuid();
                sessionData.dataSetIdByUri.set(uri, id);
                sessionData.dataSetUriById.set(id, uri);
            }
            return { id: id };
        });
    };
    NativescriptVuforiaServiceProvider.prototype._objectTrackerLoadDataSet = function (session, id) {
        var _this = this;
        var sessionData = this._getSessionData(session);
        var uri = sessionData.dataSetUriById.get(id);
        if (!uri)
            throw new Error("Vuforia: Unknown DataSet id: " + id);
        var objectTracker = vuforia.api.getObjectTracker();
        if (!objectTracker)
            throw new Error('Vuforia: Invalid State. Unable to get ObjectTracker instance.');
        var dataSet = sessionData.dataSetInstanceById.get(id);
        var trackablesPromise;
        if (dataSet) {
            trackablesPromise = Promise.resolve(this._getTrackablesFromDataSet(dataSet));
        }
        else {
            console.log("Vuforia: Loading dataset (" + id + ") from " + uri + "...");
            trackablesPromise = fetchDataSet(uri).then(function (location) {
                dataSet = objectTracker.createDataSet();
                if (!dataSet)
                    throw new Error("Vuforia: Unable to create dataset instance");
                if (dataSet.load(location, vuforia.StorageType.Absolute)) {
                    sessionData.dataSetInstanceById.set(id, dataSet);
                    sessionData.loadedDataSets.add(id);
                    var trackables = _this._getTrackablesFromDataSet(dataSet);
                    console.log('Vuforia loaded dataset file with trackables:\n' + JSON.stringify(trackables));
                    return trackables;
                }
                objectTracker.destroyDataSet(dataSet);
                console.log("Unable to load downloaded dataset at " + location + " from " + uri);
                throw new Error('Unable to load dataset');
            });
        }
        if (session.version[0] > 0) {
            trackablesPromise.then(function (trackables) {
                session.send('ar.vuforia.objectTrackerLoadDataSetEvent', { id: id, trackables: trackables });
            });
        }
        return trackablesPromise;
    };
    NativescriptVuforiaServiceProvider.prototype._getTrackablesFromDataSet = function (dataSet) {
        var numTrackables = dataSet.getNumTrackables();
        var trackables = {};
        for (var i = 0; i < numTrackables; i++) {
            var trackable = dataSet.getTrackable(i);
            trackables[trackable.getName()] = {
                id: this._getIdForTrackable(trackable),
                size: trackable instanceof vuforia.ObjectTarget ? trackable.getSize() : { x: 0, y: 0, z: 0 }
            };
        }
        return trackables;
    };
    NativescriptVuforiaServiceProvider.prototype._handleObjectTrackerLoadDataSet = function (session, id) {
        var _this = this;
        return this._getCommandQueueForSession(session).push(function () {
            return _this._objectTrackerLoadDataSet(session, id);
        });
    };
    NativescriptVuforiaServiceProvider.prototype._objectTrackerActivateDataSet = function (session, id) {
        console.log("Vuforia activating dataset (" + id + ")");
        var objectTracker = vuforia.api.getObjectTracker();
        if (!objectTracker)
            throw new Error('Vuforia: Invalid State. Unable to get ObjectTracker instance.');
        var sessionData = this._getSessionData(session);
        var dataSet = sessionData.dataSetInstanceById.get(id);
        var dataSetPromise;
        if (!dataSet) {
            dataSetPromise = this._objectTrackerLoadDataSet(session, id).then(function () {
                return sessionData.dataSetInstanceById.get(id);
            });
        }
        else {
            dataSetPromise = Promise.resolve(dataSet);
        }
        return dataSetPromise.then(function (dataSet) {
            if (!objectTracker.activateDataSet(dataSet))
                throw new Error("Vuforia: Unable to activate dataSet " + id);
            sessionData.activatedDataSets.add(id);
            if (session.version[0] > 0)
                session.send('ar.vuforia.objectTrackerActivateDataSetEvent', { id: id });
        });
    };
    NativescriptVuforiaServiceProvider.prototype._handleObjectTrackerActivateDataSet = function (session, id) {
        var _this = this;
        return this._getCommandQueueForSession(session).push(function () {
            return _this._objectTrackerActivateDataSet(session, id);
        });
    };
    NativescriptVuforiaServiceProvider.prototype._objectTrackerDeactivateDataSet = function (session, id, permanent) {
        if (permanent === void 0) { permanent = true; }
        console.log("Vuforia deactivating dataset (" + id + ")");
        var sessionData = this._getSessionData(session);
        var objectTracker = vuforia.api.getObjectTracker();
        if (objectTracker) {
            var dataSet = sessionData.dataSetInstanceById.get(id);
            if (dataSet != null) {
                var success = objectTracker.deactivateDataSet(dataSet);
                if (success) {
                    if (permanent) {
                        sessionData.activatedDataSets.delete(id);
                    }
                    if (session.version[0] > 0)
                        session.send('ar.vuforia.objectTrackerDeactivateDataSetEvent', { id: id });
                }
                return success;
            }
        }
        return false;
    };
    NativescriptVuforiaServiceProvider.prototype._handleObjectTrackerDeactivateDataSet = function (session, id) {
        var _this = this;
        return this._getCommandQueueForSession(session).push(function () {
            if (!_this._objectTrackerDeactivateDataSet(session, id))
                throw new Error("Vuforia: unable to activate dataset " + id);
        });
    };
    NativescriptVuforiaServiceProvider.prototype._objectTrackerUnloadDataSet = function (session, id, permanent) {
        if (permanent === void 0) { permanent = true; }
        console.log("Vuforia: unloading dataset (permanent:" + permanent + " id:" + id + ")...");
        var sessionData = this._getSessionData(session);
        var objectTracker = vuforia.api.getObjectTracker();
        if (objectTracker) {
            var dataSet = sessionData.dataSetInstanceById.get(id);
            if (dataSet != null) {
                var deleted = objectTracker.destroyDataSet(dataSet);
                if (deleted) {
                    sessionData.dataSetInstanceById.delete(id);
                    if (permanent) {
                        var uri = sessionData.dataSetUriById.get(id);
                        sessionData.dataSetIdByUri.delete(uri);
                        sessionData.loadedDataSets.delete(id);
                        sessionData.dataSetUriById.delete(id);
                    }
                    if (session.version[0] > 0)
                        session.send('ar.vuforia.objectTrackerUnloadDataSetEvent', { id: id });
                }
                return deleted;
            }
        }
        return false;
    };
    NativescriptVuforiaServiceProvider.prototype._handleObjectTrackerUnloadDataSet = function (session, id) {
        var _this = this;
        return this._getCommandQueueForSession(session).push(function () {
            if (!_this._objectTrackerUnloadDataSet(session, id))
                throw new Error("Vuforia: unable to unload dataset " + id);
        });
    };
    NativescriptVuforiaServiceProvider.prototype._getIdForTrackable = function (trackable) {
        if (trackable instanceof vuforia.ObjectTarget) {
            return 'vuforia_object_target_' + trackable.getUniqueTargetId();
        }
        else {
            return 'vuforia_trackable_' + trackable.getId();
        }
    };
    NativescriptVuforiaServiceProvider.prototype._setHint = function (session, options) {
        var _this = this;
        return this._getCommandQueueForSession(session).push(function () {
            if (options.hint === undefined || options.value === undefined)
                throw new Error('setHint requires hint and value');
            var success = vuforia.api.setHint(options.hint, options.value);
            if (success) {
                var sessionData = _this._getSessionData(session);
                sessionData.hintValues.set(options.hint, options.value);
            }
            return { result: success };
        });
    };
    NativescriptVuforiaServiceProvider.prototype._decryptLicenseKey = function (encryptedLicenseData, session) {
        return util.decrypt(encryptedLicenseData.trim()).then(function (json) {
            var _a = JSON.parse(json), key = _a.key, origins = _a.origins;
            if (!session.uri)
                throw new Error('Invalid origin');
            var origin = URI.parse(session.uri);
            if (!Array.isArray(origins)) {
                throw new Error("Vuforia License Data must specify allowed origins");
            }
            var match = origins.find(function (o) {
                var parts = o.split(/\/(.*)/);
                var domainPattern = parts[0];
                var pathPattern = parts[1] !== undefined ? '/' + parts[1] : '/**';
                return minimatch(origin.hostname, domainPattern) && minimatch(origin.path, pathPattern);
            });
            if (!match) {
                if (config_1.default.DEBUG && config_1.default.DEBUG_DISABLE_ORIGIN_CHECK) {
                    alert("Note: The current origin does not match any of the allowed origins:\n\n" + origins.join('\n'));
                }
                else {
                    throw new Error('Invalid origin');
                }
            }
            return key;
        });
    };
    NativescriptVuforiaServiceProvider.prototype.configureVuforiaVideoBackground = function (viewport, enabled, reflection) {
        if (reflection === void 0) { reflection = vuforia.VideoBackgroundReflection.Default; }
        var viewWidth = viewport.width;
        var viewHeight = viewport.height;
        var cameraDevice = vuforia.api.getCameraDevice();
        var videoMode = cameraDevice.getVideoMode(exports.vuforiaCameraDeviceMode);
        var videoWidth = videoMode.width;
        var videoHeight = videoMode.height;
        var screenOrientation = util.screenOrientation;
        if (screenOrientation === 0 || screenOrientation === 180) {
            videoWidth = videoMode.height;
            videoHeight = videoMode.width;
        }
        var widthRatio = viewWidth / videoWidth;
        var heightRatio = viewHeight / videoHeight;
        // aspect fill
        var scale = Math.max(widthRatio, heightRatio);
        // aspect fit
        // const scale = Math.min(widthRatio, heightRatio);
        var videoView = vuforia.videoView;
        var contentScaleFactor = videoView.ios ? videoView.ios.contentScaleFactor : platform.screen.mainScreen.scale;
        var sizeX = videoWidth * scale * contentScaleFactor;
        var sizeY = videoHeight * scale * contentScaleFactor;
        // possible optimization, needs further testing
        // if (this._config.enabled === enabled &&
        //     this._config.sizeX === sizeX &&
        //     this._config.sizeY === sizeY) {
        //     // No changes, skip configuration
        //     return;
        // }
        // apply the video config
        var config = this._config;
        config.enabled = enabled;
        config.sizeX = sizeX;
        config.sizeY = sizeY;
        config.positionX = 0;
        config.positionY = 0;
        config.reflection = vuforia.VideoBackgroundReflection.Default;
        // console.log(`Vuforia configuring video background...
        //     contentScaleFactor: ${contentScaleFactor} orientation: ${orientation} 
        //     viewWidth: ${viewWidth} viewHeight: ${viewHeight} videoWidth: ${videoWidth} videoHeight: ${videoHeight} 
        //     config: ${JSON.stringify(config)}
        // `);
        absolute_layout_1.AbsoluteLayout.setLeft(videoView, viewport.x);
        absolute_layout_1.AbsoluteLayout.setTop(videoView, viewport.y);
        videoView.width = viewWidth;
        videoView.height = viewHeight;
        vuforia.api.getRenderer().setVideoBackgroundConfig(config);
    };
    return NativescriptVuforiaServiceProvider;
}());
NativescriptVuforiaServiceProvider = __decorate([
    Argon.DI.autoinject,
    __metadata("design:paramtypes", [Argon.SessionService, Argon.FocusServiceProvider, Argon.ContextService, Argon.EntityServiceProvider, Argon.RealityService])
], NativescriptVuforiaServiceProvider);
exports.NativescriptVuforiaServiceProvider = NativescriptVuforiaServiceProvider;
// TODO: make this cross platform somehow
function fetchDataSet(xmlUrlString) {
    /*
    const xmlUrl = NSURL.URLWithString(xmlUrlString);
    const datUrl = xmlUrl.URLByDeletingPathExtension.URLByAppendingPathExtension("dat");
    
    const directoryPathUrl = xmlUrl.URLByDeletingLastPathComponent;
    const directoryHash = directoryPathUrl.hash;
    const tmpPath = file.knownFolders.temp().path;
    const directoryHashPath = tmpPath + file.path.separator + directoryHash;
    
    file.Folder.fromPath(directoryHashPath);
    
    const xmlDestPath = directoryHashPath + file.path.separator + xmlUrl.lastPathComponent;
    const datDestPath = directoryHashPath + file.path.separator + datUrl.lastPathComponent;
    */
    var directoryPath = xmlUrlString.substring(0, xmlUrlString.lastIndexOf("/"));
    var filename = xmlUrlString.substring(xmlUrlString.lastIndexOf("/") + 1);
    var filenameWithoutExt = filename.substring(0, filename.lastIndexOf("."));
    var datUrlString = directoryPath + file.path.separator + filenameWithoutExt + ".dat";
    var directoryHash = hashCode(directoryPath);
    var tmpPath = file.knownFolders.temp().path;
    var directoryHashPath = tmpPath + file.path.separator + directoryHash;
    file.Folder.fromPath(directoryHashPath);
    var xmlDestPath = directoryHashPath + file.path.separator + filename;
    var datDestPath = directoryHashPath + file.path.separator + filenameWithoutExt + ".dat";
    function hashCode(s) {
        var hash = 0, i, chr, len;
        if (s.length === 0)
            return hash;
        for (i = 0, len = s.length; i < len; i++) {
            chr = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
    function downloadIfNeeded(url, destPath) {
        var lastModified;
        if (file.File.exists(destPath)) {
            var f = file.File.fromPath(destPath);
            lastModified = f.lastModified;
        }
        return http.request({
            url: url,
            method: 'GET',
            headers: lastModified ? {
                'If-Modified-Since': lastModified.toUTCString()
            } : undefined
        }).then(function (response) {
            if (response.statusCode === 304) {
                console.log("Verified that cached version of file " + url + " at " + destPath + " is up-to-date.");
                return destPath;
            }
            else if (response.content && response.statusCode >= 200 && response.statusCode < 300) {
                console.log("Downloaded file " + url + " to " + destPath);
                return response.content.toFile(destPath).path;
            }
            else {
                throw new Error("Unable to download file " + url + "  (HTTP status code: " + response.statusCode + ")");
            }
        });
    }
    return Promise.all([
        downloadIfNeeded(xmlUrlString, xmlDestPath),
        downloadIfNeeded(datUrlString, datDestPath)
    ]).then(function () { return xmlDestPath; });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJnb24tdnVmb3JpYS1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFyZ29uLXZ1Zm9yaWEtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxzQ0FBd0M7QUFDeEMsOENBQWdEO0FBQ2hELDJCQUE2QjtBQUM3QixrQ0FBb0M7QUFDcEMsbUNBQXFDO0FBQ3JDLDhEQUEwRDtBQUMxRCw2QkFBOEI7QUFDOUIscUNBQXNDO0FBQ3RDLDJCQUE0QjtBQUM1Qix1Q0FBa0M7QUFFckIsUUFBQSx1QkFBdUIsR0FBNEIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDLHlHQUF5RztBQUNqTiwrQkFBK0I7QUFDL0IsNkZBQTZGO0FBQzdGLElBQUk7QUFFUyxRQUFBLFdBQVcsR0FBRyxDQUFDLEdBQUcsR0FBQyxFQUFFLENBQUM7QUFFbkMsSUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7QUFDckMsSUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7QUFDM0MsSUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7QUFDM0MsSUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7QUFDM0MsSUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7QUFFM0MsSUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUV4RTtJQVNJLDRCQUFtQixVQUEyQjtRQUEzQixlQUFVLEdBQVYsVUFBVSxDQUFpQjtRQVI5QyxpQkFBWSxHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQztRQUV0QyxtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDbkMsc0JBQWlCLEdBQUcsSUFB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WUFBTyxRQUFRLG9CQUFpQixDQUFDLENBQUE7Z0JBQ3hGLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDcEIsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLFFBQVEsQ0FBQyxVQUFVLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDckYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBbUIsR0FBRyxZQUFPLFFBQVUsQ0FBQyxDQUFBO2dCQUNwRCxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2xELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixHQUFHLEdBQUcsR0FBRyx1QkFBdUIsR0FBRyxRQUFRLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQzVHLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQTtJQUNOLENBQUM7SUFFRCxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUNmLGdCQUFnQixDQUFDLFlBQVksRUFBQyxXQUFXLENBQUM7UUFDMUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFDLFdBQVcsQ0FBQztLQUM3QyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQUksT0FBQSxXQUFXLEVBQVgsQ0FBVyxDQUFDLENBQUM7QUFDN0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgKiBhcyBBcmdvbiBmcm9tICdAYXJnb25qcy9hcmdvbic7XHJcbmltcG9ydCAqIGFzIHZ1Zm9yaWEgZnJvbSAnbmF0aXZlc2NyaXB0LXZ1Zm9yaWEnO1xyXG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xyXG5pbXBvcnQgKiBhcyBmaWxlIGZyb20gJ2ZpbGUtc3lzdGVtJztcclxuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAncGxhdGZvcm0nO1xyXG5pbXBvcnQge0Fic29sdXRlTGF5b3V0fSBmcm9tICd1aS9sYXlvdXRzL2Fic29sdXRlLWxheW91dCc7XHJcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJ1xyXG5pbXBvcnQgKiBhcyBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJ1xyXG5pbXBvcnQgKiBhcyBVUkkgZnJvbSAndXJpanMnXHJcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vY29uZmlnJztcclxuXHJcbmV4cG9ydCBjb25zdCB2dWZvcmlhQ2FtZXJhRGV2aWNlTW9kZTp2dWZvcmlhLkNhbWVyYURldmljZU1vZGUgPSB2dWZvcmlhLkNhbWVyYURldmljZU1vZGUuT3B0aW1pemVTcGVlZDsgLy9hcHBsaWNhdGlvbi5hbmRyb2lkID8gdnVmb3JpYS5DYW1lcmFEZXZpY2VNb2RlLk9wdGltaXplU3BlZWQgOiB2dWZvcmlhLkNhbWVyYURldmljZU1vZGUuT3BpbWl6ZVF1YWxpdHk7XHJcbi8vIGlmICh2dWZvcmlhLnZpZGVvVmlldy5pb3MpIHtcclxuLy8gICAgICg8VUlWaWV3PnZ1Zm9yaWEudmlkZW9WaWV3LmlvcykuY29udGVudFNjYWxlRmFjdG9yID0gcGxhdGZvcm0uc2NyZWVuLm1haW5TY3JlZW4uc2NhbGU7XHJcbi8vIH1cclxuXHJcbmV4cG9ydCBjb25zdCBWSURFT19ERUxBWSA9IC0wLjUvNjA7XHJcblxyXG5jb25zdCBNYXRyaXg0ID0gQXJnb24uQ2VzaXVtLk1hdHJpeDQ7XHJcbmNvbnN0IENhcnRlc2lhbjMgPSBBcmdvbi5DZXNpdW0uQ2FydGVzaWFuMztcclxuY29uc3QgUXVhdGVybmlvbiA9IEFyZ29uLkNlc2l1bS5RdWF0ZXJuaW9uO1xyXG5jb25zdCBKdWxpYW5EYXRlID0gQXJnb24uQ2VzaXVtLkp1bGlhbkRhdGU7XHJcbmNvbnN0IENlc2l1bU1hdGggPSBBcmdvbi5DZXNpdW0uQ2VzaXVtTWF0aDtcclxuXHJcbmNvbnN0IHgxODAgPSBRdWF0ZXJuaW9uLmZyb21BeGlzQW5nbGUoQ2FydGVzaWFuMy5VTklUX1gsIENlc2l1bU1hdGguUEkpO1xyXG5cclxuY2xhc3MgVnVmb3JpYVNlc3Npb25EYXRhIHtcclxuICAgIGNvbW1hbmRRdWV1ZSA9IG5ldyBBcmdvbi5Db21tYW5kUXVldWU7XHJcbiAgICBpbml0UmVzdWx0UmVzb2x2ZXI/OihyZXN1bHQ6dnVmb3JpYS5Jbml0UmVzdWx0KT0+dm9pZDtcclxuICAgIGxvYWRlZERhdGFTZXRzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICBhY3RpdmF0ZWREYXRhU2V0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgZGF0YVNldFVyaUJ5SWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gICAgZGF0YVNldElkQnlVcmkgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gICAgZGF0YVNldEluc3RhbmNlQnlJZCA9IG5ldyBNYXA8c3RyaW5nLCB2dWZvcmlhLkRhdGFTZXQ+KCk7XHJcbiAgICBoaW50VmFsdWVzID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcclxuICAgIGNvbnN0cnVjdG9yKHB1YmxpYyBrZXlQcm9taXNlOiBQcm9taXNlPHN0cmluZz4pIHt9XHJcbn1cclxuXHJcbkBBcmdvbi5ESS5hdXRvaW5qZWN0XHJcbmV4cG9ydCBjbGFzcyBOYXRpdmVzY3JpcHRWdWZvcmlhU2VydmljZVByb3ZpZGVyIHtcclxuXHJcbiAgICBwdWJsaWMgc3RhdGVVcGRhdGVFdmVudCA9IG5ldyBBcmdvbi5FdmVudDxBcmdvbi5DZXNpdW0uSnVsaWFuRGF0ZT4oKTtcclxuICAgIFxyXG4gICAgcHVibGljIHZ1Zm9yaWFUcmFja2VyRW50aXR5ID0gbmV3IEFyZ29uLkNlc2l1bS5FbnRpdHkoe1xyXG4gICAgICAgIHBvc2l0aW9uOiBuZXcgQXJnb24uQ2VzaXVtLkNvbnN0YW50UG9zaXRpb25Qcm9wZXJ0eShDYXJ0ZXNpYW4zLlpFUk8sIHRoaXMuY29udGV4dFNlcnZpY2UudXNlciksXHJcbiAgICAgICAgb3JpZW50YXRpb246IG5ldyBBcmdvbi5DZXNpdW0uQ29uc3RhbnRQcm9wZXJ0eShRdWF0ZXJuaW9uLklERU5USVRZKVxyXG4gICAgfSk7XHJcblxyXG4gICAgcHJpdmF0ZSBfc2NyYXRjaENhcnRlc2lhbiA9IG5ldyBBcmdvbi5DZXNpdW0uQ2FydGVzaWFuMygpO1xyXG4gICAgcHJpdmF0ZSBfc2NyYXRjaFF1YXRlcm5pb24gPSBuZXcgQXJnb24uQ2VzaXVtLlF1YXRlcm5pb24oKTtcclxuXHRwcml2YXRlIF9zY3JhdGNoTWF0cml4MyA9IG5ldyBBcmdvbi5DZXNpdW0uTWF0cml4MygpO1xyXG5cclxuICAgIHByaXZhdGUgX2NvbnRyb2xsaW5nU2Vzc2lvbj86IEFyZ29uLlNlc3Npb25Qb3J0O1xyXG4gICAgcHJpdmF0ZSBfc2Vzc2lvblN3aXRjaGVyQ29tbWFuZFF1ZXVlID0gbmV3IEFyZ29uLkNvbW1hbmRRdWV1ZSgpO1xyXG5cclxuICAgIHByaXZhdGUgX3Nlc3Npb25EYXRhID0gbmV3IFdlYWtNYXA8QXJnb24uU2Vzc2lvblBvcnQsVnVmb3JpYVNlc3Npb25EYXRhPigpO1xyXG4gICAgXHJcblx0Y29uc3RydWN0b3IoXHJcbiAgICAgICAgICAgIHByaXZhdGUgc2Vzc2lvblNlcnZpY2U6QXJnb24uU2Vzc2lvblNlcnZpY2UsXHJcbiAgICAgICAgICAgIHByaXZhdGUgZm9jdXNTZXJ2aWNlUHJvdmlkZXI6QXJnb24uRm9jdXNTZXJ2aWNlUHJvdmlkZXIsXHJcbiAgICAgICAgICAgIHByaXZhdGUgY29udGV4dFNlcnZpY2U6QXJnb24uQ29udGV4dFNlcnZpY2UsXHJcbiAgICAgICAgICAgIC8vIHByaXZhdGUgZGV2aWNlU2VydmljZTpBcmdvbi5EZXZpY2VTZXJ2aWNlLFxyXG4gICAgICAgICAgICBwcml2YXRlIGVudGl0eVNlcnZpY2VQcm92aWRlcjpBcmdvbi5FbnRpdHlTZXJ2aWNlUHJvdmlkZXIsXHJcbiAgICAgICAgICAgIHJlYWxpdHlTZXJ2aWNlOkFyZ29uLlJlYWxpdHlTZXJ2aWNlKSB7XHJcblxyXG4gICAgICAgIC8vIHRoaXMuc2Vzc2lvblNlcnZpY2UuY29ubmVjdEV2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKCk9PntcclxuICAgICAgICAvLyAgICAgdGhpcy5zdGF0ZVVwZGF0ZUV2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKCk9PntcclxuICAgICAgICAvLyAgICAgICAgIGNvbnN0IHJlYWxpdHkgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLnNlcmlhbGl6ZWRGcmFtZVN0YXRlLnJlYWxpdHk7XHJcbiAgICAgICAgLy8gICAgICAgICBpZiAocmVhbGl0eSA9PT0gQXJnb24uUmVhbGl0eVZpZXdlci5MSVZFKSB0aGlzLmRldmljZVNlcnZpY2UudXBkYXRlKCk7XHJcbiAgICAgICAgLy8gICAgIH0pO1xyXG4gICAgICAgIC8vICAgICBzZXRUaW1lb3V0KCgpPT57XHJcbiAgICAgICAgLy8gICAgICAgICBjb25zdCByZWFsaXR5ID0gdGhpcy5jb250ZXh0U2VydmljZS5zZXJpYWxpemVkRnJhbWVTdGF0ZS5yZWFsaXR5O1xyXG4gICAgICAgIC8vICAgICAgICAgaWYgKHJlYWxpdHkgIT09IEFyZ29uLlJlYWxpdHlWaWV3ZXIuTElWRSkgdGhpcy5kZXZpY2VTZXJ2aWNlLnVwZGF0ZSgpO1xyXG4gICAgICAgIC8vICAgICB9LCA2MClcclxuICAgICAgICAvLyB9KVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25TZXJ2aWNlLmNvbm5lY3RFdmVudC5hZGRFdmVudExpc3RlbmVyKChzZXNzaW9uKT0+e1xyXG4gICAgICAgICAgICBpZiAoIXZ1Zm9yaWEuYXBpKSB7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLmlzQXZhaWxhYmxlJ10gPSBcclxuICAgICAgICAgICAgICAgICAgICAoKSA9PiBQcm9taXNlLnJlc29sdmUoe2F2YWlsYWJsZTogZmFsc2V9KTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24ub25bJ2FyLnZ1Zm9yaWEuaW5pdCddID0gXHJcbiAgICAgICAgICAgICAgICAgICAgKGluaXRPcHRpb25zKSA9PiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJWdWZvcmlhIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBwbGF0Zm9ybVwiKSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLmlzQXZhaWxhYmxlJ10gPSBcclxuICAgICAgICAgICAgICAgICAgICAoKSA9PiBQcm9taXNlLnJlc29sdmUoe2F2YWlsYWJsZTogISF2dWZvcmlhLmFwaX0pO1xyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbi5vblsnYXIudnVmb3JpYS5pbml0J10gPSBcclxuICAgICAgICAgICAgICAgICAgICBpbml0T3B0aW9ucyA9PiB0aGlzLl9oYW5kbGVJbml0KHNlc3Npb24sIGluaXRPcHRpb25zKTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24ub25bJ2FyLnZ1Zm9yaWEub2JqZWN0VHJhY2tlckNyZWF0ZURhdGFTZXQnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICh7dXJsfTp7dXJsOnN0cmluZ30pID0+IHRoaXMuX2hhbmRsZU9iamVjdFRyYWNrZXJDcmVhdGVEYXRhU2V0KHNlc3Npb24sIHVybCk7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLm9iamVjdFRyYWNrZXJMb2FkRGF0YVNldCddID0gXHJcbiAgICAgICAgICAgICAgICAgICAgKHtpZH06e2lkOnN0cmluZ30pID0+IHRoaXMuX2hhbmRsZU9iamVjdFRyYWNrZXJMb2FkRGF0YVNldChzZXNzaW9uLCBpZCk7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLm9iamVjdFRyYWNrZXJBY3RpdmF0ZURhdGFTZXQnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICh7aWR9OntpZDpzdHJpbmd9KSA9PiB0aGlzLl9oYW5kbGVPYmplY3RUcmFja2VyQWN0aXZhdGVEYXRhU2V0KHNlc3Npb24sIGlkKTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24ub25bJ2FyLnZ1Zm9yaWEub2JqZWN0VHJhY2tlckRlYWN0aXZhdGVEYXRhU2V0J10gPSBcclxuICAgICAgICAgICAgICAgICAgICAoe2lkfTp7aWQ6c3RyaW5nfSkgPT4gdGhpcy5faGFuZGxlT2JqZWN0VHJhY2tlckRlYWN0aXZhdGVEYXRhU2V0KHNlc3Npb24sIGlkKTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24ub25bJ2FyLnZ1Zm9yaWEub2JqZWN0VHJhY2tlclVubG9hZERhdGFTZXQnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICh7aWR9OntpZDpzdHJpbmd9KSA9PiB0aGlzLl9oYW5kbGVPYmplY3RUcmFja2VyVW5sb2FkRGF0YVNldChzZXNzaW9uLCBpZCk7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLnNldEhpbnQnXSA9XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9PiB0aGlzLl9zZXRIaW50KHNlc3Npb24sIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXRhYmlsaXR5XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci52dWZvcmlhLmRhdGFTZXRGZXRjaCddID0gc2Vzc2lvbi5vblsnYXIudnVmb3JpYS5vYmplY3RUcmFja2VyTG9hZERhdGFTZXQnXTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24ub25bJ2FyLnZ1Zm9yaWEuZGF0YVNldExvYWQnXSA9ICh7aWR9OntpZDpzdHJpbmd9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZU9iamVjdFRyYWNrZXJMb2FkRGF0YVNldChzZXNzaW9uLCBpZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlc3Npb24uY2xvc2VFdmVudC5hZGRFdmVudExpc3RlbmVyKCgpID0+IHRoaXMuX2hhbmRsZUNsb3NlKHNlc3Npb24pKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCF2dWZvcmlhLmFwaSkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIC8vIHN3aXRjaCB0byBBUiBtb2RlIHdoZW4gTElWRSByZWFsaXR5IGlzIHByZXNlbnRpbmdcclxuICAgICAgICAvLyByZWFsaXR5U2VydmljZS5jaGFuZ2VFdmVudC5hZGRFdmVudExpc3RlbmVyKCh7Y3VycmVudH0pPT57XHJcbiAgICAgICAgLy8gICAgIHRoaXMuX3NldERldmljZU1vZGUoXHJcbiAgICAgICAgLy8gICAgICAgICBjdXJyZW50ID09PSBBcmdvbi5SZWFsaXR5Vmlld2VyLkxJVkUgPyBcclxuICAgICAgICAvLyAgICAgICAgICAgICB2dWZvcmlhLkRldmljZU1vZGUuQVIgOiB2dWZvcmlhLkRldmljZU1vZGUuVlJcclxuICAgICAgICAvLyAgICAgKTtcclxuICAgICAgICAvLyB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBsYW5kc2NhcGVSaWdodFNjcmVlbk9yaWVudGF0aW9uUmFkaWFucyA9IC1DZXNpdW1NYXRoLlBJX09WRVJfVFdPO1xyXG5cclxuICAgICAgICBjb25zdCBzdGF0ZVVwZGF0ZUNhbGxiYWNrID0gKHN0YXRlOnZ1Zm9yaWEuU3RhdGUpID0+IHsgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCB0aW1lID0gSnVsaWFuRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgLy8gc3VidHJhY3QgYSBmZXcgbXMsIHNpbmNlIHRoZSB2aWRlbyBmcmFtZSByZXByZXNlbnRzIGEgdGltZSBzbGlnaHRseSBpbiB0aGUgcGFzdC5cclxuICAgICAgICAgICAgLy8gVE9ETzogaWYgd2UgYXJlIHVzaW5nIGFuIG9wdGljYWwgc2VlLXRocm91Z2ggZGlzcGxheSwgbGlrZSBob2xvbGVucyxcclxuICAgICAgICAgICAgLy8gd2Ugd2FudCB0byBkbyB0aGUgb3Bwb3NpdGUsIGFuZCBkbyBmb3J3YXJkIHByZWRpY3Rpb24gKHRob3VnaCBpZGVhbGx5IG5vdCBoZXJlLCBcclxuICAgICAgICAgICAgLy8gYnV0IGluIGVhY2ggYXBwIGl0c2VsZiB0byB3ZSBhcmUgYXMgY2xvc2UgYXMgcG9zc2libGUgdG8gdGhlIGFjdHVhbCByZW5kZXIgdGltZSB3aGVuXHJcbiAgICAgICAgICAgIC8vIHdlIHN0YXJ0IHRoZSByZW5kZXIpXHJcbiAgICAgICAgICAgIEp1bGlhbkRhdGUuYWRkU2Vjb25kcyh0aW1lLCBWSURFT19ERUxBWSwgdGltZSk7XHJcblxyXG4gICAgICAgICAgICAvLyBSb3RhdGUgdGhlIHRyYWNrZXIgdG8gYSBsYW5kc2NhcGUtcmlnaHQgZnJhbWUsIFxyXG4gICAgICAgICAgICAvLyB3aGVyZSArWCBpcyByaWdodCwgK1kgaXMgZG93biwgYW5kICtaIGlzIGluIHRoZSBjYW1lcmEgZGlyZWN0aW9uXHJcbiAgICAgICAgICAgIC8vICh2dWZvcmlhIHJlcG9ydHMgcG9zZXMgaW4gdGhpcyBmcmFtZSBvbiBpT1MgZGV2aWNlcywgbm90IHN1cmUgYWJvdXQgYW5kcm9pZClcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudFNjcmVlbk9yaWVudGF0aW9uUmFkaWFucyA9IHV0aWwuc2NyZWVuT3JpZW50YXRpb24gKiBDZXNpdW1NYXRoLlJBRElBTlNfUEVSX0RFR1JFRTtcclxuICAgICAgICAgICAgY29uc3QgdHJhY2tlck9yaWVudGF0aW9uID0gUXVhdGVybmlvbi5tdWx0aXBseShcclxuICAgICAgICAgICAgICAgIFF1YXRlcm5pb24uZnJvbUF4aXNBbmdsZShDYXJ0ZXNpYW4zLlVOSVRfWiwgbGFuZHNjYXBlUmlnaHRTY3JlZW5PcmllbnRhdGlvblJhZGlhbnMgLSBjdXJyZW50U2NyZWVuT3JpZW50YXRpb25SYWRpYW5zLCB0aGlzLl9zY3JhdGNoUXVhdGVybmlvbiksXHJcbiAgICAgICAgICAgICAgICB4MTgwLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyYXRjaFF1YXRlcm5pb24pO1xyXG4gICAgICAgICAgICAodGhpcy52dWZvcmlhVHJhY2tlckVudGl0eS5vcmllbnRhdGlvbiBhcyBBcmdvbi5DZXNpdW0uQ29uc3RhbnRQcm9wZXJ0eSkuc2V0VmFsdWUodHJhY2tlck9yaWVudGF0aW9uKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHZ1Zm9yaWFGcmFtZSA9IHN0YXRlLmdldEZyYW1lKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lVGltZVN0YW1wID0gdnVmb3JpYUZyYW1lLmdldFRpbWVTdGFtcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gdXBkYXRlIHRyYWNrYWJsZSByZXN1bHRzIGluIGNvbnRleHQgZW50aXR5IGNvbGxlY3Rpb25cclxuICAgICAgICAgICAgY29uc3QgbnVtVHJhY2thYmxlUmVzdWx0cyA9IHN0YXRlLmdldE51bVRyYWNrYWJsZVJlc3VsdHMoKTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaT0wOyBpIDwgbnVtVHJhY2thYmxlUmVzdWx0czsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFja2FibGVSZXN1bHQgPSA8dnVmb3JpYS5UcmFja2FibGVSZXN1bHQ+c3RhdGUuZ2V0VHJhY2thYmxlUmVzdWx0KGkpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhY2thYmxlID0gdHJhY2thYmxlUmVzdWx0LmdldFRyYWNrYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IHRyYWNrYWJsZS5nZXROYW1lKCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy5fZ2V0SWRGb3JUcmFja2FibGUodHJhY2thYmxlKTtcclxuICAgICAgICAgICAgICAgIGxldCBlbnRpdHkgPSBjb250ZXh0U2VydmljZS5lbnRpdGllcy5nZXRCeUlkKGlkKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkpIHtcclxuICAgICAgICAgICAgICAgICAgICBlbnRpdHkgPSBuZXcgQXJnb24uQ2VzaXVtLkVudGl0eSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbmV3IEFyZ29uLkNlc2l1bS5TYW1wbGVkUG9zaXRpb25Qcm9wZXJ0eSh0aGlzLnZ1Zm9yaWFUcmFja2VyRW50aXR5KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IG5ldyBBcmdvbi5DZXNpdW0uU2FtcGxlZFByb3BlcnR5KEFyZ29uLkNlc2l1bS5RdWF0ZXJuaW9uKVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eVBvc2l0aW9uID0gZW50aXR5LnBvc2l0aW9uIGFzIEFyZ29uLkNlc2l1bS5TYW1wbGVkUG9zaXRpb25Qcm9wZXJ0eTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlPcmllbnRhdGlvbiA9IGVudGl0eS5vcmllbnRhdGlvbiBhcyBBcmdvbi5DZXNpdW0uU2FtcGxlZFByb3BlcnR5O1xyXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVBvc2l0aW9uLm1heE51bVNhbXBsZXMgPSAxMDtcclxuICAgICAgICAgICAgICAgICAgICBlbnRpdHlPcmllbnRhdGlvbi5tYXhOdW1TYW1wbGVzID0gMTA7XHJcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UG9zaXRpb24uZm9yd2FyZEV4dHJhcG9sYXRpb25UeXBlID0gQXJnb24uQ2VzaXVtLkV4dHJhcG9sYXRpb25UeXBlLkhPTEQ7XHJcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5T3JpZW50YXRpb24uZm9yd2FyZEV4dHJhcG9sYXRpb25UeXBlID0gQXJnb24uQ2VzaXVtLkV4dHJhcG9sYXRpb25UeXBlLkhPTEQ7XHJcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UG9zaXRpb24uZm9yd2FyZEV4dHJhcG9sYXRpb25EdXJhdGlvbiA9IDEwLzYwO1xyXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eU9yaWVudGF0aW9uLmZvcndhcmRFeHRyYXBvbGF0aW9uRHVyYXRpb24gPSAxMC82MDtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0U2VydmljZS5lbnRpdGllcy5hZGQoZW50aXR5KTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudGl0eVNlcnZpY2VQcm92aWRlci50YXJnZXRSZWZlcmVuY2VGcmFtZU1hcC5zZXQoaWQsIHRoaXMuY29udGV4dFNlcnZpY2UudXNlci5pZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRyYWNrYWJsZVRpbWUgPSBKdWxpYW5EYXRlLmNsb25lKHRpbWUpOyBcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gYWRkIGFueSB0aW1lIGRpZmYgZnJvbSB2dWZvcmlhXHJcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFja2FibGVUaW1lRGlmZiA9IHRyYWNrYWJsZVJlc3VsdC5nZXRUaW1lU3RhbXAoKSAtIGZyYW1lVGltZVN0YW1wO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRyYWNrYWJsZVRpbWVEaWZmICE9PSAwKSBKdWxpYW5EYXRlLmFkZFNlY29uZHModGltZSwgdHJhY2thYmxlVGltZURpZmYsIHRyYWNrYWJsZVRpbWUpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBwb3NlID0gPEFyZ29uLkNlc2l1bS5NYXRyaXg0Pjxhbnk+dHJhY2thYmxlUmVzdWx0LmdldFBvc2UoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gTWF0cml4NC5nZXRUcmFuc2xhdGlvbihwb3NlLCB0aGlzLl9zY3JhdGNoQ2FydGVzaWFuKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvdGF0aW9uTWF0cml4ID0gTWF0cml4NC5nZXRSb3RhdGlvbihwb3NlLCB0aGlzLl9zY3JhdGNoTWF0cml4Myk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBvcmllbnRhdGlvbiA9IFF1YXRlcm5pb24uZnJvbVJvdGF0aW9uTWF0cml4KHJvdGF0aW9uTWF0cml4LCB0aGlzLl9zY3JhdGNoUXVhdGVybmlvbik7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIChlbnRpdHkucG9zaXRpb24gYXMgQXJnb24uQ2VzaXVtLlNhbXBsZWRQb3NpdGlvblByb3BlcnR5KS5hZGRTYW1wbGUodHJhY2thYmxlVGltZSwgcG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgKGVudGl0eS5vcmllbnRhdGlvbiBhcyBBcmdvbi5DZXNpdW0uU2FtcGxlZFByb3BlcnR5KS5hZGRTYW1wbGUodHJhY2thYmxlVGltZSwgb3JpZW50YXRpb24pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZVVwZGF0ZUV2ZW50LnJhaXNlRXZlbnQodGltZSk7XHJcbiAgICAgICAgICAgIC8vIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gdGhpcy5zZXNzaW9uU2VydmljZS5lcnJvckV2ZW50LnJhaXNlRXZlbnQoZSk7XHJcbiAgICAgICAgICAgIC8vIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZ1Zm9yaWEuYXBpLnNldFN0YXRlVXBkYXRlQ2FsbGJhY2soc3RhdGVVcGRhdGVDYWxsYmFjayk7XHJcblxyXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgY3VycmVudGx5IGZvY3Vzc2VkIHNlc3Npb24gaGFzIHByaW9yaXR5XHJcbiAgICAgICAgdGhpcy5mb2N1c1NlcnZpY2VQcm92aWRlci5zZXNzaW9uRm9jdXNFdmVudC5hZGRFdmVudExpc3RlbmVyKCgpPT57XHJcbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdENvbnRyb2xsaW5nU2Vzc2lvbigpO1xyXG4gICAgICAgIH0pXHJcblx0fVxyXG4gICAgICAgIFxyXG4gICAgLy8gcHJpdmF0ZSBfZGV2aWNlTW9kZSA9IHZ1Zm9yaWEuRGV2aWNlTW9kZS5WUjtcclxuICAgIC8vIHByaXZhdGUgX3NldERldmljZU1vZGUoZGV2aWNlTW9kZTogdnVmb3JpYS5EZXZpY2VNb2RlKSB7XHJcbiAgICAvLyAgICAgdGhpcy5fZGV2aWNlTW9kZSA9IGRldmljZU1vZGU7XHJcbiAgICAvLyAgICAgLy8gZm9sbG93aW5nIG1heSBmYWlsIChyZXR1cm4gZmFsc2UpIGlmIHZ1Zm9yaWEgaXMgbm90IGN1cnJlbnRseSBpbml0aWFsaXplZCwgXHJcbiAgICAvLyAgICAgLy8gYnV0IHRoYXQncyBva2F5IChzaW5jZSBuZXh0IHRpbWUgd2UgaW5pdGlsYWl6ZSB3ZSB3aWxsIHVzZSB0aGUgc2F2ZWQgbW9kZSkuIFxyXG4gICAgLy8gICAgIHZ1Zm9yaWEuYXBpLmdldERldmljZSgpLnNldE1vZGUoZGV2aWNlTW9kZSk7IFxyXG4gICAgLy8gfSBcclxuXHJcbiAgICBwcml2YXRlIF9nZXRTZXNzaW9uRGF0YShzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KSB7XHJcbiAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSB0aGlzLl9zZXNzaW9uRGF0YS5nZXQoc2Vzc2lvbik7XHJcbiAgICAgICAgaWYgKCFzZXNzaW9uRGF0YSkgdGhyb3cgbmV3IEVycm9yKCdWdWZvcmlhIG11c3QgYmUgaW5pdGlhbGl6ZWQgZmlyc3QnKVxyXG4gICAgICAgIHJldHVybiBzZXNzaW9uRGF0YTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9nZXRDb21tYW5kUXVldWVGb3JTZXNzaW9uKHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQpIHtcclxuICAgICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IHRoaXMuX3Nlc3Npb25EYXRhLmdldChzZXNzaW9uKSE7XHJcbiAgICAgICAgaWYgKCFzZXNzaW9uRGF0YS5jb21tYW5kUXVldWUpIHRocm93IG5ldyBFcnJvcignVnVmb3JpYSBtdXN0IGJlIGluaXRpYWxpemVkIGZpcnN0JylcclxuICAgICAgICByZXR1cm4gc2Vzc2lvbkRhdGEuY29tbWFuZFF1ZXVlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBwcml2YXRlIF9zZWxlY3RDb250cm9sbGluZ1Nlc3Npb24oKSB7XHJcbiAgICAgICAgY29uc3QgZm9jdXNTZXNzaW9uID0gdGhpcy5mb2N1c1NlcnZpY2VQcm92aWRlci5zZXNzaW9uO1xyXG5cclxuICAgICAgICBpZiAoZm9jdXNTZXNzaW9uICYmIFxyXG4gICAgICAgICAgICBmb2N1c1Nlc3Npb24uaXNDb25uZWN0ZWQgJiYgXHJcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25EYXRhLmhhcyhmb2N1c1Nlc3Npb24pKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NldENvbnRyb2xsaW5nU2Vzc2lvbihmb2N1c1Nlc3Npb24pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fY29udHJvbGxpbmdTZXNzaW9uICYmIFxyXG4gICAgICAgICAgICB0aGlzLl9jb250cm9sbGluZ1Nlc3Npb24uaXNDb25uZWN0ZWQgJiZcclxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbkRhdGEuaGFzKHRoaXMuX2NvbnRyb2xsaW5nU2Vzc2lvbikpIFxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIHBpY2sgYSBkaWZmZXJlbnQgc2Vzc2lvbiBhcyB0aGUgY29udHJvbGxpbmcgc2Vzc2lvblxyXG4gICAgICAgIC8vIFRPRE86IHByaW9yaXRpemUgYW55IHNlc3Npb25zIG90aGVyIHRoYW4gdGhlIGZvY3Vzc2VkIHNlc3Npb24/XHJcbiAgICAgICAgZm9yIChjb25zdCBzZXNzaW9uIG9mIHRoaXMuc2Vzc2lvblNlcnZpY2UubWFuYWdlZFNlc3Npb25zKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZXNzaW9uRGF0YS5oYXMoc2Vzc2lvbikpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NldENvbnRyb2xsaW5nU2Vzc2lvbihzZXNzaW9uKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gaWYgbm8gb3RoZXIgc2Vzc2lvbiBpcyBhdmFpbGFibGUsXHJcbiAgICAgICAgLy8gZmFsbGJhY2sgdG8gdGhlIG1hbmFnZXIgYXMgdGhlIGNvbnRyb2xsaW5nIHNlc3Npb25cclxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbkRhdGEuaGFzKHRoaXMuc2Vzc2lvblNlcnZpY2UubWFuYWdlcikpXHJcbiAgICAgICAgICAgIHRoaXMuX3NldENvbnRyb2xsaW5nU2Vzc2lvbih0aGlzLnNlc3Npb25TZXJ2aWNlLm1hbmFnZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldENvbnRyb2xsaW5nU2Vzc2lvbihzZXNzaW9uOiBBcmdvbi5TZXNzaW9uUG9ydCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLl9jb250cm9sbGluZ1Nlc3Npb24gPT09IHNlc3Npb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coXCJWdWZvcmlhU2VydmljZTogU2V0dGluZyBjb250cm9sbGluZyBzZXNzaW9uIHRvIFwiICsgc2Vzc2lvbi51cmkpXHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9jb250cm9sbGluZ1Nlc3Npb24pIHtcclxuICAgICAgICAgICAgY29uc3QgcHJldmlvdXNTZXNzaW9uID0gdGhpcy5fY29udHJvbGxpbmdTZXNzaW9uO1xyXG4gICAgICAgICAgICB0aGlzLl9jb250cm9sbGluZ1Nlc3Npb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25Td2l0Y2hlckNvbW1hbmRRdWV1ZS5wdXNoKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9wYXVzZVNlc3Npb24ocHJldmlvdXNTZXNzaW9uKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuX2NvbnRyb2xsaW5nU2Vzc2lvbiA9IHNlc3Npb247XHJcbiAgICAgICAgdGhpcy5fc2Vzc2lvblN3aXRjaGVyQ29tbWFuZFF1ZXVlLnB1c2goKCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVzdW1lU2Vzc2lvbihzZXNzaW9uKTtcclxuICAgICAgICB9LCB0cnVlKS5jYXRjaCgoKT0+e1xyXG4gICAgICAgICAgICB0aGlzLl9jb250cm9sbGluZ1Nlc3Npb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIHRoaXMuX3NldENvbnRyb2xsaW5nU2Vzc2lvbih0aGlzLnNlc3Npb25TZXJ2aWNlLm1hbmFnZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3BhdXNlU2Vzc2lvbihzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1Z1Zm9yaWE6IFBhdXNpbmcgc2Vzc2lvbiAnICsgc2Vzc2lvbi51cmkgKyAnLi4uJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gdGhpcy5fZ2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbik7XHJcbiAgICAgICAgY29uc3QgY29tbWFuZFF1ZXVlID0gc2Vzc2lvbkRhdGEuY29tbWFuZFF1ZXVlO1xyXG5cclxuICAgICAgICByZXR1cm4gY29tbWFuZFF1ZXVlLnB1c2goKCkgPT4ge1xyXG4gICAgICAgICAgICBjb21tYW5kUXVldWUucGF1c2UoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIElmIHRoZSBzZXNzaW9uIGlzIGNsb3NlZCwgd2Ugc2V0IHRoZSBwZXJtYW5lbnQgZmxhZyB0byB0cnVlLlxyXG4gICAgICAgICAgICAvLyBMaWtld2lzZSwgaWYgdGhlIHNlc3Npb24gaXMgbm90IGNsb3NlZCwgd2Ugc2V0IHRoZSBwZXJtYW5lbnQgZmxhdCB0byBmYWxzZSxcclxuICAgICAgICAgICAgLy8gbWFpbnRhaW5pbmcgdGhlIGN1cnJlbnQgc2Vzc2lvbiBzdGF0ZS5cclxuICAgICAgICAgICAgY29uc3QgcGVybWFuZW50ID0gc2Vzc2lvbi5pc0Nsb3NlZDtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG9iamVjdFRyYWNrZXIgPSB2dWZvcmlhLmFwaS5nZXRPYmplY3RUcmFja2VyKCk7XHJcbiAgICAgICAgICAgIGlmIChvYmplY3RUcmFja2VyKSBvYmplY3RUcmFja2VyLnN0b3AoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2YXRlZERhdGFTZXRzID0gc2Vzc2lvbkRhdGEuYWN0aXZhdGVkRGF0YVNldHM7XHJcbiAgICAgICAgICAgIGlmIChhY3RpdmF0ZWREYXRhU2V0cykge1xyXG4gICAgICAgICAgICAgICAgYWN0aXZhdGVkRGF0YVNldHMuZm9yRWFjaCgoaWQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vYmplY3RUcmFja2VyRGVhY3RpdmF0ZURhdGFTZXQoc2Vzc2lvbiwgaWQsIHBlcm1hbmVudCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgbG9hZGVkRGF0YVNldHMgPSBzZXNzaW9uRGF0YS5sb2FkZWREYXRhU2V0cztcclxuICAgICAgICAgICAgaWYgKGxvYWRlZERhdGFTZXRzKSB7XHJcbiAgICAgICAgICAgICAgICBsb2FkZWREYXRhU2V0cy5mb3JFYWNoKChpZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29iamVjdFRyYWNrZXJVbmxvYWREYXRhU2V0KHNlc3Npb24sIGlkLCBwZXJtYW5lbnQpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdWdWZvcmlhOiBkZWluaXRpYWxpemluZy4uLicpO1xyXG4gICAgICAgICAgICB2dWZvcmlhLmFwaS5nZXRDYW1lcmFEZXZpY2UoKS5zdG9wKCk7XHJcbiAgICAgICAgICAgIHZ1Zm9yaWEuYXBpLmdldENhbWVyYURldmljZSgpLmRlaW5pdCgpO1xyXG4gICAgICAgICAgICB2dWZvcmlhLmFwaS5kZWluaXRPYmplY3RUcmFja2VyKCk7XHJcbiAgICAgICAgICAgIHZ1Zm9yaWEuYXBpLmRlaW5pdCgpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHBlcm1hbmVudCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbkRhdGEuZGVsZXRlKHNlc3Npb24pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX3Jlc3VtZVNlc3Npb24oc2Vzc2lvbjogQXJnb24uU2Vzc2lvblBvcnQpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBjb21tYW5kUXVldWUgPSB0aGlzLl9nZXRDb21tYW5kUXVldWVGb3JTZXNzaW9uKHNlc3Npb24pO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZygnVnVmb3JpYTogUmVzdW1pbmcgc2Vzc2lvbiAnICsgc2Vzc2lvbi51cmkgKyAnLi4uJyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLl9pbml0KHNlc3Npb24pLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgY29tbWFuZFF1ZXVlLmV4ZWN1dGUoKTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2luaXQoc2Vzc2lvbjpBcmdvbi5TZXNzaW9uUG9ydCkgOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IHRoaXMuX2dldFNlc3Npb25EYXRhKHNlc3Npb24pO1xyXG4gICAgICAgIGNvbnN0IGtleVByb21pc2UgPSBzZXNzaW9uRGF0YS5rZXlQcm9taXNlO1xyXG4gICAgICAgIGlmICgha2V5UHJvbWlzZSkgdGhyb3cgbmV3IEVycm9yKCdWdWZvcmlhOiBJbnZhbGlkIFN0YXRlLiBNaXNzaW5nIEtleS4nKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4ga2V5UHJvbWlzZS50aGVuPHZvaWQ+KCBrZXkgPT4ge1xyXG5cclxuICAgICAgICAgICAgaWYgKCF2dWZvcmlhLmFwaS5zZXRMaWNlbnNlS2V5KGtleSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1Z1Zm9yaWE6IFVuYWJsZSB0byBzZXQgdGhlIGxpY2Vuc2Uga2V5JykpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnVnVmb3JpYTogaW5pdGlhbGl6aW5nLi4uJyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdnVmb3JpYS5hcGkuaW5pdCgpLnRoZW4oKHJlc3VsdCk9PntcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdWdWZvcmlhOiBJbml0IFJlc3VsdDogJyArIHJlc3VsdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZUluaXRSZXN1bHQgPSBzZXNzaW9uRGF0YS5pbml0UmVzdWx0UmVzb2x2ZXI7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzb2x2ZUluaXRSZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlSW5pdFJlc3VsdChyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb25EYXRhLmluaXRSZXN1bHRSZXNvbHZlciA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSB2dWZvcmlhLkluaXRSZXN1bHQuU1VDQ0VTUykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih2dWZvcmlhLkluaXRSZXN1bHRbcmVzdWx0XSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgIC8vIG11c3QgaW5pdGlhbGl6ZSB0cmFja2VycyBiZWZvcmUgaW5pdGlhbGl6aW5nIHRoZSBjYW1lcmEgZGV2aWNlXHJcbiAgICAgICAgICAgICAgICBpZiAoIXZ1Zm9yaWEuYXBpLmluaXRPYmplY3RUcmFja2VyKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJWdWZvcmlhOiBVbmFibGUgdG8gaW5pdGlhbGl6ZSBPYmplY3RUcmFja2VyXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYURldmljZSA9IHZ1Zm9yaWEuYXBpLmdldENhbWVyYURldmljZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVnVmb3JpYTogaW5pdGlhbGl6aW5nIGNhbWVyYSBkZXZpY2UuLi5cIik7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFEZXZpY2UuaW5pdCh2dWZvcmlhLkNhbWVyYURldmljZURpcmVjdGlvbi5EZWZhdWx0KSlcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBpbml0aWFsaXplIGNhbWVyYSBkZXZpY2UnKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICghY2FtZXJhRGV2aWNlLnNlbGVjdFZpZGVvTW9kZSh2dWZvcmlhQ2FtZXJhRGV2aWNlTW9kZSkpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gc2VsZWN0IHZpZGVvIG1vZGUnKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICghdnVmb3JpYS5hcGkuZ2V0RGV2aWNlKCkuc2V0TW9kZSh2dWZvcmlhLkRldmljZU1vZGUuQVIpKVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHNldCBkZXZpY2UgbW9kZScpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyB0aGlzLmNvbmZpZ3VyZVZ1Zm9yaWFWaWRlb0JhY2tncm91bmQoe1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIHg6MCxcclxuICAgICAgICAgICAgICAgIC8vICAgICB5OjAsXHJcbiAgICAgICAgICAgICAgICAvLyAgICAgd2lkdGg6dnVmb3JpYS52aWRlb1ZpZXcuZ2V0QWN0dWFsU2l6ZSgpLndpZHRoLCAvL2dldE1lYXN1cmVkV2lkdGgoKSwgXHJcbiAgICAgICAgICAgICAgICAvLyAgICAgaGVpZ2h0OnZ1Zm9yaWEudmlkZW9WaWV3LmdldEFjdHVhbFNpemUoKS5oZWlnaHQgLy9nZXRNZWFzdXJlZEhlaWdodCgpXHJcbiAgICAgICAgICAgICAgICAvLyB9LCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoIXZ1Zm9yaWEuYXBpLmdldENhbWVyYURldmljZSgpLnN0YXJ0KCkpIFxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHN0YXJ0IGNhbWVyYScpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uRGF0YS5oaW50VmFsdWVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbkRhdGEuaGludFZhbHVlcy5mb3JFYWNoKCh2YWx1ZSwgaGludCwgbWFwKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZ1Zm9yaWEuYXBpLnNldEhpbnQoaGludCwgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlZERhdGFTZXRzID0gc2Vzc2lvbkRhdGEubG9hZGVkRGF0YVNldHM7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkUHJvbWlzZXM6UHJvbWlzZTxhbnk+W10gPSBbXTtcclxuICAgICAgICAgICAgICAgIGlmIChsb2FkZWREYXRhU2V0cykge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvYWRlZERhdGFTZXRzLmZvckVhY2goKGlkKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkUHJvbWlzZXMucHVzaCh0aGlzLl9vYmplY3RUcmFja2VyTG9hZERhdGFTZXQoc2Vzc2lvbiwgaWQpKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwobG9hZFByb21pc2VzKTtcclxuICAgICAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aXZhdGVkRGF0YVNldHMgPSBzZXNzaW9uRGF0YS5hY3RpdmF0ZWREYXRhU2V0czsgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmF0ZVByb21pc2VzOlByb21pc2U8YW55PltdID0gW107XHJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZhdGVkRGF0YVNldHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBhY3RpdmF0ZWREYXRhU2V0cy5mb3JFYWNoKChpZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3RpdmF0ZVByb21pc2VzLnB1c2godGhpcy5fb2JqZWN0VHJhY2tlckFjdGl2YXRlRGF0YVNldChzZXNzaW9uLCBpZCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjdGl2YXRlUHJvbWlzZXM7XHJcbiAgICAgICAgICAgIH0pLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9iamVjdFRyYWNrZXIgPSB2dWZvcmlhLmFwaS5nZXRPYmplY3RUcmFja2VyKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIW9iamVjdFRyYWNrZXIpIHRocm93IG5ldyBFcnJvcignVnVmb3JpYTogVW5hYmxlIHRvIGdldCBvYmplY3RUcmFja2VyIGluc3RhbmNlJyk7XHJcbiAgICAgICAgICAgICAgICBvYmplY3RUcmFja2VyLnN0YXJ0KCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaGFuZGxlSW5pdChzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0LCBvcHRpb25zOntlbmNyeXB0ZWRMaWNlbnNlRGF0YT86c3RyaW5nLCBrZXk/OnN0cmluZ30pIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMua2V5ICYmICFvcHRpb25zLmVuY3J5cHRlZExpY2Vuc2VEYXRhKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGxpY2Vuc2Uga2V5IHdhcyBwcm92aWRlZC4gR2V0IG9uZSBmcm9tIGh0dHBzOi8vZGV2ZWxvcGVyLnZ1Zm9yaWEuY29tLycpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbkRhdGEuaGFzKHNlc3Npb24pKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FscmVhZHkgaW5pdGlhbGl6ZWQnKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBrZXlQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlPHN0cmluZ3x1bmRlZmluZWQ+KFxyXG4gICAgICAgICAgICBvcHRpb25zLmtleSA/XHJcbiAgICAgICAgICAgICAgICBvcHRpb25zLmtleSA6XHJcbiAgICAgICAgICAgICAgICB1dGlsLmNhbkRlY3J5cHQgP1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RlY3J5cHRMaWNlbnNlS2V5KG9wdGlvbnMuZW5jcnlwdGVkTGljZW5zZURhdGEhLCBzZXNzaW9uKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgdXRpbC5nZXRJbnRlcm5hbFZ1Zm9yaWFLZXkoKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gbmV3IFZ1Zm9yaWFTZXNzaW9uRGF0YShrZXlQcm9taXNlKTtcclxuICAgICAgICB0aGlzLl9zZXNzaW9uRGF0YS5zZXQoc2Vzc2lvbiwgc2Vzc2lvbkRhdGEpO1xyXG5cclxuICAgICAgICBjb25zdCBpbml0UmVzdWx0UHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKT0+e1xyXG4gICAgICAgICAgICBzZXNzaW9uRGF0YS5pbml0UmVzdWx0UmVzb2x2ZXIgPSByZXNvbHZlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLl9zZWxlY3RDb250cm9sbGluZ1Nlc3Npb24oKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGtleVByb21pc2UudGhlbjx7fT4oKCk9PmluaXRSZXN1bHRQcm9taXNlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9oYW5kbGVDbG9zZShzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRyb2xsaW5nU2Vzc2lvbiA9PT0gc2Vzc2lvbikge1xyXG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RDb250cm9sbGluZ1Nlc3Npb24oKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX2hhbmRsZU9iamVjdFRyYWNrZXJDcmVhdGVEYXRhU2V0KHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQsIHVyaTpzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gZmV0Y2hEYXRhU2V0KHVyaSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IHRoaXMuX2dldFNlc3Npb25EYXRhKHNlc3Npb24pO1xyXG4gICAgICAgICAgICBsZXQgaWQgPSBzZXNzaW9uRGF0YS5kYXRhU2V0SWRCeVVyaS5nZXQodXJpKTtcclxuICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgaWQgPSBBcmdvbi5DZXNpdW0uY3JlYXRlR3VpZCgpO1xyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbkRhdGEuZGF0YVNldElkQnlVcmkuc2V0KHVyaSwgaWQpO1xyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbkRhdGEuZGF0YVNldFVyaUJ5SWQuc2V0KGlkLCB1cmkpO1xyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICByZXR1cm4ge2lkfTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHJpdmF0ZSBfb2JqZWN0VHJhY2tlckxvYWREYXRhU2V0KHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQsIGlkOiBzdHJpbmcpOiBQcm9taXNlPEFyZ29uLlZ1Zm9yaWFUcmFja2FibGVzPiB7XHJcbiAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSB0aGlzLl9nZXRTZXNzaW9uRGF0YShzZXNzaW9uKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXJpID0gc2Vzc2lvbkRhdGEuZGF0YVNldFVyaUJ5SWQuZ2V0KGlkKTtcclxuICAgICAgICBpZiAoIXVyaSkgdGhyb3cgbmV3IEVycm9yKGBWdWZvcmlhOiBVbmtub3duIERhdGFTZXQgaWQ6ICR7aWR9YCk7XHJcbiAgICAgICAgY29uc3Qgb2JqZWN0VHJhY2tlciA9IHZ1Zm9yaWEuYXBpLmdldE9iamVjdFRyYWNrZXIoKTtcclxuICAgICAgICBpZiAoIW9iamVjdFRyYWNrZXIpIHRocm93IG5ldyBFcnJvcignVnVmb3JpYTogSW52YWxpZCBTdGF0ZS4gVW5hYmxlIHRvIGdldCBPYmplY3RUcmFja2VyIGluc3RhbmNlLicpXHJcblxyXG4gICAgICAgIGxldCBkYXRhU2V0ID0gc2Vzc2lvbkRhdGEuZGF0YVNldEluc3RhbmNlQnlJZC5nZXQoaWQpO1xyXG5cclxuICAgICAgICBsZXQgdHJhY2thYmxlc1Byb21pc2U6UHJvbWlzZTxBcmdvbi5WdWZvcmlhVHJhY2thYmxlcz47XHJcblxyXG4gICAgICAgIGlmIChkYXRhU2V0KSB7XHJcbiAgICAgICAgICAgIHRyYWNrYWJsZXNQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2dldFRyYWNrYWJsZXNGcm9tRGF0YVNldChkYXRhU2V0KSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFZ1Zm9yaWE6IExvYWRpbmcgZGF0YXNldCAoJHtpZH0pIGZyb20gJHt1cml9Li4uYCk7XHJcbiAgICAgICAgICAgIHRyYWNrYWJsZXNQcm9taXNlID0gZmV0Y2hEYXRhU2V0KHVyaSkudGhlbjxBcmdvbi5WdWZvcmlhVHJhY2thYmxlcz4oKGxvY2F0aW9uKT0+e1xyXG4gICAgICAgICAgICAgICAgZGF0YVNldCA9IG9iamVjdFRyYWNrZXIuY3JlYXRlRGF0YVNldCgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhU2V0KSB0aHJvdyBuZXcgRXJyb3IoYFZ1Zm9yaWE6IFVuYWJsZSB0byBjcmVhdGUgZGF0YXNldCBpbnN0YW5jZWApO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoZGF0YVNldC5sb2FkKGxvY2F0aW9uLCB2dWZvcmlhLlN0b3JhZ2VUeXBlLkFic29sdXRlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb25EYXRhLmRhdGFTZXRJbnN0YW5jZUJ5SWQuc2V0KGlkLCBkYXRhU2V0KTtcclxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uRGF0YS5sb2FkZWREYXRhU2V0cy5hZGQoaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyYWNrYWJsZXMgPSB0aGlzLl9nZXRUcmFja2FibGVzRnJvbURhdGFTZXQoZGF0YVNldCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1Z1Zm9yaWEgbG9hZGVkIGRhdGFzZXQgZmlsZSB3aXRoIHRyYWNrYWJsZXM6XFxuJyArIEpTT04uc3RyaW5naWZ5KHRyYWNrYWJsZXMpKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJhY2thYmxlcztcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBvYmplY3RUcmFja2VyLmRlc3Ryb3lEYXRhU2V0KGRhdGFTZXQpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFVuYWJsZSB0byBsb2FkIGRvd25sb2FkZWQgZGF0YXNldCBhdCAke2xvY2F0aW9ufSBmcm9tICR7dXJpfWApO1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gbG9hZCBkYXRhc2V0Jyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHNlc3Npb24udmVyc2lvblswXSA+IDApIHtcclxuICAgICAgICAgICAgdHJhY2thYmxlc1Byb21pc2UudGhlbigodHJhY2thYmxlcyk9PntcclxuICAgICAgICAgICAgICAgIHNlc3Npb24uc2VuZCgnYXIudnVmb3JpYS5vYmplY3RUcmFja2VyTG9hZERhdGFTZXRFdmVudCcsIHsgaWQsIHRyYWNrYWJsZXMgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRyYWNrYWJsZXNQcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dldFRyYWNrYWJsZXNGcm9tRGF0YVNldChkYXRhU2V0OnZ1Zm9yaWEuRGF0YVNldCkge1xyXG4gICAgICAgIGNvbnN0IG51bVRyYWNrYWJsZXMgPSBkYXRhU2V0LmdldE51bVRyYWNrYWJsZXMoKTtcclxuICAgICAgICBjb25zdCB0cmFja2FibGVzOkFyZ29uLlZ1Zm9yaWFUcmFja2FibGVzID0ge307XHJcbiAgICAgICAgZm9yIChsZXQgaT0wOyBpIDwgbnVtVHJhY2thYmxlczsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRyYWNrYWJsZSA9IDx2dWZvcmlhLlRyYWNrYWJsZT5kYXRhU2V0LmdldFRyYWNrYWJsZShpKTtcclxuICAgICAgICAgICAgdHJhY2thYmxlc1t0cmFja2FibGUuZ2V0TmFtZSgpXSA9IHtcclxuICAgICAgICAgICAgICAgIGlkOiB0aGlzLl9nZXRJZEZvclRyYWNrYWJsZSh0cmFja2FibGUpLFxyXG4gICAgICAgICAgICAgICAgc2l6ZTogdHJhY2thYmxlIGluc3RhbmNlb2YgdnVmb3JpYS5PYmplY3RUYXJnZXQgPyB0cmFja2FibGUuZ2V0U2l6ZSgpIDoge3g6MCx5OjAsejowfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cmFja2FibGVzO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2hhbmRsZU9iamVjdFRyYWNrZXJMb2FkRGF0YVNldChzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0LCBpZDpzdHJpbmcpIDogUHJvbWlzZTxBcmdvbi5WdWZvcmlhVHJhY2thYmxlcz4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRDb21tYW5kUXVldWVGb3JTZXNzaW9uKHNlc3Npb24pLnB1c2goKCk9PntcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX29iamVjdFRyYWNrZXJMb2FkRGF0YVNldChzZXNzaW9uLCBpZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX29iamVjdFRyYWNrZXJBY3RpdmF0ZURhdGFTZXQoc2Vzc2lvbjogQXJnb24uU2Vzc2lvblBvcnQsIGlkOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgVnVmb3JpYSBhY3RpdmF0aW5nIGRhdGFzZXQgKCR7aWR9KWApO1xyXG5cclxuICAgICAgICBjb25zdCBvYmplY3RUcmFja2VyID0gdnVmb3JpYS5hcGkuZ2V0T2JqZWN0VHJhY2tlcigpO1xyXG4gICAgICAgIGlmICghb2JqZWN0VHJhY2tlcikgdGhyb3cgbmV3IEVycm9yKCdWdWZvcmlhOiBJbnZhbGlkIFN0YXRlLiBVbmFibGUgdG8gZ2V0IE9iamVjdFRyYWNrZXIgaW5zdGFuY2UuJylcclxuXHJcbiAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSB0aGlzLl9nZXRTZXNzaW9uRGF0YShzZXNzaW9uKTtcclxuXHJcbiAgICAgICAgbGV0IGRhdGFTZXQgPSBzZXNzaW9uRGF0YS5kYXRhU2V0SW5zdGFuY2VCeUlkLmdldChpZCk7XHJcbiAgICAgICAgbGV0IGRhdGFTZXRQcm9taXNlOlByb21pc2U8dnVmb3JpYS5EYXRhU2V0PjtcclxuICAgICAgICBpZiAoIWRhdGFTZXQpIHtcclxuICAgICAgICAgICAgZGF0YVNldFByb21pc2UgPSB0aGlzLl9vYmplY3RUcmFja2VyTG9hZERhdGFTZXQoc2Vzc2lvbiwgaWQpLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXNzaW9uRGF0YS5kYXRhU2V0SW5zdGFuY2VCeUlkLmdldChpZCkhO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGRhdGFTZXRQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGRhdGFTZXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRhdGFTZXRQcm9taXNlLnRoZW4oKGRhdGFTZXQpPT57XHJcbiAgICAgICAgICAgIGlmICghb2JqZWN0VHJhY2tlci5hY3RpdmF0ZURhdGFTZXQoZGF0YVNldCkpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZ1Zm9yaWE6IFVuYWJsZSB0byBhY3RpdmF0ZSBkYXRhU2V0ICR7aWR9YCk7XHJcbiAgICAgICAgICAgIHNlc3Npb25EYXRhLmFjdGl2YXRlZERhdGFTZXRzLmFkZChpZCk7XHJcbiAgICAgICAgICAgIGlmIChzZXNzaW9uLnZlcnNpb25bMF0gPiAwKVxyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbi5zZW5kKCdhci52dWZvcmlhLm9iamVjdFRyYWNrZXJBY3RpdmF0ZURhdGFTZXRFdmVudCcsIHsgaWQgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaGFuZGxlT2JqZWN0VHJhY2tlckFjdGl2YXRlRGF0YVNldChzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0LCBpZDpzdHJpbmcpIDogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldENvbW1hbmRRdWV1ZUZvclNlc3Npb24oc2Vzc2lvbikucHVzaCgoKT0+e1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fb2JqZWN0VHJhY2tlckFjdGl2YXRlRGF0YVNldChzZXNzaW9uLCBpZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX29iamVjdFRyYWNrZXJEZWFjdGl2YXRlRGF0YVNldChzZXNzaW9uOiBBcmdvbi5TZXNzaW9uUG9ydCwgaWQ6IHN0cmluZywgcGVybWFuZW50PXRydWUpOiBib29sZWFuIHsgICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBWdWZvcmlhIGRlYWN0aXZhdGluZyBkYXRhc2V0ICgke2lkfSlgKTtcclxuICAgICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IHRoaXMuX2dldFNlc3Npb25EYXRhKHNlc3Npb24pO1xyXG4gICAgICAgIGNvbnN0IG9iamVjdFRyYWNrZXIgPSB2dWZvcmlhLmFwaS5nZXRPYmplY3RUcmFja2VyKCk7XHJcbiAgICAgICAgaWYgKG9iamVjdFRyYWNrZXIpIHtcclxuICAgICAgICAgICAgY29uc3QgZGF0YVNldCA9IHNlc3Npb25EYXRhLmRhdGFTZXRJbnN0YW5jZUJ5SWQuZ2V0KGlkKTtcclxuICAgICAgICAgICAgaWYgKGRhdGFTZXQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IG9iamVjdFRyYWNrZXIuZGVhY3RpdmF0ZURhdGFTZXQoZGF0YVNldCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwZXJtYW5lbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbkRhdGEuYWN0aXZhdGVkRGF0YVNldHMuZGVsZXRlKGlkKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlc3Npb24udmVyc2lvblswXSA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb24uc2VuZCgnYXIudnVmb3JpYS5vYmplY3RUcmFja2VyRGVhY3RpdmF0ZURhdGFTZXRFdmVudCcsIHsgaWQgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2VzcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaGFuZGxlT2JqZWN0VHJhY2tlckRlYWN0aXZhdGVEYXRhU2V0KHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQsIGlkOnN0cmluZykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRDb21tYW5kUXVldWVGb3JTZXNzaW9uKHNlc3Npb24pLnB1c2goKCk9PntcclxuICAgICAgICAgICAgaWYgKCF0aGlzLl9vYmplY3RUcmFja2VyRGVhY3RpdmF0ZURhdGFTZXQoc2Vzc2lvbiwgaWQpKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWdWZvcmlhOiB1bmFibGUgdG8gYWN0aXZhdGUgZGF0YXNldCAke2lkfWApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBwcml2YXRlIF9vYmplY3RUcmFja2VyVW5sb2FkRGF0YVNldChzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0LCBpZDogc3RyaW5nLCBwZXJtYW5lbnQ9dHJ1ZSk6IGJvb2xlYW4geyAgICAgICBcclxuICAgICAgICBjb25zb2xlLmxvZyhgVnVmb3JpYTogdW5sb2FkaW5nIGRhdGFzZXQgKHBlcm1hbmVudDoke3Blcm1hbmVudH0gaWQ6JHtpZH0pLi4uYCk7XHJcbiAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSB0aGlzLl9nZXRTZXNzaW9uRGF0YShzZXNzaW9uKTtcclxuICAgICAgICBjb25zdCBvYmplY3RUcmFja2VyID0gdnVmb3JpYS5hcGkuZ2V0T2JqZWN0VHJhY2tlcigpO1xyXG4gICAgICAgIGlmIChvYmplY3RUcmFja2VyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRhdGFTZXQgPSBzZXNzaW9uRGF0YS5kYXRhU2V0SW5zdGFuY2VCeUlkLmdldChpZCk7XHJcbiAgICAgICAgICAgIGlmIChkYXRhU2V0ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRlbGV0ZWQgPSBvYmplY3RUcmFja2VyLmRlc3Ryb3lEYXRhU2V0KGRhdGFTZXQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGRlbGV0ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uRGF0YS5kYXRhU2V0SW5zdGFuY2VCeUlkLmRlbGV0ZShpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlcm1hbmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmkgPSBzZXNzaW9uRGF0YS5kYXRhU2V0VXJpQnlJZC5nZXQoaWQpITtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbkRhdGEuZGF0YVNldElkQnlVcmkuZGVsZXRlKHVyaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25EYXRhLmxvYWRlZERhdGFTZXRzLmRlbGV0ZShpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25EYXRhLmRhdGFTZXRVcmlCeUlkLmRlbGV0ZShpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXNzaW9uLnZlcnNpb25bMF0gPiAwKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLnNlbmQoJ2FyLnZ1Zm9yaWEub2JqZWN0VHJhY2tlclVubG9hZERhdGFTZXRFdmVudCcsIHsgaWQgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVsZXRlZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaGFuZGxlT2JqZWN0VHJhY2tlclVubG9hZERhdGFTZXQoc2Vzc2lvbjpBcmdvbi5TZXNzaW9uUG9ydCwgaWQ6c3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldENvbW1hbmRRdWV1ZUZvclNlc3Npb24oc2Vzc2lvbikucHVzaCgoKT0+e1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX29iamVjdFRyYWNrZXJVbmxvYWREYXRhU2V0KHNlc3Npb24sIGlkKSlcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVnVmb3JpYTogdW5hYmxlIHRvIHVubG9hZCBkYXRhc2V0ICR7aWR9YCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX2dldElkRm9yVHJhY2thYmxlKHRyYWNrYWJsZTp2dWZvcmlhLlRyYWNrYWJsZSkgOiBzdHJpbmcge1xyXG4gICAgICAgIGlmICh0cmFja2FibGUgaW5zdGFuY2VvZiB2dWZvcmlhLk9iamVjdFRhcmdldCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ3Z1Zm9yaWFfb2JqZWN0X3RhcmdldF8nICsgdHJhY2thYmxlLmdldFVuaXF1ZVRhcmdldElkKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuICd2dWZvcmlhX3RyYWNrYWJsZV8nICsgdHJhY2thYmxlLmdldElkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3NldEhpbnQoc2Vzc2lvbjpBcmdvbi5TZXNzaW9uUG9ydCwgb3B0aW9uczp7aGludD86bnVtYmVyLCB2YWx1ZT86bnVtYmVyfSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRDb21tYW5kUXVldWVGb3JTZXNzaW9uKHNlc3Npb24pLnB1c2goKCk9PntcclxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGludCA9PT0gdW5kZWZpbmVkIHx8IG9wdGlvbnMudmFsdWUgPT09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignc2V0SGludCByZXF1aXJlcyBoaW50IGFuZCB2YWx1ZScpO1xyXG4gICAgICAgICAgICB2YXIgc3VjY2VzcyA9IHZ1Zm9yaWEuYXBpLnNldEhpbnQob3B0aW9ucy5oaW50LCBvcHRpb25zLnZhbHVlKTtcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gdGhpcy5fZ2V0U2Vzc2lvbkRhdGEoc2Vzc2lvbik7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uRGF0YS5oaW50VmFsdWVzLnNldChvcHRpb25zLmhpbnQsIG9wdGlvbnMudmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB7cmVzdWx0OiBzdWNjZXNzfTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9kZWNyeXB0TGljZW5zZUtleShlbmNyeXB0ZWRMaWNlbnNlRGF0YTpzdHJpbmcsIHNlc3Npb246QXJnb24uU2Vzc2lvblBvcnQpIDogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgICAgICByZXR1cm4gdXRpbC5kZWNyeXB0KGVuY3J5cHRlZExpY2Vuc2VEYXRhLnRyaW0oKSkudGhlbigoanNvbik9PntcclxuICAgICAgICAgICAgY29uc3Qge2tleSxvcmlnaW5zfSA6IHtrZXk6c3RyaW5nLG9yaWdpbnM6c3RyaW5nW119ID0gSlNPTi5wYXJzZShqc29uKTtcclxuICAgICAgICAgICAgaWYgKCFzZXNzaW9uLnVyaSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG9yaWdpbicpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgb3JpZ2luID0gVVJJLnBhcnNlKHNlc3Npb24udXJpKTtcclxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KDxhbnk+b3JpZ2lucykpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlZ1Zm9yaWEgTGljZW5zZSBEYXRhIG11c3Qgc3BlY2lmeSBhbGxvd2VkIG9yaWdpbnNcIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gb3JpZ2lucy5maW5kKChvKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IG8uc3BsaXQoL1xcLyguKikvKTtcclxuICAgICAgICAgICAgICAgIGxldCBkb21haW5QYXR0ZXJuID0gcGFydHNbMF07XHJcbiAgICAgICAgICAgICAgICBsZXQgcGF0aFBhdHRlcm4gPSBwYXJ0c1sxXSAhPT0gdW5kZWZpbmVkID8gJy8nICsgcGFydHNbMV0gOiAnLyoqJztcclxuICAgICAgICAgICAgICAgIHJldHVybiBtaW5pbWF0Y2gob3JpZ2luLmhvc3RuYW1lLCBkb21haW5QYXR0ZXJuKSAmJiBtaW5pbWF0Y2gob3JpZ2luLnBhdGgsIHBhdGhQYXR0ZXJuKTtcclxuICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuREVCVUcgJiYgY29uZmlnLkRFQlVHX0RJU0FCTEVfT1JJR0lOX0NIRUNLKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWxlcnQoYE5vdGU6IFRoZSBjdXJyZW50IG9yaWdpbiBkb2VzIG5vdCBtYXRjaCBhbnkgb2YgdGhlIGFsbG93ZWQgb3JpZ2luczpcXG5cXG4ke29yaWdpbnMuam9pbignXFxuJyl9YCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBvcmlnaW4nKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jb25maWcgPSA8dnVmb3JpYS5WaWRlb0JhY2tncm91bmRDb25maWc+e307XHJcblxyXG4gICAgcHVibGljIGNvbmZpZ3VyZVZ1Zm9yaWFWaWRlb0JhY2tncm91bmQodmlld3BvcnQ6QXJnb24uVmlld3BvcnQsIGVuYWJsZWQ6Ym9vbGVhbiwgcmVmbGVjdGlvbj12dWZvcmlhLlZpZGVvQmFja2dyb3VuZFJlZmxlY3Rpb24uRGVmYXVsdCkge1xyXG4gICAgICAgIGNvbnN0IHZpZXdXaWR0aCA9IHZpZXdwb3J0LndpZHRoO1xyXG4gICAgICAgIGNvbnN0IHZpZXdIZWlnaHQgPSB2aWV3cG9ydC5oZWlnaHQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY2FtZXJhRGV2aWNlID0gdnVmb3JpYS5hcGkuZ2V0Q2FtZXJhRGV2aWNlKCk7XHJcbiAgICAgICAgY29uc3QgdmlkZW9Nb2RlID0gY2FtZXJhRGV2aWNlLmdldFZpZGVvTW9kZSh2dWZvcmlhQ2FtZXJhRGV2aWNlTW9kZSk7XHJcbiAgICAgICAgbGV0IHZpZGVvV2lkdGggPSB2aWRlb01vZGUud2lkdGg7XHJcbiAgICAgICAgbGV0IHZpZGVvSGVpZ2h0ID0gdmlkZW9Nb2RlLmhlaWdodDtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBzY3JlZW5PcmllbnRhdGlvbiA9IHV0aWwuc2NyZWVuT3JpZW50YXRpb247XHJcbiAgICAgICAgaWYgKHNjcmVlbk9yaWVudGF0aW9uID09PSAwIHx8IHNjcmVlbk9yaWVudGF0aW9uID09PSAxODApIHtcclxuICAgICAgICAgICAgdmlkZW9XaWR0aCA9IHZpZGVvTW9kZS5oZWlnaHQ7XHJcbiAgICAgICAgICAgIHZpZGVvSGVpZ2h0ID0gdmlkZW9Nb2RlLndpZHRoO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCB3aWR0aFJhdGlvID0gdmlld1dpZHRoIC8gdmlkZW9XaWR0aDtcclxuICAgICAgICBjb25zdCBoZWlnaHRSYXRpbyA9IHZpZXdIZWlnaHQgLyB2aWRlb0hlaWdodDtcclxuICAgICAgICAvLyBhc3BlY3QgZmlsbFxyXG4gICAgICAgIGNvbnN0IHNjYWxlID0gTWF0aC5tYXgod2lkdGhSYXRpbywgaGVpZ2h0UmF0aW8pO1xyXG4gICAgICAgIC8vIGFzcGVjdCBmaXRcclxuICAgICAgICAvLyBjb25zdCBzY2FsZSA9IE1hdGgubWluKHdpZHRoUmF0aW8sIGhlaWdodFJhdGlvKTtcclxuXHJcbiAgICAgICAgY29uc3QgdmlkZW9WaWV3ID0gdnVmb3JpYS52aWRlb1ZpZXc7XHJcbiAgICAgICAgY29uc3QgY29udGVudFNjYWxlRmFjdG9yID0gdmlkZW9WaWV3LmlvcyA/IHZpZGVvVmlldy5pb3MuY29udGVudFNjYWxlRmFjdG9yIDogcGxhdGZvcm0uc2NyZWVuLm1haW5TY3JlZW4uc2NhbGU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3Qgc2l6ZVggPSB2aWRlb1dpZHRoICogc2NhbGUgKiBjb250ZW50U2NhbGVGYWN0b3I7XHJcbiAgICAgICAgY29uc3Qgc2l6ZVkgPSB2aWRlb0hlaWdodCAqIHNjYWxlICogY29udGVudFNjYWxlRmFjdG9yO1xyXG5cclxuICAgICAgICAvLyBwb3NzaWJsZSBvcHRpbWl6YXRpb24sIG5lZWRzIGZ1cnRoZXIgdGVzdGluZ1xyXG4gICAgICAgIC8vIGlmICh0aGlzLl9jb25maWcuZW5hYmxlZCA9PT0gZW5hYmxlZCAmJlxyXG4gICAgICAgIC8vICAgICB0aGlzLl9jb25maWcuc2l6ZVggPT09IHNpemVYICYmXHJcbiAgICAgICAgLy8gICAgIHRoaXMuX2NvbmZpZy5zaXplWSA9PT0gc2l6ZVkpIHtcclxuICAgICAgICAvLyAgICAgLy8gTm8gY2hhbmdlcywgc2tpcCBjb25maWd1cmF0aW9uXHJcbiAgICAgICAgLy8gICAgIHJldHVybjtcclxuICAgICAgICAvLyB9XHJcblxyXG4gICAgICAgIC8vIGFwcGx5IHRoZSB2aWRlbyBjb25maWdcclxuICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLl9jb25maWc7IFxyXG4gICAgICAgIGNvbmZpZy5lbmFibGVkID0gZW5hYmxlZDtcclxuICAgICAgICBjb25maWcuc2l6ZVggPSBzaXplWDtcclxuICAgICAgICBjb25maWcuc2l6ZVkgPSBzaXplWTtcclxuICAgICAgICBjb25maWcucG9zaXRpb25YID0gMDtcclxuICAgICAgICBjb25maWcucG9zaXRpb25ZID0gMDtcclxuICAgICAgICBjb25maWcucmVmbGVjdGlvbiA9IHZ1Zm9yaWEuVmlkZW9CYWNrZ3JvdW5kUmVmbGVjdGlvbi5EZWZhdWx0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBWdWZvcmlhIGNvbmZpZ3VyaW5nIHZpZGVvIGJhY2tncm91bmQuLi5cclxuICAgICAgICAvLyAgICAgY29udGVudFNjYWxlRmFjdG9yOiAke2NvbnRlbnRTY2FsZUZhY3Rvcn0gb3JpZW50YXRpb246ICR7b3JpZW50YXRpb259IFxyXG4gICAgICAgIC8vICAgICB2aWV3V2lkdGg6ICR7dmlld1dpZHRofSB2aWV3SGVpZ2h0OiAke3ZpZXdIZWlnaHR9IHZpZGVvV2lkdGg6ICR7dmlkZW9XaWR0aH0gdmlkZW9IZWlnaHQ6ICR7dmlkZW9IZWlnaHR9IFxyXG4gICAgICAgIC8vICAgICBjb25maWc6ICR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX1cclxuICAgICAgICAvLyBgKTtcclxuXHJcbiAgICAgICAgQWJzb2x1dGVMYXlvdXQuc2V0TGVmdCh2aWRlb1ZpZXcsIHZpZXdwb3J0LngpO1xyXG4gICAgICAgIEFic29sdXRlTGF5b3V0LnNldFRvcCh2aWRlb1ZpZXcsIHZpZXdwb3J0LnkpO1xyXG4gICAgICAgIHZpZGVvVmlldy53aWR0aCA9IHZpZXdXaWR0aDtcclxuICAgICAgICB2aWRlb1ZpZXcuaGVpZ2h0ID0gdmlld0hlaWdodDtcclxuICAgICAgICB2dWZvcmlhLmFwaS5nZXRSZW5kZXJlcigpLnNldFZpZGVvQmFja2dyb3VuZENvbmZpZyhjb25maWcpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyBUT0RPOiBtYWtlIHRoaXMgY3Jvc3MgcGxhdGZvcm0gc29tZWhvd1xyXG5mdW5jdGlvbiBmZXRjaERhdGFTZXQoeG1sVXJsU3RyaW5nOnN0cmluZykgOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgLypcclxuICAgIGNvbnN0IHhtbFVybCA9IE5TVVJMLlVSTFdpdGhTdHJpbmcoeG1sVXJsU3RyaW5nKTtcclxuICAgIGNvbnN0IGRhdFVybCA9IHhtbFVybC5VUkxCeURlbGV0aW5nUGF0aEV4dGVuc2lvbi5VUkxCeUFwcGVuZGluZ1BhdGhFeHRlbnNpb24oXCJkYXRcIik7XHJcbiAgICBcclxuICAgIGNvbnN0IGRpcmVjdG9yeVBhdGhVcmwgPSB4bWxVcmwuVVJMQnlEZWxldGluZ0xhc3RQYXRoQ29tcG9uZW50O1xyXG4gICAgY29uc3QgZGlyZWN0b3J5SGFzaCA9IGRpcmVjdG9yeVBhdGhVcmwuaGFzaDtcclxuICAgIGNvbnN0IHRtcFBhdGggPSBmaWxlLmtub3duRm9sZGVycy50ZW1wKCkucGF0aDtcclxuICAgIGNvbnN0IGRpcmVjdG9yeUhhc2hQYXRoID0gdG1wUGF0aCArIGZpbGUucGF0aC5zZXBhcmF0b3IgKyBkaXJlY3RvcnlIYXNoO1xyXG4gICAgXHJcbiAgICBmaWxlLkZvbGRlci5mcm9tUGF0aChkaXJlY3RvcnlIYXNoUGF0aCk7XHJcbiAgICBcclxuICAgIGNvbnN0IHhtbERlc3RQYXRoID0gZGlyZWN0b3J5SGFzaFBhdGggKyBmaWxlLnBhdGguc2VwYXJhdG9yICsgeG1sVXJsLmxhc3RQYXRoQ29tcG9uZW50O1xyXG4gICAgY29uc3QgZGF0RGVzdFBhdGggPSBkaXJlY3RvcnlIYXNoUGF0aCArIGZpbGUucGF0aC5zZXBhcmF0b3IgKyBkYXRVcmwubGFzdFBhdGhDb21wb25lbnQ7XHJcbiAgICAqL1xyXG5cclxuICAgIGNvbnN0IGRpcmVjdG9yeVBhdGggPSB4bWxVcmxTdHJpbmcuc3Vic3RyaW5nKDAsIHhtbFVybFN0cmluZy5sYXN0SW5kZXhPZihcIi9cIikpO1xyXG4gICAgY29uc3QgZmlsZW5hbWUgPSB4bWxVcmxTdHJpbmcuc3Vic3RyaW5nKHhtbFVybFN0cmluZy5sYXN0SW5kZXhPZihcIi9cIikgKyAxKTtcclxuICAgIGNvbnN0IGZpbGVuYW1lV2l0aG91dEV4dCA9IGZpbGVuYW1lLnN1YnN0cmluZygwLCBmaWxlbmFtZS5sYXN0SW5kZXhPZihcIi5cIikpO1xyXG5cclxuICAgIGNvbnN0IGRhdFVybFN0cmluZyA9IGRpcmVjdG9yeVBhdGggKyBmaWxlLnBhdGguc2VwYXJhdG9yICsgZmlsZW5hbWVXaXRob3V0RXh0ICsgXCIuZGF0XCI7XHJcblxyXG4gICAgY29uc3QgZGlyZWN0b3J5SGFzaCA9IGhhc2hDb2RlKGRpcmVjdG9yeVBhdGgpO1xyXG4gICAgY29uc3QgdG1wUGF0aCA9IGZpbGUua25vd25Gb2xkZXJzLnRlbXAoKS5wYXRoO1xyXG4gICAgY29uc3QgZGlyZWN0b3J5SGFzaFBhdGggPSB0bXBQYXRoICsgZmlsZS5wYXRoLnNlcGFyYXRvciArIGRpcmVjdG9yeUhhc2g7XHJcblxyXG4gICAgZmlsZS5Gb2xkZXIuZnJvbVBhdGgoZGlyZWN0b3J5SGFzaFBhdGgpO1xyXG4gICAgXHJcbiAgICBjb25zdCB4bWxEZXN0UGF0aCA9IGRpcmVjdG9yeUhhc2hQYXRoICsgZmlsZS5wYXRoLnNlcGFyYXRvciArIGZpbGVuYW1lO1xyXG4gICAgY29uc3QgZGF0RGVzdFBhdGggPSBkaXJlY3RvcnlIYXNoUGF0aCArIGZpbGUucGF0aC5zZXBhcmF0b3IgKyBmaWxlbmFtZVdpdGhvdXRFeHQgKyBcIi5kYXRcIjtcclxuXHJcbiAgICBmdW5jdGlvbiBoYXNoQ29kZShzOnN0cmluZykge1xyXG4gICAgICAgIHZhciBoYXNoID0gMCwgaSwgY2hyLCBsZW47XHJcbiAgICAgICAgaWYgKHMubGVuZ3RoID09PSAwKSByZXR1cm4gaGFzaDtcclxuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNociAgID0gcy5jaGFyQ29kZUF0KGkpO1xyXG4gICAgICAgICAgICBoYXNoICA9ICgoaGFzaCA8PCA1KSAtIGhhc2gpICsgY2hyO1xyXG4gICAgICAgICAgICBoYXNoIHw9IDA7IC8vIENvbnZlcnQgdG8gMzJiaXQgaW50ZWdlclxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZG93bmxvYWRJZk5lZWRlZCh1cmw6c3RyaW5nLCBkZXN0UGF0aDpzdHJpbmcpIHtcclxuICAgICAgICBsZXQgbGFzdE1vZGlmaWVkOkRhdGV8dW5kZWZpbmVkO1xyXG4gICAgICAgIGlmIChmaWxlLkZpbGUuZXhpc3RzKGRlc3RQYXRoKSkge1xyXG4gICAgICAgICAgICBjb25zdCBmID0gZmlsZS5GaWxlLmZyb21QYXRoKGRlc3RQYXRoKTtcclxuICAgICAgICAgICAgbGFzdE1vZGlmaWVkID0gZi5sYXN0TW9kaWZpZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBodHRwLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgIG1ldGhvZDonR0VUJyxcclxuICAgICAgICAgICAgaGVhZGVyczogbGFzdE1vZGlmaWVkID8ge1xyXG4gICAgICAgICAgICAgICAgJ0lmLU1vZGlmaWVkLVNpbmNlJzogbGFzdE1vZGlmaWVkLnRvVVRDU3RyaW5nKClcclxuICAgICAgICAgICAgfSA6IHVuZGVmaW5lZFxyXG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKT0+e1xyXG4gICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMzA0KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgVmVyaWZpZWQgdGhhdCBjYWNoZWQgdmVyc2lvbiBvZiBmaWxlICR7dXJsfSBhdCAke2Rlc3RQYXRofSBpcyB1cC10by1kYXRlLmApXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVzdFBhdGg7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzcG9uc2UuY29udGVudCAmJiByZXNwb25zZS5zdGF0dXNDb2RlID49IDIwMCAmJiByZXNwb25zZS5zdGF0dXNDb2RlIDwgMzAwKSB7ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYERvd25sb2FkZWQgZmlsZSAke3VybH0gdG8gJHtkZXN0UGF0aH1gKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmNvbnRlbnQudG9GaWxlKGRlc3RQYXRoKS5wYXRoO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGRvd25sb2FkIGZpbGUgXCIgKyB1cmwgKyBcIiAgKEhUVFAgc3RhdHVzIGNvZGU6IFwiICsgcmVzcG9uc2Uuc3RhdHVzQ29kZSArIFwiKVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBQcm9taXNlLmFsbChbXHJcbiAgICAgICAgZG93bmxvYWRJZk5lZWRlZCh4bWxVcmxTdHJpbmcseG1sRGVzdFBhdGgpLCBcclxuICAgICAgICBkb3dubG9hZElmTmVlZGVkKGRhdFVybFN0cmluZyxkYXREZXN0UGF0aClcclxuICAgIF0pLnRoZW4oKCk9PnhtbERlc3RQYXRoKTtcclxufSAiXX0=