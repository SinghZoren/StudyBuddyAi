# models/user.py
import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from .db import db

class User(db.Model):
    """
    Basic user model with:
      - email
      - password_hash
      - usage_this_month
      - monthly_limit
      - last_reset_date
    """
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    usage_this_month = db.Column(db.Integer, default=0)
    monthly_limit = db.Column(db.Integer, default=50)  # default free-tier limit
    last_reset_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password) -> bool:
        return check_password_hash(self.password_hash, password)

    def reset_monthly_usage_if_needed(self):
        """
        If the month changed since last_reset_date, reset usage to 0.
        This is a naive approach – you'd refine for production or use a cron job.
        """
        now = datetime.datetime.utcnow()
        if (now.year != self.last_reset_date.year) or (now.month != self.last_reset_date.month):
            self.usage_this_month = 0
            self.last_reset_date = now

    def increment_usage(self):
        self.usage_this_month += 1

    def is_over_limit(self):
        return self.usage_this_month >= self.monthly_limit

    def __repr__(self):
        return f"<User {self.email}>"
