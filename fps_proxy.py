from datetime import timedelta
import json

from bs4 import BeautifulSoup
from redis import Redis
from flask import Flask, jsonify
import psycopg2
from typing import Optional

import fps_get

with open("config.json") as f:
    data = json.load(f)
    database_name = data["database_name"]
    database_username = data["database_username"]
    database_password = data["database_password"]

sess = fps_get.Session()
app = Flask(__name__)
cache_time = timedelta(days=7)
r = Redis()

# TODO: Can't remember if using a single cursor for everything gets handled sensibly by flask
# what with the multiple threads. I don't really have time to do it properly if so anyways. This might
# be good if I really do need to: https://gist.github.com/vulcan25/55ce270d76bf78044d067c51e23ae5ad
conn = psycopg2.connect(
    host="localhost",
    dbname=database_name,
    user=database_username,
    password=database_password)
cur = conn.cursor()


def fetch_author(username: str) -> bool:
    """Discover if an author has blanket permission from the local database and redis cache"""
    username = username.lower()

    value = r.get(username)
    if value:
        return False if value == b"n" else True

    cur.execute("SELECT user FROM users WHERE user = %s", (username,))
    row = cur.fetchone()

    if row:
        r.setex(username, cache_time, "y")
        return True

    r.setex(username, cache_time, "n")
    return False


def fetch_author_from_web(username: str) -> Optional[dict]:
    """Discover if an author has an fpslist.org page

    TODO: Might be a good idea to still cache this, just under a separate prefix from the other data.
    data.<username> or something like that.
    """
    try:
        data = sess.get_author(username)
    except fps_get.NonceExpiredError:
        sess.form.nonce = sess.get_nonce()
        data = sess.get_author(username)

    if data["recordsFiltered"] != 0:
        for _, author_page, _, _, _ in data["data"]:
            author_page = BeautifulSoup(author_page)

            if author_page.string.lower() == username.lower():
                author_data = author_page.a["href"]
                return {"author": author_data}

    return None


@app.route("/bp_api/author_exists/<username>")
def author_exists(username):
    author = fetch_author(username)
    return jsonify({"exists": author}), 200


@app.route("/bp_api/author_data/<username>")
def author_data(username):
    author = fetch_author_from_web(username)

    if not author:
        return jsonify({"message": "not found"}), 201

    author["message"] = "found"
    return jsonify(author), 200


@app.route("/bp_api/cache_health")
def cache_health():
    redis_info = r.info()
    hits = redis_info.get("keyspace_hits")
    misses = redis_info.get("keyspace_misses")
    return jsonify({
        "hits": hits,
        "misses": misses,
        "used_memory": redis_info.get("used_memory_human"),
        "evicted_keys": redis_info.get("evicted_keys"),
        "expired_keys": redis_info.get("expired_keys"),
        "keys": redis_info.get("db0").get("keys"),
        "hit_miss_ratio": f"{(hits / (hits + misses)) * 100:.2f}%"
    }), 200
