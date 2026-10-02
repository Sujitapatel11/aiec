import os
import logging
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

# Editable template constant
DEFAULT_COMPLETED_STEP_TEMPLATE = (
    "Hi {student_name}, your process step '{step_name}' has been marked COMPLETED! "
    "Next step: {next_step_name}. View your progress anytime on the AIEC Student Portal."
)

def send_step_completion_whatsapp(student_name: str, phone: str, step_name: str, next_step_name: str = "Pre-departure") -> dict:
    """
    Sends a WhatsApp message via Twilio API when a process step is completed.
    Gracefully logs attempts and errors without raising exceptions.
    """
    timestamp = datetime.now().isoformat()
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886").strip()

    message_body = DEFAULT_COMPLETED_STEP_TEMPLATE.format(
        student_name=student_name,
        step_name=step_name,
        next_step_name=next_step_name or "Completion / Pre-departure"
    )

    log_prefix = f"[WHATSAPP NOTIFICATION] [{timestamp}] Student: '{student_name}' | Phone: '{phone}' | Step: '{step_name}'"

    if not account_sid or not auth_token:
        log_msg = f"{log_prefix} -> SKIPPED (Twilio credentials TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in .env)"
        print(log_msg, flush=True)
        logger.info(log_msg)
        return {"sent": False, "reason": "Missing Twilio credentials in environment", "timestamp": timestamp}

    # Format phone numbers for Twilio WhatsApp (must start with whatsapp:+)
    to_number = phone.strip()
    if not to_number.startswith("whatsapp:"):
        if not to_number.startswith("+"):
            to_number = f"+{to_number}"
        to_number = f"whatsapp:{to_number}"

    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {
        "From": from_number,
        "To": to_number,
        "Body": message_body,
    }

    try:
        res = requests.post(url, data=data, auth=(account_sid, auth_token), timeout=5)
        if res.status_code in [200, 201]:
            resp_json = res.json()
            sid = resp_json.get("sid", "")
            log_msg = f"{log_prefix} -> SUCCESS (Twilio SID: {sid})"
            print(log_msg, flush=True)
            logger.info(log_msg)
            return {"sent": True, "sid": sid, "timestamp": timestamp}
        else:
            log_msg = f"{log_prefix} -> FAILED (Status {res.status_code}: {res.text})"
            print(log_msg, flush=True)
            logger.warning(log_msg)
            return {"sent": False, "reason": f"API HTTP {res.status_code}", "detail": res.text, "timestamp": timestamp}
    except Exception as e:
        log_msg = f"{log_prefix} -> ERROR ({str(e)})"
        print(log_msg, flush=True)
        logger.error(log_msg)
        return {"sent": False, "reason": str(e), "timestamp": timestamp}


# ── Phase A — Lead WhatsApp Messaging ─────────────────────────────────────

# Maximum message length accepted from the CRM UI.
# WhatsApp Business allows up to 4096 chars; we enforce a tighter CRM limit.
WHATSAPP_MAX_MESSAGE_LENGTH = 1000


def normalize_phone_e164(raw_phone: str) -> str | None:
    """
    Normalize a phone number to E.164 format for Twilio WhatsApp delivery.

    Rules:
    - Strip all whitespace, hyphens, parentheses, dots.
    - If the result already starts with '+', treat it as international and
      return as-is (caller supplied a country code).
    - If the result starts with '977' (Nepal country code, 12 digits total),
      prepend '+'.
    - If the result is 10 digits and starts with '9' (Nepal mobile pattern
      98XXXXXXXX / 97XXXXXXXX), prepend '+977'.
    - Otherwise return None — the number is not recognisable.

    This is intentionally conservative: we only normalise patterns we
    understand.  We never silently prepend Nepal code to an ambiguous
    international number.

    Returns:
        str  — E.164 number like '+9779801234567'
        None — number could not be normalised safely
    """
    if not raw_phone:
        return None

    # Strip formatting chars but keep leading + for detection
    stripped = raw_phone.strip()
    has_plus = stripped.startswith('+')
    digits = ''.join(c for c in stripped if c.isdigit())

    if not digits:
        return None

    # Already fully international (caller wrote +<digits>)
    if has_plus:
        # Sanity: must be at least 7 digits and at most 15 (ITU E.164 limit)
        if 7 <= len(digits) <= 15:
            return f"+{digits}"
        return None

    # No leading '+' — try to infer country code

    # Nepal: country code 977, total 13 digits (977 + 10-digit mobile)
    # Covers: '9779801234567', '977-9801234567' (after stripping hyphens)
    if digits.startswith('977') and len(digits) == 13:
        return f"+{digits}"

    # Nepal mobile shorthand: 10 digits starting with 98 or 97
    # Covers: '9801234567', '9712345678'
    if len(digits) == 10 and digits[:2] in ('98', '97'):
        return f"+977{digits}"

    # India: country code 91, total 12 digits (91 + 10-digit mobile)
    if digits.startswith('91') and len(digits) == 12:
        return f"+{digits}"

    # India mobile shorthand: 10 digits starting with 6, 7, 8
    # (9x is reserved for Nepal above, so we only handle 6/7/8 here)
    if len(digits) == 10 and digits[0] in ('6', '7', '8'):
        # Ambiguous — could be Nepal or India.  Do not auto-assign.
        # Caller should provide country code explicitly.
        return None

    # Any other pattern: reject to avoid misrouting.
    return None


def send_whatsapp_to_lead(
    *,
    lead_phone: str,
    message: str,
    sender_name: str = "AIEC",
) -> dict:
    """
    Send an outbound WhatsApp message from the AIEC Business number to a Lead.

    This is the Phase A CRM → Lead WhatsApp channel.  It is entirely separate
    from send_step_completion_whatsapp() which targets enrolled Students.

    Args:
        lead_phone:   Raw phone from Lead.phone (will be normalised internally).
        message:      The counsellor's message body (already validated by view).
        sender_name:  Display name used in log messages (not in the WhatsApp
                      body — WhatsApp Business header comes from the registered
                      sender).

    Returns a structured dict:
        {
          "sent":      bool,
          "sid":       str | None,     # Twilio message SID on success
          "error":     str | None,     # Safe user-facing error on failure
          "timestamp": str,            # ISO timestamp
        }

    Never raises — callers can always inspect the return dict.
    Credentials are never included in the return value or logs.
    """
    import os
    from datetime import datetime

    timestamp = datetime.now().isoformat()
    log_prefix = f"[WA-LEAD] [{timestamp}] Phone: '{lead_phone}' Sender: '{sender_name}'"

    # ── 1. Read Twilio credentials ──────────────────────────────────────
    account_sid  = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token   = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number  = os.getenv("TWILIO_WHATSAPP_FROM", "").strip()

    if not account_sid or not auth_token:
        msg = f"{log_prefix} -> SKIPPED (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured)"
        print(msg, flush=True)
        logger.warning(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "WhatsApp service is not configured. Contact your administrator.",
            "timestamp": timestamp,
        }

    if not from_number:
        msg = f"{log_prefix} -> SKIPPED (TWILIO_WHATSAPP_FROM not configured)"
        print(msg, flush=True)
        logger.warning(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "WhatsApp sender number is not configured. Contact your administrator.",
            "timestamp": timestamp,
        }

    # Explicitly reject the Twilio sandbox default so it is never used for
    # production Lead messaging.
    SANDBOX_NUMBER = "whatsapp:+14155238886"
    normalised_from = from_number if from_number.startswith("whatsapp:") else f"whatsapp:{from_number}"
    if normalised_from == SANDBOX_NUMBER:
        msg = f"{log_prefix} -> BLOCKED (TWILIO_WHATSAPP_FROM is still the sandbox number)"
        print(msg, flush=True)
        logger.warning(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "WhatsApp sender is still using the Twilio sandbox number. "
                     "Configure a real AIEC Business WhatsApp sender in TWILIO_WHATSAPP_FROM.",
            "timestamp": timestamp,
        }

    # ── 2. Normalise recipient phone ────────────────────────────────────
    e164 = normalize_phone_e164(lead_phone)
    if not e164:
        msg = f"{log_prefix} -> FAILED (phone '{lead_phone}' could not be normalised to E.164)"
        print(msg, flush=True)
        logger.warning(msg)
        return {
            "sent": False,
            "sid": None,
            "error": (
                "The lead's phone number could not be converted to an international format. "
                "Please update the lead's phone number with a country code (e.g. +9779801234567)."
            ),
            "timestamp": timestamp,
        }

    to_number = f"whatsapp:{e164}"

    # ── 3. Dispatch via Twilio REST API ─────────────────────────────────
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = {
        "From": normalised_from,
        "To":   to_number,
        "Body": message,
    }

    try:
        res = requests.post(
            url,
            data=payload,
            auth=(account_sid, auth_token),
            timeout=10,
        )

        if res.status_code in (200, 201):
            try:
                resp_json = res.json()
            except Exception:
                resp_json = {}
            sid = resp_json.get("sid", "")
            success_msg = f"{log_prefix} -> SUCCESS (Twilio SID: {sid}) To: {to_number}"
            print(success_msg, flush=True)
            logger.info(success_msg)
            return {
                "sent": True,
                "sid": sid,
                "error": None,
                "timestamp": timestamp,
            }

        # Non-2xx from Twilio — extract safe code/message, never expose auth
        try:
            err_json = res.json()
            twilio_code = err_json.get("code", res.status_code)
            twilio_msg  = err_json.get("message", "Unknown Twilio error")
        except Exception:
            twilio_code = res.status_code
            twilio_msg  = "Could not parse Twilio response"

        fail_msg = f"{log_prefix} -> FAILED (HTTP {res.status_code} code={twilio_code})"
        print(fail_msg, flush=True)
        logger.warning(fail_msg)
        return {
            "sent": False,
            "sid": None,
            "error": f"WhatsApp delivery failed (code {twilio_code}): {twilio_msg}",
            "timestamp": timestamp,
        }

    except requests.exceptions.Timeout:
        msg = f"{log_prefix} -> TIMEOUT"
        print(msg, flush=True)
        logger.error(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "WhatsApp delivery timed out. Please try again.",
            "timestamp": timestamp,
        }
    except requests.exceptions.RequestException as exc:
        # Log the exception type but not the full repr which may include URLs
        # containing the account SID
        msg = f"{log_prefix} -> NETWORK ERROR ({type(exc).__name__})"
        print(msg, flush=True)
        logger.error(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "A network error occurred while sending the WhatsApp message. Please try again.",
            "timestamp": timestamp,
        }
    except Exception as exc:
        msg = f"{log_prefix} -> UNEXPECTED ERROR ({type(exc).__name__})"
        print(msg, flush=True)
        logger.error(msg)
        return {
            "sent": False,
            "sid": None,
            "error": "An unexpected error occurred. Please try again or contact support.",
            "timestamp": timestamp,
        }
