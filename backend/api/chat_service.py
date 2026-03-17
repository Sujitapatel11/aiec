"""
Chatbot service for AIEC study abroad counsellor.
Uses OpenAI if key is set, otherwise rule-based conversation flow.
"""
import os
import json

SYSTEM_PROMPT = """You are Aria, a friendly and expert study abroad counsellor at AIEC \
(Aradhya International Education Consultancy).

Your job is to:
1. Warmly greet the student and ask about their education background
2. Gather: qualification, marks/percentage, English score (IELTS/TOEFL), preferred course/field, \
   annual budget (USD), whether they want PR/immigration pathway, and study timeline
3. Once you have enough info, recommend the best country and course for them
4. Offer a free consultation and ask for their name, email, and phone number
5. End with a warm closing message

Rules:
- Be conversational, warm, and encouraging — not robotic
- Ask ONE question at a time
- Keep responses SHORT (2-3 sentences max)
- When recommending, be specific: name the country, course, and 2-3 universities
- After collecting contact info, confirm it and say a counsellor will reach out within 24 hours
- Never ask for all info at once — build rapport naturally

You are NOT a general AI assistant. Only discuss study abroad topics."""


def get_chat_response(messages: list) -> dict:
    """
    Process chat messages and return AI response.
    messages: list of {"role": "user"|"assistant", "content": "..."}
    Returns: {"reply": "...", "collected": {...}, "stage": "..."}
    """
    api_key = os.getenv('OPENAI_API_KEY', '')
    if api_key:
        return _openai_chat(messages, api_key)
    return _rule_based_chat(messages)


def _openai_chat(messages: list, api_key: str) -> dict:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=full_messages,
            temperature=0.8,
            max_tokens=300,
        )
        reply = response.choices[0].message.content.strip()

        # Try to detect if contact info was collected
        collected = _extract_collected(messages)
        stage = _detect_stage(messages, reply)

        return {"reply": reply, "collected": collected, "stage": stage}
    except Exception as e:
        return _rule_based_chat(messages)


def _rule_based_chat(messages: list) -> dict:
    """Simple scripted flow when OpenAI is not available."""
    user_msgs = [m["content"].lower() for m in messages if m["role"] == "user"]
    count = len(user_msgs)
    last = user_msgs[-1] if user_msgs else ""

    flow = [
        (0, "Hi! I'm Aria, your personal study abroad counsellor at AIEC 👋\n\nI'd love to help you find the perfect country and course. To get started — what's your highest qualification? (e.g. 12th grade, Bachelor's, Master's)", "greeting"),
        (1, "Great! And what percentage or GPA did you score? This helps me find universities where you'll have a strong chance of admission.", "qualification"),
        (2, "Got it! Do you have an English test score? (IELTS, TOEFL, or PTE) If not, just say 'not yet' and that's totally fine.", "marks"),
        (3, "Perfect. What field or course are you interested in? For example: Computer Science, Business, Engineering, Nursing, Law...", "english"),
        (4, "Awesome choice! What's your approximate annual budget for tuition + living expenses? (in USD, e.g. $15,000 or $30,000)", "course"),
        (5, "Almost there! Two quick questions:\n1. Are you interested in PR / permanent residency after studies?\n2. When are you planning to start? (e.g. September 2025)", "budget"),
    ]

    if count < len(flow):
        idx, reply, stage = flow[count]
        return {"reply": reply, "collected": {}, "stage": stage}

    # After 6 messages — give recommendation
    if count == len(flow):
        rec = _make_recommendation(user_msgs)
        return {
            "reply": f"Based on everything you've shared, my top recommendation is **{rec['country']}** for **{rec['course']}**! 🎉\n\n{rec['reason']}\n\nWould you like a free consultation with one of our expert counsellors? They can guide you through the full application process.",
            "collected": rec,
            "stage": "recommendation"
        }

    # Offer consultation
    if count == len(flow) + 1:
        return {
            "reply": "Wonderful! To book your free consultation, could I get your full name please?",
            "collected": {},
            "stage": "collect_name"
        }

    if count == len(flow) + 2:
        return {
            "reply": f"Nice to meet you, {last.title()}! What's the best email address to reach you?",
            "collected": {"name": last},
            "stage": "collect_email"
        }

    if count == len(flow) + 3:
        return {
            "reply": "And your WhatsApp / phone number?",
            "collected": {"email": last},
            "stage": "collect_phone"
        }

    if count == len(flow) + 4:
        return {
            "reply": "You're all set! 🎊 One of our counsellors will reach out within 24 hours to discuss your application plan. In the meantime, feel free to take our full AI assessment for a detailed report!",
            "collected": {"phone": last},
            "stage": "done"
        }

    return {
        "reply": "Is there anything else I can help you with about studying abroad?",
        "collected": {},
        "stage": "idle"
    }


def _make_recommendation(user_msgs: list) -> dict:
    """Simple rule-based recommendation from collected answers."""
    budget_msg = user_msgs[4] if len(user_msgs) > 4 else ""
    course_msg = user_msgs[3] if len(user_msgs) > 3 else ""

    # Budget detection
    high_budget = any(x in budget_msg for x in ['50', '60', '70', '80', '100'])
    low_budget  = any(x in budget_msg for x in ['5', '8', '10', '12', '15'])

    # Course detection
    tech    = any(x in course_msg for x in ['computer', 'software', 'data', 'it', 'tech', 'engineering'])
    business = any(x in course_msg for x in ['business', 'mba', 'finance', 'management', 'marketing'])
    health  = any(x in course_msg for x in ['nursing', 'health', 'medical', 'pharmacy'])

    if high_budget:
        country = "USA"
        unis = "MIT, Stanford, Carnegie Mellon"
    elif low_budget:
        country = "Germany"
        unis = "TU Munich, RWTH Aachen, University of Stuttgart"
    else:
        country = "Canada"
        unis = "University of Toronto, UBC, McMaster University"

    if tech:
        course = "MS Computer Science / Data Science"
    elif business:
        course = "MBA / MSc Management"
    elif health:
        course = "MSc Nursing / Health Sciences"
    else:
        course = "MSc in your chosen field"

    return {
        "country": country,
        "course": course,
        "universities": unis,
        "reason": f"{country} offers excellent programs in {course} with strong career outcomes and post-study work options. Top universities include {unis}."
    }


def _extract_collected(messages: list) -> dict:
    """Try to extract contact info from recent messages."""
    collected = {}
    user_msgs = [m["content"] for m in messages if m["role"] == "user"]
    # Very basic extraction — OpenAI handles this naturally
    for msg in user_msgs:
        if "@" in msg and "." in msg:
            collected["email"] = msg.strip()
        if any(c.isdigit() for c in msg) and len([c for c in msg if c.isdigit()]) >= 8:
            collected["phone"] = msg.strip()
    return collected


def _detect_stage(messages: list, reply: str) -> str:
    reply_lower = reply.lower()
    if "name" in reply_lower and "?" in reply_lower:
        return "collect_name"
    if "email" in reply_lower and "?" in reply_lower:
        return "collect_email"
    if "phone" in reply_lower or "whatsapp" in reply_lower:
        return "collect_phone"
    if "counsellor will" in reply_lower or "reach out" in reply_lower:
        return "done"
    if "recommend" in reply_lower:
        return "recommendation"
    return "conversation"
