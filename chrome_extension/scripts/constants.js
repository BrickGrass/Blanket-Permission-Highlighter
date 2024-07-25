const _1_day_ago = Date.now() - 24 * 60 * 60 * 1000
const user_regex = /https:\/\/archiveofourown\.org\/users\/([^/]+)(\/pseuds\/([^/]+))?/;

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