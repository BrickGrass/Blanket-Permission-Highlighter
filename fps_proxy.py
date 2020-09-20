from bs4 import BeautifulSoup
from cachetools import cached, TTLCache
from flask import Flask, jsonify

import fps_get

sess = fps_get.Session()
app = Flask(__name__)
_24_hours = 24 * 60 * 60


@cached(cache=TTLCache(maxsize=500, ttl=_24_hours))
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
