from functools import lru_cache

from bs4 import BeautifulSoup
from flask import Flask, jsonify

import fps_get

sess = fps_get.Session()
app = Flask(__name__)


@lru_cache(maxsize=500, typed=False)
def fetch_author(username):
    data = sess.get_author(username)

    if data["recordsFiltered"] == 0:
        return None

    _, author_page, _, _, statement = data["data"][0]

    author_page = BeautifulSoup(author_page, features="lxml")
    statement = BeautifulSoup(statement, features="lxml")

    return {"author": author_page.a["href"], "statement": statement.a["href"]}


@app.route("/bp_api/author_exists/<username>")
def author_exists(username):
    author = fetch_author(username)
    return jsonify({"exists": bool(author)}), 200


@app.route("/bp_api/author_data/<username>")
def author_data(username):
    author = fetch_author(username)

    if not author:
        return 201

    return jsonify(author), 200
