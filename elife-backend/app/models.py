from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from enum import Enum
from sqlalchemy.dialects.postgresql import JSON

class ProofStatus(Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    FLAGGED = 'flagged'

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    pensioner_number = db.Column(db.String(20), unique=True, nullable=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(512), nullable=False)
    role = db.Column(db.String(20), default='pensioner')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    terms_accepted = db.Column(db.Boolean, default=False)


    # Relationships
    user_details = db.relationship('UserDetails', backref='user', uselist=False, cascade='all, delete-orphan')
    proof_submissions = db.relationship('ProofSubmission', backref='user', lazy=True, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan')
    certificates = db.relationship('DigitalCertificate', backref='user', lazy=True, cascade='all, delete-orphan')
    identity_documents = db.relationship('IdentityDocument', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'


class UserDetails(db.Model):
    __tablename__ = 'user_details'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    firstname = db.Column(db.String(100))
    lastname = db.Column(db.String(100))
    dob = db.Column(db.Date)
    trn = db.Column(db.String(50))  # Tax Registration Number
    nids_num = db.Column(db.String(50))  # National ID
    passport_num = db.Column(db.String(50))
    contact_num = db.Column(db.String(20))
    address = db.Column(db.Text)
    
    def __repr__(self):
        return f'<UserDetails for {self.user_id}>'


class ProofSubmission(db.Model):
    __tablename__ = 'proof_submissions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    id_image_url = db.Column(db.String(255))
    video_url = db.Column(db.String(255))
    image_urls = db.Column(JSON)  # <-- New field to store list of Firebase URLs
    status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'flagged'
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)  # For reviewer notes
    
    # Relationships
    certificate = db.relationship('DigitalCertificate', backref='proof_submission', uselist=False)
    
    def __repr__(self):
        return f'<ProofSubmission {self.id} by User {self.user_id}>'


class DigitalCertificate(db.Model):
    __tablename__ = 'digital_certificates'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    proof_submission_id = db.Column(db.Integer, db.ForeignKey('proof_submissions.id'), nullable=False)
    certificate_filename = db.Column(db.String(255))
    content_snapshot = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    digital_signature_hash = db.Column(db.String(512))
    quarter = db.Column(db.String(20))  # e.g., "Q1-2025"
    
    def __repr__(self):
        return f'<Certificate {self.id} for User {self.user_id}>'


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(50))  # e.g., 'reminder', 'approval', 'rejection'
    message = db.Column(db.Text)
    target_quarter = db.Column(db.String(20))  # e.g., 'Q2-2025'
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
      

    
    def __repr__(self):
        return f'<Notification {self.id} for User {self.user_id}>'


class IdentityDocument(db.Model):
    __tablename__ = 'identity_documents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    proof_submission_id = db.Column(db.Integer, db.ForeignKey('proof_submissions.id'), nullable=True)
    type = db.Column(db.String(50))  # e.g., 'passport', 'national_id', 'driver_license'
    image_url = db.Column(db.String(255))
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    
    def __repr__(self):
        return f'<IdentityDocument {self.id} ({self.type}) for User {self.user_id}>'


class LoginSession(db.Model):
    __tablename__ = 'login_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    login_time = db.Column(db.DateTime, default=datetime.utcnow)
    logout_time = db.Column(db.DateTime)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(255))
    
    # Relationship
    user = db.relationship('User', backref=db.backref('login_sessions', lazy='dynamic'))
    
    def __repr__(self):
        return f'<LoginSession {self.id} for User {self.user_id}>'

class QuarterVerification(db.Model):
    __tablename__ = 'quarter_verifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    quarter = db.Column(db.String(10))  # e.g., Q1, Q2, Q3, Q4
    year = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')  # pending, completed, missed
    due_date = db.Column(db.Date)
    verified_at = db.Column(db.DateTime)
    proof_submission_id = db.Column(db.Integer, db.ForeignKey('proof_submissions.id'), nullable=True)

    user = db.relationship('User', backref='quarter_verifications')
    proof_submission = db.relationship('ProofSubmission', backref='quarter_verification', uselist=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'quarter', 'year', name='uq_user_quarter_year'),
    )

    def __repr__(self):
        return f'<QuarterVerification {self.quarter}-{self.year} for User {self.user_id}>'
