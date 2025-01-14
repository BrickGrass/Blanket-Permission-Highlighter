from datetime import timedelta
import json

from bs4 import BeautifulSoup
from redis import Redis
from flask import Flask, jsonify, g, request
import psycopg2
from psycopg2 import pool
from typing import Optional

with open("config.json") as f:
    data = json.load(f)
    database_name = data["database_name"]
    database_username = data["database_username"]
    database_password = data["database_password"]

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

    def fetch_author_profile(username: str) -> Optional[dict]:
        """Discover if an author has an fpslist.org page from the local database and redis cache"""
        username = username.lower()

        author_page = r.get(f"data.{username}")
        if author_page:
            return None if author_page == b"n" else {"author": author_page.decode("utf-8")}

        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT fps_profile FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        cur.close()

        if row:
            author_page = row[0]
            r.setex(f"data.{username}", cache_time, author_page)
            return {"author": author_page}

        r.setex(f"data.{username}", cache_time, "n")
        return None

    @app.teardown_appcontext
    def close_conn(e):
        db = g.pop("db", None)
        if db is not None:
            # Relinquish all connections to db pool
            app.config["postgreSQL_pool"].putconn(db)

    @app.route("/bp_api/author_exists/<username>")
    def author_exists(username):
        author = fetch_author(username)
        return jsonify({"exists": author}), 200

    @app.route("/bp_api/authors_exist", methods=["GET", "POST"])
    def authors_exist():
        content = request.get_json(silent=True)
        if not content:
            return "Invalid request, no authors provided", 400

        try:
            authors = content["authors"]
        except KeyError:
            return "Invalid request, no authors provided", 400

        if type(authors) != list:
            return "Invalid request, 'authors' must be a list", 400

        authors = list(set(authors))  # Remove duplicates

        message = {"exist": [], "dont_exist": []}

        for username in authors:
            username = str(username)
            exists = fetch_author(username)
            if exists:
                message["exist"].append(username)
            else:
                message["dont_exist"].append(username)

        return jsonify(message), 200

    @app.route("/bp_api/author_data/<username>")
    def author_data(username):
        author = fetch_author_profile(username)

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
