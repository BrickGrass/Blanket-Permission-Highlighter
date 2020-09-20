// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      0.5
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @require      http://code.jquery.com/jquery-3.5.1.min.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @updateURL    https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// @downloadURL  https://raw.githubusercontent.com/BrickGrass/Blanket-Permission-Highlighter/master/highlight.pub.user.js
// ==/UserScript==

const user_regex = /^https:\/\/archiveofourown\.org\/users\/([^/]+)\/pseuds\/([^/]+)$/;
var users = {};

function bp_exists(username, context, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_exists/${username}`,
        {context: context}
    ).done(callback);
}

function bp_fetch(username, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_data/${username}`
    ).done(callback);
}

$( document ).ready(function() {
    $("a").each(function() {
        let m = this.href.match(user_regex);

        if (m === null) {
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
