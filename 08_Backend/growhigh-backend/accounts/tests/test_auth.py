import re

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from rest_framework.test import APITestCase

from academics.models import Branch
from accounts.models import User

API = "/api/v1"


class AuthTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Computer Science and Engineering", code="CSE")
        self.admin = User.objects.create_superuser("admin", "Admin@12345", full_name="Admin", email="admin@x.com")
        self.reg = {"full_name": "Arjun Kumar", "login_id": "21001-CM-001", "email": "arjun@x.com", "password": "Strong@123",
                    "confirm_password": "Strong@123", "branch_id": self.branch.id, "year_of_study": 2}

    def login(self, login_id, password):
        r = self.client.post(f"{API}/auth/login/", {"login_id": login_id, "password": password}, format="json")
        return r

    def auth(self, login_id, password):
        r = self.login(login_id, password)
        self.assertEqual(r.status_code, 200, r.data)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        return r.data

    def test_register_login_me(self):
        r = self.client.post(f"{API}/auth/register/", self.reg, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["role"], "STUDENT")
        data = self.auth("21001-CM-001", "Strong@123")
        self.assertEqual(data["user"]["branch"]["code"], "CSE")
        me = self.client.get(f"{API}/auth/me/")
        self.assertEqual(me.data["login_id"], "21001-CM-001")

    def test_duplicate_roll_number_and_weak_password(self):
        self.client.post(f"{API}/auth/register/", self.reg, format="json")
        r = self.client.post(f"{API}/auth/register/", self.reg, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("errors", r.data)
        weak = dict(self.reg, login_id="X1", email="x@x.com", password="abc", confirm_password="abc")
        self.assertEqual(self.client.post(f"{API}/auth/register/", weak, format="json").status_code, 400)

    def test_wrong_password_is_401(self):
        self.assertEqual(self.login("admin", "wrong").status_code, 401)

    def test_login_id_cannot_change(self):
        self.client.post(f"{API}/auth/register/", self.reg, format="json")
        self.auth("21001-CM-001", "Strong@123")
        r = self.client.patch(f"{API}/auth/me/", {"login_id": "HACK"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_student_cannot_list_users_but_admin_can(self):
        self.client.post(f"{API}/auth/register/", self.reg, format="json")
        self.auth("21001-CM-001", "Strong@123")
        self.assertEqual(self.client.get(f"{API}/users/").status_code, 403)
        self.client.credentials()
        self.auth("admin", "Admin@12345")
        r = self.client.get(f"{API}/users/?role=STUDENT")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)

    def test_no_token_is_401(self):
        self.assertEqual(self.client.get(f"{API}/users/").status_code, 401)

    def test_admin_creates_faculty_and_resets_password(self):
        self.auth("admin", "Admin@12345")
        r = self.client.post(f"{API}/users/", {"login_id": "FAC-01", "full_name": "Meera", "email": "meera@x.com",
                                               "password": "Faculty@123", "department": "CSE"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        r2 = self.client.post(f"{API}/users/{r.data['id']}/reset-password/")
        self.assertEqual(r2.status_code, 200)
        self.client.credentials()
        self.auth("FAC-01", r2.data["temporary_password"])

    def test_admin_cannot_deactivate_self(self):
        self.auth("admin", "Admin@12345")
        r = self.client.patch(f"{API}/users/{self.admin.id}/", {"is_active": False}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_deactivated_user_cannot_login(self):
        self.client.post(f"{API}/auth/register/", self.reg, format="json")
        User.objects.filter(login_id="21001-CM-001").update(is_active=False)
        self.assertEqual(self.login("21001-CM-001", "Strong@123").status_code, 401)

    def test_logout_blacklists_refresh(self):
        data = self.auth("admin", "Admin@12345")
        self.assertEqual(self.client.post(f"{API}/auth/logout/", {"refresh": data["refresh"]}, format="json").status_code, 204)
        self.assertEqual(self.client.post(f"{API}/auth/refresh/", {"refresh": data["refresh"]}, format="json").status_code, 401)

    def test_forgot_and_reset_password(self):
        self.client.post(f"{API}/auth/register/", self.reg, format="json")
        known = self.client.post(f"{API}/auth/forgot-password/", {"login_id": "21001-CM-001"}, format="json")
        unknown = self.client.post(f"{API}/auth/forgot-password/", {"login_id": "NOPE"}, format="json")
        self.assertEqual(known.data, unknown.data)  # same reply: no user guessing
        self.assertEqual(len(mail.outbox), 1)
        token = re.search(r"\n\n(\S+)\n\n", mail.outbox[0].body).group(1)
        bad = self.client.post(f"{API}/auth/reset-password/", {"login_id": "21001-CM-001", "token": "bad",
                               "new_password": "NewPass@123", "confirm_password": "NewPass@123"}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(f"{API}/auth/reset-password/", {"login_id": "21001-CM-001", "token": token,
                              "new_password": "NewPass@123", "confirm_password": "NewPass@123"}, format="json")
        self.assertEqual(ok.status_code, 204, getattr(ok, "data", None))
        self.assertEqual(self.login("21001-CM-001", "NewPass@123").status_code, 200)
