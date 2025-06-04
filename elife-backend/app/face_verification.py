# app/dlib_face_matching.py
"""
Face matching using dlib's face recognition model
"""

import dlib
import cv2
import numpy as np
import os

class DlibFaceMatcher:
    def __init__(self):
        print("[DLIB FACE] Initializing dlib face matcher...")
        
        # Initialize dlib components
        self.face_detector = dlib.get_frontal_face_detector()
        
        # Load models
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Shape predictor (already have this)
        shape_model_path = os.path.join(current_dir, 'models', 'shape_predictor_68_face_landmarks.dat')
        self.shape_predictor = dlib.shape_predictor(shape_model_path)
        
        # Face recognition model (new)
        face_model_path = os.path.join(current_dir, 'models', 'dlib_face_recognition_resnet_model_v1.dat')
        if not os.path.exists(face_model_path):
            raise FileNotFoundError(f"Face recognition model not found: {face_model_path}")
        
        self.face_encoder = dlib.face_recognition_model_v1(face_model_path)
        print("[DLIB FACE] Models loaded successfully")
    
    def detect_and_extract_face(self, image):
        """
        Detect face and return the largest face region
        
        Args:
            image: OpenCV image (BGR format)
            
        Returns:
            tuple: (face_image, face_rect) or (None, None) if no face found
        """
        # Convert to grayscale for detection
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Detect faces
        faces = self.face_detector(gray)
        
        if len(faces) == 0:
            print("[DLIB FACE] No faces detected")
            return None, None
        
        # Get the largest face
        largest_face = max(faces, key=lambda rect: rect.width() * rect.height())
        
        # Extract face region with margin
        margin = int(min(largest_face.width(), largest_face.height()) * 0.2)
        
        x1 = max(0, largest_face.left() - margin)
        y1 = max(0, largest_face.top() - margin)
        x2 = min(image.shape[1], largest_face.right() + margin)
        y2 = min(image.shape[0], largest_face.bottom() + margin)
        
        face_image = image[y1:y2, x1:x2]
        
        print(f"[DLIB FACE] Face detected: {largest_face.width()}x{largest_face.height()}")
        return face_image, largest_face
    
    def get_face_encoding(self, image):
        """
        Get 128-dimensional face encoding from image
        
        Args:
            image: OpenCV image (BGR format)
            
        Returns:
            numpy array: 128D face encoding or None if no face found
        """
        # Convert to grayscale for processing
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Detect faces
        faces = self.face_detector(gray)
        
        if len(faces) == 0:
            return None
        
        # Use the largest face
        face = max(faces, key=lambda rect: rect.width() * rect.height())
        
        # Get facial landmarks
        landmarks = self.shape_predictor(gray, face)
        
        # Get face encoding (128D vector)
        face_encoding = self.face_encoder.compute_face_descriptor(image, landmarks)
        
        # Convert to numpy array
        encoding = np.array(face_encoding)
        
        print(f"[DLIB FACE] Generated encoding with shape: {encoding.shape}")
        return encoding
    
    def compare_faces(self, encoding1, encoding2, tolerance=0.6):
        """
        Compare two face encodings
        
        Args:
            encoding1: First face encoding (128D numpy array)
            encoding2: Second face encoding (128D numpy array)
            tolerance: Distance threshold for match (default 0.6)
            
        Returns:
            tuple: (is_match, distance, similarity_percentage)
        """
        if encoding1 is None or encoding2 is None:
            return False, float('inf'), 0.0
        
        # Calculate Euclidean distance
        distance = np.linalg.norm(encoding1 - encoding2)
        
        # Determine if it's a match
        is_match = distance < tolerance
        
        # Convert distance to similarity percentage (approximate)
        # Distance of 0 = 100% similarity, distance of 1.0 = 0% similarity
        similarity_percentage = max(0, (1.0 - distance) * 100)
        
        print(f"[DLIB FACE] Face comparison - Distance: {distance:.4f}, Match: {is_match}, Similarity: {similarity_percentage:.1f}%")
        
        return is_match, distance, similarity_percentage
    
    def process_verification_images(self, id_image_path, selfie_image_path):
        """
        Complete face verification process
        
        Args:
            id_image_path: Path to ID document image
            selfie_image_path: Path to selfie image
            
        Returns:
            dict: Verification results
        """
        print(f"[DLIB FACE] Starting verification process...")
        print(f"[DLIB FACE] ID image: {id_image_path}")
        print(f"[DLIB FACE] Selfie image: {selfie_image_path}")
        
        try:
            # Load images
            id_image = cv2.imread(id_image_path)
            selfie_image = cv2.imread(selfie_image_path)
            
            if id_image is None:
                return {
                    'success': False,
                    'error': 'Could not load ID image',
                    'match': False,
                    'distance': float('inf'),
                    'similarity': 0.0
                }
            
            if selfie_image is None:
                return {
                    'success': False,
                    'error': 'Could not load selfie image',
                    'match': False,
                    'distance': float('inf'),
                    'similarity': 0.0
                }
            
            print(f"[DLIB FACE] ID image shape: {id_image.shape}")
            print(f"[DLIB FACE] Selfie image shape: {selfie_image.shape}")
            
            # Get face encodings
            id_encoding = self.get_face_encoding(id_image)
            selfie_encoding = self.get_face_encoding(selfie_image)
            
            if id_encoding is None:
                return {
                    'success': False,
                    'error': 'No face found in ID image',
                    'match': False,
                    'distance': float('inf'),
                    'similarity': 0.0
                }
            
            if selfie_encoding is None:
                return {
                    'success': False,
                    'error': 'No face found in selfie image',
                    'match': False,
                    'distance': float('inf'),
                    'similarity': 0.0
                }
            
            # Compare faces
            is_match, distance, similarity = self.compare_faces(id_encoding, selfie_encoding)
            
            return {
                'success': True,
                'match': is_match,
                'distance': float(distance),
                'similarity': float(similarity),
                'id_encoding_shape': id_encoding.shape,
                'selfie_encoding_shape': selfie_encoding.shape
            }
            
        except Exception as e:
            print(f"[DLIB FACE] Error in verification process: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                'success': False,
                'error': str(e),
                'match': False,
                'distance': float('inf'),
                'similarity': 0.0
            }


def select_clearest_image_dlib(image_paths):
    """
    Select the clearest image from a list using Laplacian variance
    (Same as your existing function, but included for completeness)
    """
    if not image_paths:
        return None
    
    clearest = None
    max_variance = -1
    
    for path in image_paths:
        try:
            img = cv2.imread(path)
            if img is None:
                continue
                
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if variance > max_variance:
                max_variance = variance
                clearest = path
                
        except Exception as e:
            print(f"[DLIB FACE] Error processing {path}: {e}")
            continue
    
    print(f"[DLIB FACE] Selected clearest image: {clearest} (variance: {max_variance:.2f})")
    return clearest