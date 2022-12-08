from datetime import timedelta
import json

from bs4 import BeautifulSoup
from redis import Redis
from flask import Flask, jsonify, g
import psycopg2
from typing import Optional

import fps_get

with open("config.json") as f:
    data = json.load(f)
    database_name = data["database_name"]
    database_username = data["database_username"]
    database_password = data["database_password"]

sess = fps_get.Session()
cache_time = timedelta(days=2)
r = Redis()

def create_app():
    app = Flask(__name__)

    # Database connection pool, maximum of 20 connections
    # From: https://gist.github.com/vulcan25/55ce270d76bf78044d067c51e23ae5ad
    app.config["postgreSQL_pool"] = psycopg2.pool.SimpleConnectionPool(1, 20,
        host="localhost",
        dbname=database_name,
        user=database_username,
        password=database_password)

    def get_db():
        if "db" not in g:
            g.db = app.config["postgreSQL_pool"].getconn()
        return g.db

    def fetch_author(username: str) -> bool:
        """Discover if an author has blanket permission from the local database and redis cache"""
        username = username.lower()

        value = r.get(username)
        if value:
            return False if value == b"n" else True

        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT username FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        cur.close()

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
            for _, author_page, _, _, _, _ in data["data"]:
                author_page = BeautifulSoup(author_page)

                if author_page.string.lower() == username.lower():
                    author_data = author_page.a["href"]
                    return {"author": author_data}

        return None

    @app.teardown_appcontext
    def close_conn(e):
        print("Closing database connection")
        db = g.pop("db", None)
        if db is not None:
            # Relinquish all connections to db pool
            app.config["postgreSQL_pool"].putconn(db)

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

    return app
