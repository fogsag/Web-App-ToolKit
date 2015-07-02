
"use strict";
var navDrawerList = new WinJS.Binding.List();
var WAT;
var navBarConfig, createNavBarElement, setupNavBar, createNavBarButton, setButtonAction, initUIDeclarations,
    navDrawerInit, returnToContent, navigateBack, toggleMenu, itemInvokedHandler, disableNavDrawer, barActions, handleBarEval, handleBarNavigate, setupNestedNav, toggleNestedNav,
    barActions = {},
    backButtons = [],
    afterProcessAllActions = [];
var logger = window.console;
var _menuWidth = 300;

// Public API
var self = {
  init: function(WATRef){
    if (!WAT){
        WAT = WATRef;

        barActions = {
            back: navigateBack,
            eval: handleBarEval,
            navigate: handleBarNavigate,
            nested: true
        };

        navBarConfig = (WAT.manifest.wat_navBar || {});

        if (!navBarConfig || !navBarConfig.enabled) {
            return;
        }

        createNavBarElement();
        setupNavBar();

        // create the navbar controls from the previously created html
        new WinJS.UI.NavBar(WAT.components.navBar.parentNode);
        var container = new WinJS.UI.NavBarContainer(WAT.components.navBar);
        container.maxRows = navBarConfig.maxRows;

        WAT.components.stage.style.top = "25px";
    }
  }
};

// Private methods
createNavBarElement = function () {
    var div = document.createElement("div");
    div.id = "navBar"
    div.classList.add("customColor");

    var parent = document.createElement("div");
    parent.style.zIndex = WAT.components.webView.style.zIndex + 101;
    parent.appendChild(div);

    WAT.components.content.appendChild(parent);
    WAT.components.navBar = div;
};

setupNavBar = function () {
    var needSplitEvent = false,
        navBarEl = WAT.components.navBar;

    if (!navBarConfig.enabled || !navBarEl) {
        if (navBarEl && navBarEl.parentNode.parentNode) {
            // we have to remove the WinJS.UI.NavBar control, but the
            // "navBar" option passes in the WinJS.UI.NavBarConatiner
            navBarEl.parentNode.parentNode.removeChild(navBarEl.parentNode);
            navBarEl = null;
        }
        return;
    }

    navBarConfig.maxRows = (navBarConfig.maxRows || 1);

    // Add explicit buttons first...
    if (navBarConfig.buttons) {
        navBarConfig.buttons.forEach(function (menuItem) {
            var btn = createNavBarButton(menuItem);

            if (btn) {
                navBarEl.appendChild(btn);
            }
            if (menuItem.children && menuItem.children.length) {
                needSplitEvent = true;
            }
        });
    }

    // Then any pageElement nav requested by config...
    if (navBarConfig.pageElements && navBarConfig.pageElements.navElements) {

        WAT.components.webView.addEventListener("MSWebViewDOMContentLoaded", injectNavbarBuildingQuery);

    } else {
        // If we are not processing webview nav elements then we are ready to process the nav bar UI declarations
        initUIDeclarations();
    }

    // If there was at least one navbar item with children, set up splitt toggle event...
    if (needSplitEvent) {
        navBarEl.addEventListener("splittoggle", function (e) {
            toggleNestedNav(e.detail.navbarCommand, e.detail.opened);
        });
    }
};

createNavBarButton = function (menuItem) {
    var btn = document.createElement("div"),
        hasChildren = !!(menuItem.children && menuItem.children.length),
        options = { label: menuItem.label, icon: menuItem.icon, splitButton: hasChildren };

    btn.setAttribute("role", "menuitem");

    new WinJS.UI.NavBarCommand(btn, options);

    if (hasChildren) {
        // set up nested navigation if children are present
        setupNestedNav(menuItem, btn);
    }

    setButtonAction(btn, menuItem);

    return btn;
};

setButtonAction = function (btn, menuItem) {
    var action = menuItem.action.toLowerCase(),
        data = menuItem.data,
        handler = barActions[action];

    if (!handler) {
        // default handler is webview navigation
        handler = barActions["navigate"];
        data = menuItem.action;
    }

    if (!WAT.isFunction(handler)) {
        // This is a non-operational bar item (maybe nested nav?)
        return;
    }

    if (data === "home") {
        data = WAT.manifest.start_url;
    }

    if (action === "back") {
        backButtons.push(btn);
    }

    btn.dataset.barActionData = data;
    //handle children case
    if (menuItem.children && menuItem.children.length) {
        btn.children[0].addEventListener("click", handler);
    } else {

        btn.addEventListener("click", handler);
    }

};

initUIDeclarations = function () {
    WAT.components.navBar.parentNode.setAttribute("data-win-control", "WinJS.UI.NavBar");
    WAT.components.navBar.setAttribute("data-win-control", "WinJS.UI.NavBarContainer");
    WAT.components.navBar.setAttribute("data-win-options", "{ maxRows: " + navBarConfig.maxRows + " }");
};


disableNavDrawer = function () {
    // disabling navDrawer
    var surface = document.getElementById("surface");
    surface.style.display = "block";
    surface.style.width = "100%";
    document.getElementById("hamburger").style.display = "none";
    document.getElementById("search-box").style.display = "none";
    WAT.components.navDrawer = null;
};

    // initializing navdrawer
navDrawerInit = function () {
    document.querySelector(".header .hamburger").addEventListener("click", toggleMenu);
    document.querySelector(".content").addEventListener("click", returnToContent);
    document.querySelector(".viewport").scrollLeft = _menuWidth;
    document.addEventListener("iteminvoked", itemInvokedHandler, false);
};

    // navdrawer scroll
returnToContent = function (e) {
    var viewport = document.querySelector(".viewport");
    if (viewport.scrollLeft < _menuWidth || viewport.scrollLeft >= _menuWidth * 2) {
        viewport.msZoomTo({
            contentX: _menuWidth
        });
    }
};

    // toggles navdrawer
toggleMenu = function (e) {
    var viewport = document.querySelector(".viewport");
    var scrollPos = (viewport.scrollLeft > 0) ? 0 : _menuWidth;
    viewport.msZoomTo({
        contentX: scrollPos
    });
};

    // handles items in the navdrawer
itemInvokedHandler = function (eventObject) {
    eventObject.detail.itemPromise.done(function (invokedItem) {
        switch (invokedItem.data.action) {
            case "home":
                WAT.components.webView.navigate(WAT.manifest.start_url);
                break;
            case "eval":
                var scriptString = "(function() { " + invokedItem.data.data + " })();";
                var exec = WAT.components.webView.invokeScriptAsync("eval", scriptString);
                exec.start();
                break;
            case "back":
                WAT.components.webView.goBack();
                break;
            case "nested":
                break;
            default:
                WAT.components.webView.navigate(invokedItem.data.action);
                break;
        }
        toggleMenu();
    });
};

// app and nav bar action handlers

handleBarEval = function () {
    var scriptString, exec;

    scriptString = "(function() { " + this.dataset.barActionData + " })();";

    exec = WAT.components.webView.invokeScriptAsync("eval", scriptString);
    exec.start();
};

handleBarNavigate = function () {
    //if dataset doesn't exist, look for parent, becuse it will be a nested button assignment that is a child
    var url = (this.dataset.barActionData || this.parentNode.dataset.barActionData || WAT.manifest.start_url);
    var target = new Windows.Foundation.Uri(url);
    WAT.components.webView.navigate(target.toString());
};

setupNestedNav = function (menuItem, btn) {
    var nestedNavID = WAT.getGUID(),
        flyout = document.createElement("div"),
        nestedNavContainer = document.createElement("div");

    logger.log("Adding nested navigation on barItem: ", menuItem.label);

    flyout.setAttribute("id", nestedNavID);
    flyout.style.zIndex = WAT.components.webView.style.zIndex + 100;
    var options = {placement: 'bottom'};
    new WinJS.UI.Flyout(flyout, options);

    flyout.className += flyout.className ? ' navbar-submenu' : 'navbar-submenu';

    btn.setAttribute("data-nestednav", nestedNavID);
    new WinJS.UI.NavBarContainer(nestedNavContainer);
    nestedNavContainer.winControl.layout = "horizontal";
    nestedNavContainer.winControl.maxRows = 1;
    nestedNavContainer.classList.add("win-navbarcontainer");

    menuItem.children.forEach(function (subItem) {
        var nestedBtn = document.createElement("div");

        nestedBtn.setAttribute("role", "menuitem");

        new WinJS.UI.NavBarCommand(nestedBtn, {
            label: subItem.label,
            icon: subItem.icon
        });

        setButtonAction(nestedBtn, subItem);
        nestedNavContainer.appendChild(nestedBtn);
    });

    logger.log("Adding nested navigation UI to DOM");

    flyout.appendChild(nestedNavContainer);
    document.body.appendChild(flyout);

    afterProcessAllActions.push(function () {
        // make sure the splittoggle button (arrow) is correct
        flyout.winControl.addEventListener('beforeclose', function () {
            btn.winControl.splitOpened = false;
        });
    });
};

toggleNestedNav = function (parentNavbarCommand, opened) {
    var nestedel = document.getElementById(parentNavbarCommand.element.getAttribute("data-nestednav"));
    var nestedControl = nestedel.winControl;
    var nestedNavBarContainer = (nestedControl && nestedControl.element.querySelector('.win-navbarcontainer'));

    if (!nestedControl || !nestedNavBarContainer) {
        return;
    }

    if (opened) {
        nestedControl.show(parentNavbarCommand.element);
        // Switching the navbarcontainer from display none to display block requires
        // forceLayout in case there was a pending measure.
        nestedNavBarContainer.winControl.forceLayout();
        // Reset back to the first item.
        nestedNavBarContainer.currentIndex = 0;

    } else {
        nestedControl.hide();
    }
};

navigateBack = function (e) {
    var view = WAT.components.webView;

    if (e && e.currentTarget.getAttribute("disabled") === "disabled") {
        e.preventDefault();
        return false;
    }

    // TODO: reenable when wat_offline is implemented
    //var offlineModule = WAT.getModule("offline");
    //if (offlineModule && offlineModule.active && WAT.options.offlineView && !offlineModule.useSuperCache) {
    //    view = WAT.options.offlineView;
    //}

    //if (offlineModule && offlineModule.active && WAT.options.offlineView && offlineModule.useSuperCache && view.canGoBack) {
    //    view.style.display = "block";
    //    WAT.options.offlineView.style.display = "none";
    //    offlineModule.active = false;
    //}

    if (!view.canGoBack) {
        return false;
    }

    try {
        view.goBack();
    } catch (err) {
        return false;
    }

    if (WAT.manifest.wat_appBar && WAT.manifest.wat_appBar.enabled) {
        WAT.components.appBar.winControl.close();
    }

    if (WAT.manifest.wat_navBar && WAT.manifest.wat_navBar.enabled && WAT.environment.isWindows) {
        WAT.components.navBar.parentNode.winControl.close();
    }

    return true;
}
module.exports = self; // exports
