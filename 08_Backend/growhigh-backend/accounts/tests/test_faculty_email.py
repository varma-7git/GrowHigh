from django.core import mail
from rest_framework.test import APITestCase

from accounts.models import FacultyProfile, User

API = "/api/v1"
FAC = {"full_name": "Lakshmi Devi", "login_id": "FAC100", "email": "lakshmi@x.com", "phone": "9999999999",
       "department": "Computer Engineering", "password": "Strong@123", "confirm_password": "Strong@123"}


class FacultyAndEmailTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin", "Admin@12345", full_name="Admin", email="admin@x.com")

    def test_check_email(self):
        r = self.client.get(f"{API}/auth/check-email/", {"email": "new@x.com"})
        self.assertEqual((r.status_code, r.data["available"]), (200, True))
        r = self.client.get(f"{API}/auth/check-email/", {"email": "ADMIN@x.com"})
        self.assertEqual(r.data["available"], False)
        self.assertEqual(self.client.get(f"{API}/auth/check-email/", {"email": "bad"}).status_code, 400)

    def test_faculty_registers_waits_then_logs_in_with_email(self):
        r = self.client.post(f"{API}/auth/register-faculty/", FAC, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "PENDING")
        self.assertIn("admin@x.com", mail.outbox[0].to)
        blocked = self.client.post(f"{API}/auth/login/", {"login_id": "lakshmi@x.com", "password": "Strong@123"}, format="json")
        self.assertEqual(blocked.status_code, 403)
        self.client.force_authenticate(self.admin)
        fid = FacultyProfile.objects.get().id
        self.assertEqual(self.client.get(f"{API}/faculty-requests/?status=PENDING").data["count"], 1)
        self.assertEqual(self.client.post(f"{API}/faculty-requests/{fid}/approve/").status_code, 200)
        self.client.force_authenticate(None)
        ok = self.client.post(f"{API}/auth/login/", {"login_id": "Lakshmi@X.com", "password": "Strong@123"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["user"]["role"], "FACULTY")

    def test_rejected_faculty_sees_reason(self):
        self.client.post(f"{API}/auth/register-faculty/", FAC, format="json")
        self.client.force_authenticate(self.admin)
        fid = FacultyProfile.objects.get().id
        self.client.post(f"{API}/faculty-requests/{fid}/reject/", {"reason": "Not on staff list"}, format="json")
        self.client.force_authenticate(None)
        r = self.client.post(f"{API}/auth/login/", {"login_id": "FAC100", "password": "Strong@123"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertIn("Not on staff list", r.data["detail"])

    def test_admin_created_faculty_is_approved_at_once(self):
        self.client.force_authenticate(self.admin)
        body = {"login_id": "FAC200", "full_name": "F Two", "email": "f2@x.com", "password": "Strong@123", "department": "Civil"}
        self.assertEqual(self.client.post(f"{API}/users/", body, format="json").status_code, 201)
        self.client.force_authenticate(None)
        r = self.client.post(f"{API}/auth/login/", {"login_id": "f2@x.com", "password": "Strong@123"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_forgot_password_with_email_sends_mail(self):
        self.client.post(f"{API}/auth/register-faculty/", FAC, format="json")
        mail.outbox.clear()
        r = self.client.post(f"{API}/auth/forgot-password/", {"login_id": "lakshmi@x.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(mail.outbox[0].to, ["lakshmi@x.com"])
