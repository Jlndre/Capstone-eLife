"""
Utility functions for authentication, image processing, date parsing, and verification
"""
from functools import wraps
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
    """
    Decorator to protect API routes with JWT token authentication
    
    Args:
        f (function): The function to decorate
        
    Returns:
        function: Decorated function that validates JWT token
    """
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
            data = jwt.decode(token, app_config.JWT_SECRET_KEY, algorithms=['HS256'])
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