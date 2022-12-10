const _1_day_ago = Date.now() - 24 * 60 * 60 * 1000
const user_regex = /https:\/\/archiveofourown\.org\/users\/([^/]+)/;

const bp_settings_html = `
<div id="bp-settings">
    <div id="bp-settings-content">
        <h2>Blanket Permission Highlighter Settings</h2>
        <form>
            <input type="checkbox" id="enable-storage" name="enable-storage">
            <label for="enable-storage">Enable Storage/Caching</label><br>
            <input type="checkbox" id="enable-filter" name="enable-filter">
            <label for="enable-filter">Enable Filtering Of Non-Blanket Permission User's Works</label><br>
            <input type="checkbox" id="enable-minimisation" name="enable-minimisation">
            <label for="enable-minimisation">Enable Minimisation Of Non-Blanket Permission User's Works</label><br>
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
    color: #2a2a2a;
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

#bp-settings a {
    color: #111;
}

#bp-settings a:hover {
    color: #999;
}

#bp-settings button {
    background: #eee;
    color: #444;
    width: auto;
    font-size: 100%;
    line-height: 1.286;
    height: 1.286em;
    vertical-align: middle;
    display: inline-block;
    padding: 0.25em 0.75em;
    white-space: nowrap;
    overflow: visible;
    position: relative;
    text-decoration: none;
    border: 1px solid #bbb;
    border-bottom: 1px solid #aaa;
    background-image: -moz-linear-gradient(#fff 2%,#ddd 95%,#bbb 100%);
    background-image: -webkit-linear-gradient(#fff 2%,#ddd 95%,#bbb 100%);
    background-image: -o-linear-gradient(#fff 2%,#ddd 95%,#bbb 100%);
    background-image: -ms-linear-gradient(#fff 2%,#ddd 95%,#bbb 100%);
    background-image: linear-gradient(#fff 2%,#ddd 95%,#bbb 100%);
    border-radius: 0.25em;
    box-shadow: none;
}

@media only screen and (max-width: 625px) {
    #bp-settings-content {
        width: 80%;
    }
}`;