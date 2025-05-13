import traceback
import json
import hashlib
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.models import User, ProofSubmission, DigitalCertificate, QuarterVerification
from app import db, csrf
from functools import wraps
import jwt

# Import the token_required decorator from your views module instead of auth
from app.views import token_required

certificate_bp = Blueprint('certificate', __name__)

@csrf.exempt
@certificate_bp.route("/certificates/<int:certificate_id>", methods=["GET"])
@token_required
def get_certificate(current_user, certificate_id):
    """
    Get a specific certificate by ID
    """
    try:
        # Find the certificate
        certificate = DigitalCertificate.query.filter_by(
            id=certificate_id,
            user_id=current_user.id
        ).first()
        
        if not certificate:
            return jsonify({
                "success": False,
                "message": "Certificate not found"
            }), 404
            
        # Parse content snapshot if it exists
        content_snapshot = None
        if certificate.content_snapshot:
            try:
                content_snapshot = json.loads(certificate.content_snapshot)
            except:
                content_snapshot = certificate.content_snapshot
        
        # Return the certificate details
        return jsonify({
            "id": certificate.id,
            "user_id": certificate.user_id,
            "proof_submission_id": certificate.proof_submission_id,
            "quarter": certificate.quarter,
            "timestamp": certificate.timestamp.isoformat(),
            "digital_signature_hash": certificate.digital_signature_hash,
            "content_snapshot": content_snapshot
        }), 200
        
    except Exception as e:
        print("Get certificate error:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to retrieve certificate",
            "error": str(e)
        }), 500

@csrf.exempt
@certificate_bp.route("/generate-certificate", methods=["POST"])
@token_required
def generate_certificate(current_user):
    """
    Generate a digital certificate based on the most recent approved proof submission
    """
    try:
        data = request.get_json()
        quarter = data.get('quarter', None)
        
        if not quarter:
            # Generate the current quarter if not provided
            now = datetime.utcnow()
            year = now.year
            month = now.month
            
            if month < 4:
                quarter_num = 1
            elif month < 7:
                quarter_num = 2
            elif month < 10:
                quarter_num = 3
            else:
                quarter_num = 4
                
            quarter = f"Q{quarter_num}-{year}"
        
        # Find the most recent approved proof submission
        proof_submission = ProofSubmission.query.filter_by(
            user_id=current_user.id,
            status='approved'
        ).order_by(ProofSubmission.verified_at.desc()).first()
        
        if not proof_submission:
            return jsonify({
                "success": False,
                "message": "No approved verification found"
            }), 404
        
        # Check if a certificate already exists for this submission
        existing_cert = DigitalCertificate.query.filter_by(
            proof_submission_id=proof_submission.id
        ).first()
        
        if existing_cert:
            # Return the existing certificate
            # Parse content snapshot if it exists
            content_snapshot = None
            if existing_cert.content_snapshot:
                try:
                    content_snapshot = json.loads(existing_cert.content_snapshot)
                except:
                    content_snapshot = existing_cert.content_snapshot
                    
            return jsonify({
                "success": True,
                "message": "Certificate already exists",
                "certificate": {
                    "id": existing_cert.id,
                    "user_id": existing_cert.user_id,
                    "proof_submission_id": existing_cert.proof_submission_id,
                    "quarter": existing_cert.quarter,
                    "timestamp": existing_cert.timestamp.isoformat(),
                    "digital_signature_hash": existing_cert.digital_signature_hash,
                    "content_snapshot": content_snapshot
                }
            }), 200
        
        # Create a content snapshot with user details
        user_details = current_user.user_details
        
        if not user_details:
            return jsonify({
                "success": False,
                "message": "User details not found"
            }), 400
        
        content = {
            "pensioner_number": current_user.pensioner_number,
            "user_id": current_user.id,
            "fullName": f"{user_details.firstname} {user_details.lastname}",
            "dob": user_details.dob.strftime('%Y-%m-%d') if user_details.dob else None,
            "trn": user_details.trn,
            "verification_method": "Facial Recognition & ID Verification",
            "quarter": quarter,
            "issue_date": datetime.utcnow().isoformat(),
            "expiry_date": None  # Could calculate based on quarter end
        }
        
        # Generate a hash for digital signature (in a real app, use proper PKI)
        content_str = json.dumps(content, sort_keys=True)
        digital_signature = hashlib.sha256(content_str.encode()).hexdigest()
        
        # Create the certificate
        new_certificate = DigitalCertificate(
            user_id=current_user.id,
            proof_submission_id=proof_submission.id,
            certificate_filename=f"certificate_{current_user.id}_{quarter}.json",
            content_snapshot=content_str,
            digital_signature_hash=digital_signature,
            quarter=quarter
        )
        
        db.session.add(new_certificate)
        
        # Update or create quarter verification
        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id,
            quarter=quarter.split('-')[0],  # Extract Q1, Q2, etc.
            year=int(quarter.split('-')[1])  # Extract year
        ).first()
        
        if quarter_verification:
            quarter_verification.status = 'completed'
            quarter_verification.verified_at = datetime.utcnow()
            quarter_verification.proof_submission_id = proof_submission.id
        else:
            # If quarter verification doesn't exist, create it
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter.split('-')[0],
                year=int(quarter.split('-')[1]),
                status='completed',
                verified_at=datetime.utcnow(),
                proof_submission_id=proof_submission.id,
                due_date=datetime.utcnow()  # Set to current date or calculate proper due date
            )
            db.session.add(quarter_verification)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Certificate generated successfully",
            "certificate": {
                "id": new_certificate.id,
                "user_id": new_certificate.user_id,
                "proof_submission_id": new_certificate.proof_submission_id,
                "quarter": new_certificate.quarter,
                "timestamp": new_certificate.timestamp.isoformat(),
                "digital_signature_hash": new_certificate.digital_signature_hash,
                "content_snapshot": content
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print("Certificate generation error:", str(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Failed to generate certificate",
            "error": str(e)
        }), 500


@csrf.exempt
@certificate_bp.route("/update-quarter-verification", methods=["POST"])
@token_required
def update_quarter_verification(current_user):
    """
    Update the quarter verification status
    """
    try:
        data = request.get_json()
        quarter = data.get('quarter')
        status = data.get('status')
        proof_submission_id = data.get('proof_submission_id')
        
        if not quarter or not status:
            return jsonify({
                "success": False,
                "message": "Quarter and status are required"
            }), 400
        
        # Extract quarter number and year
        quarter_parts = quarter.split('-')
        if len(quarter_parts) != 2:
            return jsonify({
                "success": False,
                "message": "Invalid quarter format. Expected 'Q1-2025'"
            }), 400
            
        quarter_num = quarter_parts[0]
        year = int(quarter_parts[1])
        
        # Find or create the quarter verification
        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id,
            quarter=quarter_num,
            year=year
        ).first()
        
        if not quarter_verification:
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter_num,
                year=year,
                status=status,
                due_date=datetime.utcnow(),  # Set properly in production
                proof_submission_id=proof_submission_id
            )
            db.session.add(quarter_verification)
        else:
            quarter_verification.status = status
            quarter_verification.proof_submission_id = proof_submission_id
        
        if status == 'completed':
            quarter_verification.verified_at = datetime.utcnow()
            
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Quarter verification updated",
            "quarter_verification": {
                "id": quarter_verification.id,
                "quarter": quarter_verification.quarter,
                "year": quarter_verification.year,
                "status": quarter_verification.status,
                "verified_at": quarter_verification.verified_at.isoformat() if quarter_verification.verified_at else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Update quarter verification error:", str(e))
        return jsonify({
            "success": False,
            "message": "Failed to update quarter verification",
            "error": str(e)
        }), 500