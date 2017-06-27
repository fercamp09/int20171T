"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var observable_1 = require("data/observable");
var observable_array_1 = require("data/observable-array");
var bookmarks = require("./bookmarks");
var Argon = require("@argonjs/argon");
var argon_vuforia_provider_1 = require("./argon-vuforia-provider");
var argon_device_provider_1 = require("./argon-device-provider");
var argon_reality_viewers_1 = require("./argon-reality-viewers");
var util_1 = require("./util");
var URI = require("urijs");
var argon_1 = require("@argonjs/argon");
var permissions_1 = require("./permissions");
var config_1 = require("../../config");
var LayerDetails = (function (_super) {
    __extends(LayerDetails, _super);
    function LayerDetails() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.uri = '';
        _this.title = '';
        _this.log = new observable_array_1.ObservableArray();
        return _this;
    }
    return LayerDetails;
}(observable_1.Observable));
exports.LayerDetails = LayerDetails;
var NativescriptRealityViewerFactory = (function () {
    function NativescriptRealityViewerFactory(_createLiveReality, _createHostedReality) {
        this._createLiveReality = _createLiveReality;
        this._createHostedReality = _createHostedReality;
    }
    NativescriptRealityViewerFactory.prototype.createRealityViewer = function (uri) {
        var viewerType = Argon.RealityViewer.getType(uri);
        switch (viewerType) {
            case Argon.RealityViewer.LIVE:
                var realityViewer = this._createLiveReality();
                realityViewer.uri = uri;
                return realityViewer;
            case 'hosted':
                var realityViewer = this._createHostedReality();
                realityViewer.uri = uri;
                return realityViewer;
            default:
                throw new Error('Unsupported Reality Viewer URI: ' + uri);
        }
    };
    return NativescriptRealityViewerFactory;
}());
NativescriptRealityViewerFactory = __decorate([
    Argon.DI.inject(Argon.DI.Factory.of(argon_reality_viewers_1.NativescriptLiveRealityViewer), Argon.DI.Factory.of(argon_reality_viewers_1.NativescriptHostedRealityViewer)),
    __metadata("design:paramtypes", [Object, Object])
], NativescriptRealityViewerFactory);
exports.NativescriptRealityViewerFactory = NativescriptRealityViewerFactory;
var AppViewModel = (function (_super) {
    __extends(AppViewModel, _super);
    function AppViewModel() {
        var _this = _super.call(this) || this;
        _this.menuOpen = false;
        _this.cancelButtonShown = false;
        _this.realityChooserOpen = false;
        _this.overviewOpen = false;
        _this.bookmarksOpen = false;
        _this.debugEnabled = false;
        _this.viewerEnabled = false;
        _this.interactionMode = 'immersive';
        _this.interactionModeButtonEnabled = false;
        _this.currentUri = '';
        _this.isFavorite = false;
        _this.launchedFromUrl = false;
        _this.enablePermissions = config_1.default.ENABLE_PERMISSION_CHECK;
        _this.permissions = { 'geolocation': argon_1.PermissionState.NOT_REQUIRED, 'camera': argon_1.PermissionState.NOT_REQUIRED, 'world-structure': argon_1.PermissionState.NOT_REQUIRED };
        _this.permissionDescriptions = permissions_1.PermissionDescriptions;
        _this.permissionMenuOpen = false;
        bookmarks.favoriteList.on('change', function () {
            setTimeout(function () {
                _this.updateFavoriteStatus();
            });
        });
        _this.ready = new Promise(function (resolve) {
            _this._resolveReady = resolve;
        });
        _this.locIcon = [String.fromCharCode(0xe0c7), String.fromCharCode(0xe0c8)];
        return _this;
    }
    AppViewModel.prototype.setReady = function () {
        if (this.argon)
            return; // already initialized
        var container = new Argon.DI.Container;
        container.registerSingleton(Argon.DeviceService, argon_device_provider_1.NativescriptDeviceService);
        container.registerSingleton(Argon.VuforiaServiceProvider, argon_vuforia_provider_1.NativescriptVuforiaServiceProvider);
        container.registerSingleton(Argon.DeviceServiceProvider, argon_device_provider_1.NativescriptDeviceServiceProvider);
        container.registerSingleton(Argon.RealityViewerFactory, NativescriptRealityViewerFactory);
        var argon;
        try {
            argon = this.argon = Argon.init(null, {
                role: Argon.Role.MANAGER,
                title: 'ArgonApp'
            }, container);
        }
        catch (e) {
            alert(e.message);
        }
        if (!argon)
            return;
        argon.reality.default = Argon.RealityViewer.LIVE;
        argon.provider.reality.installedEvent.addEventListener(function (_a) {
            var viewer = _a.viewer;
            if (!bookmarks.realityMap.get(viewer.uri)) {
                var bookmark_1 = new bookmarks.BookmarkItem({ uri: viewer.uri });
                bookmarks.realityList.push(bookmark_1);
                if (viewer.session) {
                    bookmark_1.title = viewer.session.info.title;
                }
                else {
                    var remove_1 = viewer.connectEvent.addEventListener(function (session) {
                        remove_1();
                        bookmark_1.title = session.info.title;
                    });
                }
            }
        });
        argon.provider.reality.uninstalledEvent.addEventListener(function (_a) {
            var viewer = _a.viewer;
            var item = bookmarks.realityMap.get(viewer.uri);
            if (item) {
                var idx = bookmarks.realityList.indexOf(item);
                bookmarks.realityList.splice(idx, 1);
            }
        });
        argon.provider.focus.sessionFocusEvent.addEventListener(function (_a) {
            var current = _a.current;
            console.log("Argon focus changed: " + (current ? current.uri : undefined));
        });
        if (config_1.default.ENABLE_PERMISSION_CHECK) {
            argon.provider.permission.handlePermissionRequest = function (session, id, options) {
                return permissions_1.permissionManager.handlePermissionRequest(session, id, options);
            };
            argon.session.connectEvent.addEventListener(function (session) {
                session.on['ar.permission.query'] = function (_a) {
                    var type = _a.type;
                    var state = permissions_1.permissionManager.getPermissionStateBySession(session, type) || argon_1.PermissionState.NOT_REQUIRED;
                    return Promise.resolve({ state: state });
                };
            });
            argon.provider.permission.getPermissionState = function (session, type) {
                return permissions_1.permissionManager.getPermissionStateBySession(session, type);
            };
        }
        argon.vuforia.isAvailable().then(function (available) {
            if (available) {
                var licenseKey = util_1.getInternalVuforiaKey();
                if (!licenseKey) {
                    setTimeout(function () { return alert("\nCongrats,\nYou have successfully built the Argon Browser! \n\nUnfortunately, it looks like you are missing a Vuforia License Key. Please supply your own key in \"app/config.ts\", and try building again!\n\n:D"); }, 1000);
                    return;
                }
                argon.vuforia.initWithUnencryptedKey(licenseKey).catch(function (err) {
                    alert(err.message);
                });
            }
        });
        this.setLayerDetails(new LayerDetails(null));
        this._resolveReady();
    };
    AppViewModel.prototype.ensureReady = function () {
        if (!this.argon)
            throw new Error('AppViewModel is not ready');
    };
    AppViewModel.prototype.toggleMenu = function () {
        this.ensureReady();
        this.set('menuOpen', !this.menuOpen);
    };
    AppViewModel.prototype.hideMenu = function () {
        this.ensureReady();
        this.set('menuOpen', false);
    };
    AppViewModel.prototype.toggleInteractionMode = function () {
        this.ensureReady();
        this.set('interactionMode', this.interactionMode === 'page' ? 'immersive' : 'page');
    };
    AppViewModel.prototype.setInteractionMode = function (mode) {
        this.ensureReady();
        this.set('interactionMode', mode);
    };
    AppViewModel.prototype.showOverview = function () {
        this.ensureReady();
        this.set('overviewOpen', true);
    };
    AppViewModel.prototype.hideOverview = function () {
        this.ensureReady();
        this.set('overviewOpen', false);
    };
    AppViewModel.prototype.toggleOverview = function () {
        this.ensureReady();
        this.set('overviewOpen', !this.overviewOpen);
    };
    AppViewModel.prototype.showBookmarks = function () {
        this.ensureReady();
        this.set('bookmarksOpen', true);
    };
    AppViewModel.prototype.hideBookmarks = function () {
        this.ensureReady();
        this.set('bookmarksOpen', false);
    };
    AppViewModel.prototype.showRealityChooser = function () {
        this.ensureReady();
        this.set('realityChooserOpen', true);
    };
    AppViewModel.prototype.hideRealityChooser = function () {
        this.ensureReady();
        this.set('realityChooserOpen', false);
    };
    AppViewModel.prototype.showCancelButton = function () {
        this.ensureReady();
        this.set('cancelButtonShown', true);
    };
    AppViewModel.prototype.hideCancelButton = function () {
        this.ensureReady();
        this.set('cancelButtonShown', false);
    };
    AppViewModel.prototype.toggleDebug = function () {
        this.ensureReady();
        this.set('debugEnabled', !this.debugEnabled);
    };
    AppViewModel.prototype.setDebugEnabled = function (enabled) {
        this.ensureReady();
        this.set('debugEnabled', enabled);
    };
    AppViewModel.prototype.toggleViewer = function () {
        this.ensureReady();
        this.setViewerEnabled(!this.viewerEnabled);
    };
    AppViewModel.prototype.showPermissionIcons = function () {
        this.ensureReady();
        this.set('enablePermissions', config_1.default.ENABLE_PERMISSION_CHECK);
    };
    AppViewModel.prototype.hidePermissionIcons = function () {
        this.ensureReady();
        this.set('enablePermissions', false);
    };
    AppViewModel.prototype.setViewerEnabled = function (enabled) {
        this.ensureReady();
        this.set('viewerEnabled', enabled);
        if (enabled)
            this.argon.device.requestPresentHMD();
        else
            this.argon.device.exitPresentHMD();
    };
    AppViewModel.prototype._onLayerDetailsChange = function (data) {
        this.ensureReady();
        if (data.propertyName === 'uri') {
            this.set('currentUri', data.value);
            this.updateFavoriteStatus();
        }
    };
    AppViewModel.prototype.setLayerDetails = function (details) {
        this.ensureReady();
        this.layerDetails && this.layerDetails.off('propertyChange', this._onLayerDetailsChange, this);
        this.set('layerDetails', details);
        this.set('bookmarksOpen', !details.uri);
        this.set('currentUri', details.uri);
        this.updateFavoriteStatus();
        details.on('propertyChange', this._onLayerDetailsChange, this);
    };
    AppViewModel.prototype.updateFavoriteStatus = function () {
        this.ensureReady();
        this.set('isFavorite', !!bookmarks.favoriteMap.get(this.currentUri));
    };
    AppViewModel.prototype.loadUrl = function (url) {
        this.ensureReady();
        this.notify({
            eventName: AppViewModel.loadUrlEvent,
            object: this,
            url: url,
            newLayer: false
        });
        this.layerDetails.set('uri', url);
        this.set('bookmarksOpen', !url);
    };
    AppViewModel.prototype.openUrl = function (url) {
        this.ensureReady();
        this.notify({
            eventName: AppViewModel.loadUrlEvent,
            object: this,
            url: url,
            newLayer: true
        });
        this.layerDetails.set('uri', url);
        this.set('bookmarksOpen', !url);
    };
    AppViewModel.prototype.setPermission = function (permission) {
        this.ensureReady();
        this.permissions[permission.type] = permission.state;
        this.notifyPropertyChange("permissions", null);
    };
    AppViewModel.prototype.togglePermissionMenu = function (type) {
        this.ensureReady();
        if (!this.permissionMenuOpen)
            this.changeSelectedPermission(type);
        this.set('permissionMenuOpen', !this.permissionMenuOpen);
    };
    AppViewModel.prototype.hidePermissionMenu = function () {
        this.ensureReady();
        this.set('permissionMenuOpen', false);
    };
    AppViewModel.prototype.changeSelectedPermission = function (type) {
        this.set('selectedPermission', new argon_1.Permission(type, this.permissions[type]));
    };
    AppViewModel.prototype.updatePermissionsFromStorage = function (uri) {
        permissions_1.permissionManager.loadPermissionsToUI(uri);
    };
    AppViewModel.prototype.changePermissions = function () {
        this.ensureReady();
        if (this.selectedPermission.state === argon_1.PermissionState.GRANTED) {
            this.permissions[this.selectedPermission.type] = argon_1.PermissionState.DENIED;
            this.notifyPropertyChange("permissions", null);
            this.changeSelectedPermission(this.selectedPermission.type); // Update the selected permission UI
            if (this.currentUri) {
                var identifier = URI(this.currentUri).hostname() + URI(this.currentUri).port();
                permissions_1.permissionManager.savePermissionOnMap(identifier, this.selectedPermission.type, argon_1.PermissionState.DENIED);
            }
        }
        else {
            this.permissions[this.selectedPermission.type] = argon_1.PermissionState.GRANTED;
            this.notifyPropertyChange("permissions", null);
            this.changeSelectedPermission(this.selectedPermission.type); // Update the selected permission UI
            if (this.currentUri) {
                var identifier = URI(this.currentUri).hostname() + URI(this.currentUri).port();
                permissions_1.permissionManager.savePermissionOnMap(identifier, this.selectedPermission.type, argon_1.PermissionState.GRANTED);
                // const session = this.argon.provider.focus.session;
                // const entityServiceProvider = this.argon.provider.entity;
                // const type = this.selectedPermission.type;
                // // This part mimics the 'ar.entity.subscribe' handler
                // if (session) {
                //     const options = permissionManager.getLastUsedOption(session.uri, type);
                //     const subscriptions = entityServiceProvider.subscriptionsBySubscriber.get(session);
                //     const subscribers = entityServiceProvider.subscribersByEntity.get(type) || new Set<SessionPort>();
                //     entityServiceProvider.subscribersByEntity.set(type, subscribers);
                //     subscribers.add(session);
                //     if (subscriptions) subscriptions.set(type, options);    // This should always happen
                //     entityServiceProvider.sessionSubscribedEvent.raiseEvent({session: session, id: type, options: options});
                // }
            }
        }
    };
    return AppViewModel;
}(observable_1.Observable));
AppViewModel.loadUrlEvent = 'loadUrl';
exports.AppViewModel = AppViewModel;
exports.appViewModel = new AppViewModel;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwVmlld01vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiQXBwVmlld01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsOENBQXlFO0FBQ3pFLDBEQUFxRDtBQUNyRCx1Q0FBd0M7QUFDeEMsc0NBQXdDO0FBQ3hDLG1FQUE0RTtBQUM1RSxpRUFBcUc7QUFDckcsaUVBQXVHO0FBQ3ZHLCtCQUE2QztBQUM3QywyQkFBNkI7QUFFN0Isd0NBQXVGO0FBQ3ZGLDZDQUF1RTtBQUN2RSx1Q0FBa0M7QUFRbEM7SUFBa0MsZ0NBQVU7SUFBNUM7UUFBQSxxRUFJQztRQUhHLFNBQUcsR0FBRyxFQUFFLENBQUM7UUFDVCxXQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ1gsU0FBRyxHQUFHLElBQUksa0NBQWUsRUFBVyxDQUFDOztJQUN6QyxDQUFDO0lBQUQsbUJBQUM7QUFBRCxDQUFDLEFBSkQsQ0FBa0MsdUJBQVUsR0FJM0M7QUFKWSxvQ0FBWTtBQU96QixJQUFzQixnQ0FBZ0M7SUFDbEQsMENBQ1ksa0JBQWtCLEVBQ2xCLG9CQUFvQjtRQURwQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQUE7UUFDbEIseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFBO0lBQ2hDLENBQUM7SUFFRCw4REFBbUIsR0FBbkIsVUFBb0IsR0FBVTtRQUMxQixJQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEtBQUssS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJO2dCQUN6QixJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDOUMsYUFBYSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Z0JBQ3hCLE1BQU0sQ0FBQyxhQUFhLENBQUM7WUFDekIsS0FBSyxRQUFRO2dCQUNULElBQUksYUFBYSxHQUFHLElB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QTRCakMseUJBQVksR0FBYSxTQUFTLENBQUE7QUE1QmhDLG9DQUFZO0FBeVZaLFFBQUEsWUFBWSxHQUFHLElBQUksWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtPYnNlcnZhYmxlLCBQcm9wZXJ0eUNoYW5nZURhdGEsIEV2ZW50RGF0YX0gZnJvbSAnZGF0YS9vYnNlcnZhYmxlJ1xyXG5pbXBvcnQge09ic2VydmFibGVBcnJheX0gZnJvbSAnZGF0YS9vYnNlcnZhYmxlLWFycmF5J1xyXG5pbXBvcnQgKiBhcyBib29rbWFya3MgZnJvbSAnLi9ib29rbWFya3MnXHJcbmltcG9ydCAqIGFzIEFyZ29uIGZyb20gJ0BhcmdvbmpzL2FyZ29uJztcclxuaW1wb3J0IHtOYXRpdmVzY3JpcHRWdWZvcmlhU2VydmljZVByb3ZpZGVyfSBmcm9tICcuL2FyZ29uLXZ1Zm9yaWEtcHJvdmlkZXInO1xyXG5pbXBvcnQge05hdGl2ZXNjcmlwdERldmljZVNlcnZpY2UsIE5hdGl2ZXNjcmlwdERldmljZVNlcnZpY2VQcm92aWRlcn0gZnJvbSAnLi9hcmdvbi1kZXZpY2UtcHJvdmlkZXInO1xyXG5pbXBvcnQge05hdGl2ZXNjcmlwdExpdmVSZWFsaXR5Vmlld2VyLCBOYXRpdmVzY3JpcHRIb3N0ZWRSZWFsaXR5Vmlld2VyfSBmcm9tICcuL2FyZ29uLXJlYWxpdHktdmlld2Vycyc7XHJcbmltcG9ydCB7Z2V0SW50ZXJuYWxWdWZvcmlhS2V5fSBmcm9tICcuL3V0aWwnO1xyXG5pbXBvcnQgKiBhcyBVUkkgZnJvbSAndXJpanMnO1xyXG5pbXBvcnQge0xvZ0l0ZW19IGZyb20gJ2FyZ29uLXdlYi12aWV3JztcclxuaW1wb3J0IHtQZXJtaXNzaW9uU3RhdGUsIFBlcm1pc3Npb25UeXBlLCBQZXJtaXNzaW9uLCBTZXNzaW9uUG9ydH0gZnJvbSAnQGFyZ29uanMvYXJnb24nXHJcbmltcG9ydCB7cGVybWlzc2lvbk1hbmFnZXIsIFBlcm1pc3Npb25EZXNjcmlwdGlvbnN9IGZyb20gJy4vcGVybWlzc2lvbnMnXHJcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vY29uZmlnJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTG9hZFVybEV2ZW50RGF0YSBleHRlbmRzIEV2ZW50RGF0YSB7XHJcbiAgICBldmVudE5hbWU6ICdsb2FkVXJsJyxcclxuICAgIHVybDogc3RyaW5nLFxyXG4gICAgbmV3TGF5ZXI6IGJvb2xlYW4sXHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBMYXllckRldGFpbHMgZXh0ZW5kcyBPYnNlcnZhYmxlIHtcclxuICAgIHVyaSA9ICcnO1xyXG4gICAgdGl0bGUgPSAnJztcclxuICAgIGxvZyA9IG5ldyBPYnNlcnZhYmxlQXJyYXk8TG9nSXRlbT4oKTtcclxufVxyXG5cclxuQEFyZ29uLkRJLmluamVjdChBcmdvbi5ESS5GYWN0b3J5Lm9mKE5hdGl2ZXNjcmlwdExpdmVSZWFsaXR5Vmlld2VyKSwgQXJnb24uREkuRmFjdG9yeS5vZihOYXRpdmVzY3JpcHRIb3N0ZWRSZWFsaXR5Vmlld2VyKSlcclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE5hdGl2ZXNjcmlwdFJlYWxpdHlWaWV3ZXJGYWN0b3J5IHtcclxuICAgIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgIHByaXZhdGUgX2NyZWF0ZUxpdmVSZWFsaXR5LCBcclxuICAgICAgICBwcml2YXRlIF9jcmVhdGVIb3N0ZWRSZWFsaXR5KSB7XHJcbiAgICB9XHJcblxyXG4gICAgY3JlYXRlUmVhbGl0eVZpZXdlcih1cmk6c3RyaW5nKSA6IEFyZ29uLlJlYWxpdHlWaWV3ZXIge1xyXG4gICAgICAgIGNvbnN0IHZpZXdlclR5cGUgPSBBcmdvbi5SZWFsaXR5Vmlld2VyLmdldFR5cGUodXJpKTtcclxuICAgICAgICBzd2l0Y2ggKHZpZXdlclR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBBcmdvbi5SZWFsaXR5Vmlld2VyLkxJVkU6XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVhbGl0eVZpZXdlciA9IHRoaXMuX2NyZWF0ZUxpdmVSZWFsaXR5KCk7XHJcbiAgICAgICAgICAgICAgICByZWFsaXR5Vmlld2VyLnVyaSA9IHVyaTtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWFsaXR5Vmlld2VyO1xyXG4gICAgICAgICAgICBjYXNlICdob3N0ZWQnOlxyXG4gICAgICAgICAgICAgICAgdmFyIHJlYWxpdHlWaWV3ZXIgPSB0aGlzLl9jcmVhdGVIb3N0ZWRSZWFsaXR5KCk7XHJcbiAgICAgICAgICAgICAgICByZWFsaXR5Vmlld2VyLnVyaSA9IHVyaTtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWFsaXR5Vmlld2VyO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBSZWFsaXR5IFZpZXdlciBVUkk6ICcgKyB1cmkpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdHlwZSBJbnRlcmFjdGlvbk1vZGUgPSAnaW1tZXJzaXZlJ3wncGFnZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgQXBwVmlld01vZGVsIGV4dGVuZHMgT2JzZXJ2YWJsZSB7ICAvL29ic2VydmFibGUgY3JlYXRlcyBkYXRhIGJpbmRpbmcgYmV0d2VlbiB0aGlzIGNvZGUgYW5kIHhtbCBVSVxyXG4gICAgbWVudU9wZW4gPSBmYWxzZTtcclxuICAgIGNhbmNlbEJ1dHRvblNob3duID0gZmFsc2U7XHJcbiAgICByZWFsaXR5Q2hvb3Nlck9wZW4gPSBmYWxzZTtcclxuICAgIG92ZXJ2aWV3T3BlbiA9IGZhbHNlO1xyXG4gICAgYm9va21hcmtzT3BlbiA9IGZhbHNlO1xyXG4gICAgZGVidWdFbmFibGVkID0gZmFsc2U7XHJcbiAgICB2aWV3ZXJFbmFibGVkID0gZmFsc2U7XHJcbiAgICBpbnRlcmFjdGlvbk1vZGU6SW50ZXJhY3Rpb25Nb2RlID0gJ2ltbWVyc2l2ZSc7XHJcbiAgICBpbnRlcmFjdGlvbk1vZGVCdXR0b25FbmFibGVkID0gZmFsc2U7XHJcbiAgICBsYXllckRldGFpbHM6TGF5ZXJEZXRhaWxzO1xyXG4gICAgY3VycmVudFVyaT8gPSAnJztcclxuICAgIGlzRmF2b3JpdGUgPSBmYWxzZTtcclxuICAgIGxhdW5jaGVkRnJvbVVybCA9IGZhbHNlO1xyXG4gICAgZW5hYmxlUGVybWlzc2lvbnMgPSBjb25maWcuRU5BQkxFX1BFUk1JU1NJT05fQ0hFQ0s7XHJcbiAgICBwZXJtaXNzaW9ucyA9IHsnZ2VvbG9jYXRpb24nOiBQZXJtaXNzaW9uU3RhdGUuTk9UX1JFUVVJUkVELCAnY2FtZXJhJzogUGVybWlzc2lvblN0YXRlLk5PVF9SRVFVSVJFRCwgJ3dvcmxkLXN0cnVjdHVyZSc6IFBlcm1pc3Npb25TdGF0ZS5OT1RfUkVRVUlSRUR9O1xyXG4gICAgcGVybWlzc2lvbkRlc2NyaXB0aW9ucyA9IFBlcm1pc3Npb25EZXNjcmlwdGlvbnM7XHJcbiAgICBwZXJtaXNzaW9uTWVudU9wZW4gPSBmYWxzZTtcclxuXHJcbiAgICAvLyBjdXJyZW50UGVybWlzc2lvblNlc3Npb246IFNlc3Npb25Qb3J0OyAgLy90aGUgZm9jdXNlZCBzZXNzaW9uXHJcbiAgICBzZWxlY3RlZFBlcm1pc3Npb246IFBlcm1pc3Npb247ICAvL3R5cGUsIG5hbWUsIHN0YXRlXHJcbiAgICBsb2NJY29uOyAgICAvLyBTdG9yZXMgbG9jYXRpb24gaWNvbnNcclxuXHJcbiAgICBwdWJsaWMgYXJnb246QXJnb24uQXJnb25TeXN0ZW07XHJcblxyXG4gICAgcHJpdmF0ZSBfcmVzb2x2ZVJlYWR5OkZ1bmN0aW9uO1xyXG4gICAgcmVhZHk6UHJvbWlzZTx2b2lkPjtcclxuICAgIFxyXG4gICAgc3RhdGljIGxvYWRVcmxFdmVudDonbG9hZFVybCcgPSAnbG9hZFVybCdcclxuICAgIFxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICBib29rbWFya3MuZmF2b3JpdGVMaXN0Lm9uKCdjaGFuZ2UnLCgpPT57XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCk9PntcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlRmF2b3JpdGVTdGF0dXMoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICB0aGlzLnJlYWR5ID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZVJlYWR5ID0gcmVzb2x2ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5sb2NJY29uID0gW1N0cmluZy5mcm9tQ2hhckNvZGUoMHhlMGM3KSwgU3RyaW5nLmZyb21DaGFyQ29kZSgweGUwYzgpXTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRSZWFkeSgpIHtcclxuICAgICAgICBpZiAodGhpcy5hcmdvbikgcmV0dXJuOyAvLyBhbHJlYWR5IGluaXRpYWxpemVkXHJcblxyXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IG5ldyBBcmdvbi5ESS5Db250YWluZXI7XHJcbiAgICAgICAgY29udGFpbmVyLnJlZ2lzdGVyU2luZ2xldG9uKEFyZ29uLkRldmljZVNlcnZpY2UsIE5hdGl2ZXNjcmlwdERldmljZVNlcnZpY2UpO1xyXG4gICAgICAgIGNvbnRhaW5lci5yZWdpc3RlclNpbmdsZXRvbihBcmdvbi5WdWZvcmlhU2VydmljZVByb3ZpZGVyLCBOYXRpdmVzY3JpcHRWdWZvcmlhU2VydmljZVByb3ZpZGVyKTtcclxuICAgICAgICBjb250YWluZXIucmVnaXN0ZXJTaW5nbGV0b24oQXJnb24uRGV2aWNlU2VydmljZVByb3ZpZGVyLCBOYXRpdmVzY3JpcHREZXZpY2VTZXJ2aWNlUHJvdmlkZXIpO1xyXG4gICAgICAgIGNvbnRhaW5lci5yZWdpc3RlclNpbmdsZXRvbihBcmdvbi5SZWFsaXR5Vmlld2VyRmFjdG9yeSwgTmF0aXZlc2NyaXB0UmVhbGl0eVZpZXdlckZhY3RvcnkpO1xyXG5cclxuICAgICAgICBsZXQgYXJnb247XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXJnb24gPSB0aGlzLmFyZ29uID0gQXJnb24uaW5pdChudWxsLCB7XHJcbiAgICAgICAgICAgICAgICByb2xlOiBBcmdvbi5Sb2xlLk1BTkFHRVIsXHJcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0FyZ29uQXBwJ1xyXG4gICAgICAgICAgICB9LCBjb250YWluZXIpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgYWxlcnQoZS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFhcmdvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICBhcmdvbi5yZWFsaXR5LmRlZmF1bHQgPSBBcmdvbi5SZWFsaXR5Vmlld2VyLkxJVkU7XHJcblxyXG4gICAgICAgIGFyZ29uLnByb3ZpZGVyLnJlYWxpdHkuaW5zdGFsbGVkRXZlbnQuYWRkRXZlbnRMaXN0ZW5lcigoe3ZpZXdlcn0pPT57XHJcbiAgICAgICAgICAgIGlmICghYm9va21hcmtzLnJlYWxpdHlNYXAuZ2V0KHZpZXdlci51cmkpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBib29rbWFyayA9IG5ldyBib29rbWFya3MuQm9va21hcmtJdGVtKHt1cmk6IHZpZXdlci51cml9KTtcclxuICAgICAgICAgICAgICAgIGJvb2ttYXJrcy5yZWFsaXR5TGlzdC5wdXNoKGJvb2ttYXJrKTtcclxuICAgICAgICAgICAgICAgIGlmICh2aWV3ZXIuc2Vzc2lvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGJvb2ttYXJrLnRpdGxlID0gdmlld2VyLnNlc3Npb24uaW5mby50aXRsZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlbW92ZSA9IHZpZXdlci5jb25uZWN0RXZlbnQuYWRkRXZlbnRMaXN0ZW5lcigoc2Vzc2lvbik9PntcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvb2ttYXJrLnRpdGxlID0gc2Vzc2lvbi5pbmZvLnRpdGxlO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGFyZ29uLnByb3ZpZGVyLnJlYWxpdHkudW5pbnN0YWxsZWRFdmVudC5hZGRFdmVudExpc3RlbmVyKCh7dmlld2VyfSk9PntcclxuICAgICAgICAgICAgY29uc3QgaXRlbSA9IGJvb2ttYXJrcy5yZWFsaXR5TWFwLmdldCh2aWV3ZXIudXJpKTtcclxuICAgICAgICAgICAgaWYgKGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIHZhciBpZHggPSBib29rbWFya3MucmVhbGl0eUxpc3QuaW5kZXhPZihpdGVtKTtcclxuICAgICAgICAgICAgICAgIGJvb2ttYXJrcy5yZWFsaXR5TGlzdC5zcGxpY2UoaWR4LCAxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGFyZ29uLnByb3ZpZGVyLmZvY3VzLnNlc3Npb25Gb2N1c0V2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKHtjdXJyZW50fSk9PntcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJBcmdvbiBmb2N1cyBjaGFuZ2VkOiBcIiArIChjdXJyZW50ID8gY3VycmVudC51cmkgOiB1bmRlZmluZWQpKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKGNvbmZpZy5FTkFCTEVfUEVSTUlTU0lPTl9DSEVDSykge1xyXG4gICAgICAgICAgICBhcmdvbi5wcm92aWRlci5wZXJtaXNzaW9uLmhhbmRsZVBlcm1pc3Npb25SZXF1ZXN0ID0gKHNlc3Npb24sIGlkLCBvcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcGVybWlzc2lvbk1hbmFnZXIuaGFuZGxlUGVybWlzc2lvblJlcXVlc3Qoc2Vzc2lvbiwgaWQsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGFyZ29uLnNlc3Npb24uY29ubmVjdEV2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKHNlc3Npb246IFNlc3Npb25Qb3J0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLm9uWydhci5wZXJtaXNzaW9uLnF1ZXJ5J10gPSAoe3R5cGV9IDoge3R5cGU6IFBlcm1pc3Npb25UeXBlfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlOiBQZXJtaXNzaW9uU3RhdGUgPSBwZXJtaXNzaW9uTWFuYWdlci5nZXRQZXJtaXNzaW9uU3RhdGVCeVNlc3Npb24oc2Vzc2lvbiwgdHlwZSkgfHwgUGVybWlzc2lvblN0YXRlLk5PVF9SRVFVSVJFRDsgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe3N0YXRlfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGFyZ29uLnByb3ZpZGVyLnBlcm1pc3Npb24uZ2V0UGVybWlzc2lvblN0YXRlID0gKHNlc3Npb24sIHR5cGUpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwZXJtaXNzaW9uTWFuYWdlci5nZXRQZXJtaXNzaW9uU3RhdGVCeVNlc3Npb24oc2Vzc2lvbiwgdHlwZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFyZ29uLnZ1Zm9yaWEuaXNBdmFpbGFibGUoKS50aGVuKChhdmFpbGFibGUpPT57XHJcbiAgICAgICAgICAgIGlmIChhdmFpbGFibGUpIHtcclxuICAgICAgICAgICAgICAgIGxldCBsaWNlbnNlS2V5ID0gZ2V0SW50ZXJuYWxWdWZvcmlhS2V5KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFsaWNlbnNlS2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKT0+YWxlcnQoYFxyXG5Db25ncmF0cyxcclxuWW91IGhhdmUgc3VjY2Vzc2Z1bGx5IGJ1aWx0IHRoZSBBcmdvbiBCcm93c2VyISBcclxuXHJcblVuZm9ydHVuYXRlbHksIGl0IGxvb2tzIGxpa2UgeW91IGFyZSBtaXNzaW5nIGEgVnVmb3JpYSBMaWNlbnNlIEtleS4gUGxlYXNlIHN1cHBseSB5b3VyIG93biBrZXkgaW4gXCJhcHAvY29uZmlnLnRzXCIsIGFuZCB0cnkgYnVpbGRpbmcgYWdhaW4hXHJcblxyXG46RGBcclxuICAgICAgICAgICAgICAgICAgICApLDEwMDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGFyZ29uLnZ1Zm9yaWEuaW5pdFdpdGhVbmVuY3J5cHRlZEtleShsaWNlbnNlS2V5KS5jYXRjaCgoZXJyKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0TGF5ZXJEZXRhaWxzKG5ldyBMYXllckRldGFpbHMobnVsbCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuX3Jlc29sdmVSZWFkeSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGVuc3VyZVJlYWR5KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5hcmdvbikgdGhyb3cgbmV3IEVycm9yKCdBcHBWaWV3TW9kZWwgaXMgbm90IHJlYWR5Jyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRvZ2dsZU1lbnUoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdtZW51T3BlbicsICF0aGlzLm1lbnVPcGVuKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaGlkZU1lbnUoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdtZW51T3BlbicsIGZhbHNlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdG9nZ2xlSW50ZXJhY3Rpb25Nb2RlKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnaW50ZXJhY3Rpb25Nb2RlJywgdGhpcy5pbnRlcmFjdGlvbk1vZGUgPT09ICdwYWdlJyA/ICdpbW1lcnNpdmUnIDogJ3BhZ2UnKVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzZXRJbnRlcmFjdGlvbk1vZGUobW9kZTpJbnRlcmFjdGlvbk1vZGUpIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ2ludGVyYWN0aW9uTW9kZScsIG1vZGUpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzaG93T3ZlcnZpZXcoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdvdmVydmlld09wZW4nLCB0cnVlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaGlkZU92ZXJ2aWV3KCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnb3ZlcnZpZXdPcGVuJywgZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0b2dnbGVPdmVydmlldygpIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ292ZXJ2aWV3T3BlbicsICF0aGlzLm92ZXJ2aWV3T3Blbik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHNob3dCb29rbWFya3MoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdib29rbWFya3NPcGVuJywgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGhpZGVCb29rbWFya3MoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdib29rbWFya3NPcGVuJywgZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzaG93UmVhbGl0eUNob29zZXIoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdyZWFsaXR5Q2hvb3Nlck9wZW4nLCB0cnVlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaGlkZVJlYWxpdHlDaG9vc2VyKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgncmVhbGl0eUNob29zZXJPcGVuJywgZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzaG93Q2FuY2VsQnV0dG9uKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnY2FuY2VsQnV0dG9uU2hvd24nLCB0cnVlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaGlkZUNhbmNlbEJ1dHRvbigpIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ2NhbmNlbEJ1dHRvblNob3duJywgZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0b2dnbGVEZWJ1ZygpIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ2RlYnVnRW5hYmxlZCcsICF0aGlzLmRlYnVnRW5hYmxlZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHNldERlYnVnRW5hYmxlZChlbmFibGVkOmJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ2RlYnVnRW5hYmxlZCcsIGVuYWJsZWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0b2dnbGVWaWV3ZXIoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMuc2V0Vmlld2VyRW5hYmxlZCghdGhpcy52aWV3ZXJFbmFibGVkKTtcclxuICAgIH1cclxuXHJcbiAgICBzaG93UGVybWlzc2lvbkljb25zKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnZW5hYmxlUGVybWlzc2lvbnMnLCBjb25maWcuRU5BQkxFX1BFUk1JU1NJT05fQ0hFQ0spO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBoaWRlUGVybWlzc2lvbkljb25zKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnZW5hYmxlUGVybWlzc2lvbnMnLCBmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Vmlld2VyRW5hYmxlZChlbmFibGVkOmJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVJlYWR5KCk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ3ZpZXdlckVuYWJsZWQnLCBlbmFibGVkKTtcclxuICAgICAgICBpZiAoZW5hYmxlZCkgdGhpcy5hcmdvbi5kZXZpY2UucmVxdWVzdFByZXNlbnRITUQoKTtcclxuICAgICAgICBlbHNlIHRoaXMuYXJnb24uZGV2aWNlLmV4aXRQcmVzZW50SE1EKCk7XHJcbiAgICB9XHJcblxyXG4gICAgX29uTGF5ZXJEZXRhaWxzQ2hhbmdlKGRhdGE6UHJvcGVydHlDaGFuZ2VEYXRhKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIGlmIChkYXRhLnByb3BlcnR5TmFtZSA9PT0gJ3VyaScpIHtcclxuICAgICAgICAgICAgdGhpcy5zZXQoJ2N1cnJlbnRVcmknLCBkYXRhLnZhbHVlKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVGYXZvcml0ZVN0YXR1cygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgc2V0TGF5ZXJEZXRhaWxzKGRldGFpbHM6TGF5ZXJEZXRhaWxzKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMubGF5ZXJEZXRhaWxzICYmIHRoaXMubGF5ZXJEZXRhaWxzLm9mZigncHJvcGVydHlDaGFuZ2UnLCB0aGlzLl9vbkxheWVyRGV0YWlsc0NoYW5nZSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5zZXQoJ2xheWVyRGV0YWlscycsIGRldGFpbHMpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdib29rbWFya3NPcGVuJywgIWRldGFpbHMudXJpKTtcclxuICAgICAgICB0aGlzLnNldCgnY3VycmVudFVyaScsIGRldGFpbHMudXJpKTtcclxuICAgICAgICB0aGlzLnVwZGF0ZUZhdm9yaXRlU3RhdHVzKCk7XHJcbiAgICAgICAgZGV0YWlscy5vbigncHJvcGVydHlDaGFuZ2UnLCB0aGlzLl9vbkxheWVyRGV0YWlsc0NoYW5nZSwgdGhpcyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHVwZGF0ZUZhdm9yaXRlU3RhdHVzKCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgnaXNGYXZvcml0ZScsICEhYm9va21hcmtzLmZhdm9yaXRlTWFwLmdldCh0aGlzLmN1cnJlbnRVcmkhKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGxvYWRVcmwodXJsOnN0cmluZykge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLm5vdGlmeSg8TG9hZFVybEV2ZW50RGF0YT57XHJcbiAgICAgICAgICAgIGV2ZW50TmFtZTogQXBwVmlld01vZGVsLmxvYWRVcmxFdmVudCxcclxuICAgICAgICAgICAgb2JqZWN0OiB0aGlzLFxyXG4gICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgIG5ld0xheWVyOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMubGF5ZXJEZXRhaWxzLnNldCgndXJpJywgdXJsKTtcclxuICAgICAgICB0aGlzLnNldCgnYm9va21hcmtzT3BlbicsICF1cmwpO1xyXG4gICAgfVxyXG5cclxuICAgIG9wZW5VcmwodXJsOnN0cmluZykge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLm5vdGlmeSg8TG9hZFVybEV2ZW50RGF0YT57XHJcbiAgICAgICAgICAgIGV2ZW50TmFtZTogQXBwVmlld01vZGVsLmxvYWRVcmxFdmVudCxcclxuICAgICAgICAgICAgb2JqZWN0OiB0aGlzLFxyXG4gICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgIG5ld0xheWVyOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5sYXllckRldGFpbHMuc2V0KCd1cmknLCB1cmwpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdib29rbWFya3NPcGVuJywgIXVybCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0UGVybWlzc2lvbihwZXJtaXNzaW9uOiBQZXJtaXNzaW9uKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHRoaXMucGVybWlzc2lvbnNbcGVybWlzc2lvbi50eXBlXSA9IHBlcm1pc3Npb24uc3RhdGU7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlQcm9wZXJ0eUNoYW5nZShcInBlcm1pc3Npb25zXCIsIG51bGwpO1xyXG4gICAgfVxyXG5cclxuICAgIHRvZ2dsZVBlcm1pc3Npb25NZW51KHR5cGU6IFBlcm1pc3Npb25UeXBlKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIGlmICghdGhpcy5wZXJtaXNzaW9uTWVudU9wZW4pICAgLy8gSWYgdGhlIG1lbnUgaXMgb3BlblxyXG4gICAgICAgICAgICB0aGlzLmNoYW5nZVNlbGVjdGVkUGVybWlzc2lvbih0eXBlKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zZXQoJ3Blcm1pc3Npb25NZW51T3BlbicsICF0aGlzLnBlcm1pc3Npb25NZW51T3Blbik7XHJcbiAgICB9XHJcblxyXG4gICAgaGlkZVBlcm1pc3Npb25NZW51KCkge1xyXG4gICAgICAgIHRoaXMuZW5zdXJlUmVhZHkoKTtcclxuICAgICAgICB0aGlzLnNldCgncGVybWlzc2lvbk1lbnVPcGVuJywgZmFsc2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGNoYW5nZVNlbGVjdGVkUGVybWlzc2lvbih0eXBlOiBQZXJtaXNzaW9uVHlwZSkge1xyXG4gICAgICAgIHRoaXMuc2V0KCdzZWxlY3RlZFBlcm1pc3Npb24nLCBuZXcgUGVybWlzc2lvbih0eXBlLCB0aGlzLnBlcm1pc3Npb25zW3R5cGVdKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlUGVybWlzc2lvbnNGcm9tU3RvcmFnZSh1cmk/OiBzdHJpbmcpIHtcclxuICAgICAgICBwZXJtaXNzaW9uTWFuYWdlci5sb2FkUGVybWlzc2lvbnNUb1VJKHVyaSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hhbmdlUGVybWlzc2lvbnMoKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkUGVybWlzc2lvbi5zdGF0ZSA9PT0gUGVybWlzc2lvblN0YXRlLkdSQU5URUQpIHsgICAgLy8gSWYgaXQgaXMgY3VycmVudGx5IGdyYW50ZWQsIHJldm9rZVxyXG4gICAgICAgICAgICB0aGlzLnBlcm1pc3Npb25zW3RoaXMuc2VsZWN0ZWRQZXJtaXNzaW9uLnR5cGVdID0gUGVybWlzc2lvblN0YXRlLkRFTklFRDtcclxuICAgICAgICAgICAgdGhpcy5ub3RpZnlQcm9wZXJ0eUNoYW5nZShcInBlcm1pc3Npb25zXCIsIG51bGwpO1xyXG4gICAgICAgICAgICB0aGlzLmNoYW5nZVNlbGVjdGVkUGVybWlzc2lvbih0aGlzLnNlbGVjdGVkUGVybWlzc2lvbi50eXBlKTsgICAgLy8gVXBkYXRlIHRoZSBzZWxlY3RlZCBwZXJtaXNzaW9uIFVJXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRVcmkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBVUkkodGhpcy5jdXJyZW50VXJpKS5ob3N0bmFtZSgpICsgVVJJKHRoaXMuY3VycmVudFVyaSkucG9ydCgpO1xyXG4gICAgICAgICAgICAgICAgcGVybWlzc2lvbk1hbmFnZXIuc2F2ZVBlcm1pc3Npb25Pbk1hcChpZGVudGlmaWVyLCB0aGlzLnNlbGVjdGVkUGVybWlzc2lvbi50eXBlLCBQZXJtaXNzaW9uU3RhdGUuREVOSUVEKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMucGVybWlzc2lvbnNbdGhpcy5zZWxlY3RlZFBlcm1pc3Npb24udHlwZV0gPSBQZXJtaXNzaW9uU3RhdGUuR1JBTlRFRDtcclxuICAgICAgICAgICAgdGhpcy5ub3RpZnlQcm9wZXJ0eUNoYW5nZShcInBlcm1pc3Npb25zXCIsIG51bGwpO1xyXG4gICAgICAgICAgICB0aGlzLmNoYW5nZVNlbGVjdGVkUGVybWlzc2lvbih0aGlzLnNlbGVjdGVkUGVybWlzc2lvbi50eXBlKTsgICAgLy8gVXBkYXRlIHRoZSBzZWxlY3RlZCBwZXJtaXNzaW9uIFVJXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRVcmkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkZW50aWZpZXIgPSBVUkkodGhpcy5jdXJyZW50VXJpKS5ob3N0bmFtZSgpICsgVVJJKHRoaXMuY3VycmVudFVyaSkucG9ydCgpO1xyXG4gICAgICAgICAgICAgICAgcGVybWlzc2lvbk1hbmFnZXIuc2F2ZVBlcm1pc3Npb25Pbk1hcChpZGVudGlmaWVyLCB0aGlzLnNlbGVjdGVkUGVybWlzc2lvbi50eXBlLCBQZXJtaXNzaW9uU3RhdGUuR1JBTlRFRCk7XHJcbiAgICAgICAgICAgICAgICAvLyBjb25zdCBzZXNzaW9uID0gdGhpcy5hcmdvbi5wcm92aWRlci5mb2N1cy5zZXNzaW9uO1xyXG4gICAgICAgICAgICAgICAgLy8gY29uc3QgZW50aXR5U2VydmljZVByb3ZpZGVyID0gdGhpcy5hcmdvbi5wcm92aWRlci5lbnRpdHk7XHJcbiAgICAgICAgICAgICAgICAvLyBjb25zdCB0eXBlID0gdGhpcy5zZWxlY3RlZFBlcm1pc3Npb24udHlwZTtcclxuICAgICAgICAgICAgICAgIC8vIC8vIFRoaXMgcGFydCBtaW1pY3MgdGhlICdhci5lbnRpdHkuc3Vic2NyaWJlJyBoYW5kbGVyXHJcbiAgICAgICAgICAgICAgICAvLyBpZiAoc2Vzc2lvbikge1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnN0IG9wdGlvbnMgPSBwZXJtaXNzaW9uTWFuYWdlci5nZXRMYXN0VXNlZE9wdGlvbihzZXNzaW9uLnVyaSwgdHlwZSk7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgY29uc3Qgc3Vic2NyaXB0aW9ucyA9IGVudGl0eVNlcnZpY2VQcm92aWRlci5zdWJzY3JpcHRpb25zQnlTdWJzY3JpYmVyLmdldChzZXNzaW9uKTtcclxuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCBzdWJzY3JpYmVycyA9IGVudGl0eVNlcnZpY2VQcm92aWRlci5zdWJzY3JpYmVyc0J5RW50aXR5LmdldCh0eXBlKSB8fCBuZXcgU2V0PFNlc3Npb25Qb3J0PigpO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGVudGl0eVNlcnZpY2VQcm92aWRlci5zdWJzY3JpYmVyc0J5RW50aXR5LnNldCh0eXBlLCBzdWJzY3JpYmVycyk7XHJcbiAgICAgICAgICAgICAgICAvLyAgICAgc3Vic2NyaWJlcnMuYWRkKHNlc3Npb24pO1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIGlmIChzdWJzY3JpcHRpb25zKSBzdWJzY3JpcHRpb25zLnNldCh0eXBlLCBvcHRpb25zKTsgICAgLy8gVGhpcyBzaG91bGQgYWx3YXlzIGhhcHBlblxyXG4gICAgICAgICAgICAgICAgLy8gICAgIGVudGl0eVNlcnZpY2VQcm92aWRlci5zZXNzaW9uU3Vic2NyaWJlZEV2ZW50LnJhaXNlRXZlbnQoe3Nlc3Npb246IHNlc3Npb24sIGlkOiB0eXBlLCBvcHRpb25zOiBvcHRpb25zfSk7XHJcbiAgICAgICAgICAgICAgICAvLyB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBhcHBWaWV3TW9kZWwgPSBuZXcgQXBwVmlld01vZGVsOyJdfQ==