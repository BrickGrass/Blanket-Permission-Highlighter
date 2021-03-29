import copy
import time
import urllib.parse

from bs4 import BeautifulSoup
import requests


class BpColumn:
    def __init__(self, data, name):
        self.data = data
        self.name = name

    def insert(self, data):
        prefix = f"columns[{self.data}]"
        data[prefix + "[data]"] = self.data
        data[prefix + "[name]"] = self.name
        data[prefix + "[searchable]"] = "true"
        data[prefix + "[orderable]"] = "true"
        data[prefix + "[search][value]"] = ""
        data[prefix + "[search][regex]"] = "false"


class BpForm:
    def __init__(self, columns):
        self.columns = columns

        self.nonce = None
        self.old_nonce = None
        self.data = None

    def get_data(self, author):
        if not self.nonce:
            raise ValueError

        if not self.data or not self.old_nonce or self.old_nonce != self.nonce:
            data = {
                "draw": 1,
                "start": 0,
                "length": -1,
                "search[value]": "",
                "search[regex]": "false",
                "wdtNonce": self.nonce,
                "order[0][column]": 1,
                "order[0][dir]": "asc"
            }

            for column in self.columns:
                column.insert(data)

            self.data = data

        search = copy.copy(self.data)
        search["columns[1][search][value]"] = author

        return search


class NonceExpiredError(Exception):
    pass


class Session:
    remote = "https://www.fpslist.org/wdpress/wp-admin/admin-ajax.php"
    params = {"action": "get_wdtable", "table_id": 58, "wdt_var1": 5130}
    hdrs = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
    }

    columns = [BpColumn(data, name) for data, name in enumerate(["AIDpk", "AuthorsArtists", "AltPseuds", "Languages", "Permission"])]
    form = BpForm(columns)

    def __init__(self):
        self.s = requests.Session()
        self.form.nonce = self.get_nonce()

        self.cookies = self.create_wp_spamshield_cookies()

        self.headers = copy.copy(self.hdrs)
        self.headers["referer"] = "https://www.fpslist.org/authorsartists/"
        self.headers["x-requested-with"] = "XMLHttpRequest"

    def create_wp_spamshield_cookies(self):
        referrer = "https://www.fpslist.org/authorsartists/"
        refer_time = time.time()

        cookies = {
            "JCS_INENREF": urllib.parse.quote(referrer),
            "JCS_INENTIM": str(int(refer_time)),
            "_wpss_h_": "1",
            "_wpss_p_": "N%3A3%20%7C%20WzFdW0Nocm9tZSBQREYgUGx1Z2luXSBbMl1bQ2hyb21lIFBERiBWaWV3ZXJdIFszXVtOYXRpdmUgQ2xpZW50XSA%3D"
        }

        return cookies

    def get_nonce(self):
        r = self.s.get("https://www.fpslist.org/authorsartists/", headers=self.hdrs)
        r.raise_for_status()

        soup = BeautifulSoup(r.text)
        nonce_input = soup.find("input", id="wdtNonceFrontendEdit_58")
        return nonce_input["value"]

    def get_author(self, username):
        data = self.form.get_data(username)
        r = self.s.post(self.remote, params=self.params, data=data, headers=self.headers, cookies=self.cookies)
        r.raise_for_status()

        if len(r.text) == 0:
            raise NonceExpiredError

        return r.json()


if __name__ == "__main__":
    sess = Session()
    print(sess.get_author("BrickGrass"))
