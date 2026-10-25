# GrowHigh Backend (Django + DRF + PostgreSQL)

Phase 8, step 1: project setup, accounts (login, register, forgot password, users) and academics (branches, subjects, topics).

## Run it (Windows Command Prompt, cmd; on Mac/Linux use `source venv/bin/activate` and `cp`)
Use Python 3.14 (or 3.12/3.13). If `python` is not found, use `py` instead for the first command: `py -m venv venv`.
```
cd growhigh-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements\dev.txt
copy .env.example .env          # then open .env and set DB_PASSWORD and SECRET_KEY
```
Create the database once (use your PostgreSQL password):
```
psql -U postgres -c "CREATE DATABASE growhigh;"
```
Then:
```
python manage.py makemigrations accounts academics
python manage.py migrate
python manage.py seed_academics
python manage.py create_admin admin --password "Admin@12345" --email you@example.com
python manage.py test accounts
python manage.py runserver
```
Open http://localhost:8000/api/docs/ (Swagger). Login with `admin` / `Admin@12345`, copy the access token, click Authorize.

Forgot-password emails are printed in the terminal in development.

## Notes
- `Subject.branch` can be empty: that means a common subject (Mathematics, Physics, Chemistry) for every branch.
- Token lifetimes (30 min / 1 day) and the 15 minute reset token are assumptions to confirm.
