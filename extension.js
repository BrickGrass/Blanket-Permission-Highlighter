// ==UserScript==
// @name         Blanket Permission highlighting
// @namespace    https://brickgrass.uk
// @version      0.1
// @description  Highlights authors on ao3 who have a blanket permission statement
// @author       BrickGrass
// @include      https://archiveofourown.org/*
// @grant        GM_xmlhttpRequest
// @require      http://code.jquery.com/jquery-3.5.1.min.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// ==/UserScript==

const user_regex = /^https:\/\/archiveofourown\.org\/users\/([^/]+)\/pseuds\/([^/]+)$/;
var users_exist = [];

function bp_exists(username, context, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_exists/${username}`,
        {context: context}
    ).done(callback);
}

function bp_fetch(username, callback) {
    $.ajax(
        `https://brickgrass.uk/bp_api/author_data/${username}`,
        {context: context}
    ).done(callback);
}

$( document ).ready(function() {
    console.log("Highlighting authors with bp...");
    $("a").each(function() {
        let m = this.href.match(user_regex);

        if (m === null) {
            return;
        }

        if (users_exist.includes(m[1])) {
            this.css({color: "#0f782d"});
            return;
        }

        bp_exists(m[1], this, function(data) {
            if (data.exists) {
                $(this).css({color: "#0f782d"});
                users_exist.push(m[1]);
            }
        })
    });

    let m = window.location.href.match(user_regex);
    if (m === null) {
        return;
    }

    console.log("On a profile, fetching bp info...")

    bp_fetch(m[1], function(data) {
        console.log(data);

        $("#dashboard ul").last().append(
            `<li><a href="${data.author}">FPS List Entry</a></li>`
        )
    });
});