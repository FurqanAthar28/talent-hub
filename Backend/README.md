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
