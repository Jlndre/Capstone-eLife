from flask import Blueprint, request, jsonify
from app.models import User

api = Blueprint('api', __name__)

@api.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    pensioner_number = data.get('pensioner_number')
    password = data.get('password')

    user = User.query.filter_by(pensioner_number=pensioner_number).first()

    if user and user.check_password(password):
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
