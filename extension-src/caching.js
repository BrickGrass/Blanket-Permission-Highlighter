function read_storage(entry) {
    if (entry === undefined) {
        return {};
    } else {
        const entry_data = JSON.parse(entry);
        return {exists: entry_data[0], age: entry_data[1]};
    }
}

async function clear_storage() {
    var values = await GM.listValues();
    for (const value of values) {
        var entry = await GM.getValue(value);
        entry = read_storage(entry);
        if (entry.age < _1_day_ago) {
            GM.deleteValue(value);
        }
    }
}

async function clear_all_storage() {
    var values = await GM.listValues();
    for (const value of values) {
        GM.deleteValue(value);
    }
}

async function log_storage() {
    var values = await GM.listValues();
    var mapping = {}
    for (const value of values) {
        var entry = await GM.getValue(value);
        entry = read_storage(entry);
        mapping[value] = entry;
    }
    console.log(mapping);
}