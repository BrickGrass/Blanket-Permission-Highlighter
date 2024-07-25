async function clear_storage() {
    chrome.storage.local.get().then((items) => {
        for (let [key, value] of Object.entries(items)) {
            if (value.age < _1_day_ago) {
                chrome.storage.local.remove([key]);
            }
        }
    })
}

async function log_storage() {
    chrome.storage.local.get().then((items) => {
        console.log(items);
    });
}