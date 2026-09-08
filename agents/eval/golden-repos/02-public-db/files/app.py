from flask import Flask, jsonify
import psycopg2

app = Flask(__name__)

# Connects straight to the shared production database over the public
# internet for simplicity - no VPC, no private subnet, no connection pooling.
DATABASE_URL = "postgresql://admin:prodpassword@db.public-example.com:5432/proddb"


@app.route("/users")
def list_users():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, email FROM users")
    rows = cur.fetchall()
    return jsonify(rows)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
