"""
test_phase_a_whatsapp.py
========================
Phase A — Outbound WhatsApp from Lead Detail
Full test suite covering:

  1. Phone normalization (normalize_phone_e164)
  2. send_whatsapp_to_lead() — unit tests with mocked HTTP
  3. POST /api/leads/<id>/send-whatsapp/ — authentication, authorization,
     validation, Twilio behaviour, activity logging, rate limiting
  4. Regression — send_step_completion_whatsapp() still works

Run (from backend/):
    python manage.py test test_phase_a_whatsapp --verbosity=2

All Twilio HTTP calls are mocked — no real network requests are made.
"""

import json
import os
import time
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import Lead, LeadActivity
from api.whatsapp_service import (
    WHATSAPP_MAX_MESSAGE_LENGTH,
    normalize_phone_e164,
    send_step_completion_whatsapp,
    send_whatsapp_to_lead,
)

# ── Helpers ────────────────────────────────────────────────────────────────

TWILIO_ENV = {
    "TWILIO_ACCOUNT_SID": "ACtest00000000000000000000000000000",
    "TWILIO_AUTH_TOKEN": "test_auth_token_never_in_response",
    "TWILIO_WHATSAPP_FROM": "whatsapp:+15550000001",  # non-sandbox
}


def _make_twilio_success(sid="SM_test_sid_abc"):
    """Return a mock requests.Response for a successful Twilio 201."""
    mock = MagicMock()
    mock.status_code = 201
    mock.json.return_value = {"sid": sid, "status": "queued"}
    return mock


def _make_twilio_failure(status=400, code=21614, message="Invalid To number"):
    mock = MagicMock()
    mock.status_code = status
    mock.json.return_value = {"code": code, "message": message}
    return mock


def _make_twilio_auth_failure():
    mock = MagicMock()
    mock.status_code = 401
    mock.json.return_value = {"code": 20003, "message": "Authenticate"}
    return mock


class _BaseCRMTest(TestCase):
    """
    Sets up admin, staff, student users and a sample Lead.
    Subclasses get a pre-authenticated APIClient for each role.
    """

    def setUp(self):
        # Clear the in-process rate-limit tracker before every test so tests
        # that run after the rate-limit test class don't inherit exhausted
        # quota windows.  The tracker is a class-level dict on LeadViewSet
        # and survives across TestCase instances within a test run.
        from api.views import LeadViewSet
        LeadViewSet._wa_send_log.clear()

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_wa", password="Admin1234!", email="admin@test.com",
            is_staff=True,
        )
        Token.objects.get_or_create(user=self.admin)

        # Staff
        self.staff = User.objects.create_user(
            username="staff_wa", password="Staff1234!", email="staff@test.com",
            is_staff=True,
        )
        staff_group, _ = Group.objects.get_or_create(name="Staff")
        self.staff.groups.add(staff_group)
        Token.objects.get_or_create(user=self.staff)

        # Student (should be denied)
        self.student = User.objects.create_user(
            username="student_wa", password="Student1234!", email="student@test.com",
            is_staff=False,
        )
        student_group, _ = Group.objects.get_or_create(name="Student")
        self.student.groups.add(student_group)
        Token.objects.get_or_create(user=self.student)

        # Lead with a valid Nepal phone
        self.lead = Lead.objects.create(
            name="Sujita Sharma",
            email="sujita@test.com",
            phone="9801234567",
            status="new",
        )

        # Convenience clients
        self.admin_client = self._authed_client(self.admin)
        self.staff_client = self._authed_client(self.staff)
        self.student_client = self._authed_client(self.student)
        self.anon_client = APIClient()

    def _authed_client(self, user):
        client = APIClient()
        token = Token.objects.get(user=user)
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return client

    def _url(self, lead_id=None):
        lid = lead_id if lead_id is not None else self.lead.id
        return f"/api/leads/{lid}/send-whatsapp/"


# ══════════════════════════════════════════════════════════════════════════════
# 1. PHONE NORMALIZATION
# ══════════════════════════════════════════════════════════════════════════════

class TestNormalizePhoneE164(TestCase):
    """Unit tests for normalize_phone_e164() — no DB, no HTTP."""

    # ── Valid Nepal inputs ─────────────────────────────────────────────

    def test_nepal_10digit_98(self):
        self.assertEqual(normalize_phone_e164("9801234567"), "+9779801234567")

    def test_nepal_10digit_97(self):
        self.assertEqual(normalize_phone_e164("9712345678"), "+9779712345678")

    def test_nepal_full_13digit(self):
        self.assertEqual(normalize_phone_e164("9779801234567"), "+9779801234567")

    def test_nepal_full_with_plus(self):
        self.assertEqual(normalize_phone_e164("+9779801234567"), "+9779801234567")

    def test_nepal_with_spaces(self):
        self.assertEqual(normalize_phone_e164("+977 9801234567"), "+9779801234567")

    def test_nepal_with_hyphens(self):
        self.assertEqual(normalize_phone_e164("977-9801234567"), "+9779801234567")

    def test_nepal_with_mixed_formatting(self):
        self.assertEqual(normalize_phone_e164("+977-98-012-34567"), "+9779801234567")

    # ── Valid international inputs (already has +) ─────────────────────

    def test_international_plus_preserved(self):
        # Arbitrary valid E.164 — pass through unchanged
        self.assertEqual(normalize_phone_e164("+14155551234"), "+14155551234")

    def test_india_full_with_plus(self):
        self.assertEqual(normalize_phone_e164("+919876543210"), "+919876543210")

    def test_india_12digit_no_plus(self):
        # 91 + 10-digit Indian mobile
        self.assertEqual(normalize_phone_e164("919876543210"), "+919876543210")

    # ── Invalid / ambiguous inputs → None ─────────────────────────────

    def test_empty_string(self):
        self.assertIsNone(normalize_phone_e164(""))

    def test_none_input(self):
        self.assertIsNone(normalize_phone_e164(None))

    def test_letters_only(self):
        self.assertIsNone(normalize_phone_e164("abcdefgh"))

    def test_too_short(self):
        self.assertIsNone(normalize_phone_e164("12345"))

    def test_too_long_no_plus(self):
        # 16 digits — exceeds E.164 max of 15
        self.assertIsNone(normalize_phone_e164("1234567890123456"))

    def test_ambiguous_10digit_starting_6(self):
        # Could be India — we refuse to auto-assign Nepal code
        self.assertIsNone(normalize_phone_e164("6001234567"))

    def test_ambiguous_10digit_starting_8(self):
        self.assertIsNone(normalize_phone_e164("8001234567"))

    def test_whitespace_only(self):
        self.assertIsNone(normalize_phone_e164("   "))

    def test_special_chars_only(self):
        self.assertIsNone(normalize_phone_e164("---"))

    def test_plus_only(self):
        self.assertIsNone(normalize_phone_e164("+"))

    def test_plus_too_short(self):
        # +12345 — only 5 digits, below 7-digit minimum
        self.assertIsNone(normalize_phone_e164("+12345"))


# ══════════════════════════════════════════════════════════════════════════════
# 2. send_whatsapp_to_lead() UNIT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSendWhatsAppToLead(TestCase):
    """
    Unit tests for the service function.
    All requests.post calls are mocked — no real HTTP.
    """

    # ── Success path ───────────────────────────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_success_returns_sent_true_and_sid(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_abc123")
        result = send_whatsapp_to_lead(
            lead_phone="9801234567",
            message="Hi Sujita, your AIEC counsellor will call you tomorrow.",
        )
        self.assertTrue(result["sent"])
        self.assertEqual(result["sid"], "SM_abc123")
        self.assertIsNone(result["error"])
        self.assertIn("timestamp", result)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_called_with_correct_payload(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        send_whatsapp_to_lead(lead_phone="9801234567", message="Test message")
        args, kwargs = mock_post.call_args
        # Verify To and From are in the payload
        self.assertIn("whatsapp:+9779801234567", kwargs["data"]["To"])
        self.assertEqual(kwargs["data"]["From"], "whatsapp:+15550000001")
        self.assertEqual(kwargs["data"]["Body"], "Test message")

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_200_response_also_treated_as_success(self, mock_post):
        mock = MagicMock()
        mock.status_code = 200
        mock.json.return_value = {"sid": "SM_200"}
        mock_post.return_value = mock
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hello")
        self.assertTrue(result["sent"])

    # ── Missing credentials ────────────────────────────────────────────

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+15550000001",
    })
    def test_missing_account_sid_and_token(self):
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIsNotNone(result["error"])
        # Must not expose credential names or values in the error
        self.assertNotIn("TWILIO_AUTH_TOKEN", result["error"])

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest",
        "TWILIO_AUTH_TOKEN": "token",
        "TWILIO_WHATSAPP_FROM": "",
    })
    def test_missing_from_number(self):
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIsNotNone(result["error"])

    # ── Sandbox rejection ──────────────────────────────────────────────

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest",
        "TWILIO_AUTH_TOKEN": "token",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",  # sandbox default
    })
    def test_sandbox_number_is_rejected(self):
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIn("sandbox", result["error"].lower())

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest",
        "TWILIO_AUTH_TOKEN": "token",
        "TWILIO_WHATSAPP_FROM": "+14155238886",  # sandbox without whatsapp: prefix
    })
    def test_sandbox_number_without_prefix_is_also_rejected(self):
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIn("sandbox", result["error"].lower())

    # ── Invalid phone ──────────────────────────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    def test_unnormalisable_phone_returns_error(self):
        result = send_whatsapp_to_lead(lead_phone="INVALID", message="hi")
        self.assertFalse(result["sent"])
        self.assertIsNotNone(result["error"])
        # No HTTP call should be made
    @patch.dict(os.environ, TWILIO_ENV)
    def test_empty_phone_returns_error(self):
        result = send_whatsapp_to_lead(lead_phone="", message="hi")
        self.assertFalse(result["sent"])

    # ── Twilio provider failures ───────────────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_401_returns_sent_false(self, mock_post):
        mock_post.return_value = _make_twilio_auth_failure()
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIsNotNone(result["error"])
        # Auth token must not appear in the error surfaced to caller
        self.assertNotIn("test_auth_token_never_in_response", result["error"])

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_400_invalid_recipient(self, mock_post):
        mock_post.return_value = _make_twilio_failure(400, 21614, "Invalid To")
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIn("21614", result["error"])

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_500_server_error(self, mock_post):
        mock = MagicMock()
        mock.status_code = 500
        mock.json.side_effect = ValueError("no json")
        mock_post.return_value = mock
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])

    # ── Network / timeout ─────────────────────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_timeout_returns_sent_false(self, mock_post):
        import requests as req_lib
        mock_post.side_effect = req_lib.exceptions.Timeout()
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIn("timed out", result["error"].lower())

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_network_error_returns_sent_false(self, mock_post):
        import requests as req_lib
        mock_post.side_effect = req_lib.exceptions.ConnectionError("refused")
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])
        self.assertIsNotNone(result["error"])

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_unexpected_exception_returns_sent_false(self, mock_post):
        mock_post.side_effect = RuntimeError("unexpected boom")
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="hi")
        self.assertFalse(result["sent"])

    # ── Credentials never in return value ─────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_credentials_not_in_success_result(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="safe")
        result_str = json.dumps(result)
        self.assertNotIn("ACtest", result_str)
        self.assertNotIn("test_auth_token_never_in_response", result_str)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_credentials_not_in_failure_result(self, mock_post):
        mock_post.return_value = _make_twilio_failure()
        result = send_whatsapp_to_lead(lead_phone="9801234567", message="safe")
        result_str = json.dumps(result)
        self.assertNotIn("test_auth_token_never_in_response", result_str)


# ══════════════════════════════════════════════════════════════════════════════
# 3. POST /api/leads/<id>/send-whatsapp/ — API ENDPOINT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSendWhatsAppEndpointAuth(_BaseCRMTest):
    """Authentication and authorisation tests — no real Twilio."""

    # ── Anonymous → 401 ───────────────────────────────────────────────

    def test_anonymous_denied(self):
        res = self.anon_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        self.assertIn(res.status_code, [401, 403])

    # ── Student → 403 ─────────────────────────────────────────────────

    def test_student_denied(self):
        res = self.student_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        self.assertIn(res.status_code, [401, 403])

    # ── Admin → allowed (mocked success) ──────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_admin_allowed(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        res = self.admin_client.post(
            self._url(), {"message": "Admin test message"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["sent"])

    # ── Staff → allowed (mocked success) ──────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_staff_allowed(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        res = self.staff_client.post(
            self._url(), {"message": "Staff test message"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["sent"])


class TestSendWhatsAppEndpointIDOR(_BaseCRMTest):
    """IDOR / authorization tests."""

    def test_nonexistent_lead_returns_404(self):
        res = self.admin_client.post(
            self._url(lead_id=99999), {"message": "hi"}, format="json"
        )
        self.assertEqual(res.status_code, 404)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_admin_cannot_supply_phone_in_request(self, mock_post):
        """
        Even if the client sends a 'phone' field, the backend must ignore it
        and use Lead.phone from the database.
        """
        mock_post.return_value = _make_twilio_success()
        res = self.admin_client.post(
            self._url(),
            {"message": "hi", "phone": "+0000000000"},  # attacker-supplied
            format="json",
        )
        # Must succeed (or fail on config) — but the Twilio call must have used
        # the lead's actual phone, not the attacker's number.
        if res.status_code == 201:
            args, kwargs = mock_post.call_args
            self.assertNotIn("+0000000000", kwargs["data"]["To"])
            # Should be the lead's normalised phone
            self.assertIn("+977", kwargs["data"]["To"])

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_staff_cannot_supply_to_in_request(self, mock_post):
        """to / From fields supplied by client must be ignored."""
        mock_post.return_value = _make_twilio_success()
        res = self.staff_client.post(
            self._url(),
            {"message": "hi", "To": "whatsapp:+1999999999"},
            format="json",
        )
        if res.status_code == 201:
            args, kwargs = mock_post.call_args
            # The actual Twilio call's To must be the lead's normalised phone
            self.assertNotIn("+1999999999", kwargs["data"]["To"])


class TestSendWhatsAppEndpointValidation(_BaseCRMTest):
    """Message validation tests — no Twilio calls needed."""

    def test_missing_message_field(self):
        res = self.admin_client.post(self._url(), {}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.data)

    def test_empty_message_string(self):
        res = self.admin_client.post(
            self._url(), {"message": ""}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_whitespace_only_message(self):
        res = self.admin_client.post(
            self._url(), {"message": "   \n\t  "}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_message_too_long(self):
        long_msg = "A" * (WHATSAPP_MAX_MESSAGE_LENGTH + 1)
        res = self.admin_client.post(
            self._url(), {"message": long_msg}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn(str(WHATSAPP_MAX_MESSAGE_LENGTH), res.data["error"])

    def test_message_at_exact_max_length_is_accepted(self):
        """A message of exactly MAX length must pass validation."""
        # Mock Twilio so we don't need credentials here
        exact_msg = "B" * WHATSAPP_MAX_MESSAGE_LENGTH
        with patch.dict(os.environ, TWILIO_ENV), \
             patch("api.whatsapp_service.requests.post",
                   return_value=_make_twilio_success()):
            res = self.admin_client.post(
                self._url(), {"message": exact_msg}, format="json"
            )
        self.assertEqual(res.status_code, 201)

    def test_non_string_message(self):
        res = self.admin_client.post(
            self._url(), {"message": 12345}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_lead_with_no_phone_returns_400(self):
        lead_no_phone = Lead.objects.create(
            name="No Phone Lead", email="nophone@test.com", phone=""
        )
        res = self.admin_client.post(
            self._url(lead_id=lead_no_phone.id),
            {"message": "Hello"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("phone", res.data["error"].lower())

    def test_lead_with_invalid_phone_returns_503(self):
        """
        The lead has a phone but it cannot be normalised to E.164.
        The service returns sent=False; the view maps it to 503.
        """
        lead_bad_phone = Lead.objects.create(
            name="Bad Phone Lead", email="bad@test.com", phone="INVALID"
        )
        with patch.dict(os.environ, TWILIO_ENV):
            res = self.admin_client.post(
                self._url(lead_id=lead_bad_phone.id),
                {"message": "Hello"},
                format="json",
            )
        self.assertEqual(res.status_code, 503)
        self.assertIn("error", res.data)


class TestSendWhatsAppEndpointTwilioBehaviour(_BaseCRMTest):
    """End-to-end view → service → mocked Twilio behaviour."""

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_success_returns_201_with_activity_id(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_success_sid")
        res = self.admin_client.post(
            self._url(), {"message": "Hi Sujita!"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["sent"])
        self.assertIn("activity_id", res.data)
        self.assertIsInstance(res.data["activity_id"], int)
        self.assertIn("message", res.data)

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "TWILIO_WHATSAPP_FROM": "",
    })
    def test_missing_credentials_returns_503(self):
        res = self.admin_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        self.assertEqual(res.status_code, 503)
        self.assertIn("error", res.data)
        # Credential names must not appear in response
        self.assertNotIn("TWILIO_AUTH_TOKEN", res.data["error"])

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_provider_failure_returns_503(self, mock_post):
        mock_post.return_value = _make_twilio_failure(400, 21614, "Invalid To")
        res = self.admin_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        self.assertEqual(res.status_code, 503)
        self.assertNotIn(
            "test_auth_token_never_in_response", str(res.data)
        )

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_timeout_returns_503(self, mock_post):
        import requests as req_lib
        mock_post.side_effect = req_lib.exceptions.Timeout()
        res = self.admin_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        self.assertEqual(res.status_code, 503)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_no_credential_values_in_response_on_any_failure(self, mock_post):
        mock_post.return_value = _make_twilio_auth_failure()
        res = self.admin_client.post(
            self._url(), {"message": "hi"}, format="json"
        )
        response_str = json.dumps(res.data)
        # Auth token must never appear in any API response
        self.assertNotIn("test_auth_token_never_in_response", response_str)
        self.assertNotIn("ACtest00000000000000000000000000000", response_str)


class TestSendWhatsAppEndpointActivityLogging(_BaseCRMTest):
    """Verify LeadActivity records are created correctly."""

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_successful_send_creates_whatsapp_activity(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_log_test")
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()

        res = self.admin_client.post(
            self._url(), {"message": "Hi from AIEC!"}, format="json"
        )
        self.assertEqual(res.status_code, 201)

        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()
        self.assertEqual(after_count, before_count + 1)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_activity_content_prefixed_with_sent_marker(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_prefix_test")
        self.admin_client.post(
            self._url(), {"message": "Check this message"}, format="json"
        )
        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).latest("created_at")
        self.assertIn("[Sent via AIEC WhatsApp]", activity.content)
        self.assertIn("Check this message", activity.content)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_activity_sid_recorded(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_sid_in_log")
        self.admin_client.post(
            self._url(), {"message": "SID check"}, format="json"
        )
        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).latest("created_at")
        self.assertIn("SM_sid_in_log", activity.content)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_activity_author_is_sending_user(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        self.staff_client.post(
            self._url(), {"message": "Staff sent this"}, format="json"
        )
        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).latest("created_at")
        self.assertEqual(activity.author, self.staff)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_failed_send_does_not_create_activity(self, mock_post):
        mock_post.return_value = _make_twilio_failure()
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()

        res = self.admin_client.post(
            self._url(), {"message": "will fail"}, format="json"
        )
        self.assertEqual(res.status_code, 503)

        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()
        self.assertEqual(after_count, before_count)

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "TWILIO_WHATSAPP_FROM": "",
    })
    def test_missing_config_does_not_create_activity(self):
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()
        res = self.admin_client.post(
            self._url(), {"message": "will not send"}, format="json"
        )
        self.assertEqual(res.status_code, 503)
        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).count()
        self.assertEqual(after_count, before_count)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_activity_content_does_not_contain_auth_token(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        self.admin_client.post(
            self._url(), {"message": "audit me"}, format="json"
        )
        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type="whatsapp"
        ).latest("created_at")
        self.assertNotIn("test_auth_token_never_in_response", activity.content)
        self.assertNotIn("ACtest", activity.content)


class TestSendWhatsAppEndpointRateLimit(_BaseCRMTest):
    """In-process rate limiting — 5 sends per 60 s per (user, lead)."""

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_rate_limit_after_max_sends(self, mock_post):
        mock_post.return_value = _make_twilio_success()

        from api.views import LeadViewSet
        # Clear the tracker to avoid bleed-over from other tests
        LeadViewSet._wa_send_log.clear()

        for i in range(LeadViewSet._WA_MAX_PER_WINDOW):
            res = self.admin_client.post(
                self._url(), {"message": f"message {i}"}, format="json"
            )
            self.assertEqual(res.status_code, 201, f"Send {i} should succeed")

        # The (MAX+1)th send should be throttled
        res = self.admin_client.post(
            self._url(), {"message": "one too many"}, format="json"
        )
        self.assertEqual(res.status_code, 429)
        self.assertIn("error", res.data)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_rate_limit_is_per_user_not_global(self, mock_post):
        """
        Staff hitting the limit does not block admin on the same lead.
        """
        mock_post.return_value = _make_twilio_success()
        from api.views import LeadViewSet
        LeadViewSet._wa_send_log.clear()

        # Exhaust staff's quota
        for i in range(LeadViewSet._WA_MAX_PER_WINDOW):
            self.staff_client.post(
                self._url(), {"message": f"staff {i}"}, format="json"
            )

        # Admin should still be allowed (different user key)
        res = self.admin_client.post(
            self._url(), {"message": "admin send"}, format="json"
        )
        self.assertEqual(res.status_code, 201)


# ══════════════════════════════════════════════════════════════════════════════
# 4. SECURITY INVARIANT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSendWhatsAppSecurityInvariants(_BaseCRMTest):
    """
    Explicit security assertions required by Phase A spec.
    """

    # ── Recipient is always from the Lead record ───────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_recipient_always_from_lead_record_not_request(self, mock_post):
        """
        The client supplies an attacker-controlled 'phone' field.
        Twilio must be called with the lead's phone, not the attacker's.
        """
        mock_post.return_value = _make_twilio_success()
        res = self.admin_client.post(
            self._url(),
            {"message": "hi", "phone": "+1800ATTACKER", "to": "+1800ATTACKER"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, f"Expected 201 but got {res.status_code}: {res.data}")
        args, kwargs = mock_post.call_args
        self.assertNotIn("ATTACKER", kwargs["data"]["To"])
        self.assertIn("whatsapp:+977", kwargs["data"]["To"])

    # ── Credentials never in API responses ────────────────────────────

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_auth_token_not_in_success_response(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        res = self.admin_client.post(
            self._url(), {"message": "clean"}, format="json"
        )
        self.assertNotIn(
            "test_auth_token_never_in_response", json.dumps(res.data)
        )

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_auth_token_not_in_error_response(self, mock_post):
        mock_post.return_value = _make_twilio_failure()
        res = self.admin_client.post(
            self._url(), {"message": "clean"}, format="json"
        )
        self.assertNotIn(
            "test_auth_token_never_in_response", json.dumps(res.data)
        )

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_account_sid_not_in_api_response(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        res = self.admin_client.post(
            self._url(), {"message": "sid check"}, format="json"
        )
        self.assertNotIn(
            "ACtest00000000000000000000000000000", json.dumps(res.data)
        )

    # ── No unauthenticated or student access ──────────────────────────

    def test_unauthenticated_cannot_send(self):
        res = self.anon_client.post(
            self._url(), {"message": "anon"}, format="json"
        )
        self.assertIn(res.status_code, [401, 403])

    def test_student_cannot_send(self):
        res = self.student_client.post(
            self._url(), {"message": "student"}, format="json"
        )
        self.assertIn(res.status_code, [401, 403])

    # ── No cross-lead unauthorised send ────────────────────────────────
    # (In single-tenant AIEC, all staff share access to all leads.
    #  The protection is that Lead object lookup is server-side via
    #  get_object() — client cannot inject a different Lead's phone.)

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_lead_phone_is_fetched_server_side_for_each_lead(self, mock_post):
        """Two leads → two different phones. Each send uses the correct one."""
        mock_post.return_value = _make_twilio_success()

        lead_a = self.lead  # phone: 9801234567
        lead_b = Lead.objects.create(
            name="Lead B", email="b@test.com", phone="+9779888888888"
        )

        # Send to lead_a
        res_a = self.admin_client.post(
            self._url(lead_a.id), {"message": "to A"}, format="json"
        )
        self.assertEqual(res_a.status_code, 201, f"Lead A send failed: {res_a.data}")
        call_a = mock_post.call_args_list[-1]
        to_a = call_a[1]["data"]["To"]

        # Send to lead_b
        res_b = self.admin_client.post(
            self._url(lead_b.id), {"message": "to B"}, format="json"
        )
        self.assertEqual(res_b.status_code, 201, f"Lead B send failed: {res_b.data}")
        call_b = mock_post.call_args_list[-1]
        to_b = call_b[1]["data"]["To"]

        self.assertNotEqual(to_a, to_b)
        self.assertIn("9779801234567", to_a)
        self.assertIn("9779888888888", to_b)

    # ── No huge payload abuse ──────────────────────────────────────────

    def test_huge_message_payload_rejected(self):
        res = self.admin_client.post(
            self._url(), {"message": "X" * 100_000}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    # ── No injection through message content ─────────────────────────
    # Backend passes message straight to Twilio Body field (no exec/eval).
    # Validate that the content is transmitted as-is and not stripped in
    # a way that would silently alter the message.

    @patch.dict(os.environ, TWILIO_ENV)
    @patch("api.whatsapp_service.requests.post")
    def test_message_with_special_chars_transmitted_correctly(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        special = "Hello <script>alert(1)</script> & \"quotes\" 'apostrophe'"
        res = self.admin_client.post(
            self._url(), {"message": special}, format="json"
        )
        self.assertEqual(
            res.status_code, 201,
            f"Expected 201 but got {res.status_code}: {res.data}"
        )
        # The Twilio payload Body should contain the message unchanged
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs["data"]["Body"], special)


# ══════════════════════════════════════════════════════════════════════════════
# 5. REGRESSION — send_step_completion_whatsapp() STILL WORKS
# ══════════════════════════════════════════════════════════════════════════════

class TestStepCompletionWhatsAppRegression(TestCase):
    """
    The existing student process-step WhatsApp notification must not be
    broken by Phase A changes. We test it in isolation (no DB needed).
    """

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest_step",
        "TWILIO_AUTH_TOKEN": "token_step",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",  # sandbox OK for students
    })
    @patch("api.whatsapp_service.requests.post")
    def test_sends_successfully(self, mock_post):
        mock_post.return_value = _make_twilio_success("SM_step_ok")
        result = send_step_completion_whatsapp(
            student_name="Ram Bahadur",
            phone="+9779812345678",
            step_name="Visa Application",
            next_step_name="Visa Interview",
        )
        self.assertTrue(result["sent"])
        self.assertEqual(result["sid"], "SM_step_ok")

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest_step",
        "TWILIO_AUTH_TOKEN": "token_step",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
    })
    @patch("api.whatsapp_service.requests.post")
    def test_message_body_contains_step_name(self, mock_post):
        mock_post.return_value = _make_twilio_success()
        send_step_completion_whatsapp(
            student_name="Gita Devi",
            phone="+9779809999999",
            step_name="Offer Letter",
        )
        args, kwargs = mock_post.call_args
        self.assertIn("Offer Letter", kwargs["data"]["Body"])
        self.assertIn("Gita Devi", kwargs["data"]["Body"])

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
    })
    def test_missing_credentials_returns_gracefully(self):
        """Must not raise; returns sent=False."""
        result = send_step_completion_whatsapp(
            student_name="Test",
            phone="+9779801111111",
            step_name="Document Collection",
        )
        self.assertFalse(result["sent"])
        self.assertIn("reason", result)

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest_step",
        "TWILIO_AUTH_TOKEN": "token_step",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
    })
    @patch("api.whatsapp_service.requests.post")
    def test_twilio_failure_returns_gracefully(self, mock_post):
        mock_post.return_value = _make_twilio_failure()
        result = send_step_completion_whatsapp(
            student_name="Test",
            phone="+9779801111111",
            step_name="University Application",
        )
        self.assertFalse(result["sent"])

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest_step",
        "TWILIO_AUTH_TOKEN": "token_step",
        "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
    })
    @patch("api.whatsapp_service.requests.post")
    def test_network_error_does_not_raise(self, mock_post):
        import requests as req_lib
        mock_post.side_effect = req_lib.exceptions.ConnectionError("down")
        # Must not raise
        result = send_step_completion_whatsapp(
            student_name="Test",
            phone="+9779801111111",
            step_name="Pre-departure",
        )
        self.assertFalse(result["sent"])

    def test_function_signature_unchanged(self):
        """
        Verify the function is importable and callable with the original
        positional + keyword signature so existing callers don't break.
        """
        # No credentials → graceful skip
        with patch.dict(os.environ, {
            "TWILIO_ACCOUNT_SID": "", "TWILIO_AUTH_TOKEN": "",
            "TWILIO_WHATSAPP_FROM": "",
        }):
            result = send_step_completion_whatsapp(
                student_name="S",
                phone="+9779801234567",
                step_name="Step",
                next_step_name="Next",
            )
        self.assertIn("sent", result)
        self.assertIn("timestamp", result)
