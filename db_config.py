import csv
import json

import psycopg2
from bs4 import BeautifulSoup
import requests

FORM_DATA_4 = {
    "draw": 1,
    "columns[0][data]": 0,
    "columns[0][name]": "autid",
    "columns[0][searchable]": True,
    "columns[0][orderable]": True,
    "columns[0][search][value]": "",
    "columns[0][search][regex]": False,
    "columns[1][data]": 1,
    "columns[1][name]": "AuthorArtist",
    "columns[1][searchable]": True,
    "columns[1][orderable]": True,
    "columns[1][search][value]": "",
    "columns[1][search][regex]": False,
    "order[0][column]": 1,
    "order[0][dir]": "asc",
    "start": 0,
    "length": -1,
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


def query_database():
    """Quickly see what's in the db"""
    cur = conn.cursor()
    cur.execute("SELECT username FROM users;")
    for row in cur:
        print(row)
    cur.close()


def populate_database(csv_name):
    """Clear database and repopulate it from a csv file"""
    cur = conn.cursor()

    cur.execute("DELETE FROM users")
    conn.commit()

    with open(csv_name, newline="") as csv_file:
        csv_reader = csv.reader(csv_file)
        for row in csv_reader:
            username = row[0].lower()

            try:
                cur.execute("INSERT INTO users (username) VALUES (%s)", (username,))
            except psycopg2.UniqueViolation:
                print(f"Ignoring duplicate user: {username}")

    conn.commit()
    cur.close()


def populate_database_json(json_data):
    """Clear database and repopulate it from a dict"""
    cur = conn.cursor()

    cur.execute("DELETE FROM users")
    conn.commit()

    for row in json_data["data"]:
        username = row[1].lower()

        try:
            cur.execute("INSERT INTO users (username) VALUES (%s)", (username,))
        except psycopg2.UniqueViolation:
            print(f"Ignoring duplicate user: {username}")

    conn.commit()
    cur.close()


def write_to_disk(json_data):
    """Write all data to a csv file on disk"""
    all_authors_artists = [row[1].lower() for row in json_data["data"]]
    all_authors_artists = list(set(all_authors_artists))
    all_authors_artists = {"data": [{"author_artist_name": name} for name in all_authors_artists]}

    with open("all_authors_artists.json", "w") as f:
        json.dump(all_authors_artists, f)


class Session:
    remote = "https://www.fpslist.org/wp-admin/admin-ajax.php"
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
        nonce_4 = soup.find("input", id="wdtNonceFrontendServerSide_4")["value"]

        data = self.get_wdtable(FORM_DATA_4, nonce_4, 4)
        populate_database_json(data)
        write_to_disk(data)


if __name__ == "__main__":
    sess = Session()
    sess.fetch_data()
