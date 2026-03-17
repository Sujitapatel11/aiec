"""
AI recommendation service using OpenAI.
Falls back to rule-based recommendations if API key is not set.
"""
import json
import os


def get_ai_recommendations(questionnaire_data: dict) -> dict:
    """Return country and course recommendations based on questionnaire."""
    api_key = os.getenv('OPENAI_API_KEY', '')

    if api_key:
        return _openai_recommendations(questionnaire_data, api_key)
    return _rule_based_recommendations(questionnaire_data)


def _openai_recommendations(data: dict, api_key: str) -> dict:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        prompt = f"""
You are a study abroad advisor. Based on the student profile below, recommend:
1. Top 3 countries to study in (with reasons)
2. Top 3 courses/programs (with university suggestions)

Student Profile:
- Education Level: {data.get('education_level')}
- Field of Interest: {data.get('field_of_interest')}
- Budget Range: {data.get('budget_range')}
- English Proficiency: {data.get('english_proficiency')}
- Work Experience: {data.get('work_experience_years')} years
- Target Intake: {data.get('target_intake')}
- Preferred Countries: {data.get('preferred_countries', [])}

Respond ONLY with valid JSON in this format:
{{
  "countries": [
    {{"name": "...", "reason": "...", "avg_cost": "..."}}
  ],
  "courses": [
    {{"name": "...", "university": "...", "country": "...", "reason": "..."}}
  ]
}}
"""
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        return json.loads(response.choices[0].message.content)
    except Exception:
        return _rule_based_recommendations(data)


def _rule_based_recommendations(data: dict) -> dict:
    """Simple rule-based fallback recommendations."""
    budget = data.get('budget_range', '').lower()
    field = data.get('field_of_interest', '').lower()

    country_map = {
        'low': [
            {"name": "Germany", "reason": "Low/no tuition fees at public universities", "avg_cost": "$5,000–$15,000/yr"},
            {"name": "Canada", "reason": "Affordable with post-study work options", "avg_cost": "$15,000–$25,000/yr"},
            {"name": "Malaysia", "reason": "Very affordable with quality education", "avg_cost": "$5,000–$10,000/yr"},
        ],
        'medium': [
            {"name": "Canada", "reason": "Great ROI with PR pathways", "avg_cost": "$20,000–$35,000/yr"},
            {"name": "Australia", "reason": "Strong job market and lifestyle", "avg_cost": "$25,000–$40,000/yr"},
            {"name": "UK", "reason": "1-year master's programs save time and money", "avg_cost": "$20,000–$35,000/yr"},
        ],
        'high': [
            {"name": "USA", "reason": "World-class universities and research", "avg_cost": "$40,000–$70,000/yr"},
            {"name": "UK", "reason": "Prestigious institutions and global network", "avg_cost": "$30,000–$50,000/yr"},
            {"name": "Australia", "reason": "Top QS-ranked universities", "avg_cost": "$30,000–$50,000/yr"},
        ],
    }

    course_map = {
        'engineering': [
            {"name": "MS Computer Science", "university": "University of Toronto", "country": "Canada", "reason": "Top-ranked CS program"},
            {"name": "MEng Electrical Engineering", "university": "TU Munich", "country": "Germany", "reason": "Free tuition, world-class faculty"},
            {"name": "MS Data Science", "university": "University of Melbourne", "country": "Australia", "reason": "Industry connections"},
        ],
        'business': [
            {"name": "MBA", "university": "Rotman School of Management", "country": "Canada", "reason": "Strong alumni network"},
            {"name": "MSc Finance", "university": "University of Manchester", "country": "UK", "reason": "CFA-aligned curriculum"},
            {"name": "MBA", "university": "Melbourne Business School", "country": "Australia", "reason": "Asia-Pacific focus"},
        ],
        'default': [
            {"name": "MSc International Business", "university": "University of Edinburgh", "country": "UK", "reason": "Globally recognized"},
            {"name": "Master of Management", "university": "McGill University", "country": "Canada", "reason": "Diverse cohort"},
            {"name": "MS Applied Data Science", "university": "University of Sydney", "country": "Australia", "reason": "Industry partnerships"},
        ],
    }

    budget_key = 'medium'
    if any(x in budget for x in ['low', 'under 20', 'less than 20', '10k', '15k']):
        budget_key = 'low'
    elif any(x in budget for x in ['high', 'above 40', 'more than 40', '50k', '60k']):
        budget_key = 'high'

    course_key = 'default'
    for key in course_map:
        if key in field:
            course_key = key
            break

    return {
        "countries": country_map[budget_key],
        "courses": course_map[course_key],
    }
