chrome.storage.sync.get(["bp_filtering_enabled", "bp_minimise_articles", "bp_orphan_enabled", "bp_highlight_colour"]).then((result) => {
    const filtering_enabled = result.bp_filtering_enabled !== undefined ? result.bp_filtering_enabled : false;
    const minimise_articles = result.bp_minimise_articles !== undefined ? result.bp_minimise_articles : true;
    const orphan_bp_enabled = result.bp_orphan_enabled !== undefined ? result.bp_orphan_enabled : false;
    const highlight_colour = result.bp_highlight_colour !== undefined ? result.bp_highlight_colour : "#0f782d";

    const checkbox_values = [filtering_enabled, minimise_articles, orphan_bp_enabled];
    const checkboxes = $("#bp-settings input[type=checkbox]");
    for (let i = 0; i < checkboxes.length; i++) {
        $(checkboxes[i]).prop("checked", checkbox_values[i]);
    }
    $("#colour").val(highlight_colour);
});

$("#enable-filter").change(function() {
    chrome.storage.sync.set({ bp_filtering_enabled: $("#enable-filter").is(":checked") });
});
$("#enable-minimisation").change(function() {
    chrome.storage.sync.set({ bp_minimise_articles: $("#enable-minimisation").is(":checked") });
});
$("#enable-orphan-bp").change(function() {
    chrome.storage.sync.set({ bp_orphan_enabled: $("#enable-orphan-bp").is(":checked") });
});
$("#colour").change(function() {
    var new_colour = $("#colour").val();
    if (/^#([0-9A-F]{3}){1,2}$/i.test(new_colour)) {
        chrome.storage.sync.set({ bp_highlight_colour: $("#colour").val() });
        $("#colour-warning").css({"display": "none"});
    } else {
        $("#colour").val("");
        $("#colour-warning").css({"display": "initial"});
    }
})