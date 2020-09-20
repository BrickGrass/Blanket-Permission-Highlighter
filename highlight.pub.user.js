// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      0.7
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @require      http://code.jquery.com/jquery-3.5.1.min.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @updateURL    https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @downloadURL  https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// ==/UserScript==

const _1_day_ago = Date.now() - 24 * 60 * 60 * 1000
const user_regex = /https:\/\/archiveofourown\.org\/users\/([^/]+)/;
var users = {};
var cookies_enabled = false;

const c_en = Cookies.get("bp_cookies_enabled");
if (c_en === "yes") {
    cookies_enabled = true;
}

var yes_bp = Cookies.get("yes_bp");
var no_bp = Cookies.get("no_bp");

function readCookie(cookie) {
    if (cookie === undefined) {
        return {};
    } else {
        return JSON.parse(cookie);
    }
}

function setCookie(cookie_kind, username) {
    let c = Cookies.get(`${cookie_kind}_bp`);
    c = readCookie(c);
    c[username] = Date.now();
    Cookies.set(`${cookie_kind}_bp`, JSON.stringify(c), {expires: 10});
}

yes_bp = readCookie(yes_bp);
no_bp = readCookie(no_bp);

function bp_exists(username, context, callback) {
    if (yes_bp.hasOwnProperty(username)) {
        let set = yes_bp[username];
        if (set < _1_day_ago) {
            delete yes_bp[username];
        } else {
            callback.call(context, {exists: true});
            return;
        }
    } else if (no_bp.hasOwnProperty(username)) {
        let set = no_bp[username];
        if (set < _1_day_ago) {
            delete yes_bp[username];
        } else {
            callback.call(context, false);
            return;
        }
    }

    $.ajax(
        `https://brickgrass.uk/bp_api/author_exists/${username}`,
        {context: context}
    ).done(callback).done(function(data) {
        if (cookies_enabled) {
            if (data.exists) {
                setCookie("yes", username);
            } else {
                setCookie("no", username);
            }
        }
    });
}

function bp_fetch(username, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_data/${username}`
    ).done(callback);
}

$( document ).ready(function() {
    if (c_en === undefined) {
        // No cookie set, ask user if they want to enable cookies
        let flash = $(".flash").first();
        flash.addClass("notice");
        flash.empty();
        flash.append(
            `Blanket Permission Highlighter: We use cookies! Do you wish to <a href="#" id="en_bp_cookies">enable</a> or permanently <a href="#" id="dis_bp_cookies">disable</a> cookies for this extension?`
        );

        $("#en_bp_cookies").click(function() {
            Cookies.set("bp_cookies_enabled", "yes", {expires: 365 * 10})
            cookies_enabled = true;

            flash.empty();
            flash.removeClass("notice");
        })
        $("#dis_bp_cookies").click(function() {
            Cookies.set("bp_cookies_enabled", "no", {expires: 365 * 10})

            flash.empty();
            flash.removeClass("notice");
        })
    }

    $("a").each(function() {
        let m = this.href.match(user_regex);

        if (m === null) {
            return;
        }

        if (!this.text.includes(m[1])) {
            return;
        }

        if (users.hasOwnProperty(m[1])) {
            users[m[1]].push(this);
        } else {
            users[m[1]] = [this];
        }
    });

    for (const [un, tags] of Object.entries(users)) {
        bp_exists(un, {"tags": tags}, function(data) {
            if (data.exists) {
                for (const tag of this.tags) {
                    $(tag).css({color: "#0f782d"});
                }
            }
        })
    }

    let m = window.location.href.match(user_regex);
    if (m === null) {
        return;
    }

    console.log("On a profile, fetching bp info...")

    bp_fetch(m[1], function(data) {
        console.log(data);
        if (data.message === "not found") {
            return
        }

        $("#dashboard ul").first().append(
            `<li><a href="${data.author}?target=blank">FPS List Entry</a></li>`
        )
    });
});