import traceback
import json
import hashlib
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.models import User, ProofSubmission, DigitalCertificate, QuarterVerification
from app import db, csrf
from app.views import token_required

certificate_bp = Blueprint('certificate', __name__)

def json_response(success, message, status_code=200, **kwargs):
    response = {"success": success, "message": message}
    response.update(kwargs)
    return jsonify(response), status_code

def parse_content_snapshot(snapshot):
    try:
        return json.loads(snapshot)
    except Exception:
        return snapshot

def extract_quarter(quarter_str):
    try:
        q, y = quarter_str.split('-')
        return q, int(y)
    except ValueError:
        return None, None

@csrf.exempt
@certificate_bp.route("/certificates/<int:certificate_id>", methods=["GET"])
@token_required
def get_certificate(current_user, certificate_id):
    try:
        certificate = DigitalCertificate.query.filter_by(
            id=certificate_id, user_id=current_user.id
        ).first()

        if not certificate:
            return json_response(False, "Certificate not found", 404)

        return jsonify({
            "id": certificate.id,
            "user_id": certificate.user_id,
            "proof_submission_id": certificate.proof_submission_id,
            "quarter": certificate.quarter,
            "timestamp": certificate.timestamp.isoformat(),
            "digital_signature_hash": certificate.digital_signature_hash,
            "content_snapshot": parse_content_snapshot(certificate.content_snapshot)
        }), 200

    except Exception as e:
        traceback.print_exc()
        return json_response(False, "Failed to retrieve certificate", 500, error=str(e))


@csrf.exempt
@certificate_bp.route("/generate-certificate", methods=["POST"])
@token_required
def generate_certificate(current_user):
    try:
        data = request.get_json()
        quarter = data.get('quarter') or generate_current_quarter()

        proof_submission = ProofSubmission.query.filter_by(
            user_id=current_user.id, status='approved'
        ).order_by(ProofSubmission.verified_at.desc()).first()

        if not proof_submission:
            return json_response(False, "No approved verification found", 404)

        existing_cert = DigitalCertificate.query.filter_by(
            proof_submission_id=proof_submission.id
        ).first()

        if existing_cert:
            return json_response(True, "Certificate already exists", certificate={
                "id": existing_cert.id,
                "user_id": existing_cert.user_id,
                "proof_submission_id": existing_cert.proof_submission_id,
                "quarter": existing_cert.quarter,
                "timestamp": existing_cert.timestamp.isoformat(),
                "digital_signature_hash": existing_cert.digital_signature_hash,
                "content_snapshot": parse_content_snapshot(existing_cert.content_snapshot)
            })

        user_details = current_user.user_details
        if not user_details:
            return json_response(False, "User details not found", 400)

        content = {
            "pensioner_number": current_user.pensioner_number,
            "user_id": current_user.id,
            "fullName": f"{user_details.firstname} {user_details.lastname}",
            "dob": user_details.dob.strftime('%Y-%m-%d') if user_details.dob else None,
            "trn": user_details.trn,
            "verification_method": "Facial Recognition & ID Verification",
            "quarter": quarter,
            "issue_date": datetime.utcnow().isoformat(),
            "expiry_date": None
        }

        digital_signature = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()

        new_certificate = DigitalCertificate(
            user_id=current_user.id,
            proof_submission_id=proof_submission.id,
            certificate_filename=f"certificate_{current_user.id}_{quarter}.json",
            content_snapshot=json.dumps(content),
            digital_signature_hash=digital_signature,
            quarter=quarter
        )
        db.session.add(new_certificate)

        quarter_num, year = extract_quarter(quarter)
        if not quarter_num or not year:
            return json_response(False, "Invalid quarter format", 400)

        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id, quarter=quarter_num, year=year
        ).first()

        if quarter_verification:
            quarter_verification.status = 'completed'
            quarter_verification.verified_at = datetime.utcnow()
            quarter_verification.proof_submission_id = proof_submission.id
        else:
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter_num,
                year=year,
                status='completed',
                verified_at=datetime.utcnow(),
                proof_submission_id=proof_submission.id,
                due_date=datetime.utcnow()
            )
            db.session.add(quarter_verification)

        db.session.commit()

        return json_response(True, "Certificate generated successfully", 201, certificate={
            "id": new_certificate.id,
            "user_id": new_certificate.user_id,
            "proof_submission_id": new_certificate.proof_submission_id,
            "quarter": new_certificate.quarter,
            "timestamp": new_certificate.timestamp.isoformat(),
            "digital_signature_hash": new_certificate.digital_signature_hash,
            "content_snapshot": content
        })

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return json_response(False, "Failed to generate certificate", 500, error=str(e))


@csrf.exempt
@certificate_bp.route("/update-quarter-verification", methods=["POST"])
@token_required
def update_quarter_verification(current_user):
    try:
        data = request.get_json()
        quarter = data.get('quarter')
        status = data.get('status')
        proof_submission_id = data.get('proof_submission_id')

        if not quarter or not status:
            return json_response(False, "Quarter and status are required", 400)

        quarter_num, year = extract_quarter(quarter)
        if not quarter_num or not year:
            return json_response(False, "Invalid quarter format. Expected 'Q1-2025'", 400)

        quarter_verification = QuarterVerification.query.filter_by(
            user_id=current_user.id, quarter=quarter_num, year=year
        ).first()

        if not quarter_verification:
            quarter_verification = QuarterVerification(
                user_id=current_user.id,
                quarter=quarter_num,
                year=year,
                status=status,
                due_date=datetime.utcnow(),
                proof_submission_id=proof_submission_id
            )
            db.session.add(quarter_verification)
        else:
            quarter_verification.status = status
            quarter_verification.proof_submission_id = proof_submission_id

        if status == 'completed':
            quarter_verification.verified_at = datetime.utcnow()

        db.session.commit()

        return json_response(True, "Quarter verification updated", quarter_verification={
            "id": quarter_verification.id,
            "quarter": quarter_verification.quarter,
            "year": quarter_verification.year,
            "status": quarter_verification.status,
            "verified_at": quarter_verification.verified_at.isoformat() if quarter_verification.verified_at else None
        })

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return json_response(False, "Failed to update quarter verification", 500, error=str(e))


def generate_current_quarter():
    now = datetime.utcnow()
    year = now.year
    quarter = (now.month - 1) // 3 + 1
    return f"Q{quarter}-{year}"
