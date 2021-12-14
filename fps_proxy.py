from datetime import timedelta
import json

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from bs4 import BeautifulSoup
from redis import Redis
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
_24_hours = timedelta(days=1)

r = Redis()


def fetch_author(username):
    if value := r.get(username):
        return None if value == b"n" else {"author": value.decode("utf-8")}

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
                r.setex(username, _24_hours, author_data)
                return {"author": author_data}

    r.setex(username, _24_hours, "n")
    return None


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
