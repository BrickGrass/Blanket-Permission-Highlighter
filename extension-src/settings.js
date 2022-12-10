function settings_close() {
    const checkboxes = $("#bp-settings input[type=checkbox]");
    storage_enabled = $(checkboxes[0]).is(":checked");
    set_bool_cookie("bp_cookies_enabled", storage_enabled);

    filtering_enabled = $(checkboxes[1]).is(":checked");
    set_bool_cookie("bp_filtering_enabled", filtering_enabled);

    minimise_articles = $(checkboxes[2]).is(":checked");
    set_bool_cookie("bp_minimise_articles", minimise_articles);

    orphan_bp_enabled = $(checkboxes[3]).is(":checked");
    set_bool_cookie("bp_orphan_enabled", orphan_bp_enabled);

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

    const checkbox_values = [storage_enabled, filtering_enabled, minimise_articles, orphan_bp_enabled];
    const checkboxes = $("#bp-settings input[type=checkbox]");
    for (let i = 0; i < checkboxes.length; i++) {
        $(checkboxes[i]).prop("checked", checkbox_values[i]);
    }
    $("#bp-settings input[type=color]").val(highlight_colour);

    $("#bp-settings-close").click(settings_close);
    console.log("settings opened");
});