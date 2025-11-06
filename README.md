
---

````rmarkdown
---
title: "Project eLife – Digital Proof of Life Verification System"
output: github_document
---

# 🧾 Project eLife

**Project eLife** is a secure, mobile-first application developed for the Government of Jamaica to help pensioners digitally verify their life status without visiting a notary or Justice of the Peace. The system uses AI-based facial recognition and liveness detection, built with:

- React Native (Expo) frontend
- Flask API backend
- Firebase Storage + PostgreSQL
- AI-powered face verification and deepfake detection

---

## 🔗 Repository

[GitHub Repo](https://github.com/Jlndre/Capstone-eLife.git)

---

## 🚀 Quick Start

### 📦 Clone the Repository

```bash
git clone https://github.com/Jlndre/Capstone-eLife.git
cd Capstone-eLife
````

---

## 🧪 Frontend Setup (Expo + React Native)

### ✅ Install Node Modules

```bash
npm install
# OR
yarn install
```

### ▶️ Run App with Expo

```bash
npx expo start
# Optional: for web only
npx expo start --web
```

### 💡 Supported Platforms

- Android
- iOS
- Web (PWA)

---

## 🔧 Backend Setup (Flask + PostgreSQL)

### 📁 Navigate to Backend

```bash
cd ../elife-backend
```

### 🐍 Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 📦 Install Python Requirements

```bash
pip install -r requirements.txt
```

#### 🧠 Includes major ML dependencies:

- tensorflow / keras
- keras-facenet
- mediapipe
- easyocr
- opencv-python-headless
- scikit-learn

---

### ⚙️ Create `.env` file

```env
FLASK_ENV=development
DATABASE_URL=postgresql://<user>:<password>@localhost/<db_name>
SECRET_KEY=your_flask_secret
FIREBASE_BUCKET_NAME=your-firebase-bucket.appspot.com
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
JWT_SECRET=your_jwt_secret
```

---

### 🔄 Database Migrations

```bash
flask db init        # Run once
flask db migrate -m "Initial"
flask db upgrade
```

### ▶️ Start Backend Server

```bash
flask run
```

---

## 🔗 Firebase Setup (for Storage)

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Create a Firebase project
3. Enable **Storage**
4. Update Storage rules (for dev):

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write;
    }
  }
}
```

5. Generate service key (Settings > Service Accounts > Generate new key)
6. Rename to `serviceAccountKey.json` and place in `elife-backend/`

---

## 🧠 AI & Vision Techniques Used

- Face Matching: `keras-facenet` + cosine similarity
- Liveness Detection: image sequence + `mediapipe`
- OCR: `easyocr` on IDs
- Deepfake Detection: custom TensorFlow model
- Face Cropping: OpenCV Haar cascades

---

## 📂 Project Structure

```
Capstone-eLife/
├── app/         # React Native (Expo)
│   components/
│   app/
│   assets/
|   constants/
│
├── elife-backend/     # Flask backend + AI
│   ├── app/
│   ├── firebase/
│   ├── migrations/
│   └── .env
└── README.Rmd
```

### ⚠️ Final Setup Reminder

After installing dependencies:

> 🔧 **Update the API base URL**

Open the file:

```ts
utils / config.ts;
```

And replace the placeholder or default API base URL with your local or production backend address:

```ts
// config.ts
export const API_BASE_URL = "http://localhost:5000"; // ← update to your backend URL
```

> ✅ For production deployments, use your live server IP or domain and ensure CORS is properly configured in the Flask backend.

## 🤝 Contributors

- Joel Dixon
- Davia Howard
- Abishua Johnson
- Emani Longmore
