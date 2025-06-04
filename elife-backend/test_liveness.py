# test_liveness.py
"""
Test script for liveness detection
"""

import cv2
import os
from app.liveness_detection import LivenessDetector, analyze_image_sequence_for_liveness

def test_live_camera():
    """Test liveness detection with live camera feed"""
    detector = LivenessDetector()
    cap = cv2.VideoCapture(0)  # Use default camera
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        return
    
    print("Starting live liveness test...")
    print("Look at the camera and blink a few times, move your head slightly")
    print("Press 'q' to quit and see results")
    
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Resize for faster processing
        frame = cv2.resize(frame, (640, 480))
        
        # Analyze frame
        result = detector.analyze_frame(frame)
        
        # Draw analysis info on frame
        if result['face_detected']:
            # Draw status
            status = result['frame_analysis']
            color = (0, 255, 0) if result['blink_detected'] else (255, 0, 0)
            cv2.putText(frame, f"Status: {status}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Draw counters
            cv2.putText(frame, f"Blinks: {detector.total_blinks}", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Movements: {detector.head_movements}", (10, 90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Frames: {detector.frame_counter}", (10, 120), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Draw EAR values
            cv2.putText(frame, f"EAR L: {result['ear_left']:.3f}", (10, 150), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, f"EAR R: {result['ear_right']:.3f}", (10, 170), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        else:
            cv2.putText(frame, "No face detected", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        cv2.imshow('Liveness Detection Test', frame)
        
        # Check for quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
        frame_count += 1
        
        # Auto-quit after reasonable time for testing
        if frame_count > 300:  # About 10 seconds at 30fps
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Get final results
    results = detector.get_liveness_score()
    print("\n" + "="*50)
    print("LIVENESS DETECTION RESULTS")
    print("="*50)
    print(f"Is Live: {results['is_live']}")
    print(f"Confidence: {results['confidence']:.2f}")
    print(f"Reason: {results['reason']}")
    print(f"Total Blinks: {results['blinks']}")
    print(f"Head Movements: {results['head_movements']}")
    print(f"Frames Analyzed: {results['frames_analyzed']}")
    print("="*50)


def test_image_sequence(image_folder):
    """Test liveness detection with a sequence of images"""
    if not os.path.exists(image_folder):
        print(f"Error: Folder {image_folder} does not exist")
        return
    
    # Get all image files
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png']:
        image_files.extend(glob.glob(os.path.join(image_folder, ext)))
    
    image_files.sort()  # Sort to maintain sequence
    
    if len(image_files) < 3:
        print("Error: Need at least 3 images for liveness detection")
        return
    
    print(f"Testing liveness with {len(image_files)} images from {image_folder}")
    
    # Run liveness analysis
    results = analyze_image_sequence_for_liveness(image_files)
    
    print("\n" + "="*50)
    print("LIVENESS DETECTION RESULTS")
    print("="*50)
    print(f"Success: {results['success']}")
    
    if results['success']:
        liveness = results['liveness_result']
        print(f"Is Live: {liveness['is_live']}")
        print(f"Confidence: {liveness['confidence']:.2f}")
        print(f"Reason: {liveness['reason']}")
        print(f"Total Blinks: {liveness['blinks']}")
        print(f"Head Movements: {liveness['head_movements']}")
        print(f"Images Analyzed: {liveness['frames_analyzed']}")
        
        summary = results['summary']
        print(f"\nSummary:")
        print(f"- Faces detected in {summary['faces_detected']}/{results['total_images_analyzed']} images")
        print(f"- Blinks detected: {summary['blinks_detected']}")
        print(f"- Movements detected: {summary['movements_detected']}")
    else:
        print(f"Error: {results.get('error', 'Unknown error')}")
    
    print("="*50)


def create_test_guidelines():
    """Print guidelines for testing liveness detection"""
    print("\n" + "="*60)
    print("LIVENESS DETECTION TESTING GUIDELINES")
    print("="*60)
    print("""
For LIVE PERSON (should pass):
- Look directly at the camera
- Blink naturally 2-3 times during capture
- Make small head movements (slight turns left/right, up/down)
- Maintain good lighting on your face
- Keep face clearly visible and centered

For STATIC PHOTO (should fail):
- Hold a printed photo or show image on phone/screen
- No blinking will be detected
- No natural head movement
- Should be rejected as "not live"

For VIDEO REPLAY (should fail):
- Play a recorded video of a person
- May have some movement but lacks natural micro-movements
- Facial landmarks may not track as naturally
- Should be rejected or have low confidence

MINIMUM REQUIREMENTS:
- At least 2 blinks detected
- At least 1 significant head movement
- Face detected in majority of frames
- Confidence score > 0.7

TROUBLESHOOTING:
- If no face detected: Improve lighting, move closer to camera
- If no blinks: Make sure to blink clearly and naturally
- If no movement: Make subtle head movements while looking at camera
- If low confidence: Ensure good image quality and proper positioning
""")
    print("="*60)


if __name__ == "__main__":
    import glob
    import sys
    
    print("Liveness Detection Test Script")
    create_test_guidelines()
    
    while True:
        print("\nChoose test mode:")
        print("1. Live camera test")
        print("2. Test with image sequence")
        print("3. Show guidelines again")
        print("4. Exit")
        
        choice = input("\nEnter choice (1-4): ").strip()
        
        if choice == "1":
            test_live_camera()
        elif choice == "2":
            folder = input("Enter path to image folder: ").strip()
            test_image_sequence(folder)
        elif choice == "3":
            create_test_guidelines()
        elif choice == "4":
            break
        else:
            print("Invalid choice. Please enter 1-4.")