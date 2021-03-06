"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "Strings", function() {
  return Services.strings.createBundle("chrome://alwaysreader/locale/strings.properties");
});

XPCOMUtils.defineLazyModuleGetter(this, "Log", "resource://gre/modules/AndroidLog.jsm", "AndroidLog");

function log(msg) {
  Log.d("AlwaysReader", msg);
}

var AlwaysReader = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),

  init: function(window) {
    let BrowserApp = window.BrowserApp;
    
    BrowserApp.tabs.forEach(function(tab) {
      this._toggleProgressListener(tab.browser.webProgress, true);
    }, this);

    BrowserApp.deck.addEventListener("TabOpen", this, false);
    BrowserApp.deck.addEventListener("TabClose", this, false);
  },

  uninit: function(window) {
    let BrowserApp = window.BrowserApp;

    BrowserApp.tabs.forEach(function(tab) {
      this._toggleProgressListener(tab.browser.webProgress, false);
    }, this);

    BrowserApp.deck.removeEventListener("TabOpen", this, false);
    BrowserApp.deck.removeEventListener("TabClose", this, false);
  },

  handleEvent: function(evt) {
    this._toggleProgressListener(evt.target.webProgress, ("TabOpen" == evt.type));
  },

  _toggleProgressListener: function(webProgress, isAdd) {
    if (isAdd) {
      webProgress.addProgressListener(this, webProgress.NOTIFY_LOCATION);
    } else {
      try {
        webProgress.removeProgressListener(this);
      } catch (e) {
        Cu.reportError(e);
      }
    }
  },

  onLocationChange: function(webProgress, request, locationURI, flags) {
    let url = locationURI.spec;
    if (url.startsWith("about:")) {
      return;
    }

    let BrowserApp = Services.wm.getMostRecentWindow("navigator:browser").BrowserApp;
    let browser = BrowserApp.getBrowserForWindow(webProgress.DOMWindow);
    if (!browser) {
      return;
    }

    let readerUrl = "about:reader?url=" + url;

    let sessionHistory = webProgress.DOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).sessionHistory;
    let backUrl = sessionHistory.getEntryAtIndex(sessionHistory.index - 1, false).URI.spec;

    // If reader view fails, it falls back to loading the original URL. Let's avoid an infinite loop.
    if (backUrl == readerUrl) {
      return;
    }

    // If we're not at the last entry in session hisotry, check to see if the user is trying to go back
    // from a reader URL.
    if (sessionHistory.index + 1 < sessionHistory.count) {
      let forwardUrl = sessionHistory.getEntryAtIndex(sessionHistory.index + 1, false).URI.spec;
      if (forwardUrl == readerUrl) {
        browser.goBack();
        return;
      }
    }

    browser.loadURI(readerUrl);
  },

  onStateChange: function() {},
  onProgressChange: function() {},
  onStatusChange: function() {},
  onSecurityChange: function() {}
};


/**
 * bootstrap.js API
 */
var windowListener = {
  onOpenWindow: function(window) {
    // Wait for the window to finish loading
    function loadListener() {
      window.removeEventListener("load", loadListener, false);
      AlwaysReader.init(window);
    };
    window.addEventListener("load", loadListener, false);
  },

  onCloseWindow: function(window) {
  },

  onWindowTitleChange: function(window, title) {
  }
};

function startup(data, reason) {
  let window = Services.wm.getMostRecentWindow("navigator:browser");
  if (window) {
    AlwaysReader.init(window);
  }
  Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  Services.wm.removeListener(windowListener);
  AlwaysReader.uninit(Services.wm.getMostRecentWindow("navigator:browser"));
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
