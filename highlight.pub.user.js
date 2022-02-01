// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      1.9
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @updateURL    https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @downloadURL  https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

const _1_day_ago = Date.now() - 24 * 60 * 60 * 1000
const user_regex = /https:\/\/archiveofourown\.org\/users\/([^/]+)/;
var users = {};

const bp_settings_html = `
<div id="bp-settings">
    <div id="bp-settings-content">
        <h2>Blanket Permission Highlighter Settings</h2>
        <form>
            <input type="checkbox" id="enable-storage" name="enable-storage">
            <label for="enable-storage">Enable Storage/Caching</label><br>
            <input type="checkbox" id="enable-filter" name="enable-filter">
            <label for="enable-filter">Enable Filtering Of Non-Blanket Permission User's Works</label><br>
            <input type="checkbox" id="enable-orphan-bp" name="enable-orphan-bp">
            <label for="enable-orphan-bp">Enable Treating The AO3 <a href="/users/orphan_account">orphan_account</a> As Having Blanket Permission</label><br>
            <input type="color" id="colour" name="colour">
            <label for="colour">Choose Highlight Colour</label><br>
        </form>
        <button id="bp-settings-close">Close</button>
    </div>
</div>`

const ao3_filter_html = `
<li>
    <label for="bp_filter">
    <input name="bp_filter" type="hidden" value="0">
    <input type="checkbox" value="1" name="bp_filter" id="bp_filter">
    <span class="indicator" aria-hidden="true"></span>
    <span>Only works with authors who give blanket permission for transformative works</span>
    </label>
</li>`

const ao3_search_filter_html = `
<dt>
    <label for="bp_filter">Only works with authors who give blanket permission for transformative works</label>
</dt>
<dd>
    <input name="bp_filter" type="hidden" value="0">
    <input type="checkbox" value="1" name="bp_filter" id="bp_filter">
</dd>
`

// Styles for settings menu
const css = `
#bp-settings {
    position: fixed;
    z-index: 21;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.4);
}

#bp-settings-content {
    background-color: #fff;
    margin: 10% auto;
    padding: 1em;
    width: 500px;
}

#bp-settings-content form {
    margin: 1em auto;
}

#bp-settings input[type=color] {
    width: 30px;
}

@media only screen and (max-width: 625px) {
    #bp-settings-content {
        width: 80%;
    }
}`;

var storage_enabled = false;
var filtering_enabled = false;
var orphan_bp_enabled = false;
var highlight_colour = "#0f782d";

const storage_enabled_str = Cookies.get("bp_cookies_enabled");
if (storage_enabled_str === "yes") {
    storage_enabled = true;
}
const filtering_enabled_str = Cookies.get("bp_filtering_enabled");
if (filtering_enabled_str === "yes") {
    filtering_enabled = true;
}
const orphan_bp_enabled_str = Cookies.get("bp_orphan_enabled");
if (orphan_bp_enabled_str === "yes") {
    orphan_bp_enabled = true;
}
const highlight_colour_str = Cookies.get("bp_highlight_colour");
if (!(highlight_colour_str === undefined)) {
    highlight_colour = highlight_colour_str;
}

function settings_close() {
    const checkboxes = $("#bp-settings input[type=checkbox]");
    storage_enabled = $(checkboxes[0]).is(":checked");
    Cookies.set(
        "bp_cookies_enabled",
        storage_enabled ? "yes" : "no",
        {expires: 365 * 10});
    filtering_enabled = $(checkboxes[1]).is(":checked")
    Cookies.set(
        "bp_filtering_enabled",
        filtering_enabled ? "yes" : "no",
        {expires: 365 * 10});

    orphan_bp_enabled = $(checkboxes[2]).is(":checked")
    Cookies.set(
        "bp_orphan_enabled",
        orphan_bp_enabled ? "yes" : "no",
        {expires: 365 * 10});

    let colour = $("#bp-settings input[type=color]").val();
    Cookies.set("bp_highlight_colour", colour, {expires: 365 * 10});

    $("#bp-settings").remove();
    console.log("settings closed");

    window.location.reload();
}

GM.registerMenuCommand("Open highlighter settings", function() {
    const settings_menu_exists = $("#bp-settings").length;
    if (settings_menu_exists) {
        console.log("settings already open");
        return;
    }

    $("body").prepend(bp_settings_html);

    const checkbox_values = [storage_enabled, filtering_enabled, orphan_bp_enabled];
    const checkboxes = $("#bp-settings input[type=checkbox]");
    for (let i = 0; i < checkboxes.length; i++) {
        $(checkboxes[i]).prop("checked", checkbox_values[i]);
    }
    $("#bp-settings input[type=color]").val(highlight_colour);

    $("#bp-settings-close").click(settings_close);
    console.log("settings opened");
});

function readStorage(entry) {
    if (entry === undefined) {
        return {};
    } else {
        const entry_data = JSON.parse(entry);
        return {exists: entry_data[0], age: entry_data[1]};
    }
}

async function bp_exists(username, context, callback) {
    if (username === "orphan_account") {
        if (orphan_bp_enabled) {
            callback.call(context, {exists: true});
            return;
        } else {
            callback.call(context, {exists: false});
            return;
        }
    }

    var entry = await GM.getValue(username);
    entry = readStorage(entry);

    if (entry.hasOwnProperty("exists") && entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, {exists: true});
            return;
        }
    } else if (entry.hasOwnProperty("exists") && !entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, {exists: false});
            return;
        }
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

function bp_fetch(username, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_data/${username}`
    ).done(callback);
}

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

            $(tag).closest("li[role=article]").css({display: "none"});
        }
    }
}

async function clear_storage() {
    var values = await GM.listValues();
    for (const value of values) {
        var entry = await GM.getValue(value);
        entry = readStorage(entry);
        if (entry.age < _1_day_ago) {
            GM.deleteValue(value);
        }
    }
}

async function log_storage() {
    var values = await GM.listValues();
    var mapping = {}
    for (const value of values) {
        var entry = await GM.getValue(value);
        entry = readStorage(entry);
        mapping[value] = entry;
    }
    console.log(mapping);
}

$( document ).ready(function() {
    // Remove expired keys from storage
    clear_storage();

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
        Cookies.set(
            "bp_filtering_enabled",
            filtering_enabled ? "yes" : "no",
            {expires: 365 * 10});
        }
    );

    if (storage_enabled_str === undefined) {
        // No cookie set, ask user if they want to enable cookies
        let flash = $(".flash").first();
        flash.addClass("notice");
        flash.empty();
        flash.append(
            `Blanket Permission Highlighter: Do you wish to <a href="#" id="en_bp_cookies">enable</a> or permanently <a href="#" id="dis_bp_cookies">disable</a> storage for this extension?`
        );

        function callback(enabled, event) {
            Cookies.set(
                "bp_cookies_enabled",
                enabled ? "yes" : "no",
                {expires: 365 * 10});
            storage_enabled = enabled;
            flash.empty();
            flash.removeClass("notice");
        }

        $("#en_bp_cookies").click(callback.bind($, true));
        $("#dis_bp_cookies").click(callback.bind($, false));
    }

    // Find all mentions of archive users by iterating all links in page
    $("a").each(function() {
        let m = this.href.match(user_regex);

        if (m === null) {
            return;
        }

        if (!this.text.includes(m[1])) {
            return;
        }

        if($(this).parents("#kudos").length > 0) {
            return;
        }

        if (users.hasOwnProperty(m[1])) {
            users[m[1]].push(this);
        } else {
            users[m[1]] = [this];
        }
    });

    // Check all users found for bp
    for (const [un, tags] of Object.entries(users)) {
        bp_exists(un, {"tags": tags}, modify_style)
    }

    // If filtering is enabled, works by Anonymous users need to be hidden
    if (filtering_enabled) {
        $("li[role=article]").each(function() {
            let heading = $(this).find("h4.heading");
            let text = heading.text();
            text = text.replace(/\r?\n|\r/g, ""); // remove newlines
            text = text.replace(/  +/g, " "); // multiple spaces -> single space
            if (text.includes("by Anonymous")) {
                $(this).css({display: "none"});
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
function checkTag(jNode) {
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

function waitForKeyElements (
    selectorTxt,    /* Required: The jQuery selector string that
                        specifies the desired element(s).
                    */
    actionFunction, /* Required: The code to run when elements are
                        found. It is passed a jNode to the matched
                        element.
                    */
    bWaitOnce,      /* Optional: If false, will continue to scan for
                        new elements even after the first match is
                        found.
                    */
    iframeSelector  /* Optional: If set, identifies the iframe to
                        search.
                    */
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined")
        targetNodes = $(selectorTxt);
    else
        targetNodes = $(iframeSelector).contents()
                                       .find(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
        btargetsFound = true;
        /*--- Found target node(s).  Go through each and act if they
            are new.
        */
        targetNodes.each ( function () {
            var jThis = $(this);
            var alreadyFound = jThis.data ('alreadyFound') || false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound = actionFunction (jThis);
                if (cancelFound)
                    btargetsFound = false;
                else
                    jThis.data ('alreadyFound', true);
            }
        } );
    }
    else {
        btargetsFound = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj = waitForKeyElements.controlObj || {};
    var controlKey = selectorTxt.replace (/[^\w]/g, "_");
    var timeControl = controlObj [controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound && bWaitOnce && timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval (timeControl);
        delete controlObj [controlKey]
    }
    else {
        //--- Set a timer, if needed.
        if ( ! timeControl) {
            timeControl = setInterval ( function () {
                    waitForKeyElements (selectorTxt,
                                        actionFunction,
                                        bWaitOnce,
                                        iframeSelector
                    );
                },
                300
            );
            controlObj [controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj = controlObj;
}

waitForKeyElements("#comments_placeholder a", checkTag, false);
