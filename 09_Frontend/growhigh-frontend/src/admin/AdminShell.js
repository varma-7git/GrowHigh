import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { Icon } from "./ui";

export const NAV = [
  ["dashboard", "Dashboard", "dash"], ["users", "Users", "users"], ["students", "Students", "students"],
  ["faculty", "Faculty", "faculty"], ["branches", "Branches", "branches"], ["subjects", "Subjects & topics", "subjects"],
  ["qbank", "Question bank", "qbank"], ["tests", "Tests", "tests"], ["opps", "Opportunities", "opp"],
  ["content", "Content & settings", "settings"],
];

const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const cnt = (path, params) => api.get(path, { params: { ...params, page_size: 1 } }).then((r) => r.data.count).catch(() => 0);

export default function AdminShell({ page, go, onSearch, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState({ fac: 0, other: 0 });

  useEffect(() => {
    Promise.all([cnt("/faculty-requests/", { status: "PENDING" }), cnt("/companies/", { status: "PENDING" }), cnt("/jobs/", { status: "PENDING" })])
      .then(([fac, co, jobs]) => setPending({ fac, other: co + jobs }));
  }, [page]);

  const out = async () => { await logout(); navigate("/login", { replace: true }); };
  const pick = (k) => { go(k); setOpen(false); };
  const total = pending.fac + pending.other;

  return (
    <div className="adm">
      <div className={`a-scrim ${open ? "on" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`a-side ${open ? "open" : ""}`}>
        <a className="a-logo" href="/"><span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0b1f3f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16l6-6 4 4 8-8M15 6h6v6" /></svg></span>GROW<b>HIGH</b></a>
        <div className="a-ws">ADMIN WORKSPACE</div>
        <nav>
          {NAV.map(([k, l, ic]) => (
            <button key={k} className={page === k ? "on" : ""} onClick={() => pick(k)}><Icon name={ic} /><span>{l}</span></button>
          ))}
        </nav>
        <div className="a-motto">Learn. Prepare. Grow.</div>
        <div className="a-help">Your Career. Our Priority.</div>
      </aside>

      <div className="a-body">
        <header className="a-top">
          <button className="a-burger" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={24} /></button>
          <form className="a-gsearch" onSubmit={(e) => { e.preventDefault(); onSearch(q); }}>
            <Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GrowHigh…" />
          </form>
          <button className="a-bell" onClick={() => go(pending.fac ? "faculty" : "opps")} title={total ? `${total} item(s) waiting for review` : "Nothing waiting"}>
            <Icon name="bell" size={22} />{total > 0 && <i>{total}</i>}
          </button>
          <div className="a-user">
            <span className="a-date">{today()}<em>·</em></span>
            <button onClick={() => setMenu(!menu)}>{user.full_name} ▾</button>
            {menu && <div className="a-menu"><button onClick={out}>Logout</button></div>}
          </div>
        </header>
        <main className="a-main" key={page}>{children}</main>
        <footer className="a-foot">
          <div><a href="/">About</a><a href="/">Contact</a><a href="/">Privacy</a></div>
          <p>© {new Date().getFullYear()} GROWHIGH. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
