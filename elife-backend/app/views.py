from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, UserDetails, LoginSession, ProofSubmission, IdentityDocument
from app import db, login_manager, csrf
from datetime import datetime
from functools import wraps
import jwt
import datetime as dt
import io
import uuid
import cv2
import easyocr
import numpy as np
from firebase_admin import storage
import re

auth = Blueprint('auth', __name__)

JWT_SECRET_KEY = 'supersecretkey123'
JWT_EXPIRATION_HOURS = 24

def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + dt.timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
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
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No input data provided'}), 400

        pensioner_number = data.get('pensioner_number', '').replace("-", "").strip()
        password = data.get('password')
        if not pensioner_number or not password:
            return jsonify({'message': 'Missing pensioner_number or password'}), 400

        all_users = User.query.all()
        user = next(
            (u for u in all_users if u.pensioner_number.replace("-", "").strip() == pensioner_number),
            None
        )

        if user and user.check_password(password):
            session = LoginSession(
                user_id=user.id,
                ip_address=request.remote_addr,
                user_agent=request.user_agent.string
            )
            db.session.add(session)
            db.session.commit()

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
            return jsonify({'message': 'Invalid pensioner_number or password'}), 401

    except Exception as e:
        print("LOGIN ERROR:", str(e))
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500


@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    pensioner_number = data.get('pensioner_number')
    if not username or not email or not password or not confirm_password:
        return jsonify({'message': 'Missing required fields'}), 400
    if password != confirm_password:
        return jsonify({'message': 'Passwords do not match'}), 400
    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing_user:
        return jsonify({'message': 'Username or email already registered'}), 409
    new_user = User(
        username=username,
        email=email,
        pensioner_number=pensioner_number
    )
    new_user.set_password(password)
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
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
    user_details = current_user.user_details
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
    return jsonify({
        'valid': True,
        'user_id': current_user.id,
        'username': current_user.username
    }), 200

@csrf.exempt
@auth.route("/verify-id-upload", methods=["POST"])
@token_required
def verify_id_upload(current_user):
    try:
        print("Received ID upload request from:", current_user.username)

        if 'id_image' not in request.files:
            return jsonify({'message': 'No file uploaded'}), 400

        file = request.files['id_image']
        content_type = file.content_type
        filename = f"{uuid.uuid4()}_{file.filename}"

        # Upload to Firebase Storage
        bucket = storage.bucket()
        blob = bucket.blob(f"id_uploads/{filename}")
        blob.upload_from_file(file, content_type=content_type)
        blob.make_public()
        image_url = blob.public_url
        print("Uploaded to Firebase:", image_url)

        # Read image for processing
        file.stream.seek(0)
        npimg = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        try:
            reader = easyocr.Reader(['en'], gpu=False)
            result = reader.readtext(image)
        except Exception as e:
            return jsonify({'message': f'OCR processing failed: {str(e)}'}), 500

        extracted_text = " ".join([r[1] for r in result])
        print("OCR Extracted:", extracted_text)

        # Match user details
        user_details = current_user.user_details
        name_match = (
            user_details.firstname.lower() in extracted_text.lower() and 
            user_details.lastname.lower() in extracted_text.lower()
        )
        trn_match = user_details.trn and user_details.trn in extracted_text

        # Check expiry date
        date_match = re.search(r'\b(\d{2}/\d{2}/\d{4})\b', extracted_text)
        expiry_valid = False
        expiry_date = None
        if date_match:
            try:
                expiry_date = dt.strptime(date_match.group(1), "%d/%m/%Y")
                expiry_valid = expiry_date > dt.now()
            except Exception as e:
                print("Failed to parse expiry date:", e)

        # Save to DB
        submission = ProofSubmission(
            user_id=current_user.id,
            id_image_url=image_url,
            status='pending',
            submitted_at=dt.utcnow()
        )
        db.session.add(submission)
        db.session.commit()

        doc = IdentityDocument(
            user_id=current_user.id,
            proof_submission_id=submission.id,
            type="national_id",
            image_url=image_url,
            expiry_date=expiry_date
        )
        db.session.add(doc)
        db.session.commit()

        # Final decision
        if name_match and trn_match and expiry_valid:
            return jsonify({
                'message': 'ID verified successfully',
                'next_step': 'facial_verification',
                'submission_id': submission.id
            }), 200
        else:
            return jsonify({
                'message': 'ID verification failed. Please try again or contact support.',
                'next_step': 'retry_or_escalate',
                'ocr_result': extracted_text
            }), 400

    except Exception as e:
        print("INTERNAL SERVER ERROR:", str(e))
        return jsonify({'message': 'Internal server error', 'error': str(e)}), 500
