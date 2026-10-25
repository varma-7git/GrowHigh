from datetime import date, timedelta

from django.core import mail
from rest_framework.test import APITestCase

from academics.models import Branch
from accounts import services
from accounts.models import CompanyProfile, User
from common.constants import ReviewStatus, Role

PWD = "Passw0rd123"
COMPANY = {
    "company_name": "Acme Tech", "full_name": "Ravi Kumar", "designation": "HR Manager", "login_id": "acme",
    "email": "hr@acme.test", "phone": "9999999999", "password": PWD, "confirm_password": PWD,
}


class CompanyAndJobFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cse = Branch.objects.create(name="Computer Engineering", code="CME")
        cls.civ = Branch.objects.create(name="Civil Engineering", code="CIV")
        cls.admin = User.objects.create_superuser("admin", PWD, email="admin@gh.test")
        cls.s1 = services.create_student(login_id="S1", password=PWD, full_name="Stu One", email="s1@t.test", branch=cls.cse, year_of_study=3)
        cls.s2 = services.create_student(login_id="S2", password=PWD, full_name="Stu Two", email="s2@t.test", branch=cls.civ, year_of_study=3)
        cls.s3 = services.create_student(login_id="S3", password=PWD, full_name="Stu Three", email="s3@t.test", branch=cls.cse, year_of_study=2)

    def _approved_company(self):
        r = self.client.post("/api/v1/auth/register-company/", COMPANY, format="json")
        self.assertEqual(r.status_code, 201)
        profile = CompanyProfile.objects.get(company_name="Acme Tech")
        profile.status = ReviewStatus.APPROVED
        profile.save()
        return profile.user

    def test_company_registers_admin_is_emailed_and_login_blocked_until_approved(self):
        r = self.client.post("/api/v1/auth/register-company/", COMPANY, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "PENDING")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("admin@gh.test", mail.outbox[0].to)
        login = self.client.post("/api/v1/auth/login/", {"login_id": "acme", "password": PWD}, format="json")
        self.assertEqual(login.status_code, 403)
        self.assertIn("waiting for admin approval", login.data["detail"])

    def test_admin_approves_then_company_can_login(self):
        self.client.post("/api/v1/auth/register-company/", COMPANY, format="json")
        cid = CompanyProfile.objects.get().id
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/companies/?status=PENDING").data["count"], 1)
        self.assertEqual(self.client.post(f"/api/v1/companies/{cid}/approve/").status_code, 200)
        self.client.force_authenticate(None)
        login = self.client.post("/api/v1/auth/login/", {"login_id": "acme", "password": PWD}, format="json")
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data["user"]["company_status"], "APPROVED")

    def test_rejected_company_sees_reason(self):
        self.client.post("/api/v1/auth/register-company/", COMPANY, format="json")
        cid = CompanyProfile.objects.get().id
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/v1/companies/{cid}/reject/", {}, format="json").status_code, 400)
        self.client.post(f"/api/v1/companies/{cid}/reject/", {"reason": "Not verified"}, format="json")
        self.client.force_authenticate(None)
        login = self.client.post("/api/v1/auth/login/", {"login_id": "acme", "password": PWD}, format="json")
        self.assertEqual(login.status_code, 403)
        self.assertIn("Not verified", login.data["detail"])

    def test_only_admin_reviews_companies(self):
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get("/api/v1/companies/").status_code, 403)

    def test_company_job_needs_admin_approval_then_students_apply(self):
        company = self._approved_company()
        self.client.force_authenticate(company)
        body = {"title": "Python Intern", "job_type": "INTERNSHIP", "description": "Learn Django", "branch_ids": [self.cse.id],
                "deadline": str(date.today() + timedelta(days=10))}
        r = self.client.post("/api/v1/jobs/", body, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "PENDING")
        self.assertEqual(r.data["company_name"], "Acme Tech")
        job_id = r.data["id"]

        self.client.force_authenticate(self.s1)  # pending job is hidden from students
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 0)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/approve/").data["status"], "APPROVED")

        self.client.force_authenticate(self.s1)
        listing = self.client.get("/api/v1/jobs/").data
        self.assertEqual(listing["count"], 1)
        self.assertNotIn("applicant_count", listing["results"][0])
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/apply/").status_code, 201)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/apply/").status_code, 409)

        self.client.force_authenticate(self.s3)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/apply/").status_code, 201)

        self.client.force_authenticate(self.s2)  # Civil student: job is for Computer Engineering only
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 0)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/apply/").status_code, 404)

        self.client.force_authenticate(self.admin)  # admin sees the count per course
        stats = self.client.get(f"/api/v1/jobs/{job_id}/application-stats/").data
        self.assertEqual(stats["total"], 2)
        self.assertEqual(stats["by_branch"], [{"branch_id": self.cse.id, "branch_name": "Computer Engineering", "count": 2}])
        summary = self.client.get("/api/v1/jobs/applications-summary/?job_type=INTERNSHIP").data
        self.assertEqual(summary[0]["total"], 2)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}/applications/").data["count"], 2)

        self.client.force_authenticate(company)  # the company sees its own applicants
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}/applications/").data["count"], 2)

    def test_company_cannot_approve_or_see_other_jobs(self):
        company = self._approved_company()
        admin_job = self._admin_job()
        self.client.force_authenticate(company)
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 0)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{admin_job}/approve/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{admin_job}/applications/").status_code, 404)

    def _admin_job(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/v1/jobs/", {"title": "Trainee", "company_name": "Infra Ltd", "job_type": "JOB", "description": "x"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "APPROVED")
        return r.data["id"]

    def test_admin_job_is_live_and_needs_company_name(self):
        self.client.force_authenticate(self.admin)
        bad = self.client.post("/api/v1/jobs/", {"title": "T", "job_type": "JOB", "description": "x"}, format="json")
        self.assertEqual(bad.status_code, 400)
        job_id = self._admin_job()
        self.client.force_authenticate(self.s2)
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 1)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/apply/").status_code, 201)
        self.assertEqual(self.client.get("/api/v1/my-applications/").data["count"], 1)

    def test_editing_an_approved_job_sends_it_back_for_review(self):
        company = self._approved_company()
        self.client.force_authenticate(company)
        job_id = self.client.post("/api/v1/jobs/", {"title": "A", "job_type": "JOB", "description": "x"}, format="json").data["id"]
        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/v1/jobs/{job_id}/approve/")
        self.client.force_authenticate(company)
        r = self.client.patch(f"/api/v1/jobs/{job_id}/", {"title": "A2"}, format="json")
        self.assertEqual(r.data["status"], "PENDING")
        r = self.client.patch(f"/api/v1/jobs/{job_id}/", {"is_active": False}, format="json")  # closing keeps the status
        self.assertFalse(r.data["is_active"])
