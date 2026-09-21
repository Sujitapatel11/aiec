"""
Automated test suite for the Document Upload & Verification System.
Tests run against Django's test database (no real DB changes, no real Cloudinary calls).

Run from the backend/ directory:
    python manage.py test api.tests_document_system   (if placed in api/)
  OR use this script directly:
    python test_document_system.py

Test cases:
  1. File format validation — PDF/JPG/PNG accepted, .exe/.mp4 rejected
  2. File size validation — >15MB rejected
  3. Student blocked from verify endpoint (403)
  4. Student blocked from delete endpoint (403)
  5. Staff can verify a document (status → verified)
  6. Staff can reject a document with reason recorded
  7. Staff blocked from delete endpoint (403)
  8. Admin can delete — record removed AND Cloudinary delete called
"""

import os
import sys
import io
import django
from unittest.mock import patch, MagicMock

# ── Bootstrap Django ──────────────────────────────────────────────────────
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.test import TestCase, Client
from django.contrib.auth.models import User, Group
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from api.models import StudentProfile, StudentDocument


# ── Helpers ───────────────────────────────────────────────────────────────

PASS = "\033[92m  PASS\033[0m"
FAIL = "\033[91m  FAIL\033[0m"
results = []


def record(name, ok, detail=""):
    status = PASS if ok else FAIL
    line = f"{status}  {name}"
    if detail:
        line += f"\n        └─ {detail}"
    print(line)
    results.append((name, ok, detail))


def make_file(name, size_bytes=1024, content=b"FAKE_CONTENT"):
    """Return a SimpleUploadedFile with the given name and approximate size."""
    # Pad / trim content to exactly size_bytes
    if len(content) < size_bytes:
        content = content * (size_bytes // len(content) + 1)
    content = content[:size_bytes]
    ext = os.path.splitext(name)[1].lower()
    mime_map = {
        '.pdf':  'application/pdf',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png':  'image/png',
        '.exe':  'application/octet-stream',
        '.mp4':  'video/mp4',
    }
    content_type = mime_map.get(ext, 'application/octet-stream')
    return SimpleUploadedFile(name, content, content_type=content_type)


# ── Test fixture factory ──────────────────────────────────────────────────

_USER_COUNTER = [0]

def make_user(username_prefix, is_superuser=False, is_staff_flag=False, in_staff_group=False):
    _USER_COUNTER[0] += 1
    suffix = _USER_COUNTER[0]
    user = User.objects.create_user(
        username=f"{username_prefix}_{suffix}",
        password="testpass123",
        email=f"{username_prefix}_{suffix}@test.com",
    )
    user.is_superuser = is_superuser
    user.is_staff = is_staff_flag
    user.save()
    if in_staff_group:
        group, _ = Group.objects.get_or_create(name='Staff')
        user.groups.add(group)
    token, _ = Token.objects.get_or_create(user=user)
    return user, token.key


def make_student_profile(user):
    return StudentProfile.objects.create(
        user=user,
        full_name=user.username,
        phone="9800000000",
        destination_country="Australia",
    )


def make_document(student, uploader, status="pending", rejection_reason=""):
    return StudentDocument.objects.create(
        student=student,
        document_type="Passport",
        file_url="https://res.cloudinary.com/fake/image/upload/v1/aiec/student_documents/test.pdf",
        public_id="aiec/student_documents/test_abc123",
        file_name="passport.pdf",
        uploaded_by=uploader,
        verification_status=status,
        rejection_reason=rejection_reason,
    )


# ── Mock Cloudinary response ──────────────────────────────────────────────

MOCK_CLOUDINARY_RESPONSE = {
    'file_url': 'https://res.cloudinary.com/fake/image/upload/v1/aiec/student_documents/mock.pdf',
    'public_id': 'aiec/student_documents/mock_abc999',
}


# ── Test cases ────────────────────────────────────────────────────────────

class DocumentSystemTests(TestCase):

    def setUp(self):
        self.client = Client()

        # Admin user
        self.admin_user, self.admin_token = make_user("admin_doc", is_superuser=True, is_staff_flag=True)

        # Staff user (in 'Staff' group, not superuser)
        self.staff_user, self.staff_token = make_user("staff_doc", in_staff_group=True)

        # Student user
        self.student_user, self.student_token = make_user("student_doc")
        self.student_profile = make_student_profile(self.student_user)

    def auth(self, token):
        return {"HTTP_AUTHORIZATION": f"Token {token}"}

    # ── TEST 1: Accepted file formats ─────────────────────────────────────

    def test_01_accepted_file_formats(self):
        """PDF, JPG, PNG should be accepted (mocked upload); .exe and .mp4 should be 400."""
        url = "/api/documents/upload/"

        accepted = [
            ("passport.pdf",  make_file("passport.pdf",  content=b"%PDF-1.4 FAKE")),
            ("photo.jpg",     make_file("photo.jpg",     content=b"\xff\xd8\xff FAKE JPEG")),
            ("photo.jpeg",    make_file("photo.jpeg",    content=b"\xff\xd8\xff FAKE JPEG")),
            ("marksheet.png", make_file("marksheet.png", content=b"\x89PNG FAKE")),
        ]

        with patch("api.views.upload_document_to_cloudinary", return_value=MOCK_CLOUDINARY_RESPONSE), \
             patch("api.views.is_cloudinary_configured", return_value=True):
            for fname, f in accepted:
                response = self.client.post(
                    url,
                    data={"file": f, "document_type": "Passport", "student_id": self.student_profile.id},
                    **self.auth(self.student_token),
                )
                ok = response.status_code == 201
                record(f"Format accepted: {fname}", ok,
                       f"Expected 201, got {response.status_code} — {response.json()}" if not ok else "")

        rejected = [
            ("malware.exe", make_file("malware.exe")),
            ("video.mp4",   make_file("video.mp4")),
        ]
        for fname, f in rejected:
            response = self.client.post(
                url,
                data={"file": f, "document_type": "Passport", "student_id": self.student_profile.id},
                **self.auth(self.student_token),
            )
            ok = response.status_code == 400 and "format" in response.json().get("error", "").lower()
            record(f"Format rejected: {fname}", ok,
                   f"Expected 400 with format error, got {response.status_code} — {response.json()}" if not ok else "")

    # ── TEST 2: File size >15MB rejected ──────────────────────────────────

    def test_02_file_size_validation(self):
        """Files over 15MB (15,728,640 bytes) must be rejected with 400."""
        url = "/api/documents/upload/"

        # 15MB + 1 byte = 15,728,641 bytes
        big_file = make_file("bigfile.pdf", size_bytes=15 * 1024 * 1024 + 1)

        with patch("api.views.is_cloudinary_configured", return_value=True):
            response = self.client.post(
                url,
                data={"file": big_file, "document_type": "Passport", "student_id": self.student_profile.id},
                **self.auth(self.student_token),
            )
        ok = response.status_code == 400 and "size" in response.json().get("error", "").lower()
        record("File >15MB rejected", ok,
               f"Expected 400 with size error, got {response.status_code} — {response.json()}" if not ok else "")

        # 14MB should pass (mocked Cloudinary)
        small_file = make_file("smallfile.pdf", size_bytes=14 * 1024 * 1024, content=b"%PDF ")
        with patch("api.views.upload_document_to_cloudinary", return_value=MOCK_CLOUDINARY_RESPONSE), \
             patch("api.views.is_cloudinary_configured", return_value=True):
            response = self.client.post(
                url,
                data={"file": small_file, "document_type": "Passport", "student_id": self.student_profile.id},
                **self.auth(self.student_token),
            )
        ok = response.status_code == 201
        record("File 14MB accepted", ok,
               f"Expected 201, got {response.status_code} — {response.json()}" if not ok else "")

    # ── TEST 3: Student blocked from verify (403) ──────────────────────────

    def test_03_student_cannot_verify(self):
        """Students must receive 403 when attempting to verify a document."""
        doc = make_document(self.student_profile, self.student_user)
        url = f"/api/documents/{doc.id}/status/"
        response = self.client.patch(
            url,
            data={"verification_status": "verified"},
            content_type="application/json",
            **self.auth(self.student_token),
        )
        ok = response.status_code == 403
        record("Student blocked from verify (403)", ok,
               f"Expected 403, got {response.status_code} — {response.json()}" if not ok else "")

    # ── TEST 4: Student blocked from delete (403) ──────────────────────────

    def test_04_student_cannot_delete(self):
        """Students must receive 403 when attempting to delete a document."""
        doc = make_document(self.student_profile, self.student_user)
        url = f"/api/documents/{doc.id}/"
        response = self.client.delete(url, **self.auth(self.student_token))
        ok = response.status_code == 403
        record("Student blocked from delete (403)", ok,
               f"Expected 403, got {response.status_code} — {response.json()}" if not ok else "")

    # ── TEST 5: Staff can verify a document ───────────────────────────────

    def test_05_staff_can_verify(self):
        """Staff can set verification_status to 'verified'; verified_by should be recorded."""
        doc = make_document(self.student_profile, self.student_user, status="pending")
        url = f"/api/documents/{doc.id}/status/"
        response = self.client.patch(
            url,
            data={"verification_status": "verified"},
            content_type="application/json",
            **self.auth(self.staff_token),
        )
        ok_status = response.status_code == 200
        data = response.json()
        ok_verified = data.get("verification_status") == "verified"
        ok_by = data.get("verified_by") == self.staff_user.id
        ok_at = data.get("verified_at") is not None

        all_ok = ok_status and ok_verified and ok_by and ok_at
        detail = ""
        if not all_ok:
            detail = (f"HTTP {response.status_code}, status={data.get('verification_status')}, "
                      f"verified_by={data.get('verified_by')}, verified_at={data.get('verified_at')}")
        record("Staff can verify document", all_ok, detail)

        # Verify DB is updated
        doc.refresh_from_db()
        db_ok = doc.verification_status == "verified" and doc.verified_by == self.staff_user
        record("Verify: DB record updated correctly", db_ok,
               f"DB status={doc.verification_status}, verified_by={doc.verified_by}" if not db_ok else "")

    # ── TEST 6: Staff can reject with reason ──────────────────────────────

    def test_06_staff_can_reject_with_reason(self):
        """Staff can reject a document; rejection_reason must be stored and returned."""
        doc = make_document(self.student_profile, self.student_user, status="pending")
        reason = "Scan is blurry, please re-upload clear page"
        url = f"/api/documents/{doc.id}/status/"
        response = self.client.patch(
            url,
            data={"verification_status": "rejected", "rejection_reason": reason},
            content_type="application/json",
            **self.auth(self.staff_token),
        )
        data = response.json()
        ok_status = response.status_code == 200
        ok_rejected = data.get("verification_status") == "rejected"
        ok_reason = data.get("rejection_reason") == reason

        all_ok = ok_status and ok_rejected and ok_reason
        detail = ""
        if not all_ok:
            detail = (f"HTTP {response.status_code}, status={data.get('verification_status')}, "
                      f"reason='{data.get('rejection_reason')}'")
        record("Staff can reject with reason", all_ok, detail)

        # Verify DB
        doc.refresh_from_db()
        db_ok = doc.verification_status == "rejected" and doc.rejection_reason == reason
        record("Reject: reason stored in DB", db_ok,
               f"DB status={doc.verification_status}, reason='{doc.rejection_reason}'" if not db_ok else "")

        # Verify reason is cleared when re-verified
        self.client.patch(
            url,
            data={"verification_status": "verified"},
            content_type="application/json",
            **self.auth(self.staff_token),
        )
        doc.refresh_from_db()
        reason_cleared = doc.rejection_reason == ""
        record("Reject→Verify: rejection_reason cleared", reason_cleared,
               f"rejection_reason='{doc.rejection_reason}'" if not reason_cleared else "")

    # ── TEST 7: Staff blocked from delete (403) ───────────────────────────

    def test_07_staff_cannot_delete(self):
        """Staff must receive 403 when attempting to delete a document (Admin-only action)."""
        doc = make_document(self.student_profile, self.student_user)
        url = f"/api/documents/{doc.id}/"
        response = self.client.delete(url, **self.auth(self.staff_token))
        ok = response.status_code == 403
        record("Staff blocked from delete (403)", ok,
               f"Expected 403, got {response.status_code} — {response.json()}" if not ok else "")

        # Confirm record still exists in DB
        still_exists = StudentDocument.objects.filter(pk=doc.id).exists()
        record("Staff delete blocked: record NOT removed from DB", still_exists,
               "Record was unexpectedly deleted from DB!" if not still_exists else "")

    # ── TEST 8: Admin can delete — record + Cloudinary asset ──────────────

    def test_08_admin_can_delete(self):
        """Admin deletes a document: DB record must be removed AND Cloudinary delete called."""
        doc = make_document(self.student_profile, self.admin_user)
        doc_id = doc.id
        doc_public_id = doc.public_id
        url = f"/api/documents/{doc_id}/"

        cloudinary_delete_called_with = []

        def fake_cloudinary_delete(public_id):
            cloudinary_delete_called_with.append(public_id)
            return True

        with patch("api.views.delete_document_from_cloudinary", side_effect=fake_cloudinary_delete):
            response = self.client.delete(url, **self.auth(self.admin_token))

        ok_http = response.status_code == 200
        ok_db = not StudentDocument.objects.filter(pk=doc_id).exists()
        ok_cloudinary = (
            len(cloudinary_delete_called_with) == 1 and
            cloudinary_delete_called_with[0] == doc_public_id
        )

        record("Admin delete: HTTP 200", ok_http,
               f"Got {response.status_code} — {response.json()}" if not ok_http else "")
        record("Admin delete: DB record removed", ok_db,
               "Record still exists in DB after admin delete!" if not ok_db else "")
        record("Admin delete: Cloudinary delete called with correct public_id", ok_cloudinary,
               f"Called with: {cloudinary_delete_called_with}, expected: ['{doc_public_id}']" if not ok_cloudinary else "")


# ── Runner ────────────────────────────────────────────────────────────────

def run_tests():
    import unittest

    print("\n" + "═" * 65)
    print("   DOCUMENT UPLOAD & VERIFICATION SYSTEM — AUTOMATED TESTS")
    print("═" * 65 + "\n")

    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(DocumentSystemTests)

    # Run via Django's test runner to get an isolated test DB
    from django.test.utils import setup_test_environment
    setup_test_environment()

    runner = unittest.TextTestRunner(verbosity=0, stream=open(os.devnull, 'w'))
    test_result = runner.run(suite)

    print("\n" + "─" * 65)
    print("  RESULTS SUMMARY")
    print("─" * 65)

    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)

    for name, ok, detail in results:
        symbol = "✅" if ok else "❌"
        print(f"  {symbol}  {name}")
        if detail:
            print(f"       └─ {detail}")

    print("─" * 65)
    print(f"  Total: {len(results)} checks   Passed: {passed}   Failed: {failed}")
    print("─" * 65 + "\n")

    if test_result.errors:
        print("  ⚠️  ERRORS during test execution:")
        for test, err in test_result.errors:
            print(f"    {test}: {err[:200]}")

    if test_result.failures:
        print("  ⚠️  TEST FAILURES (assertion-level):")
        for test, err in test_result.failures:
            print(f"    {test}: {err[:200]}")

    exit_code = 0 if (failed == 0 and not test_result.errors and not test_result.failures) else 1
    print(f"  Exit code: {exit_code}")
    return exit_code


if __name__ == "__main__":
    sys.exit(run_tests())
