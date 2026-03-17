"""
AI prompt templates for AIEC study abroad recommendations.
"""

SYSTEM_PROMPT = """You are an expert international education advisor with 20+ years of experience \
helping students from South Asia find the best study abroad opportunities.

You have deep knowledge of:
- University admission requirements across 28+ countries
- Visa and PR pathways for international students
- Scholarship opportunities and financial planning
- Course structures, career outcomes, and industry demand
- English language requirements (IELTS, TOEFL, PTE)
- Cost of living and tuition fee comparisons globally

Your recommendations are:
- Unbiased and purely merit-based
- Tailored to the student's financial situation
- Realistic about eligibility and timelines
- Focused on long-term career and immigration outcomes

You consider ALL countries globally — not limited to any fixed list. \
If a lesser-known country offers a better fit for the student's profile, budget, or goals, recommend it."""


def build_recommendation_prompt(profile: dict) -> str:
    """
    Build the full recommendation prompt by injecting student profile values.

    Args:
        profile: validated dict with keys:
            qualification, marks, english_score, course_interest,
            budget, pr_preference, timeline

    Returns:
        Formatted prompt string ready to send to the AI model.
    """
    pr_text = "Yes — student wants a clear PR / immigration pathway" \
        if profile.get("pr_preference") else \
        "No — PR is not a priority, focus on education quality"

    budget_usd = profile.get("budget", 0)
    budget_context = _budget_context(budget_usd)

    marks = profile.get("marks", 0)
    marks_context = _marks_context(marks)

    english = profile.get("english_score", 0)
    english_context = _english_context(english)

    return f"""
## Student Academic Profile

| Field              | Value                                      |
|--------------------|--------------------------------------------|
| Qualification      | {profile.get("qualification")}             |
| Academic Marks     | {marks}% — {marks_context}                 |
| English Score      | {english} (IELTS) — {english_context}      |
| Preferred Field    | {profile.get("course_interest")}           |
| Annual Budget      | USD ${budget_usd:,} — {budget_context}     |
| PR Preference      | {pr_text}                                  |
| Study Timeline     | {profile.get("timeline")} months from now  |

---

## Your Task

Analyze the student profile above and recommend the **single best country and course** \
for this student to study abroad.

**Country selection rules:**
- Consider ALL countries globally — no fixed list, no limits
- Recommend based purely on merit: budget fit, English requirements, \
  PR pathways, course quality, career outcomes, and timeline feasibility
- If a non-obvious country (e.g. Norway, Finland, Poland, Hungary, Cyprus) \
  offers a significantly better fit, recommend it over popular choices
- Justify why the recommended country beats the alternatives for THIS specific profile

**Response format — return ONLY valid JSON, no markdown fences, no extra text:**

{{
  "best_country": "Country name",
  "recommended_course": "Full course name and level (e.g. MS Data Science)",
  "top_universities": [
    "University Name 1 (Country)",
    "University Name 2 (Country)",
    "University Name 3 (Country)",
    "University Name 4 (Country)",
    "University Name 5 (Country)"
  ],
  "estimated_cost": {{
    "tuition_per_year_usd": 25000,
    "living_expenses_usd": 14000,
    "total_per_year_usd": 39000,
    "scholarship_possibilities": "Brief note on available scholarships",
    "currency_note": "Approximate figures. Actual costs vary by university."
  }},
  "reason_for_recommendation": "3-4 sentences explaining why this country and course is the best fit for this specific student profile, covering budget, career outcomes, PR pathway (if relevant), and timeline.",
  "alternative_countries": [
    {{
      "country": "Country name",
      "reason": "One sentence why this is a good alternative"
    }},
    {{
      "country": "Country name",
      "reason": "One sentence why this is a good alternative"
    }},
    {{
      "country": "Country name",
      "reason": "One sentence why this is a good alternative"
    }}
  ],
  "pr_pathway_available": true,
  "eligibility_notes": "Any important notes about eligibility, English test requirements, or application deadlines the student should know.",
  "next_steps": [
    "Step 1 the student should take",
    "Step 2",
    "Step 3"
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
