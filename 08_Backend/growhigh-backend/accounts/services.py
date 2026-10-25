import secrets
import string

import hmac
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone
from django.core.mail import send_mail
from django.db import transaction

from common.constants import ReviewStatus, Role

from .models import CompanyProfile, EmailCode, FacultyProfile, StudentProfile, User


@transaction.atomic
def create_student(*, login_id, password, full_name, email, branch, year_of_study, phone=None, college_name=None, regulation=None):
    user = User.objects.create_user(login_id=login_id, password=password, full_name=full_name, email=email, phone=phone, role=Role.STUDENT)
    StudentProfile.objects.create(user=user, branch=branch, year_of_study=year_of_study, college_name=college_name, regulation=regulation)
    return user


@transaction.atomic
def create_faculty(*, login_id, password, full_name, email, department, phone=None, status=ReviewStatus.APPROVED):
    user = User.objects.create_user(login_id=login_id, password=password, full_name=full_name, email=email, phone=phone, role=Role.FACULTY)
    FacultyProfile.objects.create(user=user, department=department, status=status)
    return user


def find_user(identifier):
    """Find a user by email (if it has @) or by login ID."""
    identifier = (identifier or "").strip()
    if "@" in identifier:
        return User.objects.filter(email__iexact=identifier).first()
    return User.objects.filter(login_id=identifier).first()


@transaction.atomic
def register_faculty(*, login_id, password, full_name, email, department, phone=None):
    user = create_faculty(login_id=login_id, password=password, full_name=full_name, email=email,
                          department=department, phone=phone, status=ReviewStatus.PENDING)
    notify_admins(
        f"New faculty registration: {full_name}",
        f"{full_name} ({department}) has registered as faculty and is waiting for approval.\n\n"
        f"Faculty ID: {login_id}\nEmail: {email}\nPhone: {phone or 'n/a'}\n\n"
        "Open the admin dashboard, Faculty requests, to approve or reject.",
    )
    return user.faculty_profile


def notify_user(user, subject, body):
    """Email one user (for example: your account was approved). Never breaks the request."""
    if not user.email:
        return
    try:
        send_mail(subject, body, None, [user.email])
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Could not email %s", user.email)


def notify_admins(subject, body):
    """Email every active admin that has an email address. Never breaks the request."""
    emails = list(User.objects.filter(role=Role.ADMIN, is_active=True, email__isnull=False).values_list("email", flat=True))
    if not emails:
        return
    try:
        send_mail(subject, body, None, emails)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Could not email admins")


@transaction.atomic
def create_company(*, login_id, password, full_name, email, phone, company_name, designation=None, website=None,
                   location=None, description=None):
    user = User.objects.create_user(login_id=login_id, password=password, full_name=full_name, email=email, phone=phone, role=Role.COMPANY)
    profile = CompanyProfile.objects.create(user=user, company_name=company_name, designation=designation,
                                            website=website, location=location, description=description)
    notify_admins(
        f"New company registration: {company_name}",
        f"{company_name} has registered and is waiting for approval.\n\nContact person: {full_name} ({designation or 'n/a'})\n"
        f"Email: {email}\nPhone: {phone}\n\nOpen the admin dashboard, Companies, to approve or reject.",
    )
    return profile


def generate_temp_password(length=10):
    """Random password with at least one letter and one digit."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isalpha() for c in pwd) and any(c.isdigit() for c in pwd):
            return pwd


# ---------- email ownership check (6-digit code) ----------
CODE_MINUTES = 10
TOKEN_SECONDS = 30 * 60
MAX_ATTEMPTS = 5


def _hash_code(email, code):
    return signing.salted_hmac("email-code", f"{email}:{code}").hexdigest()


def send_email_code(email):
    """Email a fresh 6-digit code. Raises ValueError when the mail server refuses the address."""
    email = email.strip().lower()
    EmailCode.objects.filter(email=email).delete()
    code = f"{secrets.randbelow(10 ** 6):06d}"
    EmailCode.objects.create(email=email, code_hash=_hash_code(email, code))
    try:
        send_mail("Your GrowHigh verification code",
                  f"Your GrowHigh verification code is {code}.\n\nIt works for {CODE_MINUTES} minutes. "
                  "If you did not ask for it, ignore this email.", None, [email], fail_silently=False)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("Could not send a code to %s", email)
        raise ValueError("We could not send a code to this address. Check the email and try again.") from exc


def check_email_code(email, code):
    """Return a signed token (valid 30 minutes) when the code is right, else None."""
    email = email.strip().lower()
    row = EmailCode.objects.filter(email=email, created_at__gte=timezone.now() - timedelta(minutes=CODE_MINUTES)).first()
    if not row or row.attempts >= MAX_ATTEMPTS:
        return None
    row.attempts += 1
    row.save(update_fields=["attempts"])
    if not hmac.compare_digest(row.code_hash, _hash_code(email, (code or "").strip())):
        return None
    row.delete()
    return signing.dumps({"email": email}, salt="email-verified")


def token_is_valid(email, token):
    if not getattr(settings, "REQUIRE_EMAIL_VERIFICATION", True):
        return True
    try:
        data = signing.loads(token or "", salt="email-verified", max_age=TOKEN_SECONDS)
    except signing.BadSignature:
        return False
    return data.get("email") == (email or "").strip().lower()
