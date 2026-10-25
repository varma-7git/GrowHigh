import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import "../admin/admin.css";
import "./ws.css";
import { Ic } from "./icons";

const CFG = {
  student: {
    base: "/student", label: "STUDENT WORKSPACE", name: "Student",
    nav: [["", "Dashboard", "dashboard"], ["/ecet", "ECET preparation", "ecet"], ["/job-prep", "Job preparation", "code"], ["/career", "Career growth", "trend"],
      ["/communication", "Communication", "chat"], ["/jobs", "Jobs & internships", "jobs"], ["/applications", "My applications", "files"], ["/profile", "My profile", "user"]],
    tab: [["", "Home", "dashboard"], ["/ecet", "ECET", "ecet"], ["/jobs", "Jobs", "jobs"], ["/profile", "Profile", "user"]],
  },
  faculty: {
    base: "/faculty", label: "FACULTY WORKSPACE", name: "Faculty",
    nav: [["", "Dashboard", "dashboard"], ["/questions", "Question bank", "qbank"], ["/materials", "Learning material", "book"], ["/schedule", "Create & schedule", "calendar"], ["/assign", "Assign tests", "send"],
      ["/students", "Students", "users"], ["/performance", "Performance", "bars"], ["/profile", "My profile", "user"]],
    tab: [["", "Home", "dashboard"], ["/questions", "Questions", "qbank"], ["/schedule", "Tests", "calendar"], ["/profile", "Profile", "user"]],
  },
};

export const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Shared frame for the student and faculty workspaces (same look as the admin workspace). */
export default function WsShell({ role, crumb, title, subtitle, action, children }) {
  const c = CFG[role];
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [live, setLive] = useState([]);
  useEffect(() => { if (role === "student") api.get("/tests/", { params: { page_size: 100 } }).then((r) => setLive(r.data.results.filter((t) => t.status === "ACTIVE" && !t.my_attempt?.submitted))).catch(() => {}); }, [role, pathname]);
  const on = (p) => (p === "" ? pathname.replace(/\/$/, "") === c.base : pathname === c.base + p || pathname.startsWith(`${c.base}${p}/`));
  const out = async () => { await logout(); nav("/login", { replace: true }); };
  const initials = user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="ad">
      <aside className={`ad-side ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <Logo dark />
        <div className="ad-ws">{c.label}</div>
        <nav className="ad-nav">
          {c.nav.map(([p, l, i]) => <Link key={p} to={c.base + p} className={on(p) ? "on" : ""}><Ic n={i} />{l}</Link>)}
        </nav>
        <div className="ad-tag">Learn. Prepare. Grow.</div>
        <div className="ad-help">Your Career. Our Priority.<a href="/#contact">Help &amp; support ↗</a></div>
      </aside>
      <div className="ad-body">
        <header className="ad-top">
          <button className="ad-burger" aria-label="Menu" onClick={() => setOpen(true)}><Ic n="menu" /></button>
          <div className="ad-bellwrap">
            <button className="ad-bell" aria-label="Notifications" onClick={() => { setBell(!bell); setMenu(false); }}><Ic n="bell" />{live.length > 0 && <i>{live.length}</i>}</button>
            {bell && <div className="ad-menu ad-notes">{live.length === 0 ? <p>You are all caught up.</p> : live.map((t) => <button key={t.id} onClick={() => { setBell(false); nav(`/student/test/${t.id}`); }}><b>{t.name}</b><small>Running now · {t.duration_minutes} min</small></button>)}</div>}
          </div>
          <div className="ad-user">
            <span>{today()}</span>
            <button onClick={() => { setMenu(!menu); setBell(false); }}><span className="nm">{user.full_name}</span><span className="ws-ini">{initials}</span> ▾</button>
            {menu && <div className="ad-menu"><button onClick={() => nav(`${c.base}/profile`)}>My profile</button><button onClick={out}>Logout</button></div>}
          </div>
        </header>
        <main className="ad-main">
          <div className="ad-crumb">{c.name} workspace / {crumb || title}</div>
          <div className="ad-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
          {children}
        </main>
        <nav className="ad-tabbar">
          {c.tab.map(([p, l, i]) => <Link key={p} to={c.base + p} className={on(p) ? "on" : ""}><Ic n={i} />{l}</Link>)}
        </nav>
        <footer className="ad-foot"><a href="/#about">About</a><a href="/#contact">Contact</a><a href="/#privacy">Privacy</a><p>© 2026 GROWHIGH. All rights reserved.</p></footer>
      </div>
    </div>
  );
}
