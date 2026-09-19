import os
import cloudinary
import cloudinary.uploader

def is_cloudinary_configured():
    """Checks if Cloudinary credentials are set in environment variables."""
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
    api_key = os.environ.get('CLOUDINARY_API_KEY', '').strip()
    api_secret = os.environ.get('CLOUDINARY_API_SECRET', '').strip()
    return bool(cloud_name and api_key and api_secret)


def configure_cloudinary():
    """Configures Cloudinary SDK if credentials exist."""
    if is_cloudinary_configured():
        cloudinary.config(
            cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip(),
            api_key=os.environ.get('CLOUDINARY_API_KEY', '').strip(),
            api_secret=os.environ.get('CLOUDINARY_API_SECRET', '').strip(),
            secure=True
        )


def upload_video_to_cloudinary(file_obj, folder="aiec/video_testimonials"):
    """
    Uploads a video file object to Cloudinary.
    Returns dict with video_url, thumbnail_url, and public_id.
    Raises ValueError if Cloudinary is not configured.
    """
    if not is_cloudinary_configured():
        raise ValueError("Video storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.")

    configure_cloudinary()

    response = cloudinary.uploader.upload_large(
        file_obj,
        resource_type="video",
        folder=folder
    )

    video_url = response.get('secure_url') or response.get('url')
    public_id = response.get('public_id', '')

    # Derive image poster/thumbnail URL from Cloudinary video asset URL
    if video_url and '.' in video_url:
        thumbnail_url = video_url.rsplit('.', 1)[0] + '.jpg'
    else:
        thumbnail_url = video_url

    return {
        'video_url': video_url,
        'thumbnail_url': thumbnail_url,
        'public_id': public_id
    }


def delete_video_from_cloudinary(public_id):
    """
    Deletes a video asset from Cloudinary using public_id.
    """
    if not is_cloudinary_configured() or not public_id:
        return False

    configure_cloudinary()
    try:
        response = cloudinary.uploader.destroy(public_id, resource_type="video")
        return response.get('result') in ['ok', 'not found']
    except Exception as e:
        print(f"Cloudinary deletion error: {e}")
        return False
