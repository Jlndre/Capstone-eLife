"""
Utility functions for authentication, image processing, date parsing, and verification
"""
from functools import wraps
import traceback
from flask import request, jsonify
import jwt
import numpy as np
import cv2
import re
from datetime import datetime, timezone, timedelta
from dateutil.parser import parse
from app.models import User
from app.config import app_config


"""
Authentication utilities
"""

def generate_token(user_id):
    """
    Generate JWT token for user authentication
    
    Args:
        user_id (int): The ID of the user to create a token for
        
    Returns:
        str: JWT token string
    """
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=app_config.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, app_config.JWT_SECRET_KEY, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            print("[Auth] Missing token")
            return jsonify({'message': 'Token is missing'}), 401

        try:
            # Decode the token
            data = jwt.decode(token, app_config.JWT_SECRET_KEY, algorithms=['HS256'])
            user_id = data['user_id']
            
            # Add detailed logging
            print(f"[Auth] Token decoded successfully for user_id: {user_id}, type: {type(user_id)}")
            
            # More explicit query instead of get()
            current_user = User.query.filter_by(id=user_id).first()
            
            if current_user is None:
                print(f"[Auth] Token valid but user not found: user_id={user_id}")
                return jsonify({'message': 'User not found'}), 401
                
            # Add verification check
            print(f"[Auth] Found user: {current_user.username}, ID: {current_user.id}")
            
            # Sanity check - verify we got the correct user
            if str(current_user.id) != str(user_id): 
                print(f"[Auth] WARNING: User ID mismatch! Token user_id: {user_id}, Found user ID: {current_user.id}")
                return jsonify({'message': 'Authentication error'}), 401

        except jwt.ExpiredSignatureError:
            print("[Auth] Token expired")
            return jsonify({'message': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            print(f"[Auth] Invalid token: {e}")
            return jsonify({'message': 'Invalid token'}), 401
        except Exception as e:
            print(f"[Auth] Unexpected error during token validation: {e}")
            traceback.print_exc()  
            return jsonify({'message': 'Token is invalid or expired'}), 401

        return f(current_user, *args, **kwargs)

    return decorated

"""
Identity document utilities
"""

def detect_id_type(text: str) -> str:
    """
    Detect the type of ID document based on text content
    
    Args:
        text (str): Text extracted from document
        
    Returns:
        str: Detected document type (passport, driver_license, national_id, or unknown)
    """
    lower_text = text.lower()
    if "passport" in lower_text:
        return "passport"
    elif "driver" in lower_text or "dl" in lower_text:
        return "driver_license"
    elif "national" in lower_text or "nids" in lower_text:
        return "national_id"
    return "unknown"


def extract_expiry_date(raw_text: str):
    """
    Extract expiry date from document text
    
    Args:
        raw_text (str): Text extracted from document
        
    Returns:
        datetime: Extracted expiry date or None if no valid date found
    """
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


"""
Verification utilities
"""

def calculate_quarter_due_date(quarter_num, year, current_date=None):
    """
    Calculate the appropriate due date for a quarter
    
    Args:
        quarter_num (str): Quarter identifier (Q1, Q2, Q3, Q4)
        year (int): The year
        current_date (datetime, optional): Current date for testing purposes
        
    Returns:
        datetime: The due date for the quarter
    """
    if current_date is None:
        current_date = datetime.utcnow()
        
    quarter_months = {
        "Q1": 1,    # January
        "Q2": 4,    # April
        "Q3": 7,    # July
        "Q4": 10    # October
    }
    
    start_month = quarter_months.get(quarter_num, 1)
    
    if quarter_num == "Q1":
        due_date = datetime(year, 2, 15)  # February 15
    elif quarter_num == "Q2":
        due_date = datetime(year, 5, 15)  # May 15
    elif quarter_num == "Q3":
        due_date = datetime(year, 8, 15)  # August 15
    elif quarter_num == "Q4":
        due_date = datetime(year, 11, 15)  # November 15
    else:
        due_date = datetime(year, start_month, 15)
    
    return due_date


"""
Image processing and face recognition utilities
"""

def l2_normalize(x):
    """
    Apply L2 normalization to face embeddings
    
    Args:
        x (numpy.ndarray): Face embedding vectors
        
    Returns:
        numpy.ndarray: Normalized embeddings
    """
    return x / np.sqrt(np.sum(np.square(x), axis=1, keepdims=True))


def select_clearest_image(image_paths):
    """
    Select the clearest image from a list of image paths using Laplacian variance
    
    Args:
        image_paths (list): List of paths to images
        
    Returns:
        str: Path to the clearest image or None if no valid images
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


def get_largest_face(faces, img):
    """
    Extract the largest face detected in an image
    
    Args:
        faces (list): List of face coordinates (x, y, w, h)
        img (numpy.ndarray): Input image
        
    Returns:
        numpy.ndarray: Image cropped to the largest face with margin
    """
    if len(faces) == 0:
        return img
    
    largest_area = 0
    largest_face = None
    
    for (x, y, w, h) in faces:
        if w * h > largest_area:
            largest_area = w * h
            largest_face = (x, y, w, h)
    
    x, y, w, h = largest_face
    margin = int(min(w, h) * 0.2)
    x_start = max(0, x - margin)
    y_start = max(0, y - margin)
    x_end = min(img.shape[1], x + w + margin)
    y_end = min(img.shape[0], y + h + margin)
    
    return img[y_start:y_end, x_start:x_end]


def preprocess_image(img):
    """
    Preprocess image for the face embedding model
    
    Args:
        img (numpy.ndarray): Input image
        
    Returns:
        numpy.ndarray: Preprocessed image ready for the embedding model
    """
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = (img.astype(np.float32) - 127.5) / 127.5
    return np.expand_dims(img, axis=0)


def detect_liveness(image_paths):
    """
    Multi-factor liveness detection combining several approaches
    
    Args:
        image_paths (list): List of paths to images to analyze
        
    Returns:
        dict: Contains 'is_live' boolean and 'details' about which tests passed
    """
    result = {
        'is_live': False,
        'details': {
            'blink_detected': False,
            'head_movement_detected': False,
            'texture_analysis_passed': False
        }
    }
    
    face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    if len(image_paths) > 1:
        # 1. Blink detection
        blink_result = detect_blink(image_paths, face_detector)
        result['details']['blink_detected'] = blink_result
        
        # 2. Head movement detection
        movement_result = detect_head_movement(image_paths, face_detector)
        result['details']['head_movement_detected'] = movement_result
        
        # Determine liveness from multiple images
        result['is_live'] = blink_result or movement_result
    
    # 3. Texture analysis (works on a single image)
    if image_paths:
        clearest_image_path = select_clearest_image(image_paths, face_detector)
        if clearest_image_path:
            texture_result = analyze_face_texture(clearest_image_path, face_detector)
            result['details']['texture_analysis_passed'] = texture_result
            
            if len(image_paths) == 1 or not result['is_live']:
                result['is_live'] = texture_result
    
    return result


def detect_blink(image_paths, face_detector):
    """
    Detects if the person blinked across the image sequence
    
    Args:
        image_paths (list): List of paths to images to analyze
        face_detector: OpenCV face detector
        
    Returns:
        bool: True if a blink was detected
    """
    if len(image_paths) < 3:
        return False
    
    eye_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    eye_states = []
    
    for path in image_paths:
        img = cv2.imread(path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            eye_states.append(0)
            continue
            
        (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
        face_gray = gray[y:y+h, x:x+w]
        
        eyes = eye_detector.detectMultiScale(face_gray, 1.1, 4, minSize=(20, 20))
        eye_states.append(len(eyes))
    
    return has_blink_pattern(eye_states)


def detect_head_movement(image_paths, face_detector):
    """
    Detects if the head moved sufficiently between images
    
    Args:
        image_paths (list): List of paths to images to analyze
        face_detector: OpenCV face detector
        
    Returns:
        bool: True if significant head movement was detected
    """
    if len(image_paths) < 2:
        return False
    
    face_positions = []
    
    for path in image_paths:
        img = cv2.imread(path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            continue
            
        (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
        center_x, center_y = x + w//2, y + h//2
        face_positions.append((center_x, center_y))
    
    return has_sufficient_movement(face_positions)


def analyze_face_texture(image_path, face_detector):
    """
    Analyzes face texture to differentiate between real faces and printed photos
    
    Args:
        image_path (str): Path to image to analyze
        face_detector: OpenCV face detector
        
    Returns:
        bool: True if the texture analysis indicates a real face
    """
    img = cv2.imread(image_path)
    if img is None:
        return False
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 1. Detect face for ROI
    faces = face_detector.detectMultiScale(gray, 1.1, 4)
    
    if len(faces) == 0:
        return False
        
    (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
    face_roi = gray[y:y+h, x:x+w]
    face_hsv = hsv[y:y+h, x:x+w]
    
    # 2. Apply gradient analysis instead of LBP as a simple texture measure
    sobel_x = cv2.Sobel(face_roi, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(face_roi, cv2.CV_64F, 0, 1, ksize=3)
    gradient_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
    gradient_mean = np.mean(gradient_magnitude)
    gradient_std = np.std(gradient_magnitude)
    
    # 3. Color variation analysis
    saturation = face_hsv[:,:,1]
    sat_mean = np.mean(saturation)
    sat_std = np.std(saturation)
    
    # 4. Contrast analysis
    contrast = np.std(face_roi)
    
    # Combined texture analysis - real faces have natural texture variation,
    # appropriate saturation variation, and good contrast
    texture_score = (
        (gradient_std > 10.0) and  # Good texture variation
        (sat_mean > 20) and        # Some color in the face
        (sat_std > 15) and         # Variation in saturation
        (contrast > 30) and        # Good contrast
        (contrast < 100)           # Not too high contrast (screens)
    )
    
    return texture_score


def select_clearest_image(image_paths, face_detector=None):
    """
    Selects the clearest image from a sequence based on sharpness and face detection
    
    Args:
        image_paths (list): List of paths to images to analyze
        face_detector: Optional face detector
        
    Returns:
        str: Path to the clearest image
    """
    if not image_paths:
        return None
    
    if len(image_paths) == 1:
        return image_paths[0]
    
    # Initialize face detector if not provided
    if face_detector is None:
        face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    best_score = -1
    best_image = None
    
    for path in image_paths:
        img = cv2.imread(path)
        if img is None:
            continue
            
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_detector.detectMultiScale(gray, 1.1, 4)
        
        # Skip if no face detected
        if len(faces) == 0:
            continue
        
        # Get the largest face
        (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
        face_gray = gray[y:y+h, x:x+w]
        
        # Calculate Laplacian variance (measure of focus/sharpness)
        laplacian = cv2.Laplacian(face_gray, cv2.CV_64F)
        clarity_score = np.var(laplacian)
        
        # Favor images with better clarity
        if clarity_score > best_score:
            best_score = clarity_score
            best_image = path
    
    # If no good image found, just return the first one
    if best_image is None and image_paths:
        return image_paths[0]
        
    return best_image


def has_sufficient_movement(positions):
    """
    Determines if there was enough movement between face positions
    
    Args:
        positions (list): List of (x,y) face center positions
        
    Returns:
        bool: True if sufficient movement was detected
    """
    if len(positions) < 2:
        return False
    
    max_movement = 0
    for i in range(len(positions)-1):
        x1, y1 = positions[i]
        x2, y2 = positions[i+1]
        movement = ((x2-x1)**2 + (y2-y1)**2)**0.5
        max_movement = max(max_movement, movement)
    
    return max_movement > 10  # Threshold in pixels


def has_blink_pattern(eye_states):
    """
    Determines if the eye states indicate a blink occurred
    
    Args:
        eye_states (list): List of integers indicating number of eyes detected in each frame
        
    Returns:
        bool: True if a blink pattern was detected
    """
    if len(eye_states) < 3:
        return False
    
    # Look for patterns like [2,0,2] or [2,1,2] indicating blink
    for i in range(len(eye_states)-2):
        if eye_states[i] >= 2 and eye_states[i+1] < eye_states[i] and eye_states[i+2] >= 2:
            return True
    
    return False