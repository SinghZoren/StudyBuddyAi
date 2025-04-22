# auth.py
import openai
from flask import Blueprint, request, jsonify, session, current_app
from models.db import db
from models.user import User
import datetime

auth_bp = Blueprint('auth', __name__)

# In production, store your key in an env var or config file
openai.api_key = "YOUR_OPENAI_API_KEY"


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    # Check if user already exists
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "Email is already in use"}), 400

    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registered successfully"}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    # Mark user as logged in
    session['user_id'] = user.id
    return jsonify({"message": "Logged in"}), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({"message": "Logged out"}), 200


@auth_bp.route('/api/gpt4', methods=['POST'])
def call_gpt4():
    """
    Example endpoint for GPT-4 usage.
    1. Check user logged in.
    2. Check usage limit.
    3. If OK, call GPT-4, increment usage.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Possibly reset usage if new month
    user.reset_monthly_usage_if_needed()

    if user.is_over_limit():
        return jsonify({"error": "Usage limit reached."}), 403

    data = request.json or {}
    question = data.get('question')
    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        messages = [
            {"role": "system", "content": "You are a helpful, coherent AI assistant."},
            {"role": "user", "content": question}
        ]
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
            temperature=0.2,
            max_tokens=250
        )
        answer = response['choices'][0]['message']['content'].strip()
    except Exception as e:
        current_app.logger.error(f"GPT-4 Error: {e}")
        return jsonify({"error": "Failed to call GPT-4"}), 500

    # increment usage
    user.increment_usage()
    db.session.commit()

    return jsonify({"answer": answer}), 200
