"""
Utility functions for authentication, image processing, date parsing, and verification.
"""

from functools import wraps
from flask import request, jsonify
import jwt
import numpy as np
import cv2
import re
import warnings  # Add this import at module level
from datetime import datetime, timezone, timedelta
from dateutil.parser import parse
from app.models import User
from app.config import app_config
import easyocr
from typing import Dict, List, Optional
from difflib import SequenceMatcher
import logging

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
# Enhanced OCR Utilities
# =======================

class IDDocumentPreprocessor:
    """Enhanced image preprocessing for better OCR accuracy"""
    
    def __init__(self):
        pass
    
    def enhance_image(self, image):
        """Apply multiple enhancement techniques"""
        enhanced_images = []
        
        # 1. Basic enhancement
        enhanced_images.append(self.basic_enhancement(image.copy()))
        
        # 2. Contrast enhancement
        enhanced_images.append(self.enhance_contrast(image.copy()))
        
        # 3. Noise reduction
        enhanced_images.append(self.reduce_noise(image.copy()))
        
        # 4. Sharpening
        enhanced_images.append(self.sharpen_image(image.copy()))
        
        return enhanced_images
    
    def basic_enhancement(self, img):
        """Basic image enhancement"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        processed = cv2.morphologyEx(processed, cv2.MORPH_OPEN, kernel)
        return processed
    
    def enhance_contrast(self, img):
        """Enhance contrast using CLAHE"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        return enhanced
    
    def reduce_noise(self, img):
        """Reduce noise while preserving text"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        return denoised
    
    def sharpen_image(self, img):
        """Apply sharpening filter"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]])
        sharpened = cv2.filter2D(gray, -1, kernel)
        return sharpened


class IDTextProcessor:
    """Text post-processing and validation for ID documents"""
    
    def __init__(self):
        # Common OCR errors and corrections
        self.common_errors = {
            '0': ['O', 'o', 'Q', 'D'],
            '1': ['I', 'l', '|', 'i'],
            '2': ['Z'],
            '5': ['S', 's'],
            '6': ['G', 'b'],
            '8': ['B'],
            'O': ['0'],
            'I': ['1', 'l'],
            'S': ['5'],
            'Z': ['2'],
            'G': ['6'],
            'B': ['8']
        }
        
        # ID-specific patterns
        self.patterns = {
            'passport_number': r'[A-Z]{1,2}\d{6,9}',
            'date': r'\d{1,2}[-/\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-/\s]\d{4}',
            'jamaican_trn': r'\d{9}',
            'electoral_id': r'[A-Z]\d{8}',  # Common Electoral ID format
            'phone': r'[\+]?[\d\s\-\(\)]{10,15}',
            'name': r'[A-Z][a-z]+\s+[A-Z][a-z]+',
        }
    
    def clean_text(self, text):
        """Clean extracted text"""
        text = re.sub(r'\s+', ' ', text.strip())
        text = re.sub(r'[^\w\s\-/.,]', '', text)
        return text
    
    def correct_common_errors(self, text, field_type='general'):
        """Correct common OCR errors based on context"""
        corrected = text
        
        if field_type == 'number':
            # For numeric fields, prioritize digits
            for correct, errors in self.common_errors.items():
                if correct.isdigit():
                    for error in errors:
                        corrected = corrected.replace(error, correct)
        
        elif field_type == 'text':
            # For text fields, prioritize letters
            for correct, errors in self.common_errors.items():
                if correct.isalpha():
                    for error in errors:
                        if error.isdigit():
                            corrected = corrected.replace(error, correct)
        
        return corrected
    
    def extract_specific_fields(self, text):
        """Extract specific ID document fields"""
        fields = {}
        
        # Extract dates
        date_matches = re.findall(self.patterns['date'], text, re.IGNORECASE)
        if date_matches:
            fields['dates'] = date_matches
        
        # Extract passport numbers
        passport_matches = re.findall(self.patterns['passport_number'], text)
        if passport_matches:
            fields['passport_numbers'] = passport_matches
        
        # Extract TRN (Jamaican Tax Registration Number)
        trn_matches = re.findall(self.patterns['jamaican_trn'], text)
        if trn_matches:
            fields['trn'] = trn_matches
        
        # Extract electoral ID numbers
        electoral_matches = re.findall(self.patterns['electoral_id'], text)
        if electoral_matches:
            fields['electoral_numbers'] = electoral_matches
        
        return fields
    
    def extract_passport_number(self, text):
        """
        Extract passport number from OCR text with improved patterns for Jamaican passports
        
        Args:
            text (str): OCR extracted text
            
        Returns:
            list: List of potential passport numbers found
        """
        # Common Jamaican passport patterns
        passport_patterns = [
            # Pattern 1: Standard format like GN8i NAL2S (letters+numbers+letters+numbers)
            r'\b([A-Z]{2}\d[A-Z]\s*[A-Z]{3}\d[A-Z])\b',
            
            # Pattern 2: Continuous format like GN8INAL2S
            r'\b([A-Z]{2}\d[A-Z][A-Z]{3}\d[A-Z])\b',
            
            # Pattern 3: More flexible - 2 letters, numbers, letters pattern
            r'\b([A-Z]{2,3}\d{1,2}[A-Z]{2,4}\d{1,2}[A-Z]?)\b',
            
            # Pattern 4: Look for alphanumeric sequences that could be passport numbers
            r'\b([A-Z]{2}\d[A-Z0-9]{2,6}[A-Z0-9])\b',
            
            # Pattern 5: Very flexible pattern for any sequence near passport keywords
            r'passport.*?([A-Z]{2}\d[A-Z0-9]{3,8})',
            
            # Pattern 6: Handle OCR errors - look for sequences with mixed case
            r'\b([A-Za-z]{2}\d[A-Za-z]{1,2}\s*[A-Za-z]{2,4}\d[A-Za-z]?)\b'
        ]
        
        found_numbers = []
        
        # Clean text for better pattern matching
        cleaned_text = re.sub(r'[^\w\s]', ' ', text)  # Remove special chars except word chars and spaces
        
        for i, pattern in enumerate(passport_patterns):
            try:
                matches = re.findall(pattern, cleaned_text, re.IGNORECASE)
                for match in matches:
                    # Clean up the match (remove extra spaces, normalize case)
                    clean_match = re.sub(r'\s+', '', match.upper())
                    
                    # Validate the match - reasonable length and pattern
                    if 6 <= len(clean_match) <= 12 and re.match(r'^[A-Z0-9]+$', clean_match):
                        # Avoid duplicates
                        if clean_match not in found_numbers:
                            found_numbers.append(clean_match)
                            print(f"[DEBUG] Passport pattern {i+1} found: {clean_match}")
            except Exception as e:
                print(f"[DEBUG] Error in passport pattern {i+1}: {e}")
                continue
        
        # Special handling for the specific format in your OCR: "GN8i NAL2S"
        # Look for this specific pattern with potential OCR variations
        special_pattern = r'([A-Z]{2}\d[A-Za-z]\s+[A-Z]{3}\d[A-Z])'
        special_matches = re.findall(special_pattern, text)
        
        for match in special_matches:
            clean_match = re.sub(r'\s+', '', match.upper())
            if clean_match not in found_numbers and len(clean_match) >= 6:
                found_numbers.append(clean_match)
                print(f"[DEBUG] Special passport pattern found: {clean_match}")
        
        print(f"[DEBUG] Total passport numbers extracted: {found_numbers}")
        return found_numbers


def enhanced_ocr_extraction(image, reader=None):
    """
    Streamlined OCR extraction with smart preprocessing - ALL IN MEMORY
    
    Args:
        image (np.ndarray): Input image (numpy array in memory)
        reader (easyocr.Reader, optional): EasyOCR reader instance
    
    Returns:
        dict: Best OCR result with confidence score
    """
    if reader is None:
        # Initialize EasyOCR with optimized settings for Mac
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    
    text_processor = IDTextProcessor()
    
    # Try just 2-3 quick approaches instead of 7+ - ALL IN MEMORY
    attempts = []
    
    # 1. Try original image first (fastest) - Direct numpy array processing
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            # Process image directly from memory - no file saving
            results = reader.readtext(image, paragraph=False)
        if results:
            confidence = sum([r[2] for r in results]) / len(results)
            text = ' '.join([r[1] for r in results])
            attempts.append({
                'method': 'original',
                'text': text,
                'confidence': confidence
            })
            
            # If confidence is good enough, return immediately
            if confidence > 0.6:
                cleaned_text = text_processor.clean_text(text)
                return {
                    'text': cleaned_text,
                    'raw_text': text,
                    'confidence': confidence,
                    'method': 'original_fast',
                    'enhanced': False,
                    'total_attempts': 1
                }
    except Exception as e:
        print(f"Original OCR failed: {e}")
    
    # 2. Only try enhanced preprocessing if original confidence is low - IN MEMORY
    if not attempts or attempts[0]['confidence'] < 0.6:
        try:
            # Quick grayscale + threshold enhancement - IN MEMORY ONLY
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # Process enhanced image directly from memory - NO FILE SAVING
                results = reader.readtext(thresh)
            if results:
                confidence = sum([r[2] for r in results]) / len(results)
                text = ' '.join([r[1] for r in results])
                attempts.append({
                    'method': 'enhanced_threshold',
                    'text': text,
                    'confidence': confidence
                })
        except Exception as e:
            print(f"Enhanced OCR failed: {e}")
    
    # 3. Last resort: try with different OCR config - IN MEMORY
    if not attempts or max(a['confidence'] for a in attempts) < 0.5:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # Process with different config directly from memory
                results = reader.readtext(image, paragraph=True, width_ths=0.5)
            if results:
                confidence = sum([r[2] for r in results]) / len(results)
                text = ' '.join([r[1] for r in results])
                attempts.append({
                    'method': 'paragraph_mode',
                    'text': text,
                    'confidence': confidence
                })
        except Exception as e:
            print(f"Paragraph OCR failed: {e}")
    
    if not attempts:
        return {
            'text': '',
            'confidence': 0.0,
            'method': 'none',
            'enhanced': False
        }
    
    # Return the result with highest confidence
    best_result = max(attempts, key=lambda x: x['confidence'])
    
    # Apply text cleaning and processing
    cleaned_text = text_processor.clean_text(best_result['text'])
    
    return {
        'text': cleaned_text,
        'raw_text': best_result['text'],
        'confidence': best_result['confidence'],
        'method': best_result['method'],
        'enhanced': len(attempts) > 1,
        'total_attempts': len(attempts)
    }


# =======================
# Document Utilities
# =======================

def detect_id_type(text):
    """
    Detect the type of ID document from extracted text.

    Args:
        text (str): OCR-extracted text.

    Returns:
        str: Document type (passport, driver_license, electoral_id, or unknown).
    """
    lower = text.lower()
    
    # Passport detection
    if "passport" in lower or "pica" in lower:
        return "passport"
    
    # Driver's License detection
    if "driver" in lower or "licence" in lower or "license" in lower:
        return "driver_license"
    
    # Electoral ID detection (replaces NIDS)
    if any(keyword in lower for keyword in ["elector", "electoral", "voter", "eoj", "jamaica electoral", "national"]):
        return "electoral_id"
    
    return "unknown"


def extract_expiry_date(text):
    """
    Enhanced expiry date extraction function that handles multiple date formats
    commonly found in Jamaican government documents including passport format.
    
    Args:
        text (str): OCR extracted text
        
    Returns:
        datetime or None: Parsed expiry date if found and valid, None otherwise
    """
    
    if not text:
        return None
    
    # Convert to lowercase for case-insensitive matching
    text_lower = text.lower()
    
    print(f"[DEBUG] Looking for expiry date in: {text}")
    
    # Define comprehensive regex patterns for different date formats
    date_patterns = [
        # Pattern 1: DD MMM YYYY format (common on passports) - NEW PATTERN
        r'(?:expiry|expiration|expires?|exp|delrration|delrration)\s*(?:date|dt|ife)?\s*:?\s*/?[^\d]*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})',
        
        # Pattern 2: Look for dates after "EXPIRY" or similar text - DD MMM YYYY
        r'(?:expiry|expiration|expires?|exp|delrration|delrration).*?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})',
        
        # Pattern 3: YYYY-MM-DD format (most common in your OCR)
        r'(?:expiry|expiration|expires?|exp)\s*(?:date|dt)?\s*:?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        
        # Pattern 4: Look for dates after "EXPIRY DATE" text
        r'expiry\s+date\s+[a-z]*\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        
        # Pattern 5: Any 4-digit year followed by 2-digit month/day in expiry context
        r'expiry.*?(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        
        # Pattern 6: DD/MM/YYYY or MM/DD/YYYY format
        r'(?:expiry|expiration|expires?|exp)\s*(?:date|dt)?\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
        
        # Pattern 7: Look for standalone dates that could be expiry dates
        r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        
        # Pattern 8: More flexible pattern for dates near expiry text
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
    ]
    
    # Month name mapping for passport format
    month_map = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    }
    
    current_year = datetime.now().year
    found_dates = []
    
    # Try each pattern
    for i, pattern in enumerate(date_patterns):
        print(f"[DEBUG] Trying pattern {i+1}: {pattern}")
        
        if i < 2:  # For DD MMM YYYY patterns (passport format)
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            print(f"[DEBUG] Pattern {i+1} matches: {matches}")
            
            for match in matches:
                try:
                    if len(match) == 3:  # (day, month, year)
                        day, month_name, year = match
                        month_num = month_map.get(month_name.lower())
                        
                        if month_num:
                            date_str = f"{year}-{month_num}-{day.zfill(2)}"
                            print(f"[DEBUG] Attempting to parse passport date: {date_str}")
                            
                            parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
                            
                            # Check if the date is reasonable
                            year_diff = parsed_date.year - current_year
                            
                            if -1 <= year_diff <= 20:  # Valid expiry range
                                found_dates.append((parsed_date, f"{day} {month_name.upper()} {year}", i+1))
                                print(f"[DEBUG] Valid passport expiry date found: {parsed_date} from pattern {i+1}")
                
                except Exception as e:
                    print(f"[DEBUG] Error parsing passport date '{match}': {e}")
                    continue
        
        elif i < 6:  # For expiry-specific patterns
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            print(f"[DEBUG] Pattern {i+1} matches: {matches}")
            
            for match in matches:
                try:
                    # Clean up the match
                    date_str = match.strip()
                    print(f"[DEBUG] Attempting to parse date: {date_str}")
                    
                    # Try to parse the date
                    parsed_date = None
                    
                    # Handle different date formats
                    if re.match(r'\d{4}[-/]\d{1,2}[-/]\d{1,2}', date_str):
                        # YYYY-MM-DD or YYYY/MM/DD format
                        parsed_date = datetime.strptime(date_str.replace('/', '-'), '%Y-%m-%d')
                    elif re.match(r'\d{1,2}[-/]\d{1,2}[-/]\d{4}', date_str):
                        # DD-MM-YYYY or MM-DD-YYYY format
                        # Try both interpretations
                        try:
                            # Try DD-MM-YYYY first (more common internationally)
                            parsed_date = datetime.strptime(date_str.replace('/', '-'), '%d-%m-%Y')
                        except ValueError:
                            try:
                                # Try MM-DD-YYYY if DD-MM-YYYY fails
                                parsed_date = datetime.strptime(date_str.replace('/', '-'), '%m-%d-%Y')
                            except ValueError:
                                continue
                    
                    if parsed_date:
                        # Check if the date is reasonable (not in the past, not too far in future)
                        year_diff = parsed_date.year - current_year
                        
                        # Valid expiry dates should be in the future but not more than 20 years out
                        if -1 <= year_diff <= 20:  # Allow 1 year in past for recently expired IDs
                            found_dates.append((parsed_date, date_str, i+1))
                            print(f"[DEBUG] Valid expiry date found: {parsed_date} from pattern {i+1}")
                    
                except Exception as e:
                    print(f"[DEBUG] Error parsing date '{match}': {e}")
                    continue
        
        else:  # For general date patterns, check if "expiry" is nearby
            if 'expiry' in text_lower or 'expiration' in text_lower or 'delrration' in text_lower:
                matches = re.findall(pattern, text, re.IGNORECASE)
                print(f"[DEBUG] Pattern {i+1} matches: {matches}")
                
                for match in matches:
                    try:
                        # Clean up the match
                        date_str = match.strip()
                        print(f"[DEBUG] Attempting to parse date: {date_str}")
                        
                        # Try to parse the date
                        parsed_date = None
                        
                        # Handle different date formats
                        if re.match(r'\d{4}[-/]\d{1,2}[-/]\d{1,2}', date_str):
                            # YYYY-MM-DD or YYYY/MM/DD format
                            parsed_date = datetime.strptime(date_str.replace('/', '-'), '%Y-%m-%d')
                        elif re.match(r'\d{1,2}[-/]\d{1,2}[-/]\d{4}', date_str):
                            # DD-MM-YYYY or MM-DD-YYYY format
                            # Try both interpretations
                            try:
                                # Try DD-MM-YYYY first (more common internationally)
                                parsed_date = datetime.strptime(date_str.replace('/', '-'), '%d-%m-%Y')
                            except ValueError:
                                try:
                                    # Try MM-DD-YYYY if DD-MM-YYYY fails
                                    parsed_date = datetime.strptime(date_str.replace('/', '-'), '%m-%d-%Y')
                                except ValueError:
                                    continue
                        
                        if parsed_date:
                            # Check if the date is reasonable (not in the past, not too far in future)
                            year_diff = parsed_date.year - current_year
                            
                            # Valid expiry dates should be in the future but not more than 20 years out
                            if -1 <= year_diff <= 20:  # Allow 1 year in past for recently expired IDs
                                found_dates.append((parsed_date, date_str, i+1))
                                print(f"[DEBUG] Valid expiry date found: {parsed_date} from pattern {i+1}")
                        
                    except Exception as e:
                        print(f"[DEBUG] Error parsing date '{match}': {e}")
                        continue
    
    # If we found multiple dates, prefer the most recent future date
    if found_dates:
        # Sort by date and prefer future dates
        future_dates = [d for d in found_dates if d[0] > datetime.now()]
        if future_dates:
            # Return the earliest future date (most likely to be correct expiry)
            selected_date = min(future_dates, key=lambda x: x[0])
            print(f"[DEBUG] Selected future expiry date: {selected_date[0]} (from pattern {selected_date[2]})")
            return selected_date[0]
        else:
            # If no future dates, return the most recent date
            selected_date = max(found_dates, key=lambda x: x[0])
            print(f"[DEBUG] Selected most recent date: {selected_date[0]} (from pattern {selected_date[2]})")
            return selected_date[0]
    
    # Fallback: Look for any date that appears to be in the future
    # This handles cases where the expiry date might not have clear context
    print("[DEBUG] No expiry-specific dates found, looking for future dates...")
    
    # Special fallback for passport format DD MMM YYYY anywhere in text
    passport_date_pattern = r'\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b'
    passport_matches = re.findall(passport_date_pattern, text_lower, re.IGNORECASE)
    
    future_dates_fallback = []
    for match in passport_matches:
        try:
            day, month_name, year = match
            month_num = month_map.get(month_name.lower())
            
            if month_num:
                date_str = f"{year}-{month_num}-{day.zfill(2)}"
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
                
                year_diff = parsed_date.year - current_year
                if 0 <= year_diff <= 15:  # Future dates within 15 years
                    future_dates_fallback.append((parsed_date, f"{day} {month_name.upper()} {year}"))
                    print(f"[DEBUG] Fallback passport date found: {parsed_date}")
                    
        except Exception as e:
            print(f"[DEBUG] Error parsing fallback passport date: {e}")
            continue
    
    # Also try standard numeric dates
    all_date_pattern = r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b'
    all_matches = re.findall(all_date_pattern, text)
    
    for match in all_matches:
        try:
            date_str = match.strip()
            parsed_date = None
            
            if re.match(r'\d{4}[-/]\d{1,2}[-/]\d{1,2}', date_str):
                parsed_date = datetime.strptime(date_str.replace('/', '-'), '%Y-%m-%d')
            elif re.match(r'\d{1,2}[-/]\d{1,2}[-/]\d{4}', date_str):
                try:
                    parsed_date = datetime.strptime(date_str.replace('/', '-'), '%d-%m-%Y')
                except ValueError:
                    try:
                        parsed_date = datetime.strptime(date_str.replace('/', '-'), '%m-%d-%Y')
                    except ValueError:
                        continue
            
            if parsed_date:
                year_diff = parsed_date.year - current_year
                if 0 <= year_diff <= 10:  # Future dates within 10 years
                    future_dates_fallback.append((parsed_date, date_str))
                    
        except Exception as e:
            continue
    
    if future_dates_fallback:
        # Return the earliest future date
        selected_date = min(future_dates_fallback, key=lambda x: x[0])
        print(f"[DEBUG] Fallback future date selected: {selected_date[0]}")
        return selected_date[0]
    
    print("[DEBUG] No valid expiry date found")
    return None


# =======================
# Quarter Verification - UPDATED
# =======================

def get_quarter_opening_date(quarter_name, year):
    """
    Get the opening date for a quarter (when verification becomes available).
    
    Args:
        quarter_name (str): Quarter name ('First', 'Second', 'Third', 'Fourth')
        year (int): Year
        
    Returns:
        datetime: Opening date for the quarter
    """
    opening_dates = {
        "First": datetime(year, 1, 1),   # January 1
        "Second": datetime(year, 4, 1),  # April 1
        "Third": datetime(year, 7, 1),   # July 1
        "Fourth": datetime(year, 10, 1)  # October 1
    }
    
    return opening_dates.get(quarter_name, datetime(year, 1, 1))


def get_current_quarter_name(date=None):
    """
    Get the current quarter name based on date.
    
    Args:
        date (datetime, optional): Date to check. Uses current time if None.
        
    Returns:
        str: Quarter name ('First', 'Second', 'Third', 'Fourth')
    """
    if date is None:
        date = datetime.utcnow()
    
    month = date.month
    if month <= 3:
        return "First"
    elif month <= 6:
        return "Second"
    elif month <= 9:
        return "Third"
    else:
        return "Fourth"


def is_quarter_open_for_verification(quarter_name, year, check_date=None):
    """
    Check if a quarter is open for verification.
    
    Args:
        quarter_name (str): Quarter name
        year (int): Year
        check_date (datetime, optional): Date to check against. Uses current time if None.
        
    Returns:
        bool: True if quarter is open for verification
    """
    if check_date is None:
        check_date = datetime.utcnow()
    
    opening_date = get_quarter_opening_date(quarter_name, year)
    return check_date.date() >= opening_date.date()


def calculate_quarter_due_date(quarter_num, year, current_date=None):
    """
    Calculate due date for a quarter - UPDATED to use end of quarter.

    Args:
        quarter_num (str): Quarter (e.g., 'First', 'Second', 'Third', 'Fourth').
        year (int): Year of the quarter.
        current_date (datetime, optional): Used for testing or overrides.

    Returns:
        datetime: Calculated due date (end of quarter).
    """
    if current_date is None:
        current_date = datetime.utcnow()

    # Due date is the end of each quarter
    due_dates = {
        "First": datetime(year, 3, 31),   # End of March
        "Second": datetime(year, 6, 30),  # End of June
        "Third": datetime(year, 9, 30),   # End of September
        "Fourth": datetime(year, 12, 31)  # End of December
    }

    return due_dates.get(quarter_num, datetime(year, 3, 31))


def get_quarter_verification_window(quarter_name, year):
    """
    Get the full verification window for a quarter.
    
    Args:
        quarter_name (str): Quarter name
        year (int): Year
        
    Returns:
        tuple: (opening_date, due_date)
    """
    opening_date = get_quarter_opening_date(quarter_name, year)
    due_date = calculate_quarter_due_date(quarter_name, year)
    
    return opening_date, due_date


def validate_quarter_verification_eligibility(user, quarter_name, year):
    """
    Validate if a user is eligible to submit verification for a quarter.
    
    Args:
        user: User object
        quarter_name (str): Quarter name
        year (int): Year
        
    Returns:
        dict: Validation result with 'eligible' boolean and 'reason' string
    """
    from app.models import QuarterVerification, ProofSubmission
    from app import db
    
    current_date = datetime.utcnow()
    
    # 1. Check if quarter is open
    if not is_quarter_open_for_verification(quarter_name, year, current_date):
        opening_date = get_quarter_opening_date(quarter_name, year)
        return {
            'eligible': False,
            'reason': f'Quarter not yet open. Opens on {opening_date.strftime("%B %d, %Y")}',
            'opens_on': opening_date.strftime('%Y-%m-%d')
        }
    
    # 2. Check if quarter has passed its due date
    due_date = calculate_quarter_due_date(quarter_name, year)
    if current_date.date() > due_date.date():
        return {
            'eligible': False,
            'reason': f'Quarter verification period has ended. Was due by {due_date.strftime("%B %d, %Y")}',
            'due_date': due_date.strftime('%Y-%m-%d')
        }
    
    # 3. Check if user already has completed verification for this quarter
    existing_quarter = QuarterVerification.query.filter_by(
        user_id=user.id,
        quarter=quarter_name,
        year=year,
        status='completed'
    ).first()
    
    if existing_quarter:
        return {
            'eligible': False,
            'reason': f'Already completed verification for {quarter_name} Quarter {year}',
            'completed_date': existing_quarter.verified_at.strftime('%Y-%m-%d') if existing_quarter.verified_at else None
        }
    
    # 4. Check if user has approved proof submission for this quarter
    existing_proof = db.session.query(ProofSubmission).join(
        QuarterVerification,
        ProofSubmission.id == QuarterVerification.proof_submission_id
    ).filter(
        ProofSubmission.user_id == user.id,
        ProofSubmission.status == 'approved',
        QuarterVerification.quarter == quarter_name,
        QuarterVerification.year == year
    ).first()
    
    if existing_proof:
        return {
            'eligible': False,
            'reason': f'Already have approved verification for {quarter_name} Quarter {year}',
            'proof_submission_id': existing_proof.id
        }
    
    # All checks passed
    return {
        'eligible': True,
        'reason': 'Eligible for verification',
        'opens_on': get_quarter_opening_date(quarter_name, year).strftime('%Y-%m-%d'),
        'due_date': due_date.strftime('%Y-%m-%d')
    }


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
        faces (list or np.ndarray): Face bounding boxes [(x, y, w, h)].
        img (np.ndarray): Original image.

    Returns:
        np.ndarray: Cropped face image.
    """
    # Fix: Check array length instead of truth value
    if len(faces) == 0:
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

