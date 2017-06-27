"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var platform = require("platform");
var color_1 = require("color");
var application = require("application");
var utils = require("utils/utils");
var config_1 = require("../../config");
try {
    var ArgonPrivate = require('argon-private');
}
catch (e) { }
application.on(application.orientationChangedEvent, function () {
    updateScreenOrientation();
    setTimeout(updateScreenOrientation, 100);
});
var iosSharedApplication;
function getNativeScreenOrientation() {
    if (application.ios) {
        iosSharedApplication = iosSharedApplication || utils.ios.getter(UIApplication, UIApplication.sharedApplication);
        var orientation = iosSharedApplication.statusBarOrientation;
        switch (orientation) {
            case 0 /* Unknown */:
            case 1 /* Portrait */: return 0;
            case 2 /* PortraitUpsideDown */: return 180;
            case 4 /* LandscapeLeft */: return 90;
            case 3 /* LandscapeRight */: return -90;
        }
    }
    if (application.android) {
        var context = utils.ad.getApplicationContext();
        var display = context.getSystemService(android.content.Context.WINDOW_SERVICE).getDefaultDisplay();
        var rotation = display.getRotation();
        switch (rotation) {
            case android.view.Surface.ROTATION_0: return 0;
            case android.view.Surface.ROTATION_180: return 180;
            case android.view.Surface.ROTATION_90: return -90;
            case android.view.Surface.ROTATION_270: return 90;
        }
    }
    return 0;
}
exports.screenOrientation = 0;
function updateScreenOrientation() {
    exports.screenOrientation = getNativeScreenOrientation();
}
exports.canDecrypt = !!ArgonPrivate;
function decrypt(encryptedData) {
    if (!ArgonPrivate)
        return Promise.reject(new Error("This build of Argon is incapable of decrypting messages."));
    return Promise.resolve().then(function () {
        return ArgonPrivate.decrypt(encryptedData);
    });
}
exports.decrypt = decrypt;
function getInternalVuforiaKey() {
    return ArgonPrivate && ArgonPrivate.getVuforiaLicenseKey() || config_1.default.DEBUG_VUFORIA_LICENSE_KEY;
}
exports.getInternalVuforiaKey = getInternalVuforiaKey;
function bringToFront(view) {
    if (view.android) {
        view.android.bringToFront();
    }
    else if (view.ios) {
        view.ios.superview.bringSubviewToFront(view.ios);
    }
}
exports.bringToFront = bringToFront;
function linearGradient(view, colors) {
    var _colors = [];
    var nativeView = view['_nativeView'];
    if (!nativeView) {
        return;
    }
    colors.forEach(function (c, idx) {
        if (!(c instanceof color_1.Color)) {
            colors[idx] = new color_1.Color(c);
        }
    });
    if (platform.device.os === platform.platformNames.android) {
        var backgroundDrawable = nativeView.getBackground(), LINEAR_GRADIENT = 0;
        colors.forEach(function (c) {
            _colors.push(c.android);
        });
        if (!(backgroundDrawable instanceof android.graphics.drawable.GradientDrawable)) {
            backgroundDrawable = new android.graphics.drawable.GradientDrawable();
            backgroundDrawable.setColors(_colors);
            backgroundDrawable.setGradientType(LINEAR_GRADIENT);
            nativeView.setBackgroundDrawable(backgroundDrawable);
        }
    }
    else if (platform.device.os === platform.platformNames.ios) {
        var iosView = view.ios;
        var colorsArray = NSMutableArray.alloc().initWithCapacity(2);
        colors.forEach(function (c) {
            colorsArray.addObject(interop.types.id(c.ios.CGColor));
        });
        var gradientLayer = CAGradientLayer.layer();
        gradientLayer.colors = colorsArray;
        gradientLayer.frame = iosView.bounds;
        iosView.layer.insertSublayerAtIndex(gradientLayer, 0);
    }
}
exports.linearGradient = linearGradient;
function ipToString(inAddr) {
    if (!inAddr) {
        throw new Error('in == NULL');
    }
    if (inAddr.s_addr === 0x00000000) {
        return '*';
    }
    else {
        return NSString.stringWithCStringEncoding(inet_ntoa(inAddr), 1).toString();
    }
}
function getIPAddressOfInterface($interface) {
    var address = '-';
    if (!$interface) {
        return address;
    }
    var interfacesPtrPtr = new interop.Reference();
    if (getifaddrs(interfacesPtrPtr) === 0) {
        var interfacesPtr = interfacesPtrPtr[0];
        var temp_addrPtr = interfacesPtr;
        while (temp_addrPtr != null) {
            if (temp_addrPtr[0].ifa_addr[0].sa_family === 2) {
                var name = NSString.stringWithUTF8String(temp_addrPtr[0].ifa_name).toString().trim();
                if (name == $interface) {
                    var ifa_addrPtr = temp_addrPtr[0].ifa_addr;
                    var ifa_addrPtrAsSockAddtr_in = new interop.Reference(sockaddr_in, ifa_addrPtr);
                    address = ipToString(ifa_addrPtrAsSockAddtr_in[0].sin_addr);
                }
            }
            temp_addrPtr = temp_addrPtr[0].ifa_next;
        }
        freeifaddrs(interfacesPtr);
    }
    return address;
}
exports.getIPAddressOfInterface = getIPAddressOfInterface;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxtQ0FBcUM7QUFDckMsK0JBQTRCO0FBQzVCLHlDQUEyQztBQUMzQyxtQ0FBcUM7QUFDckMsdUNBQWlDO0FBRWpDLElBQUksQ0FBQztJQUNILElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUM7QUFFZCxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyx1QkFBdUIsRUFBRTtJQUNsRCx1QkFBdUIsRUFBRSxDQUFDO0lBQzFCLFVBQVUsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQztBQUVILElBQUksb0JBQWtDLENBQUM7QUFFdkM7SUFDSSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNsQixvQkFBb0IsR0FBRyxvQkFBb0IsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDaEgsSUFBTSxXQUFXLEdBQUcsb0JBQW9CLENBQUMsb0JBQW9CLENBQUM7UUFDOUQsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNsQixxQkFBb0M7WUFDcEMsdUJBQXNDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDL0MsaUNBQWdELE1BQU0sQ0FBQyxHQUFHLENBQUM7WUFDM0QsNEJBQTJDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDckQsNkJBQTRDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUMzRCxDQUFDO0lBQ0wsQ0FBQztJQUNELEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3RC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QUM7UUFFakMsT0FBTyxZQUFZLElBQUksSUFBSSxFQUFFLENBQUM7WUFDMUIsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDOUMsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDckYsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQ3JCLElBQUksV0FBVyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7b0JBQzNDLElBQUkseUJBQXlCLEdBQUcsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDaEYsT0FBTyxHQUFHLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDaEUsQ0FBQztZQUNMLENBQUM7WUFDRCxZQUFZLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUM1QyxDQUFDO1FBRUQsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDRCxNQUFNLENBQUMsT0FBTyxDQUFDO0FBQ25CLENBQUM7QUEzQkQsMERBMkJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtWaWV3fSBmcm9tIFwidWkvY29yZS92aWV3XCI7XHJcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gXCJwbGF0Zm9ybVwiO1xyXG5pbXBvcnQge0NvbG9yfSBmcm9tIFwiY29sb3JcIjtcclxuaW1wb3J0ICogYXMgYXBwbGljYXRpb24gZnJvbSBcImFwcGxpY2F0aW9uXCI7XHJcbmltcG9ydCAqIGFzIHV0aWxzIGZyb20gJ3V0aWxzL3V0aWxzJztcclxuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi9jb25maWcnXHJcblxyXG50cnkge1xyXG4gIHZhciBBcmdvblByaXZhdGUgPSByZXF1aXJlKCdhcmdvbi1wcml2YXRlJyk7XHJcbn0gY2F0Y2ggKGUpIHt9XHJcblxyXG5hcHBsaWNhdGlvbi5vbihhcHBsaWNhdGlvbi5vcmllbnRhdGlvbkNoYW5nZWRFdmVudCwgKCk9PntcclxuICB1cGRhdGVTY3JlZW5PcmllbnRhdGlvbigpO1xyXG4gIHNldFRpbWVvdXQodXBkYXRlU2NyZWVuT3JpZW50YXRpb24sIDEwMCk7XHJcbn0pO1xyXG5cclxubGV0IGlvc1NoYXJlZEFwcGxpY2F0aW9uOlVJQXBwbGljYXRpb247XHJcblxyXG5mdW5jdGlvbiBnZXROYXRpdmVTY3JlZW5PcmllbnRhdGlvbigpIHtcclxuICAgIGlmIChhcHBsaWNhdGlvbi5pb3MpIHtcclxuICAgICAgICBpb3NTaGFyZWRBcHBsaWNhdGlvbiA9IGlvc1NoYXJlZEFwcGxpY2F0aW9uIHx8IHV0aWxzLmlvcy5nZXR0ZXIoVUlBcHBsaWNhdGlvbiwgVUlBcHBsaWNhdGlvbi5zaGFyZWRBcHBsaWNhdGlvbik7XHJcbiAgICAgICAgY29uc3Qgb3JpZW50YXRpb24gPSBpb3NTaGFyZWRBcHBsaWNhdGlvbi5zdGF0dXNCYXJPcmllbnRhdGlvbjtcclxuICAgICAgICBzd2l0Y2ggKG9yaWVudGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgVUlJbnRlcmZhY2VPcmllbnRhdGlvbi5Vbmtub3duOlxyXG4gICAgICAgICAgICBjYXNlIFVJSW50ZXJmYWNlT3JpZW50YXRpb24uUG9ydHJhaXQ6IHJldHVybiAwO1xyXG4gICAgICAgICAgICBjYXNlIFVJSW50ZXJmYWNlT3JpZW50YXRpb24uUG9ydHJhaXRVcHNpZGVEb3duOiByZXR1cm4gMTgwO1xyXG4gICAgICAgICAgICBjYXNlIFVJSW50ZXJmYWNlT3JpZW50YXRpb24uTGFuZHNjYXBlTGVmdDogcmV0dXJuIDkwO1xyXG4gICAgICAgICAgICBjYXNlIFVJSW50ZXJmYWNlT3JpZW50YXRpb24uTGFuZHNjYXBlUmlnaHQ6IHJldHVybiAtOTA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKGFwcGxpY2F0aW9uLmFuZHJvaWQpIHtcclxuICAgICAgICBjb25zdCBjb250ZXh0OmFuZHJvaWQuY29udGVudC5Db250ZXh0ID0gdXRpbHMuYWQuZ2V0QXBwbGljYXRpb25Db250ZXh0KCk7XHJcbiAgICAgICAgY29uc3QgZGlzcGxheTphbmRyb2lkLnZpZXcuRGlzcGxheSA9IGNvbnRleHQuZ2V0U3lzdGVtU2VydmljZShhbmRyb2lkLmNvbnRlbnQuQ29udGV4dC5XSU5ET1dfU0VSVklDRSkuZ2V0RGVmYXVsdERpc3BsYXkoKTtcclxuICAgICAgICBjb25zdCByb3RhdGlvbiA9IGRpc3BsYXkuZ2V0Um90YXRpb24oKTtcclxuICAgICAgICBzd2l0Y2ggKHJvdGF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgYW5kcm9pZC52aWV3LlN1cmZhY2UuUk9UQVRJT05fMDogcmV0dXJuIDA7XHJcbiAgICAgICAgICAgIGNhc2UgYW5kcm9pZC52aWV3LlN1cmZhY2UuUk9UQVRJT05fMTgwOiByZXR1cm4gMTgwO1xyXG4gICAgICAgICAgICBjYXNlIGFuZHJvaWQudmlldy5TdXJmYWNlLlJPVEFUSU9OXzkwOiByZXR1cm4gLTkwO1xyXG4gICAgICAgICAgICBjYXNlIGFuZHJvaWQudmlldy5TdXJmYWNlLlJPVEFUSU9OXzI3MDogcmV0dXJuIDkwO1xyXG4gICAgICAgIH1cclxuICAgIH0gXHJcbiAgICByZXR1cm4gMDtcclxufVxyXG5cclxuZXhwb3J0IGxldCBzY3JlZW5PcmllbnRhdGlvbjpudW1iZXIgPSAwO1xyXG5cclxuZnVuY3Rpb24gdXBkYXRlU2NyZWVuT3JpZW50YXRpb24oKSB7XHJcbiAgc2NyZWVuT3JpZW50YXRpb24gPSBnZXROYXRpdmVTY3JlZW5PcmllbnRhdGlvbigpO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgY2FuRGVjcnlwdCA9ICEhQXJnb25Qcml2YXRlO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRlY3J5cHQoZW5jcnlwdGVkRGF0YTpzdHJpbmcpIDogUHJvbWlzZTxzdHJpbmc+IHtcclxuICBpZiAoIUFyZ29uUHJpdmF0ZSkgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIlRoaXMgYnVpbGQgb2YgQXJnb24gaXMgaW5jYXBhYmxlIG9mIGRlY3J5cHRpbmcgbWVzc2FnZXMuXCIpKVxyXG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpPT57XHJcbiAgICByZXR1cm4gQXJnb25Qcml2YXRlLmRlY3J5cHQoZW5jcnlwdGVkRGF0YSlcclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEludGVybmFsVnVmb3JpYUtleSgpIDogc3RyaW5nfHVuZGVmaW5lZCB7XHJcbiAgcmV0dXJuIEFyZ29uUHJpdmF0ZSAmJiBBcmdvblByaXZhdGUuZ2V0VnVmb3JpYUxpY2Vuc2VLZXkoKSB8fCBjb25maWcuREVCVUdfVlVGT1JJQV9MSUNFTlNFX0tFWTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGJyaW5nVG9Gcm9udCh2aWV3OiBWaWV3KSB7XHJcbiAgaWYgKHZpZXcuYW5kcm9pZCkge1xyXG4gICAgdmlldy5hbmRyb2lkLmJyaW5nVG9Gcm9udCgpO1xyXG4gIH0gZWxzZSBpZiAodmlldy5pb3MpIHtcclxuICAgIHZpZXcuaW9zLnN1cGVydmlldy5icmluZ1N1YnZpZXdUb0Zyb250KHZpZXcuaW9zKTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsaW5lYXJHcmFkaWVudCh2aWV3OlZpZXcsIGNvbG9yczooQ29sb3J8c3RyaW5nKVtdKSB7XHJcbiAgdmFyIF9jb2xvcnM6YW55W10gPSBbXTtcclxuICB2YXIgbmF0aXZlVmlldyA9IHZpZXdbJ19uYXRpdmVWaWV3J107XHJcblxyXG4gIGlmICghbmF0aXZlVmlldykge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgY29sb3JzLmZvckVhY2goZnVuY3Rpb24gKGMsIGlkeCkge1xyXG4gICAgaWYgKCEoYyBpbnN0YW5jZW9mIENvbG9yKSkge1xyXG4gICAgICBjb2xvcnNbaWR4XSA9IG5ldyBDb2xvcihjKTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgaWYgKHBsYXRmb3JtLmRldmljZS5vcyA9PT0gcGxhdGZvcm0ucGxhdGZvcm1OYW1lcy5hbmRyb2lkKSB7XHJcbiAgICB2YXIgYmFja2dyb3VuZERyYXdhYmxlID0gbmF0aXZlVmlldy5nZXRCYWNrZ3JvdW5kKCksXHJcbiAgICAgIExJTkVBUl9HUkFESUVOVCA9IDA7XHJcblxyXG4gICAgY29sb3JzLmZvckVhY2goZnVuY3Rpb24gKGM6Q29sb3IpIHtcclxuICAgICAgX2NvbG9ycy5wdXNoKGMuYW5kcm9pZCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIShiYWNrZ3JvdW5kRHJhd2FibGUgaW5zdGFuY2VvZiBhbmRyb2lkLmdyYXBoaWNzLmRyYXdhYmxlLkdyYWRpZW50RHJhd2FibGUpKSB7XHJcbiAgICAgIGJhY2tncm91bmREcmF3YWJsZSA9IG5ldyBhbmRyb2lkLmdyYXBoaWNzLmRyYXdhYmxlLkdyYWRpZW50RHJhd2FibGUoKTtcclxuICAgICAgYmFja2dyb3VuZERyYXdhYmxlLnNldENvbG9ycyhfY29sb3JzKTtcclxuICAgICAgYmFja2dyb3VuZERyYXdhYmxlLnNldEdyYWRpZW50VHlwZShMSU5FQVJfR1JBRElFTlQpO1xyXG4gICAgICBuYXRpdmVWaWV3LnNldEJhY2tncm91bmREcmF3YWJsZShiYWNrZ3JvdW5kRHJhd2FibGUpO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAocGxhdGZvcm0uZGV2aWNlLm9zID09PSBwbGF0Zm9ybS5wbGF0Zm9ybU5hbWVzLmlvcykge1xyXG4gICAgdmFyIGlvc1ZpZXc6VUlWaWV3ID0gdmlldy5pb3M7XHJcbiAgICB2YXIgY29sb3JzQXJyYXkgPSBOU011dGFibGVBcnJheS5hbGxvYygpLmluaXRXaXRoQ2FwYWNpdHkoMik7XHJcbiAgICBjb2xvcnMuZm9yRWFjaChmdW5jdGlvbiAoYzpDb2xvcikge1xyXG4gICAgICBjb2xvcnNBcnJheS5hZGRPYmplY3QoaW50ZXJvcC50eXBlcy5pZChjLmlvcy5DR0NvbG9yKSk7XHJcbiAgICB9KTtcclxuICAgIHZhciBncmFkaWVudExheWVyID0gQ0FHcmFkaWVudExheWVyLmxheWVyKCk7XHJcbiAgICBncmFkaWVudExheWVyLmNvbG9ycyA9IGNvbG9yc0FycmF5O1xyXG4gICAgZ3JhZGllbnRMYXllci5mcmFtZSA9IGlvc1ZpZXcuYm91bmRzO1xyXG4gICAgaW9zVmlldy5sYXllci5pbnNlcnRTdWJsYXllckF0SW5kZXgoZ3JhZGllbnRMYXllciwgMCk7XHJcbiAgfVxyXG59XHJcblxyXG5cclxuZGVjbGFyZSBjb25zdCBpbmV0X250b2E6YW55O1xyXG5kZWNsYXJlIGNvbnN0IGdldGlmYWRkcnM6YW55O1xyXG5kZWNsYXJlIGNvbnN0IHNvY2thZGRyX2luOmFueTtcclxuZGVjbGFyZSBjb25zdCBmcmVlaWZhZGRyczphbnk7XHJcblxyXG5mdW5jdGlvbiBpcFRvU3RyaW5nKGluQWRkcikge1xyXG4gICAgaWYgKCFpbkFkZHIpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luID09IE5VTEwnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaW5BZGRyLnNfYWRkciA9PT0gMHgwMDAwMDAwMCkge1xyXG4gICAgICAgIHJldHVybiAnKic7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBOU1N0cmluZy5zdHJpbmdXaXRoQ1N0cmluZ0VuY29kaW5nKGluZXRfbnRvYShpbkFkZHIpLCAxKS50b1N0cmluZygpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0SVBBZGRyZXNzT2ZJbnRlcmZhY2UoJGludGVyZmFjZSkge1xyXG4gICAgdmFyIGFkZHJlc3MgPSAnLSc7XHJcbiAgICBpZiAoISRpbnRlcmZhY2UpIHtcclxuICAgICAgICByZXR1cm4gYWRkcmVzcztcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaW50ZXJmYWNlc1B0clB0ciA9IG5ldyBpbnRlcm9wLlJlZmVyZW5jZSgpO1xyXG5cclxuICAgIGlmIChnZXRpZmFkZHJzKGludGVyZmFjZXNQdHJQdHIpID09PSAwKSB7XHJcbiAgICAgICAgdmFyIGludGVyZmFjZXNQdHIgPSBpbnRlcmZhY2VzUHRyUHRyWzBdO1xyXG4gICAgICAgIHZhciB0ZW1wX2FkZHJQdHIgPSBpbnRlcmZhY2VzUHRyO1xyXG5cclxuICAgICAgICB3aGlsZSAodGVtcF9hZGRyUHRyICE9IG51bGwpIHtcclxuICAgICAgICAgICAgaWYgKHRlbXBfYWRkclB0clswXS5pZmFfYWRkclswXS5zYV9mYW1pbHkgPT09IDIpIHtcclxuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gTlNTdHJpbmcuc3RyaW5nV2l0aFVURjhTdHJpbmcodGVtcF9hZGRyUHRyWzBdLmlmYV9uYW1lKS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgIGlmIChuYW1lID09ICRpbnRlcmZhY2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaWZhX2FkZHJQdHIgPSB0ZW1wX2FkZHJQdHJbMF0uaWZhX2FkZHI7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlmYV9hZGRyUHRyQXNTb2NrQWRkdHJfaW4gPSBuZXcgaW50ZXJvcC5SZWZlcmVuY2Uoc29ja2FkZHJfaW4sIGlmYV9hZGRyUHRyKTtcclxuICAgICAgICAgICAgICAgICAgICBhZGRyZXNzID0gaXBUb1N0cmluZyhpZmFfYWRkclB0ckFzU29ja0FkZHRyX2luWzBdLnNpbl9hZGRyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0ZW1wX2FkZHJQdHIgPSB0ZW1wX2FkZHJQdHJbMF0uaWZhX25leHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmcmVlaWZhZGRycyhpbnRlcmZhY2VzUHRyKTtcclxuICAgIH1cclxuICAgIHJldHVybiBhZGRyZXNzO1xyXG59XHJcblxyXG4iXX0=