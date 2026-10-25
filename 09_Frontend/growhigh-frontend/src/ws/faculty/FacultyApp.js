import { Route, Routes } from "react-router-dom";
import NotFound from "../../pages/NotFound";
import Materials from "./Materials";
import Profile from "../student/Profile";
import { Assign, Dashboard, Performance, QuestionForm, Questions, Schedule, Students } from "./Faculty";

export default function FacultyApp() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="questions" element={<Questions />} />
      <Route path="questions/new" element={<QuestionForm />} />
      <Route path="questions/:id" element={<QuestionForm />} />
      <Route path="materials" element={<Materials />} />
      <Route path="schedule" element={<Schedule />} />
      <Route path="assign" element={<Assign />} />
      <Route path="students" element={<Students />} />
      <Route path="performance" element={<Performance />} />
      <Route path="profile/*" element={<Profile role="faculty" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
