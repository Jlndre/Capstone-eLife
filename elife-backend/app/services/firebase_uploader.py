from firebase_admin import storage
import uuid

def upload_file_to_firebase(file_stream, filename, content_type):
    bucket = storage.bucket()
    blob = bucket.blob(f"id_uploads/{uuid.uuid4()}_{filename}")
    blob.upload_from_file(file_stream, content_type=content_type)
    blob.make_public()  # optional: you can instead return a signed URL
    return blob.public_url
