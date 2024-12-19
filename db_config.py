import csv
import json

import psycopg2
from bs4 import BeautifulSoup
import requests

FORM_DATA_70 = {
    "draw": 1,
    "columns[0][data]": 0,
    "columns[0][name]": "AIDpk",
    "columns[0][searchable]": False,
    "columns[0][orderable]": False,
    "columns[0][search][value]": "",
    "columns[0][search][regex]": False,
    "columns[1][data]": 1,
    "columns[1][name]": "AuthorsArtists",
    "columns[1][searchable]": False,
    "columns[1][orderable]": False,
    "columns[1][search][value]": "",
    "columns[1][search][regex]": False,
    "start": 0,
    "length": -1,
    "search[value]": "",
    "search[regex]": False
}

FORM_DATA_71 = {
    "draw": 1,
    "columns[0][data]": 0,
    "columns[0][name]": "UpdatedDate",
    "columns[0][searchable]": True,
    "columns[0][orderable]": False,
    "columns[0][search][value]": "",
    "columns[0][search][regex]": False,
    "start": 0,
    "length": 1,
    "search[value]": "",
    "search[regex]": False
}

# Since we're accessing config.json without it's full path, cron scripts using this file
# need to cd to the directory containing this file first.
with open("config.json") as f:
    config_data = json.load(f)
    database_name = config_data["database_name"]
    database_username = config_data["database_username"]
    database_password = config_data["database_password"]
    prev_last_updated = config_data["last_updated"]

conn = psycopg2.connect(
    host="localhost",
    dbname=database_name,
    user=database_username,
    password=database_password)


def create_database():
    """Create database table"""
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        fps_profile VARCHAR(255) UNIQUE NOT NULL);
    """)
    conn.commit()
    cur.close()


def populate_database(csv_name):
    """Clear database and repopulate it from a csv file

    TODO: This code is out of date and will not work"""
    cur = conn.cursor()

    cur.execute("DELETE FROM users")
    conn.commit()

    with open(csv_name, newline="") as csv_file:
        csv_reader = csv.reader(csv_file)
        for row in csv_reader:
            user_data = BeautifulSoup(row[1])

            username = user_data.string.lower()
            fps_profile = user_data.a["href"]

            try:
                cur.execute("INSERT INTO users (username, fps_profile) VALUES (%s, %s)", (username, fps_profile))
            except psycopg2.UniqueViolation:
                print(f"Ignoring duplicate user: {username.lower()}")

    conn.commit()
    cur.close()


def populate_database_json(json_data):
    """Clear database and repopulate it from a dict"""
    cur = conn.cursor()

    cur.execute("DELETE FROM users")

    for row in json_data["data"]:
        user_data = BeautifulSoup(row[1], features="html.parser")

        username = user_data.string.lower()
        fps_profile = user_data.a["href"]

        try:
            cur.execute("INSERT INTO users (username, fps_profile) VALUES (%s, %s)", (username, fps_profile))
        except psycopg2.UniqueViolation:
            print(f"Ignoring duplicate user: {username}")

    conn.commit()
    cur.close()


class Session:
    remote = "https://www.fpslist.org/wdpress/wp-admin/admin-ajax.php"
    hdrs = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
    }

    def __init__(self):
        self.session = requests.Session()

    def get_wdtable(self, form_data: dict, nonce: str, table_id: int) -> dict:
        """Get data from the wdtable AJAX endpoint"""
        form_data["wdtNonce"] = nonce
        request = self.session.post(self.remote, params={"action": "get_wdtable", "table_id": table_id}, data=form_data, headers=self.hdrs)
        request.raise_for_status()

        if len(request.text) == 0:
            raise Exception

        return request.json()

    def fetch_data(self) -> None:
        """Check if there is new data and update the database"""
        nonce_request = self.session.get("https://www.fpslist.org/extensionlist/", headers=self.hdrs)
        nonce_request.raise_for_status()

        soup = BeautifulSoup(nonce_request.text, features="html.parser")
        nonce_70 = soup.find("input", id="wdtNonceFrontendEdit_70")["value"]
        nonce_71 = soup.find("input", id="wdtNonceFrontendEdit_71")["value"]

        last_updated = self.get_wdtable(FORM_DATA_71, nonce_71, 71)["data"][0][0]
        if last_updated == prev_last_updated:
            return

        data = self.get_wdtable(FORM_DATA_70, nonce_70, 70)
        populate_database_json(data)

        print(f"Remote was updated at {last_updated}, database updated.")

        with open("config.json", "w") as f:
            config_data["last_updated"] = last_updated
            json.dump(config_data, f)


if __name__ == "__main__":
    sess = Session()
    sess.fetch_data()
