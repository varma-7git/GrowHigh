import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import RegisterCompany from "./pages/RegisterCompany";
import RegisterFaculty from "./pages/RegisterFaculty";
import NotFound from "./pages/NotFound";
import AdminHome from "./admin/AdminHome";
import CompanyHome from "./pages/CompanyHome";
import StudentApp from "./ws/student/StudentApp";
import FacultyApp from "./ws/faculty/FacultyApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-faculty" element={<RegisterFaculty />} />
      <Route path="/register-company" element={<RegisterCompany />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/student/*" element={<ProtectedRoute role="STUDENT"><StudentApp /></ProtectedRoute>} />
      <Route path="/faculty/*" element={<ProtectedRoute role="FACULTY"><FacultyApp /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute role="ADMIN"><AdminHome /></ProtectedRoute>} />
      <Route path="/company" element={<ProtectedRoute role="COMPANY"><CompanyHome /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
