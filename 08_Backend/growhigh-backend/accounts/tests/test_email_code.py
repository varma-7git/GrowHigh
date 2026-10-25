import re

from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from academics.models import Branch

API = "/api/v1"


@override_settings(REQUIRE_EMAIL_VERIFICATION=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmailCodeTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Computer Engineering", code="CME")
        self.payload = {"full_name": "A B", "login_id": "21001-CM-009", "email": "real@example.com", "branch_id": self.branch.pk,
                        "year_of_study": 2, "password": "Passw0rd!x", "confirm_password": "Passw0rd!x"}

    def _token(self, email="real@example.com"):
        self.assertEqual(self.client.post(f"{API}/auth/send-email-code/", {"email": email}).status_code, 200)
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        r = self.client.post(f"{API}/auth/verify-email-code/", {"email": email, "code": code})
        self.assertEqual(r.status_code, 200)
        return r.data["token"]

    def test_register_needs_proof_then_works(self):
        self.assertEqual(self.client.post(f"{API}/auth/register/", self.payload).status_code, 400)
        r = self.client.post(f"{API}/auth/register/", {**self.payload, "email_token": self._token()})
        self.assertEqual(r.status_code, 201)

    def test_wrong_code_and_wrong_email_token_fail(self):
        self.client.post(f"{API}/auth/send-email-code/", {"email": "real@example.com"})
        self.assertEqual(self.client.post(f"{API}/auth/verify-email-code/", {"email": "real@example.com", "code": "000000"}).status_code, 400)
        token = self._token("other@example.com")
        self.assertEqual(self.client.post(f"{API}/auth/register/", {**self.payload, "email_token": token}).status_code, 400)
