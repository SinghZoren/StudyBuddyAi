# models/db.py
import os
from flask_sqlalchemy import SQLAlchemy
from flask import Flask

db = SQLAlchemy()

def init_db(app: Flask):
    """
    Initialize the database with given Flask app config.
    """
    # Example: store the SQLite file at the project root
    db_path = os.path.join(os.path.dirname(__file__), '..', 'studybuddy.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    with app.app_context():
        db.create_all()
