from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, UserDetails, LoginSession, ProofSubmission, IdentityDocument
from app import db, login_manager, csrf
from datetime import datetime, timezone, timedelta
from fuzzywuzzy import fuzz
from functools import wraps
import jwt
import io
import uuid
import cv2
import easyocr
import numpy as np
from firebase_admin import storage
import re
from dateutil.parser import parse


auth = Blueprint('auth', __name__)

JWT_SECRET_KEY = 'supersecretkey123'
JWT_EXPIRATION_HOURS = 24

def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
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

def detect_id_type(text: str) -> str:
    lower_text = text.lower()
    if "passport" in lower_text:
        return "passport"
    elif "driver" in lower_text or "dl" in lower_text:
        return "driver_license"
    elif "national" in lower_text or "nids" in lower_text:
        return "national_id"
    return "unknown"

def extract_expiry_date(raw_text: str):
    """Improved expiry date extraction with structured patterns, OCR noise handling, and timezone-aware comparisons."""
    # Clean up OCR junk while preserving dashes, slashes, and common delimiters
    clean_text = re.sub(r'[^a-zA-Z0-9/\- ,]', '', raw_text)

    date_patterns = [
        r'(20\d{2})-(\d{2})-(\d{2})',                        # ISO format: 2027-07-29
        r'(\d{2})/(\d{2})/(\d{4})',                          # 29/07/2027
        r'(\d{2})-(\d{2})-(\d{4})',                          # 29-07-2027
        r'(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})',  # 29 July 2027
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}',     # July 29, 2027
    ]

    print(f"Trying to parse expiry from: {clean_text}")

    for pattern in date_patterns:
        match = re.search(pattern, clean_text)
        if match:
            try:
                date_str = match.group(0)
                print(f"Pattern matched: {pattern} -> {date_str}")
                parsed_date = parse(date_str, fuzzy=False)
                parsed_date = parsed_date.replace(tzinfo=timezone.utc)  # Make it timezone-aware
                if 2000 <= parsed_date.year <= 2100 and parsed_date > datetime.now(timezone.utc):
                    return parsed_date
            except Exception as e:
                print(f"Parse failed for: {match.group(0)} -> {e}")
                continue

    # Fallback to fuzzy parsing of the whole string
    try:
        parsed_date = parse(clean_text, fuzzy=True)
        parsed_date = parsed_date.replace(tzinfo=timezone.utc)
        if 2000 <= parsed_date.year <= 2100 and parsed_date > datetime.now(timezone.utc):
            return parsed_date
    except Exception as e:
        print("Fallback parse failed:", e)

    return None


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
        session.logout_time = datetime.now(timezone.utc)
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

        bucket = storage.bucket()
        blob = bucket.blob(f"id_uploads/{filename}")
        blob.upload_from_file(file, content_type=content_type)
        blob.make_public()
        image_url = blob.public_url
        print("Uploaded to Firebase:", image_url)

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

        user_details = current_user.user_details
        if not user_details:
            return jsonify({
                "error": "User profile details are missing.",
                "message": "Please complete your profile before uploading ID."
            }), 400

        # Tokenize and normalize OCR text
        tokens = re.findall(r'[a-zA-Z]+', extracted_text.lower())
        normalized_text = " ".join(tokens)
        flat_text = normalized_text.replace(" ", "")
        print("OCR Tokens:", tokens)
        print("Normalized OCR Text:", normalized_text)

        # Normalize expected name components
        first = re.sub(r'[^a-zA-Z0-9]', '', user_details.firstname).lower()
        last = re.sub(r'[^a-zA-Z0-9]', '', user_details.lastname).lower()

        expected_names = [
            f"{first}{last}",
            f"{last}{first}",
            f"{first} {last}",
            f"{last} {first}"
        ]

        # Fuzzy name match
        name_match = any(
            fuzz.token_set_ratio(expected, normalized_text) > 80
            for expected in expected_names
        )

        # Fallback: plain substring match
        if not name_match:
            name_match = first in flat_text and last in flat_text

        id_type = request.form.get("id_type") or detect_id_type(extracted_text)
        print("Detected ID type:", id_type)

        expected_id_number = None
        if id_type == 'driver_license':
            expected_id_number = user_details.trn
        elif id_type == 'national_id':
            expected_id_number = user_details.nids_num
        elif id_type == 'passport':
            expected_id_number = user_details.passport_num

        id_match = expected_id_number and expected_id_number in extracted_text

        expiry_date = extract_expiry_date(extracted_text)  # Pass full raw text here

        print("Full Extracted Text:", extracted_text)
        print("Extracted expiry date:", expiry_date)
        print("Current UTC time:", datetime.now(timezone.utc))

        expiry_valid = expiry_date is not None

        submission = ProofSubmission(
            user_id=current_user.id,
            id_image_url=image_url,
            status='pending',
            submitted_at=datetime.now(timezone.utc)
        )
        db.session.add(submission)
        db.session.commit()

        doc = IdentityDocument(
            user_id=current_user.id,
            proof_submission_id=submission.id,
            type=id_type,
            image_url=image_url,
            expiry_date=expiry_date
        )
        db.session.add(doc)
        db.session.commit()

        print("Name Match:", name_match)
        print("ID Match:", id_match)
        print("Expiry Valid:", expiry_valid)

        if name_match and id_match and expiry_valid:
            return jsonify({
                'message': 'ID verified successfully',
                'next_step': 'facial_verification',
                'submission_id': submission.id,
                'id_type_detected': id_type
            }), 200
        else:
            return jsonify({
                'message': 'ID verification failed. Please try again or contact support.',
                'next_step': 'retry_or_escalate',
                'ocr_result': extracted_text,
                'name_match': name_match,
                'id_match': id_match,
                'expiry_valid': expiry_valid,
                'id_type_detected': id_type
            }), 400

    except Exception as e:
        print("INTERNAL SERVER ERROR:", str(e))
        return jsonify({'message': 'Internal server error', 'error': str(e)}), 500
