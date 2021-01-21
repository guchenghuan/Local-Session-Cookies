var showContextMenu = undefined;

updateCallback = function () {
    if (showContextMenu !== preferences.showContextMenu) {
        showContextMenu = preferences.showContextMenu;
        setContextMenu(showContextMenu);
    }
    setHolidayIcon();
};

setHolidayIcon();
setInterval(setHolidayIcon, 60 * 60 * 1000); //Every hour

//Every time the browser restarts the first time the user goes to the options he ends up in the default page (support)
localStorage.setItem("option_panel", "null");

var currentVersion = chrome.runtime.getManifest().version;
var oldVersion = data.lastVersionRun;

data.lastVersionRun = currentVersion;

if (false && oldVersion !== currentVersion) {
    if (oldVersion === undefined) { //Is firstrun
        chrome.tabs.create({ url: 'http://www.editthiscookie.com/start/' });
    } else {
        chrome.notifications.onClicked.addListener(function (notificationId) {
            chrome.tabs.create({
                url: 'http://www.editthiscookie.com/changelog/'
            });
            chrome.notifications.clear(notificationId, function (wasCleared) { });
        });
        var opt = {
            type: "basic",
            title: "EditThisCookie",
            message: _getMessage("updated"),
            iconUrl: "/img/icon_128x128.png",
            isClickable: true
        };
        chrome.notifications.create("", opt, function (notificationId) {
        });
    }
}

setContextMenu(preferences.showContextMenu);

chrome.cookies.onChanged.addListener(function (changeInfo) {
    var removed = changeInfo.removed;
    var cookie = changeInfo.cookie;
    var cause = changeInfo.cause;

    var name = cookie.name;
    var domain = cookie.domain;
    var value = cookie.value;

    if (cause === "expired" || cause === "evicted")
        return;

    for (var i = 0; i < data.readOnly.length; i++) {
        var currentRORule = data.readOnly[i];
        if (compareCookies(cookie, currentRORule)) {
            if (removed) {
                chrome.cookies.get({
                    'url': "http" + ((currentRORule.secure) ? "s" : "") + "://" + currentRORule.domain + currentRORule.path,
                    'name': currentRORule.name,
                    'storeId': currentRORule.storeId
                }, function (currentCookie) {
                    if (compareCookies(currentCookie, currentRORule))
                        return;
                    var newCookie = cookieForCreationFromFullCookie(currentRORule);
                    chrome.cookies.set(newCookie);
                    ++data.nCookiesProtected;
                });
            }
            return;
        }
    }

    // Check if a blocked cookie was added
    if (!removed) {
        for (var i = 0; i < data.filters.length; i++) {
            var currentFilter = data.filters[i];
            if (filterMatchesCookie(currentFilter, name, domain, value)) {
                chrome.tabs.query(
                    { active: true },
                    function (tabs) {
                        var url = tabs[0].url;
                        var toRemove = {};
                        toRemove.url = url;
                        toRemove.url = "http" + ((cookie.secure) ? "s" : "") + "://" + cookie.domain + cookie.path;
                        toRemove.name = name;
                        chrome.cookies.remove(toRemove);
                        ++data.nCookiesFlagged;
                    });
            }
        }
    }

    if (!removed && preferences.useMaxCookieAge && preferences.maxCookieAgeType > 0) {	//Check expiration, if too far in the future shorten on user's preference
        var maxAllowedExpiration = Math.round((new Date).getTime() / 1000) + (preferences.maxCookieAge * preferences.maxCookieAgeType);
        if (cookie.expirationDate !== undefined && cookie.expirationDate > maxAllowedExpiration + 60) {
            var newCookie = cookieForCreationFromFullCookie(cookie);
            if (!cookie.session)
                newCookie.expirationDate = maxAllowedExpiration;
            chrome.cookies.set(newCookie);
            ++data.nCookiesShortened;
        }
    }
});

// Use new API to delete SET-COOKIE headers as requested by users
chrome.webRequest.onHeadersReceived.addListener(
    function (details) {
        headersToForward = [];
        if (details.responseHeaders !== undefined) {
            headersChanged = false;
            for (var i = 0; i < details.responseHeaders.length; i++) {
                cH = details.responseHeaders[i];
                if (cH.name.toUpperCase() != "SET-COOKIE") {
                    headersToForward.push(cH);
                    continue;
                }

                fields = cH.value.split(';');

                var cookieName = undefined;
                var cookieDomain = undefined;
                var cookieValue = undefined;

                if (fields.length > 0) {
                    cookieName = fields[0].split('=')[0]
                    cookieValue = fields[0].split('=')[1]
                }

                for (var x = 1; x < fields.length; x++) {
                    if (fields[x].split('=')[0].trim() == "domain") {
                        cookieDomain = fields[x].split('=')[1];
                        break;
                    }
                }

                if (cookieName !== undefined && cookieDomain !== undefined && cookieValue !== undefined) {
                    var forwardHeader = true;
                    for (var x = 0; x < data.filters.length; x++) {
                        if (filterMatchesCookie(data.filters[x], cookieName, cookieDomain, cookieValue)) {
                            forwardHeader = false;
                            break;
                        }
                    }

                    if (forwardHeader) {
                        headersToForward.push(cH);
                    }
                    else {
                        // Do not add current set-cookie to headers. This cookie was flagged as blocked
                        headersChanged = true;
                    }
                }
            }
        }

        if (headersChanged) {
            return { responseHeaders: headersToForward };
        }
        else {
            return {};
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders", "extraHeaders"]
);

function setContextMenu(show) {
    chrome.contextMenus.removeAll();
    if (show) {
        chrome.contextMenus.create({
            "title": "EditThisCookie",
            "contexts": ["page"],
            "onclick": function (info, tab) {
                showPopup(info, tab);
            }
        });
    }
}

function setHolidayIcon() {
    if (isChristmasPeriod() && preferences.showChristmasIcon) {
        chrome.browserAction.setIcon({ "path": "/img/16x16.png" });
        // } else if (isHalloweenPeriod() && preferences.showChristmasIcon) {
        //     chrome.browserAction.setIcon({ "path": "/img/icon_halloween_19x19.png" });
    } else {
        chrome.browserAction.setIcon({ "path": "/img/16x16.png" });
    }
}
