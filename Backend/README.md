# Talent Hub Backend

## Database source of truth

This backend uses PostgreSQL for local and production data. The active database connection is configured in `.env` with these variables:

- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`

Do not use `Backend/db.sqlite3` for application data. That file is ignored by git and should not be treated as a live database. If profile content, UI content, skills, or users need to be checked or updated, use the PostgreSQL database configured by `.env`.

For this local setup, the current database is usually:

```text
DB_NAME=talent_hub
DB_HOST=127.0.0.1
DB_PORT=5432
```

Run Django migrations against PostgreSQL only:

```bat
python manage.py migrate
```

## First-time setup (your laptop)

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt   &:: app + type-checking tools (server: requirements.txt)
copy .env.example .env          &:: then fill in your real values
python manage.py migrate
python manage.py createcachetable  &:: table that remembers rate-limit counts
python manage.py create_admin      &:: your app admin (asks email, name, password)
python manage.py runserver
```

## Admins: two different kinds

| | App admin | Django admin (developers only) |
|---|---|---|
| Made with | `python manage.py create_admin` | `python manage.py createsuperuser` |
| Signs in at | the app's normal **Sign in** page | `http://localhost:8000/admin/` |
| Can do | approve recruiters, switch accounts on/off, change roles, connect people, edit page texts | edit raw database rows |
| Can sign in to the app? | yes | no (it's refused, on purpose) |

Other commands:

```bat
python manage.py create_admin --email ali@site.com --promote   &:: make an existing account an admin
python manage.py changepassword ali@site.com                   &:: new password (the username is the email)
```

On the app's admin page, admins can also make other people admins
(Users tab, Role). That never gives them the Django site.

## Running the tests

```bat
python manage.py test
```

Tests use a temporary in-memory SQLite database (see `config/settings.py`),
so they never touch your real PostgreSQL data. Only the last line matters:
`OK` means everything passed.

## AI features

All AI code lives in the `ai` app, and only `ai/provider.py` talks to the AI.

The AI is free and private: an open model runs on your own machine with [Ollama](https://ollama.com),
so no profile or job text is sent to an AI company. (The `openai` package is only the client;
Ollama understands the same API.)

- Install Ollama, then run `ollama pull qwen2.5:3b` once. Ollama keeps running in the background.
- Without Ollama the app still works, and the AI buttons say "AI is unavailable right now".
- `AI_BASE_URL`, `AI_MODEL` and `AI_TIMEOUT_SECONDS` change where and which model runs.
  `AI_DAILY_LIMIT` sets the uses per person per day, for all AI buttons together (default 10).
- On a server, Ollama must run there too (it needs a few GB of RAM). Only point `AI_BASE_URL` at a server you run.
- `python manage.py test ai` never calls the real AI, so it's free and needs no Ollama.

## Deploying (for example on Render)

Build command:

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate && python manage.py createcachetable
```

Start command:

```bash
gunicorn config.wsgi:application
```

- `collectstatic` gathers CSS/JS (like the Django admin styles). WhiteNoise serves them.
- Set `DJANGO_DEBUG=False` and all other values from `.env.example` in Render's environment settings.
- **Uploaded CVs need a persistent disk or cloud storage.** Render wipes the normal disk on every deploy.
