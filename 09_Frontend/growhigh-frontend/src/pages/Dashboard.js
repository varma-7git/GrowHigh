import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const TITLES = { STUDENT: "Student dashboard", FACULTY: "Faculty dashboard", ADMIN: "Admin dashboard" };

// Placeholder: the real dashboards come in the next vertical slices.
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const out = async () => { await logout(); navigate("/login", { replace: true }); };
  return (
    <div className="gh-dash">
      <header className="gh-dash-bar">
        <Logo />
        <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={out}>Logout</button>
      </header>
      <main className="container py-5">
        <h1>{TITLES[user.role]}</h1>
        <p className="lead">Welcome, {user.full_name} ({user.login_id}).</p>
        <p className="text-muted">You are logged in as {user.role.toLowerCase()}. This page will fill up in the next steps.</p>
      </main>
    </div>
  );
}
