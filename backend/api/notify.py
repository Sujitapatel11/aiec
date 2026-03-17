"""
Notification service — sends email alert when a new lead is captured.
Uses Gmail SMTP. Configure EMAIL_* vars in .env
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_lead_notification(lead_data: dict):
    """
    Send email notification to admin when a new lead is captured.
    Runs silently — never raises, never blocks the API response.
    """
    try:
        _send_email(lead_data)
    except Exception:
        pass  # Never block the API response


def _send_email(lead: dict):
    smtp_user = os.getenv('EMAIL_HOST_USER', '')
    smtp_pass = os.getenv('EMAIL_HOST_PASSWORD', '')
    to_email  = os.getenv('NOTIFY_EMAIL', 'sujitapatel787@gmail.com')

    if not smtp_user or not smtp_pass:
        return  # Email not configured

    name    = lead.get('name', 'Unknown')
    email   = lead.get('email', '—')
    phone   = lead.get('phone', '—')
    course  = lead.get('course_interest', '—')
    country = lead.get('recommended_country', '—')
    budget  = lead.get('budget', '—')
    source  = lead.get('source', '—')
    wa_num  = os.getenv('WHATSAPP_NUMBER', '918733903147')

    wa_msg = (
        f"New Lead from AIEC Website%0A"
        f"Name: {name}%0A"
        f"Phone: {phone}%0A"
        f"Email: {email}%0A"
        f"Course: {course}%0A"
        f"Country: {country}"
    )
    wa_link = f"https://wa.me/{phone.replace('+','').replace(' ','')}?text={wa_msg}" if phone and phone != '—' else ''

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px;">
      <div style="background:linear-gradient(135deg,#1e40af,#1d4ed8);padding:20px 24px;border-radius:8px;margin-bottom:20px;">
        <h2 style="color:white;margin:0;font-size:20px;">🎯 New Lead — AIEC Website</h2>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Source: {source}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr style="background:#eff6ff;">
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;width:35%;">👤 Name</td>
          <td style="padding:12px 16px;color:#111827;">{name}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;">📧 Email</td>
          <td style="padding:12px 16px;color:#111827;">{email}</td>
        </tr>
        <tr style="background:#eff6ff;">
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;">📱 Phone</td>
          <td style="padding:12px 16px;color:#111827;">{phone}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;">🎓 Course</td>
          <td style="padding:12px 16px;color:#111827;">{course}</td>
        </tr>
        <tr style="background:#eff6ff;">
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;">🌍 Rec. Country</td>
          <td style="padding:12px 16px;color:#111827;">{country}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-weight:bold;color:#1e40af;">💰 Budget</td>
          <td style="padding:12px 16px;color:#111827;">${budget}/yr</td>
        </tr>
      </table>

      {"<div style='margin-top:20px;text-align:center;'><a href='" + wa_link + "' style='background:#25d366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;'>💬 Reply on WhatsApp</a></div>" if wa_link else ""}

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
        AIEC — Aradhya International Education Consultancy
      </p>
    </div>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"🎯 New Lead: {name} — {course or 'Study Abroad'}"
    msg['From']    = smtp_user
    msg['To']      = to_email
    msg.attach(MIMEText(html, 'html'))

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
