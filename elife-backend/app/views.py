from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, UserDetails, LoginSession
from app import db, login_manager
from datetime import datetime
from app import csrf
from functools import wraps
import jwt
import datetime as dt

auth = Blueprint('auth', __name__)


# JWT Configuration
JWT_SECRET_KEY = 'supersecretkey123'  # Replace with env variable in production
JWT_EXPIRATION_HOURS = 24

def generate_token(user_id):
    """Generate JWT token for authentication"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + dt.timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')

def token_required(f):
    """Decorator to protect API routes with JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Look for token in Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid or expired'}), 401
            
        return f(current_user, *args, **kwargs)
        
    return decorated

@csrf.exempt
@auth.route("/login", methods=["POST"])
def login():
    """API endpoint for user login"""
    data = request.get_json()

    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    # 🔧 Normalize pensioner_number input
    pensioner_number = data.get('pensioner_number', '').replace("-", "").strip()
    password = data.get('password')

    if not pensioner_number or not password:
        return jsonify({'message': 'Missing pensioner_number or password'}), 400

    print("🔍 Normalized login attempt:", pensioner_number)

    # Fetch all users and log comparisons
    all_users = User.query.all()
    for u in all_users:
        print(f"👤 Comparing with DB entry: {u.pensioner_number} → normalized: {u.pensioner_number.replace('-', '').strip()}")

    # Find user by normalized pensioner_number
    user = next(
        (u for u in all_users if u.pensioner_number.replace("-", "").strip() == pensioner_number),
        None
    )

    if user and user.check_password(password):
        # Record login session
        session = LoginSession(
            user_id=user.id,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string
        )
        db.session.add(session)
        db.session.commit()

        # Generate token
        token = generate_token(user.id)

        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'pensioner_number': user.pensioner_number
            }
        }), 200
    else:
        print("❌ Login failed for:", pensioner_number)
        return jsonify({'message': 'Invalid pensioner_number or password'}), 401


@auth.route("/register", methods=["POST"])
def register():
    """API endpoint for user registration"""
    data = request.get_json()
    
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
        
    # Extract data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    pensioner_number = data.get('pensioner_number')
    
    # Validation
    if not username or not email or not password or not confirm_password:
        return jsonify({'message': 'Missing required fields'}), 400
        
    if password != confirm_password:
        return jsonify({'message': 'Passwords do not match'}), 400
        
    # Check if username or email already exists
    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing_user:
        return jsonify({'message': 'Username or email already registered'}), 409
        
    # Create new user
    new_user = User(
        username=username,
        email=email,
        pensioner_number=pensioner_number
    )
    new_user.set_password(password)
    
    # Create empty user details
    new_user_details = UserDetails(user=new_user)
    
    db.session.add(new_user)
    db.session.add(new_user_details)
    db.session.commit()
    
    return jsonify({
        'message': 'Registration successful',
        'user_id': new_user.id
    }), 201

@auth.route("/logout", methods=["POST"])
@token_required
def logout(current_user):
    """API endpoint for user logout"""
    # Update the login session to record logout time
    session = LoginSession.query.filter_by(
        user_id=current_user.id, 
        logout_time=None
    ).order_by(LoginSession.login_time.desc()).first()
    
    if session:
        session.logout_time = datetime.utcnow()
        db.session.commit()
    
    return jsonify({'message': 'Logout successful'}), 200

@auth.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    """API endpoint to get user profile data"""
    user_details = current_user.user_details
    
    profile_data = {
        'id': current_user.id,
        'username': current_user.username,
        'email': current_user.email,
        'pensioner_number': current_user.pensioner_number,
        'details': {
            'firstname': user_details.firstname,
            'lastname': user_details.lastname,
            'dob': user_details.dob.strftime('%Y-%m-%d') if user_details.dob else None,
            'trn': user_details.trn,
            'nids_num': user_details.nids_num,
            'passport_num': user_details.passport_num,
            'contact_num': user_details.contact_num,
            'address': user_details.address
        }
    }
    
    return jsonify(profile_data), 200

@auth.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    """API endpoint to update user profile data"""
    data = request.get_json()
    
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
        
    user_details = current_user.user_details
    
    # Update user details
    if 'details' in data:
        details = data['details']
        user_details.firstname = details.get('firstname', user_details.firstname)
        user_details.lastname = details.get('lastname', user_details.lastname)
        
        if 'dob' in details and details['dob']:
            try:
                user_details.dob = datetime.strptime(details['dob'], '%Y-%m-%d')
            except ValueError:
                return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
                
        user_details.trn = details.get('trn', user_details.trn)
        user_details.nids_num = details.get('nids_num', user_details.nids_num)
        user_details.passport_num = details.get('passport_num', user_details.passport_num)
        user_details.contact_num = details.get('contact_num', user_details.contact_num)
        user_details.address = details.get('address', user_details.address)
    
    # Update email if provided
    if 'email' in data and data['email'] != current_user.email:
        new_email = data['email']
        existing_email = User.query.filter_by(email=new_email).first()
        if existing_email:
            return jsonify({'message': 'Email already in use'}), 409
        current_user.email = new_email
    
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully'}), 200

@auth.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    """API endpoint to change user password"""
    data = request.get_json()
    
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
        
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')
    
    if not current_password or not new_password or not confirm_password:
        return jsonify({'message': 'Missing required fields'}), 400
        
    if not current_user.check_password(current_password):
        return jsonify({'message': 'Current password is incorrect'}), 401
        
    if new_password != confirm_password:
        return jsonify({'message': 'New passwords do not match'}), 400
        
    current_user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200

@auth.route("/validate-token", methods=["GET"])
@token_required
def validate_token(current_user):
    """API endpoint to validate JWT token"""
    return jsonify({
        'valid': True,
        'user_id': current_user.id,
        'username': current_user.username
    }), 200