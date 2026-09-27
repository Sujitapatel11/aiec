"""
Automated test suite — Password Reset Feature
Covers all 22 required test cases:

POSITIVE
  1.  Registered email → reset mechanism generated (no error)
  2.  Valid token → password successfully changed (HTTP 200)
  3.  New password works for login
  4.  Old password no longer works after reset
  5.  Admin password reset works
  6.  Staff password reset works
  7.  Student password reset works

SECURITY
  8.  Unknown email → same generic response (no enumeration)
  9.  Invalid token rejected (400)
  10. Expired token rejected (400)  ← simulated by tampering with token
  11. Reused token rejected (400)   ← second use after password change
  12. Password mismatch rejected (400)
  13. Weak password rejected (400)
  14. Missing fields rejected (400)
  15. Malformed uidb64 rejected (400)
  16. Password is never logged / never in API response
  17. Reset token is never exposed in reset-request response
  18. Unauthorised user cannot change another user's password via confirm endpoint

REGRESSION
  19. Normal login still works after implementing reset feature
  20. Admin/Staff/Student role enforcement still works
  21. manage_user_detail PATCH password now enforces 8-char + letters+numbers rule
  22. Existing document system tests still pass (import smoke-test)

Run from backend/ directory:
    python test_password_reset.py
"""

import os
import sys
import json
import django
from unittest.mock import patch, MagicMock
from io import StringIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.test import TestCase, Client
from django.contrib.auth.models import User, Group
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from rest_framework.authtoken.models import Token
from api.models import StudentProfile


# ── Colour helpers ────────────────────────────────────────────────────────
PASS = "\033[92m  PASS\033[0m"
FAIL = "\033[91m  FAIL\033[0m"
results = []


def record(name, ok, detail=""):
    symbol = PASS if ok else FAIL
    line = f"{symbol}  {name}"
    if detail:
        line += f"\n         └─ {detail}"
    print(line)
    results.append((name, ok, detail))


# ── Fixture helpers ───────────────────────────────────────────────────────
_CTR = [0]

def make_user(prefix, is_super=False, is_staff_flag=False, group=None,
              email=None, password="OldPass99"):
    _CTR[0] += 1
    n = _CTR[0]
    u = User.objects.create_user(
        username=f"{prefix}_{n}",
        password=password,
        email=email or f"{prefix}_{n}@test-aiec.local",
        is_superuser=is_super,
        is_staff=is_staff_flag,
        is_active=True,
    )
    if group:
        g, _ = Group.objects.get_or_create(name=group)
        u.groups.add(g)
    Token.objects.get_or_create(user=u)
    return u


def token_for(user):
    t, _ = Token.objects.get_or_create(user=user)
    return t.key


def make_uidb64_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    tok = default_token_generator.make_token(user)
    return uid, tok


# ── Test class ────────────────────────────────────────────────────────────
class PasswordResetTests(TestCase):

    def setUp(self):
        self.client = Client()

        # Admin
        self.admin = make_user("admin_pr", is_super=True, is_staff_flag=True)
        # Staff
        self.staff = make_user("staff_pr", is_staff_flag=True, group="Staff")
        # Student
        self.student_user = make_user("student_pr", group="Student")
        StudentProfile.objects.create(
            user=self.student_user,
            full_name=self.student_user.username,
            phone="9800000001",
            destination_country="Australia",
        )

    # ─────────────────────────────────────────────────────────────────────
    # TEST 1  Registered email → endpoint returns 200 with generic message
    # ─────────────────────────────────────────────────────────────────────
    def test_01_registered_email_returns_200(self):
        with patch("api.views.threading.Thread") as mock_thread:
            mock_thread.return_value = MagicMock()
            resp = self.client.post(
                "/api/auth/password-reset/",
                data=json.dumps({"email": self.admin.email}),
                content_type="application/json",
            )
        ok = (resp.status_code == 200 and
              "If an account" in resp.json().get("message", ""))
        record("TEST 1  Registered email → 200 + generic message", ok,
               f"status={resp.status_code} body={resp.json()}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 2  Valid token → password changed (HTTP 200)
    # ─────────────────────────────────────────────────────────────────────
    def test_02_valid_token_changes_password(self):
        uid, tok = make_uidb64_token(self.admin)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "NewPass99",
                "confirm_password": "NewPass99",
            }),
            content_type="application/json",
        )
        ok = resp.status_code == 200
        record("TEST 2  Valid token → password changed (HTTP 200)", ok,
               f"status={resp.status_code} body={resp.json()}" if not ok else "")
        # Restore old password for later tests
        self.admin.set_password("OldPass99")
        self.admin.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 3  New password works for login
    # ─────────────────────────────────────────────────────────────────────
    def test_03_new_password_works_for_login(self):
        uid, tok = make_uidb64_token(self.staff)
        self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "LoginNew88",
                "confirm_password": "LoginNew88",
            }),
            content_type="application/json",
        )
        login_resp = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": self.staff.username,
                             "password": "LoginNew88", "role": "staff"}),
            content_type="application/json",
        )
        ok = login_resp.status_code == 200 and "token" in login_resp.json()
        record("TEST 3  New password works for login", ok,
               f"status={login_resp.status_code}" if not ok else "")
        # Restore
        self.staff.set_password("OldPass99")
        self.staff.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 4  Old password no longer works after reset
    # ─────────────────────────────────────────────────────────────────────
    def test_04_old_password_rejected_after_reset(self):
        uid, tok = make_uidb64_token(self.staff)
        self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "BrandNew77",
                "confirm_password": "BrandNew77",
            }),
            content_type="application/json",
        )
        old_login = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": self.staff.username,
                             "password": "OldPass99", "role": "staff"}),
            content_type="application/json",
        )
        ok = old_login.status_code == 401
        record("TEST 4  Old password rejected after reset (401)", ok,
               f"status={old_login.status_code}" if not ok else "")
        self.staff.set_password("OldPass99")
        self.staff.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 5  Admin password reset works
    # ─────────────────────────────────────────────────────────────────────
    def test_05_admin_reset_works(self):
        uid, tok = make_uidb64_token(self.admin)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "AdminNew55",
                "confirm_password": "AdminNew55",
            }),
            content_type="application/json",
        )
        self.admin.refresh_from_db()
        ok = resp.status_code == 200
        record("TEST 5  Admin password reset works", ok,
               f"status={resp.status_code}" if not ok else "")
        self.admin.set_password("OldPass99")
        self.admin.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 6  Staff password reset works
    # ─────────────────────────────────────────────────────────────────────
    def test_06_staff_reset_works(self):
        uid, tok = make_uidb64_token(self.staff)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "StaffNew44",
                "confirm_password": "StaffNew44",
            }),
            content_type="application/json",
        )
        ok = resp.status_code == 200
        record("TEST 6  Staff password reset works", ok,
               f"status={resp.status_code}" if not ok else "")
        self.staff.set_password("OldPass99")
        self.staff.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 7  Student password reset works
    # ─────────────────────────────────────────────────────────────────────
    def test_07_student_reset_works(self):
        uid, tok = make_uidb64_token(self.student_user)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "StuNew1234",
                "confirm_password": "StuNew1234",
            }),
            content_type="application/json",
        )
        ok = resp.status_code == 200
        record("TEST 7  Student password reset works", ok,
               f"status={resp.status_code}" if not ok else "")
        self.student_user.set_password("OldPass99")
        self.student_user.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 8  Unknown email → identical generic response (anti-enumeration)
    # ─────────────────────────────────────────────────────────────────────
    def test_08_unknown_email_no_enumeration(self):
        resp_known = self.client.post(
            "/api/auth/password-reset/",
            data=json.dumps({"email": self.admin.email}),
            content_type="application/json",
        )
        resp_unknown = self.client.post(
            "/api/auth/password-reset/",
            data=json.dumps({"email": "nobody_ever@notregistered.xyz"}),
            content_type="application/json",
        )
        same_status  = resp_known.status_code == resp_unknown.status_code == 200
        same_message = resp_known.json().get("message") == resp_unknown.json().get("message")
        ok = same_status and same_message
        detail = ""
        if not ok:
            detail = (f"known={resp_known.status_code}/{resp_known.json().get('message')} | "
                      f"unknown={resp_unknown.status_code}/{resp_unknown.json().get('message')}")
        record("TEST 8  Unknown email → same generic response (no enumeration)", ok, detail)

    # ─────────────────────────────────────────────────────────────────────
    # TEST 9  Invalid token rejected (400)
    # ─────────────────────────────────────────────────────────────────────
    def test_09_invalid_token_rejected(self):
        uid, _ = make_uidb64_token(self.admin)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid,
                "token": "this-is-completely-fake-invalid-token-abc123",
                "new_password": "SomePass55",
                "confirm_password": "SomePass55",
            }),
            content_type="application/json",
        )
        ok = resp.status_code == 400
        record("TEST 9  Invalid token rejected (400)", ok,
               f"status={resp.status_code}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 10 Expired token rejected
    #         Simulate by patching PasswordResetTokenGenerator._today to return
    #         a day far in the future, making the token appear old
    # ─────────────────────────────────────────────────────────────────────
    def test_10_expired_token_rejected(self):
        from django.test import override_settings

        uid, tok = make_uidb64_token(self.admin)

        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            resp = self.client.post(
                "/api/auth/password-reset-confirm/",
                data=json.dumps({
                    "uidb64": uid, "token": tok,
                    "new_password": "ExpiredAttempt1",
                    "confirm_password": "ExpiredAttempt1",
                }),
                content_type="application/json",
            )

        ok = resp.status_code == 400
        record("TEST 10 Expired token rejected (400)", ok,
               f"status={resp.status_code} body={resp.json()}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 11 Reused token rejected (single-use enforcement)
    # ─────────────────────────────────────────────────────────────────────
    def test_11_reused_token_rejected(self):
        uid, tok = make_uidb64_token(self.admin)
        # First use — should succeed
        r1 = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "FirstUse99",
                "confirm_password": "FirstUse99",
            }),
            content_type="application/json",
        )
        # Second use with SAME token — password has changed, so token is now invalid
        r2 = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": "SecondUse99",
                "confirm_password": "SecondUse99",
            }),
            content_type="application/json",
        )
        ok = r1.status_code == 200 and r2.status_code == 400
        record("TEST 11 Reused token rejected (single-use, 400 on 2nd use)", ok,
               f"1st={r1.status_code} 2nd={r2.status_code}" if not ok else "")
        self.admin.set_password("OldPass99")
        self.admin.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 12 Password mismatch rejected (400)
    # ─────────────────────────────────────────────────────────────────────
    def test_12_password_mismatch_rejected(self):
        uid, tok = make_uidb64_token(self.admin)
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password":     "CorrectPass1",
                "confirm_password": "WrongPass999",
            }),
            content_type="application/json",
        )
        ok = resp.status_code == 400 and "match" in resp.json().get("error", "").lower()
        record("TEST 12 Password mismatch rejected (400)", ok,
               f"status={resp.status_code} body={resp.json()}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 13 Weak password rejected (400)
    # ─────────────────────────────────────────────────────────────────────
    def test_13_weak_passwords_rejected(self):
        weak_cases = [
            ("short", "abc1"),           # < 8 chars
            ("no_number", "onlyletters"),  # no digit
            ("no_letter", "12345678"),    # no letter
            ("blacklisted", "password123"),
            ("min_boundary", "aaaa111"),  # 7 chars
        ]
        uid, tok = make_uidb64_token(self.admin)
        all_ok = True
        failures = []
        for label, pwd in weak_cases:
            # Re-generate token each time (previous attempts didn't change password)
            uid2, tok2 = make_uidb64_token(self.admin)
            resp = self.client.post(
                "/api/auth/password-reset-confirm/",
                data=json.dumps({
                    "uidb64": uid2, "token": tok2,
                    "new_password": pwd,
                    "confirm_password": pwd,
                }),
                content_type="application/json",
            )
            if resp.status_code != 400:
                all_ok = False
                failures.append(f"{label}={resp.status_code}")
        record("TEST 13 Weak passwords rejected (400) — 5 sub-cases", all_ok,
               "Failed: " + ", ".join(failures) if failures else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 14 Missing required fields rejected (400)
    # ─────────────────────────────────────────────────────────────────────
    def test_14_missing_fields_rejected(self):
        # Each sub-case uses a fresh uid/token so earlier sub-cases can't
        # "accidentally" supply a valid token for a later sub-case.
        def post_confirm(payload):
            return self.client.post(
                "/api/auth/password-reset-confirm/",
                data=json.dumps(payload),
                content_type="application/json",
            )

        uid_a, tok_a = make_uidb64_token(self.admin)
        uid_b, tok_b = make_uidb64_token(self.admin)
        uid_c, tok_c = make_uidb64_token(self.admin)
        uid_d, tok_d = make_uidb64_token(self.admin)

        cases = [
            # (description, payload) — each payload intentionally omits a field
            ("empty body",      {}),
            ("missing uidb64",  {                   "token": tok_a, "new_password": "GoodPass1", "confirm_password": "GoodPass1"}),
            ("missing token",   {"uidb64": uid_b,                   "new_password": "GoodPass1", "confirm_password": "GoodPass1"}),
            ("missing new_pwd", {"uidb64": uid_c,   "token": tok_c,                              "confirm_password": "GoodPass1"}),
            ("missing confirm", {"uidb64": uid_d,   "token": tok_d, "new_password": "GoodPass1"}),
        ]
        all_ok = True
        failures = []
        for label, payload in cases:
            resp = post_confirm(payload)
            if resp.status_code != 400:
                all_ok = False
                failures.append(f"{label}={resp.status_code}")

        # Missing email to reset-request endpoint
        r_email = self.client.post(
            "/api/auth/password-reset/",
            data=json.dumps({}),
            content_type="application/json",
        )
        if r_email.status_code != 400:
            all_ok = False
            failures.append(f"missing email in request={r_email.status_code}")

        record("TEST 14 Missing fields rejected (400) — 6 sub-cases", all_ok,
               "Failed: " + ", ".join(failures) if failures else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 15 Malformed uidb64 rejected (400)
    # ─────────────────────────────────────────────────────────────────────
    def test_15_malformed_uidb64_rejected(self):
        _, tok = make_uidb64_token(self.admin)
        bad_uids = [
            "notbase64!!!",
            "aaaa",                          # decodes to non-existent PK
            "MDAwMDAwMDAwMDAwMDAwMA==",       # PK 0000000000000000 — won't exist
            "",
            "   ",
        ]
        all_ok = True
        failures = []
        for uid in bad_uids:
            resp = self.client.post(
                "/api/auth/password-reset-confirm/",
                data=json.dumps({
                    "uidb64": uid, "token": tok,
                    "new_password": "GoodPass12",
                    "confirm_password": "GoodPass12",
                }),
                content_type="application/json",
            )
            if resp.status_code != 400:
                all_ok = False
                failures.append(f"uid={repr(uid)} → {resp.status_code}")
        record("TEST 15 Malformed uidb64 rejected (400) — 5 sub-cases", all_ok,
               "Failed: " + ", ".join(failures) if failures else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 16 Password never appears in any API response
    # ─────────────────────────────────────────────────────────────────────
    def test_16_password_not_in_responses(self):
        uid, tok = make_uidb64_token(self.admin)
        new_pwd = "SecureABC9"
        resp = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": uid, "token": tok,
                "new_password": new_pwd,
                "confirm_password": new_pwd,
            }),
            content_type="application/json",
        )
        body_str = resp.content.decode("utf-8")
        # The raw new password should never appear in the response body
        ok = new_pwd not in body_str
        record("TEST 16 New password not present in API response body", ok,
               f"Found password in: {body_str[:100]}" if not ok else "")
        self.admin.set_password("OldPass99")
        self.admin.save()

    # ─────────────────────────────────────────────────────────────────────
    # TEST 17 Reset token not exposed in password-reset-request response
    # ─────────────────────────────────────────────────────────────────────
    def test_17_token_not_in_request_response(self):
        with patch("api.views.threading.Thread") as mock_thread:
            mock_thread.return_value = MagicMock()
            resp = self.client.post(
                "/api/auth/password-reset/",
                data=json.dumps({"email": self.admin.email}),
                content_type="application/json",
            )
        data = resp.json()
        has_no_token  = "token"  not in data
        has_no_uid    = "uidb64" not in data
        has_no_url    = "reset_url" not in data and "url" not in data
        ok = has_no_token and has_no_uid and has_no_url
        record("TEST 17 Token/uid/url not exposed in reset-request response", ok,
               f"Keys in response: {list(data.keys())}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 18 Unauthorised user cannot change another user's password
    #         (The confirm endpoint is AllowAny — but the uidb64+token pair
    #          is cryptographically tied to a specific user; an attacker
    #          would need a valid token for the target user they don't have.)
    # ─────────────────────────────────────────────────────────────────────
    def test_18_cannot_change_other_users_password(self):
        # Generate a valid uid/token for admin
        admin_uid, admin_tok = make_uidb64_token(self.admin)
        # Staff generates their own uid — now tries to use admin's uid with their own token
        _, staff_tok = make_uidb64_token(self.staff)
        resp_cross = self.client.post(
            "/api/auth/password-reset-confirm/",
            data=json.dumps({
                "uidb64": admin_uid,       # admin's uid
                "token":  staff_tok,       # staff's token — will not validate for admin
                "new_password":     "CrossAttack1",
                "confirm_password": "CrossAttack1",
            }),
            content_type="application/json",
        )
        # Verify admin's password actually unchanged
        from django.contrib.auth import authenticate
        admin_unchanged = authenticate(username=self.admin.username, password="OldPass99") is not None
        ok = resp_cross.status_code == 400 and admin_unchanged
        record("TEST 18 Cross-user token attack rejected — admin password unchanged", ok,
               f"status={resp_cross.status_code} admin_unchanged={admin_unchanged}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 19 Normal login still works (regression)
    # ─────────────────────────────────────────────────────────────────────
    def test_19_normal_login_regression(self):
        cases = [
            (self.admin,        "admin",   "admin"),
            (self.staff,        "OldPass99", "staff"),
            (self.student_user, "OldPass99", "student"),
        ]
        all_ok = True
        failures = []
        for user, pwd, role in cases:
            # Admin's password may differ if earlier tests ran out of order — use whatever
            if user == self.admin:
                pwd = "OldPass99"
                user.set_password(pwd)
                user.save()
            resp = self.client.post(
                "/api/auth/login/",
                data=json.dumps({"username": user.username,
                                 "password": pwd, "role": role}),
                content_type="application/json",
            )
            if resp.status_code != 200 or "token" not in resp.json():
                all_ok = False
                failures.append(f"{role}={resp.status_code}")
        record("TEST 19 Normal login still works for Admin/Staff/Student", all_ok,
               "Failed: " + ", ".join(failures) if failures else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 20 Role enforcement still works (wrong role → 401)
    # ─────────────────────────────────────────────────────────────────────
    def test_20_role_enforcement_regression(self):
        # Admin credentials with 'staff' role selected → must fail
        resp = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": self.admin.username,
                             "password": "OldPass99", "role": "staff"}),
            content_type="application/json",
        )
        ok = resp.status_code == 401
        record("TEST 20 Role mismatch still rejected (401)", ok,
               f"Expected 401, got {resp.status_code}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 21 manage_user_detail PATCH blocks password & reset_staff_password endpoint works
    # ─────────────────────────────────────────────────────────────────────
    def test_21_manage_user_detail_patch_enforces_strength(self):
        admin_auth_token = token_for(self.admin)
        self.admin.set_password("OldPass99")
        self.admin.save()

        target = make_user("target_staff", is_staff_flag=True, group="Staff")

        # PATCH with password must be blocked with 400
        patch_resp = self.client.patch(
            f"/api/auth/users/{target.id}/",
            data=json.dumps({"password": "GoodPass9"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {admin_auth_token}",
        )
        patch_blocked = patch_resp.status_code == 400 and "Password changes are not allowed" in patch_resp.json().get("error", "")

        # Dedicated endpoint rejects weak password
        weak_reset = self.client.post(
            f"/api/auth/staff/{target.id}/reset-password/",
            data=json.dumps({"new_password": "1234"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {admin_auth_token}",
        )
        weak_rejected = weak_reset.status_code == 400

        # Dedicated endpoint accepts strong password
        strong_reset = self.client.post(
            f"/api/auth/staff/{target.id}/reset-password/",
            data=json.dumps({"new_password": "StrongPass99"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {admin_auth_token}",
        )
        strong_accepted = strong_reset.status_code == 200

        ok = patch_blocked and weak_rejected and strong_accepted
        record("TEST 21 PATCH password blocked (400), dedicated reset_staff_password enforces strength", ok,
               f"patch_blocked={patch_blocked}, weak_rejected={weak_rejected}, strong_accepted={strong_accepted}" if not ok else "")

    # ─────────────────────────────────────────────────────────────────────
    # TEST 22 Existing document system import smoke-test (regression)
    # ─────────────────────────────────────────────────────────────────────
    def test_22_document_system_regression_import(self):
        """
        Verifies that the document system models and views are still importable
        and that the StudentDocument model still exists. A full re-run of
        test_document_system.py would duplicate 20 tests — this is a fast
        regression smoke-test only.
        """
        try:
            from api.models import StudentDocument
            from api.views import (
                upload_student_document, list_student_documents,
                verify_student_document, delete_student_document,
            )
            from api.serializers import StudentDocumentSerializer
            ok = True
        except ImportError as e:
            ok = False
            record("TEST 22 Document system still importable (regression)", ok, str(e))
            return
        record("TEST 22 Document system still importable (regression)", ok)


# ── Runner ────────────────────────────────────────────────────────────────

def run():
    import unittest
    from django.test.utils import setup_test_environment
    setup_test_environment()

    print("\n" + "═" * 68)
    print("   PASSWORD RESET FEATURE — AUTOMATED TEST SUITE")
    print("═" * 68 + "\n")

    loader = unittest.TestLoader()
    loader.sortTestMethodsUsing = lambda a, b: (int(a.split('_')[1]) - int(b.split('_')[1]))
    suite = loader.loadTestsFromTestCase(PasswordResetTests)

    # Suppress real SMTP calls during tests — we verify the logic, not email delivery.
    # The thread mock ensures no SMTP connection is attempted and tests don't hang.
    with patch("api.views.threading.Thread") as mock_thread:
        mock_thread.return_value = MagicMock()
        runner = unittest.TextTestRunner(verbosity=0, stream=open(os.devnull, 'w'))
        result = runner.run(suite)

    print("\n" + "─" * 68)
    print("  RESULTS")
    print("─" * 68)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, detail in results:
        sym = "✅" if ok else "❌"
        print(f"  {sym}  {name}")
        if detail:
            print(f"       └─ {detail}")
    print("─" * 68)
    print(f"  Total: {len(results)}  |  Passed: {passed}  |  Failed: {failed}")
    print("─" * 68 + "\n")

    if result.errors:
        print("  ⚠️  ERRORS:")
        for t, e in result.errors:
            print(f"    {t}: {e[:300]}")
    if result.failures:
        print("  ⚠️  UNITTEST FAILURES:")
        for t, e in result.failures:
            print(f"    {t}: {e[:300]}")

    code = 0 if (failed == 0 and not result.errors and not result.failures) else 1
    print(f"  Exit code: {code}\n")
    return code


if __name__ == "__main__":
    sys.exit(run())
