import os
import sys
import django
from io import BytesIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from api.models import VideoTestimonial
from api import views, cloudinary_service
from unittest.mock import patch, PropertyMock

def run_tests():
    print("==================================================")
    print("RUNNING VIDEO TESTIMONIAL SUITE & PERMISSION TESTS")
    print("==================================================")

    # 1. Setup test users
    admin_user, _ = User.objects.get_or_create(
        username='test_admin_vt',
        defaults={'email': 'admin_vt@aiec.edu', 'is_staff': True, 'is_superuser': True}
    )
    admin_user.set_password('AdminPass123!')
    admin_user.save()

    staff_user, _ = User.objects.get_or_create(
        username='test_staff_vt',
        defaults={'email': 'staff_vt@aiec.edu', 'is_staff': True, 'is_superuser': False}
    )
    staff_user.set_password('StaffPass123!')
    staff_user.save()
    staff_group, _ = Group.objects.get_or_create(name='Staff')
    staff_user.groups.add(staff_group)

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    staff_client = APIClient()
    staff_client.force_authenticate(user=staff_user)

    public_client = APIClient()

    results = []

    # TEST 1: Unconfigured Cloudinary Handling
    print("\n[TEST 1] Upload with Unconfigured Cloudinary Credentials")
    with patch.object(views.cloudinary_service, 'is_cloudinary_configured', return_value=False):
        dummy_file = BytesIO(b"dummy video data")
        dummy_file.name = "sample.mp4"
        response = staff_client.post('/api/testimonials/video/upload/', {'file': dummy_file, 'student_name': 'Test Student'}, format='multipart')
        print(f"Status: {response.status_code}")
        print(f"Response: {response.data}")
        passed = (response.status_code == 400) and ("Video storage is not configured" in str(response.data.get('error', '')))
        results.append(("TEST 1: Unconfigured Cloudinary Graceful 400 Fallback", passed))

    # TEST 2: Invalid File Extension Validation
    print("\n[TEST 2] Invalid File Format (.pdf)")
    dummy_pdf = BytesIO(b"%PDF-1.4 dummy file content")
    dummy_pdf.name = "document.pdf"
    response = staff_client.post('/api/testimonials/video/upload/', {'file': dummy_pdf, 'student_name': 'Invalid Format'}, format='multipart')
    print(f"Status: {response.status_code}")
    print(f"Response: {response.data}")
    passed = (response.status_code == 400) and ("Invalid file format" in str(response.data.get('error', '')))
    results.append(("TEST 2: Invalid File Format Rejection", passed))

    # TEST 3: Oversized File (>100MB) Validation
    print("\n[TEST 3] Oversized File (>100MB)")
    with patch.object(views.cloudinary_service, 'is_cloudinary_configured', return_value=True), \
         patch('django.core.files.uploadedfile.UploadedFile.size', new_callable=PropertyMock, return_value=105 * 1024 * 1024):
        dummy_huge = BytesIO(b"0" * 100)
        dummy_huge.name = "huge_movie.mp4"
        response = staff_client.post('/api/testimonials/video/upload/', {'file': dummy_huge, 'student_name': 'Huge File'}, format='multipart')
        print(f"Status: {response.status_code}")
        print(f"Response: {response.data}")
        passed = (response.status_code == 400) and ("File size exceeds limit" in str(response.data.get('error', '')))
        results.append(("TEST 3: File Size > 100MB Rejection", passed))

    # TEST 4: Staff Upload & Publish Toggle Success
    print("\n[TEST 4] Staff Upload & Publish-Toggle")
    mock_upload_res = {
        'video_url': 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
        'thumbnail_url': 'https://res.cloudinary.com/demo/video/upload/sample.jpg',
        'public_id': 'aiec/video_testimonials/sample_123'
    }
    created_id = None
    with patch.object(views.cloudinary_service, 'is_cloudinary_configured', return_value=True), \
         patch.object(views.cloudinary_service, 'upload_video_to_cloudinary', return_value=mock_upload_res):
        valid_video = BytesIO(b"sample video bytes")
        valid_video.name = "testimonial.mp4"
        response = staff_client.post('/api/testimonials/video/upload/', {'file': valid_video, 'student_name': 'Aarav Sharma', 'is_published': 'true'}, format='multipart')
        print(f"Upload Status: {response.status_code}")
        print(f"Upload Response: {response.data}")
        upload_ok = (response.status_code == 201) and (response.data.get('student_name') == 'Aarav Sharma')
        created_id = response.data.get('id')

        # Staff Toggle is_published -> False
        patch_res = staff_client.patch(f'/api/testimonials/video/{created_id}/', {'is_published': False}, format='json')
        print(f"Staff Toggle Status: {patch_res.status_code}")
        print(f"Staff Toggle Response: {patch_res.data}")
        toggle_ok = (patch_res.status_code == 200) and (patch_res.data.get('is_published') is False)

        results.append(("TEST 4: Staff Upload & Publish-Toggle Succeeds", upload_ok and toggle_ok))

    # TEST 5: Staff Delete Attempt (Must return 403 Forbidden)
    print("\n[TEST 5] Staff Delete Attempt (Least Privilege Rule)")
    if created_id:
        staff_del_res = staff_client.delete(f'/api/testimonials/video/{created_id}/')
        print(f"Staff Delete Status: {staff_del_res.status_code}")
        print(f"Staff Delete Response: {staff_del_res.data}")
        staff_blocked = (staff_del_res.status_code == 403) and ("Admin permissions" in str(staff_del_res.data.get('error', '')))
        results.append(("TEST 5: Staff Delete Blocked with 403 Forbidden", staff_blocked))
    else:
        results.append(("TEST 5: Staff Delete Blocked with 403 Forbidden", False))

    # TEST 6: Admin Delete (Triggers Cloudinary Destroy Call AND Deletes DB Record)
    print("\n[TEST 6] Admin Delete (Triggers Cloudinary Asset Destroy + DB Deletion)")
    if created_id:
        with patch.object(views, 'delete_video_from_cloudinary') as mock_destroy:
            mock_destroy.return_value = True
            admin_del_res = admin_client.delete(f'/api/testimonials/video/{created_id}/')
            print(f"Admin Delete Status: {admin_del_res.status_code}")
            print(f"Admin Delete Response: {admin_del_res.data}")
            
            db_deleted = not VideoTestimonial.objects.filter(id=created_id).exists()
            destroy_called = mock_destroy.called
            print(f"Cloudinary destroy called: {destroy_called}")
            print(f"DB Record deleted: {db_deleted}")
            
            admin_delete_ok = (admin_del_res.status_code == 200) and db_deleted and destroy_called
            results.append(("TEST 6: Admin Delete Triggers Cloudinary Destroy + DB Deletion", admin_delete_ok))
    else:
        results.append(("TEST 6: Admin Delete Triggers Cloudinary Destroy + DB Deletion", False))

    # TEST 7: Public Endpoint Filters Out Draft / Unpublished Videos
    print("\n[TEST 7] Public Endpoint Filtering (Only is_published=True)")
    # Create one published and one draft
    v_published = VideoTestimonial.objects.create(
        student_name="Published Student",
        video_url="https://res.cloudinary.com/demo/video/upload/pub.mp4",
        thumbnail_url="https://res.cloudinary.com/demo/video/upload/pub.jpg",
        public_id="pub_123",
        uploaded_by=staff_user,
        is_published=True
    )
    v_draft = VideoTestimonial.objects.create(
        student_name="Draft Student",
        video_url="https://res.cloudinary.com/demo/video/upload/draft.mp4",
        thumbnail_url="https://res.cloudinary.com/demo/video/upload/draft.jpg",
        public_id="draft_456",
        uploaded_by=staff_user,
        is_published=False
    )

    pub_res = public_client.get('/api/testimonials/video/public/')
    print(f"Public Endpoint Status: {pub_res.status_code}")
    print(f"Public Endpoint Output Count: {len(pub_res.data)}")
    returned_names = [item['student_name'] for item in pub_res.data]
    print(f"Returned Names: {returned_names}")

    public_filtered_ok = (pub_res.status_code == 200) and ("Published Student" in returned_names) and ("Draft Student" not in returned_names)
    results.append(("TEST 7: Public Endpoint Returns Only Published Videos", public_filtered_ok))

    # Cleanup
    v_published.delete()
    v_draft.delete()

    print("\n==================================================")
    print("FINAL TEST RESULTS SUMMARY")
    print("==================================================")
    all_passed = True
    for test_name, status_ok in results:
        status_str = "[PASS]" if status_ok else "[FAIL]"
        print(f"{status_str} | {test_name}")
        if not status_ok:
            all_passed = False

    return all_passed

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
