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
