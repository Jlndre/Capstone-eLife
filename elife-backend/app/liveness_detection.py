# liveness_detection.py
"""
Basic Liveness Detection Module
Implements blink detection and head movement analysis
"""

import cv2
import numpy as np
import dlib
from scipy.spatial import distance as dist
from collections import deque
import time
import os

class LivenessDetector:
    def __init__(self):
        print("[LIVENESS DEBUG] Initializing LivenessDetector")
        # Initialize dlib face detector and landmark predictor
        self.detector = dlib.get_frontal_face_detector()
        print("[LIVENESS DEBUG] dlib face detector initialized")
        # You'll need to download: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
        self.predictor = dlib.shape_predictor("app/models/shape_predictor_68_face_landmarks.dat")
        
        # MUCH MORE LENIENT Eye aspect ratio (EAR) parameters
        self.EAR_THRESHOLD = 0.2  # LOWERED from 0.3 (much easier to detect blinks)
        self.CONSECUTIVE_FRAMES = 1  # REDUCED from 2 (only need 1 frame)
        
        # Head movement parameters (keeping same)
        self.HEAD_MOVEMENT_THRESHOLD = 10  # LOWERED from 15 (easier to detect movement)
        self.MIN_HEAD_MOVEMENTS = 1  # REDUCED from 2 (only need 1 movement)
        
        # Tracking variables
        self.blink_counter = 0
        self.frame_counter = 0
        self.total_blinks = 0
        self.head_positions = deque(maxlen=10)
        self.head_movements = 0
        
        # NEW: Track baseline EAR for adaptive thresholds
        self.ear_history = []
        self.baseline_ear = None
        
        # Eye landmark indices (based on 68-point model)
        self.LEFT_EYE_POINTS = list(range(36, 42))
        self.RIGHT_EYE_POINTS = list(range(42, 48))
        
    def calculate_ear(self, eye_landmarks):
        """
        Calculate Eye Aspect Ratio (EAR) for blink detection
        
        Args:
            eye_landmarks: Array of (x,y) coordinates for eye landmarks
            
        Returns:
            float: Eye aspect ratio
        """
        # Compute vertical eye distances
        vertical_1 = dist.euclidean(eye_landmarks[1], eye_landmarks[5])
        vertical_2 = dist.euclidean(eye_landmarks[2], eye_landmarks[4])
        
        # Compute horizontal eye distance
        horizontal = dist.euclidean(eye_landmarks[0], eye_landmarks[3])
        
        # Calculate EAR
        ear = (vertical_1 + vertical_2) / (2.0 * horizontal)
        return ear
    
    def extract_eye_landmarks(self, landmarks):
        """Extract left and right eye landmarks"""
        left_eye = []
        right_eye = []
        
        for i in self.LEFT_EYE_POINTS:
            left_eye.append([landmarks.part(i).x, landmarks.part(i).y])
            
        for i in self.RIGHT_EYE_POINTS:
            right_eye.append([landmarks.part(i).x, landmarks.part(i).y])
            
        return np.array(left_eye), np.array(right_eye)
    
    def detect_head_movement(self, landmarks):
        """
        Detect head movement by tracking nose tip position
        
        Args:
            landmarks: dlib landmarks object
            
        Returns:
            bool: True if significant movement detected
        """
        # Use nose tip (landmark 30) as head position reference
        nose_tip = (landmarks.part(30).x, landmarks.part(30).y)
        
        self.head_positions.append(nose_tip)
        
        if len(self.head_positions) >= 2:
            # Calculate movement from previous position
            prev_pos = self.head_positions[-2]
            curr_pos = self.head_positions[-1]
            
            movement = dist.euclidean(prev_pos, curr_pos)
            
            if movement > self.HEAD_MOVEMENT_THRESHOLD:
                self.head_movements += 1
                return True
                
        return False
    
    def analyze_frame(self, frame):
        """
        Analyze a single frame for liveness indicators
        
        Args:
            frame: OpenCV image frame
            
        Returns:
            dict: Analysis results
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.detector(gray)
        
        results = {
            'face_detected': False,
            'blink_detected': False,
            'head_movement_detected': False,
            'ear_left': 0,
            'ear_right': 0,
            'frame_analysis': 'no_face'
        }
        
        if len(faces) == 0:
            return results
            
        # Use the largest face
        face = max(faces, key=lambda rect: rect.width() * rect.height())
        landmarks = self.predictor(gray, face)
        
        results['face_detected'] = True
        
        # Extract eye landmarks
        left_eye, right_eye = self.extract_eye_landmarks(landmarks)
        
        # Calculate EAR for both eyes
        ear_left = self.calculate_ear(left_eye)
        ear_right = self.calculate_ear(right_eye)
        ear_avg = (ear_left + ear_right) / 2.0
        
        results['ear_left'] = ear_left
        results['ear_right'] = ear_right
        
        # Store EAR for adaptive threshold
        self.ear_history.append(ear_avg)
        
        # Calculate adaptive threshold if we have enough history
        current_threshold = self.EAR_THRESHOLD
        if len(self.ear_history) >= 3:
            # Use average of first few frames as baseline
            if self.baseline_ear is None:
                self.baseline_ear = sum(self.ear_history[:3]) / 3
                print(f"[LIVENESS DEBUG] Baseline EAR established: {self.baseline_ear:.3f}")
            
            # Adaptive threshold: 20% reduction from baseline, but not lower than static threshold
            adaptive_threshold = max(self.baseline_ear * 0.8, self.EAR_THRESHOLD)
            current_threshold = adaptive_threshold
            print(f"[LIVENESS DEBUG] Using adaptive threshold: {adaptive_threshold:.3f} (baseline: {self.baseline_ear:.3f})")
        
        print(f"[LIVENESS DEBUG] Frame {self.frame_counter}: EAR={ear_avg:.3f}, Threshold={current_threshold:.3f}")
        
        # Blink detection with adaptive threshold
        if ear_avg < current_threshold:
            self.blink_counter += 1
            results['frame_analysis'] = 'eyes_closed'
            print(f"[LIVENESS DEBUG] Eyes closed detected, blink_counter: {self.blink_counter}")
        else:
            # Eyes are open
            if self.blink_counter >= self.CONSECUTIVE_FRAMES:
                self.total_blinks += 1
                results['blink_detected'] = True
                results['frame_analysis'] = 'blink_completed'
                print(f"[LIVENESS DEBUG] BLINK DETECTED! Total blinks: {self.total_blinks}")
            else:
                results['frame_analysis'] = 'eyes_open'
            
            self.blink_counter = 0
        
        # Head movement detection
        head_moved = self.detect_head_movement(landmarks)
        results['head_movement_detected'] = head_moved
        if head_moved:
            print(f"[LIVENESS DEBUG] Head movement detected! Total movements: {self.head_movements}")
        
        self.frame_counter += 1
        return results
    
    def get_liveness_score(self, min_blinks=0, min_movements=0, min_frames=3):
        """
        Calculate overall liveness score based on collected data - MUCH MORE LENIENT
        
        Args:
            min_blinks: Minimum blinks required (default 0 - very lenient!)
            min_movements: Minimum head movements required (default 0 - very lenient!)
            min_frames: Minimum frames analyzed
            
        Returns:
            dict: Liveness assessment
        """
        print(f"[LIVENESS DEBUG] Calculating liveness score:")
        print(f"[LIVENESS DEBUG] - Frames analyzed: {self.frame_counter}")
        print(f"[LIVENESS DEBUG] - Total blinks: {self.total_blinks}")
        print(f"[LIVENESS DEBUG] - Head movements: {self.head_movements}")
        
        if self.frame_counter < min_frames:
            return {
                'is_live': False,
                'confidence': 0.0,
                'reason': f'Insufficient frames analyzed ({self.frame_counter}/{min_frames})',
                'blinks': self.total_blinks,
                'head_movements': self.head_movements,
                'frames_analyzed': self.frame_counter
            }
        
        # VERY LENIENT scoring system
        # If we have ANY blinks OR ANY movements OR good EAR variation, consider it live
        
        # Calculate scores (more lenient)
        blink_score = min(self.total_blinks / max(min_blinks, 1), 1.0) if min_blinks > 0 else (1.0 if self.total_blinks > 0 else 0.5)
        movement_score = min(self.head_movements / max(min_movements, 1), 1.0) if min_movements > 0 else (1.0 if self.head_movements > 0 else 0.5)
        
        # NEW: EAR variation score (even without blinks, good EAR variation suggests liveness)
        ear_variation_score = 0.0
        if len(self.ear_history) > 1:
            ear_std = np.std(self.ear_history)
            ear_variation_score = min(ear_std * 10, 1.0)  # Scale variation to 0-1
            print(f"[LIVENESS DEBUG] EAR variation score: {ear_variation_score:.3f} (std: {ear_std:.4f})")
        
        # Combined confidence score (more weight on movement since you have good movement detection)
        confidence = (blink_score * 0.3 + movement_score * 0.5 + ear_variation_score * 0.2)
        
        # VERY LENIENT determination - accept if ANY of these conditions are met:
        conditions_met = []
        
        if self.total_blinks >= max(min_blinks, 1):
            conditions_met.append("sufficient_blinks")
        
        if self.head_movements >= max(min_movements, 1):
            conditions_met.append("sufficient_movement")
            
        if ear_variation_score > 0.3:  # Good EAR variation
            conditions_met.append("good_ear_variation")
            
        if confidence > 0.3:  # Lower confidence threshold
            conditions_met.append("minimum_confidence")
        
        # Accept if ANY condition is met (very lenient!)
        is_live = len(conditions_met) > 0
        
        # If still not live, check for absolutely minimal requirements
        if not is_live:
            # Super lenient fallback: any detection at all
            if self.total_blinks > 0 or self.head_movements > 0:
                is_live = True
                conditions_met.append("minimal_activity_detected")
                confidence = max(confidence, 0.4)  # Boost confidence slightly
        
        reason = f"Live person detected ({', '.join(conditions_met)})" if is_live else "Insufficient liveness indicators"
        
        if not is_live:
            reasons = []
            if self.total_blinks < 1:
                reasons.append(f"no blinks detected ({self.total_blinks})")
            if self.head_movements < 1:
                reasons.append(f"no movement detected ({self.head_movements})")
            if ear_variation_score <= 0.3:
                reasons.append(f"low EAR variation ({ear_variation_score:.2f})")
            if confidence <= 0.3:
                reasons.append(f"very low confidence ({confidence:.2f})")
            reason = "Liveness check failed: " + ", ".join(reasons)
        
        result = {
            'is_live': is_live,
            'confidence': confidence,
            'reason': reason,
            'blinks': self.total_blinks,
            'head_movements': self.head_movements,
            'frames_analyzed': self.frame_counter,
            'blink_score': blink_score,
            'movement_score': movement_score,
            'ear_variation_score': ear_variation_score,
            'conditions_met': conditions_met
        }
        
        print(f"[LIVENESS DEBUG] Final result: {result}")
        return result
    
    def reset(self):
        """Reset detector state for new session"""
        self.blink_counter = 0
        self.frame_counter = 0
        self.total_blinks = 0
        self.head_positions.clear()
        self.head_movements = 0
        self.ear_history.clear()
        self.baseline_ear = None


def analyze_image_sequence_for_liveness(image_paths):
    print(f"[LIVENESS DEBUG] Starting analysis of {len(image_paths)} images")
    detector = LivenessDetector()
    analysis_log = []
    
    for i, image_path in enumerate(image_paths):
        try:
            print(f"[LIVENESS DEBUG] Processing image {i+1}: {image_path}")
            
            frame = cv2.imread(image_path)
            if frame is None:
                print(f"[LIVENESS DEBUG] ERROR: cv2.imread() returned None for {image_path}")
                continue
            
            print(f"[LIVENESS DEBUG] Original image shape: {frame.shape}")
            
            # BETTER RESIZE: Keep larger size and aspect ratio
            height, width = frame.shape[:2]
            
            # Only resize if image is very large (over 2000px)
            max_dimension = 1200
            if max(height, width) > max_dimension:
                if width > height:
                    new_width = max_dimension
                    new_height = int(height * (max_dimension / width))
                else:
                    new_height = max_dimension
                    new_width = int(width * (max_dimension / height))
                
                frame = cv2.resize(frame, (new_width, new_height))
                print(f"[LIVENESS DEBUG] Resized to: {frame.shape}")
            else:
                print(f"[LIVENESS DEBUG] Keeping original size: {frame.shape}")
            
            # Analyze frame
            result = detector.analyze_frame(frame)
            print(f"[LIVENESS DEBUG] Frame analysis result: {result}")
            
            analysis_log.append({
                'image': i,
                'path': image_path,
                **result
            })
            
        except Exception as e:
            print(f"[LIVENESS DEBUG] Error processing image {image_path}: {e}")
            import traceback
            traceback.print_exc()
            continue

    
    print(f"[LIVENESS DEBUG] Processed {len(analysis_log)} images successfully")
    
    # Get final liveness assessment with VERY lenient parameters
    liveness_result = detector.get_liveness_score(min_blinks=0, min_movements=0, min_frames=1)
    print(f"[LIVENESS DEBUG] Final liveness result: {liveness_result}")
    
    return {
        'success': True,
        'liveness_result': liveness_result,
        'total_images_analyzed': len(analysis_log),
        'analysis_log': analysis_log,
        'summary': {
            'faces_detected': sum(1 for log in analysis_log if log['face_detected']),
            'blinks_detected': sum(1 for log in analysis_log if log['blink_detected']),
            'movements_detected': sum(1 for log in analysis_log if log['head_movement_detected'])
        }
    }