import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Dashboard, Faculty, Students, Users } from "./pages1";
import { AdminContent, AdminPapers, AdminTests, QuestionBank } from "./pages3";
import { Branches, Internships, Opportunities, Subjects, Topics } from "./pages2";
import NotFound from "../pages/NotFound";
import Preparing from "../components/Preparing";

export default function AdminHome() {
  const [message, setMessage] = useState({ kind: "", text: "" });
  const notify = useCallback((text, kind = "success") => setMessage({ kind, text }), []);
  const { pathname } = useLocation();
  useEffect(() => setMessage({ kind: "", text: "" }), [pathname]);
  const [ready, setReady] = useState(() => { try { return sessionStorage.getItem("gh_ready") === "1"; } catch (e) { return true; } });
  if (!ready) return <Preparing onDone={() => { try { sessionStorage.setItem("gh_ready", "1"); } catch (e) {} setReady(true); }} />;
  const p = { message, notify };
  return (
    <Routes>
      <Route index element={<Dashboard {...p} />} />
      <Route path="users" element={<Users {...p} />} />
      <Route path="students" element={<Students {...p} />} />
      <Route path="faculty" element={<Faculty {...p} />} />
      <Route path="branches" element={<Branches {...p} />} />
      <Route path="subjects" element={<Subjects {...p} />} />
      <Route path="topics" element={<Topics {...p} />} />
      <Route path="internships" element={<Internships {...p} />} />
      <Route path="opportunities" element={<Opportunities {...p} />} />
      <Route path="questions" element={<QuestionBank {...p} />} />
      <Route path="papers" element={<AdminPapers {...p} />} />
      <Route path="tests" element={<AdminTests {...p} />} />
      <Route path="content" element={<AdminContent {...p} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
