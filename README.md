# AIEC – Aradhya International Education Consultancy

AI-powered study abroad consultancy platform.

## Stack
- Frontend: React + TailwindCSS
- Backend: Django + Django REST Framework
- Database: PostgreSQL

---

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your DB credentials and OpenAI key

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API runs at: http://localhost:8000/api/
Admin panel: http://localhost:8000/admin/

---

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

App runs at: http://localhost:3000

---

## Features

- AI country & course recommendations (OpenAI GPT or rule-based fallback)
- Multi-step student questionnaire
- WhatsApp inquiry integration (floating button + quick inquiry form)
- Lead management dashboard with status tracking
- Mobile responsive design

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/questionnaire/ | Submit questionnaire + get AI recs |
| POST | /api/contact/ | Quick WhatsApp inquiry |
| GET | /api/leads/ | List all leads |
| PATCH | /api/leads/:id/ | Update lead status |
| GET | /api/dashboard/stats/ | Dashboard statistics |
| GET | /api/countries/ | List countries |

## Environment Variables

### Backend (.env)
- `OPENAI_API_KEY` – Optional. Falls back to rule-based AI if not set.
- `WHATSAPP_NUMBER` – Your WhatsApp business number
- `DB_*` – PostgreSQL connection details

### Frontend (.env)
- `REACT_APP_API_URL` – Backend API base URL
- `REACT_APP_WHATSAPP` – WhatsApp number (digits only, e.g. 919999999999)
