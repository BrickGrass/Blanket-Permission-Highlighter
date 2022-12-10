var storage_enabled = false;
var filtering_enabled = false;
var orphan_bp_enabled = false;
var highlight_colour = "#0f782d";
var minimise_articles = true;

// String needed separately to check for storage = undefined elsewhere
const storage_enabled_str = Cookies.get("bp_cookies_enabled");
if (storage_enabled_str === "yes") {
    storage_enabled = true;
}
if (Cookies.get("bp_filtering_enabled") === "yes") {
    filtering_enabled = true;
}
if (Cookies.get("bp_orphan_enabled") === "yes") {
    orphan_bp_enabled = true;
}
const highlight_colour_str = Cookies.get("bp_highlight_colour");
if (!(Cookies.get("bp_highlight_colour") === undefined)) {
    highlight_colour = highlight_colour_str;
}
if (Cookies.get("bp_minimise_articles") === "no") {
    minimise_articles = false;
}

function set_bool_cookie(cookie_name, cookie_var) {
    Cookies.set(
        cookie_name,
        cookie_var ? "yes" : "no",
        {expires: 365 * 10}
    );
}

function storage_undefined() {
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