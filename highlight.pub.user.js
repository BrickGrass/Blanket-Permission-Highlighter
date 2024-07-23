// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      2.7
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.6.1/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @updateURL    https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @downloadURL  https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @grant        GM.registerMenuCommand
// @require      https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/extension-src/constants.js
// @require      https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/extension-src/cookies.js
// @require      https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/extension-src/caching.js
// @require      https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/extension-src/settings.js
// @require      https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/extension-src/waitForKeyElements.js
// ==/UserScript==

var users = {};

// Checks if a user is in the local cache, returns true if user found in cache, false if not
// If the user is in the cache, the callback is called with exists set their bp status
async function check_storage(username, context, callback) {
    if (username === "orphan_account") {
        if (orphan_bp_enabled) {
            callback.call(context, {exists: true});
            return true;
        } else {
            callback.call(context, {exists: false});
            return true;
        }
    }

    var entry = await GM.getValue(username);
    entry = read_storage(entry);

    if (entry.hasOwnProperty("exists") && entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, {exists: true});
            return true;
        }
    } else if (entry.hasOwnProperty("exists") && !entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, {exists: false});
            return true;
        }
    }

    // user not found in cache and is not orphan account, api must be checked
    return false;
}

// Checks the local cache and then the single user api endpoint to see if a user has bp
async function bp_exists(username, context, callback) {
    const in_storage = await check_storage(username, context, callback)
    if (in_storage) {
        return;
    }

    $.ajax(
        `https://brickgrass.uk/bp_api/author_exists/${username}`,
        {context: context}
    ).done(callback).done(function(data) {
        if (storage_enabled) {
            if (data.exists) {
                GM.setValue(username, JSON.stringify([true, Date.now()]));
            } else {
                GM.setValue(username, JSON.stringify([false, Date.now()]));
            }
        }
    });
}

// Check if a user has an fpslist.org entry, returns the url if so
function bp_fetch(username, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_data/${username}`
    ).done(callback);
}

function minimise_article(article) {
    if (!minimise_articles) {
        // Old article hiding behaviour
        $(article).css({display: "none"});
        return
    }

    // Minimisation of articles
    $(article).children().each(function () {
        if ($(this).is("div.header.module")) {
            $(this).after("<a class='bp-unhide-article' href='#' style='float: right'>Unhide non-bp work</a>")
            $(this).css({"min-height": 0});

            var article_title = $(this).children("h4.heading")[0];
            $(article_title).css({"margin-left": 0});

            var article_fandoms = $(this).children("h5.fandoms.heading")[0];
            $(article_fandoms).css({display: "none"});

            var article_req_tags = $(this).children("ul.required-tags")[0];
            $(article_req_tags).css({display: "none"});

            var article_datetime = $(this).children("p.datetime")[0];
            $(article_datetime).css({top: 0});

            return;
        }

        $(this).css({display: "none"});
    });
    $("a.bp-unhide-article").on("click", function (event) {
        event.preventDefault();
        var hidden_article = $(this).closest("li[role=article]");
        $(hidden_article).children().each(function () {
            if ($(this).is("div.header.module")) {
                $(this).css({"min-height": ""});

                var article_title = $(this).children("h4.heading")[0];
                $(article_title).css({"margin-left": ""});

                var article_fandoms = $(this).children("h5.fandoms.heading")[0];
                $(article_fandoms).css({display: ""});

                var article_req_tags = $(this).children("ul.required-tags")[0];
                $(article_req_tags).css({display: ""});

                var article_datetime = $(this).children("p.datetime")[0];
                $(article_datetime).css({top: ""});
            }
            $(this).css({display: ""});
        });
        $(this).css({display: "none"});
    });
}

// Highlights the username links of bp authors, and minimises/hides works based on filtering settings
function modify_style(data) {
    if (data.exists) {
        for (const tag of this.tags) {
            $(tag).css({color: highlight_colour});
        }
    } else {
        if (!filtering_enabled) {
            return;
        }

        for (const tag of this.tags) {
            if (!($(tag).attr("rel") === "author")) {
                continue;
            }

            var article = $(tag).closest("li[role=article]");
            minimise_article(article);

        }
    }
}

$(document).ready(async function() {
    // Remove expired keys from storage
    clear_storage();

    // If storage is disabled, fully clear storage
    if (!storage_enabled) {
        clear_all_storage();
    }

    // Add custom css
    let head = document.getElementsByTagName('head')[0];
    if (head) {
        let style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.textContent = css;
        head.appendChild(style);
    }

    // Add filter to ao3 filter form, update cookie on every change event
    $(".filters .options > ul").append(ao3_filter_html);
    $(".filters .more.group > dl").prepend(`<dd>${ao3_filter_html}</dd>`);
    $("form[action='/bookmarks/search'] fieldset dl").append(ao3_search_filter_html);
    $("form[action='/works/search'] fieldset dl").append(ao3_search_filter_html);

    $("#bp_filter").prop("checked", filtering_enabled);
    $("#bp_filter").change(function() {
        filtering_enabled = this.checked;
        set_bool_cookie("bp_filtering_enabled", filtering_enabled);
        }
    );

    if (storage_enabled_str === undefined) {
        storage_undefined();
    }

    // Find all mentions of archive users by iterating all links in page
    $("a").each(function() {
        let m = this.href.match(user_regex);

      	// No match
        if (m === null) {
            return;
        }

      	if (m[3] != undefined) {
            // Check using specific pseudonym
            if (!this.text.includes(decodeURI(m[3]))) {
                return;
            }
        } else {
            // No pseudonym, check using username
            if (!this.text.includes(decodeURI(m[1]))) {
                return;
            }
        }

        // Don't highlight usersnames that only appear in the kudos section
        if($(this).parents("#kudos").length > 0) {
            return;
        }

        // Push username (not pseudonym) to list of users, no duplicates
        if (users.hasOwnProperty(m[1])) {
            users[m[1]].push(this);
        } else {
            users[m[1]] = [this];
        }
    });

    // Check all users found for bp
    var not_in_storage = [];
    for (const [un, tags] of Object.entries(users)) {
        var in_storage = await check_storage(un, {"tags": tags}, modify_style);
        if (!in_storage) {
            not_in_storage.push(un);
        }
    }

    if (not_in_storage.length > 0) {
        $.ajax(
            "https://brickgrass.uk/bp_api/authors_exist",
            {
                type: "POST",
                data: JSON.stringify({authors: not_in_storage}),
                contentType: 'application/json'
            }
        ).done(function(data) {
            for (const un of data.exist) {
                GM.setValue(un, JSON.stringify([true, Date.now()]));
                modify_style.call({"tags": users[un]}, {"exists": un});
            }

            for (const un of data.dont_exist) {
                GM.setValue(un, JSON.stringify([false, Date.now()]));
                modify_style.call({"tags": users[un]}, {});
            }
        })
    }

    // If filtering is enabled, works by Anonymous users need to be hidden
    if (filtering_enabled && !orphan_bp_enabled) {
        $("li[role=article]").each(function() {
            let heading = $(this).find("h4.heading");
            let text = heading.text();
            text = text.replace(/\r?\n|\r/g, " "); // remove newlines
            text = text.replace(/  +/g, " "); // multiple spaces -> single space
          	if (text.includes("by Anonymous")) {
                minimise_article(this);
                // $(this).css({display: "none"});
            }
        });
    }

    // check if on profile, add link to FPS List entry if so
    let m = window.location.href.match(user_regex);
    if (m === null) {
        return;
    }

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

// Highlight users in comments after they are dynamically loaded
function check_tag(jNode) {
    var node = jNode.context;

    let m = node.href.match(user_regex);

    if (m === null) {
        return;
    }

    if (!node.text.includes(m[1])) {
        return;
    }

    bp_exists(m[1], {"tags": [node]}, modify_style);
}

waitForKeyElements("#comments_placeholder a", check_tag, false);
