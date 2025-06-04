import hashlib
import traceback
from flask import Blueprint, json, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app.models import User, UserDetails, LoginSession, ProofSubmission, QuarterVerification, Notification, IdentityDocument, DigitalCertificate
from app import db, login_manager
from datetime import datetime, timezone
from app import csrf
from app.utils import IDTextProcessor, enhanced_ocr_extraction
from functools import wraps
from app.config import app_config
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
from tensorflow.keras.models import load_model # type: ignore
from sklearn.metrics.pairwise import cosine_similarity
import shutil
import tempfile
import os
import mediapipe as mp 
from keras_facenet import FaceNet
from app.liveness_detection import LivenessDetector, analyze_image_sequence_for_liveness


# Import utility functions from utils modules
from app.utils import token_required, generate_token
from app.utils import calculate_quarter_due_date
from app.utils import select_clearest_image, get_largest_face, preprocess_image
from app.utils import detect_id_type, extract_expiry_date, l2_normalize
from app.utils import (
    get_quarter_opening_date,
    get_current_quarter_name,
    is_quarter_open_for_verification,
    validate_quarter_verification_eligibility,
    get_quarter_verification_window
)



auth = Blueprint('auth', __name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
mp_face_mesh = mp.solutions.face_mesh
embedder = FaceNet()

JWT_SECRET_KEY = app_config.JWT_SECRET_KEY
JWT_EXPIRATION_HOURS = app_config.JWT_EXPIRATION_HOURS


@csrf.exempt
@auth.route("/login", methods=["POST"])
def login():
    """API endpoint for user login"""
    data = request.get_json()

    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    pensioner_number = data.get('pensioner_number', '').replace("-", "").strip()
    password = data.get('password')

    if not pensioner_number or not password:
        return jsonify({'message': 'Missing pensioner_number or password'}), 400

    print("Normalized login attempt:", pensioner_number)

    all_users = User.query.all()
    for u in all_users:
        print(f"👤 Comparing with DB entry: {u.pensioner_number} → normalized: {u.pensioner_number.replace('-', '').strip()}")

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


@auth.route("/logout", methods=["POST"])
@token_required
def logout(current_user):
    """API endpoint for user logout"""
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


@auth.route('/api/dashboard-summary', methods=['GET'])
@token_required
def dashboard_summary(current_user):
    try:
        today = datetime.utcnow().date()
        year = today.year
        
        # Determine ACTUAL current quarter based on calendar date
        current_quarter_name = get_current_quarter_name()
        
        print(f"Dashboard summary requested for user {current_user.id}, year {year}")
        print(f"Today: {today}, Actual current quarter: {current_quarter_name}")

        # Get all quarters for the current year
        all_quarters = QuarterVerification.query.filter_by(
            user_id=current_user.id, year=year
        ).order_by(QuarterVerification.due_date).all()

        print(f"Found {len(all_quarters)} existing quarters for user {current_user.id}")

        # If no quarters exist, create them for the current year
        if not all_quarters:
            print("No quarters found, creating them...")
            quarters_to_create = ["First", "Second", "Third", "Fourth"]
            for quarter_name in quarters_to_create:
                due_date = calculate_quarter_due_date(quarter_name, year)
                new_quarter = QuarterVerification(
                    user_id=current_user.id,
                    quarter=quarter_name,
                    year=year,
                    status='pending',
                    due_date=due_date
                )
                db.session.add(new_quarter)
                print(f"Created quarter: {quarter_name} {year} due {due_date}")
            
            db.session.commit()
            
            # Refresh the query after creating quarters
            all_quarters = QuarterVerification.query.filter_by(
                user_id=current_user.id, year=year
            ).order_by(QuarterVerification.due_date).all()
            print(f"After creation, found {len(all_quarters)} quarters")

        current = None
        upcoming = []
        completed = []
        missed = []
        not_yet_open = []

        # Process each quarter with improved logic
        for q in all_quarters:
            opening_date = get_quarter_opening_date(q.quarter, q.year)
            
            # Get the certificate date if it exists (more accurate than QuarterVerification date)
            certificate = None
            certificate_date = None
            if q.status == 'completed':
                certificate = DigitalCertificate.query.filter_by(
                    user_id=current_user.id,
                    quarter=f"Q{q.quarter}-{q.year}"
                ).first()
                
                if certificate:
                    certificate_date = certificate.timestamp
                    print(f"Found certificate for {q.quarter} {q.year}: {certificate_date}")
            
            # Use certificate date if available, otherwise fall back to quarter verification date
            actual_verified_date = certificate_date if certificate_date else q.verified_at
            
            entry = {
                "quarter": q.quarter,
                "year": q.year,
                "status": q.status,
                "due_date": q.due_date.strftime('%Y-%m-%d'),
                "opening_date": opening_date.strftime('%Y-%m-%d'),
                "verified_at": actual_verified_date.strftime('%Y-%m-%d') if actual_verified_date else None,
                "verified_at_display": actual_verified_date.strftime('%B %d, %Y') if actual_verified_date else None,
                "ref": q.proof_submission_id,
                "certificate_id": certificate.id if certificate else None,
                "is_open": today >= opening_date.date(),
                "is_current_quarter": q.quarter == current_quarter_name
            }

            print(f"Processing quarter {q.quarter}: status={q.status}, is_current={entry['is_current_quarter']}, is_open={entry['is_open']}")

            # FIXED LOGIC: Current quarter is based on calendar date, not completion status
            if q.quarter == current_quarter_name:
                # This is the actual current quarter based on calendar
                current = entry
                print(f"  -> Set as current quarter (calendar-based)")
                
            elif q.status == 'completed':
                completed.append(entry)
                print(f"  -> Added to completed")
                
            elif q.status == 'missed':
                missed.append(entry)
                print(f"  -> Added to missed")
                
            elif today < opening_date.date():
                # Quarter hasn't opened yet
                not_yet_open.append(entry)
                print(f"  -> Added to not_yet_open (opens {opening_date})")
                
            elif q.due_date >= today and q.status == 'pending':
                # Quarter is open and pending (but not current quarter)
                upcoming.append(entry)
                print(f"  -> Added to upcoming")
                
            elif q.due_date < today and q.status == 'pending':
                # Overdue quarters should be marked as missed
                print(f"  -> Quarter is overdue, marking as missed")
                entry["status"] = "missed"
                missed.append(entry)
                # Update in database
                q.status = 'missed'
                db.session.commit()

        # Combine upcoming and not_yet_open for the frontend
        all_upcoming = upcoming + not_yet_open
        all_upcoming.sort(key=lambda x: x['opening_date'])

        # Get user details safely
        user_details = current_user.user_details
        full_name = "Unknown User"
        trn = "N/A"
        
        if user_details:
            full_name = f"{user_details.firstname or ''} {user_details.lastname or ''}".strip()
            trn = user_details.trn or "N/A"
            if not full_name:
                full_name = current_user.username or "Unknown User"

        result = {
            "year": year,
            "name": full_name,
            "trn": trn,
            "active": len(missed) == 0,
            "current": current,  # Always the calendar-based current quarter
            "completed": completed,
            "upcoming": all_upcoming,
            "missed": missed,
            "total_quarters": len(all_quarters),
            "current_quarter_name": current_quarter_name,
            "today": today.strftime('%Y-%m-%d')
        }

        print(f"Dashboard summary result:")
        print(f"  - Current: {current}")
        print(f"  - Completed: {len(completed)}")
        print(f"  - Upcoming: {len(all_upcoming)}")
        print(f"  - Missed: {len(missed)}")

        return jsonify(result)

    except Exception as e:
        print(f"Dashboard summary error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to load dashboard summary",
            "message": str(e)
        }), 500

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

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Could not decode image"}), 400

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
    """
    Endpoint for uploading and verifying ID image.
    Verifies if the image is synthetic (deepfake), extracts text via enhanced OCR, 
    checks for name and ID number match.
    ONLY uploads face crop to Firebase if ALL validations pass successfully.
    ORIGINAL ID IMAGE IS NEVER STORED - PROCESSED IN MEMORY ONLY.
    """
    
    try:
        print("Received ID upload request from:", current_user.username)

        if 'id_image' not in request.files:
            return jsonify({'message': 'No file uploaded'}), 400

        file = request.files['id_image']
        
        # Process image directly in memory - NO LOCAL STORAGE
        file.stream.seek(0)
        npimg = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'message': 'Could not decode image'}), 400

        print("Image loaded in memory - NO local files created")

        # STEP 1: Deepfake detection - operates on memory
        from app.services.deepfake_detector import is_deepfake
        is_fake, face_crop = is_deepfake(image)
        print("IS your ID Fake:", is_fake)
        
        if is_fake is None:
            # Clear memory before returning
            del image
            return jsonify({'message': 'Face detection failed or no face found in ID image.'}), 400

        if is_fake:
            # Clear memory before returning
            del image
            del face_crop
            return jsonify({
                'message': 'Upload rejected: The face on this ID appears to be tampered or synthetic.',
                'deepfake_detected': True
            }), 400

        print("Deepfake test passed")

        # STEP 2: ENHANCED OCR PROCESSING - ALL IN MEMORY, NO FILES SAVED
        try:
            print("Starting enhanced OCR processing... (in-memory only)")
            
            # Initialize EasyOCR reader (create once and reuse)
            reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            
            # Use enhanced OCR extraction - processes image directly from memory
            ocr_result = enhanced_ocr_extraction(image, reader)
            
            extracted_text = ocr_result['text']
            confidence_score = ocr_result['confidence']
            processing_method = ocr_result['method']
            
            print(f" Enhanced OCR completed (no files saved):")
            print(f"- Method used: {processing_method}")
            print(f"- Confidence: {confidence_score:.2f}")
            print(f"- Extracted text: {extracted_text}")
            print(f"- Total attempts: {ocr_result.get('total_attempts', 1)}")
            
            # Clear original image from memory after OCR (keep face_crop for later)
            del image
            
            # If confidence is too low, return error
            if confidence_score < 0.3:
                del face_crop  # Clear face crop since validation failed
                return jsonify({
                    'message': 'Text extraction confidence too low. Please ensure the ID is clear and well-lit.',
                    'confidence': confidence_score,
                    'method': processing_method
                }), 400
                
        except Exception as e:
            print(f"Enhanced OCR processing failed: {str(e)}")
            del image
            del face_crop
            return jsonify({'message': f'OCR processing failed: {str(e)}'}), 500

        # STEP 3: Validate user details exist
        user_details = current_user.user_details
        if not user_details:
            del face_crop  # Clear face crop since validation failed
            return jsonify({
                "error": "User profile details are missing.",
                "message": "Please complete your profile before uploading ID."
            }), 400

        # STEP 4: Enhanced ID type detection and matching
        id_type = request.form.get("id_type") or detect_id_type(extracted_text)
        print("Detected ID type:", id_type)

        # STEP 5: Enhanced text matching with improved passport handling
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

        print(f"Name matching results: {name_match}")
        print(f"Expected names: {expected_names}")

        # Enhanced ID number matching based on type
        id_match = False

        if id_type == 'passport':
            # Use improved passport number extraction
            text_processor = IDTextProcessor()
            passport_numbers = text_processor.extract_passport_number(extracted_text)
            
            expected_passport = user_details.passport_num
            print(f"Expected passport: {expected_passport}")
            print(f"Extracted passport numbers: {passport_numbers}")
            
            if expected_passport:
                # Try exact match first
                passport_match = expected_passport in extracted_text
                
                # If no exact match, try the extracted numbers
                if not passport_match and passport_numbers:
                    # Remove spaces and special chars for comparison
                    clean_expected = re.sub(r'[^A-Z0-9]', '', expected_passport.upper())
                    
                    for extracted_num in passport_numbers:
                        clean_extracted = re.sub(r'[^A-Z0-9]', '', extracted_num.upper())
                        
                        # Check for exact match or partial match (in case of OCR errors)
                        similarity = fuzz.ratio(clean_expected, clean_extracted)
                        
                        if (clean_expected == clean_extracted or 
                            clean_expected in clean_extracted or 
                            clean_extracted in clean_expected or
                            similarity > 80):  # Allow for OCR errors
                            passport_match = True
                            print(f"[DEBUG] Passport match found: {clean_expected} ~ {clean_extracted} (similarity: {similarity})")
                            break
                
                id_match = passport_match
                print(f"Final passport match result: {id_match}")
            else:
                print("No expected passport number found in user details")
                id_match = False

        elif id_type == 'driver_license':
            expected_id_number = user_details.trn
            id_match = expected_id_number and expected_id_number in extracted_text
            print(f"TRN match: {expected_id_number} -> {id_match}")

        elif id_type == 'electoral_id':
            # Electoral ID uses the nids_num field (now repurposed for Electoral ID)
            expected_id_number = user_details.nids_num
            id_match = expected_id_number and expected_id_number in extracted_text
            print(f"Electoral ID match: {expected_id_number} -> {id_match}")

        else:
            print(f"Unknown ID type: {id_type}")
            id_match = False

        # STEP 6: Enhanced expiry date extraction with improved passport support
        expiry_date = extract_expiry_date(extracted_text)
        print("Full Extracted Text:", extracted_text)
        print("Extracted expiry date:", expiry_date)
        print("Current UTC time:", datetime.now(timezone.utc))

        expiry_valid = expiry_date is not None

        print("Enhanced Validation Results:")
        print("- Name Match:", name_match)
        print("- ID Match:", id_match)
        print("- Expiry Valid:", expiry_valid)
        print("- OCR Confidence:", confidence_score)

        # STEP 7: CHECK IF ALL VALIDATIONS PASSED
        all_validations_passed = name_match and id_match and expiry_valid

        if not all_validations_passed:
            # VALIDATION FAILED - Don't upload anything, clear memory
            del face_crop
            print("Validation failed - NO files uploaded to Firebase")
            
            # Provide detailed feedback for debugging
            validation_details = {
                'name_match': name_match,
                'id_match': id_match,
                'expiry_valid': expiry_valid,
                'ocr_confidence': confidence_score,
                'processing_method': processing_method,
                'id_type_detected': id_type,
                'extracted_text_preview': extracted_text[:200] + "..." if len(extracted_text) > 200 else extracted_text,
                'expected_names': expected_names,
                'normalized_text': normalized_text
            }
            
            # Add ID-specific details
            if id_type == 'passport':
                validation_details['expected_passport'] = user_details.passport_num
                validation_details['extracted_passport_numbers'] = passport_numbers if 'passport_numbers' in locals() else []
            elif id_type == 'driver_license':
                validation_details['expected_trn'] = user_details.trn
            elif id_type == 'electoral_id':
                validation_details['expected_electoral_id'] = user_details.nids_num
            
            return jsonify({
                'message': 'ID verification failed. Please ensure your ID is clear and matches your profile information.',
                'next_step': 'retry_or_contact_support',
                'validation_details': validation_details,
                'security_note': 'No files were uploaded due to validation failure'
            }), 400

        # STEP 8: ALL VALIDATIONS PASSED - NOW UPLOAD FACE CROP TO FIREBASE
        try:
            bucket = storage.bucket()
            face_filename = f"{uuid.uuid4()}_face_crop.jpg"
            _, buffer = cv2.imencode('.jpg', face_crop)
            face_blob = bucket.blob(f"id_faces/{face_filename}")
            face_blob.upload_from_string(buffer.tobytes(), content_type="image/jpeg")
            face_blob.make_public()
            face_image_url = face_blob.public_url
            
            # Clear face crop from memory after upload
            del face_crop
            
            print("ALL validations passed - Face crop uploaded to Firebase:", face_image_url)
            
        except Exception as e:
            # Firebase upload failed - clear memory and return error
            del face_crop
            print(f" Firebase upload failed: {str(e)}")
            return jsonify({'message': f'Failed to upload verified face: {str(e)}'}), 500

        # STEP 9: Database operations - only stores face crop URL after successful validation
        submission = ProofSubmission(
            user_id=current_user.id,
            id_image_url=face_image_url,  # Only face crop, after successful validation
            status='pending',
            submitted_at=datetime.now(timezone.utc)
        )
        db.session.add(submission)
        db.session.commit()

        doc = IdentityDocument(
            user_id=current_user.id,
            proof_submission_id=submission.id,
            type=id_type,
            image_url=face_image_url,  # Only face crop, after successful validation
            expiry_date=expiry_date
        )
        db.session.add(doc)
        db.session.commit()

        print("Verification completed successfully - Face crop uploaded only after full validation")

        # SUCCESS Response
        return jsonify({
            'message': 'ID verified successfully',
            'next_step': 'facial_verification',
            'submission_id': submission.id,
            'id_type_detected': id_type,
            'ocr_confidence': confidence_score,
            'processing_method': processing_method,
            'expiry_date': expiry_date.strftime('%Y-%m-%d') if expiry_date else None,
            'validation_summary': {
                'name_match': name_match,
                'id_match': id_match,
                'expiry_valid': expiry_valid,
                'overall_confidence': confidence_score
            },
            'security_note': 'Face crop uploaded only after successful validation - Full ID was processed in-memory only'
        }), 200

    except Exception as e:
        print("INTERNAL SERVER ERROR:", str(e))
        import traceback
        traceback.print_exc()
        
        # Clean up memory in case of any error
        try:
            del image
        except:
            pass
        try:
            del face_crop
        except:
            pass
            
        return jsonify({'message': 'Internal server error', 'error': str(e)}), 500
    
@csrf.exempt
@auth.route("/verify-images", methods=["POST"])
@token_required
def verify_images(current_user):
    temp_dir = None
    try:
        print(f"[Verify] Received image sequence upload from {current_user.username}")

        # STEP 1: Determine current quarter and validate submission eligibility
        now = datetime.utcnow()
        year = now.year
        current_quarter_name = get_current_quarter_name(now)
        
        print(f"Current date: {now.strftime('%Y-%m-%d')}")
        print(f"Current quarter: {current_quarter_name} {year}")
        
        # Use the comprehensive validation function
        eligibility = validate_quarter_verification_eligibility(current_user, current_quarter_name, year)
        
        if not eligibility['eligible']:
            print(f"User not eligible: {eligibility['reason']}")
            return jsonify({
                'success': False,
                'message': eligibility['reason'],
                'can_retry': False,
                'quarter': current_quarter_name,
                'year': year,
                **{k: v for k, v in eligibility.items() if k not in ['eligible', 'reason']}
            }), 400

        # Proceed with image verification if eligible
        images = request.files.getlist('images')
        if not images or len(images) < 3:  # Require minimum 3 images for liveness
            return jsonify({
                'success': False,
                'message': 'At least 3 images are required for liveness detection',
                'can_retry': True
            }), 400

        print(f"Received {len(images)} images for verification")
        temp_dir = tempfile.mkdtemp()
        image_urls, local_image_paths = [], []
        bucket = storage.bucket()

        try:
            # Upload images to Firebase and save locally for processing
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

            # ADD THIS DEBUG CODE HERE:
            for idx, local_path in enumerate(local_image_paths):
                if os.path.exists(local_path):
                    file_size = os.path.getsize(local_path)
                    print(f"Image {idx+1}: {local_path} exists, size: {file_size} bytes")
                else:
                    print(f"Image {idx+1}: {local_path} MISSING!")
        
        # Before calling liveness detection:
            print(f"About to analyze {len(local_image_paths)} images for liveness")
            print(f"Image paths: {local_image_paths}")

            # STEP 2: LIVENESS DETECTION 
            print("Starting liveness detection analysis...")
            liveness_analysis = analyze_image_sequence_for_liveness(local_image_paths)
            
            if not liveness_analysis['success']:
                return jsonify({
                    'success': False,
                    'message': 'Failed to analyze images for liveness detection',
                    'can_retry': True,
                    'liveness_error': liveness_analysis.get('error', 'Unknown error')
                }), 422
            
            liveness_result = liveness_analysis['liveness_result']
            print(f"Liveness detection results: {liveness_result}")
            
            # Check if liveness detection passed
            if not liveness_result['is_live']:
                return jsonify({
                    'success': False,
                    'message': f"Liveness check failed: {liveness_result['reason']}",
                    'can_retry': True,
                    'liveness_failed': True,
                    'liveness_details': {
                        'blinks_detected': liveness_result['blinks'],
                        'movements_detected': liveness_result['head_movements'],
                        'confidence': liveness_result['confidence'],
                        'frames_analyzed': liveness_result['frames_analyzed']
                    }
                }), 422

            # STEP 3: Select clearest image for face matching (using dlib version)
            from app.face_verification import select_clearest_image_dlib
            clearest_image_path = select_clearest_image_dlib(local_image_paths)
            if not clearest_image_path:
                return jsonify({
                    'success': False,
                    'message': 'Failed to find a clear image for verification',
                    'can_retry': True
                }), 422

            # STEP 4: DEEPFAKE DETECTION (existing logic)
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

            # STEP 5: DLIB FACE MATCHING (REPLACED SECTION)
            from app.face_verification import DlibFaceMatcher
            
            # Get ID document
            id_doc = IdentityDocument.query.filter_by(user_id=current_user.id).order_by(IdentityDocument.id.desc()).first()
            if not id_doc:
                return jsonify({
                    'success': False,
                    'message': 'No ID document found. Please complete ID verification first.',
                    'can_retry': False
                }), 404

            # Download ID image from Firebase
            id_image_blob = bucket.blob(id_doc.image_url.replace(f"https://storage.googleapis.com/{bucket.name}/", ""))
            id_image_path = os.path.join(temp_dir, "id_image.jpg")
            id_image_blob.download_to_filename(id_image_path)
            
            # Debug: Check ID image dimensions
            id_img_check = cv2.imread(id_image_path)
            if id_img_check is not None:
                print(f"[DEBUG] Downloaded ID image dimensions: {id_img_check.shape}")
                if id_img_check.shape[0] < 100 or id_img_check.shape[1] < 100:
                    print(f"[WARNING] ID image is too small ({id_img_check.shape}), this may cause face detection to fail")
            else:
                print(f"[ERROR] Could not read downloaded ID image from {id_image_path}")

            # Initialize dlib face matcher
            try:
                face_matcher = DlibFaceMatcher()
                
                # Pre-check image sizes before face matching
                id_img_check = cv2.imread(id_image_path)
                selfie_img_check = cv2.imread(clearest_image_path)
                
                if id_img_check is None:
                    return jsonify({
                        'success': False,
                        'message': 'Failed to load ID image for face matching',
                        'can_retry': True,
                        'face_match_error': 'ID image could not be loaded'
                    }), 422
                
                if selfie_img_check is None:
                    return jsonify({
                        'success': False,
                        'message': 'Failed to load selfie image for face matching',
                        'can_retry': True,
                        'face_match_error': 'Selfie image could not be loaded'
                    }), 422
                
                # Check if ID image is too small (likely corrupted or heavily compressed)
                min_dimension = min(id_img_check.shape[0], id_img_check.shape[1])
                if min_dimension < 80:
                    return jsonify({
                        'success': False,
                        'message': f'ID image is too small for face detection ({id_img_check.shape[1]}x{id_img_check.shape[0]} pixels). Please re-upload your ID document with a higher resolution image.',
                        'can_retry': False,  # They need to re-upload ID
                        'face_match_error': f'ID image too small: {id_img_check.shape}'
                    }), 422
                
                # Perform face verification
                face_match_result = face_matcher.process_verification_images(
                    id_image_path=id_image_path,
                    selfie_image_path=clearest_image_path
                )
                
                print(f"Dlib face matching results: {face_match_result}")
                
                if not face_match_result['success']:
                    # Provide more specific error messages
                    error_msg = face_match_result.get('error', 'Unknown error')
                    
                    if 'No face found in ID image' in error_msg:
                        return jsonify({
                            'success': False,
                            'message': 'No face detected in your ID document. Please ensure your ID photo is clear and contains a visible face, then re-upload your ID document.',
                            'can_retry': False,  # They need to re-upload ID
                            'face_match_error': error_msg,
                            'id_image_dimensions': f"{id_img_check.shape[1]}x{id_img_check.shape[0]}"
                        }), 422
                    elif 'No face found in selfie image' in error_msg:
                        return jsonify({
                            'success': False,
                            'message': 'No face detected in your verification photos. Please ensure your face is clearly visible and try again.',
                            'can_retry': True,
                            'face_match_error': error_msg
                        }), 422
                    else:
                        return jsonify({
                            'success': False,
                            'message': f"Face matching failed: {error_msg}",
                            'can_retry': True,
                            'face_match_error': error_msg
                        }), 422
                
                # Extract results
                is_match = face_match_result['match']
                face_distance = face_match_result['distance']
                face_similarity = face_match_result['similarity']
                
                print(f"Face match results:")
                print(f"- Distance: {face_distance:.4f}")
                print(f"- Similarity: {face_similarity:.2f}%")
                print(f"- Final match decision: {is_match}")
                
            except Exception as face_match_error:
                print(f"Error initializing dlib face matcher: {str(face_match_error)}")
                import traceback
                traceback.print_exc()
                
                return jsonify({
                    'success': False,
                    'message': 'Face matching system error',
                    'can_retry': True,
                    'error': str(face_match_error)
                }), 500

            # STEP 6: FINAL VERIFICATION - Updated to include liveness
            verification_success = bool(is_match and not is_deepfake and liveness_result['is_live'])
            
            # Create ProofSubmission record with liveness and dlib data
            proof = ProofSubmission(
                user_id=current_user.id,
                id_image_url=id_doc.image_url,
                video_url=None,
                image_urls=json.dumps(image_urls),
                status='approved' if verification_success else 'flagged',
                submitted_at=datetime.now(timezone.utc),
                verified_at=datetime.now(timezone.utc) if verification_success else None,
                notes=f"Dlib Distance: {face_distance:.4f}, Similarity: {face_similarity:.2f}%, Deepfake: {deepfake_score:.2f}, Liveness: {liveness_result['confidence']:.2f}, Blinks: {liveness_result['blinks']}, Movements: {liveness_result['head_movements']}"
            )
            db.session.add(proof)
            db.session.flush()  # Get the ID without committing yet

            # STEP 7: CERTIFICATE GENERATION AND QUARTER UPDATES (COMPLETE ORIGINAL LOGIC)
            certificate_data = None
            if verification_success:
                try:
                    print("Verification successful - Auto-generating certificate and updating records")
                    
                    # Double-check eligibility (race condition protection)
                    final_eligibility_check = validate_quarter_verification_eligibility(current_user, current_quarter_name, year)
                    if not final_eligibility_check['eligible']:
                        print(f"Race condition detected: {final_eligibility_check['reason']}")
                        db.session.rollback()
                        return jsonify({
                            'success': False,
                            'message': final_eligibility_check['reason'],
                            'can_retry': False
                        }), 400
                    
                    quarter = f"Q{current_quarter_name}-{year}"
                    
                    # Get user details for certificate
                    user_details = current_user.user_details
                    if not user_details:
                        print("Warning: User details missing for certificate generation")
                        db.session.commit()
                        return jsonify({
                            "success": True,
                            "match": bool(is_match),
                            "deepfake_detected": bool(is_deepfake),
                            "liveness_passed": bool(liveness_result['is_live']),
                            "face_distance": float(face_distance),
                            "face_similarity": float(face_similarity),
                            "deepfake_score": float(deepfake_score),
                            "liveness_confidence": float(liveness_result['confidence']),
                            "liveness_details": {
                                "blinks_detected": liveness_result['blinks'],
                                "head_movements": liveness_result['head_movements'],
                                "frames_analyzed": liveness_result['frames_analyzed'],
                                "reason": liveness_result['reason']
                            },
                            "image_urls": image_urls,
                            "message": "Verification completed but certificate generation failed - missing user details",
                            "can_retry": False,
                            "proof_submission_id": proof.id,
                            "certificate": None
                        }), 200
                    
                    # Check if certificate already exists for this quarter
                    existing_cert = DigitalCertificate.query.filter_by(
                        user_id=current_user.id,
                        quarter=quarter
                    ).first()
                    
                    if existing_cert:
                        print(f"Certificate already exists for {quarter}")
                        existing_cert.proof_submission_id = proof.id
                        certificate_data = {
                            "id": existing_cert.id,
                            "quarter": existing_cert.quarter,
                            "timestamp": existing_cert.timestamp.isoformat(),
                            "digital_signature_hash": existing_cert.digital_signature_hash,
                            "content": json.loads(existing_cert.content_snapshot) if existing_cert.content_snapshot else {}
                        }
                    else:
                        # Create new certificate with dlib metrics
                        content = {
                            "pensioner_number": current_user.pensioner_number,
                            "user_id": current_user.id,
                            "fullName": f"{user_details.firstname} {user_details.lastname}",
                            "dob": user_details.dob.strftime('%Y-%m-%d') if user_details.dob else None,
                            "trn": user_details.trn,
                            "verification_method": "Dlib Face Recognition, ID Verification & Liveness Detection",  # Updated to reflect dlib
                            "quarter": quarter,
                            "issue_date": datetime.utcnow().isoformat(),
                            "expiry_date": None,
                            "verification_timestamp": datetime.utcnow().isoformat(),
                            "face_distance": float(face_distance),  # Changed from similarity_score
                            "face_similarity": float(face_similarity),  # New field
                            "deepfake_score": float(deepfake_score),
                            "liveness_confidence": float(liveness_result['confidence']),  # New field
                            "liveness_blinks": liveness_result['blinks'],  # New field
                            "liveness_movements": liveness_result['head_movements']  # New field
                        }
                        
                        content_str = json.dumps(content, sort_keys=True)
                        digital_signature = hashlib.sha256(content_str.encode()).hexdigest()
                        
                        new_certificate = DigitalCertificate(
                            user_id=current_user.id,
                            proof_submission_id=proof.id,
                            certificate_filename=f"certificate_{current_user.id}_{quarter}.json",
                            content_snapshot=content_str,
                            digital_signature_hash=digital_signature,
                            quarter=quarter
                        )
                        
                        db.session.add(new_certificate)
                        db.session.flush()
                        
                        certificate_data = {
                            "id": new_certificate.id,
                            "quarter": new_certificate.quarter,
                            "timestamp": new_certificate.timestamp.isoformat(),
                            "digital_signature_hash": new_certificate.digital_signature_hash,
                            "content": content
                        }
                    
                    # Update or create quarter verification record
                    quarter_verification = QuarterVerification.query.filter_by(
                        user_id=current_user.id,
                        quarter=current_quarter_name,
                        year=year
                    ).first()
                    
                    if quarter_verification:
                        print(f"Updating existing quarter verification for {current_quarter_name} {year}")
                        quarter_verification.status = 'completed'
                        quarter_verification.verified_at = datetime.utcnow()
                        quarter_verification.proof_submission_id = proof.id
                    else:
                        print(f"Creating new quarter verification for {current_quarter_name} {year}")
                        due_date = calculate_quarter_due_date(current_quarter_name, year)
                        quarter_verification = QuarterVerification(
                            user_id=current_user.id,
                            quarter=current_quarter_name,
                            year=year,
                            status='completed',
                            verified_at=datetime.utcnow(),
                            proof_submission_id=proof.id,
                            due_date=due_date
                        )
                        db.session.add(quarter_verification)
                    
                    # Commit all changes together
                    db.session.commit()
                    
                    print(f"Certificate and quarter verification completed successfully")
                    print(f"- Certificate ID: {certificate_data['id'] if certificate_data else 'N/A'}")
                    print(f"- Quarter: {current_quarter_name} {year}")
                    print(f"- Proof Submission ID: {proof.id}")
                    print(f"- Liveness confidence: {liveness_result['confidence']:.2f}")
                    print(f"- Face similarity: {face_similarity:.2f}%")
                    
                except Exception as cert_error:
                    print(f"Certificate generation failed: {str(cert_error)}")
                    import traceback
                    traceback.print_exc()
                    
                    # Rollback and commit just the proof submission
                    db.session.rollback()
                    db.session.add(proof)
                    db.session.commit()
                    
                    return jsonify({
                        "success": True,
                        "match": bool(is_match),
                        "deepfake_detected": bool(is_deepfake),
                        "liveness_passed": bool(liveness_result['is_live']),
                        "face_distance": float(face_distance),
                        "face_similarity": float(face_similarity),
                        "deepfake_score": float(deepfake_score),
                        "liveness_confidence": float(liveness_result['confidence']),
                        "liveness_details": {
                            "blinks_detected": liveness_result['blinks'],
                            "head_movements": liveness_result['head_movements'],
                            "frames_analyzed": liveness_result['frames_analyzed'],
                            "reason": liveness_result['reason']
                        },
                        "image_urls": image_urls,
                        "message": "Verification completed but certificate generation failed - please try generating certificate manually",
                        "can_retry": False,
                        "proof_submission_id": proof.id,
                        "certificate": None,
                        "certificate_error": str(cert_error)
                    }), 200
            else:
                # Verification failed, just commit the proof submission
                db.session.commit()

            # STEP 8: RETURN COMPLETE RESPONSE WITH ALL DATA (Updated with dlib metrics)
            return jsonify({
                "success": verification_success,
                "match": bool(is_match),
                "deepfake_detected": bool(is_deepfake),
                "liveness_passed": bool(liveness_result['is_live']),
                "face_distance": float(face_distance),  # Changed from similarity
                "face_similarity": float(face_similarity),  # New field
                "deepfake_score": float(deepfake_score),
                "liveness_confidence": float(liveness_result['confidence']),
                "liveness_details": {
                    "blinks_detected": liveness_result['blinks'],
                    "head_movements": liveness_result['head_movements'],
                    "frames_analyzed": liveness_result['frames_analyzed'],
                    "reason": liveness_result['reason']
                },
                "image_urls": image_urls,
                "message": "Verification completed successfully" if verification_success else get_failure_message(is_match, is_deepfake, liveness_result['is_live']),
                "can_retry": not verification_success,
                "proof_submission_id": proof.id,
                "certificate": certificate_data
            }), 200

        except Exception as processing_error:
            print(f"Processing error in verify_images: {str(processing_error)}")
            import traceback
            traceback.print_exc()
            
            return jsonify({
                'success': False,
                'message': 'Error processing verification images',
                'error': str(processing_error),
                'can_retry': True
            }), 500

    except Exception as e:
        print("VERIFY-IMAGES ERROR:", str(e))
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False, 
            'message': 'Internal server error occurred during verification',
            'error': str(e),
            'can_retry': True
        }), 500
        
    finally:
        # Always cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as cleanup_error:
                print(f"Error cleaning up temp directory: {cleanup_error}")
def get_failure_message(is_match, is_deepfake, is_live):
    """Generate appropriate failure message based on which checks failed"""
    failures = []
    
    if not is_match:
        failures.append("face doesn't match ID")
    if is_deepfake:
        failures.append("deepfake detected")
    if not is_live:
        failures.append("liveness check failed")
    
    if len(failures) == 1:
        return f"Verification failed - {failures[0]}"
    elif len(failures) == 2:
        return f"Verification failed - {failures[0]} and {failures[1]}"
    else:
        return f"Verification failed - {', '.join(failures[:-1])}, and {failures[-1]}"

@auth.route('/api/quarter-eligibility', methods=['GET'])
@token_required
def check_quarter_eligibility(current_user):
    """
    Check if user is eligible to submit verification for current quarter
    """
    try:
        # Get current quarter
        now = datetime.utcnow()
        year = now.year
        current_quarter_name = get_current_quarter_name(now)
        
        # Check eligibility
        eligibility = validate_quarter_verification_eligibility(current_user, current_quarter_name, year)
        
        # Get quarter window information
        opening_date, due_date = get_quarter_verification_window(current_quarter_name, year)
        
        return jsonify({
            "quarter": current_quarter_name,
            "year": year,
            "eligible": eligibility['eligible'],
            "reason": eligibility['reason'],
            "opening_date": opening_date.strftime('%Y-%m-%d'),
            "due_date": due_date.strftime('%Y-%m-%d'),
            "is_open": is_quarter_open_for_verification(current_quarter_name, year, now),
            "current_date": now.strftime('%Y-%m-%d'),
            **{k: v for k, v in eligibility.items() if k not in ['eligible', 'reason']}
        }), 200
        
    except Exception as e:
        print(f"Quarter eligibility check error: {str(e)}")
        return jsonify({
            "error": "Failed to check quarter eligibility",
            "message": str(e)
        }), 500
    
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
            now = datetime.utcnow()
            year = now.year
            month = now.month
            
            if month < 4:
                quarter_num = "First"
            elif month < 7:
                quarter_num = "Second"
            elif month < 10:
                quarter_num = "Third"
            else:
                quarter_num = "Fourth"
                
            quarter = f"Q{quarter_num}-{year}"
        
        proof_submission = ProofSubmission.query.filter_by(
            user_id=current_user.id,
            status='approved'
        ).order_by(ProofSubmission.verified_at.desc()).first()
        
        if not proof_submission:
            return jsonify({
                "success": False,
                "message": "No approved verification found"
            }), 404
        
        existing_cert = DigitalCertificate.query.filter_by(
            proof_submission_id=proof_submission.id
        ).first()
        
        if existing_cert:
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
            "expiry_date": None  
        }
        

        content_str = json.dumps(content, sort_keys=True)
        digital_signature = hashlib.sha256(content_str.encode()).hexdigest()
        
        new_certificate = DigitalCertificate(
            user_id=current_user.id,
            proof_submission_id=proof_submission.id,
            certificate_filename=f"certificate_{current_user.id}_{quarter}.json",
            content_snapshot=content_str,
            digital_signature_hash=digital_signature,
            quarter=quarter
        )
        
        db.session.add(new_certificate)
        
        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id,
            quarter=quarter.split('-')[0],  
            year=int(quarter.split('-')[1]) 
        ).first()
        
        if quarter_verification:
            quarter_verification.status = 'completed'
            quarter_verification.verified_at = datetime.utcnow()
            quarter_verification.proof_submission_id = proof_submission.id
        else:
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter.split('-')[0],
                year=int(quarter.split('-')[1]),
                status='completed',
                verified_at=datetime.utcnow(),
                proof_submission_id=proof_submission.id,
                due_date=datetime.utcnow()  
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
        
        quarter_parts = quarter.split('-')
        if len(quarter_parts) != 2:
            return jsonify({
                "success": False,
                "message": "Invalid quarter format. Expected 'First-2025'"
            }), 400
            
        quarter_num = quarter_parts[0]  # Will be "First", "Second", etc.
        year = int(quarter_parts[1])
        
        current_date = datetime.utcnow()
        due_date = calculate_quarter_due_date(quarter_num, year, current_date)
        
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
                due_date=due_date, 
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

@csrf.exempt
@auth.route("/update-account-status", methods=["POST"])
@token_required
def update_account_status(current_user):
    """
    Update the account status after viewing a life certificate
    """
    try:
        data = request.get_json()
        certificate_id = data.get('certificate_id')
        
        if not certificate_id:
            return jsonify({
                "success": False,
                "message": "Certificate ID is required"
            }), 400
            
        certificate = DigitalCertificate.query.filter_by(
            id=certificate_id,
            user_id=current_user.id
        ).first()
        
        if not certificate:
            return jsonify({
                "success": False,
                "message": "Certificate not found"
            }), 404
            
        user_details = current_user.user_details
        if user_details:
            user_details.last_verification = datetime.utcnow()
            
        print(f"Life certificate {certificate_id} viewed by user {current_user.id}")
        notification = Notification(
            user_id=current_user.id,
            type="certificate_viewed",
            message=f"Your Life Certificate for {certificate.quarter} has been viewed",
            sent_at=datetime.utcnow(),
            is_read=False
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Account status updated successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Error updating account status:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to update account status",
            "error": str(e)
        }), 500
    
@csrf.exempt
@auth.route("/update-permissions", methods=["POST"])
@token_required
def update_user_permissions(current_user):
    """
    Update user permissions after life certificate verification
    """
    try:
        data = request.get_json()
        certificate_id = data.get('certificate_id')
        
        if not certificate_id:
            return jsonify({
                "success": False,
                "message": "Certificate ID is required"
            }), 400
            
        certificate = DigitalCertificate.query.filter_by(
            id=certificate_id
        ).first()
        
        if not certificate:
            return jsonify({
                "success": False,
                "message": "Certificate not found"
            }), 404

        user = User.query.get(certificate.user_id)
        if user:
            if hasattr(User, 'is_active') and not isinstance(User.is_active, property):
                user.is_active = True
            else:
                if hasattr(user, 'set_active_status'):
                    user.set_active_status(True)
                elif hasattr(user, 'active'):
                    user.active = True
                
            permissions = data.get('permissions')
            if permissions and hasattr(user, 'permissions'):
                user.permissions = permissions
            
        quarter_parts = certificate.quarter.split('-')
        if len(quarter_parts) == 2:
            quarter_num = quarter_parts[0]
            year = int(quarter_parts[1])
            
            quarter_verification = QuarterVerification.query.filter_by(
                user_id=certificate.user_id,
                quarter=quarter_num,
                year=year
            ).first()
            
            if quarter_verification:
                quarter_verification.status = 'completed'
                quarter_verification.verified_at = datetime.utcnow()
                
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "User permissions updated successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Error updating user permissions:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to update user permissions",
            "error": str(e)
        }), 500