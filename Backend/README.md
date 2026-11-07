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

The AI is free and private: an open model (Qwen 2.5 3B) runs on your own machine with
[llama.cpp](https://github.com/ggml-org/llama.cpp), so no profile or job text is sent to an AI company.
(The `openai` package is only the client; llama.cpp understands the same API.)

Set it up once (Windows):

1. Download `llama-<build>-bin-win-cpu-x64.zip` from the llama.cpp releases page and unzip it to
   `%LOCALAPPDATA%\llama.cpp\bin`.
2. Download the model `qwen2.5-3b-instruct-q4_k_m.gguf` (about 2 GB) from
   https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF into `%LOCALAPPDATA%\llama.cpp\models`.

Start it (keep this window open while you use the app):

```
"%LOCALAPPDATA%\llama.cpp\bin\llama-server.exe" -m "%LOCALAPPDATA%\llama.cpp\models\qwen2.5-3b-instruct-q4_k_m.gguf" --host 127.0.0.1 --port 8080 -c 4096
```

- Without it the app still works, and the AI buttons say "AI is unavailable right now".
- [Ollama](https://ollama.com) works too: set `AI_BASE_URL=http://127.0.0.1:11434/v1` and `AI_MODEL=qwen2.5:3b`.
- `AI_BASE_URL`, `AI_MODEL` and `AI_TIMEOUT_SECONDS` change where and which model runs.
  `AI_DAILY_LIMIT` sets the uses per person per day, for all AI buttons together (default 10).
- On a server, llama.cpp (or Ollama) must run there too (it needs a few GB of RAM). Only point `AI_BASE_URL` at a server you run.
- `python manage.py test ai` never calls the real AI, so it's fast and needs no local AI running.

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
