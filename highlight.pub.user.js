// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      1.2
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @require      http://code.jquery.com/jquery-3.5.1.min.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@rc/dist/js.cookie.min.js
// @require      https://greasyfork.org/scripts/6250-waitforkeyelements/code/waitForKeyElements.js?version=23756
// @updateURL    https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @downloadURL  https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

const _1_day_ago = Date.now() - 24 * 60 * 60 * 1000
const user_regex = /https:\/\/archiveofourown\.org\/users\/([^/]+)/;
var users = {};
var storage_enabled = false;
var filtering_enabled = false;

// Styles for settings menu
GM_addStyle(`
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

@media only screen and (max-width: 625px) {
  #bp-settings-content {
    width: 80%;
  }
}`);

const storage_enabled_str = Cookies.get("bp_cookies_enabled");
if (storage_enabled_str === "yes") {
    storage_enabled = true;
}
const filtering_enabled_str = Cookies.get("bp_filtering_enabled");
if (filtering_enabled_str === "yes") {
    filtering_enabled = true;
}

function settings_close() {
    const checkboxes = $("#bp-settings input");
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

    $("#bp-settings").remove();
    console.log("settings closed");

    window.location.reload();
}

GM_registerMenuCommand("Open highlighter settings", function() {
    const settings_menu_exists = $("#bp-settings").length;
    if (settings_menu_exists) {
        console.log("settings already open");
        return;
    }

    $("body").prepend(`
<div id="bp-settings">
  <div id="bp-settings-content">
    <h2>Blanket Permission Highlighter Settings</h2>
    <form>
      <input type="checkbox" id="enable-storage" name="enable-storage"></input>
      <label for="enable-storage">Enable Storage/Caching</label><br>
      <input type="checkbox" id="enable-filter" name="enable-filter"></input>
      <label for="enable-filter">Enable Filtering Of Non-Blanket Permission User's Works</label><br>
    </form>
    <button id="bp-settings-close">Close</button>
  </div>
</div>`);

    const checkbox_values = [storage_enabled, filtering_enabled];
    const checkboxes = $("#bp-settings input");
    for (let i = 0; i < checkboxes.length; i++) {
        console.log(i);
        console.log(checkboxes[i]);
        $(checkboxes[i]).prop("checked", checkbox_values[i]);
    }

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
    var entry = await GM.getValue(username);
    entry = readStorage(entry);

    if (entry.hasOwnProperty("exists") && entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, {exists: true});
            return;
        }
    } else if (entry.hasOwnProperty("exists") && !entry.exists) {
        if (entry.age > _1_day_ago) {
            callback.call(context, false);
            return
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
            $(tag).css({color: "#0f782d"});
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

$( document ).ready(function() {
    if (storage_enabled_str === undefined) {
        // No cookie set, ask user if they want to enable cookies
        let flash = $(".flash").first();
        flash.addClass("notice");
        flash.empty();
        flash.append(
            `Blanket Permission Highlighter: Do you wish to <a href="#" id="en_bp_cookies">enable</a> or permanently <a href="#" id="dis_bp_cookies">disable</a> storage for this extension?`
        );

        $("#en_bp_cookies").click(function() {
            Cookies.set("bp_cookies_enabled", "yes", {expires: 365 * 10})
            storage_enabled = true;

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

        if($(this).parents("#kudos").length > 0) {
            return;
        }

        if (users.hasOwnProperty(m[1])) {
            users[m[1]].push(this);
        } else {
            users[m[1]] = [this];
        }
    });

    for (const [un, tags] of Object.entries(users)) {
        bp_exists(un, {"tags": tags}, modify_style)
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

waitForKeyElements("#comments_placeholder a", checkTag, false);