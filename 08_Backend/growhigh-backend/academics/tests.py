from rest_framework.test import APITestCase

from accounts.models import User
from common.constants import Role

from .models import Branch


class PublicBranchListTests(APITestCase):
    def test_branch_list_is_public_and_active_only(self):
        Branch.objects.create(name="Computer Engineering", code="CME", is_active=True)
        Branch.objects.create(name="Hidden Branch", code="HID", is_active=False)
        r = self.client.get("/api/v1/branches/?page_size=100")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([b["code"] for b in r.data["results"]], ["CME"])

    def test_branch_detail_needs_login(self):
        b = Branch.objects.create(name="Civil", code="CIV")
        self.assertEqual(self.client.get(f"/api/v1/branches/{b.pk}/").status_code, 401)


class SafeDeleteTests(APITestCase):
    def setUp(self):
        from accounts.models import User
        from common.constants import Role
        self.admin = User.objects.create_user(login_id="adm", password="Passw0rd!x", full_name="A", role=Role.ADMIN)
        self.student = User.objects.create_user(login_id="stu", password="Passw0rd!x", full_name="S", role=Role.STUDENT)

    def test_non_admin_cannot_delete(self):
        from .models import Branch
        b = Branch.objects.create(name="Civil", code="CIV")
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.delete(f"/api/v1/branches/{b.pk}/").status_code, 403)

    def test_delete_blocked_when_linked_then_allowed(self):
        from .models import Branch, Subject, Topic
        b = Branch.objects.create(name="Civil", code="CIV")
        s = Subject.objects.create(branch=b, name="Surveying")
        t = Topic.objects.create(subject=s, name="Chains")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f"/api/v1/subjects/{s.pk}/").status_code, 409)
        self.assertEqual(self.client.delete(f"/api/v1/branches/{b.pk}/").status_code, 409)
        self.assertEqual(self.client.delete(f"/api/v1/topics/{t.pk}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/v1/subjects/{s.pk}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/v1/branches/{b.pk}/").status_code, 204)


class RegulationTests(APITestCase):
    def setUp(self):
        from accounts.models import User
        from common.constants import Role
        self.admin = User.objects.create_user(login_id="adm2", password="Passw0rd!x", full_name="A", role=Role.ADMIN)

    def test_list_is_public_and_active_only(self):
        from .models import Regulation
        Regulation.objects.create(code="C23")
        Regulation.objects.create(code="C20", is_active=False)
        r = self.client.get("/api/v1/regulations/?page_size=100")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["code"] for x in r.data["results"]], ["C23"])

    def test_admin_adds_regulation_and_curriculum_subject(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/v1/regulations/", {"code": "c26"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["code"], "C26")
        self.assertEqual(self.client.post("/api/v1/regulations/", {"code": "C26"}).status_code, 400)
        b = Branch.objects.create(name="Civil", code="CIV")
        s = self.client.post("/api/v1/subjects/", {"name": "Surveying", "branch_id": b.pk, "regulation_id": r.data["id"], "semester": 3})
        self.assertEqual(s.status_code, 201)
        found = self.client.get(f"/api/v1/subjects/?regulation={r.data['id']}&semester=3")
        self.assertEqual(found.data["count"], 1)
        self.assertEqual(self.client.get(f"/api/v1/subjects/?regulation={r.data['id']}&semester=4").data["count"], 0)


class MaterialTests(APITestCase):
    def setUp(self):
        from accounts.models import User
        from common.constants import Role
        from .models import Subject, Topic
        self.admin = User.objects.create_user(login_id="adm3", password="Passw0rd!x", full_name="A", role=Role.ADMIN)
        self.stu = User.objects.create_user(login_id="stu3", password="Passw0rd!x", full_name="S", role=Role.STUDENT)
        self.topic = Topic.objects.create(subject=Subject.objects.create(name="Mathematics"), name="Matrices")

    def test_admin_adds_and_student_marks_done(self):
        self.client.force_authenticate(self.admin)
        bad = self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "VIDEO", "title": "Intro"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "NOTES", "title": "Basics", "body": "A matrix is..."})
        self.assertEqual(ok.status_code, 201)
        self.client.force_authenticate(self.stu)
        self.assertEqual(self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "NOTES", "title": "x", "body": "y"}).status_code, 403)
        self.assertFalse(self.client.get(f"/api/v1/materials/?topic={self.topic.pk}").data["results"][0]["done"])
        self.assertEqual(self.client.post(f"/api/v1/materials/{ok.data['id']}/complete/").status_code, 200)
        self.assertTrue(self.client.get(f"/api/v1/materials/?topic={self.topic.pk}").data["results"][0]["done"])
        self.client.post(f"/api/v1/materials/{ok.data['id']}/undo/")
        self.assertFalse(self.client.get(f"/api/v1/materials/?topic={self.topic.pk}").data["results"][0]["done"])


class FacultyUploadTests(APITestCase):
    def setUp(self):
        from accounts.models import User
        from common.constants import Role
        from .models import Subject, Topic
        self.fac = User.objects.create_user(login_id="fac1", password="Passw0rd!x", full_name="F", role=Role.FACULTY)
        self.fac2 = User.objects.create_user(login_id="fac2", password="Passw0rd!x", full_name="F2", role=Role.FACULTY)
        self.stu = User.objects.create_user(login_id="stu9", password="Passw0rd!x", full_name="S", role=Role.STUDENT)
        self.topic = Topic.objects.create(subject=Subject.objects.create(name="Physics"), name="Vectors")

    def test_faculty_uploads_video_and_only_owner_edits(self):
        import tempfile
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        with tempfile.TemporaryDirectory() as tmp, override_settings(MEDIA_ROOT=tmp):
            self.client.force_authenticate(self.fac)
            video = SimpleUploadedFile("lesson.mp4", b"fakevideo", content_type="video/mp4")
            r = self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "VIDEO", "title": "Vectors", "file": video}, format="multipart")
            self.assertEqual(r.status_code, 201, r.data)
            self.assertTrue(r.data["file_url"].endswith(".mp4") or ".mp4" in r.data["file_url"])
            bad = SimpleUploadedFile("run.exe", b"x")
            self.assertEqual(self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "VIDEO", "title": "x", "file": bad}, format="multipart").status_code, 400)
            self.client.force_authenticate(self.fac2)
            self.assertEqual(self.client.patch(f"/api/v1/materials/{r.data['id']}/", {"title": "Hijack"}).status_code, 403)
            self.client.force_authenticate(self.stu)
            self.assertEqual(self.client.post("/api/v1/materials/", {"topic_id": self.topic.pk, "kind": "LINK", "title": "x", "url": "https://a.b"}).status_code, 403)
            self.assertEqual(self.client.get(f"/api/v1/materials/?topic={self.topic.pk}").data["count"], 1)


class GuideTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(login_id="ga", password="Passw0rd!x", full_name="Admin", role=Role.ADMIN)
        self.fac = User.objects.create_user(login_id="gf", password="Passw0rd!x", full_name="Fac", role=Role.FACULTY)
        self.stu = User.objects.create_user(login_id="gs", password="Passw0rd!x", full_name="Stu", role=Role.STUDENT)

    def _add(self, **kw):
        body = {"area": "JOB_PREP", "section": "aptitude", "kind": "NOTES", "title": "Percentages", "body": "Short notes", "group": "Quantitative"}
        body.update(kw)
        return self.client.post("/api/v1/guides/", body, format="json")

    def test_admin_writes_students_read_and_progress(self):
        self.client.force_authenticate(self.admin)
        r = self._add()
        self.assertEqual(r.status_code, 201, r.data)
        gid = r.data["id"]
        self.assertEqual(self._add(section="roadmap").status_code, 400)  # roadmap is not a job-prep section
        self.assertEqual(self._add(body="").status_code, 400)
        hidden = self._add(title="Hidden", is_active=False).data["id"]
        self._add(area="CAREER", section="roadmap", title="Stage 1")
        self.client.force_authenticate(self.fac)
        self.assertEqual(self._add().status_code, 403)
        self.client.force_authenticate(self.stu)
        self.assertEqual(self._add().status_code, 403)
        ids = [g["id"] for g in self.client.get("/api/v1/guides/?area=JOB_PREP&section=aptitude").data["results"]]
        self.assertEqual(ids, [gid])
        self.assertNotIn(hidden, ids)
        self.assertEqual(self.client.get("/api/v1/guides/progress/").data["JOB_PREP"]["percent"], 0)
        self.assertTrue(self.client.post(f"/api/v1/guides/{gid}/complete/").data["done"])
        p = self.client.get("/api/v1/guides/progress/").data
        self.assertEqual((p["JOB_PREP"]["done"], p["JOB_PREP"]["total"], p["JOB_PREP"]["percent"], p["CAREER"]["percent"]), (1, 1, 100, 0))
        self.assertTrue(self.client.get("/api/v1/guides/?area=JOB_PREP").data["results"][0]["done"])
        self.assertFalse(self.client.post(f"/api/v1/guides/{gid}/undo/").data["done"])

    def test_pdf_upload_validated(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(self.admin)
        f = SimpleUploadedFile("x.pdf", b"%PDF-1.4 abc", content_type="application/pdf")
        r = self.client.post("/api/v1/guides/", {"area": "COMM", "section": "grammar", "kind": "PDF", "title": "Tenses", "file": f}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["is_active"])
        self.assertTrue(r.data["file_url"])
