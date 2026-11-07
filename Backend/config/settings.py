"""
Django settings for the Professional Hub backend.

HOW THIS FILE WORKS (read me first!)
------------------------------------
1. Secrets and "different on every computer" values live in the `.env` file
   (on your laptop) or in real environment variables (on Render / a VPS).
2. We read them with python-decouple's `config(...)` function:
       config("NAME")                         -> required, Django stops if missing
       config("NAME", default=5, cast=int)    -> optional, turned into a number
3. DEBUG=True  -> relaxed settings for your laptop (http://localhost).
   DEBUG=False -> strict, secure settings for the real website (https).

All settings: https://docs.djangoproject.com/en/6.0/ref/settings/
"""

from datetime import timedelta
from email.utils import formataddr
from pathlib import Path
import sys
from typing import cast

from decouple import AutoConfig, Choices, Csv
from django.core.exceptions import ImproperlyConfigured


# =============================================================================
# 1. FOLDERS AND THE .env READER
# =============================================================================

# BASE_DIR = the backend folder that contains manage.py.
# This file is backend/config/settings.py, so we go up two folders.
BASE_DIR = Path(__file__).resolve().parent.parent

# `config` looks for each value in this order:
#   1) real environment variables (what Render / a VPS use)
#   2) the .env file inside BASE_DIR (what your laptop uses)
config = AutoConfig(search_path=BASE_DIR)


# =============================================================================
# 2. DEBUG MODE, SECRET KEY, AND ALLOWED HOSTS
# =============================================================================

# DEBUG=True shows detailed error pages: great for learning, DANGEROUS online.
# Default is False, so if you forget to set it, the website stays safe.
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)

# SECRET_KEY signs login tokens (JWTs), sessions and password-reset data.
# It is REQUIRED and must never change, or every user gets logged out.
SECRET_KEY = str(config("DJANGO_SECRET_KEY"))

# Safety net: refuse to run the real website with a weak or example key.
if not DEBUG and (len(SECRET_KEY) < 50 or SECRET_KEY.startswith("replace-")):
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is too short or still the example value. "
        "Make a new one (see the instructions in .env.example)."
    )

# The website names this server answers to.
# Laptop: "localhost,127.0.0.1"   Production: "api.app.com"
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", cast=Csv())


# =============================================================================
# 3. APPS AND MIDDLEWARE
# =============================================================================

INSTALLED_APPS = [
    # --- Built-in Django apps ---
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # --- Third-party apps (installed with pip) ---
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",  # remembers logged-out refresh tokens
    "corsheaders",  # lets the Next.js website call this API
    # --- Our own Talent Hub apps ---
    "accounts",
    "profiles",
    "connections",
    "app_config",
    "admin_panel",
    "recruiter",
    "ai",
    "reports",
    "jobs",
]

# Middleware = checkpoints every request passes through, top to bottom.
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # must be FIRST so CORS headers are always added
    "django.middleware.security.SecurityMiddleware",  # HTTPS redirect + security headers
    # WhiteNoise serves our CSS/JS files (like the Django admin styles) in
    # production. It must come right after SecurityMiddleware.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",  # CSRF checks (for normal Django views like admin)
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",  # stops other sites framing ours
]

ROOT_URLCONF = "config.urls"

# Where Django's built-in admin site lives. "admin/" on your laptop; on the
# real website choose something hard to guess, e.g. "staff-7f3k2/".
# Must end with "/" (and must not start with one).
DJANGO_ADMIN_URL = str(config("DJANGO_ADMIN_URL", default="admin/"))
if not DJANGO_ADMIN_URL.endswith("/") or DJANGO_ADMIN_URL.startswith("/"):
    raise ImproperlyConfigured('DJANGO_ADMIN_URL must look like "something/" (ends with /, no / at the start).')
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# =============================================================================
# 4. DATABASE (PostgreSQL)
# =============================================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", default=5432, cast=int),
        # Reuse an open connection for this many seconds instead of opening
        # a new one for every request. This makes the API faster.
        "CONN_MAX_AGE": (
            0 if "test" in sys.argv else config("DB_CONN_MAX_AGE", default=60, cast=int)
        ),
        # Before reusing an old connection, quickly check it still works.
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {
            # "prefer" = use encryption if the database supports it.
            # Online databases (like Render's) usually need "require".
            "sslmode": config("DB_SSLMODE", default="require" if not DEBUG else "prefer"),
        },
    }
}

# Keep the test suite independent from the shared development database.
if "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }


# =============================================================================
# 4b. PASSWORD RULES
# =============================================================================

# Django checks new passwords against these rules (used by createsuperuser,
# the admin site, and our signup / password-reset code).
AUTH_PASSWORD_VALIDATORS = [
    # Not too similar to the user's name or email
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    # At least 8 characters
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    # Not a common password like "password123"
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    # Not only numbers
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# =============================================================================
# 5. LOGIN TOKENS (JWT IN httpOnly COOKIES)
# =============================================================================

# How long each token lives. This is the ONE place these numbers are set.
JWT_ACCESS_TOKEN_LIFETIME = timedelta(
    minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=30, cast=int)
)
JWT_REFRESH_TOKEN_LIFETIME = timedelta(
    days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": JWT_ACCESS_TOKEN_LIFETIME,
    "REFRESH_TOKEN_LIFETIME": JWT_REFRESH_TOKEN_LIFETIME,
    "ROTATE_REFRESH_TOKENS": True,  # give a NEW refresh token every time it is used
    "BLACKLIST_AFTER_ROTATION": True,  # and make the OLD one useless
}

# Names of the cookies that hold the tokens.
JWT_ACCESS_COOKIE = "access_token"
JWT_REFRESH_COOKIE = "refresh_token"

# Cookie age is CALCULATED from the token lifetime, so they always match.
JWT_ACCESS_COOKIE_MAX_AGE_SECONDS = int(JWT_ACCESS_TOKEN_LIFETIME.total_seconds())
JWT_REFRESH_COOKIE_MAX_AGE_SECONDS = int(JWT_REFRESH_TOKEN_LIFETIME.total_seconds())

# Secure=True -> the browser only sends the cookie over https.
# Off on your laptop (http://localhost), on automatically in production.
JWT_COOKIE_SECURE = config("JWT_COOKIE_SECURE", default=not DEBUG, cast=bool)

# SameSite controls when the browser sends the cookie to another website.
# "Lax" is right for us: the cookies belong to the frontend's own address
# (because of the Next.js proxy), so they are always "same site".
JWT_COOKIE_SAMESITE = config(
    "JWT_COOKIE_SAMESITE",
    default="Lax",
    cast=Choices(["Lax", "Strict", "None"]),
)

# Browsers throw away SameSite=None cookies that are not also Secure.
if JWT_COOKIE_SAMESITE == "None" and not JWT_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "JWT_COOKIE_SAMESITE=None only works when JWT_COOKIE_SECURE=True."
    )


# =============================================================================
# 6. DJANGO REST FRAMEWORK
# =============================================================================

# JSON is always on. The clickable "browsable API" page is only for DEBUG.
api_renderers = ["rest_framework.renderers.JSONRenderer"]
if DEBUG:
    api_renderers.append("rest_framework.renderers.BrowsableAPIRenderer")

REST_FRAMEWORK = {
    # Our own class reads the JWT from the cookie and checks CSRF
    # (see accounts/authentication.py).
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.CookieJWTAuthentication",
    ],
    # Safe default: every endpoint needs login unless a view says otherwise.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": api_renderers,
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardResultsPagination",
    # Every error gets a "message" field the frontend can show
    # (see config/exception_handler.py).
    "EXCEPTION_HANDLER": "config.exception_handler.api_exception_handler",
    # Rate limits ("throttles") stop people from guessing passwords or codes
    # by trying again and again. "10/min" = 10 tries per minute.
    # "auth_email" counts tries per email address (see accounts/throttles.py).
    # "signup" counts ALL new sign-ups on the whole site together, so nobody
    # can create thousands of fake accounts (and make us send thousands of emails).
    "DEFAULT_THROTTLE_RATES": {
        "auth_email": config("AUTH_EMAIL_THROTTLE_RATE", default="10/min"),
        "signup": config("SIGNUP_THROTTLE_RATE", default="30/hour"),
        # Wrong-password tries on "Delete my account", per logged-in user.
        "delete_account": "5/hour",
        # Anti-spam, per logged-in user (see connections/throttles.py).
        # Generous for real people, but stops scripts flooding everyone.
        "connection_request": config("CONNECTION_REQUEST_THROTTLE_RATE", default="40/hour"),
        "message": config("MESSAGE_THROTTLE_RATE", default="30/min"),
        # Reports about a profile or message (reports/throttles.py).
        "report": config("REPORT_THROTTLE_RATE", default="10/hour"),
    },
}


# Lists use safe, small pages. The same limits are shared by all API clients.
API_PAGE_SIZE = 20
API_MAX_PAGE_SIZE = 100


# =============================================================================
# 6b. CACHE (shared memory for the rate limits)
# =============================================================================

# The rate limits above need to remember "how many tries so far".
# Django's default cache lives inside ONE server process, so with several
# gunicorn workers each worker counted separately (10/min became 40/min).
# Keeping the counts in a database table means every worker shares them.
#
# ONE-TIME SETUP (on your laptop AND on Render):
#     python manage.py createcachetable
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",  # the table name
    }
}


# =============================================================================
# 7. CORS AND CSRF (letting Next.js talk to Django safely)
# =============================================================================

# HOW THE FRONTEND REACHES DJANGO
#   Browser  ->  Next.js proxy (/api/backend/...)  ->  Django
# The proxy forwards the browser's "Origin" and "X-CSRFToken" headers,
# so Django's CSRF check still knows which website sent the request.

# The frontend addresses allowed to call this API. No trailing slash!
# Laptop: "http://localhost:3000"   Production: "https://app.com"
# cast(list[str], ...) does nothing when the code runs. It only tells
# the type checker (VS Code / django-stubs) "this is a list of text".
CORS_ALLOWED_ORIGINS = cast(
    list[str],
    config("CORS_ALLOWED_ORIGINS", cast=Csv()),
)

# Allow the browser to send our cookies along with API requests.
CORS_ALLOW_CREDENTIALS = True

# Websites trusted to send POST/PUT/DELETE requests.
# If you don't set it, we reuse the CORS list (usually the same thing).
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default=",".join(CORS_ALLOWED_ORIGINS),
    cast=Csv(),
)

# Session + CSRF cookies: https-only in production, just like the JWT cookies.
SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=not DEBUG, cast=bool)
SESSION_COOKIE_HTTPONLY = True  # JavaScript can never read the session cookie
CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=not DEBUG, cast=bool)

# The CSRF cookie must stay readable by JavaScript (this is Django's default).
# The frontend copies its value into the "X-CSRFToken" header.
# This is safe: a CSRF token is useless to attackers on OTHER websites,
# because they cannot read our cookies.
CSRF_COOKIE_HTTPONLY = False

# NOTE: we do NOT set CSRF_COOKIE_DOMAIN.
# The browser never talks to Django directly. It talks to the Next.js
# proxy (app/api/backend/[...path]/route.ts), and the proxy passes the
# cookies along. So every cookie belongs to the frontend's own address,
# which is exactly what we want.


# =============================================================================
# 8. HTTPS SECURITY (only for the real website)
# =============================================================================

if not DEBUG:
    # Send anyone who visits http:// to https:// instead.
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)

    # On Render (or a VPS with Nginx), a "proxy" handles https and then
    # talks to Django over plain http. It adds the X-Forwarded-Proto header
    # to tell Django "the visitor really used https". Trust that header.
    # Only turn this off if nothing sits in front of Django.
    if config("TRUST_PROXY_SSL_HEADER", default=True, cast=bool):
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    # HSTS tells browsers: "always use https for this site".
    # Start small (1 hour). Raise it later once everything works.
    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=3600, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = config(
        "SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False, cast=bool
    )


# =============================================================================
# 9. LANGUAGE AND TIME
# =============================================================================

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"  # store all times in UTC; the frontend shows local time
USE_I18N = True
USE_TZ = True


# =============================================================================
# 10. FILES: STATIC (CSS/JS) AND MEDIA (user uploads)
# =============================================================================

STATIC_URL = "static/"
# `python manage.py collectstatic` copies all CSS/JS here (e.g. admin styles).
STATIC_ROOT = BASE_DIR / "staticfiles"

# Files users upload (CVs). They are NOT public: they are only sent
# through the logged-in CV download view (profiles/views.py).
# On Render this folder is wiped on every deploy, so production needs a
# persistent disk or cloud storage (see the audit notes).
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Where Django keeps files:
#   "default"     -> uploads (CVs), saved in MEDIA_ROOT
#   "staticfiles" -> CSS/JS. In production WhiteNoise squeezes them (smaller
#                    downloads) and adds a version code to each file name, so
#                    browsers can safely keep them for a long time.
#                    (This needs `python manage.py collectstatic` before
#                    starting the server, which is normal on Render.)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}


# =============================================================================
# 11. EMAIL
# =============================================================================

# On your laptop, emails are PRINTED in the terminal (no Gmail setup needed).
# In production, they are really sent through SMTP.
if DEBUG:
    default_email_backend = "django.core.mail.backends.console.EmailBackend"
else:
    default_email_backend = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_BACKEND = config("EMAIL_BACKEND", default=default_email_backend)
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_TIMEOUT = config("EMAIL_TIMEOUT", default=10, cast=int)  # seconds

# The NAME people see as the sender in their inbox (Gmail shows this in bold,
# instead of the bare address). Change it in .env with EMAIL_SENDER_NAME.
EMAIL_SENDER_NAME = str(config("EMAIL_SENDER_NAME", default="ProfessionalHub"))

# The sender ADDRESS (must be your Gmail account when you send through Gmail).
_sender_address = str(config("DEFAULT_FROM_EMAIL", default="webmaster@localhost"))

# Put them together: "ProfessionalHub <you@gmail.com>".
# formataddr adds quotes if the name has special characters.
# (If .env already says "Some Name <you@gmail.com>", we keep that as it is.)
if "<" in _sender_address:
    DEFAULT_FROM_EMAIL = _sender_address
else:
    DEFAULT_FROM_EMAIL = formataddr((EMAIL_SENDER_NAME, _sender_address))


# =============================================================================
# 12. ONE-TIME CODES (OTP) FOR PASSWORD RESET AND EMAIL VERIFICATION
# =============================================================================

# Password reset codes
PASSWORD_RESET_OTP_EXPIRY_MINUTES = config(
    "PASSWORD_RESET_OTP_EXPIRY_MINUTES", default=10, cast=int
)
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = config(
    "PASSWORD_RESET_RESEND_COOLDOWN_SECONDS", default=60, cast=int
)
PASSWORD_RESET_MAX_ATTEMPTS = config("PASSWORD_RESET_MAX_ATTEMPTS", default=5, cast=int)

# Email verification codes
EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES = config(
    "EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES", default=10, cast=int
)
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = config(
    "EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS", default=60, cast=int
)
EMAIL_VERIFICATION_MAX_ATTEMPTS = config(
    "EMAIL_VERIFICATION_MAX_ATTEMPTS", default=5, cast=int
)


# =============================================================================
# 12b. DELETED ACCOUNTS
# =============================================================================

# A deleted account can be restored (by signing in) for this many days.
# After that, `python manage.py purge_deleted_accounts` (run once a day)
# deletes it for good.
ACCOUNT_DELETION_GRACE_DAYS = config("ACCOUNT_DELETION_GRACE_DAYS", default=30, cast=int)
# "Your account will be deleted in N days" emails, this many days before the end.
ACCOUNT_DELETION_WARNING_DAYS = (7, 1)

# The website people use (for links in emails). Defaults to the first
# frontend address in CORS_ALLOWED_ORIGINS.
FRONTEND_URL = str(config("FRONTEND_URL", default=CORS_ALLOWED_ORIGINS[0])).rstrip("/")


# =============================================================================
# 12c. AI FEATURES (see ai/provider.py)
# =============================================================================

# The AI is a free open model that runs on our own machine with Ollama, so no
# profile or job text is sent to an AI company. Set it up once:
#   1. Install Ollama (https://ollama.com)   2. ollama pull qwen2.5:3b
# If Ollama isn't running, the app still works: AI buttons say "AI is unavailable right now".
# Only point AI_BASE_URL at a server WE run, never at an AI company's API.
AI_BASE_URL = str(config("AI_BASE_URL", default="http://127.0.0.1:11434/v1"))
AI_MODEL = str(config("AI_MODEL", default="qwen2.5:3b"))
# Must stay below the Next.js proxy's 30 seconds (PROXY_TIMEOUT_MS), or the
# browser gets the proxy's error instead of our "AI is unavailable" message.
AI_TIMEOUT_SECONDS = config("AI_TIMEOUT_SECONDS", default=25, cast=int)
# How many AI uses one person gets per day, for all AI buttons together (restarts at midnight UTC).
AI_DAILY_LIMIT = config("AI_DAILY_LIMIT", default=10, cast=int)


# =============================================================================
# 13. LOGGING (so you can SEE errors in production)
# =============================================================================

# Without this, Django hides error details when DEBUG=False,
# and your Render logs would show nothing when the site crashes.
LOG_LEVEL = config(
    "LOG_LEVEL",
    default="INFO",
    cast=Choices(["DEBUG", "INFO", "WARNING", "ERROR"]),
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},  # print to the terminal/logs
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        # Django's own messages (including server errors).
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}


# =============================================================================
# 14. DATABASE ID TYPE
# =============================================================================

# Django 6.0 already uses BigAutoField (large numeric IDs) by default,
# so we don't need to set DEFAULT_AUTO_FIELD here.
