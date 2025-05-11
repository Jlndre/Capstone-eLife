from datetime import datetime
from app import db
from app.models import User, QuarterVerification, Notification

# Run this function daily via cronjob or manually during login/dashboard load
def notify_proof_of_life_opening():
    today = datetime.utcnow().date()
    upcoming_quarters = QuarterVerification.query.filter(
        QuarterVerification.due_date == today
    ).all()

    for q in upcoming_quarters:
        message = f"Your {q.quarter} Quarter proof-of-life verification is now open."
        existing = Notification.query.filter_by(
            user_id=q.user_id,
            message=message,
            type='reminder',
            sent_at=today
        ).first()

        if not existing:
            notif = Notification(
                user_id=q.user_id,
                type='reminder',
                message=message,
                sent_at=datetime.utcnow()
            )
            db.session.add(notif)

    db.session.commit()

