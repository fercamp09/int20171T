"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Argon = require("@argonjs/argon");
var vuforia = require("nativescript-vuforia");
var enums = require("ui/enums");
var argon_web_view_1 = require("argon-web-view");
var gestures_1 = require("ui/gestures");
var NativescriptLiveRealityViewer = (function (_super) {
    __extends(NativescriptLiveRealityViewer, _super);
    function NativescriptLiveRealityViewer(sessionService, viewService, _contextService, _deviceService, _vuforiaServiceProvider, uri) {
        var _this = _super.call(this, sessionService, viewService, _contextService, _deviceService, uri) || this;
        _this._contextService = _contextService;
        _this._deviceService = _deviceService;
        _this._vuforiaServiceProvider = _vuforiaServiceProvider;
        _this.videoView = vuforia.videoView;
        _this._zoomFactor = 1;
        _this._scratchTouchPos1 = new Argon.Cesium.Cartesian2;
        _this._scratchTouchPos2 = new Argon.Cesium.Cartesian2;
        return _this;
    }
    NativescriptLiveRealityViewer.prototype._handlePinchGestureEventData = function (data) {
        switch (data.state) {
            case gestures_1.GestureStateTypes.began:
                this._pinchStartZoomFactor = this._zoomFactor;
                this._zoomFactor = this._pinchStartZoomFactor * data.scale;
                break;
            case gestures_1.GestureStateTypes.changed:
                this._zoomFactor = this._pinchStartZoomFactor * data.scale;
                break;
            case gestures_1.GestureStateTypes.ended:
            case gestures_1.GestureStateTypes.cancelled:
            default:
                this._zoomFactor = this._pinchStartZoomFactor * data.scale;
                break;
        }
    };
    NativescriptLiveRealityViewer.prototype._handleForwardedDOMTouchEventData = function (uievent) {
        if (!uievent.touches)
            return;
        if (uievent.touches.length == 2) {
            this._scratchTouchPos1.x = uievent.touches[0].clientX;
            this._scratchTouchPos1.y = uievent.touches[0].clientY;
            this._scratchTouchPos2.x = uievent.touches[1].clientX;
            this._scratchTouchPos2.y = uievent.touches[1].clientY;
            var dist = Argon.Cesium.Cartesian2.distanceSquared(this._scratchTouchPos1, this._scratchTouchPos2);
            if (this._startPinchDistance === undefined) {
                this._startPinchDistance = dist;
                this._handlePinchGestureEventData({
                    state: gestures_1.GestureStateTypes.began,
                    scale: 1
                });
            }
            else {
                this._currentPinchDistance = dist;
                this._handlePinchGestureEventData({
                    state: gestures_1.GestureStateTypes.changed,
                    scale: this._currentPinchDistance / this._startPinchDistance
                });
            }
        }
        else {
            if (this._startPinchDistance !== undefined && this._currentPinchDistance !== undefined) {
                this._handlePinchGestureEventData({
                    state: gestures_1.GestureStateTypes.ended,
                    scale: this._currentPinchDistance / this._startPinchDistance
                });
                this._startPinchDistance = undefined;
                this._currentPinchDistance = undefined;
            }
        }
    };
    NativescriptLiveRealityViewer.prototype.setupInternalSession = function (session) {
        var _this = this;
        _super.prototype.setupInternalSession.call(this, session);
        console.log("Setting up Vuforia viewer session");
        vuforia.videoView.parent.on(gestures_1.GestureTypes.pinch, this._handlePinchGestureEventData, this);
        session.on['ar.view.uievent'] = function (uievent) {
            _this._handleForwardedDOMTouchEventData(uievent);
        };
        var subviews = [];
        var frameStateOptions = {
            overrideUser: true
        };
        this._deviceService.suggestedGeolocationSubscriptionChangeEvent.addEventListener(function () {
            if (_this._deviceService.suggestedGeolocationSubscription) {
                _this._deviceService.subscribeGeolocation(_this._deviceService.suggestedGeolocationSubscription, session);
            }
            else {
                _this._deviceService.unsubscribeGeolocation(session);
            }
        });
        var remove = this._deviceService.frameStateEvent.addEventListener(function (frameState) {
            if (!session.isConnected)
                return;
            Argon.SerializedSubviewList.clone(frameState.subviews, subviews);
            if (!_this._deviceService.strict) {
                _this._effectiveZoomFactor = Math.abs(_this._zoomFactor - 1) < 0.05 ? 1 : _this._zoomFactor;
                for (var _i = 0, subviews_1 = subviews; _i < subviews_1.length; _i++) {
                    var s = subviews_1[_i];
                    // const frustum = Argon.decomposePerspectiveProjectionMatrix(s.projectionMatrix, this._scratchFrustum);
                    // frustum.fov = 2 * Math.atan(Math.tan(frustum.fov * 0.5) / this._effectiveZoomFactor);
                    // Argon.Cesium.Matrix4.clone(frustum.projectionMatrix, s.projectionMatrix);
                    s.projectionMatrix[0] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[1] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[2] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[3] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[4] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[5] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[6] *= _this._effectiveZoomFactor;
                    s.projectionMatrix[7] *= _this._effectiveZoomFactor;
                }
            }
            else {
                _this._effectiveZoomFactor = 1;
            }
            // apply the projection scale
            vuforia.api && vuforia.api.setScaleFactor(_this._effectiveZoomFactor);
            // configure video
            var viewport = frameState.viewport;
            vuforia.api && _this._vuforiaServiceProvider
                .configureVuforiaVideoBackground(viewport, _this.isPresenting);
            if (!_this.isPresenting)
                return;
            try {
                var contextUser = _this._contextService.user;
                var deviceUser = _this._deviceService.user;
                contextUser.position.setValue(Argon.Cesium.Cartesian3.ZERO, deviceUser);
                contextUser.orientation.setValue(Argon.Cesium.Quaternion.IDENTITY);
                var contextFrameState = _this._deviceService.createContextFrameState(frameState.time, frameState.viewport, subviews, frameStateOptions);
                session.send('ar.reality.frameState', contextFrameState);
            }
            catch (e) {
                console.error(e);
            }
        });
        session.closeEvent.addEventListener(function () {
            remove();
        });
    };
    return NativescriptLiveRealityViewer;
}(Argon.LiveRealityViewer));
NativescriptLiveRealityViewer = __decorate([
    Argon.DI.autoinject,
    __metadata("design:paramtypes", [Argon.SessionService, Argon.ViewService, Argon.ContextService, Argon.DeviceService, Argon.VuforiaServiceProvider, String])
], NativescriptLiveRealityViewer);
exports.NativescriptLiveRealityViewer = NativescriptLiveRealityViewer;
Argon.DI.inject(Argon.SessionService, Argon.ViewService);
var NativescriptHostedRealityViewer = (function (_super) {
    __extends(NativescriptHostedRealityViewer, _super);
    function NativescriptHostedRealityViewer(sessionService, viewService, uri) {
        var _this = _super.call(this, sessionService, viewService, uri) || this;
        _this.uri = uri;
        _this.webView = new argon_web_view_1.ArgonWebView;
        if (_this.webView.ios) {
            // disable user navigation of the reality view
            _this.webView.ios.allowsBackForwardNavigationGestures = false;
        }
        _this.webView.on('session', function (data) {
            var session = data.session;
            session.connectEvent.addEventListener(function () {
                _this.connectEvent.raiseEvent(session);
            });
        });
        _this.presentChangeEvent.addEventListener(function () {
            _this.webView.visibility = _this.isPresenting ? enums.Visibility.visible : enums.Visibility.collapse;
        });
        return _this;
    }
    NativescriptHostedRealityViewer.prototype.load = function () {
        var url = this.uri;
        var webView = this.webView;
        if (webView.src === url)
            webView.reload();
        else
            webView.src = url;
    };
    NativescriptHostedRealityViewer.prototype.destroy = function () {
        this.webView.session && this.webView.session.close();
    };
    return NativescriptHostedRealityViewer;
}(Argon.HostedRealityViewer));
exports.NativescriptHostedRealityViewer = NativescriptHostedRealityViewer;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJnb24tcmVhbGl0eS12aWV3ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXJnb24tcmVhbGl0eS12aWV3ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0NBQXdDO0FBQ3hDLDhDQUFnRDtBQUNoRCxnQ0FBa0M7QUFFbEMsaURBQThEO0FBRzlELHdDQUlxQjtBQW9CckIsSUFBYSw2QkFBNkI7SUFBUyxpREFBdUI7SUFJdEUsdUNBQ0ksY0FBb0MsRUFDcEMsV0FBOEIsRUFDdEIsZUFBcUMsRUFDckMsY0FBbUMsRUFDbkMsdUJBQXFELEVBQzdELEdBQVU7UUFOZCxZQU9RLGtCQUFNLGNBQWMsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxHQUFHLENBQUMsU0FDL0U7UUFMVyxxQkFBZSxHQUFmLGVBQWUsQ0FBc0I7UUFDckMsb0JBQWMsR0FBZCxjQUFjLENBQXFCO1FBQ25DLDZCQUF1QixHQUF2Qix1QkFBdUIsQ0FBOEI7UUFQMUQsZUFBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFZN0IsaUJBQVcsR0FBRyxDQUFDLENBQUM7UUFzQmhCLHVCQUFpQixHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDaEQsdUJBQWlCLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQzs7SUF6QnhELENBQUM7SUFLTyxvRUFBNEIsR0FBcEMsVUFBcUMsSUFBMkI7UUFDNUQsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDakIsS0FBSyw0QkFBaUIsQ0FBQyxLQUFLO2dCQUN4QixJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztnQkFDOUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztnQkFDM0QsS0FBSyxDQUFDO1lBQ1YsS0FBSyw0QkFB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QUVILEtBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNyQyxLQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxLQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO1FBQ3ZHLENBQUMsQ0FBQyxDQUFDOztJQUNQLENBQUM7SUFFRCw4Q0FBSSxHQUFKO1FBQ0ksSUFBTSxHQUFHLEdBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUM1QixJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzdCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDO1lBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzFDLElBQUk7WUFBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztJQUMzQixDQUFDO0lBRUQsaURBQU8sR0FBUDtRQUNJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3pELENBQUM7SUFDTCxzQ0FBQztBQUFELENBQUMsQUFsQ0QsQ0FBcUQsS0FBSyxDQUFDLG1CQUFtQixHQWtDN0U7QUFsQ1ksMEVBQStCO0FBa0MzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQXJnb24gZnJvbSAnQGFyZ29uanMvYXJnb24nO1xyXG5pbXBvcnQgKiBhcyB2dWZvcmlhIGZyb20gJ25hdGl2ZXNjcmlwdC12dWZvcmlhJztcclxuaW1wb3J0ICogYXMgZW51bXMgZnJvbSAndWkvZW51bXMnO1xyXG5cclxuaW1wb3J0IHtBcmdvbldlYlZpZXcsIFNlc3Npb25FdmVudERhdGF9IGZyb20gJ2FyZ29uLXdlYi12aWV3JztcclxuaW1wb3J0IHtOYXRpdmVzY3JpcHRWdWZvcmlhU2VydmljZVByb3ZpZGVyfSBmcm9tICcuL2FyZ29uLXZ1Zm9yaWEtcHJvdmlkZXInO1xyXG5cclxuaW1wb3J0IHtcclxuICBHZXN0dXJlVHlwZXMsXHJcbiAgR2VzdHVyZVN0YXRlVHlwZXMsXHJcbiAgUGluY2hHZXN0dXJlRXZlbnREYXRhXHJcbn0gZnJvbSAndWkvZ2VzdHVyZXMnO1xyXG5cclxuXHJcbmludGVyZmFjZSBET01Ub3VjaCB7XHJcbiAgICByZWFkb25seSBjbGllbnRYOiBudW1iZXI7XHJcbiAgICByZWFkb25seSBjbGllbnRZOiBudW1iZXI7XHJcbiAgICByZWFkb25seSBpZGVudGlmaWVyOiBudW1iZXI7XHJcbiAgICByZWFkb25seSBwYWdlWDogbnVtYmVyO1xyXG4gICAgcmVhZG9ubHkgcGFnZVk6IG51bWJlcjtcclxuICAgIHJlYWRvbmx5IHNjcmVlblg6IG51bWJlcjtcclxuICAgIHJlYWRvbmx5IHNjcmVlblk6IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIERPTVRvdWNoRXZlbnQge1xyXG4gICAgdHlwZTpzdHJpbmcsXHJcbiAgICB0b3VjaGVzOkFycmF5PERPTVRvdWNoPiwgXHJcbiAgICBjaGFuZ2VkVG91Y2hlczpBcnJheTxET01Ub3VjaD5cclxufVxyXG5cclxuQEFyZ29uLkRJLmF1dG9pbmplY3RcclxuZXhwb3J0IGNsYXNzIE5hdGl2ZXNjcmlwdExpdmVSZWFsaXR5Vmlld2VyIGV4dGVuZHMgQXJnb24uTGl2ZVJlYWxpdHlWaWV3ZXIge1xyXG5cclxuICAgIHB1YmxpYyB2aWRlb1ZpZXcgPSB2dWZvcmlhLnZpZGVvVmlldztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihcclxuICAgICAgICBzZXNzaW9uU2VydmljZTogQXJnb24uU2Vzc2lvblNlcnZpY2UsXHJcbiAgICAgICAgdmlld1NlcnZpY2U6IEFyZ29uLlZpZXdTZXJ2aWNlLFxyXG4gICAgICAgIHByaXZhdGUgX2NvbnRleHRTZXJ2aWNlOiBBcmdvbi5Db250ZXh0U2VydmljZSxcclxuICAgICAgICBwcml2YXRlIF9kZXZpY2VTZXJ2aWNlOiBBcmdvbi5EZXZpY2VTZXJ2aWNlLFxyXG4gICAgICAgIHByaXZhdGUgX3Z1Zm9yaWFTZXJ2aWNlUHJvdmlkZXI6IEFyZ29uLlZ1Zm9yaWFTZXJ2aWNlUHJvdmlkZXIsXHJcbiAgICAgICAgdXJpOnN0cmluZykge1xyXG4gICAgICAgICAgICBzdXBlcihzZXNzaW9uU2VydmljZSwgdmlld1NlcnZpY2UsIF9jb250ZXh0U2VydmljZSwgX2RldmljZVNlcnZpY2UsIHVyaSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfem9vbUZhY3RvciA9IDE7XHJcbiAgICBwcml2YXRlIF9waW5jaFN0YXJ0Wm9vbUZhY3RvcjpudW1iZXI7XHJcbiAgICBcclxuICAgIHByaXZhdGUgX2hhbmRsZVBpbmNoR2VzdHVyZUV2ZW50RGF0YShkYXRhOiBQaW5jaEdlc3R1cmVFdmVudERhdGEpIHtcclxuICAgICAgICBzd2l0Y2ggKGRhdGEuc3RhdGUpIHtcclxuICAgICAgICAgICAgY2FzZSBHZXN0dXJlU3RhdGVUeXBlcy5iZWdhbjogXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9waW5jaFN0YXJ0Wm9vbUZhY3RvciA9IHRoaXMuX3pvb21GYWN0b3I7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl96b29tRmFjdG9yID0gdGhpcy5fcGluY2hTdGFydFpvb21GYWN0b3IgKiBkYXRhLnNjYWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgR2VzdHVyZVN0YXRlVHlwZXMuY2hhbmdlZDogXHJcbiAgICAgICAgICAgICAgICB0aGlzLl96b29tRmFjdG9yID0gdGhpcy5fcGluY2hTdGFydFpvb21GYWN0b3IgKiBkYXRhLnNjYWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgR2VzdHVyZVN0YXRlVHlwZXMuZW5kZWQ6XHJcbiAgICAgICAgICAgIGNhc2UgR2VzdHVyZVN0YXRlVHlwZXMuY2FuY2VsbGVkOlxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhpcy5fem9vbUZhY3RvciA9IHRoaXMuX3BpbmNoU3RhcnRab29tRmFjdG9yICogZGF0YS5zY2FsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrOyAgXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3N0YXJ0UGluY2hEaXN0YW5jZT86bnVtYmVyO1xyXG4gICAgcHJpdmF0ZSBfY3VycmVudFBpbmNoRGlzdGFuY2U/Om51bWJlcjtcclxuICAgIHByaXZhdGUgX3NjcmF0Y2hUb3VjaFBvczEgPSBuZXcgQXJnb24uQ2VzaXVtLkNhcnRlc2lhbjI7XHJcbiAgICBwcml2YXRlIF9zY3JhdGNoVG91Y2hQb3MyID0gbmV3IEFyZ29uLkNlc2l1bS5DYXJ0ZXNpYW4yO1xyXG5cclxuICAgIHByaXZhdGUgX2hhbmRsZUZvcndhcmRlZERPTVRvdWNoRXZlbnREYXRhKHVpZXZlbnQ6IERPTVRvdWNoRXZlbnQpIHtcclxuICAgICAgICBpZiAoIXVpZXZlbnQudG91Y2hlcykgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAodWlldmVudC50b3VjaGVzLmxlbmd0aCA9PSAyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NjcmF0Y2hUb3VjaFBvczEueCA9IHVpZXZlbnQudG91Y2hlc1swXS5jbGllbnRYO1xyXG4gICAgICAgICAgICB0aGlzLl9zY3JhdGNoVG91Y2hQb3MxLnkgPSB1aWV2ZW50LnRvdWNoZXNbMF0uY2xpZW50WTtcclxuICAgICAgICAgICAgdGhpcy5fc2NyYXRjaFRvdWNoUG9zMi54ID0gdWlldmVudC50b3VjaGVzWzFdLmNsaWVudFg7XHJcbiAgICAgICAgICAgIHRoaXMuX3NjcmF0Y2hUb3VjaFBvczIueSA9IHVpZXZlbnQudG91Y2hlc1sxXS5jbGllbnRZO1xyXG4gICAgICAgICAgICBjb25zdCBkaXN0ID0gQXJnb24uQ2VzaXVtLkNhcnRlc2lhbjIuZGlzdGFuY2VTcXVhcmVkKHRoaXMuX3NjcmF0Y2hUb3VjaFBvczEsIHRoaXMuX3NjcmF0Y2hUb3VjaFBvczIpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXJ0UGluY2hEaXN0YW5jZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGFydFBpbmNoRGlzdGFuY2UgPSBkaXN0O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5faGFuZGxlUGluY2hHZXN0dXJlRXZlbnREYXRhKDxQaW5jaEdlc3R1cmVFdmVudERhdGE+e1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiBHZXN0dXJlU3RhdGVUeXBlcy5iZWdhbixcclxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogMVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50UGluY2hEaXN0YW5jZSA9IGRpc3Q7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVQaW5jaEdlc3R1cmVFdmVudERhdGEoPFBpbmNoR2VzdHVyZUV2ZW50RGF0YT57XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGU6IEdlc3R1cmVTdGF0ZVR5cGVzLmNoYW5nZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IHRoaXMuX2N1cnJlbnRQaW5jaERpc3RhbmNlIC8gdGhpcy5fc3RhcnRQaW5jaERpc3RhbmNlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGFydFBpbmNoRGlzdGFuY2UgIT09IHVuZGVmaW5lZCAmJiB0aGlzLl9jdXJyZW50UGluY2hEaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGVQaW5jaEdlc3R1cmVFdmVudERhdGEoPFBpbmNoR2VzdHVyZUV2ZW50RGF0YT57XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGU6IEdlc3R1cmVTdGF0ZVR5cGVzLmVuZGVkLFxyXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiB0aGlzLl9jdXJyZW50UGluY2hEaXN0YW5jZSAvIHRoaXMuX3N0YXJ0UGluY2hEaXN0YW5jZVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGFydFBpbmNoRGlzdGFuY2UgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50UGluY2hEaXN0YW5jZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBwcml2YXRlIF9zY3JhdGNoRnJ1c3R1bSA9IG5ldyBBcmdvbi5DZXNpdW0uUGVyc3BlY3RpdmVGcnVzdHVtO1xyXG4gICAgcHJpdmF0ZSBfZWZmZWN0aXZlWm9vbUZhY3RvcjpudW1iZXI7XHJcbiAgICBzZXR1cEludGVybmFsU2Vzc2lvbihzZXNzaW9uOkFyZ29uLlNlc3Npb25Qb3J0KSB7XHJcbiAgICAgICAgc3VwZXIuc2V0dXBJbnRlcm5hbFNlc3Npb24oc2Vzc2lvbik7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU2V0dGluZyB1cCBWdWZvcmlhIHZpZXdlciBzZXNzaW9uXCIpO1xyXG5cclxuICAgICAgICB2dWZvcmlhLnZpZGVvVmlldy5wYXJlbnQub24oR2VzdHVyZVR5cGVzLnBpbmNoLCB0aGlzLl9oYW5kbGVQaW5jaEdlc3R1cmVFdmVudERhdGEsIHRoaXMpO1xyXG5cclxuICAgICAgICBzZXNzaW9uLm9uWydhci52aWV3LnVpZXZlbnQnXSA9ICh1aWV2ZW50OkRPTVRvdWNoRXZlbnQpID0+IHsgXHJcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZUZvcndhcmRlZERPTVRvdWNoRXZlbnREYXRhKHVpZXZlbnQpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IHN1YnZpZXdzOkFyZ29uLlNlcmlhbGl6ZWRTdWJ2aWV3TGlzdCA9IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBmcmFtZVN0YXRlT3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgb3ZlcnJpZGVVc2VyOiB0cnVlXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9kZXZpY2VTZXJ2aWNlLnN1Z2dlc3RlZEdlb2xvY2F0aW9uU3Vic2NyaXB0aW9uQ2hhbmdlRXZlbnQuYWRkRXZlbnRMaXN0ZW5lcigoKT0+e1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZGV2aWNlU2VydmljZS5zdWdnZXN0ZWRHZW9sb2NhdGlvblN1YnNjcmlwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlU2VydmljZS5zdWJzY3JpYmVHZW9sb2NhdGlvbih0aGlzLl9kZXZpY2VTZXJ2aWNlLnN1Z2dlc3RlZEdlb2xvY2F0aW9uU3Vic2NyaXB0aW9uLCBzZXNzaW9uKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2RldmljZVNlcnZpY2UudW5zdWJzY3JpYmVHZW9sb2NhdGlvbihzZXNzaW9uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCByZW1vdmUgPSB0aGlzLl9kZXZpY2VTZXJ2aWNlLmZyYW1lU3RhdGVFdmVudC5hZGRFdmVudExpc3RlbmVyKChmcmFtZVN0YXRlKT0+e1xyXG4gICAgICAgICAgICBpZiAoIXNlc3Npb24uaXNDb25uZWN0ZWQpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIEFyZ29uLlNlcmlhbGl6ZWRTdWJ2aWV3TGlzdC5jbG9uZShmcmFtZVN0YXRlLnN1YnZpZXdzLCBzdWJ2aWV3cyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2RldmljZVNlcnZpY2Uuc3RyaWN0KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yID0gTWF0aC5hYnModGhpcy5fem9vbUZhY3RvciAtIDEpIDwgMC4wNSA/IDEgOiB0aGlzLl96b29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIHN1YnZpZXdzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc3QgZnJ1c3R1bSA9IEFyZ29uLmRlY29tcG9zZVBlcnNwZWN0aXZlUHJvamVjdGlvbk1hdHJpeChzLnByb2plY3Rpb25NYXRyaXgsIHRoaXMuX3NjcmF0Y2hGcnVzdHVtKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBmcnVzdHVtLmZvdiA9IDIgKiBNYXRoLmF0YW4oTWF0aC50YW4oZnJ1c3R1bS5mb3YgKiAwLjUpIC8gdGhpcy5fZWZmZWN0aXZlWm9vbUZhY3Rvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQXJnb24uQ2VzaXVtLk1hdHJpeDQuY2xvbmUoZnJ1c3R1bS5wcm9qZWN0aW9uTWF0cml4LCBzLnByb2plY3Rpb25NYXRyaXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFswXSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFsxXSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFsyXSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFszXSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFs0XSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFs1XSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFs2XSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHMucHJvamVjdGlvbk1hdHJpeFs3XSAqPSB0aGlzLl9lZmZlY3RpdmVab29tRmFjdG9yO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZWZmZWN0aXZlWm9vbUZhY3RvciA9IDE7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGFwcGx5IHRoZSBwcm9qZWN0aW9uIHNjYWxlXHJcbiAgICAgICAgICAgIHZ1Zm9yaWEuYXBpICYmIHZ1Zm9yaWEuYXBpLnNldFNjYWxlRmFjdG9yKHRoaXMuX2VmZmVjdGl2ZVpvb21GYWN0b3IpO1xyXG5cclxuICAgICAgICAgICAgLy8gY29uZmlndXJlIHZpZGVvXHJcbiAgICAgICAgICAgIGNvbnN0IHZpZXdwb3J0ID0gZnJhbWVTdGF0ZS52aWV3cG9ydDtcclxuICAgICAgICAgICAgdnVmb3JpYS5hcGkgJiYgKHRoaXMuX3Z1Zm9yaWFTZXJ2aWNlUHJvdmlkZXIgYXMgTmF0aXZlc2NyaXB0VnVmb3JpYVNlcnZpY2VQcm92aWRlcilcclxuICAgICAgICAgICAgICAgIC5jb25maWd1cmVWdWZvcmlhVmlkZW9CYWNrZ3JvdW5kKHZpZXdwb3J0LCB0aGlzLmlzUHJlc2VudGluZyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNQcmVzZW50aW5nKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGV4dFVzZXIgPSB0aGlzLl9jb250ZXh0U2VydmljZS51c2VyO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGV2aWNlVXNlciA9IHRoaXMuX2RldmljZVNlcnZpY2UudXNlcjtcclxuICAgICAgICAgICAgICAgIChjb250ZXh0VXNlci5wb3NpdGlvbiBhcyBBcmdvbi5DZXNpdW0uQ29uc3RhbnRQb3NpdGlvblByb3BlcnR5KS5zZXRWYWx1ZShBcmdvbi5DZXNpdW0uQ2FydGVzaWFuMy5aRVJPLCBkZXZpY2VVc2VyKTtcclxuICAgICAgICAgICAgICAgIChjb250ZXh0VXNlci5vcmllbnRhdGlvbiBhcyBBcmdvbi5DZXNpdW0uQ29uc3RhbnRQcm9wZXJ0eSkuc2V0VmFsdWUoQXJnb24uQ2VzaXVtLlF1YXRlcm5pb24uSURFTlRJVFkpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHRGcmFtZVN0YXRlID0gdGhpcy5fZGV2aWNlU2VydmljZS5jcmVhdGVDb250ZXh0RnJhbWVTdGF0ZShcclxuICAgICAgICAgICAgICAgICAgICBmcmFtZVN0YXRlLnRpbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVTdGF0ZS52aWV3cG9ydCxcclxuICAgICAgICAgICAgICAgICAgICBzdWJ2aWV3cyxcclxuICAgICAgICAgICAgICAgICAgICBmcmFtZVN0YXRlT3B0aW9uc1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24uc2VuZCgnYXIucmVhbGl0eS5mcmFtZVN0YXRlJywgY29udGV4dEZyYW1lU3RhdGUpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2Vzc2lvbi5jbG9zZUV2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKCk9PntcclxuICAgICAgICAgICAgcmVtb3ZlKCk7XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxufVxyXG5cclxuQXJnb24uREkuaW5qZWN0KEFyZ29uLlNlc3Npb25TZXJ2aWNlLCBBcmdvbi5WaWV3U2VydmljZSwgKVxyXG5leHBvcnQgY2xhc3MgTmF0aXZlc2NyaXB0SG9zdGVkUmVhbGl0eVZpZXdlciBleHRlbmRzIEFyZ29uLkhvc3RlZFJlYWxpdHlWaWV3ZXIge1xyXG5cclxuICAgIHB1YmxpYyB3ZWJWaWV3ID0gbmV3IEFyZ29uV2ViVmlldztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihzZXNzaW9uU2VydmljZSwgdmlld1NlcnZpY2UsIHB1YmxpYyB1cmk6c3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoc2Vzc2lvblNlcnZpY2UsIHZpZXdTZXJ2aWNlLCB1cmkpO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMud2ViVmlldy5pb3MpIHtcclxuICAgICAgICAgICAgLy8gZGlzYWJsZSB1c2VyIG5hdmlnYXRpb24gb2YgdGhlIHJlYWxpdHkgdmlld1xyXG4gICAgICAgICAgICAodGhpcy53ZWJWaWV3LmlvcyBhcyBXS1dlYlZpZXcpLmFsbG93c0JhY2tGb3J3YXJkTmF2aWdhdGlvbkdlc3R1cmVzID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLndlYlZpZXcub24oJ3Nlc3Npb24nLCAoZGF0YTpTZXNzaW9uRXZlbnREYXRhKT0+e1xyXG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uID0gZGF0YS5zZXNzaW9uO1xyXG4gICAgICAgICAgICBzZXNzaW9uLmNvbm5lY3RFdmVudC5hZGRFdmVudExpc3RlbmVyKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdEV2ZW50LnJhaXNlRXZlbnQoc2Vzc2lvbik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnByZXNlbnRDaGFuZ2VFdmVudC5hZGRFdmVudExpc3RlbmVyKCgpPT57XHJcbiAgICAgICAgICAgIHRoaXMud2ViVmlldy52aXNpYmlsaXR5ID0gdGhpcy5pc1ByZXNlbnRpbmcgPyBlbnVtcy5WaXNpYmlsaXR5LnZpc2libGUgOiBlbnVtcy5WaXNpYmlsaXR5LmNvbGxhcHNlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBsb2FkKCk6dm9pZCB7XHJcbiAgICAgICAgY29uc3QgdXJsOnN0cmluZyA9IHRoaXMudXJpO1xyXG4gICAgICAgIGNvbnN0IHdlYlZpZXcgPSB0aGlzLndlYlZpZXc7XHJcbiAgICAgICAgaWYgKHdlYlZpZXcuc3JjID09PSB1cmwpIHdlYlZpZXcucmVsb2FkKCk7XHJcbiAgICAgICAgZWxzZSB3ZWJWaWV3LnNyYyA9IHVybDtcclxuICAgIH1cclxuXHJcbiAgICBkZXN0cm95KCkge1xyXG4gICAgICAgIHRoaXMud2ViVmlldy5zZXNzaW9uICYmIHRoaXMud2ViVmlldy5zZXNzaW9uLmNsb3NlKCk7XHJcbiAgICB9XHJcbn07Il19