var filtering_enabled = false;
var orphan_bp_enabled = false;
var highlight_colour = "#0f782d";
var minimise_articles = true;

chrome.storage.sync.get(["bp_filtering_enabled", "bp_minimise_articles", "bp_orphan_enabled", "bp_highlight_colour"]).then((result) => {
    filtering_enabled = result.bp_filtering_enabled;
    orphan_bp_enabled = result.bp_orphan_enabled;
    highlight_colour = result.bp_highlight_colour;
    minimise_articles = result.bp_minimise_articles;
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            console.log(
                `Storage key "${key}" in namespace "${area}" changed.`,
                `Old value was "${oldValue}", new value is "${newValue}".`
            );
            // TODO: update variables!
        }
    }
});