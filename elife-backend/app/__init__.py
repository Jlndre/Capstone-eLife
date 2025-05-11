from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_cors import CORS
from app.config import Config

import firebase_admin
from firebase_admin import credentials, storage
import os

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    login_manager.login_view = 'auth.login'

    firebase_key_path = os.path.join(os.getcwd(), "firebase", "serviceAccountKey.json")
    if os.path.exists(firebase_key_path):
        cred = credentials.Certificate(firebase_key_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'elife-9730a'
        })
    else:
        raise FileNotFoundError("Firebase service account key not found. Expected at: firebase/serviceAccountKey.json")

    from app.views import auth
    app.register_blueprint(auth)

    return app
