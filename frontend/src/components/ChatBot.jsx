import React, { useState, useRef, useEffect } from 'react'
import logo from '/logo.png'

const WA_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

// ── Knowledge Base ─────────────────────────────────────────────────────
const KNOWLEDGE_BASE = `
=== COUNTRY DATABASE ===

CANADA
- Avg tuition: $20,000–$35,000/yr | Living: $12,000–$16,000/yr
- Post-study work: PGWP up to 3 years
- PR pathway: Express Entry (CRS score), PNP streams — 2–3 years
- IELTS min: 6.0 overall (6.5 for top universities)
- Top universities: University of Toronto (#21), UBC (#34), McGill (#46), Waterloo (top CS/Eng), McMaster, Alberta
- Best for: CS, Engineering, Business, Health Sciences, AI/Data Science
- Visa success rate for Nepali students: ~75–85% with strong financials and genuine intent
- Scholarships: Vanier CGS ($50k/yr PhD), Banting, university merit (20–50% tuition)

AUSTRALIA
- Avg tuition: $25,000–$45,000/yr | Living: $15,000–$20,000/yr
- Post-study work: 485 visa — 2–4 years
- PR pathway: Skilled Independent (189), State Nominated (190) — 3–5 years
- IELTS min: 6.0–6.5
- Top universities: Melbourne (#33), ANU (#30), UNSW (#19 Eng), Sydney (#41), Monash (#57), UQ
- Visa success rate for Nepali students: ~70–80% (GTE statement critical)
- Scholarships: Australia Awards (fully funded), Destination Australia

UK
- Avg tuition: $18,000–$40,000/yr | Living: $13,000–$18,000/yr
- Post-study work: Graduate Route — 2 years (master's), 3 years (PhD)
- PR pathway: Skilled Worker → ILR after 5 years
- IELTS min: 6.0–6.5 (Oxford/Cambridge: 7.0+)
- Top universities: Oxford (#1), Cambridge (#2), Imperial (#6), UCL (#9), Edinburgh (#22), Manchester, Warwick
- Visa success rate for Nepali students: ~80–90% (straightforward process)
- Scholarships: Chevening (fully funded), Commonwealth, GREAT

GERMANY
- Avg tuition: €0–€3,000/yr (public unis, only semester fee ~€300–500) | Living: €10,000–€13,000/yr
- Post-study work: 18-month job seeker visa
- PR pathway: EU Blue Card → PR in 21–33 months
- IELTS min: Not required for German programs; 6.0–6.5 for English master's
- Top universities: TU Munich (#37), LMU Munich (#59), RWTH Aachen (Eng), Heidelberg (#87), KIT
- Visa success rate: ~85–90% (strong financial proof needed)
- Scholarships: DAAD (fully funded), Deutschlandstipendium (€300/month)

USA
- Avg tuition: $25,000–$60,000/yr | Living: $15,000–$25,000/yr
- Post-study work: OPT 1 year; STEM OPT 3 years total
- PR pathway: H-1B lottery → Green Card (5–15+ years)
- IELTS min: 6.5 (Ivy League: 7.0+)
- Top universities: MIT (#1), Stanford (#3), Harvard (#4), CMU (CS), Caltech (#6), Michigan, Purdue, Georgia Tech, UIUC, UCLA, UC Berkeley
- Visa success rate for Nepali students: ~65–75% (strong financials + ties to home country needed)
- Scholarships: Fulbright (fully funded), TA/RA positions (cover tuition + stipend)

IRELAND
- Avg tuition: $15,000–$28,000/yr | Living: $12,000–$16,000/yr
- Post-study work: 2 years (master's/PhD), 1 year (bachelor's)
- PR pathway: Long-term residency after 5 years
- IELTS min: 6.0–6.5
- Top universities: Trinity College Dublin (#81), UCD, University of Galway
- Visa success rate: ~80–85%
- Scholarships: Government of Ireland International Education Scholarships

NETHERLANDS
- Avg tuition: €8,000–€18,000/yr | Living: €11,000–€14,000/yr
- Post-study work: Orientation Year — 1 year
- IELTS min: 6.0–6.5
- Top universities: TU Delft (#57 Eng), University of Amsterdam (#55), Eindhoven, Leiden, Wageningen (Agriculture)
- Scholarships: Holland Scholarship (€5,000), Orange Tulip

SWEDEN
- Avg tuition: ~$8,000–$20,000/yr | Living: ~$12,000/yr
- Post-study work: 6-month job seeker permit
- PR pathway: Permanent residency after 4 years
- IELTS min: 6.0–6.5
- Top universities: KTH (#98), Lund (#103), Uppsala, Stockholm, Chalmers
- Scholarships: Swedish Institute (fully funded)

NORWAY
- Avg tuition: FREE at public universities (~NOK 600 semester fee) | Living: ~$12,000–$15,000/yr
- Post-study work: 1-year job seeker visa
- PR pathway: 3 years
- IELTS min: 5.5–6.0
- Top universities: NTNU (Eng), University of Oslo, Bergen

FINLAND
- Avg tuition: €8,000–€18,000/yr | Living: €10,000–€13,000/yr
- Post-study work: 2-year residence permit for job seeking
- IELTS min: 5.5–6.0
- Top universities: University of Helsinki (#115), Aalto (Design/Tech/Business)
- Scholarships: Finland Scholarship (€5,000–€10,000)

SINGAPORE
- Avg tuition: SGD 20,000–50,000/yr | Living: SGD 15,000–20,000/yr
- Post-study work: Employment Pass or S Pass
- PR pathway: Application after 2 years work
- IELTS min: 6.0–6.5
- Top universities: NUS (#8 globally), NTU (#26), SMU (Business)
- Scholarships: ASEAN Scholarships, MOE scholarships

JAPAN
- Avg tuition: ~$3,500–$10,000/yr | Living: ~$8,000–$10,000/yr
- Post-study work: 1-year Designated Activities visa
- PR pathway: 10 years (or 1 year with high points)
- IELTS min: 5.5–6.0
- Top universities: University of Tokyo (#28), Kyoto (#46), Osaka (#80), Waseda, Keio, Tokyo Tech
- Scholarships: MEXT (fully funded — covers everything), JASSO

SOUTH KOREA
- Avg tuition: ~$3,000–$9,000/yr | Living: ~$6,000–$9,000/yr
- Post-study work: D-10 job seeker visa — 1 year
- PR pathway: F-5 after 5 years
- IELTS min: 5.5–6.0
- Top universities: Seoul National (#41), KAIST (Science/Tech), Yonsei, Korea University, POSTECH
- Scholarships: KGSP (fully funded), GKS

MALAYSIA
- Avg tuition: ~$4,500–$14,000/yr | Living: ~$3,500–$6,000/yr
- IELTS min: 5.5–6.0
- Top universities: University of Malaya (#65 Asia), Monash Malaysia, Taylor's, Sunway
- Scholarships: Malaysian International Scholarship (MIS)

FRANCE
- Avg tuition: €170–€3,770/yr at public universities | Living: €10,000–€14,000/yr
- Post-study work: APS — 1 year
- IELTS min: 5.5–6.0 (French programs: no IELTS)
- Top universities: HEC Paris (#1 Europe Business), Sciences Po, École Polytechnique, Sorbonne, INSEAD
- Scholarships: Eiffel Excellence (fully funded), Campus France

ITALY
- Avg tuition: €1,000–€4,000/yr | Living: €9,000–€12,000/yr
- IELTS min: 5.5–6.0
- Top universities: Politecnico di Milano (#137, top Design/Eng), Bocconi (Business), Bologna, Sapienza
- Scholarships: Italian Government Scholarships (DSU)

POLAND
- Avg tuition: ~$2,500–$7,500/yr | Living: ~$5,000–$7,500/yr
- IELTS min: 5.0–5.5
- Top universities: University of Warsaw, Jagiellonian (Kraków), Warsaw University of Technology
- Scholarships: NAWA scholarships

=== VISA SUCCESS RATES FOR NEPALI STUDENTS ===
UK: 80–90% (most straightforward)
Germany: 85–90% (strong financial proof needed)
Canada: 75–85% (genuine intent + financials)
Australia: 70–80% (GTE statement is critical)
USA: 65–75% (strong financials + ties to home country)
Ireland: 80–85%
Netherlands: 80–85%
Japan: 85–90% (MEXT applicants near 95%)
South Korea: 80–85%
Malaysia: 90%+ (easiest)

Key factors for visa approval:
1. Strong financial proof (bank statements showing 1.5x total cost)
2. Genuine Temporary Entrant (GTE) statement for Australia
3. Acceptance letter from recognized university
4. IELTS score meeting requirements
5. Clear study plan and career goals
6. Ties to home country (family, property, job offer after study)
7. Clean travel history helps

=== UNIVERSITY RANKINGS BY FIELD (QS 2024) ===

COMPUTER SCIENCE / IT:
1. MIT | 2. Stanford | 3. Carnegie Mellon | 4. Oxford | 5. ETH Zurich
6. Cambridge | 7. NUS (Singapore) | 8. Imperial College London | 9. EPFL | 10. TU Munich
Also strong: Waterloo (Canada), KAIST (Korea), Edinburgh (UK), TU Delft (Netherlands)

ENGINEERING:
1. MIT | 2. Stanford | 3. Cambridge | 4. ETH Zurich | 5. NUS
6. Imperial College London | 7. TU Munich | 8. RWTH Aachen | 9. Caltech | 10. Georgia Tech
Also strong: TU Delft, KTH Sweden, NTNU Norway, Politecnico di Milano

BUSINESS / MBA:
1. Harvard | 2. Stanford GSB | 3. Wharton | 4. INSEAD | 5. London Business School
6. HEC Paris | 7. MIT Sloan | 8. Columbia | 9. Chicago Booth | 10. IE Business School
Also strong: Rotman (Canada), Melbourne (Australia), NUS Business, Bocconi (Italy)

MEDICINE:
1. Harvard | 2. Oxford | 3. Cambridge | 4. Johns Hopkins | 5. Karolinska (Sweden)
6. UCL | 7. Imperial | 8. Melbourne | 9. NUS | 10. U of Toronto
Affordable: Semmelweis (Hungary), Charles University (Czech), Jagiellonian (Poland), UM (Malaysia)

DATA SCIENCE / AI:
1. MIT | 2. Stanford | 3. Carnegie Mellon | 4. Oxford | 5. ETH Zurich
6. Cambridge | 7. U of Toronto | 8. NUS | 9. TU Munich | 10. Aalto (Finland)

=== BUDGET GUIDE (TOTAL ANNUAL COST) ===
Under $15,000/yr: Germany, Norway, Poland, Italy, France, Malaysia, Japan, South Korea
$15,000–$25,000/yr: Finland, Sweden, Netherlands, Ireland, Singapore
$25,000–$40,000/yr: Canada, UK, New Zealand
$40,000–$60,000/yr: Australia, USA

=== SCHOLARSHIPS DATABASE ===
FULLY FUNDED:
- DAAD (Germany) | MEXT (Japan) | KGSP (South Korea) | Chevening (UK)
- Australia Awards | Fulbright (USA) | Swedish Institute | Eiffel Excellence (France)
- Vanier CGS (Canada — PhD)

PARTIAL (20–50% tuition): Most universities — requires 75%+ marks or 3.5+ GPA

=== COURSE ADVICE ===
CS/Software: Canada, Germany, USA, UK, Netherlands, Sweden, Singapore
Engineering: Germany, Canada, Australia, UK, Netherlands, Norway
Business/MBA: USA, UK, France, Canada, Singapore, Australia
Medicine: UK, Australia, Hungary, Poland, Malaysia (check NMC recognition)
Data Science/AI: USA, Canada, UK, Germany, Netherlands, Singapore
Hospitality: Switzerland, Australia, UK, France
`

const SYSTEM_PROMPT = `You are Aria, a senior study abroad counsellor at AIEC (Aaradhya International Education Consultancy) with 15+ years of experience helping Nepali students study abroad.

You have a comprehensive knowledge base with real data. Use it to give expert, specific, accurate answers.

=== YOUR KNOWLEDGE BASE ===
${KNOWLEDGE_BASE}
=== END KNOWLEDGE BASE ===

BEHAVIOUR:
- Answer ANY question fully using real numbers from the knowledge base
- For visa questions: give actual success rates, key factors, tips
- For country questions: give tuition, living cost, visa, PR, top universities
- For scholarship questions: list real scholarships with eligibility
- Be conversational and warm but always specific and factual
- Keep replies to 4–6 sentences unless a detailed comparison is needed
- Gradually collect: qualification → marks → IELTS → course → budget → PR preference
- After giving recommendation, offer free consultation and collect name/email/phone
- Never ask for contact info before giving a recommendation
- Never make up data — only use what's in the knowledge base`

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm Aria, your study abroad counsellor at AIEC 👋\n\nI have real data on 20+ countries — tuition, visa success rates, PR pathways, scholarships, and top universities. Ask me anything!\n\nTo get started: What's your highest qualification? (e.g. 12th grade, Bachelor's, Master's)",
}

// ── Rule-based replies (instant, no API cost) ──────────────────────────
function ruleBasedReply(text) {
  const t = text.toLowerCase()

  // Visa success rate — most common unanswered query
  if (/(visa success|visa rate|visa approval|visa reject|visa chance|visa percentage|visa accept)/.test(t))
    return "Visa success rates for Nepali students 🛂:\n\n• UK: 80–90% (most straightforward)\n• Germany: 85–90% (strong financial proof needed)\n• Canada: 75–85% (genuine intent + financials)\n• Australia: 70–80% (GTE statement is critical)\n• USA: 65–75% (ties to home country important)\n• Ireland: 80–85%\n• Japan: 85–90% (MEXT applicants ~95%)\n• Malaysia: 90%+ (easiest)\n\nKey factors: strong bank statements (1.5x total cost), acceptance letter, IELTS score, clear study plan, and ties to Nepal. Which country are you applying to?"

  if (/(visa|student visa|study permit|f-1|tier 4|subclass 500)/.test(t) && !/(success|rate|approval|reject|chance)/.test(t))
    return "Visa processing times 📋:\n• UK: ~3 weeks (Student visa)\n• Canada: 4–8 weeks (Study Permit)\n• Australia: 4–6 weeks (Subclass 500)\n• Germany: 6–8 weeks\n• USA: 2–8 weeks (F-1)\n• Ireland: 4–8 weeks\n• Japan: 3–4 weeks\n\nFor all visas you need: acceptance letter, IELTS score, financial proof, and a clear study plan. Which country are you applying to?"

  if (/(canada|canadian)/.test(t))
    return "Canada 🇨🇦 — Tuition: $20k–$35k/yr | Living: $12k–$16k/yr | Total: ~$35k/yr\n\nPost-study work: PGWP up to 3 years. PR via Express Entry in 2–3 years.\n\nTop unis: U of Toronto (#21), UBC (#34), McGill (#46), Waterloo (CS/Eng).\n\nIELTS: 6.0 (top unis: 6.5). Visa success rate for Nepali students: 75–85%.\n\nBest for: CS, Engineering, Business, Health Sciences. Want me to match this to your profile?"

  if (/(australia|australian)/.test(t))
    return "Australia 🇦🇺 — Tuition: $25k–$45k/yr | Living: $15k–$20k/yr | Total: ~$45k/yr\n\nPost-study work: 485 visa (2–4 years). PR via Skilled Independent (189) or State Nominated (190) in 3–5 years.\n\nTop unis: Melbourne (#33), ANU (#30), UNSW (#19 Eng), Sydney (#41).\n\nIELTS: 6.0–6.5. Visa success rate: 70–80% (GTE statement is critical).\n\nBest for: Engineering, IT, Business, Medicine. Shall I compare with another country?"

  if (/(uk|united kingdom|britain|england)/.test(t))
    return "UK 🇬🇧 — Tuition: $18k–$40k/yr | Living: $13k–$18k/yr\n\nMaster's is just 1 year — saves time and money. Graduate Route visa: 2 years post-study work.\n\nTop unis: Oxford (#1), Cambridge (#2), Imperial (#6), UCL (#9), Edinburgh (#22).\n\nIELTS: 6.0–6.5 (Oxford/Cambridge: 7.0+). Visa success rate: 80–90%.\n\nChevening scholarship is fully funded. PR takes 5+ years via Skilled Worker visa."

  if (/(germany|german)/.test(t))
    return "Germany 🇩🇪 — Near-zero tuition at public unis (~€300–500 semester fee only) | Living: €10k–€13k/yr\n\nPost-study work: 18-month job seeker visa. EU Blue Card → PR in 21–33 months.\n\nTop unis: TU Munich (#37), RWTH Aachen (Eng), LMU Munich (#59), KIT.\n\nIELTS: Not needed for German programs; 6.0–6.5 for English master's. Visa success: 85–90%.\n\nDAAD scholarship is fully funded. Best for Engineering, CS, Robotics."

  if (/(usa|united states|america|american)/.test(t))
    return "USA 🇺🇸 — Tuition: $25k–$60k/yr | Living: $15k–$25k/yr | Total: ~$55k/yr\n\nSTEM OPT gives 3 years work after graduation. H-1B lottery for long-term stay is uncertain.\n\nTop unis: MIT (#1), Stanford (#3), Harvard (#4), CMU (CS), Georgia Tech (Eng).\n\nIELTS: 6.5–7.0. Visa success rate for Nepali students: 65–75%.\n\nFulbright scholarship is fully funded. Best for CS, AI, Research, MBA."

  if (/(ireland|irish)/.test(t))
    return "Ireland 🇮🇪 — Tuition: $15k–$28k/yr | Living: $12k–$16k/yr\n\nEnglish-speaking EU country — home to Google, Meta, Apple, LinkedIn, Pfizer.\n\nPost-study work: 2 years (master's). Top unis: Trinity College Dublin (#81), UCD.\n\nIELTS: 6.0–6.5. Visa success rate: 80–85%. EU residency after 5 years.\n\nBest for: CS, Pharma, Finance, Data Analytics."

  if (/(netherlands|dutch|holland)/.test(t))
    return "Netherlands 🇳🇱 — Tuition: €8k–€18k/yr | Living: €11k–€14k/yr\n\n2,100+ English-taught programs. 1-year Orientation visa after graduation.\n\nTop unis: TU Delft (#57 Eng), University of Amsterdam (#55), Wageningen (Agriculture).\n\nHolland Scholarship: €5,000. IELTS: 6.0–6.5.\n\nBest for: Engineering, Technology, Business, Agriculture."

  if (/(sweden|swedish)/.test(t))
    return "Sweden 🇸🇪 — Tuition: ~$8k–$20k/yr | Living: ~$12k/yr\n\nSwedish Institute Scholarship is fully funded (tuition + living). 6-month job seeker permit after graduation. PR after 4 years.\n\nTop unis: KTH (#98), Lund (#103), Uppsala, Chalmers.\n\nIELTS: 6.0–6.5. Home to Spotify, IKEA, Volvo, Ericsson.\n\nBest for: Engineering, Sustainability, Technology, Design."

  if (/(norway|norwegian)/.test(t))
    return "Norway 🇳🇴 — FREE tuition at public universities (only ~NOK 600 semester fee) | Living: ~$12k–$15k/yr\n\nPR after just 3 years. 1-year job seeker visa after graduation.\n\nTop unis: NTNU (Engineering), University of Oslo, Bergen.\n\nIELTS: 5.5–6.0. High salaries but Norwegian language needed for most jobs.\n\nBest for: Engineering, Marine Sciences, Oil & Gas."

  if (/(singapore|singaporean)/.test(t))
    return "Singapore 🇸🇬 — Tuition: SGD 20k–50k/yr | Living: SGD 15k–20k/yr\n\nNUS is ranked #8 globally, NTU #26. English-speaking, safe, Asia's financial hub.\n\nPR application possible after 2 years work. IELTS: 6.0–6.5.\n\nBest for: Business, Finance, CS, Engineering, Biomedical.\n\nASEAN Scholarships and MOE scholarships available."

  if (/(japan|japanese)/.test(t))
    return "Japan 🇯🇵 — Tuition: ~$3.5k–$10k/yr | Living: ~$8k–$10k/yr\n\nMEXT scholarship is fully funded (covers everything). Visa success rate: 85–90% (MEXT applicants ~95%).\n\nTop unis: University of Tokyo (#28), Kyoto (#46), Osaka (#80), Waseda.\n\nIELTS: 5.5–6.0. PR timeline: 10 years (or 1 year with high points).\n\nBest for: Engineering, Robotics, Technology."

  if (/(korea|korean|south korea)/.test(t))
    return "South Korea 🇰🇷 — Tuition: ~$3k–$9k/yr | Living: ~$6k–$9k/yr\n\nKGSP (Korean Government Scholarship) is fully funded. D-10 job seeker visa for 1 year after graduation.\n\nTop unis: Seoul National (#41), KAIST (Science/Tech), Yonsei, Korea University.\n\nIELTS: 5.5–6.0. Visa success rate: 80–85%.\n\nBest for: Engineering, Technology, Business."

  if (/(malaysia|malaysian)/.test(t))
    return "Malaysia 🇲🇾 — Tuition: ~$4.5k–$14k/yr | Living: ~$3.5k–$6k/yr\n\nOne of the most affordable options. English-medium education. Visa success rate: 90%+ (easiest).\n\nTop unis: University of Malaya (#65 Asia), Monash Malaysia, Taylor's, Sunway.\n\nTwinning programs with UK/Australian universities available.\n\nBest for: Business, Engineering, Medicine, IT."

  if (/(scholarship|fund|free|fully funded|daad|chevening|mext|kgsp|fulbright|australia award)/.test(t))
    return "Top fully funded scholarships 🎓:\n\n• DAAD (Germany) — master's/PhD — daad.de\n• Chevening (UK) — master's — chevening.org\n• Australia Awards — developing countries — dfat.gov.au\n• Fulbright (USA) — research/study — fulbrightprogram.org\n• MEXT (Japan) — all levels — mext.go.jp\n• KGSP (South Korea) — all levels — studyinkorea.go.kr\n• Swedish Institute — master's — si.se\n• Eiffel Excellence (France) — master's — campusfrance.org\n• Vanier CGS (Canada) — PhD — vanier.gc.ca\n\nMost require 75%+ marks. Which country interests you most?"

  if (/(ielts|english|language test|band score)/.test(t))
    return "IELTS requirements by country 📝:\n\n• Canada: 6.0 (top unis: 6.5–7.0)\n• Australia: 6.0–6.5\n• UK: 6.0–6.5 (Oxford/Cambridge: 7.0+)\n• Germany: Not needed for German programs; 6.0–6.5 for English\n• USA: 6.5–7.0 (Ivy League: 7.0+)\n• Ireland: 6.0–6.5\n• Norway/Finland: 5.5–6.0\n• Japan/Korea: 5.5–6.0\n• Malaysia/Poland: 5.0–5.5\n\nWhat's your current IELTS score or target?"

  if (/(pr|permanent residen|immigrat|settle|citizenship)/.test(t))
    return "Best countries for PR 🌍:\n\n• Canada — Express Entry, 2–3 years, moderate\n• Australia — Skilled visa, 3–5 years, moderate\n• Germany — EU Blue Card, 21–33 months, needs job offer\n• Norway — 3 years, relatively easy\n• UK — 5+ years, harder\n• USA — 5–15+ years, very hard (H-1B lottery)\n• Singapore — 2+ years work, competitive\n\nCanada and Australia are the most popular PR pathways for Nepali students. Which matters most to you?"

  if (/(budget|cost|afford|cheap|expensive|fee|tuition|living|total cost|annual cost)/.test(t))
    return "Annual total cost (tuition + living) 💰:\n\n• Under $15k: Germany, Norway, Poland, Italy, France, Malaysia, Japan, South Korea\n• $15k–$25k: Finland, Sweden, Netherlands, Ireland, Singapore\n• $25k–$40k: Canada, UK\n• $40k–$60k: Australia, USA\n\nWhat's your annual budget? I'll find the best options within your range."

  if (/(cs|computer science|software|programming|coding|information technology)/.test(t) && !/(medicine|medical|nursing)/.test(t))
    return "For Computer Science/IT 💻:\n\nTop countries: Canada, Germany, USA, UK, Netherlands, Sweden, Singapore\n\nTop universities: MIT (#1 CS), Stanford (#2), CMU (#3), Oxford (#4), TU Munich (#10), Waterloo (Canada — top for CS co-op), NUS (#7 Singapore)\n\nStarting salaries: $60k–$120k (Canada/Australia), $80k–$150k (USA), €40k–€80k (Germany)\n\nWhat's your marks percentage and IELTS score? I'll give you specific university matches."

  if (/(engineering|mechanical|electrical|civil|chemical|structural)/.test(t))
    return "For Engineering 🔧:\n\nTop countries: Germany, Canada, Australia, UK, Netherlands, Sweden, Norway\n\nTop universities: MIT (#1), TU Munich (#7), RWTH Aachen (Germany), Imperial (#6), TU Delft (#57), KTH Sweden, NTNU Norway\n\nGermany is exceptional — near-zero tuition + DAAD scholarship + BMW/Siemens/Bosch industry access\n\nWhat engineering field? I'll narrow it down further."

  if (/(business|mba|management|finance|accounting|marketing|economics)/.test(t))
    return "For Business/MBA 💼:\n\nTop options: USA (Harvard, Wharton, MIT Sloan), UK (LBS, Oxford, Warwick), France (HEC Paris, INSEAD), Canada (Rotman, Ivey), Singapore (NUS), Australia (Melbourne)\n\nAffordable MBA: France (HEC Paris, low tuition), Germany (ESMT Berlin), Netherlands (RSM Erasmus)\n\nWhat level — bachelor's, master's, or MBA? And what's your budget?"

  if (/(medicine|mbbs|medical|doctor|nursing|health|pharmacy|dentist)/.test(t))
    return "For Medicine/Health Sciences 🏥:\n\n• UK, Australia, Canada — high quality but expensive\n• Hungary, Poland, Czech Republic — affordable MBBS (~$8k–$15k/yr), WHO recognized\n• Malaysia — affordable, English-medium, recognized\n\nImportant: Always check Nepal Medical Council (NMC) recognition before choosing.\n\nPopular for Nepali students: Semmelweis (Hungary), Jagiellonian (Poland), University of Malaya (Malaysia)\n\nWhat's your marks percentage?"

  if (/(data science|machine learning|ai|artificial intelligence|analytics|data analyst)/.test(t))
    return "For Data Science/AI 🤖:\n\nTop countries: USA, Canada, UK, Germany, Netherlands, Singapore, Sweden\n\nTop programs: MIT, Stanford, CMU (USA), U of Toronto (#7 AI), Edinburgh (UK), TU Munich (#9), Aalto Finland (#10), NUS Singapore\n\nStarting salaries: $70k–$130k (USA), $60k–$100k (Canada), €45k–€80k (Germany)\n\nWhat's your background — CS, Statistics, or something else?"

  if (/(nepal|nepali|from nepal|i am from)/.test(t))
    return "As a Nepali student, your most popular destinations are Australia, Canada, UK, Japan, and South Korea 🇳🇵\n\nFor PR: Canada and Australia are the clearest pathways\nFor affordability: Germany (free tuition), Japan (MEXT), South Korea (KGSP)\nFor English: UK, Australia, Canada, Ireland\nEasiest visa: Malaysia (90%+), UK (80–90%), Germany (85–90%)\n\nNepali students typically need IELTS 6.0+ and 60%+ marks for most programs. What's your profile?"

  if (/(compare|vs|versus|difference|better|which country|which is best|recommend)/.test(t))
    return "Happy to compare! The most popular comparisons for Nepali students:\n\n• Canada vs Australia — both great for PR; Canada cheaper, Australia warmer\n• UK vs Canada — UK faster (1yr master's), Canada better PR\n• Germany vs Canada — Germany near-free tuition, Canada easier English\n• Australia vs UK — Australia better post-study work rights\n\nTell me your course, budget, and whether PR matters — I'll give you a specific recommendation."

  if (/(hello|hi|hey|start|begin|help|what can you|who are you)/.test(t))
    return "Hi! I'm Aria 👋 I'm your study abroad counsellor at AIEC.\n\nI have real data on 20+ countries — tuition, visa success rates, PR pathways, scholarships, and top universities.\n\nAsk me anything: 'visa success rate for Canada', 'cheapest countries', 'best for CS', 'IELTS requirements' — or tell me your profile and I'll recommend the best fit.\n\nWhat's your highest qualification?"

  return null
}

// ── OpenAI API call ────────────────────────────────────────────────────
async function getAIReply(messages) {
  const key = import.meta.env.VITE_OPENAI_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

async function trySaveLead(name, email, phone, notes) {
  try {
    await fetch('/api/capture-lead/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, notes, source: 'chatbot' }),
    })
  } catch {}
}

// ── Avatar ─────────────────────────────────────────────────────────────
function AriaAvatar() {
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-blue-200 bg-white">
      <img src={logo} alt="Aria" className="w-full h-full object-contain" />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <AriaAvatar />
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <AriaAvatar />}
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

// ── Main ChatBot component ─────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput('')

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setTyping(true)

    const quick = ruleBasedReply(text)
    if (quick) {
      await new Promise(r => setTimeout(r, 600))
      setTyping(false)
      setMessages(prev => [...prev, { role: 'assistant', content: quick }])
      return
    }

    const aiReply = await getAIReply(updated)
    setTyping(false)

    const reply = aiReply || "Great question! Could you tell me your course interest and budget? I'll pull up the exact data for you — visa rates, costs, top universities, and scholarships 😊"
    setMessages(prev => [...prev, { role: 'assistant', content: reply }])

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const phoneMatch = text.match(/\+?[\d\s\-]{8,15}/)
    if (emailMatch || phoneMatch) {
      trySaveLead('Chat Lead', emailMatch?.[0] || '', phoneMatch?.[0] || '', text)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      {/* Floating Aria button with pulse */}
      <div className="fixed bottom-24 right-5 z-50">
        {!open && <span className="absolute inset-0 rounded-full bg-blue-400 opacity-60 animate-ping" />}
        <button
          onClick={() => setOpen(o => !o)}
          className="relative w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex flex-col items-center justify-center transition-all duration-200 hover:scale-110"
          aria-label="Open chat"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <span className="text-base font-extrabold tracking-widest">ARIA</span>
          )}
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-44 right-5 z-50 w-80 sm:w-96 bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200" style={{ height: '480px' }}>
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
              <img src={logo} alt="AIEC" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Aria — Study Abroad Counsellor</p>
              <p className="text-blue-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Online · AIEC Expert
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-blue-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {typing && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* WhatsApp CTA */}
          <div className="px-3 pb-2">
            <a
              href={`https://wa.me/918733903147?text=Hi%20Aria%2C%20I%20need%20study%20abroad%20counselling`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-xl transition-colors"
            >
              {WA_ICON}
              Chat on WhatsApp instead
            </a>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about visa, cost, scholarships..."
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
