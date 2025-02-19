// TODO: query all settings and set up change monitoring to keep them updated?
// Will need to see how often they're getting accessed in-code. See cookies.js for how I'd do that
// A benefit will be that it would be possible to re-run highlighting/filtering without a page reload, but that would be a lot of work lmao

var users = {};

// Checks if a user is in the local cache, returns true if user is found in cache, false if not
// If the user is in the cache, the callback is called with exists to set their bp status
async function check_storage(username, context, callback) {
    if (username === "orphan_account") {
        const result = await chrome.storage.sync.get(["bp_orphan_enabled"]);
        const orphan_bp_enabled = result.bp_orphan_enabled !== undefined ? result.bp_orphan_enabled : false;
        console.log(`orphan_bp_enabled: ${orphan_bp_enabled}`);
        callback.call(context, {exists: orphan_bp_enabled});
        return true;
    }

    const result = await chrome.storage.local.get([username]);
    if (!result.hasOwnProperty(username)) {
        // user not found in cache and is not orphan account, api must be checked
        return false;
    }

    if (result[username].age <= _1_day_ago) {
        // cached data has expired, api must be checked
        return false;
    }

    // valid cached data, no need to query api
    callback.call(context, { exists: result[username].exists });
    return true;
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
                chrome.storage.local.set({ [username]: { exists: true, age: Date.now() } });
            } else {
                chrome.storage.local.set({ [username]: { exists: false, age: Date.now() } });
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

async function minimise_article(article) {
    const result = await chrome.storage.sync.get(["bp_minimise_articles"]);
    const minimise_articles = result.bp_minimise_articles !== undefined ? result.bp_minimise_articles : true;
    if (!minimise_articles) {
        // Old article hiding behaviour
        $(article).css({display: "none"});
        return;
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
async function modify_style(data) {
    const result = await chrome.storage.sync.get(["bp_highlight_colour", "bp_filtering_enabled"]);
    const filtering_enabled = result.bp_filtering_enabled !== undefined ? result.bp_filtering_enabled : false;
    const highlight_colour = result.bp_highlight_colour !== undefined ? result.bp_highlight_colour : "#0f782d";

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
    const result = await chrome.storage.sync.get(["bp_filtering_enabled", "bp_orphan_enabled"]);
    const filtering_enabled = result.bp_filtering_enabled !== undefined ? result.bp_filtering_enabled : false;
    const orphan_bp_enabled = result.bp_orphan_enabled !== undefined ? result.bp_orphan_enabled : false;

    // TODO: move this to scheduled background task? It's inefficient to run this on every page load.
    // Remove expired keys from storage
    clear_storage();

    // Add filter to ao3 filter form, update cookie on every change event
    $(".filters .options > ul").append(ao3_filter_html);
    $(".filters .more.group > dl").prepend(`<dd>${ao3_filter_html}</dd>`);
    $("form[action='/bookmarks/search'] fieldset dl").append(ao3_search_filter_html);
    $("form[action='/works/search'] fieldset dl").append(ao3_search_filter_html);

    $("#bp_filter").prop("checked", filtering_enabled);
    $("#bp_filter").change(function() {
            chrome.storage.sync.set({ bp_filtering_enabled: this.checked });
        }
    );

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

        // Don't highlight usernames that only appear in the kudos section
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
                chrome.storage.local.set({ [un]: { exists: true, age: Date.now() } });
                modify_style.call({"tags": users[un]}, {"exists": un});
            }

            for (const un of data.dont_exist) {
                chrome.storage.local.set({ [un]: { exists: false, age: Date.now() } });
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
            }
        });
    }

    // check if on profile, add link to FPS List entry if so
    let m = window.location.href.match(user_regex);
    if (m === null) {
        return;
    }

    bp_fetch(m[1], function(data) {
        if (data.message === "not found") {
            return
        }

        $("#dashboard ul").first().append(
            `<li><a href="${data.author}&target=blank">FPS List Entry</a></li>`
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