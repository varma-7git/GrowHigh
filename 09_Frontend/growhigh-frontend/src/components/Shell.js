import { useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";

/** Top bar, left sidebar (the tabs) and content area used by every logged-in page. */
export default function Shell({ title, subtitle, tabs, tab, onTab, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const out = async () => { await logout(); navigate("/login", { replace: true }); };
  return (
    <div className="gh-dash">
      <header className="gh-dash-bar">
        <Logo dark />
        <div className="d-flex align-items-center gap-3">
          <span className="gh-who d-none d-sm-inline">{user.full_name}</span>
          <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={out}>Logout</button>
        </div>
      </header>
      <div className="container-xl py-4">
        <div className="gh-layout">
          {tabs && (
            <aside className="gh-side">
              <div className="gh-side-title">Menu</div>
              {tabs.map(([key, label]) => (
                <button key={key} className={tab === key ? "active" : ""} onClick={() => onTab(key)}>{label}</button>
              ))}
            </aside>
          )}
          <main className="gh-main">
            <h1 className="gh-title">{title}</h1>
            {subtitle && <div className="gh-title-sub">{subtitle}</div>}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
