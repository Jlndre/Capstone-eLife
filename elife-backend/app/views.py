import traceback
from flask import Blueprint, json, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, UserDetails, LoginSession, ProofSubmission, QuarterVerification, Notification, IdentityDocument, DigitalCertificate
from app import db, login_manager
from datetime import datetime, timezone
from app import csrf
from functools import wraps
import jwt
import datetime as dt
import cv2        
from fuzzywuzzy import fuzz            
import numpy as np     
import easyocr
import uuid
from firebase_admin import storage
import re
from dateutil.parser import parse       
from tensorflow.keras.models import load_model
from sklearn.metrics.pairwise import cosine_similarity
import shutil
import tempfile
import os
import mediapipe as mp # type: ignore
from keras_facenet import FaceNet


auth = Blueprint('auth', __name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
mp_face_mesh = mp.solutions.face_mesh
embedder = FaceNet()

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

        # 🔎 Step 1: Extract token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            print("[Auth] Missing token")
            return jsonify({'message': 'Token is missing'}), 401

        try:
            # 🔎 Step 2: Decode JWT
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])

            if current_user is None:
                print(f"[Auth] Token valid but user not found: user_id={data['user_id']}")
                return jsonify({'message': 'User not found'}), 401

        except jwt.ExpiredSignatureError:
            print("[Auth] Token expired")
            return jsonify({'message': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            print(f"[Auth] Invalid token: {e}")
            return jsonify({'message': 'Invalid token'}), 401
        except Exception as e:
            print(f"[Auth] Unexpected error during token validation: {e}")
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
    clean_text = re.sub(r'[^\w\s:/\-]', '', raw_text)
    tokens = clean_text.split()
    now = datetime.now(timezone.utc)
    candidate_dates = []
    expiry_keywords = ["expiry", "expires", "expiration", "exp", "valid", "validity"]

    for i, token in enumerate(tokens):
        if token.lower() in expiry_keywords and i + 1 < len(tokens):
            try:
                parsed = parse(tokens[i + 1], fuzzy=False).replace(tzinfo=timezone.utc)
                if parsed > now:
                    return parsed
            except:
                continue

    date_patterns = [
        r'(20\d{2})[-/](\d{2})[-/](\d{2})',
        r'(\d{2})[-/](\d{2})[-/](\d{4})',
        r'(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})',
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}',
    ]

    for pattern in date_patterns:
        matches = re.findall(pattern, clean_text)
        for match in matches:
            try:
                date_str = " ".join(match) if isinstance(match, tuple) else match
                parsed = parse(date_str, fuzzy=True).replace(tzinfo=timezone.utc)
                if parsed > now:
                    candidate_dates.append(parsed)
            except:
                continue

    return max(candidate_dates) if candidate_dates else None

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
            "terms_accepted": user.terms_accepted,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'pensioner_number': user.pensioner_number
            }
        }), 200
    else:
        print("Login failed for:", pensioner_number)
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

@auth.route('/api/dashboard-summary', methods=['GET'])
@token_required
def dashboard_summary(current_user):
    today = datetime.utcnow().date()
    year = today.year

    all_quarters = QuarterVerification.query.filter_by(
        user_id=current_user.id, year=year
    ).order_by(QuarterVerification.due_date).all()

    current = None
    upcoming = []
    completed = []
    missed = []

    for q in all_quarters:
        entry = {
            "quarter": q.quarter,
            "year": q.year,
            "status": q.status,
            "due_date": q.due_date.strftime('%Y-%m-%d'),
            "verified_at": q.verified_at.strftime('%Y-%m-%d') if q.verified_at else None,
            "ref": q.proof_submission_id
        }

        if q.status == 'completed':
            completed.append(entry)
        elif q.status == 'missed':
            missed.append(entry)
        elif q.due_date >= today and not current:
            # Assign first matching future quarter as current
            current = entry
        elif q.due_date > today:
            upcoming.append(entry)
        elif q.due_date < today and not q.verified_at:
            missed.append(entry)

    full_name = f"{current_user.user_details.firstname} {current_user.user_details.lastname}"

    return jsonify({
        "year": year,
        "name": full_name,
        "trn": current_user.user_details.trn,
        "active": not missed,
        "current": current,
        "completed": completed,
        "upcoming": upcoming,
        "missed": missed
    })


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

@csrf.exempt
@auth.route("/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.sent_at.desc()).all()
    return jsonify([
        {
            'id': n.id,
            'type': n.type,
            'message': n.message,
            'sent_at': n.sent_at.strftime('%Y-%m-%d %H:%M:%S'),
            'is_read': n.is_read
        }
        for n in notifications
    ]), 200

@csrf.exempt
@auth.route("/notifications/test", methods=["POST"])
@token_required
def create_test_notification(current_user):
    data = request.get_json()
    message = data.get("message", "This is a test notification")
    notif_type = data.get("type", "reminder")
    target_quarter = data.get("target_quarter", None)

    notification = Notification(
        user_id=current_user.id,
        type=notif_type,
        message=message,
        target_quarter=target_quarter,
        sent_at=datetime.utcnow(),
        is_read=False
    )

    db.session.add(notification)
    db.session.commit()

    return jsonify({
        "message": "Test notification created",
        "notification": {
            "id": notification.id,
            "type": notification.type,
            "message": notification.message,
            "target_quarter": notification.target_quarter,
            "sent_at": notification.sent_at.strftime('%Y-%m-%d %H:%M:%S'),
            "is_read": notification.is_read
        }
    }), 201

@csrf.exempt
@auth.route("/notifications/<int:notification_id>/read", methods=["POST"])
@token_required
def mark_notification_read(current_user, notification_id):
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first()

    if not notification:
        return jsonify({'message': 'Notification not found'}), 404

    notification.is_read = True
    db.session.commit()

    return jsonify({'message': 'Notification marked as read'}), 200

@auth.route("/verification-history", methods=["GET"])
@token_required
def get_verification_history(current_user):
    """
    Returns all verified Digital Certificates for the current user in the past 2 years.
    """
    from datetime import timedelta

    two_years_ago = datetime.utcnow() - timedelta(days=730)

    certificates = (
        current_user.certificates
        if current_user.certificates else []
    )

    recent_verified = [
        {
            "id": cert.id,
            "date": cert.timestamp.strftime("%B %d, %Y"),
            "status": "Verified",
            "quarter": cert.quarter,
        }
        for cert in certificates
        if cert.timestamp >= two_years_ago
    ]

    return jsonify(recent_verified), 200


@csrf.exempt
@auth.route("/detect-face", methods=['POST'])
@token_required
def detect_face(current_user):
    try:
        if 'image' not in request.files:
            return jsonify({"error": "Image file is required"}), 400

        file = request.files['image']
        img_bytes = file.read()

        # Decode image
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Could not decode image"}), 400

        # Convert to RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        ih, iw, _ = img.shape

        with mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        ) as face_mesh:

            results = face_mesh.process(img_rgb)

            if not results.multi_face_landmarks:
                return jsonify({"success": True, "face_count": 0, "faces": []})

            face_landmarks_list = []

            for face_landmarks in results.multi_face_landmarks:
                landmarks = []
                xs = []
                ys = []

                for lm in face_landmarks.landmark:
                    x = int(lm.x * iw)
                    y = int(lm.y * ih)
                    xs.append(x)
                    ys.append(y)
                    landmarks.append({"x": x, "y": y})

                bounding_box = {
                    "x": min(xs),
                    "y": min(ys),
                    "width": max(xs) - min(xs),
                    "height": max(ys) - min(ys)
                }

                face_landmarks_list.append({
                    "landmark_count": len(landmarks),
                    "landmarks": landmarks,
                    "bounding_box": bounding_box
                })

            return jsonify({
                "success": True,
                "face_count": len(face_landmarks_list),
                "faces": face_landmarks_list
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Face mesh detection failed",
            "details": str(e)
        }), 500

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

        file.stream.seek(0)
        npimg = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        # Deepfake detection on cropped face
        from app.services.deepfake_detector import is_deepfake
        is_fake, face_crop = is_deepfake(image)
        print("IS your ID Fake:", is_fake)
        if is_fake is None:
            return jsonify({'message': 'Face detection failed or no face found in ID image.'}), 400

        if is_fake:
            return jsonify({
                'message': 'Upload rejected: The face on this ID appears to be tampered or synthetic.',
                'deepfake_detected': True
            }), 400

        # Upload cropped face to Firebase
        bucket = storage.bucket()
        face_filename = f"{uuid.uuid4()}_face_crop.jpg"
        _, buffer = cv2.imencode('.jpg', face_crop)
        face_blob = bucket.blob(f"id_faces/{face_filename}")
        face_blob.upload_from_string(buffer.tobytes(), content_type="image/jpeg")
        face_blob.make_public()
        face_image_url = face_blob.public_url
        print("Uploaded cropped face to Firebase:", face_image_url)

        # OCR
        try:
            reader = easyocr.Reader(['en'], gpu=False)
            resized = cv2.resize(image, (600, 400))  # Speed up OCR
            result = reader.readtext(resized)

            print("Proceeding to OCR and text validation...")
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

        # Normalize OCR text
        tokens = re.findall(r'[a-zA-Z]+', extracted_text.lower())
        normalized_text = " ".join(tokens)
        flat_text = normalized_text.replace(" ", "")
        print("OCR Tokens:", tokens)
        print("Normalized OCR Text:", normalized_text)

        first = re.sub(r'[^a-zA-Z0-9]', '', user_details.firstname).lower()
        last = re.sub(r'[^a-zA-Z0-9]', '', user_details.lastname).lower()

        expected_names = [
            f"{first}{last}",
            f"{last}{first}",
            f"{first} {last}",
            f"{last} {first}"
        ]

        name_match = any(
            fuzz.token_set_ratio(expected, normalized_text) > 80
            for expected in expected_names
        )
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

        expiry_date = extract_expiry_date(extracted_text)
        print("Full Extracted Text:", extracted_text)
        print("Extracted expiry date:", expiry_date)
        print("Current UTC time:", datetime.now(timezone.utc))

        expiry_valid = expiry_date is not None

        # Save submission with face image URL
        submission = ProofSubmission(
            user_id=current_user.id,
            id_image_url=face_image_url,
            status='pending',
            submitted_at=datetime.now(timezone.utc)
        )
        db.session.add(submission)
        db.session.commit()

        doc = IdentityDocument(
            user_id=current_user.id,
            proof_submission_id=submission.id,
            type=id_type,
            image_url=face_image_url,
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

@csrf.exempt
@auth.route("/verify-images", methods=["POST"])
@token_required
def verify_images(current_user):
    try:
        print(f"[Verify] Received image sequence upload from {current_user.username}")

        images = request.files.getlist('images')
        if not images or len(images) < 1:
            return jsonify({'message': 'At least one image is required'}), 400

        print(f"Received {len(images)} images for verification")
        temp_dir = tempfile.mkdtemp()
        image_urls, local_image_paths = [], []
        bucket = storage.bucket()

        for idx, image in enumerate(images):
            filename = f"{uuid.uuid4()}_{idx}.jpg"
            blob = bucket.blob(f"verification_images/{filename}")
            blob.upload_from_file(image, content_type=image.content_type or 'image/jpeg')
            blob.make_public()
            image_url = blob.public_url
            image_urls.append(image_url)

            image.stream.seek(0)
            local_path = os.path.join(temp_dir, filename)
            image.save(local_path)
            local_image_paths.append(local_path)

        clearest_image_path = select_clearest_image(local_image_paths)
        if not clearest_image_path:
            shutil.rmtree(temp_dir)
            return jsonify({'message': 'Failed to find a clear image for verification'}), 422

        # -------- Deepfake Detection --------
        frame = cv2.imread(clearest_image_path)
        frame = cv2.resize(frame, (128, 128)) / 255.0
        if frame.ndim == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
        elif frame.shape[-1] == 4:
            frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2RGB)
        frame_input = np.expand_dims(frame, axis=0).astype("float32")

        deepfake_model = load_model(os.path.join(BASE_DIR, 'models', 'elife_deepfake_detector_test.keras'))
        deepfake_score = deepfake_model.predict(frame_input)[0][0]
        is_deepfake = deepfake_score > 0.5
        print("Deepfake score:", deepfake_score)

        # -------- FaceNet Identity Match with Improved Similarity --------
        id_doc = IdentityDocument.query.filter_by(user_id=current_user.id).order_by(IdentityDocument.id.desc()).first()
        if not id_doc:
            shutil.rmtree(temp_dir)
            return jsonify({'message': 'No ID document found'}), 404

        id_image_blob = bucket.blob(id_doc.image_url.replace(f"https://storage.googleapis.com/{bucket.name}/", ""))
        id_image_path = os.path.join(temp_dir, "id_image.jpg")
        id_image_blob.download_to_filename(id_image_path)

        # Load and preprocess images
        id_img = cv2.imread(id_image_path)
        face_img = cv2.imread(clearest_image_path)

        # Apply face detection first to extract only the face regions
        face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        # Detect faces in both images
        id_gray = cv2.cvtColor(id_img, cv2.COLOR_BGR2GRAY)
        face_gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)

        id_faces = face_detector.detectMultiScale(id_gray, 1.1, 4)
        face_faces = face_detector.detectMultiScale(face_gray, 1.1, 4)

        # Get the largest face from each image
        if len(id_faces) > 0:
            id_img = get_largest_face(id_faces, id_img)
        if len(face_faces) > 0:
            face_img = get_largest_face(face_faces, face_img)

        # Resize both images to FaceNet expected input shape: (160, 160)
        id_img = cv2.resize(id_img, (160, 160))
        face_img = cv2.resize(face_img, (160, 160))

        # Preprocess images for embedder
        id_input = preprocess_image(id_img)
        face_input = preprocess_image(face_img)

        # Get embeddings
        id_embedding = embedder.embeddings(id_input)
        frame_embedding = embedder.embeddings(face_input)

        # Calculate cosine similarity
        raw_similarity = cosine_similarity(frame_embedding, id_embedding)[0][0]

        # Apply L2 normalization to embeddings before calculating distance
        id_embedding_norm = l2_normalize(id_embedding)
        frame_embedding_norm = l2_normalize(frame_embedding)

        # Calculate Euclidean distance (lower is better)
        euclidean_distance = np.linalg.norm(frame_embedding_norm - id_embedding_norm)

        # Use multiple similarity metrics for a more robust comparison
        adjusted_cosine = (raw_similarity + 1) / 2  # Convert from [-1,1] to [0,1]

        # Very loose threshold - using both metrics
        is_match = adjusted_cosine > 0.1 or euclidean_distance < 1.5

        # Log detailed matching information
        print(f"Face match results:")
        print(f"- Raw cosine similarity: {raw_similarity:.4f}")
        print(f"- Adjusted cosine similarity: {adjusted_cosine:.4f}")
        print(f"- Euclidean distance: {euclidean_distance:.4f}")
        print(f"- Final match decision: {is_match}")

        # Save comparison images for debugging if needed
        debug_dir = os.path.join(temp_dir, "debug")
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(os.path.join(debug_dir, "id_processed.jpg"), cv2.cvtColor(id_img, cv2.COLOR_RGB2BGR))
        cv2.imwrite(os.path.join(debug_dir, "face_processed.jpg"), cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR))

        # Calculate confidence score and prepare match result
        confidence_score = (adjusted_cosine + (1.0 - min(euclidean_distance, 2.0) / 2.0)) / 2.0
        
        # Record result
        proof = ProofSubmission(
            user_id=current_user.id,
            id_image_url=id_doc.image_url,
            video_url=None,
            image_urls=json.dumps(image_urls),
            status='approved' if is_match and not is_deepfake else 'flagged',
            submitted_at=datetime.now(timezone.utc),
            verified_at=datetime.now(timezone.utc),
            notes=f"Similarity: {adjusted_cosine:.2f}, Deepfake Score: {deepfake_score:.2f}"
        )
        db.session.add(proof)
        db.session.commit()
        shutil.rmtree(temp_dir)

        return jsonify({
            "success": bool(is_match and not is_deepfake),
            "match": bool(is_match),
            "deepfake_detected": bool(is_deepfake),
            "similarity": float(adjusted_cosine),
            "deepfake_score": float(deepfake_score),
            "image_urls": image_urls
        }), 200

    except Exception as e:
        print("VERIFY-IMAGES ERROR:", str(e))
        traceback.print_exc()
        return jsonify({'message': 'Internal server error', 'error': str(e)}), 500


def get_largest_face(faces, img):
    """
    Get the largest face in an image.
    """
    if len(faces) == 0:
        # If no face detected, use the whole image
        return img
    
    largest_area = 0
    largest_face = None
    
    for (x, y, w, h) in faces:
        if w * h > largest_area:
            largest_area = w * h
            largest_face = (x, y, w, h)
    
    x, y, w, h = largest_face
    # Add some margin around the face
    margin = int(min(w, h) * 0.2)
    x_start = max(0, x - margin)
    y_start = max(0, y - margin)
    x_end = min(img.shape[1], x + w + margin)
    y_end = min(img.shape[0], y + h + margin)
    
    return img[y_start:y_end, x_start:x_end]


def preprocess_image(img):
    """
    Preprocess image for the face embedder.
    """
    # Convert to RGB
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # Normalize pixel values to [-1, 1]
    img = (img.astype(np.float32) - 127.5) / 127.5
    # Expand dimensions to create batch of size 1
    return np.expand_dims(img, axis=0)


def l2_normalize(x):
    """
    Apply L2 normalization to embeddings.
    """
    return x / np.sqrt(np.sum(np.square(x), axis=1, keepdims=True))


def select_clearest_image(image_paths):
    """
    Select the clearest image from a list of image paths using Laplacian variance.
    Higher variance indicates a clearer, more focused image.
    """
    if not image_paths:
        return None
        
    clearest_path = None
    highest_variance = -1
    
    for path in image_paths:
        try:
            img = cv2.imread(path)
            if img is None:
                continue
                
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if variance > highest_variance:
                highest_variance = variance
                clearest_path = path
        except Exception as e:
            print(f"Error processing image {path}: {e}")
            continue
    
    return clearest_path


@auth.route("/accept-terms", methods=["POST"])
@token_required
def accept_terms(current_user):
    current_user.terms_accepted = True
    db.session.commit()
    return jsonify({"message": "Terms accepted"}), 200


@csrf.exempt
@auth.route("/certificates/<int:certificate_id>", methods=["GET"])
@token_required
def get_certificate(current_user, certificate_id):
    """
    Get a specific certificate by ID
    """
    try:
        # Find the certificate
        certificate = DigitalCertificate.query.filter_by(
            id=certificate_id,
            user_id=current_user.id
        ).first()
        
        if not certificate:
            return jsonify({
                "success": False,
                "message": "Certificate not found"
            }), 404
            
        # Parse content snapshot if it exists
        content_snapshot = None
        if certificate.content_snapshot:
            try:
                content_snapshot = json.loads(certificate.content_snapshot)
            except:
                content_snapshot = certificate.content_snapshot
        
        # Return the certificate details
        return jsonify({
            "id": certificate.id,
            "user_id": certificate.user_id,
            "proof_submission_id": certificate.proof_submission_id,
            "quarter": certificate.quarter,
            "timestamp": certificate.timestamp.isoformat(),
            "digital_signature_hash": certificate.digital_signature_hash,
            "content_snapshot": content_snapshot
        }), 200
        
    except Exception as e:
        print("Get certificate error:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to retrieve certificate",
            "error": str(e)
        }), 500

@csrf.exempt
@auth.route("/generate-certificate", methods=["POST"])
@token_required
def generate_certificate(current_user):
    """
    Generate a digital certificate based on the most recent approved proof submission
    """
    try:
        data = request.get_json()
        quarter = data.get('quarter', None)
        
        if not quarter:
            # Generate the current quarter if not provided
            now = datetime.utcnow()
            year = now.year
            month = now.month
            
            if month < 4:
                quarter_num = 1
            elif month < 7:
                quarter_num = 2
            elif month < 10:
                quarter_num = 3
            else:
                quarter_num = 4
                
            quarter = f"Q{quarter_num}-{year}"
        
        # Find the most recent approved proof submission
        proof_submission = ProofSubmission.query.filter_by(
            user_id=current_user.id,
            status='approved'
        ).order_by(ProofSubmission.verified_at.desc()).first()
        
        if not proof_submission:
            return jsonify({
                "success": False,
                "message": "No approved verification found"
            }), 404
        
        # Check if a certificate already exists for this submission
        existing_cert = DigitalCertificate.query.filter_by(
            proof_submission_id=proof_submission.id
        ).first()
        
        if existing_cert:
            # Return the existing certificate
            # Parse content snapshot if it exists
            content_snapshot = None
            if existing_cert.content_snapshot:
                try:
                    content_snapshot = json.loads(existing_cert.content_snapshot)
                except:
                    content_snapshot = existing_cert.content_snapshot
                    
            return jsonify({
                "success": True,
                "message": "Certificate already exists",
                "certificate": {
                    "id": existing_cert.id,
                    "user_id": existing_cert.user_id,
                    "proof_submission_id": existing_cert.proof_submission_id,
                    "quarter": existing_cert.quarter,
                    "timestamp": existing_cert.timestamp.isoformat(),
                    "digital_signature_hash": existing_cert.digital_signature_hash,
                    "content_snapshot": content_snapshot
                }
            }), 200
        
        # Create a content snapshot with user details
        user_details = current_user.user_details
        
        if not user_details:
            return jsonify({
                "success": False,
                "message": "User details not found"
            }), 400
        
        content = {
            "pensioner_number": current_user.pensioner_number,
            "user_id": current_user.id,
            "fullName": f"{user_details.firstname} {user_details.lastname}",
            "dob": user_details.dob.strftime('%Y-%m-%d') if user_details.dob else None,
            "trn": user_details.trn,
            "verification_method": "Facial Recognition & ID Verification",
            "quarter": quarter,
            "issue_date": datetime.utcnow().isoformat(),
            "expiry_date": None  # Could calculate based on quarter end
        }
        
        # Generate a hash for digital signature (in a real app, use proper PKI)
        content_str = json.dumps(content, sort_keys=True)
        digital_signature = hashlib.sha256(content_str.encode()).hexdigest()
        
        # Create the certificate
        new_certificate = DigitalCertificate(
            user_id=current_user.id,
            proof_submission_id=proof_submission.id,
            certificate_filename=f"certificate_{current_user.id}_{quarter}.json",
            content_snapshot=content_str,
            digital_signature_hash=digital_signature,
            quarter=quarter
        )
        
        db.session.add(new_certificate)
        
        # Update or create quarter verification
        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id,
            quarter=quarter.split('-')[0],  # Extract Q1, Q2, etc.
            year=int(quarter.split('-')[1])  # Extract year
        ).first()
        
        if quarter_verification:
            quarter_verification.status = 'completed'
            quarter_verification.verified_at = datetime.utcnow()
            quarter_verification.proof_submission_id = proof_submission.id
        else:
            # If quarter verification doesn't exist, create it
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter.split('-')[0],
                year=int(quarter.split('-')[1]),
                status='completed',
                verified_at=datetime.utcnow(),
                proof_submission_id=proof_submission.id,
                due_date=datetime.utcnow()  # Set to current date or calculate proper due date
            )
            db.session.add(quarter_verification)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Certificate generated successfully",
            "certificate": {
                "id": new_certificate.id,
                "user_id": new_certificate.user_id,
                "proof_submission_id": new_certificate.proof_submission_id,
                "quarter": new_certificate.quarter,
                "timestamp": new_certificate.timestamp.isoformat(),
                "digital_signature_hash": new_certificate.digital_signature_hash,
                "content_snapshot": content
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print("Certificate generation error:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to generate certificate",
            "error": str(e)
        }), 500


@csrf.exempt
@auth.route("/update-quarter-verification", methods=["POST"])
@token_required
def update_quarter_verification(current_user):
    """
    Update the quarter verification status
    """
    try:
        data = request.get_json()
        quarter = data.get('quarter')
        status = data.get('status')
        proof_submission_id = data.get('proof_submission_id')
        
        if not quarter or not status:
            return jsonify({
                "success": False,
                "message": "Quarter and status are required"
            }), 400
        
        # Extract quarter number and year
        quarter_parts = quarter.split('-')
        if len(quarter_parts) != 2:
            return jsonify({
                "success": False,
                "message": "Invalid quarter format. Expected 'Q1-2025'"
            }), 400
            
        quarter_num = quarter_parts[0]
        year = int(quarter_parts[1])
        
        # Find or create the quarter verification
        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id,
            quarter=quarter_num,
            year=year
        ).first()
        
        if not quarter_verification:
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter_num,
                year=year,
                status=status,
                due_date=datetime.utcnow(),  # Set properly in production
                proof_submission_id=proof_submission_id
            )
            db.session.add(quarter_verification)
        else:
            quarter_verification.status = status
            quarter_verification.proof_submission_id = proof_submission_id
        
        if status == 'completed':
            quarter_verification.verified_at = datetime.utcnow()
            
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Quarter verification updated",
            "quarter_verification": {
                "id": quarter_verification.id,
                "quarter": quarter_verification.quarter,
                "year": quarter_verification.year,
                "status": quarter_verification.status,
                "verified_at": quarter_verification.verified_at.isoformat() if quarter_verification.verified_at else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Update quarter verification error:", str(e))
        return jsonify({
            "success": False,
            "message": "Failed to update quarter verification",
            "error": str(e)
        }), 500