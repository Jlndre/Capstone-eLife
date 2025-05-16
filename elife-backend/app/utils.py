"""
Utility functions for authentication, image processing, date parsing, and verification.
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

# =======================
# Authentication Utilities
# =======================

def generate_token(user_id):
    """
    Generate JWT token for user authentication.
    
    Args:
        user_id (int): The ID of the user.
        
    Returns:
        str: Encoded JWT token.
    """
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=app_config.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, app_config.JWT_SECRET_KEY, algorithm='HS256')


def token_required(f):
    """
    Flask decorator to protect routes using JWT authentication.

    Args:
        f (function): Route handler function.

    Returns:
        function: Decorated function with current_user injected.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, app_config.JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])

            if current_user is None:
                return jsonify({'message': 'User not found'}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        except Exception:
            return jsonify({'message': 'Token is invalid or expired'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


# =======================
# Document Utilities
# =======================

def detect_id_type(text):
    """
    Detect the type of ID document from extracted text.

    Args:
        text (str): OCR-extracted text.

    Returns:
        str: Document type (passport, driver_license, national_id, or unknown).
    """
    lower = text.lower()
    if "passport" in lower:
        return "passport"
    if "driver" in lower or "dl" in lower:
        return "driver_license"
    if "national" in lower or "nids" in lower:
        return "national_id"
    return "unknown"


def extract_expiry_date(raw_text):
    """
    Extract expiry date from raw document text.

    Args:
        raw_text (str): OCR-extracted text.

    Returns:
        datetime or None: Parsed expiry date if found.
    """
    clean_text = re.sub(r'[^\w\s:/\-]', '', raw_text)
    tokens = clean_text.split()
    now = datetime.now(timezone.utc)
    expiry_keywords = {"expiry", "expires", "expiration", "exp", "valid", "validity"}
    candidate_dates = []

    for i, token in enumerate(tokens):
        if token.lower() in expiry_keywords and i + 1 < len(tokens):
            try:
                date = parse(tokens[i + 1], fuzzy=False).replace(tzinfo=timezone.utc)
                if date > now:
                    return date
            except Exception:
                continue

    date_patterns = [
        r'(20\d{2})[-/](\d{2})[-/](\d{2})',
        r'(\d{2})[-/](\d{2})[-/](\d{4})',
        r'(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})',
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}'
    ]

    for pattern in date_patterns:
        matches = re.findall(pattern, clean_text)
        for match in matches:
            try:
                date_str = " ".join(match) if isinstance(match, tuple) else match
                date = parse(date_str, fuzzy=True).replace(tzinfo=timezone.utc)
                if date > now:
                    candidate_dates.append(date)
            except Exception:
                continue

    return max(candidate_dates) if candidate_dates else None


# =======================
# Quarter Verification
# =======================

def calculate_quarter_due_date(quarter_num, year, current_date=None):
    """
    Calculate due date for a quarter.

    Args:
        quarter_num (str): Quarter (e.g., 'Q1', 'Q2').
        year (int): Year of the quarter.
        current_date (datetime, optional): Used for testing or overrides.

    Returns:
        datetime: Calculated due date.
    """
    if current_date is None:
        current_date = datetime.utcnow()

    due_dates = {
        "Q1": datetime(year, 2, 15),
        "Q2": datetime(year, 5, 15),
        "Q3": datetime(year, 8, 15),
        "Q4": datetime(year, 11, 15)
    }

    return due_dates.get(quarter_num, datetime(year, 1, 15))


# =======================
# Face Image Utilities
# =======================

def l2_normalize(x):
    """
    Perform L2 normalization on face embedding vectors.

    Args:
        x (np.ndarray): Input vectors.

    Returns:
        np.ndarray: Normalized vectors.
    """
    return x / np.sqrt(np.sum(np.square(x), axis=1, keepdims=True))


def select_clearest_image(image_paths):
    """
    Select clearest image based on Laplacian variance (sharpness).

    Args:
        image_paths (list): Paths to image files.

    Returns:
        str or None: Path of the clearest image.
    """
    if not image_paths:
        return None

    clearest = None
    max_var = -1

    for path in image_paths:
        try:
            img = cv2.imread(path)
            if img is None:
                continue
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            var = cv2.Laplacian(gray, cv2.CV_64F).var()

            if var > max_var:
                max_var = var
                clearest = path
        except Exception as e:
            print(f"[ImageError] {path}: {e}")
            continue

    return clearest


def get_largest_face(faces, img):
    """
    Get the largest face region from a list of face detections.

    Args:
        faces (list): Face bounding boxes [(x, y, w, h)].
        img (np.ndarray): Original image.

    Returns:
        np.ndarray: Cropped face image.
    """
    if not faces:
        return img

    largest = max(faces, key=lambda b: b[2] * b[3])
    x, y, w, h = largest
    margin = int(min(w, h) * 0.2)

    x_start = max(0, x - margin)
    y_start = max(0, y - margin)
    x_end = min(img.shape[1], x + w + margin)
    y_end = min(img.shape[0], y + h + margin)

    return img[y_start:y_end, x_start:x_end]


def preprocess_image(img):
    """
    Normalize and reshape image for model input.

    Args:
        img (np.ndarray): Input BGR image.

    Returns:
        np.ndarray: Preprocessed RGB image (1, H, W, C).
    """
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_normalized = (img_rgb.astype(np.float32) - 127.5) / 127.5
    return np.expand_dims(img_normalized, axis=0)
