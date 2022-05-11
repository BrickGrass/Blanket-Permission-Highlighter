import csv
import json

import psycopg2

with open("config.json") as f:
    data = json.load(f)
    database_name = data["database_name"]
    database_username = data["database_username"]
    database_password = data["database_password"]

conn = psycopg2.connect(
    host="localhost",
    dbname=database_name,
    user=database_username,
    password=database_password)


def create_database():
    """Create database table"""
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS users (username VARCHAR(255) UNIQUE NOT NULL);")
    conn.commit()
    cur.close()


def populate_database(csv_name):
    """Clear database and repopulate it from a csv file"""
    cur = conn.cursor()

    cur.execute("DELETE FROM users")
    conn.commit()

    with open(csv_name, newline="") as csv_file:
        csv_reader = csv.reader(csv_file)
        # TODO: If this is slow, rewrite it to do it in a single insert, lol
        for row in csv_reader:
            cur.execute("INSERT INTO users (username) VALUES (%s)", (row[0],))

    conn.commit()
    cur.close()


if __name__ == "__main__":
    create_database()
    populate_database("viewHighlighter_11MAY2022.csv")
