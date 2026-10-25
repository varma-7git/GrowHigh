from datetime import date, timedelta

from rest_framework.test import APITestCase

from academics.models import Branch, Subject, Topic
from accounts.models import StudentProfile, User
from common.constants import Role


def mk_question(topic_id, text="What is 2+2?"):
    return {"topic_id": topic_id, "text": text, "options": ["3", "4", "5", "6"], "correct": 1, "explanation": "Two plus two is four."}


class ExamsBase(APITestCase):
    def setUp(self):
        self.fac = User.objects.create_user(login_id="f1", password="Passw0rd!x", full_name="Fac One", role=Role.FACULTY)
        self.fac2 = User.objects.create_user(login_id="f2", password="Passw0rd!x", full_name="Fac Two", role=Role.FACULTY)
        self.admin = User.objects.create_user(login_id="a1", password="Passw0rd!x", full_name="Admin", role=Role.ADMIN)
        self.cse = Branch.objects.create(name="Computer Engineering", code="CME")
        self.civ = Branch.objects.create(name="Civil", code="CIV")
        self.s1 = self._student("s1", self.cse, 2)
        self.s2 = self._student("s2", self.civ, 2)
        self.topic = Topic.objects.create(subject=Subject.objects.create(name="Mathematics"), name="Matrices")

    def _student(self, login, branch, year):
        u = User.objects.create_user(login_id=login, password="Passw0rd!x", full_name=login.upper(), role=Role.STUDENT)
        StudentProfile.objects.create(user=u, branch=branch, year_of_study=year)
        return u


class QuestionTests(ExamsBase):
    def test_faculty_adds_question_students_cannot_read(self):
        self.client.force_authenticate(self.fac)
        r = self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["options"], ["3", "4", "5", "6"])
        self.assertEqual(r.data["correct"], 1)
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get("/api/v1/questions/").status_code, 403)

    def test_validation(self):
        self.client.force_authenticate(self.fac)
        bad = mk_question(self.topic.pk); bad["options"] = ["1", "1", "2", "3"]
        self.assertEqual(self.client.post("/api/v1/questions/", bad, format="json").status_code, 400)
        bad = mk_question(self.topic.pk); bad["correct"] = 4
        self.assertEqual(self.client.post("/api/v1/questions/", bad, format="json").status_code, 400)

    def test_only_owner_edits(self):
        self.client.force_authenticate(self.fac)
        q = self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json").data
        self.client.force_authenticate(self.fac2)
        self.assertEqual(self.client.patch(f"/api/v1/questions/{q['id']}/", {"text": "Hacked"}, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f"/api/v1/questions/{q['id']}/", {"is_active": False}, format="json").status_code, 200)


class TestFlowTests(ExamsBase):
    def _test_body(self, qids, **extra):
        body = {"name": "Daily Maths", "test_type": "DAILY", "scheduled_date": str(date.today() + timedelta(days=1)), "start_time": "09:00",
                "duration_minutes": 30, "branch_id": self.cse.pk, "year_of_study": 2, "question_ids": qids}
        body.update(extra)
        return body

    def test_create_assign_and_student_sees_only_own(self):
        self.client.force_authenticate(self.fac)
        q = self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json").data["id"]
        self.assertEqual(self.client.post("/api/v1/tests/", self._test_body([]), format="json").status_code, 400)
        t = self.client.post("/api/v1/tests/", self._test_body([q]), format="json")
        self.assertEqual(t.status_code, 201, t.data)
        self.assertEqual(t.data["question_count"], 1)
        self.assertEqual(t.data["status"], "UPCOMING")
        # wrong branch student is refused
        r = self.client.post(f"/api/v1/tests/{t.data['id']}/assign/", {"student_ids": [self.s2.pk]}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"/api/v1/tests/{t.data['id']}/assign/", {"student_ids": [self.s1.pk]}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/tests/{t.data['id']}/").data["assigned_ids"], [self.s1.pk])
        self.client.force_authenticate(self.s1)
        mine = self.client.get("/api/v1/tests/")
        self.assertEqual(mine.data["count"], 1)
        self.assertNotIn("questions", mine.data["results"][0])
        self.client.force_authenticate(self.s2)
        self.assertEqual(self.client.get("/api/v1/tests/").data["count"], 0)
        self.assertEqual(self.client.post("/api/v1/tests/", self._test_body([q]), format="json").status_code, 403)

    def test_question_in_test_cannot_be_deleted(self):
        self.client.force_authenticate(self.fac)
        q = self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json").data["id"]
        t = self.client.post("/api/v1/tests/", self._test_body([q]), format="json").data["id"]
        self.assertEqual(self.client.delete(f"/api/v1/questions/{q}/").status_code, 409)
        self.assertEqual(self.client.delete(f"/api/v1/tests/{t}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/v1/questions/{q}/").status_code, 204)

    def test_roster_for_faculty_only(self):
        self.client.force_authenticate(self.fac)
        r = self.client.get(f"/api/v1/roster/?branch={self.cse.pk}&year_of_study=2")
        self.assertEqual([x["login_id"] for x in r.data["results"]], ["s1"])
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get("/api/v1/roster/").status_code, 403)


class TakeTestTests(ExamsBase):
    def _live_test(self, minutes_from_now=-1, duration=30):
        from datetime import timedelta
        from django.utils import timezone
        self.client.force_authenticate(self.fac)
        q1 = self.client.post("/api/v1/questions/", mk_question(self.topic.pk, "Q one"), format="json").data["id"]
        q2 = self.client.post("/api/v1/questions/", mk_question(self.topic.pk, "Q two"), format="json").data["id"]
        start = timezone.localtime() + timedelta(minutes=minutes_from_now)
        body = {"name": "Live", "test_type": "DAILY", "scheduled_date": str(start.date()), "start_time": start.strftime("%H:%M:%S"),
                "duration_minutes": duration, "branch_id": self.cse.pk, "year_of_study": 2, "question_ids": [q1, q2]}
        tid = self.client.post("/api/v1/tests/", body, format="json").data["id"]
        self.client.post(f"/api/v1/tests/{tid}/assign/", {"student_ids": [self.s1.pk]}, format="json")
        return tid, q1, q2

    def test_full_attempt_scores_on_server_and_is_single(self):
        tid, q1, q2 = self._live_test()
        self.client.force_authenticate(self.s1)
        r = self.client.post(f"/api/v1/tests/{tid}/start/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(r.data["questions"]), 2)
        self.assertNotIn("correct", r.data["questions"][0])
        self.assertGreater(r.data["remaining_seconds"], 0)
        aid = r.data["id"]
        self.assertEqual(self.client.post(f"/api/v1/attempts/{aid}/answer/", {"question_id": q1, "selected": 1}, format="json").status_code, 200)
        s = self.client.post(f"/api/v1/attempts/{aid}/submit/", {"answers": {str(q1): 1, str(q2): 0}}, format="json")
        self.assertEqual(s.status_code, 200, s.data)
        self.assertEqual((s.data["score"], s.data["total"], s.data["percent"]), (1, 2, 50))
        self.assertEqual(self.client.post(f"/api/v1/tests/{tid}/start/").status_code, 409)
        detail = self.client.get(f"/api/v1/attempts/{aid}/")
        self.assertEqual(len(detail.data["review"]), 2)
        self.assertEqual(detail.data["topics"][0]["total"], 2)
        self.assertEqual(len(self.client.get("/api/v1/attempts/").data), 1)

    def test_too_early_and_unassigned(self):
        tid, _, _ = self._live_test(minutes_from_now=60)
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.post(f"/api/v1/tests/{tid}/start/").status_code, 409)
        self.client.force_authenticate(self.s2)
        self.assertEqual(self.client.post(f"/api/v1/tests/{tid}/start/").status_code, 404)

    def test_other_student_cannot_open_attempt(self):
        tid, _, _ = self._live_test()
        self.client.force_authenticate(self.s1)
        aid = self.client.post(f"/api/v1/tests/{tid}/start/").data["id"]
        self.client.force_authenticate(self.s2)
        self.assertEqual(self.client.get(f"/api/v1/attempts/{aid}/").status_code, 403)

    def test_practice_uses_real_questions(self):
        self.client.force_authenticate(self.fac)
        self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json")
        self.client.force_authenticate(self.s1)
        r = self.client.post("/api/v1/practice/start/", {"topic_id": self.topic.pk, "count": 5}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["kind"], "PRACTICE")
        self.assertIsNone(r.data["remaining_seconds"])
        s = self.client.post(f"/api/v1/attempts/{r.data['id']}/submit/", {"answers": {}}, format="json")
        self.assertEqual(s.data["score"], 0)
        other = Topic.objects.create(subject=self.topic.subject, name="Empty")
        self.assertEqual(self.client.post("/api/v1/practice/start/", {"topic_id": other.pk}, format="json").status_code, 409)


class PerformanceTests(ExamsBase):
    _live_test = TakeTestTests._live_test

    def test_class_results_for_faculty(self):
        tid, q1, q2 = self._live_test()
        self.client.force_authenticate(self.s1)
        aid = self.client.post(f"/api/v1/tests/{tid}/start/").data["id"]
        self.client.post(f"/api/v1/attempts/{aid}/submit/", {"answers": {str(q1): 1, str(q2): 1}}, format="json")
        self.client.force_authenticate(self.fac)
        s = self.client.get("/api/v1/performance/summary/").data
        self.assertEqual((s["tests"], s["attempts"], s["average"], s["pass_rate"]), (1, 1, 100, 100))
        self.assertEqual(s["weak_topics"][0]["name"], "Matrices")
        r = self.client.get(f"/api/v1/performance/tests/{tid}/").data
        self.assertEqual(r["results"][0]["percent"], 100)
        self.assertEqual(self.client.get("/api/v1/performance/students/").data[str(self.s1.pk)]["tests_taken"], 1)
        self.client.force_authenticate(self.fac2)
        self.assertEqual(self.client.get("/api/v1/performance/summary/").data["attempts"], 0)
        self.assertEqual(self.client.get(f"/api/v1/performance/tests/{tid}/").status_code, 404)
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get("/api/v1/performance/summary/").status_code, 403)

    def test_not_attempted_listed(self):
        tid, _, _ = self._live_test()
        self.client.force_authenticate(self.fac)
        r = self.client.get(f"/api/v1/performance/tests/{tid}/").data
        self.assertEqual(r["results"][0]["status"], "NOT_ATTEMPTED")


class PaperAndMockTests(ExamsBase):
    def _pdf(self, name="p.pdf", size=100):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(name, b"%PDF-1.4 " + b"x" * size, content_type="application/pdf")

    def test_papers_flow(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/v1/papers/", {"year": 2023, "title": "AP ECET 2023", "file": self._pdf()}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["is_active"])
        pid = r.data["id"]
        self.assertEqual(self.client.post("/api/v1/papers/", {"year": 2022, "title": "x", "file": self._pdf("p.txt")}, format="multipart").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/papers/", {"year": 2022, "title": "x"}, format="multipart").status_code, 400)
        other = self.client.post("/api/v1/papers/", {"year": 2021, "title": "Other branch", "branch_id": self.civ.pk, "file": self._pdf()}, format="multipart").data["id"]
        self.client.force_authenticate(self.s1)
        ids = [p["id"] for p in self.client.get("/api/v1/papers/").data["results"]]
        self.assertIn(pid, ids)
        self.assertNotIn(other, ids)
        self.assertEqual(self.client.post("/api/v1/papers/", {"year": 2020, "title": "n", "file": self._pdf()}, format="multipart").status_code, 403)
        self.assertTrue(self.client.post(f"/api/v1/papers/{pid}/save/").data["saved"])
        self.assertEqual(len(self.client.get("/api/v1/papers/?saved=1").data["results"]), 1)
        self.assertFalse(self.client.post(f"/api/v1/papers/{pid}/unsave/").data["saved"])
        self.assertEqual(len(self.client.get("/api/v1/papers/?saved=1").data["results"]), 0)
        self.client.force_authenticate(self.admin)
        self.client.patch(f"/api/v1/papers/{pid}/", {"is_active": False}, format="json")
        self.client.force_authenticate(self.s1)
        self.assertNotIn(pid, [p["id"] for p in self.client.get("/api/v1/papers/").data["results"]])

    def _questions(self, n):
        self.client.force_authenticate(self.fac)
        for i in range(n):
            self.client.post("/api/v1/questions/", mk_question(self.topic.pk, f"Q {i}"), format="json")

    def test_mock_and_cumulative(self):
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.post("/api/v1/practice/start/", {"kind": "mock"}, format="json").status_code, 409)
        self._questions(3)
        self.client.force_authenticate(self.s1)
        r = self.client.post("/api/v1/practice/start/", {"kind": "mock"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["title"], len(r.data["questions"])), ("Mock test", 3))
        self.assertGreater(r.data["remaining_seconds"], 100)
        qs = r.data["questions"]
        s = self.client.post(f"/api/v1/attempts/{r.data['id']}/submit/", {"answers": {str(qs[0]["id"]): 1}}, format="json")
        self.assertEqual((s.data["score"], s.data["total"]), (1, 3))
        c = self.client.post("/api/v1/practice/start/", {"kind": "cumulative", "subject_id": self.topic.subject_id}, format="json")
        self.assertEqual(c.status_code, 201, c.data)
        self.assertEqual(c.data["title"], "Cumulative · Mathematics")
        self.assertIsNone(c.data["remaining_seconds"])
        self.assertEqual(self.client.post("/api/v1/practice/start/", {"kind": "cumulative"}, format="json").status_code, 400)


class ProgressTests(ExamsBase):
    def test_progress_counts_real_activity(self):
        from academics.models import Material
        self.client.force_authenticate(self.s1)
        p = self.client.get("/api/v1/student/progress/").data
        self.assertEqual((p["ecet_percent"], p["attempts"], p["streak"], p["average"], len(p["week"])), (0, 0, 0, None, 7))
        m = Material.objects.create(topic=self.topic, kind="NOTES", title="N", body="x")
        Material.objects.create(topic=self.topic, kind="NOTES", title="N2", body="y")
        self.client.post(f"/api/v1/materials/{m.pk}/complete/")
        self.client.force_authenticate(self.fac)
        self.client.post("/api/v1/questions/", mk_question(self.topic.pk), format="json")
        self.client.force_authenticate(self.s1)
        r = self.client.post("/api/v1/practice/start/", {"topic_id": self.topic.pk}, format="json").data
        self.client.post(f"/api/v1/attempts/{r['id']}/submit/", {"answers": {str(r["questions"][0]["id"]): 1}}, format="json")
        p = self.client.get("/api/v1/student/progress/").data
        self.assertEqual((p["materials_total"], p["materials_done"], p["ecet_percent"]), (2, 1, 50))
        self.assertEqual((p["attempts"], p["questions_answered"], p["average"], p["streak"]), (1, 1, 100, 1))
        self.assertEqual(p["week"][-1]["questions"], 1)
        self.client.force_authenticate(self.fac)
        self.assertEqual(self.client.get("/api/v1/student/progress/").status_code, 403)
