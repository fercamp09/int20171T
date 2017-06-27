"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var URI = require("urijs");
var application = require("application");
var utils = require("utils/utils");
var search_bar_1 = require("ui/search-bar");
var color_1 = require("color");
var enums_1 = require("ui/enums");
var gestures_1 = require("ui/gestures");
var bookmarks = require("./components/common/bookmarks");
var AppViewModel_1 = require("./components/common/AppViewModel");
var util_1 = require("./components/common/util");
// import {RealityViewer} from '@argonjs/argon'
//import * as orientationModule from 'nativescript-screen-orientation';
var orientationModule = require("nativescript-screen-orientation");
var searchBar;
var iosSearchBarController;
var androidSearchBarController;
var isFirstLoad = true;
AppViewModel_1.appViewModel.on('propertyChange', function (evt) {
    if (evt.propertyName === 'currentUri') {
        setSearchBarText(AppViewModel_1.appViewModel.currentUri || '');
        if (!AppViewModel_1.appViewModel.currentUri)
            AppViewModel_1.appViewModel.showBookmarks();
        AppViewModel_1.appViewModel.updatePermissionsFromStorage(AppViewModel_1.appViewModel.currentUri);
    }
    else if (evt.propertyName === 'viewerEnabled') {
        // const vuforiaDelegate = appViewModel.manager.container.get(Argon.VuforiaServiceDelegate);
        // vuforiaDelegate.viewerEnabled = evt.value;
        if (evt.value) {
            orientationModule.setCurrentOrientation("landscape");
        }
        else {
            orientationModule.setCurrentOrientation("portrait");
            orientationModule.setCurrentOrientation("all");
        }
        checkActionBar();
        updateSystemUI();
        setTimeout(function () { checkActionBar(); }, 500);
    }
    else if (evt.propertyName === 'menuOpen') {
        if (evt.value) {
            AppViewModel_1.appViewModel.hideOverview();
            exports.menuView.visibility = "visible";
            exports.menuView.animate({
                scale: {
                    x: 1,
                    y: 1,
                },
                duration: 150,
                opacity: 1,
                curve: enums_1.AnimationCurve.easeInOut
            });
            exports.touchOverlayView.visibility = 'visible';
            exports.touchOverlayView.on(gestures_1.GestureTypes.touch, function () {
                exports.touchOverlayView.off(gestures_1.GestureTypes.touch);
                exports.touchOverlayView.visibility = 'collapse';
                AppViewModel_1.appViewModel.hideMenu();
            });
        }
        else {
            exports.menuView.animate({
                scale: {
                    x: 0,
                    y: 0,
                },
                duration: 150,
                opacity: 0,
                curve: enums_1.AnimationCurve.easeInOut
            }).then(function () {
                exports.menuView.visibility = "collapse";
            });
            exports.touchOverlayView.off(gestures_1.GestureTypes.touch);
            exports.touchOverlayView.visibility = 'collapse';
        }
    }
    else if (evt.propertyName === 'overviewOpen') {
        if (evt.value) {
            AppViewModel_1.appViewModel.hideBookmarks();
            AppViewModel_1.appViewModel.hidePermissionIcons();
            searchBar.animate({
                translate: { x: -100, y: 0 },
                opacity: 0,
                curve: enums_1.AnimationCurve.easeInOut
            }).then(function () {
                searchBar.visibility = 'collapse';
            });
            var addButton = exports.headerView.getViewById('addButton');
            addButton.visibility = 'visible';
            addButton.opacity = 0;
            addButton.translateX = -10;
            addButton.animate({
                translate: { x: 0, y: 0 },
                opacity: 1
            });
        }
        else {
            if (!AppViewModel_1.appViewModel.layerDetails.uri)
                AppViewModel_1.appViewModel.showBookmarks();
            searchBar.visibility = 'visible';
            searchBar.animate({
                translate: { x: 0, y: 0 },
                opacity: 1,
                curve: enums_1.AnimationCurve.easeInOut
            });
            var addButton_1 = exports.headerView.getViewById('addButton');
            addButton_1.animate({
                translate: { x: -10, y: 0 },
                opacity: 0
            }).then(function () {
                addButton_1.visibility = 'collapse';
                AppViewModel_1.appViewModel.showPermissionIcons();
            });
        }
    }
    else if (evt.propertyName === 'realityChooserOpen') {
        if (evt.value) {
            exports.realityChooserView.visibility = 'visible';
            exports.realityChooserView.animate({
                scale: {
                    x: 1,
                    y: 1
                },
                opacity: 1,
                duration: 150,
                curve: enums_1.AnimationCurve.easeInOut
            });
            AppViewModel_1.appViewModel.showCancelButton();
        }
        else {
            exports.realityChooserView.animate({
                scale: {
                    x: 1,
                    y: 1
                },
                opacity: 0,
                duration: 150,
                curve: enums_1.AnimationCurve.easeInOut
            }).then(function () {
                exports.realityChooserView.visibility = 'collapse';
                exports.realityChooserView.scaleX = 0.9;
                exports.realityChooserView.scaleY = 0.9;
            });
            blurSearchBar();
            AppViewModel_1.appViewModel.hideCancelButton();
        }
    }
    else if (evt.propertyName === 'bookmarksOpen') {
        if (evt.value) {
            exports.bookmarksView.visibility = 'visible';
            exports.bookmarksView.animate({
                scale: {
                    x: 1,
                    y: 1
                },
                opacity: 1,
                duration: 150,
                curve: enums_1.AnimationCurve.easeInOut
            });
        }
        else {
            exports.bookmarksView.animate({
                scale: {
                    x: 1,
                    y: 1
                },
                opacity: 0,
                duration: 150,
                curve: enums_1.AnimationCurve.easeInOut
            }).then(function () {
                exports.bookmarksView.visibility = 'collapse';
                exports.bookmarksView.scaleX = 0.9;
                exports.bookmarksView.scaleY = 0.9;
            });
            blurSearchBar();
            AppViewModel_1.appViewModel.hideCancelButton();
        }
    }
    else if (evt.propertyName === 'cancelButtonShown') {
        if (evt.value) {
            var overviewButton_1 = exports.headerView.getViewById('overviewButton');
            overviewButton_1.animate({
                opacity: 0
            }).then(function () {
                overviewButton_1.visibility = 'collapse';
            });
            var menuButton_1 = exports.headerView.getViewById('menuButton');
            menuButton_1.animate({
                opacity: 0
            }).then(function () {
                menuButton_1.visibility = 'collapse';
            });
            var cancelButton = exports.headerView.getViewById('cancelButton');
            cancelButton.visibility = 'visible';
            cancelButton.animate({
                opacity: 1
            });
            AppViewModel_1.appViewModel.hidePermissionIcons();
        }
        else {
            var overviewButton = exports.headerView.getViewById('overviewButton');
            overviewButton.visibility = 'visible';
            overviewButton.animate({
                opacity: 1
            });
            var menuButton = exports.headerView.getViewById('menuButton');
            menuButton.visibility = 'visible';
            menuButton.animate({
                opacity: 1
            });
            var cancelButton_1 = exports.headerView.getViewById('cancelButton');
            cancelButton_1.animate({
                opacity: 0
            }).then(function () {
                cancelButton_1.visibility = 'collapse';
            });
            AppViewModel_1.appViewModel.showPermissionIcons();
            exports.layout.off(gestures_1.GestureTypes.touch);
        }
    }
    else if (evt.propertyName === "permissionMenuOpen") {
        if (evt.value) {
            AppViewModel_1.appViewModel.hideOverview();
            exports.permissionMenuView.visibility = "visible";
            exports.permissionMenuView.animate({
                scale: {
                    x: 1,
                    y: 1,
                },
                duration: 150,
                opacity: 1,
                curve: enums_1.AnimationCurve.easeInOut
            });
            exports.touchOverlayView.visibility = 'visible';
            exports.touchOverlayView.on(gestures_1.GestureTypes.touch, function () {
                exports.touchOverlayView.off(gestures_1.GestureTypes.touch);
                exports.touchOverlayView.visibility = 'collapse';
                AppViewModel_1.appViewModel.hidePermissionMenu();
            });
        }
        else {
            exports.permissionMenuView.animate({
                scale: {
                    x: 0,
                    y: 0,
                },
                duration: 150,
                opacity: 0,
                curve: enums_1.AnimationCurve.easeInOut
            }).then(function () {
                exports.permissionMenuView.visibility = "collapse";
            });
            exports.touchOverlayView.off(gestures_1.GestureTypes.touch);
            exports.touchOverlayView.visibility = 'collapse';
        }
    }
});
var checkActionBar = function () {
    if (!exports.page)
        return;
    if (util_1.screenOrientation === 90 || util_1.screenOrientation === -90 || AppViewModel_1.appViewModel.viewerEnabled)
        exports.page.actionBarHidden = true;
    else
        exports.page.actionBarHidden = false;
};
var updateSystemUI = function () {
    if (!exports.page)
        return;
    if (util_1.screenOrientation === 90 || util_1.screenOrientation === -90 || AppViewModel_1.appViewModel.viewerEnabled) {
        if (exports.page.android) {
            var window = application.android.foregroundActivity.getWindow();
            var decorView = window.getDecorView();
            var uiOptions = android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
            decorView.setSystemUiVisibility(uiOptions);
        }
    }
    else {
        if (exports.page.android) {
            var window = application.android.foregroundActivity.getWindow();
            var decorView = window.getDecorView();
            var uiOptions = android.view.View.SYSTEM_UI_FLAG_VISIBLE;
            decorView.setSystemUiVisibility(uiOptions);
        }
    }
};
function pageLoaded(args) {
    if (!isFirstLoad) {
        // on android pageLoaded is called each time the app is resumed
        return;
    }
    exports.page = args.object;
    exports.page.bindingContext = AppViewModel_1.appViewModel;
    // Set the icon for the menu button
    var menuButton = exports.page.getViewById("menuButton");
    menuButton.text = String.fromCharCode(0xe5d4);
    // Set the icon for the overview button
    var overviewButton = exports.page.getViewById("overviewButton");
    overviewButton.text = String.fromCharCode(0xe53b);
    // Set icon for location permission
    // const locationPermission = <Button> page.getViewById("locationPermission");
    //locationPermission.text = String.fromCharCode(0xe0c8);
    // console.log(String.fromCharCode(0xe0c8));
    // Set icon for camera permission
    var cameraPermission = exports.page.getViewById("cameraPermission");
    cameraPermission.text = String.fromCharCode(0xe3b0);
    // workaround (see https://github.com/NativeScript/NativeScript/issues/659)
    if (exports.page.ios) {
        setTimeout(function () {
            exports.page.requestLayout();
        }, 0);
        application.ios.addNotificationObserver(UIApplicationDidBecomeActiveNotification, function () {
            exports.page.requestLayout();
        });
    }
    application.on(application.orientationChangedEvent, function () {
        setTimeout(function () {
            checkActionBar();
            updateSystemUI();
        }, 500);
    });
    AppViewModel_1.appViewModel.ready.then(function () {
        AppViewModel_1.appViewModel.argon.session.errorEvent.addEventListener(function (error) {
            // alert(error.message + '\n' + error.stack);
            if (error.stack)
                console.log(error.message + '\n' + error.stack);
        });
        AppViewModel_1.appViewModel.showBookmarks();
    });
    if (application.android) {
        var activity = application.android.foregroundActivity;
        activity.onBackPressed = function () {
            if (exports.browserView.focussedLayer != exports.browserView.realityLayer) {
                if (exports.browserView.focussedLayer && exports.browserView.focussedLayer.webView && exports.browserView.focussedLayer.webView.android.canGoBack()) {
                    exports.browserView.focussedLayer.webView.android.goBack();
                }
            }
        };
    }
}
exports.pageLoaded = pageLoaded;
application.on(application.suspendEvent, function () {
    isFirstLoad = false;
});
application.on(application.resumeEvent, function () {
    if (application.android) {
        // on android the page is unloaded/reloaded after a suspend
        // open back to bookmarks if necessary
        if (AppViewModel_1.appViewModel.bookmarksOpen) {
            // force a property change event
            AppViewModel_1.appViewModel.notifyPropertyChange('bookmarksOpen', true);
        }
    }
});
function layoutLoaded(args) {
    exports.layout = args.object;
    if (exports.layout.ios) {
        exports.layout.ios.layer.masksToBounds = false;
    }
    AppViewModel_1.appViewModel.setReady();
}
exports.layoutLoaded = layoutLoaded;
function headerLoaded(args) {
    exports.headerView = args.object;
}
exports.headerLoaded = headerLoaded;
function searchBarLoaded(args) {
    searchBar = args.object;
    if (isFirstLoad) {
        searchBar.on(search_bar_1.SearchBar.submitEvent, function () {
            //let urlString = searchBar.text;
            //let urlString = "~/components/userinterface/index.html";
            var urlString = "http://200.126.23.63:1337/vuforia/index.html";
            // Allows page reload by clicking submit on the url bar
            if (urlString == "")
                urlString = AppViewModel_1.appViewModel.currentUri || "";
            if (urlString.includes(" ") || !urlString.includes(".")) {
                // queries with spaces or single words without dots go to google search
                urlString = "https://www.google.com/search?q=" + encodeURI(urlString);
            }
            if (urlString.indexOf('//') === -1)
                urlString = '//' + urlString;
            var url = URI(urlString);
            /*if (url.protocol() !== "http" && url.protocol() !== "https") {
                url.protocol("https");
            }*/
            setSearchBarText(url.toString());
            //appViewModel.loadUrl("~/components/userinterface/index.html");
            //appViewModel.loadUrl("http://200.126.23.63:1337/vuforia/index.html");
            //appViewModel.loadUrl(url.toString());
            AppViewModel_1.appViewModel.hideBookmarks();
            AppViewModel_1.appViewModel.hideRealityChooser();
            AppViewModel_1.appViewModel.hideCancelButton();
            bookmarks.filterControl.set('showFilteredResults', false);
            blurSearchBar();
        });
    }
    if (application.ios) {
        iosSearchBarController = new IOSSearchBarController(searchBar);
    }
    if (application.android) {
        androidSearchBarController = new AndroidSearchBarController(searchBar);
    }
}
exports.searchBarLoaded = searchBarLoaded;
function setSearchBarText(url) {
    if (iosSearchBarController) {
        iosSearchBarController.setText(url);
    }
    else {
        androidSearchBarController.setText(url);
    }
}
function blurSearchBar() {
    searchBar.dismissSoftInput();
    if (searchBar.android) {
        searchBar.android.clearFocus();
    }
}
function browserViewLoaded(args) {
    exports.browserView = args.object;
    if (isFirstLoad) {
        AppViewModel_1.appViewModel.on(AppViewModel_1.AppViewModel.loadUrlEvent, function (data) {
            var url = data.url;
            //const url = "~/components/userinterface/index.html";
            //const url = "http://200.126.23.63:1337/vuforia/index.html";
            //const url = "https://samples.argonjs.io/index.html";
            if (!data.newLayer ||
                (exports.browserView.focussedLayer &&
                    exports.browserView.focussedLayer !== exports.browserView.realityLayer &&
                    !exports.browserView.focussedLayer.details.uri)) {
                exports.browserView.loadUrl(url);
                return;
            }
            var layer = exports.browserView.addLayer();
            exports.browserView.setFocussedLayer(layer);
            exports.browserView.loadUrl(url);
            console.log('Loading url: ' + url);
        });
    }
    // Setup the debug view
    var debug = exports.browserView.page.getViewById("debug");
    debug.horizontalAlignment = 'stretch';
    debug.verticalAlignment = 'stretch';
    debug.backgroundColor = new color_1.Color(150, 255, 255, 255);
    debug.visibility = "collapsed";
    debug.isUserInteractionEnabled = false;
}
exports.browserViewLoaded = browserViewLoaded;
function bookmarksViewLoaded(args) {
    exports.bookmarksView = args.object;
    exports.bookmarksView.scaleX = 0.9;
    exports.bookmarksView.scaleY = 0.9;
    exports.bookmarksView.opacity = 0;
}
exports.bookmarksViewLoaded = bookmarksViewLoaded;
function realityChooserLoaded(args) {
    exports.realityChooserView = args.object;
    exports.realityChooserView.scaleX = 0.9;
    exports.realityChooserView.scaleY = 0.9;
    exports.realityChooserView.opacity = 0;
}
exports.realityChooserLoaded = realityChooserLoaded;
function touchOverlayLoaded(args) {
    exports.touchOverlayView = args.object;
}
exports.touchOverlayLoaded = touchOverlayLoaded;
// initialize some properties of the menu so that animations will render correctly
function menuLoaded(args) {
    exports.menuView = args.object;
    exports.menuView.originX = 1;
    exports.menuView.originY = 0;
    exports.menuView.scaleX = 0;
    exports.menuView.scaleY = 0;
    exports.menuView.opacity = 0;
}
exports.menuLoaded = menuLoaded;
function permissionMenuLoaded(args) {
    exports.permissionMenuView = args.object;
    exports.permissionMenuView.originX = 0;
    exports.permissionMenuView.originY = 0;
    exports.permissionMenuView.scaleX = 0;
    exports.permissionMenuView.scaleY = 0;
    exports.permissionMenuView.opacity = 0;
}
exports.permissionMenuLoaded = permissionMenuLoaded;
function onSearchBarTap(args) {
    AppViewModel_1.appViewModel.showBookmarks();
    AppViewModel_1.appViewModel.showCancelButton();
}
exports.onSearchBarTap = onSearchBarTap;
function onCancel(args) {
    if (!!AppViewModel_1.appViewModel.layerDetails.uri)
        AppViewModel_1.appViewModel.hideBookmarks();
    AppViewModel_1.appViewModel.hideRealityChooser();
    AppViewModel_1.appViewModel.hideCancelButton();
    blurSearchBar();
    setSearchBarText(AppViewModel_1.appViewModel.currentUri || '');
    bookmarks.filterControl.set('showFilteredResults', false);
}
exports.onCancel = onCancel;
function onAddChannel(args) {
    exports.browserView.addLayer();
    AppViewModel_1.appViewModel.hideMenu();
    AppViewModel_1.appViewModel.hidePermissionMenu();
}
exports.onAddChannel = onAddChannel;
function onReload(args) {
    AppViewModel_1.appViewModel.hideMenu();
    exports.browserView.focussedLayer &&
        exports.browserView.focussedLayer.webView &&
        exports.browserView.focussedLayer.webView.reload();
}
exports.onReload = onReload;
function onFavoriteToggle(args) {
    var url = AppViewModel_1.appViewModel.layerDetails.uri;
    var bookmarkItem = bookmarks.favoriteMap.get(url);
    if (!bookmarkItem) {
        bookmarks.favoriteList.push(new bookmarks.BookmarkItem({
            uri: url,
            title: AppViewModel_1.appViewModel.layerDetails.title
        }));
    }
    else {
        var i = bookmarks.favoriteList.indexOf(bookmarkItem);
        bookmarks.favoriteList.splice(i, 1);
    }
}
exports.onFavoriteToggle = onFavoriteToggle;
function onInteractionToggle(args) {
    AppViewModel_1.appViewModel.toggleInteractionMode();
}
exports.onInteractionToggle = onInteractionToggle;
function onOverview(args) {
    AppViewModel_1.appViewModel.toggleOverview();
    AppViewModel_1.appViewModel.hideMenu();
    AppViewModel_1.appViewModel.hidePermissionMenu();
}
exports.onOverview = onOverview;
function onMenu(args) {
    AppViewModel_1.appViewModel.hidePermissionMenu();
    AppViewModel_1.appViewModel.toggleMenu();
}
exports.onMenu = onMenu;
function onSelectReality(args) {
    AppViewModel_1.appViewModel.showRealityChooser();
    AppViewModel_1.appViewModel.showCancelButton();
    AppViewModel_1.appViewModel.hideMenu();
    AppViewModel_1.appViewModel.hidePermissionMenu();
}
exports.onSelectReality = onSelectReality;
function onSettings(args) {
    //code to open the settings view goes here
    AppViewModel_1.appViewModel.hideMenu();
    AppViewModel_1.appViewModel.hidePermissionMenu();
}
exports.onSettings = onSettings;
function onViewerToggle(args) {
    AppViewModel_1.appViewModel.toggleViewer();
    AppViewModel_1.appViewModel.hideMenu();
    AppViewModel_1.appViewModel.hidePermissionMenu();
}
exports.onViewerToggle = onViewerToggle;
function onDebugToggle(args) {
    AppViewModel_1.appViewModel.toggleDebug();
}
exports.onDebugToggle = onDebugToggle;
function onLocationPermissionIcon(args) {
    AppViewModel_1.appViewModel.togglePermissionMenu('geolocation');
    AppViewModel_1.appViewModel.hideMenu();
}
exports.onLocationPermissionIcon = onLocationPermissionIcon;
function onCameraPermissionIcon(args) {
    AppViewModel_1.appViewModel.togglePermissionMenu('camera');
    AppViewModel_1.appViewModel.hideMenu();
}
exports.onCameraPermissionIcon = onCameraPermissionIcon;
function onPermissionIconMenuChangeTap(args) {
    AppViewModel_1.appViewModel.changePermissions(); //unsubscribe or subscribe permission
}
exports.onPermissionIconMenuChangeTap = onPermissionIconMenuChangeTap;
var IOSSearchBarController = (function () {
    function IOSSearchBarController(searchBar) {
        var _this = this;
        this.searchBar = searchBar;
        this.uiSearchBar = searchBar.ios;
        this.textField = this.uiSearchBar.valueForKey("searchField");
        this.uiSearchBar.keyboardType = 10 /* WebSearch */;
        this.uiSearchBar.autocapitalizationType = 0 /* None */;
        this.uiSearchBar.searchBarStyle = 2 /* Minimal */;
        this.uiSearchBar.returnKeyType = 1 /* Go */;
        this.uiSearchBar.setImageForSearchBarIconState(UIImage.new(), 0 /* Search */, 0 /* Normal */);
        this.textField.leftViewMode = 0 /* Never */;
        var textFieldEditHandler = function () {
            AppViewModel_1.appViewModel.hideMenu();
            AppViewModel_1.appViewModel.hidePermissionMenu();
            if (utils.ios.getter(UIResponder, _this.uiSearchBar.isFirstResponder)) {
                if (exports.browserView.focussedLayer === exports.browserView.realityLayer) {
                    AppViewModel_1.appViewModel.showRealityChooser();
                }
                else {
                    AppViewModel_1.appViewModel.showBookmarks();
                }
                AppViewModel_1.appViewModel.showCancelButton();
                setTimeout(function () {
                    if (_this.uiSearchBar.text === "") {
                        _this.uiSearchBar.text = AppViewModel_1.appViewModel.layerDetails.uri;
                        _this.setPlaceholderText("");
                        _this.textField.selectedTextRange = _this.textField.textRangeFromPositionToPosition(_this.textField.beginningOfDocument, _this.textField.endOfDocument);
                    }
                }, 500);
                exports.layout.on(gestures_1.GestureTypes.touch, function () {
                    blurSearchBar();
                    exports.layout.off(gestures_1.GestureTypes.touch);
                    if (!AppViewModel_1.appViewModel.layerDetails.uri)
                        AppViewModel_1.appViewModel.hideCancelButton();
                });
            }
            else {
                //this.setPlaceholderText(appViewModel.layerDetails.uri);
                //this.uiSearchBar.text = "";
            }
        };
        var textFieldChangeHandler = function () {
            bookmarks.filterBookmarks(_this.uiSearchBar.text.toString());
            bookmarks.filterControl.set('showFilteredResults', _this.uiSearchBar.text.length > 0);
        };
        application.ios.addNotificationObserver(UITextFieldTextDidBeginEditingNotification, textFieldEditHandler);
        application.ios.addNotificationObserver(UITextFieldTextDidEndEditingNotification, textFieldEditHandler);
        application.ios.addNotificationObserver(UITextFieldTextDidChangeNotification, textFieldChangeHandler);
    }
    IOSSearchBarController.prototype.setPlaceholderText = function (text) {
        if (text) {
            var attributes = NSMutableDictionary.new().init();
            attributes.setObjectForKey(utils.ios.getter(UIColor, UIColor.blackColor), NSForegroundColorAttributeName);
            this.textField.attributedPlaceholder = NSAttributedString.alloc().initWithStringAttributes(text, attributes);
        }
        else {
            this.textField.placeholder = searchBar.hint;
        }
    };
    IOSSearchBarController.prototype.setText = function (url) {
        if (!utils.ios.getter(UIResponder, this.uiSearchBar.isFirstResponder)) {
            this.setPlaceholderText(url);
            this.uiSearchBar.text = "";
        }
        else {
            this.uiSearchBar.text = url;
        }
    };
    return IOSSearchBarController;
}());
var AndroidSearchBarController = (function () {
    function AndroidSearchBarController(searchBar) {
        this.searchBar = searchBar;
        this.searchView = searchBar.android;
        this.searchView.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        this.searchView.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_GO);
        this.searchView.clearFocus();
        var focusHandler = new android.view.View.OnFocusChangeListener({
            onFocusChange: function (v, hasFocus) {
                if (hasFocus) {
                    if (exports.browserView.focussedLayer === exports.browserView.realityLayer) {
                        AppViewModel_1.appViewModel.showRealityChooser();
                    }
                    else {
                        bookmarks.filterControl.set('showFilteredResults', false);
                        AppViewModel_1.appViewModel.showBookmarks();
                    }
                    AppViewModel_1.appViewModel.showCancelButton();
                }
            }
        });
        this.searchView.setOnQueryTextFocusChangeListener(focusHandler);
        // the nativescript implementation of OnQueryTextListener does not correctly handle the following case:
        // 1) an external event updates the query text (e.g. the user clicked a link on a page)
        // 2) the user attempts to navigate back to the previous page by updating the search bar text
        // 3) nativescript sees this as submitting the same query and treats it as a no-op
        // https://github.com/NativeScript/NativeScript/issues/3965
        var searchHandler = new android.widget.SearchView.OnQueryTextListener({
            onQueryTextChange: function (newText) {
                searchBar._onPropertyChangedFromNative(search_bar_1.SearchBar.textProperty, newText);
                bookmarks.filterBookmarks(newText.toString());
                bookmarks.filterControl.set('showFilteredResults', newText.length > 0);
                return false;
            },
            onQueryTextSubmit: function (query) {
                searchBar.notify({
                    eventName: search_bar_1.SearchBar.submitEvent,
                    object: this
                });
                return true;
            }
        });
        this.searchView.setOnQueryTextListener(searchHandler);
    }
    AndroidSearchBarController.prototype.setText = function (url) {
        this.searchView.setQuery(url, false);
    };
    return AndroidSearchBarController;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi1wYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFpbi1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMkJBQTZCO0FBQzdCLHlDQUEyQztBQUMzQyxtQ0FBcUM7QUFDckMsNENBQXdDO0FBS3hDLCtCQUE0QjtBQUU1QixrQ0FBdUM7QUFDdkMsd0NBQXdDO0FBR3hDLHlEQUEyRDtBQUMzRCxpRUFBOEY7QUFDOUYsaURBQTJEO0FBRTNELCtDQUErQztBQUUvQyx1RUFBdUU7QUFDdkUsSUFBSSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsaUNBQWlDLENBQUMsQ0FBQztBQVluRSxJQUFJLFNBQW1CLENBQUM7QUFDeEIsSUFBSSxzQkFBNkMsQ0FBQztBQUNsRCxJQUFJLDBCQUFxRCxDQUFDO0FBRTFELElBQUksV0FBVyxHQUFHLElBQUksQ0FBQztBQUV2QiwyQkFBWSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxVQUFDLEdBQXNCO0lBQ3JELEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQztRQUNwQyxnQkFBZ0IsQ0FBQywyQkFBWSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNoRCxFQUFFLENBQUMsQ0FBQyxDQUFDLDJCQUFZLENBQUMsVUFBVSxDQUFDO1lBQUMsMkJBQVksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUMzRCwyQkFBWSxDQUFDLDRCQUE0QixDQUFDLDJCQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUNELElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxLQUFLLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDNUMsNEZBQTRGO1FBQzVGLDZDQUE2QztRQUM3QyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNaLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FB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QUM7SUFDTCxpQ0FBQztBQUFELENBQUMsQUF0REQsSUFzREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBVUkkgZnJvbSAndXJpanMnO1xyXG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbiBmcm9tICdhcHBsaWNhdGlvbic7XHJcbmltcG9ydCAqIGFzIHV0aWxzIGZyb20gJ3V0aWxzL3V0aWxzJztcclxuaW1wb3J0IHtTZWFyY2hCYXJ9IGZyb20gJ3VpL3NlYXJjaC1iYXInO1xyXG5pbXBvcnQge1BhZ2V9IGZyb20gJ3VpL3BhZ2UnO1xyXG5pbXBvcnQge0J1dHRvbn0gZnJvbSAndWkvYnV0dG9uJztcclxuaW1wb3J0IHtWaWV3fSBmcm9tICd1aS9jb3JlL3ZpZXcnO1xyXG5pbXBvcnQge0h0bWxWaWV3fSBmcm9tICd1aS9odG1sLXZpZXcnXHJcbmltcG9ydCB7Q29sb3J9IGZyb20gJ2NvbG9yJztcclxuaW1wb3J0IHtQcm9wZXJ0eUNoYW5nZURhdGEsIEV2ZW50RGF0YX0gZnJvbSAnZGF0YS9vYnNlcnZhYmxlJztcclxuaW1wb3J0IHtBbmltYXRpb25DdXJ2ZX0gZnJvbSAndWkvZW51bXMnXHJcbmltcG9ydCB7R2VzdHVyZVR5cGVzfSBmcm9tICd1aS9nZXN0dXJlcydcclxuXHJcbmltcG9ydCB7QnJvd3NlclZpZXd9IGZyb20gJy4vY29tcG9uZW50cy9icm93c2VyLXZpZXcnO1xyXG5pbXBvcnQgKiBhcyBib29rbWFya3MgZnJvbSAnLi9jb21wb25lbnRzL2NvbW1vbi9ib29rbWFya3MnO1xyXG5pbXBvcnQge2FwcFZpZXdNb2RlbCwgQXBwVmlld01vZGVsLCBMb2FkVXJsRXZlbnREYXRhfSBmcm9tICcuL2NvbXBvbmVudHMvY29tbW9uL0FwcFZpZXdNb2RlbCc7XHJcbmltcG9ydCB7c2NyZWVuT3JpZW50YXRpb259IGZyb20gJy4vY29tcG9uZW50cy9jb21tb24vdXRpbCc7XHJcblxyXG4vLyBpbXBvcnQge1JlYWxpdHlWaWV3ZXJ9IGZyb20gJ0BhcmdvbmpzL2FyZ29uJ1xyXG5cclxuLy9pbXBvcnQgKiBhcyBvcmllbnRhdGlvbk1vZHVsZSBmcm9tICduYXRpdmVzY3JpcHQtc2NyZWVuLW9yaWVudGF0aW9uJztcclxudmFyIG9yaWVudGF0aW9uTW9kdWxlID0gcmVxdWlyZShcIm5hdGl2ZXNjcmlwdC1zY3JlZW4tb3JpZW50YXRpb25cIik7XHJcblxyXG5leHBvcnQgbGV0IHBhZ2U6UGFnZTtcclxuZXhwb3J0IGxldCBsYXlvdXQ6VmlldztcclxuZXhwb3J0IGxldCB0b3VjaE92ZXJsYXlWaWV3OlZpZXc7XHJcbmV4cG9ydCBsZXQgaGVhZGVyVmlldzpWaWV3O1xyXG5leHBvcnQgbGV0IG1lbnVWaWV3OlZpZXc7XHJcbmV4cG9ydCBsZXQgYnJvd3NlclZpZXc6QnJvd3NlclZpZXc7XHJcbmV4cG9ydCBsZXQgYm9va21hcmtzVmlldzpWaWV3O1xyXG5leHBvcnQgbGV0IHJlYWxpdHlDaG9vc2VyVmlldzpWaWV3O1xyXG5leHBvcnQgbGV0IHBlcm1pc3Npb25NZW51VmlldzpWaWV3O1xyXG5cclxubGV0IHNlYXJjaEJhcjpTZWFyY2hCYXI7XHJcbmxldCBpb3NTZWFyY2hCYXJDb250cm9sbGVyOklPU1NlYXJjaEJhckNvbnRyb2xsZXI7XHJcbmxldCBhbmRyb2lkU2VhcmNoQmFyQ29udHJvbGxlcjpBbmRyb2lkU2VhcmNoQmFyQ29udHJvbGxlcjtcclxuXHJcbnZhciBpc0ZpcnN0TG9hZCA9IHRydWU7XHJcblxyXG5hcHBWaWV3TW9kZWwub24oJ3Byb3BlcnR5Q2hhbmdlJywgKGV2dDpQcm9wZXJ0eUNoYW5nZURhdGEpPT57XHJcbiAgICBpZiAoZXZ0LnByb3BlcnR5TmFtZSA9PT0gJ2N1cnJlbnRVcmknKSB7XHJcbiAgICAgICAgc2V0U2VhcmNoQmFyVGV4dChhcHBWaWV3TW9kZWwuY3VycmVudFVyaSB8fCAnJyk7XHJcbiAgICAgICAgaWYgKCFhcHBWaWV3TW9kZWwuY3VycmVudFVyaSkgYXBwVmlld01vZGVsLnNob3dCb29rbWFya3MoKTtcclxuICAgICAgICBhcHBWaWV3TW9kZWwudXBkYXRlUGVybWlzc2lvbnNGcm9tU3RvcmFnZShhcHBWaWV3TW9kZWwuY3VycmVudFVyaSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChldnQucHJvcGVydHlOYW1lID09PSAndmlld2VyRW5hYmxlZCcpIHtcclxuICAgICAgICAvLyBjb25zdCB2dWZvcmlhRGVsZWdhdGUgPSBhcHBWaWV3TW9kZWwubWFuYWdlci5jb250YWluZXIuZ2V0KEFyZ29uLlZ1Zm9yaWFTZXJ2aWNlRGVsZWdhdGUpO1xyXG4gICAgICAgIC8vIHZ1Zm9yaWFEZWxlZ2F0ZS52aWV3ZXJFbmFibGVkID0gZXZ0LnZhbHVlO1xyXG4gICAgICAgIGlmIChldnQudmFsdWUpIHtcclxuICAgICAgICAgICAgb3JpZW50YXRpb25Nb2R1bGUuc2V0Q3VycmVudE9yaWVudGF0aW9uKFwibGFuZHNjYXBlXCIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG9yaWVudGF0aW9uTW9kdWxlLnNldEN1cnJlbnRPcmllbnRhdGlvbihcInBvcnRyYWl0XCIpO1xyXG4gICAgICAgICAgICBvcmllbnRhdGlvbk1vZHVsZS5zZXRDdXJyZW50T3JpZW50YXRpb24oXCJhbGxcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNoZWNrQWN0aW9uQmFyKCk7XHJcbiAgICAgICAgdXBkYXRlU3lzdGVtVUkoKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpPT57Y2hlY2tBY3Rpb25CYXIoKX0sIDUwMCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChldnQucHJvcGVydHlOYW1lID09PSAnbWVudU9wZW4nKSB7XHJcbiAgICAgICAgaWYgKGV2dC52YWx1ZSkge1xyXG4gICAgICAgICAgICBhcHBWaWV3TW9kZWwuaGlkZU92ZXJ2aWV3KCk7XHJcbiAgICAgICAgICAgIG1lbnVWaWV3LnZpc2liaWxpdHkgPSBcInZpc2libGVcIjtcclxuICAgICAgICAgICAgbWVudVZpZXcuYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBzY2FsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIHg6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogMSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBkdXJhdGlvbjogMTUwLFxyXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogMSxcclxuICAgICAgICAgICAgICAgIGN1cnZlOiBBbmltYXRpb25DdXJ2ZS5lYXNlSW5PdXRcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRvdWNoT3ZlcmxheVZpZXcudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcclxuICAgICAgICAgICAgdG91Y2hPdmVybGF5Vmlldy5vbihHZXN0dXJlVHlwZXMudG91Y2gsKCk9PntcclxuICAgICAgICAgICAgICAgIHRvdWNoT3ZlcmxheVZpZXcub2ZmKEdlc3R1cmVUeXBlcy50b3VjaCk7XHJcbiAgICAgICAgICAgICAgICB0b3VjaE92ZXJsYXlWaWV3LnZpc2liaWxpdHkgPSAnY29sbGFwc2UnO1xyXG4gICAgICAgICAgICAgICAgYXBwVmlld01vZGVsLmhpZGVNZW51KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG1lbnVWaWV3LmFuaW1hdGUoe1xyXG4gICAgICAgICAgICAgICAgc2NhbGU6IHtcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDAsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZHVyYXRpb246IDE1MCxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgbWVudVZpZXcudmlzaWJpbGl0eSA9IFwiY29sbGFwc2VcIjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRvdWNoT3ZlcmxheVZpZXcub2ZmKEdlc3R1cmVUeXBlcy50b3VjaCk7XHJcbiAgICAgICAgICAgIHRvdWNoT3ZlcmxheVZpZXcudmlzaWJpbGl0eSA9ICdjb2xsYXBzZSc7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoZXZ0LnByb3BlcnR5TmFtZSA9PT0gJ292ZXJ2aWV3T3BlbicpIHtcclxuICAgICAgICBpZiAoZXZ0LnZhbHVlKSB7XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlQm9va21hcmtzKCk7XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlUGVybWlzc2lvbkljb25zKCk7XHJcbiAgICAgICAgICAgIHNlYXJjaEJhci5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIHRyYW5zbGF0ZToge3g6LTEwMCwgeTowfSxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAgIHNlYXJjaEJhci52aXNpYmlsaXR5ID0gJ2NvbGxhcHNlJztcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgY29uc3QgYWRkQnV0dG9uID0gaGVhZGVyVmlldy5nZXRWaWV3QnlJZCgnYWRkQnV0dG9uJyk7XHJcbiAgICAgICAgICAgIGFkZEJ1dHRvbi52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xyXG4gICAgICAgICAgICBhZGRCdXR0b24ub3BhY2l0eSA9IDA7XHJcbiAgICAgICAgICAgIGFkZEJ1dHRvbi50cmFuc2xhdGVYID0gLTEwO1xyXG4gICAgICAgICAgICBhZGRCdXR0b24uYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICB0cmFuc2xhdGU6IHt4OjAseTowfSxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICghYXBwVmlld01vZGVsLmxheWVyRGV0YWlscy51cmkpIGFwcFZpZXdNb2RlbC5zaG93Qm9va21hcmtzKCk7ICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHNlYXJjaEJhci52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xyXG4gICAgICAgICAgICBzZWFyY2hCYXIuYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICB0cmFuc2xhdGU6IHt4OjAsIHk6MH0sXHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OiAxLFxyXG4gICAgICAgICAgICAgICAgY3VydmU6IEFuaW1hdGlvbkN1cnZlLmVhc2VJbk91dFxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBjb25zdCBhZGRCdXR0b24gPSBoZWFkZXJWaWV3LmdldFZpZXdCeUlkKCdhZGRCdXR0b24nKTtcclxuICAgICAgICAgICAgYWRkQnV0dG9uLmFuaW1hdGUoe1xyXG4gICAgICAgICAgICAgICAgdHJhbnNsYXRlOiB7eDotMTAsIHk6MH0sXHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OjBcclxuICAgICAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgYWRkQnV0dG9uLnZpc2liaWxpdHkgPSAnY29sbGFwc2UnO1xyXG4gICAgICAgICAgICAgICAgYXBwVmlld01vZGVsLnNob3dQZXJtaXNzaW9uSWNvbnMoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChldnQucHJvcGVydHlOYW1lID09PSAncmVhbGl0eUNob29zZXJPcGVuJykge1xyXG4gICAgICAgIGlmIChldnQudmFsdWUpIHtcclxuICAgICAgICAgICAgcmVhbGl0eUNob29zZXJWaWV3LnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XHJcbiAgICAgICAgICAgIHJlYWxpdHlDaG9vc2VyVmlldy5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIHNjYWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgeDoxLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6MVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MSxcclxuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiAxNTAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93Q2FuY2VsQnV0dG9uKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVhbGl0eUNob29zZXJWaWV3LmFuaW1hdGUoe1xyXG4gICAgICAgICAgICAgICAgc2NhbGU6IHtcclxuICAgICAgICAgICAgICAgICAgICB4OjEsXHJcbiAgICAgICAgICAgICAgICAgICAgeToxXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgb3BhY2l0eTowLFxyXG4gICAgICAgICAgICAgICAgZHVyYXRpb246IDE1MCxcclxuICAgICAgICAgICAgICAgIGN1cnZlOiBBbmltYXRpb25DdXJ2ZS5lYXNlSW5PdXRcclxuICAgICAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgcmVhbGl0eUNob29zZXJWaWV3LnZpc2liaWxpdHkgPSAnY29sbGFwc2UnO1xyXG4gICAgICAgICAgICAgICAgcmVhbGl0eUNob29zZXJWaWV3LnNjYWxlWCA9IDAuOTtcclxuICAgICAgICAgICAgICAgIHJlYWxpdHlDaG9vc2VyVmlldy5zY2FsZVkgPSAwLjk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGJsdXJTZWFyY2hCYXIoKTtcclxuICAgICAgICAgICAgYXBwVmlld01vZGVsLmhpZGVDYW5jZWxCdXR0b24oKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChldnQucHJvcGVydHlOYW1lID09PSAnYm9va21hcmtzT3BlbicpIHtcclxuICAgICAgICBpZiAoZXZ0LnZhbHVlKSB7XHJcbiAgICAgICAgICAgIGJvb2ttYXJrc1ZpZXcudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcclxuICAgICAgICAgICAgYm9va21hcmtzVmlldy5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIHNjYWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgeDoxLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6MVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MSxcclxuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiAxNTAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYm9va21hcmtzVmlldy5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIHNjYWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgeDoxLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6MVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MCxcclxuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiAxNTAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAgIGJvb2ttYXJrc1ZpZXcudmlzaWJpbGl0eSA9ICdjb2xsYXBzZSc7XHJcbiAgICAgICAgICAgICAgICBib29rbWFya3NWaWV3LnNjYWxlWCA9IDAuOTtcclxuICAgICAgICAgICAgICAgIGJvb2ttYXJrc1ZpZXcuc2NhbGVZID0gMC45O1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBibHVyU2VhcmNoQmFyKCk7XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlQ2FuY2VsQnV0dG9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSBcclxuICAgIGVsc2UgaWYgKGV2dC5wcm9wZXJ0eU5hbWUgPT09ICdjYW5jZWxCdXR0b25TaG93bicpIHtcclxuICAgICAgICBpZiAoZXZ0LnZhbHVlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG92ZXJ2aWV3QnV0dG9uID0gaGVhZGVyVmlldy5nZXRWaWV3QnlJZCgnb3ZlcnZpZXdCdXR0b24nKTtcclxuICAgICAgICAgICAgb3ZlcnZpZXdCdXR0b24uYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OjBcclxuICAgICAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgb3ZlcnZpZXdCdXR0b24udmlzaWJpbGl0eSA9ICdjb2xsYXBzZSc7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGNvbnN0IG1lbnVCdXR0b24gPSBoZWFkZXJWaWV3LmdldFZpZXdCeUlkKCdtZW51QnV0dG9uJyk7XHJcbiAgICAgICAgICAgIG1lbnVCdXR0b24uYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OjBcclxuICAgICAgICAgICAgfSkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgICAgbWVudUJ1dHRvbi52aXNpYmlsaXR5ID0gJ2NvbGxhcHNlJztcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgY29uc3QgY2FuY2VsQnV0dG9uID0gaGVhZGVyVmlldy5nZXRWaWV3QnlJZCgnY2FuY2VsQnV0dG9uJyk7XHJcbiAgICAgICAgICAgIGNhbmNlbEJ1dHRvbi52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xyXG4gICAgICAgICAgICBjYW5jZWxCdXR0b24uYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OjFcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlUGVybWlzc2lvbkljb25zKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3Qgb3ZlcnZpZXdCdXR0b24gPSBoZWFkZXJWaWV3LmdldFZpZXdCeUlkKCdvdmVydmlld0J1dHRvbicpO1xyXG4gICAgICAgICAgICBvdmVydmlld0J1dHRvbi52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xyXG4gICAgICAgICAgICBvdmVydmlld0J1dHRvbi5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBjb25zdCBtZW51QnV0dG9uID0gaGVhZGVyVmlldy5nZXRWaWV3QnlJZCgnbWVudUJ1dHRvbicpO1xyXG4gICAgICAgICAgICBtZW51QnV0dG9uLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XHJcbiAgICAgICAgICAgIG1lbnVCdXR0b24uYW5pbWF0ZSh7XHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OjFcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgY29uc3QgY2FuY2VsQnV0dG9uID0gaGVhZGVyVmlldy5nZXRWaWV3QnlJZCgnY2FuY2VsQnV0dG9uJyk7XHJcbiAgICAgICAgICAgIGNhbmNlbEJ1dHRvbi5hbmltYXRlKHtcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6MFxyXG4gICAgICAgICAgICB9KS50aGVuKCgpPT57XHJcbiAgICAgICAgICAgICAgICBjYW5jZWxCdXR0b24udmlzaWJpbGl0eSA9ICdjb2xsYXBzZSc7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93UGVybWlzc2lvbkljb25zKCk7XHJcbiAgICAgICAgICAgIGxheW91dC5vZmYoR2VzdHVyZVR5cGVzLnRvdWNoKTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKGV2dC5wcm9wZXJ0eU5hbWUgPT09IFwicGVybWlzc2lvbk1lbnVPcGVuXCIpIHtcclxuICAgICAgICBpZiAoZXZ0LnZhbHVlKSB7XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlT3ZlcnZpZXcoKTtcclxuICAgICAgICAgICAgcGVybWlzc2lvbk1lbnVWaWV3LnZpc2liaWxpdHkgPSBcInZpc2libGVcIjtcclxuICAgICAgICAgICAgcGVybWlzc2lvbk1lbnVWaWV3LmFuaW1hdGUoe1xyXG4gICAgICAgICAgICAgICAgc2NhbGU6IHtcclxuICAgICAgICAgICAgICAgICAgICB4OiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDEsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZHVyYXRpb246IDE1MCxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IDEsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0b3VjaE92ZXJsYXlWaWV3LnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XHJcbiAgICAgICAgICAgIHRvdWNoT3ZlcmxheVZpZXcub24oR2VzdHVyZVR5cGVzLnRvdWNoLCgpPT57XHJcbiAgICAgICAgICAgICAgICB0b3VjaE92ZXJsYXlWaWV3Lm9mZihHZXN0dXJlVHlwZXMudG91Y2gpO1xyXG4gICAgICAgICAgICAgICAgdG91Y2hPdmVybGF5Vmlldy52aXNpYmlsaXR5ID0gJ2NvbGxhcHNlJztcclxuICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5oaWRlUGVybWlzc2lvbk1lbnUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcGVybWlzc2lvbk1lbnVWaWV3LmFuaW1hdGUoe1xyXG4gICAgICAgICAgICAgICAgc2NhbGU6IHtcclxuICAgICAgICAgICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IDAsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZHVyYXRpb246IDE1MCxcclxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAsXHJcbiAgICAgICAgICAgICAgICBjdXJ2ZTogQW5pbWF0aW9uQ3VydmUuZWFzZUluT3V0XHJcbiAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGVybWlzc2lvbk1lbnVWaWV3LnZpc2liaWxpdHkgPSBcImNvbGxhcHNlXCI7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0b3VjaE92ZXJsYXlWaWV3Lm9mZihHZXN0dXJlVHlwZXMudG91Y2gpO1xyXG4gICAgICAgICAgICB0b3VjaE92ZXJsYXlWaWV3LnZpc2liaWxpdHkgPSAnY29sbGFwc2UnO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSlcclxuXHJcbmNvbnN0IGNoZWNrQWN0aW9uQmFyID0gKCkgPT4ge1xyXG4gICAgaWYgKCFwYWdlKSByZXR1cm47XHJcbiAgICBpZiAoc2NyZWVuT3JpZW50YXRpb24gPT09IDkwIHx8IHNjcmVlbk9yaWVudGF0aW9uID09PSAtOTAgfHwgYXBwVmlld01vZGVsLnZpZXdlckVuYWJsZWQpIFxyXG4gICAgICAgIHBhZ2UuYWN0aW9uQmFySGlkZGVuID0gdHJ1ZTtcclxuICAgIGVsc2UgXHJcbiAgICAgICAgcGFnZS5hY3Rpb25CYXJIaWRkZW4gPSBmYWxzZTtcclxufVxyXG5cclxuY29uc3QgdXBkYXRlU3lzdGVtVUkgPSAoKSA9PiB7XHJcbiAgICBpZiAoIXBhZ2UpIHJldHVybjtcclxuICAgIGlmIChzY3JlZW5PcmllbnRhdGlvbiA9PT0gOTAgfHwgc2NyZWVuT3JpZW50YXRpb24gPT09IC05MCB8fCBhcHBWaWV3TW9kZWwudmlld2VyRW5hYmxlZCkge1xyXG4gICAgICAgIGlmIChwYWdlLmFuZHJvaWQpIHtcclxuICAgICAgICAgICAgbGV0IHdpbmRvdyA9IGFwcGxpY2F0aW9uLmFuZHJvaWQuZm9yZWdyb3VuZEFjdGl2aXR5LmdldFdpbmRvdygpO1xyXG4gICAgICAgICAgICBsZXQgZGVjb3JWaWV3ID0gd2luZG93LmdldERlY29yVmlldygpO1xyXG4gICAgICAgICAgICBsZXQgdWlPcHRpb25zID0gKDxhbnk+YW5kcm9pZC52aWV3LlZpZXcpLlNZU1RFTV9VSV9GTEFHX0lNTUVSU0lWRV9TVElDS1lcclxuICAgICAgICAgICAgICAgICAgICB8ICg8YW55PmFuZHJvaWQudmlldy5WaWV3KS5TWVNURU1fVUlfRkxBR19MQVlPVVRfRlVMTFNDUkVFTlxyXG4gICAgICAgICAgICAgICAgICAgIHwgKDxhbnk+YW5kcm9pZC52aWV3LlZpZXcpLlNZU1RFTV9VSV9GTEFHX0xBWU9VVF9ISURFX05BVklHQVRJT05cclxuICAgICAgICAgICAgICAgICAgICB8ICg8YW55PmFuZHJvaWQudmlldy5WaWV3KS5TWVNURU1fVUlfRkxBR19MQVlPVVRfU1RBQkxFXHJcbiAgICAgICAgICAgICAgICAgICAgfCAoPGFueT5hbmRyb2lkLnZpZXcuVmlldykuU1lTVEVNX1VJX0ZMQUdfRlVMTFNDUkVFTlxyXG4gICAgICAgICAgICAgICAgICAgIHwgKDxhbnk+YW5kcm9pZC52aWV3LlZpZXcpLlNZU1RFTV9VSV9GTEFHX0hJREVfTkFWSUdBVElPTjtcclxuICAgICAgICAgICAgZGVjb3JWaWV3LnNldFN5c3RlbVVpVmlzaWJpbGl0eSh1aU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHBhZ2UuYW5kcm9pZCkge1xyXG4gICAgICAgICAgICBsZXQgd2luZG93ID0gYXBwbGljYXRpb24uYW5kcm9pZC5mb3JlZ3JvdW5kQWN0aXZpdHkuZ2V0V2luZG93KCk7XHJcbiAgICAgICAgICAgIGxldCBkZWNvclZpZXcgPSB3aW5kb3cuZ2V0RGVjb3JWaWV3KCk7XHJcbiAgICAgICAgICAgIGxldCB1aU9wdGlvbnMgPSAoPGFueT5hbmRyb2lkLnZpZXcuVmlldykuU1lTVEVNX1VJX0ZMQUdfVklTSUJMRTtcclxuICAgICAgICAgICAgZGVjb3JWaWV3LnNldFN5c3RlbVVpVmlzaWJpbGl0eSh1aU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBhZ2VMb2FkZWQoYXJncykge1xyXG4gICAgXHJcbiAgICBpZiAoIWlzRmlyc3RMb2FkKSB7XHJcbiAgICAgICAgLy8gb24gYW5kcm9pZCBwYWdlTG9hZGVkIGlzIGNhbGxlZCBlYWNoIHRpbWUgdGhlIGFwcCBpcyByZXN1bWVkXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHBhZ2UgPSBhcmdzLm9iamVjdDtcclxuICAgIHBhZ2UuYmluZGluZ0NvbnRleHQgPSBhcHBWaWV3TW9kZWw7XHJcblxyXG4gICAgLy8gU2V0IHRoZSBpY29uIGZvciB0aGUgbWVudSBidXR0b25cclxuICAgIGNvbnN0IG1lbnVCdXR0b24gPSA8QnV0dG9uPiBwYWdlLmdldFZpZXdCeUlkKFwibWVudUJ1dHRvblwiKTtcclxuICAgIG1lbnVCdXR0b24udGV4dCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHhlNWQ0KTtcclxuXHJcbiAgICAvLyBTZXQgdGhlIGljb24gZm9yIHRoZSBvdmVydmlldyBidXR0b25cclxuICAgIGNvbnN0IG92ZXJ2aWV3QnV0dG9uID0gPEJ1dHRvbj4gcGFnZS5nZXRWaWV3QnlJZChcIm92ZXJ2aWV3QnV0dG9uXCIpO1xyXG4gICAgb3ZlcnZpZXdCdXR0b24udGV4dCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHhlNTNiKTtcclxuXHJcbiAgICAvLyBTZXQgaWNvbiBmb3IgbG9jYXRpb24gcGVybWlzc2lvblxyXG4gICAgLy8gY29uc3QgbG9jYXRpb25QZXJtaXNzaW9uID0gPEJ1dHRvbj4gcGFnZS5nZXRWaWV3QnlJZChcImxvY2F0aW9uUGVybWlzc2lvblwiKTtcclxuICAgIC8vbG9jYXRpb25QZXJtaXNzaW9uLnRleHQgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4ZTBjOCk7XHJcbiAgICAvLyBjb25zb2xlLmxvZyhTdHJpbmcuZnJvbUNoYXJDb2RlKDB4ZTBjOCkpO1xyXG4gICAgLy8gU2V0IGljb24gZm9yIGNhbWVyYSBwZXJtaXNzaW9uXHJcbiAgICBjb25zdCBjYW1lcmFQZXJtaXNzaW9uID0gPEJ1dHRvbj4gcGFnZS5nZXRWaWV3QnlJZChcImNhbWVyYVBlcm1pc3Npb25cIik7XHJcbiAgICBjYW1lcmFQZXJtaXNzaW9uLnRleHQgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4ZTNiMCk7XHJcbiAgICBcclxuICAgIC8vIHdvcmthcm91bmQgKHNlZSBodHRwczovL2dpdGh1Yi5jb20vTmF0aXZlU2NyaXB0L05hdGl2ZVNjcmlwdC9pc3N1ZXMvNjU5KVxyXG4gICAgaWYgKHBhZ2UuaW9zKSB7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKT0+e1xyXG4gICAgICAgICAgICBwYWdlLnJlcXVlc3RMYXlvdXQoKTtcclxuICAgICAgICB9LCAwKVxyXG4gICAgICAgIGFwcGxpY2F0aW9uLmlvcy5hZGROb3RpZmljYXRpb25PYnNlcnZlcihVSUFwcGxpY2F0aW9uRGlkQmVjb21lQWN0aXZlTm90aWZpY2F0aW9uLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHBhZ2UucmVxdWVzdExheW91dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGFwcGxpY2F0aW9uLm9uKGFwcGxpY2F0aW9uLm9yaWVudGF0aW9uQ2hhbmdlZEV2ZW50LCAoKT0+e1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCk9PntcclxuICAgICAgICAgICAgY2hlY2tBY3Rpb25CYXIoKTtcclxuICAgICAgICAgICAgdXBkYXRlU3lzdGVtVUkoKTtcclxuICAgICAgICB9LCA1MDApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgYXBwVmlld01vZGVsLnJlYWR5LnRoZW4oKCk9PntcclxuICAgICAgICBcclxuICAgICAgICBhcHBWaWV3TW9kZWwuYXJnb24uc2Vzc2lvbi5lcnJvckV2ZW50LmFkZEV2ZW50TGlzdGVuZXIoKGVycm9yKT0+e1xyXG4gICAgICAgICAgICAvLyBhbGVydChlcnJvci5tZXNzYWdlICsgJ1xcbicgKyBlcnJvci5zdGFjayk7XHJcbiAgICAgICAgICAgIGlmIChlcnJvci5zdGFjaykgY29uc29sZS5sb2coZXJyb3IubWVzc2FnZSArICdcXG4nICsgZXJyb3Iuc3RhY2spO1xyXG4gICAgICAgIH0pO1xyXG4gICAgXHJcbiAgICAgICAgYXBwVmlld01vZGVsLnNob3dCb29rbWFya3MoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChhcHBsaWNhdGlvbi5hbmRyb2lkKSB7XHJcbiAgICAgICAgdmFyIGFjdGl2aXR5ID0gYXBwbGljYXRpb24uYW5kcm9pZC5mb3JlZ3JvdW5kQWN0aXZpdHk7XHJcbiAgICAgICAgYWN0aXZpdHkub25CYWNrUHJlc3NlZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKGJyb3dzZXJWaWV3LmZvY3Vzc2VkTGF5ZXIgIT0gYnJvd3NlclZpZXcucmVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYnJvd3NlclZpZXcuZm9jdXNzZWRMYXllciAmJiBicm93c2VyVmlldy5mb2N1c3NlZExheWVyLndlYlZpZXcgJiYgYnJvd3NlclZpZXcuZm9jdXNzZWRMYXllci53ZWJWaWV3LmFuZHJvaWQuY2FuR29CYWNrKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBicm93c2VyVmlldy5mb2N1c3NlZExheWVyLndlYlZpZXcuYW5kcm9pZC5nb0JhY2soKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuYXBwbGljYXRpb24ub24oYXBwbGljYXRpb24uc3VzcGVuZEV2ZW50LCAoKT0+IHtcclxuICAgIGlzRmlyc3RMb2FkID0gZmFsc2U7XHJcbn0pO1xyXG5cclxuYXBwbGljYXRpb24ub24oYXBwbGljYXRpb24ucmVzdW1lRXZlbnQsICgpPT4ge1xyXG4gICAgaWYgKGFwcGxpY2F0aW9uLmFuZHJvaWQpIHtcclxuICAgICAgICAvLyBvbiBhbmRyb2lkIHRoZSBwYWdlIGlzIHVubG9hZGVkL3JlbG9hZGVkIGFmdGVyIGEgc3VzcGVuZFxyXG4gICAgICAgIC8vIG9wZW4gYmFjayB0byBib29rbWFya3MgaWYgbmVjZXNzYXJ5XHJcbiAgICAgICAgaWYgKGFwcFZpZXdNb2RlbC5ib29rbWFya3NPcGVuKSB7XHJcbiAgICAgICAgICAgIC8vIGZvcmNlIGEgcHJvcGVydHkgY2hhbmdlIGV2ZW50XHJcbiAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5ub3RpZnlQcm9wZXJ0eUNoYW5nZSgnYm9va21hcmtzT3BlbicsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGF5b3V0TG9hZGVkKGFyZ3MpIHtcclxuICAgIGxheW91dCA9IGFyZ3Mub2JqZWN0XHJcbiAgICBpZiAobGF5b3V0Lmlvcykge1xyXG4gICAgICAgIGxheW91dC5pb3MubGF5ZXIubWFza3NUb0JvdW5kcyA9IGZhbHNlO1xyXG4gICAgfVxyXG4gICAgYXBwVmlld01vZGVsLnNldFJlYWR5KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMb2FkZWQoYXJncykge1xyXG4gICAgaGVhZGVyVmlldyA9IGFyZ3Mub2JqZWN0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2VhcmNoQmFyTG9hZGVkKGFyZ3MpIHtcclxuICAgIHNlYXJjaEJhciA9IGFyZ3Mub2JqZWN0O1xyXG5cclxuICAgIGlmIChpc0ZpcnN0TG9hZCkge1xyXG4gICAgICAgIHNlYXJjaEJhci5vbihTZWFyY2hCYXIuc3VibWl0RXZlbnQsICgpID0+IHtcclxuICAgICAgICAgICAgLy9sZXQgdXJsU3RyaW5nID0gc2VhcmNoQmFyLnRleHQ7XHJcbiAgICAgICAgICAgIC8vbGV0IHVybFN0cmluZyA9IFwifi9jb21wb25lbnRzL3VzZXJpbnRlcmZhY2UvaW5kZXguaHRtbFwiO1xyXG4gICAgICAgICAgICBsZXQgdXJsU3RyaW5nID0gXCJodHRwOi8vMjAwLjEyNi4yMy42MzoxMzM3L3Z1Zm9yaWEvaW5kZXguaHRtbFwiO1xyXG5cclxuICAgICAgICAgICAgLy8gQWxsb3dzIHBhZ2UgcmVsb2FkIGJ5IGNsaWNraW5nIHN1Ym1pdCBvbiB0aGUgdXJsIGJhclxyXG4gICAgICAgICAgICBpZiAodXJsU3RyaW5nID09IFwiXCIpIHVybFN0cmluZyA9IGFwcFZpZXdNb2RlbC5jdXJyZW50VXJpIHx8IFwiXCI7XHJcblxyXG4gICAgICAgICAgICBpZiAodXJsU3RyaW5nLmluY2x1ZGVzKFwiIFwiKSB8fCAhdXJsU3RyaW5nLmluY2x1ZGVzKFwiLlwiKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gcXVlcmllcyB3aXRoIHNwYWNlcyBvciBzaW5nbGUgd29yZHMgd2l0aG91dCBkb3RzIGdvIHRvIGdvb2dsZSBzZWFyY2hcclxuICAgICAgICAgICAgICAgIHVybFN0cmluZyA9IFwiaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1cIiArIGVuY29kZVVSSSh1cmxTdHJpbmcpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodXJsU3RyaW5nLmluZGV4T2YoJy8vJykgPT09IC0xKSB1cmxTdHJpbmcgPSAnLy8nICsgdXJsU3RyaW5nO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgdXJsID0gVVJJKHVybFN0cmluZyk7XHJcbiAgICAgICAgICAgIC8qaWYgKHVybC5wcm90b2NvbCgpICE9PSBcImh0dHBcIiAmJiB1cmwucHJvdG9jb2woKSAhPT0gXCJodHRwc1wiKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwucHJvdG9jb2woXCJodHRwc1wiKTtcclxuICAgICAgICAgICAgfSovXHJcbiAgICAgICAgICAgIHNldFNlYXJjaEJhclRleHQodXJsLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAvL2FwcFZpZXdNb2RlbC5sb2FkVXJsKFwifi9jb21wb25lbnRzL3VzZXJpbnRlcmZhY2UvaW5kZXguaHRtbFwiKTtcclxuICAgICAgICAgICAgLy9hcHBWaWV3TW9kZWwubG9hZFVybChcImh0dHA6Ly8yMDAuMTI2LjIzLjYzOjEzMzcvdnVmb3JpYS9pbmRleC5odG1sXCIpO1xyXG4gICAgICAgICAgICAvL2FwcFZpZXdNb2RlbC5sb2FkVXJsKHVybC50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgYXBwVmlld01vZGVsLmhpZGVCb29rbWFya3MoKTtcclxuICAgICAgICAgICAgYXBwVmlld01vZGVsLmhpZGVSZWFsaXR5Q2hvb3NlcigpO1xyXG4gICAgICAgICAgICBhcHBWaWV3TW9kZWwuaGlkZUNhbmNlbEJ1dHRvbigpO1xyXG4gICAgICAgICAgICBib29rbWFya3MuZmlsdGVyQ29udHJvbC5zZXQoJ3Nob3dGaWx0ZXJlZFJlc3VsdHMnLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIGJsdXJTZWFyY2hCYXIoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYXBwbGljYXRpb24uaW9zKSB7XHJcbiAgICAgICAgaW9zU2VhcmNoQmFyQ29udHJvbGxlciA9IG5ldyBJT1NTZWFyY2hCYXJDb250cm9sbGVyKHNlYXJjaEJhcik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGFwcGxpY2F0aW9uLmFuZHJvaWQpIHtcclxuICAgICAgICBhbmRyb2lkU2VhcmNoQmFyQ29udHJvbGxlciA9IG5ldyBBbmRyb2lkU2VhcmNoQmFyQ29udHJvbGxlcihzZWFyY2hCYXIpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRTZWFyY2hCYXJUZXh0KHVybDpzdHJpbmcpIHtcclxuICAgIGlmIChpb3NTZWFyY2hCYXJDb250cm9sbGVyKSB7XHJcbiAgICAgICAgaW9zU2VhcmNoQmFyQ29udHJvbGxlci5zZXRUZXh0KHVybCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGFuZHJvaWRTZWFyY2hCYXJDb250cm9sbGVyLnNldFRleHQodXJsKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gYmx1clNlYXJjaEJhcigpIHtcclxuICAgIHNlYXJjaEJhci5kaXNtaXNzU29mdElucHV0KCk7XHJcbiAgICBpZiAoc2VhcmNoQmFyLmFuZHJvaWQpIHtcclxuICAgICAgICBzZWFyY2hCYXIuYW5kcm9pZC5jbGVhckZvY3VzKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBicm93c2VyVmlld0xvYWRlZChhcmdzKSB7XHJcbiAgICBicm93c2VyVmlldyA9IGFyZ3Mub2JqZWN0O1xyXG5cclxuICAgIGlmIChpc0ZpcnN0TG9hZCkge1xyXG4gICAgICAgIGFwcFZpZXdNb2RlbC5vbihBcHBWaWV3TW9kZWwubG9hZFVybEV2ZW50LCAoZGF0YTpMb2FkVXJsRXZlbnREYXRhKT0+e1xyXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBkYXRhLnVybDtcclxuICAgICAgICAgICAgLy9jb25zdCB1cmwgPSBcIn4vY29tcG9uZW50cy91c2VyaW50ZXJmYWNlL2luZGV4Lmh0bWxcIjtcclxuICAgICAgICAgICAgLy9jb25zdCB1cmwgPSBcImh0dHA6Ly8yMDAuMTI2LjIzLjYzOjEzMzcvdnVmb3JpYS9pbmRleC5odG1sXCI7XHJcbiAgICAgICAgICAgIC8vY29uc3QgdXJsID0gXCJodHRwczovL3NhbXBsZXMuYXJnb25qcy5pby9pbmRleC5odG1sXCI7XHJcbiBcclxuICAgICAgICAgICAgaWYgKCFkYXRhLm5ld0xheWVyIHx8ICBcclxuICAgICAgICAgICAgICAgIChicm93c2VyVmlldy5mb2N1c3NlZExheWVyICYmXHJcbiAgICAgICAgICAgICAgICBicm93c2VyVmlldy5mb2N1c3NlZExheWVyICE9PSBicm93c2VyVmlldy5yZWFsaXR5TGF5ZXIgJiZcclxuICAgICAgICAgICAgICAgICFicm93c2VyVmlldy5mb2N1c3NlZExheWVyLmRldGFpbHMudXJpKSkge1xyXG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcubG9hZFVybCh1cmwpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGJyb3dzZXJWaWV3LmFkZExheWVyKCk7XHJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LnNldEZvY3Vzc2VkTGF5ZXIobGF5ZXIpO1xyXG4gICAgICAgICAgICBicm93c2VyVmlldy5sb2FkVXJsKHVybCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMb2FkaW5nIHVybDogJyArIHVybCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2V0dXAgdGhlIGRlYnVnIHZpZXdcclxuICAgIGxldCBkZWJ1ZzpIdG1sVmlldyA9IDxIdG1sVmlldz5icm93c2VyVmlldy5wYWdlLmdldFZpZXdCeUlkKFwiZGVidWdcIik7XHJcbiAgICBkZWJ1Zy5ob3Jpem9udGFsQWxpZ25tZW50ID0gJ3N0cmV0Y2gnO1xyXG4gICAgZGVidWcudmVydGljYWxBbGlnbm1lbnQgPSAnc3RyZXRjaCc7XHJcbiAgICBkZWJ1Zy5iYWNrZ3JvdW5kQ29sb3IgPSBuZXcgQ29sb3IoMTUwLCAyNTUsIDI1NSwgMjU1KTtcclxuICAgIGRlYnVnLnZpc2liaWxpdHkgPSBcImNvbGxhcHNlZFwiO1xyXG4gICAgZGVidWcuaXNVc2VySW50ZXJhY3Rpb25FbmFibGVkID0gZmFsc2U7XHJcbn1cclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYm9va21hcmtzVmlld0xvYWRlZChhcmdzKSB7XHJcbiAgICBib29rbWFya3NWaWV3ID0gYXJncy5vYmplY3Q7XHJcbiAgICBib29rbWFya3NWaWV3LnNjYWxlWCA9IDAuOTtcclxuICAgIGJvb2ttYXJrc1ZpZXcuc2NhbGVZID0gMC45O1xyXG4gICAgYm9va21hcmtzVmlldy5vcGFjaXR5ID0gMDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWxpdHlDaG9vc2VyTG9hZGVkKGFyZ3MpIHtcclxuICAgIHJlYWxpdHlDaG9vc2VyVmlldyA9IGFyZ3Mub2JqZWN0O1xyXG4gICAgcmVhbGl0eUNob29zZXJWaWV3LnNjYWxlWCA9IDAuOTtcclxuICAgIHJlYWxpdHlDaG9vc2VyVmlldy5zY2FsZVkgPSAwLjk7XHJcbiAgICByZWFsaXR5Q2hvb3NlclZpZXcub3BhY2l0eSA9IDA7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB0b3VjaE92ZXJsYXlMb2FkZWQoYXJncykge1xyXG4gICAgdG91Y2hPdmVybGF5VmlldyA9IGFyZ3Mub2JqZWN0O1xyXG59XHJcblxyXG4vLyBpbml0aWFsaXplIHNvbWUgcHJvcGVydGllcyBvZiB0aGUgbWVudSBzbyB0aGF0IGFuaW1hdGlvbnMgd2lsbCByZW5kZXIgY29ycmVjdGx5XHJcbmV4cG9ydCBmdW5jdGlvbiBtZW51TG9hZGVkKGFyZ3MpIHtcclxuICAgIG1lbnVWaWV3ID0gYXJncy5vYmplY3Q7XHJcbiAgICBtZW51Vmlldy5vcmlnaW5YID0gMTtcclxuICAgIG1lbnVWaWV3Lm9yaWdpblkgPSAwO1xyXG4gICAgbWVudVZpZXcuc2NhbGVYID0gMDtcclxuICAgIG1lbnVWaWV3LnNjYWxlWSA9IDA7XHJcbiAgICBtZW51Vmlldy5vcGFjaXR5ID0gMDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBlcm1pc3Npb25NZW51TG9hZGVkKGFyZ3MpIHtcclxuICAgIHBlcm1pc3Npb25NZW51VmlldyA9IGFyZ3Mub2JqZWN0O1xyXG4gICAgcGVybWlzc2lvbk1lbnVWaWV3Lm9yaWdpblggPSAwO1xyXG4gICAgcGVybWlzc2lvbk1lbnVWaWV3Lm9yaWdpblkgPSAwO1xyXG4gICAgcGVybWlzc2lvbk1lbnVWaWV3LnNjYWxlWCA9IDA7XHJcbiAgICBwZXJtaXNzaW9uTWVudVZpZXcuc2NhbGVZID0gMDtcclxuICAgIHBlcm1pc3Npb25NZW51Vmlldy5vcGFjaXR5ID0gMDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9uU2VhcmNoQmFyVGFwKGFyZ3MpIHtcclxuICAgIGFwcFZpZXdNb2RlbC5zaG93Qm9va21hcmtzKCk7XHJcbiAgICBhcHBWaWV3TW9kZWwuc2hvd0NhbmNlbEJ1dHRvbigpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25DYW5jZWwoYXJncykge1xyXG4gICAgaWYgKCEhYXBwVmlld01vZGVsLmxheWVyRGV0YWlscy51cmkpIGFwcFZpZXdNb2RlbC5oaWRlQm9va21hcmtzKCk7XHJcbiAgICBhcHBWaWV3TW9kZWwuaGlkZVJlYWxpdHlDaG9vc2VyKCk7XHJcbiAgICBhcHBWaWV3TW9kZWwuaGlkZUNhbmNlbEJ1dHRvbigpO1xyXG4gICAgYmx1clNlYXJjaEJhcigpO1xyXG4gICAgc2V0U2VhcmNoQmFyVGV4dChhcHBWaWV3TW9kZWwuY3VycmVudFVyaSB8fCAnJyk7XHJcbiAgICBib29rbWFya3MuZmlsdGVyQ29udHJvbC5zZXQoJ3Nob3dGaWx0ZXJlZFJlc3VsdHMnLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvbkFkZENoYW5uZWwoYXJncykge1xyXG4gICAgYnJvd3NlclZpZXcuYWRkTGF5ZXIoKTtcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlTWVudSgpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVQZXJtaXNzaW9uTWVudSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25SZWxvYWQoYXJncykge1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVNZW51KCk7XHJcbiAgICBicm93c2VyVmlldy5mb2N1c3NlZExheWVyICYmIFxyXG4gICAgICAgIGJyb3dzZXJWaWV3LmZvY3Vzc2VkTGF5ZXIud2ViVmlldyAmJiBcclxuICAgICAgICBicm93c2VyVmlldy5mb2N1c3NlZExheWVyLndlYlZpZXcucmVsb2FkKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvbkZhdm9yaXRlVG9nZ2xlKGFyZ3MpIHtcclxuICAgIGNvbnN0IHVybCA9IGFwcFZpZXdNb2RlbC5sYXllckRldGFpbHMudXJpO1xyXG4gICAgY29uc3QgYm9va21hcmtJdGVtID0gYm9va21hcmtzLmZhdm9yaXRlTWFwLmdldCh1cmwpO1xyXG4gICAgaWYgKCFib29rbWFya0l0ZW0pIHtcclxuICAgICAgICBib29rbWFya3MuZmF2b3JpdGVMaXN0LnB1c2gobmV3IGJvb2ttYXJrcy5Cb29rbWFya0l0ZW0oe1xyXG4gICAgICAgICAgICB1cmk6IHVybCxcclxuICAgICAgICAgICAgdGl0bGU6IGFwcFZpZXdNb2RlbC5sYXllckRldGFpbHMudGl0bGVcclxuICAgICAgICB9KSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBpID0gYm9va21hcmtzLmZhdm9yaXRlTGlzdC5pbmRleE9mKGJvb2ttYXJrSXRlbSk7XHJcbiAgICAgICAgYm9va21hcmtzLmZhdm9yaXRlTGlzdC5zcGxpY2UoaSwxKTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9uSW50ZXJhY3Rpb25Ub2dnbGUoYXJncykge1xyXG4gICAgYXBwVmlld01vZGVsLnRvZ2dsZUludGVyYWN0aW9uTW9kZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25PdmVydmlldyhhcmdzKSB7XHJcbiAgICBhcHBWaWV3TW9kZWwudG9nZ2xlT3ZlcnZpZXcoKTtcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlTWVudSgpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVQZXJtaXNzaW9uTWVudSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25NZW51KGFyZ3MpIHtcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlUGVybWlzc2lvbk1lbnUoKTtcclxuICAgIGFwcFZpZXdNb2RlbC50b2dnbGVNZW51KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvblNlbGVjdFJlYWxpdHkoYXJncykge1xyXG4gICAgYXBwVmlld01vZGVsLnNob3dSZWFsaXR5Q2hvb3NlcigpO1xyXG4gICAgYXBwVmlld01vZGVsLnNob3dDYW5jZWxCdXR0b24oKTtcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlTWVudSgpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVQZXJtaXNzaW9uTWVudSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25TZXR0aW5ncyhhcmdzKSB7XHJcbiAgICAvL2NvZGUgdG8gb3BlbiB0aGUgc2V0dGluZ3MgdmlldyBnb2VzIGhlcmVcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlTWVudSgpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVQZXJtaXNzaW9uTWVudSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25WaWV3ZXJUb2dnbGUoYXJncykge1xyXG4gICAgYXBwVmlld01vZGVsLnRvZ2dsZVZpZXdlcigpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVNZW51KCk7XHJcbiAgICBhcHBWaWV3TW9kZWwuaGlkZVBlcm1pc3Npb25NZW51KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvbkRlYnVnVG9nZ2xlKGFyZ3MpIHtcclxuICAgIGFwcFZpZXdNb2RlbC50b2dnbGVEZWJ1ZygpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25Mb2NhdGlvblBlcm1pc3Npb25JY29uKGFyZ3MpIHtcclxuICAgIGFwcFZpZXdNb2RlbC50b2dnbGVQZXJtaXNzaW9uTWVudSgnZ2VvbG9jYXRpb24nKTtcclxuICAgIGFwcFZpZXdNb2RlbC5oaWRlTWVudSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb25DYW1lcmFQZXJtaXNzaW9uSWNvbihhcmdzKSB7XHJcbiAgICBhcHBWaWV3TW9kZWwudG9nZ2xlUGVybWlzc2lvbk1lbnUoJ2NhbWVyYScpO1xyXG4gICAgYXBwVmlld01vZGVsLmhpZGVNZW51KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvblBlcm1pc3Npb25JY29uTWVudUNoYW5nZVRhcChhcmdzKSB7XHJcbiAgICBhcHBWaWV3TW9kZWwuY2hhbmdlUGVybWlzc2lvbnMoKTsgLy91bnN1YnNjcmliZSBvciBzdWJzY3JpYmUgcGVybWlzc2lvblxyXG59XHJcblxyXG5jbGFzcyBJT1NTZWFyY2hCYXJDb250cm9sbGVyIHtcclxuXHJcbiAgICBwcml2YXRlIHVpU2VhcmNoQmFyOlVJU2VhcmNoQmFyO1xyXG4gICAgcHJpdmF0ZSB0ZXh0RmllbGQ6VUlUZXh0RmllbGQ7XHJcblxyXG4gICAgY29uc3RydWN0b3IocHVibGljIHNlYXJjaEJhcjpTZWFyY2hCYXIpIHtcclxuICAgICAgICB0aGlzLnVpU2VhcmNoQmFyID0gc2VhcmNoQmFyLmlvcztcclxuICAgICAgICB0aGlzLnRleHRGaWVsZCA9IHRoaXMudWlTZWFyY2hCYXIudmFsdWVGb3JLZXkoXCJzZWFyY2hGaWVsZFwiKTtcclxuXHJcbiAgICAgICAgdGhpcy51aVNlYXJjaEJhci5rZXlib2FyZFR5cGUgPSBVSUtleWJvYXJkVHlwZS5XZWJTZWFyY2g7XHJcbiAgICAgICAgdGhpcy51aVNlYXJjaEJhci5hdXRvY2FwaXRhbGl6YXRpb25UeXBlID0gVUlUZXh0QXV0b2NhcGl0YWxpemF0aW9uVHlwZS5Ob25lO1xyXG4gICAgICAgIHRoaXMudWlTZWFyY2hCYXIuc2VhcmNoQmFyU3R5bGUgPSBVSVNlYXJjaEJhclN0eWxlLk1pbmltYWw7XHJcbiAgICAgICAgdGhpcy51aVNlYXJjaEJhci5yZXR1cm5LZXlUeXBlID0gVUlSZXR1cm5LZXlUeXBlLkdvO1xyXG4gICAgICAgIHRoaXMudWlTZWFyY2hCYXIuc2V0SW1hZ2VGb3JTZWFyY2hCYXJJY29uU3RhdGUoVUlJbWFnZS5uZXcoKSwgVUlTZWFyY2hCYXJJY29uLlNlYXJjaCwgVUlDb250cm9sU3RhdGUuTm9ybWFsKVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMudGV4dEZpZWxkLmxlZnRWaWV3TW9kZSA9IFVJVGV4dEZpZWxkVmlld01vZGUuTmV2ZXI7XHJcblxyXG4gICAgICAgIGNvbnN0IHRleHRGaWVsZEVkaXRIYW5kbGVyID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBhcHBWaWV3TW9kZWwuaGlkZU1lbnUoKTtcclxuICAgICAgICAgICAgYXBwVmlld01vZGVsLmhpZGVQZXJtaXNzaW9uTWVudSgpO1xyXG4gICAgICAgICAgICBpZiAodXRpbHMuaW9zLmdldHRlcihVSVJlc3BvbmRlciwgdGhpcy51aVNlYXJjaEJhci5pc0ZpcnN0UmVzcG9uZGVyKSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGJyb3dzZXJWaWV3LmZvY3Vzc2VkTGF5ZXIgPT09IGJyb3dzZXJWaWV3LnJlYWxpdHlMYXllcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93UmVhbGl0eUNob29zZXIoKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXBwVmlld01vZGVsLnNob3dCb29rbWFya3MoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93Q2FuY2VsQnV0dG9uKCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCk9PntcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy51aVNlYXJjaEJhci50ZXh0ID09PSBcIlwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudWlTZWFyY2hCYXIudGV4dCA9IGFwcFZpZXdNb2RlbC5sYXllckRldGFpbHMudXJpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFBsYWNlaG9sZGVyVGV4dChcIlwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0RmllbGQuc2VsZWN0ZWRUZXh0UmFuZ2UgPSB0aGlzLnRleHRGaWVsZC50ZXh0UmFuZ2VGcm9tUG9zaXRpb25Ub1Bvc2l0aW9uKHRoaXMudGV4dEZpZWxkLmJlZ2lubmluZ09mRG9jdW1lbnQsIHRoaXMudGV4dEZpZWxkLmVuZE9mRG9jdW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIDUwMClcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbGF5b3V0Lm9uKEdlc3R1cmVUeXBlcy50b3VjaCwoKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgIGJsdXJTZWFyY2hCYXIoKTtcclxuICAgICAgICAgICAgICAgICAgICBsYXlvdXQub2ZmKEdlc3R1cmVUeXBlcy50b3VjaCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBWaWV3TW9kZWwubGF5ZXJEZXRhaWxzLnVyaSkgYXBwVmlld01vZGVsLmhpZGVDYW5jZWxCdXR0b24oKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy90aGlzLnNldFBsYWNlaG9sZGVyVGV4dChhcHBWaWV3TW9kZWwubGF5ZXJEZXRhaWxzLnVyaSk7XHJcbiAgICAgICAgICAgICAgICAvL3RoaXMudWlTZWFyY2hCYXIudGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHRleHRGaWVsZENoYW5nZUhhbmRsZXIgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGJvb2ttYXJrcy5maWx0ZXJCb29rbWFya3ModGhpcy51aVNlYXJjaEJhci50ZXh0LnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICBib29rbWFya3MuZmlsdGVyQ29udHJvbC5zZXQoJ3Nob3dGaWx0ZXJlZFJlc3VsdHMnLCB0aGlzLnVpU2VhcmNoQmFyLnRleHQubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhcHBsaWNhdGlvbi5pb3MuYWRkTm90aWZpY2F0aW9uT2JzZXJ2ZXIoVUlUZXh0RmllbGRUZXh0RGlkQmVnaW5FZGl0aW5nTm90aWZpY2F0aW9uLCB0ZXh0RmllbGRFZGl0SGFuZGxlcik7XHJcbiAgICAgICAgYXBwbGljYXRpb24uaW9zLmFkZE5vdGlmaWNhdGlvbk9ic2VydmVyKFVJVGV4dEZpZWxkVGV4dERpZEVuZEVkaXRpbmdOb3RpZmljYXRpb24sIHRleHRGaWVsZEVkaXRIYW5kbGVyKTtcclxuICAgICAgICBhcHBsaWNhdGlvbi5pb3MuYWRkTm90aWZpY2F0aW9uT2JzZXJ2ZXIoVUlUZXh0RmllbGRUZXh0RGlkQ2hhbmdlTm90aWZpY2F0aW9uLCB0ZXh0RmllbGRDaGFuZ2VIYW5kbGVyKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHNldFBsYWNlaG9sZGVyVGV4dCh0ZXh0OnN0cmluZykge1xyXG4gICAgICAgIGlmICh0ZXh0KSB7XHJcbiAgICAgICAgICAgIHZhciBhdHRyaWJ1dGVzOiBOU011dGFibGVEaWN0aW9uYXJ5PHN0cmluZyxhbnk+ID0gTlNNdXRhYmxlRGljdGlvbmFyeS5uZXc8c3RyaW5nLGFueT4oKS5pbml0KCk7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMuc2V0T2JqZWN0Rm9yS2V5KHV0aWxzLmlvcy5nZXR0ZXIoVUlDb2xvcixVSUNvbG9yLmJsYWNrQ29sb3IpLCBOU0ZvcmVncm91bmRDb2xvckF0dHJpYnV0ZU5hbWUpO1xyXG4gICAgICAgICAgICB0aGlzLnRleHRGaWVsZC5hdHRyaWJ1dGVkUGxhY2Vob2xkZXIgPSBOU0F0dHJpYnV0ZWRTdHJpbmcuYWxsb2MoKS5pbml0V2l0aFN0cmluZ0F0dHJpYnV0ZXModGV4dCwgYXR0cmlidXRlcyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy50ZXh0RmllbGQucGxhY2Vob2xkZXIgPSBzZWFyY2hCYXIuaGludDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHNldFRleHQodXJsKSB7XHJcbiAgICAgICAgaWYgKCF1dGlscy5pb3MuZ2V0dGVyKFVJUmVzcG9uZGVyLCB0aGlzLnVpU2VhcmNoQmFyLmlzRmlyc3RSZXNwb25kZXIpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0UGxhY2Vob2xkZXJUZXh0KHVybCk7XHJcbiAgICAgICAgICAgIHRoaXMudWlTZWFyY2hCYXIudGV4dCA9IFwiXCI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy51aVNlYXJjaEJhci50ZXh0ID0gdXJsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuY2xhc3MgQW5kcm9pZFNlYXJjaEJhckNvbnRyb2xsZXIge1xyXG5cclxuICAgIHByaXZhdGUgc2VhcmNoVmlldzphbmRyb2lkLndpZGdldC5TZWFyY2hWaWV3O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHB1YmxpYyBzZWFyY2hCYXI6U2VhcmNoQmFyKSB7XHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3ID0gc2VhcmNoQmFyLmFuZHJvaWQ7XHJcblxyXG4gICAgICAgIHRoaXMuc2VhcmNoVmlldy5zZXRJbnB1dFR5cGUoYW5kcm9pZC50ZXh0LklucHV0VHlwZS5UWVBFX0NMQVNTX1RFWFQgfCBhbmRyb2lkLnRleHQuSW5wdXRUeXBlLlRZUEVfVEVYVF9WQVJJQVRJT05fVVJJIHwgYW5kcm9pZC50ZXh0LklucHV0VHlwZS5UWVBFX1RFWFRfRkxBR19OT19TVUdHRVNUSU9OUyk7XHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3LnNldEltZU9wdGlvbnMoYW5kcm9pZC52aWV3LmlucHV0bWV0aG9kLkVkaXRvckluZm8uSU1FX0FDVElPTl9HTyk7XHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3LmNsZWFyRm9jdXMoKTtcclxuXHJcbiAgICAgICAgY29uc3QgZm9jdXNIYW5kbGVyID0gbmV3IGFuZHJvaWQudmlldy5WaWV3Lk9uRm9jdXNDaGFuZ2VMaXN0ZW5lcih7XHJcbiAgICAgICAgICAgIG9uRm9jdXNDaGFuZ2UodjogYW5kcm9pZC52aWV3LlZpZXcsIGhhc0ZvY3VzOiBib29sZWFuKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzRm9jdXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYnJvd3NlclZpZXcuZm9jdXNzZWRMYXllciA9PT0gYnJvd3NlclZpZXcucmVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93UmVhbGl0eUNob29zZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBib29rbWFya3MuZmlsdGVyQ29udHJvbC5zZXQoJ3Nob3dGaWx0ZXJlZFJlc3VsdHMnLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93Qm9va21hcmtzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGFwcFZpZXdNb2RlbC5zaG93Q2FuY2VsQnV0dG9uKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3LnNldE9uUXVlcnlUZXh0Rm9jdXNDaGFuZ2VMaXN0ZW5lcihmb2N1c0hhbmRsZXIpO1xyXG5cclxuICAgICAgICAvLyB0aGUgbmF0aXZlc2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIE9uUXVlcnlUZXh0TGlzdGVuZXIgZG9lcyBub3QgY29ycmVjdGx5IGhhbmRsZSB0aGUgZm9sbG93aW5nIGNhc2U6XHJcbiAgICAgICAgLy8gMSkgYW4gZXh0ZXJuYWwgZXZlbnQgdXBkYXRlcyB0aGUgcXVlcnkgdGV4dCAoZS5nLiB0aGUgdXNlciBjbGlja2VkIGEgbGluayBvbiBhIHBhZ2UpXHJcbiAgICAgICAgLy8gMikgdGhlIHVzZXIgYXR0ZW1wdHMgdG8gbmF2aWdhdGUgYmFjayB0byB0aGUgcHJldmlvdXMgcGFnZSBieSB1cGRhdGluZyB0aGUgc2VhcmNoIGJhciB0ZXh0XHJcbiAgICAgICAgLy8gMykgbmF0aXZlc2NyaXB0IHNlZXMgdGhpcyBhcyBzdWJtaXR0aW5nIHRoZSBzYW1lIHF1ZXJ5IGFuZCB0cmVhdHMgaXQgYXMgYSBuby1vcFxyXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9OYXRpdmVTY3JpcHQvTmF0aXZlU2NyaXB0L2lzc3Vlcy8zOTY1XHJcbiAgICAgICAgY29uc3Qgc2VhcmNoSGFuZGxlciA9IG5ldyBhbmRyb2lkLndpZGdldC5TZWFyY2hWaWV3Lk9uUXVlcnlUZXh0TGlzdGVuZXIoe1xyXG4gICAgICAgICAgICBvblF1ZXJ5VGV4dENoYW5nZShuZXdUZXh0OiBTdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICAgICAgICAgIHNlYXJjaEJhci5fb25Qcm9wZXJ0eUNoYW5nZWRGcm9tTmF0aXZlKFNlYXJjaEJhci50ZXh0UHJvcGVydHksIG5ld1RleHQpO1xyXG4gICAgICAgICAgICAgICAgYm9va21hcmtzLmZpbHRlckJvb2ttYXJrcyhuZXdUZXh0LnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgYm9va21hcmtzLmZpbHRlckNvbnRyb2wuc2V0KCdzaG93RmlsdGVyZWRSZXN1bHRzJywgbmV3VGV4dC5sZW5ndGggPiAwKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgb25RdWVyeVRleHRTdWJtaXQocXVlcnk6IFN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgICAgICAgICAgc2VhcmNoQmFyLm5vdGlmeSg8RXZlbnREYXRhPntcclxuICAgICAgICAgICAgICAgICAgICBldmVudE5hbWU6IFNlYXJjaEJhci5zdWJtaXRFdmVudCxcclxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IHRoaXNcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3LnNldE9uUXVlcnlUZXh0TGlzdGVuZXIoc2VhcmNoSGFuZGxlcik7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHNldFRleHQodXJsKSB7XHJcbiAgICAgICAgdGhpcy5zZWFyY2hWaWV3LnNldFF1ZXJ5KHVybCwgZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==