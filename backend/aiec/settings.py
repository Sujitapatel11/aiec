import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me-in-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
_allowed_env = os.getenv('ALLOWED_HOSTS', '')
if _allowed_env:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_env.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver', '.onrender.com', '.vercel.app', '*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'aiec.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'aiec.wsgi.application'

import sys

_db_url = os.getenv('DATABASE_URL', '').strip()
if 'test' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
elif _db_url:
    import dj_database_url
    if _db_url.startswith('sqlite'):
        DATABASES = {
            'default': dj_database_url.config(
                default=_db_url,
                conn_max_age=0,
                ssl_require=False,
            )
        }
        if str(DATABASES['default']['NAME']) in ('db.sqlite3', ':memory:'):
            DATABASES['default']['NAME'] = BASE_DIR / 'db.sqlite3'
    else:
        DATABASES = {
            'default': dj_database_url.config(
                default=_db_url,
                conn_max_age=600,
                ssl_require=True,
            )
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

_cors_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
if _cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(',') if o.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        "https://aiec-three.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://aiec-three-.*\.vercel\.app$",
]

CORS_ALLOW_ALL_ORIGINS = False

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '+919999999999')

# ── Student Management Configuration ─────────────────────────────────────
# STUDENT_ID_PREFIX: prefix for generated student IDs.
# Default 'STU' is generic and reusable across consultancy tenants.
# AIEC can override via environment: STUDENT_ID_PREFIX=AIEC
# Existing stored IDs are never rewritten — this only affects new IDs.
STUDENT_ID_PREFIX = os.getenv('STUDENT_ID_PREFIX', 'STU')

# STUDENT_DEFAULT_CHECKLIST: default process steps created on enrollment.
# Each item requires 'step_name' (str) and 'order' (int, 1-based).
# This replaces the previous hardcoded DEFAULT_CHECKLIST_TEMPLATE in models.py.
# The list is intentionally generic (study-abroad oriented) to match current
# AIEC usage. Tenant-specific templates are a Phase 8 concern.
STUDENT_DEFAULT_CHECKLIST = os.getenv('STUDENT_DEFAULT_CHECKLIST', None)  # Reserved for future env override
if STUDENT_DEFAULT_CHECKLIST is None:
    STUDENT_DEFAULT_CHECKLIST = [
        {"step_name": "Document Collection",  "order": 1},
        {"step_name": "University Application", "order": 2},
        {"step_name": "Offer Letter",           "order": 3},
        {"step_name": "Visa Application",       "order": 4},
        {"step_name": "Visa Interview",         "order": 5},
        {"step_name": "Visa Approval",          "order": 6},
        {"step_name": "Pre-departure",          "order": 7},
    ]

# Consultancy display info — used in StudentPortal and notification templates.
# Override these per-tenant via environment variables.
CONSULTANCY_NAME    = os.getenv('CONSULTANCY_NAME', 'Aaradhya International Education Consultancy')
CONSULTANCY_PHONE   = os.getenv('CONSULTANCY_PHONE', '+977 9802020575')
CONSULTANCY_EMAIL   = os.getenv('CONSULTANCY_EMAIL', 'aaradhyainternationaleducation@gmail.com')
CONSULTANCY_CITY    = os.getenv('CONSULTANCY_CITY', 'Birgunj, Nepal')

# Email
# Set EMAIL_BACKEND=console in .env for local development (prints to stdout, no real send)
# Leave unset or set to smtp for production
_email_backend_env = os.getenv('EMAIL_BACKEND_OVERRIDE', '').strip()
if _email_backend_env == 'console':
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
NOTIFY_EMAIL = os.getenv('NOTIFY_EMAIL', EMAIL_HOST_USER)

# Password reset — token valid for 1 hour (3600 seconds)
PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT_SECONDS', '3600'))

# Frontend URL for building reset links in emails
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
