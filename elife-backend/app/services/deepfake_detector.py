import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array

# Load the model
deepfake_model = load_model("app/models/elife_deepfake_detector_test.keras")

# Load OpenCV Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def extract_face(image: np.ndarray) -> np.ndarray:
    """Detects and crops the face region from the ID image"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)

    if len(faces) == 0:
        raise ValueError("No face detected in ID image.")

    # Use the first detected face
    x, y, w, h = faces[0]
    face = image[y:y+h, x:x+w]
    return face

def is_deepfake(image: np.ndarray, threshold: float = 0.2):
    try:
        face_crop = extract_face(image)
        resized = cv2.resize(face_crop, (128, 128))
        img_array = img_to_array(resized) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        score = deepfake_model.predict(img_array)[0][0]
        print(f"Deepfake model score: {score}")
        return score < threshold, face_crop
    except Exception as e:
        print(f"Deepfake detection error: {e}")
        return None, None