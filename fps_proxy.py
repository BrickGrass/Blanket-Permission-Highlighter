import json

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from bs4 import BeautifulSoup
from memoization import cached, CachingAlgorithmFlag
from flask import Flask, jsonify

import fps_get

with open("config.json") as f:
    data = json.load(f)
    sentry_dsn = data["sentry_dsn"]

sentry_sdk.init(
    dsn=sentry_dsn,
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0
)

sess = fps_get.Session()
app = Flask(__name__)
_24_hours = 24 * 60 * 60


@cached(max_size=750, algorithm=CachingAlgorithmFlag.LFU, ttl=_24_hours)
def fetch_author(username):
    try:
        data = sess.get_author(username)
    except fps_get.NonceExpiredError:
        sess.form.nonce = sess.get_nonce()
        data = sess.get_author(username)

    if data["recordsFiltered"] == 0:
        return None

    for _, author_page, _, _, statement in data["data"]:
        author_page = BeautifulSoup(author_page)
        statement = BeautifulSoup(statement)

        if author_page.string.lower() == username.lower():
            return {"author": author_page.a["href"], "statement": statement.a["href"]}


@app.route("/bp_api/author_exists/<username>")
def author_exists(username):
    author = fetch_author(username)
    return jsonify({"exists": bool(author)}), 200


@app.route("/bp_api/author_data/<username>")
def author_data(username):
    author = fetch_author(username)

    if not author:
        return jsonify({"message": "not found"}), 201

    author["message"] = "found"
    return jsonify(author), 200


@app.route("/bp_api/cache_health")
def cache_health():
    cache_info = fetch_author.cache_info()
    cache_health = {
        "hits": cache_info.hits,
        "misses": cache_info.misses,
        "current_size": cache_info.current_size,
    }
    return jsonify(cache_health), 200
