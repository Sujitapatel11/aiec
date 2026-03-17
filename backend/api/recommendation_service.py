"""
AI recommendation service for the /api/recommend/ endpoint.
Supports 25+ study destinations with rule-based scoring + OpenAI fallback.
"""
import json
import os
from .prompts import SYSTEM_PROMPT, build_recommendation_prompt

# ── Country Knowledge Base (25+ countries) ────────────────────────────────

COUNTRY_DB = {
    "Canada": {
        "pr_friendly": True, "avg_cost_usd": 25000, "english_min": 6.0,
        "living_usd": 14000, "timeline_months": 9,
        "strengths": ["PR pathways (Express Entry)", "3-yr post-study work permit", "Multicultural society", "Safe cities"],
        "top_universities": ["University of Toronto", "UBC", "McGill University", "University of Waterloo", "McMaster University"],
        "regions": ["North America"], "language": "English",
    },
    "Australia": {
        "pr_friendly": True, "avg_cost_usd": 32000, "english_min": 6.0,
        "living_usd": 16000, "timeline_months": 8,
        "strengths": ["2–4 yr post-study work visa", "High quality of life", "Strong job market", "8 Group of Eight universities"],
        "top_universities": ["University of Melbourne", "ANU", "University of Sydney", "Monash University", "UNSW Sydney"],
        "regions": ["Oceania"], "language": "English",
    },
    "United Kingdom": {
        "pr_friendly": False, "avg_cost_usd": 28000, "english_min": 6.5,
        "living_usd": 15000, "timeline_months": 7,
        "strengths": ["1-year master's programs", "Graduate Route visa (2 yrs)", "Russell Group universities", "Global prestige"],
        "top_universities": ["University of Manchester", "University of Edinburgh", "King's College London", "University of Warwick", "University of Bristol"],
        "regions": ["Europe"], "language": "English",
    },
    "USA": {
        "pr_friendly": False, "avg_cost_usd": 50000, "english_min": 6.5,
        "living_usd": 20000, "timeline_months": 12,
        "strengths": ["World-class research", "STEM OPT (3 yrs)", "Silicon Valley access", "Ivy League institutions"],
        "top_universities": ["MIT", "Stanford University", "Carnegie Mellon", "University of Illinois Urbana-Champaign", "Purdue University"],
        "regions": ["North America"], "language": "English",
    },
    "Germany": {
        "pr_friendly": True, "avg_cost_usd": 5000, "english_min": 0,
        "living_usd": 11000, "timeline_months": 10,
        "strengths": ["Free/low tuition at public universities", "Strong engineering industry", "EU Blue Card PR pathway", "Central Europe location"],
        "top_universities": ["TU Munich", "RWTH Aachen", "Heidelberg University", "Humboldt University Berlin", "University of Hamburg"],
        "regions": ["Europe"], "language": "German/English",
    },
    "Ireland": {
        "pr_friendly": False, "avg_cost_usd": 22000, "english_min": 6.0,
        "living_usd": 13000, "timeline_months": 8,
        "strengths": ["EU tech hub (Google, Meta, Apple)", "2-yr stay-back visa", "English-speaking EU country", "Celtic Tiger economy"],
        "top_universities": ["Trinity College Dublin", "University College Dublin", "University of Galway", "University of Limerick"],
        "regions": ["Europe"], "language": "English",
    },
    "New Zealand": {
        "pr_friendly": True, "avg_cost_usd": 20000, "english_min": 6.0,
        "living_usd": 12000, "timeline_months": 8,
        "strengths": ["Safe and welcoming", "3-yr post-study work visa", "Clear PR pathway", "Stunning natural environment"],
        "top_universities": ["University of Auckland", "Victoria University of Wellington", "University of Otago", "University of Canterbury"],
        "regions": ["Oceania"], "language": "English",
    },
    "Netherlands": {
        "pr_friendly": True, "avg_cost_usd": 15000, "english_min": 6.0,
        "living_usd": 12000, "timeline_months": 9,
        "strengths": ["Many English-taught programs", "Orientation year visa", "Gateway to Europe", "High quality of life"],
        "top_universities": ["Delft University of Technology", "University of Amsterdam", "Eindhoven University", "Leiden University", "Utrecht University"],
        "regions": ["Europe"], "language": "Dutch/English",
    },
    "France": {
        "pr_friendly": True, "avg_cost_usd": 10000, "english_min": 5.5,
        "living_usd": 13000, "timeline_months": 10,
        "strengths": ["Low tuition at public universities", "Post-study work visa (2 yrs)", "Fashion, arts & business hub", "Erasmus opportunities"],
        "top_universities": ["HEC Paris", "Sciences Po", "Sorbonne University", "École Polytechnique", "INSEAD"],
        "regions": ["Europe"], "language": "French/English",
    },
    "Sweden": {
        "pr_friendly": True, "avg_cost_usd": 14000, "english_min": 6.0,
        "living_usd": 13000, "timeline_months": 9,
        "strengths": ["Innovation & sustainability focus", "Work permit after graduation", "High standard of living", "Strong tech industry"],
        "top_universities": ["KTH Royal Institute of Technology", "Lund University", "Stockholm University", "Uppsala University"],
        "regions": ["Europe"], "language": "Swedish/English",
    },
    "Denmark": {
        "pr_friendly": True, "avg_cost_usd": 13000, "english_min": 6.0,
        "living_usd": 14000, "timeline_months": 9,
        "strengths": ["Happiest country in the world", "Strong work-life balance", "Green Card scheme", "Design & engineering excellence"],
        "top_universities": ["University of Copenhagen", "Technical University of Denmark", "Aarhus University"],
        "regions": ["Europe"], "language": "Danish/English",
    },
    "Norway": {
        "pr_friendly": True, "avg_cost_usd": 3000, "english_min": 5.5,
        "living_usd": 18000, "timeline_months": 9,
        "strengths": ["Free tuition at public universities", "High salaries", "Oil & gas industry", "Stunning nature"],
        "top_universities": ["University of Oslo", "Norwegian University of Science and Technology (NTNU)", "University of Bergen"],
        "regions": ["Europe"], "language": "Norwegian/English",
    },
    "Finland": {
        "pr_friendly": True, "avg_cost_usd": 10000, "english_min": 5.5,
        "living_usd": 12000, "timeline_months": 9,
        "strengths": ["World's best education system", "Post-study work permit (2 yrs)", "Nokia & tech ecosystem", "Safe and clean"],
        "top_universities": ["University of Helsinki", "Aalto University", "University of Tampere"],
        "regions": ["Europe"], "language": "Finnish/English",
    },
    "Switzerland": {
        "pr_friendly": False, "avg_cost_usd": 25000, "english_min": 6.5,
        "living_usd": 25000, "timeline_months": 10,
        "strengths": ["World's top-ranked universities", "Banking & finance hub", "Multilingual environment", "High salaries"],
        "top_universities": ["ETH Zurich", "EPFL", "University of Zurich", "University of Geneva"],
        "regions": ["Europe"], "language": "German/French/English",
    },
    "Singapore": {
        "pr_friendly": True, "avg_cost_usd": 25000, "english_min": 6.0,
        "living_usd": 18000, "timeline_months": 8,
        "strengths": ["Asia's financial hub", "PR pathway available", "English-speaking", "Gateway to Southeast Asia"],
        "top_universities": ["National University of Singapore (NUS)", "Nanyang Technological University (NTU)", "Singapore Management University"],
        "regions": ["Asia"], "language": "English",
    },
    "Japan": {
        "pr_friendly": True, "avg_cost_usd": 8000, "english_min": 5.5,
        "living_usd": 10000, "timeline_months": 10,
        "strengths": ["Low tuition", "Technology & robotics leader", "Rich culture", "Safe country", "PR after 10 yrs"],
        "top_universities": ["University of Tokyo", "Kyoto University", "Osaka University", "Waseda University"],
        "regions": ["Asia"], "language": "Japanese/English",
    },
    "South Korea": {
        "pr_friendly": True, "avg_cost_usd": 7000, "english_min": 5.5,
        "living_usd": 9000, "timeline_months": 9,
        "strengths": ["K-tech industry (Samsung, LG, Hyundai)", "Low cost of living", "Many scholarships (KGSP)", "Fast internet & modern cities"],
        "top_universities": ["Seoul National University", "KAIST", "Yonsei University", "Korea University"],
        "regions": ["Asia"], "language": "Korean/English",
    },
    "China": {
        "pr_friendly": False, "avg_cost_usd": 6000, "english_min": 5.0,
        "living_usd": 7000, "timeline_months": 8,
        "strengths": ["Very low tuition", "Government scholarships (CSC)", "World's 2nd largest economy", "Mandarin advantage"],
        "top_universities": ["Tsinghua University", "Peking University", "Fudan University", "Zhejiang University"],
        "regions": ["Asia"], "language": "Chinese/English",
    },
    "Malaysia": {
        "pr_friendly": False, "avg_cost_usd": 7000, "english_min": 5.5,
        "living_usd": 6000, "timeline_months": 6,
        "strengths": ["Very affordable", "English-medium universities", "Twinning programs with UK/Australia", "Multicultural"],
        "top_universities": ["University of Malaya", "Universiti Putra Malaysia", "Monash University Malaysia", "Taylor's University"],
        "regions": ["Asia"], "language": "English/Malay",
    },
    "Italy": {
        "pr_friendly": True, "avg_cost_usd": 4000, "english_min": 5.5,
        "living_usd": 10000, "timeline_months": 10,
        "strengths": ["Very low tuition", "Fashion, design & arts hub", "EU residency pathway", "Rich history & culture"],
        "top_universities": ["Politecnico di Milano", "University of Bologna", "Sapienza University of Rome", "Bocconi University"],
        "regions": ["Europe"], "language": "Italian/English",
    },
    "Spain": {
        "pr_friendly": True, "avg_cost_usd": 8000, "english_min": 5.5,
        "living_usd": 10000, "timeline_months": 9,
        "strengths": ["Affordable living", "EU residency pathway", "Spanish language advantage", "Tourism & hospitality industry"],
        "top_universities": ["University of Barcelona", "Autonomous University of Madrid", "IE Business School", "ESADE"],
        "regions": ["Europe"], "language": "Spanish/English",
    },
    "Portugal": {
        "pr_friendly": True, "avg_cost_usd": 7000, "english_min": 5.5,
        "living_usd": 9000, "timeline_months": 9,
        "strengths": ["Golden Visa program", "Low cost of living", "EU residency", "Growing tech startup scene"],
        "top_universities": ["University of Lisbon", "University of Porto", "Nova School of Business and Economics"],
        "regions": ["Europe"], "language": "Portuguese/English",
    },
    "Poland": {
        "pr_friendly": True, "avg_cost_usd": 4000, "english_min": 5.0,
        "living_usd": 7000, "timeline_months": 8,
        "strengths": ["Very affordable EU country", "Growing economy", "EU residency pathway", "Many English programs"],
        "top_universities": ["University of Warsaw", "Jagiellonian University", "Warsaw University of Technology"],
        "regions": ["Europe"], "language": "Polish/English",
    },
    "Czech Republic": {
        "pr_friendly": True, "avg_cost_usd": 4000, "english_min": 5.0,
        "living_usd": 8000, "timeline_months": 8,
        "strengths": ["Free tuition in Czech language", "Affordable English programs", "Central Europe location", "EU residency"],
        "top_universities": ["Charles University", "Czech Technical University", "Masaryk University"],
        "regions": ["Europe"], "language": "Czech/English",
    },
    "Hungary": {
        "pr_friendly": True, "avg_cost_usd": 5000, "english_min": 5.0,
        "living_usd": 7000, "timeline_months": 8,
        "strengths": ["Stipendium Hungaricum scholarships", "Affordable EU education", "Central Europe hub", "Strong medical programs"],
        "top_universities": ["University of Budapest", "Semmelweis University", "Budapest University of Technology"],
        "regions": ["Europe"], "language": "Hungarian/English",
    },
    "UAE": {
        "pr_friendly": False, "avg_cost_usd": 20000, "english_min": 6.0,
        "living_usd": 18000, "timeline_months": 6,
        "strengths": ["Tax-free income", "Global business hub", "Fast-growing economy", "No student loan needed for some"],
        "top_universities": ["University of Dubai", "American University of Sharjah", "Heriot-Watt University Dubai", "Middlesex University Dubai"],
        "regions": ["Middle East"], "language": "English/Arabic",
    },
    "Cyprus": {
        "pr_friendly": True, "avg_cost_usd": 8000, "english_min": 5.5,
        "living_usd": 8000, "timeline_months": 7,
        "strengths": ["EU member state", "Affordable English-medium programs", "Mediterranean lifestyle", "PR pathway"],
        "top_universities": ["University of Cyprus", "Cyprus International University", "European University Cyprus"],
        "regions": ["Europe"], "language": "English/Greek",
    },
    "Austria": {
        "pr_friendly": True, "avg_cost_usd": 8000, "english_min": 6.0,
        "living_usd": 12000, "timeline_months": 9,
        "strengths": ["Low tuition at public universities", "EU Red-White-Red Card", "Central Europe location", "High quality of life"],
        "top_universities": ["University of Vienna", "Vienna University of Technology", "WU Vienna"],
        "regions": ["Europe"], "language": "German/English",
    },
    "Belgium": {
        "pr_friendly": True, "avg_cost_usd": 6000, "english_min": 5.5,
        "living_usd": 12000, "timeline_months": 9,
        "strengths": ["EU headquarters (NATO, EU Commission)", "Affordable tuition", "Multilingual environment", "EU residency"],
        "top_universities": ["KU Leuven", "Ghent University", "Université Libre de Bruxelles"],
        "regions": ["Europe"], "language": "Dutch/French/English",
    },
}

# ── Course Knowledge Base ──────────────────────────────────────────────────

COURSE_DB = {
    "computer science": {
        "course": "MS Computer Science / Software Engineering",
        "by_country": {
            "Canada": {"university": "University of Waterloo", "cost_usd": 24000},
            "Australia": {"university": "University of Melbourne", "cost_usd": 35000},
            "United Kingdom": {"university": "University of Edinburgh", "cost_usd": 28000},
            "USA": {"university": "Carnegie Mellon University", "cost_usd": 55000},
            "Germany": {"university": "TU Munich", "cost_usd": 1500},
            "Ireland": {"university": "Trinity College Dublin", "cost_usd": 22000},
            "Netherlands": {"university": "Delft University of Technology", "cost_usd": 16000},
            "Sweden": {"university": "KTH Royal Institute of Technology", "cost_usd": 14000},
            "Singapore": {"university": "NUS", "cost_usd": 26000},
            "South Korea": {"university": "KAIST", "cost_usd": 7000},
            "Japan": {"university": "University of Tokyo", "cost_usd": 8000},
            "Switzerland": {"university": "ETH Zurich", "cost_usd": 1500},
            "France": {"university": "École Polytechnique", "cost_usd": 12000},
            "Italy": {"university": "Politecnico di Milano", "cost_usd": 4000},
            "UAE": {"university": "American University of Sharjah", "cost_usd": 20000},
        },
    },
    "data science": {
        "course": "MS Data Science / Artificial Intelligence",
        "by_country": {
            "Canada": {"university": "University of Toronto", "cost_usd": 26000},
            "Australia": {"university": "Monash University", "cost_usd": 33000},
            "United Kingdom": {"university": "University of Manchester", "cost_usd": 27000},
            "USA": {"university": "University of Illinois Urbana-Champaign", "cost_usd": 48000},
            "Germany": {"university": "RWTH Aachen", "cost_usd": 2000},
            "Ireland": {"university": "University College Dublin", "cost_usd": 20000},
            "Netherlands": {"university": "University of Amsterdam", "cost_usd": 15000},
            "Sweden": {"university": "Stockholm University", "cost_usd": 13000},
            "Singapore": {"university": "NTU", "cost_usd": 25000},
            "France": {"university": "HEC Paris", "cost_usd": 18000},
            "Switzerland": {"university": "EPFL", "cost_usd": 2000},
            "Finland": {"university": "Aalto University", "cost_usd": 10000},
            "Denmark": {"university": "Technical University of Denmark", "cost_usd": 13000},
        },
    },
    "business": {
        "course": "MBA / MSc International Business",
        "by_country": {
            "Canada": {"university": "Rotman School of Management", "cost_usd": 40000},
            "Australia": {"university": "Melbourne Business School", "cost_usd": 42000},
            "United Kingdom": {"university": "University of Warwick", "cost_usd": 35000},
            "USA": {"university": "MIT Sloan", "cost_usd": 75000},
            "Germany": {"university": "ESMT Berlin", "cost_usd": 30000},
            "Ireland": {"university": "UCD Smurfit Business School", "cost_usd": 25000},
            "France": {"university": "INSEAD", "cost_usd": 45000},
            "Switzerland": {"university": "IMD Business School", "cost_usd": 50000},
            "Netherlands": {"university": "Rotterdam School of Management", "cost_usd": 22000},
            "Spain": {"university": "ESADE", "cost_usd": 30000},
            "Singapore": {"university": "Singapore Management University", "cost_usd": 28000},
            "UAE": {"university": "American University of Sharjah", "cost_usd": 22000},
            "Italy": {"university": "Bocconi University", "cost_usd": 14000},
        },
    },
    "engineering": {
        "course": "MEng / MS Engineering",
        "by_country": {
            "Canada": {"university": "University of British Columbia", "cost_usd": 22000},
            "Australia": {"university": "University of Sydney", "cost_usd": 34000},
            "United Kingdom": {"university": "Imperial College London", "cost_usd": 38000},
            "USA": {"university": "Georgia Tech", "cost_usd": 30000},
            "Germany": {"university": "RWTH Aachen", "cost_usd": 1500},
            "Ireland": {"university": "University of Galway", "cost_usd": 18000},
            "Netherlands": {"university": "Eindhoven University", "cost_usd": 14000},
            "Sweden": {"university": "Chalmers University", "cost_usd": 14000},
            "Switzerland": {"university": "ETH Zurich", "cost_usd": 1500},
            "Japan": {"university": "Osaka University", "cost_usd": 8000},
            "South Korea": {"university": "KAIST", "cost_usd": 6000},
            "Norway": {"university": "NTNU", "cost_usd": 3000},
            "Finland": {"university": "Aalto University", "cost_usd": 10000},
            "Italy": {"university": "Politecnico di Milano", "cost_usd": 4000},
            "Belgium": {"university": "KU Leuven", "cost_usd": 6000},
        },
    },
    "medicine": {
        "course": "MBBS / MD / MSc Public Health",
        "by_country": {
            "Canada": {"university": "University of Toronto", "cost_usd": 45000},
            "Australia": {"university": "University of Melbourne", "cost_usd": 50000},
            "United Kingdom": {"university": "King's College London", "cost_usd": 42000},
            "USA": {"university": "Johns Hopkins University", "cost_usd": 60000},
            "Germany": {"university": "Heidelberg University", "cost_usd": 3000},
            "Ireland": {"university": "University College Dublin", "cost_usd": 35000},
            "Hungary": {"university": "Semmelweis University", "cost_usd": 12000},
            "Czech Republic": {"university": "Charles University", "cost_usd": 10000},
            "Poland": {"university": "Jagiellonian University", "cost_usd": 8000},
            "China": {"university": "Peking University", "cost_usd": 6000},
            "Malaysia": {"university": "University of Malaya", "cost_usd": 8000},
            "Cyprus": {"university": "European University Cyprus", "cost_usd": 10000},
        },
    },
    "law": {
        "course": "LLM / Bachelor of Laws",
        "by_country": {
            "United Kingdom": {"university": "University of Oxford", "cost_usd": 35000},
            "USA": {"university": "Harvard Law School", "cost_usd": 65000},
            "Australia": {"university": "University of Melbourne", "cost_usd": 32000},
            "Canada": {"university": "University of Toronto", "cost_usd": 28000},
            "Netherlands": {"university": "Leiden University", "cost_usd": 15000},
            "Germany": {"university": "Humboldt University Berlin", "cost_usd": 2000},
            "France": {"university": "Sciences Po", "cost_usd": 14000},
            "Singapore": {"university": "NUS", "cost_usd": 24000},
            "Ireland": {"university": "Trinity College Dublin", "cost_usd": 20000},
        },
    },
    "architecture": {
        "course": "Master of Architecture / Urban Design",
        "by_country": {
            "United Kingdom": {"university": "Bartlett School of Architecture (UCL)", "cost_usd": 32000},
            "USA": {"university": "Harvard GSD", "cost_usd": 55000},
            "Netherlands": {"university": "Delft University of Technology", "cost_usd": 16000},
            "Italy": {"university": "Politecnico di Milano", "cost_usd": 4000},
            "Germany": {"university": "TU Berlin", "cost_usd": 1500},
            "Australia": {"university": "University of Melbourne", "cost_usd": 34000},
            "Canada": {"university": "University of Toronto", "cost_usd": 26000},
            "Spain": {"university": "IE School of Architecture", "cost_usd": 22000},
        },
    },
    "psychology": {
        "course": "MSc Psychology / Clinical Psychology",
        "by_country": {
            "United Kingdom": {"university": "University of Edinburgh", "cost_usd": 26000},
            "Australia": {"university": "University of Queensland", "cost_usd": 30000},
            "Canada": {"university": "McGill University", "cost_usd": 22000},
            "USA": {"university": "University of Michigan", "cost_usd": 40000},
            "Netherlands": {"university": "University of Amsterdam", "cost_usd": 14000},
            "Germany": {"university": "Heidelberg University", "cost_usd": 2000},
            "Sweden": {"university": "Uppsala University", "cost_usd": 13000},
        },
    },
    "hospitality": {
        "course": "BSc / MSc Hospitality & Tourism Management",
        "by_country": {
            "Switzerland": {"university": "EHL Hospitality Business School", "cost_usd": 40000},
            "Australia": {"university": "Blue Mountains International Hotel Management School", "cost_usd": 28000},
            "United Kingdom": {"university": "University of Surrey", "cost_usd": 22000},
            "USA": {"university": "Cornell School of Hotel Administration", "cost_usd": 55000},
            "Ireland": {"university": "Shannon College of Hotel Management", "cost_usd": 18000},
            "UAE": {"university": "Jumeirah International Hospitality College", "cost_usd": 20000},
            "France": {"university": "Institut Paul Bocuse", "cost_usd": 18000},
            "Spain": {"university": "Les Roches Marbella", "cost_usd": 25000},
        },
    },
    "default": {
        "course": "MSc / Master's Program",
        "by_country": {
            "Canada": {"university": "McGill University", "cost_usd": 22000},
            "Australia": {"university": "ANU", "cost_usd": 30000},
            "United Kingdom": {"university": "University of Manchester", "cost_usd": 25000},
            "USA": {"university": "Purdue University", "cost_usd": 28000},
            "Germany": {"university": "Humboldt University Berlin", "cost_usd": 2000},
            "Ireland": {"university": "Trinity College Dublin", "cost_usd": 20000},
            "Netherlands": {"university": "Utrecht University", "cost_usd": 14000},
            "Sweden": {"university": "Lund University", "cost_usd": 13000},
            "Singapore": {"university": "NUS", "cost_usd": 25000},
            "New Zealand": {"university": "University of Auckland", "cost_usd": 20000},
            "Japan": {"university": "Waseda University", "cost_usd": 8000},
            "South Korea": {"university": "Yonsei University", "cost_usd": 7000},
            "France": {"university": "Sorbonne University", "cost_usd": 10000},
            "Italy": {"university": "University of Bologna", "cost_usd": 4000},
            "Norway": {"university": "University of Oslo", "cost_usd": 3000},
            "Finland": {"university": "University of Helsinki", "cost_usd": 10000},
            "Poland": {"university": "University of Warsaw", "cost_usd": 4000},
            "Malaysia": {"university": "University of Malaya", "cost_usd": 7000},
            "UAE": {"university": "American University of Sharjah", "cost_usd": 20000},
        },
    },
}

# ── Keyword → course key mapping ──────────────────────────────────────────

INTEREST_KEYWORDS = {
    "computer science": ["cs", "computer", "software", "coding", "programming", "it", "information technology", "web dev", "cybersecurity", "networking"],
    "data science": ["data", "ai", "artificial intelligence", "machine learning", "ml", "analytics", "big data", "statistics", "deep learning"],
    "business": ["business", "mba", "finance", "management", "marketing", "accounting", "economics", "commerce", "entrepreneurship", "hr", "human resources"],
    "engineering": ["engineering", "mechanical", "electrical", "civil", "chemical", "aerospace", "automotive", "robotics", "electronics", "structural"],
    "medicine": ["medicine", "medical", "mbbs", "doctor", "health", "nursing", "pharmacy", "dentistry", "physiotherapy", "public health", "biomedical"],
    "law": ["law", "legal", "llb", "llm", "barrister", "solicitor", "criminology", "international law"],
    "architecture": ["architecture", "urban design", "interior design", "urban planning", "landscape"],
    "psychology": ["psychology", "counselling", "mental health", "behavioral science", "neuroscience"],
    "hospitality": ["hospitality", "tourism", "hotel management", "culinary", "event management", "travel"],
}


# ── Helpers ────────────────────────────────────────────────────────────────

def _match_course_key(interest: str) -> str:
    interest = interest.lower().strip()
    for key, keywords in INTEREST_KEYWORDS.items():
        if key in interest:
            return key
        for kw in keywords:
            if kw in interest:
                return key
    return "default"


def _score_countries(profile: dict) -> list:
    """
    Score ALL countries in COUNTRY_DB against the student profile.
    Returns sorted list (highest score first).
    """
    budget = profile.get("budget", 0)
    english = profile.get("english_score", 0)
    pr_pref = profile.get("pr_preference", False)
    timeline = profile.get("timeline", 12)
    marks = profile.get("marks", 0)

    scored = []
    for country, data in COUNTRY_DB.items():
        score = 0

        # 1. Budget fit (30 pts)
        cost = data["avg_cost_usd"] + data["living_usd"]
        if budget >= cost * 1.3:
            score += 30
        elif budget >= cost:
            score += 22
        elif budget >= cost * 0.85:
            score += 12
        elif budget >= cost * 0.7:
            score += 5

        # 2. English score fit (25 pts)
        eng_min = data["english_min"]
        if eng_min == 0:
            score += 18  # no English requirement (e.g. Germany)
        elif english >= eng_min + 1.0:
            score += 25
        elif english >= eng_min + 0.5:
            score += 20
        elif english >= eng_min:
            score += 14
        elif english >= eng_min - 0.5:
            score += 6

        # 3. PR preference (20 pts)
        if pr_pref and data["pr_friendly"]:
            score += 20
        elif not pr_pref and not data["pr_friendly"]:
            score += 10
        elif not pr_pref:
            score += 8

        # 4. Timeline fit (15 pts)
        if timeline >= data["timeline_months"] + 2:
            score += 15
        elif timeline >= data["timeline_months"]:
            score += 10
        elif timeline >= data["timeline_months"] - 2:
            score += 5

        # 5. Academic marks bonus (10 pts)
        if marks >= 80:
            score += 10
        elif marks >= 65:
            score += 7
        elif marks >= 50:
            score += 4

        scored.append({"country": country, "score": score, "data": data})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def _build_response(profile: dict, ranked: list) -> dict:
    course_key = _match_course_key(profile.get("course_interest", ""))
    course_info = COURSE_DB[course_key]
    budget = profile.get("budget", 0)

    top = ranked[0]
    country_name = top["country"]
    country_data = top["data"]

    # Best course entry for top country, fallback to first available
    course_by_country = course_info["by_country"].get(country_name)
    if not course_by_country:
        course_by_country = next(iter(course_info["by_country"].values()))

    # Top 5 universities across top 3 countries
    top_universities = []
    for r in ranked[:3]:
        unis = r["data"]["top_universities"][:2]
        top_universities.extend([f"{u} ({r['country']})" for u in unis])
    top_universities = top_universities[:5]

    tuition = course_by_country["cost_usd"]
    living = country_data["living_usd"]
    estimated_cost = {
        "tuition_per_year_usd": tuition,
        "living_expenses_usd": living,
        "total_per_year_usd": tuition + living,
        "currency_note": "Approximate figures. Actual costs vary by university and lifestyle.",
    }

    strengths = ", ".join(country_data["strengths"])
    reason = (
        f"{country_name} is the best match for your profile. "
        f"With a budget of ${budget:,}/yr, an English score of {profile.get('english_score')}, "
        f"and interest in {profile.get('course_interest')}, {country_name} offers: {strengths}. "
        f"The {course_info['course']} at {course_by_country['university']} aligns well with your goals."
    )

    return {
        "best_country": country_name,
        "recommended_course": course_info["course"],
        "top_universities": top_universities,
        "estimated_cost": estimated_cost,
        "reason_for_recommendation": reason,
        "alternative_countries": [r["country"] for r in ranked[1:4]],
        "pr_pathway_available": country_data["pr_friendly"],
        "country_language": country_data["language"],
        "processing_method": "rule_based",
        "all_scored_countries": [
            {"country": r["country"], "score": r["score"]} for r in ranked
        ],
    }


# ── OpenAI path ────────────────────────────────────────────────────────────

def _openai_recommend(profile: dict, api_key: str) -> dict:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        user_prompt = build_recommendation_prompt(profile)

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=1200,
        )
        result = json.loads(response.choices[0].message.content)
        result["processing_method"] = "openai"
        return result
    except Exception:
        ranked = _score_countries(profile)
        return _build_response(profile, ranked)


# ── Public entry point ─────────────────────────────────────────────────────

def get_profile_recommendation(profile: dict) -> dict:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        return _openai_recommend(profile, api_key)
    ranked = _score_countries(profile)
    return _build_response(profile, ranked)
