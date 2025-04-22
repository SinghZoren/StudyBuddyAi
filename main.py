# main.py
from flask import Flask, request, jsonify, render_template
from models.db import init_db, db
from models.auth import auth_bp
from models.processing import process_text  # Import your function
import os

app = Flask(__name__, static_folder='app/static', template_folder='app/templates')

# SECRET_KEY for session management
app.config['SECRET_KEY'] = 'CHANGE_THIS_SECRET'

# Initialize the database
init_db(app)

# Register Blueprints
app.register_blueprint(auth_bp)

@app.route('/')
def index():
    # Render your main index.html
    return render_template('index.html')

# -----------------------------------
# API Route for handling user queries
# -----------------------------------
@app.route('/api/question', methods=['POST'])
def handle_question():
    data = request.json or {}
    user_question = data.get("question")
    if not user_question:
        return jsonify({"response": "Please ask a valid question."}), 400
    try:
        # Call process_text() from processing.py
        response = process_text(user_question)
        return jsonify({"response": response})
    except Exception as e:
        print(f"Error processing question: {e}")
        return jsonify({"response": "An error occurred. Please try again."}), 500

if __name__ == '__main__':
    # Run the Flask app in debug mode
    app.run(debug=True, port=5000)
