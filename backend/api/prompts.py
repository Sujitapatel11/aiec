"""
AI prompt templates for AIEC study abroad recommendations.
Advanced university matching engine with scoring logic.
"""

SYSTEM_PROMPT = """You are an AI-powered study abroad matching engine and expert counsellor.

Your task:
Match students with suitable universities globally using structured evaluation and provide realistic admission chances.

You have deep knowledge of:
- University admission requirements across 50+ countries
- Visa and PR pathways for international students
- Scholarship opportunities and financial planning
- Course structures, career outcomes, and industry demand
- English language requirements (IELTS, TOEFL, PTE)
- Cost of living and tuition fee comparisons globally

MATCHING LOGIC (STRICT):
For each university evaluate:
1. Academic Match Score (0–40): marks vs requirement
2. English Match Score (0–25): IELTS vs requirement
3. Budget Fit Score (0–20): total cost vs student budget
4. Acceptance Probability Score (0–15): based on acceptance rate and ranking tier

TOTAL SCORE = 100
80–100 → Safe (High chance)
60–79 → Moderate
40–59 → Ambitious
Below 40 → Risky

IMPORTANT RULES:
- Do NOT guarantee admission
- Do NOT invent fake universities
- Keep results realistic and useful
- Prefer globally recognized education systems
- Consider ALL countries globally — no fixed list

TONE: Professional, analytical, and realistic like an expert consultant."""


def build_recommendation_prompt(profile: dict) -> str:
    pr_text = "Yes — student wants a clear PR / immigration pathway" \
        if profile.get("pr_preference") else \
        "No — PR is not a priority, focus on education quality"

    budget_usd = profile.get("budget", 0)
    marks = profile.get("marks", 0)
    english = profile.get("english_score", 0)

    return f"""
## STUDENT PROFILE

| Field           | Value                                     |
|-----------------|-------------------------------------------|
| Qualification   | {profile.get("qualification")}            |
| Academic Marks  | {marks}% — {_marks_context(marks)}        |
| English Score   | {english} IELTS — {_english_context(english)} |
| Course Interest | {profile.get("course_interest")}          |
| Annual Budget   | USD ${budget_usd:,} — {_budget_context(budget_usd)} |
| PR Preference   | {pr_text}                                 |
| Study Timeline  | {profile.get("timeline")} months from now |

---

## YOUR TASK

Using the matching scoring logic (Academic 0–40, English 0–25, Budget 0–20, Acceptance 0–15),
evaluate universities globally and return a structured recommendation.

**Response format — return ONLY valid JSON, no markdown fences, no extra text:**

{{
  "best_country": "Country name",
  "recommended_course": "Full course name and level (e.g. MS Data Science)",
  "university_matches": {{
    "safe_options": [
      {{
        "name": "University Name",
        "country": "Country",
        "admission_chance_percent": 85,
        "tuition_usd": 20000,
        "living_cost_usd": 12000,
        "match_reason": "Why this is a safe match for this student"
      }}
    ],
    "moderate_options": [
      {{
        "name": "University Name",
        "country": "Country",
        "admission_chance_percent": 65,
        "tuition_usd": 28000,
        "living_cost_usd": 14000,
        "match_reason": "Why this is a moderate match"
      }}
    ],
    "ambitious_options": [
      {{
        "name": "University Name",
        "country": "Country",
        "admission_chance_percent": 45,
        "tuition_usd": 45000,
        "living_cost_usd": 18000,
        "match_reason": "Why this is ambitious but worth trying"
      }}
    ]
  }},
  "best_country_reason": "Why this country has the most strong matches for this profile",
  "profile_analysis": {{
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "risk_factors": ["Risk 1", "Risk 2"]
  }},
  "strategy_to_improve": {{
    "ielts": "IELTS improvement advice",
    "university_targeting": "Better targeting advice",
    "financial_preparation": "Financial advice",
    "sop_improvement": "SOP/application advice"
  }},
  "estimated_cost": {{
    "tuition_per_year_usd": 25000,
    "living_expenses_usd": 14000,
    "total_per_year_usd": 39000,
    "scholarship_possibilities": "Brief note on available scholarships",
    "currency_note": "Approximate figures. Actual costs vary by university."
  }},
  "pr_pathway_available": true,
  "eligibility_notes": "Important notes about eligibility, English requirements, or deadlines",
  "next_steps": [
    "Step 1 the student should take",
    "Step 2",
    "Step 3"
  ],
  "alternative_countries": [
    {{"country": "Country name", "reason": "One sentence why this is a good alternative"}},
    {{"country": "Country name", "reason": "One sentence why this is a good alternative"}}
  ]
}}
"""


# ── Context helpers ────────────────────────────────────────────────────────

def _budget_context(budget_usd: int) -> str:
    if budget_usd >= 60000:
        return "High budget — USA, Switzerland, top UK universities feasible"
    elif budget_usd >= 35000:
        return "Medium-high — Australia, Canada, UK, Ireland well within range"
    elif budget_usd >= 20000:
        return "Medium — Canada, Ireland, Netherlands, New Zealand are good fits"
    elif budget_usd >= 12000:
        return "Moderate — Germany, Nordic countries, Eastern Europe recommended"
    elif budget_usd >= 6000:
        return "Budget-conscious — Germany (free tuition), Norway, Poland, Malaysia"
    else:
        return "Very limited — focus on fully-funded scholarships or free-tuition countries"


def _marks_context(marks: float) -> str:
    if marks >= 85:
        return "Excellent — eligible for top-ranked universities and merit scholarships"
    elif marks >= 70:
        return "Good — eligible for most universities, some scholarships available"
    elif marks >= 55:
        return "Average — eligible for mid-ranked universities, conditional offers possible"
    elif marks >= 45:
        return "Below average — foundation programs or pathway courses may be required"
    else:
        return "Weak — bridging/foundation programs strongly recommended"


def _english_context(score: float) -> str:
    if score == 0:
        return "No test taken — student needs to appear for IELTS/TOEFL/PTE"
    elif score >= 8.0:
        return "Outstanding — eligible for all universities worldwide"
    elif score >= 7.0:
        return "Strong — eligible for top-ranked universities including Oxbridge, Ivy League"
    elif score >= 6.5:
        return "Good — eligible for most universities in UK, USA, Australia, Canada"
    elif score >= 6.0:
        return "Acceptable — eligible for most universities in Canada, Australia, Ireland"
    elif score >= 5.5:
        return "Borderline — eligible for some universities, conditional offers likely"
    else:
        return "Low — English preparation course recommended before applying"
