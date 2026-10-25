import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import EmailVerify from "../components/EmailVerify";
import { useAuth } from "../context/AuthContext";
import api, { parseError } from "../api/client";
import "./admin.css";

const P = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-7 7-7s7 3 7 7M17 4a3.5 3.5 0 010 7M22 21c0-3-2-5.5-5-6.5",
  students: "M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.500 6-3v-4.500M22 9v6",
  faculty: "M10 11a4 4 0 100-8 4 4 0 000 8zM3 21c0-4 3-7 7-7 2 0 3.500.600 4.500 1.500M16 19l2 2 4-4",
  branches: "M12 3v6M5 21v-5a2 2 0 012-2h10a2 2 0 012 2v5M12 9v5M9 3h6v6H9zM2 17h6v4H2zM16 17h6v4h-6z",
  subjects: "M4 4v16M8 4v16M12 6l5 14M20 5l-3 1",
  questions: "M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM9.500 9a2.500 2.500 0 114 1.800c-.800.600-1.500 1-1.500 2M12 16.500v.01",
  tests: "M9 4h6v3H9zM6 5H5a1 1 0 00-1 1v15a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-1M8 12h.01M8 16h.01M12 12h4M12 16h4",
  opportunities: "M3 8h18v12H3zM8 8V5a1 1 0 011-1h6a1 1 0 011 1v3M3 13h18",
  content: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.400 15a1.700 1.700 0 00.300 1.800l.100.100a2 2 0 11-2.800 2.800l-.100-.100a1.700 1.700 0 00-1.800-.300 1.700 1.700 0 00-1 1.500V21a2 2 0 11-4 0v-.100a1.700 1.700 0 00-1.100-1.500 1.700 1.700 0 00-1.800.300l-.100.100a2 2 0 11-2.800-2.800l.100-.100a1.700 1.700 0 00.300-1.800 1.700 1.700 0 00-1.500-1H3a2 2 0 110-4h.100a1.700 1.700 0 001.500-1.100 1.700 1.700 0 00-.300-1.800l-.100-.100a2 2 0 112.800-2.800l.100.100a1.700 1.700 0 001.800.300H9a1.700 1.700 0 001-1.500V3a2 2 0 114 0v.100a1.700 1.700 0 001 1.500 1.700 1.700 0 001.800-.300l.100-.100a2 2 0 112.800 2.800l-.100.100a1.700 1.700 0 00-.300 1.800V9a1.700 1.700 0 001.500 1H21a2 2 0 110 4h-.100a1.700 1.700 0 00-1.500 1z",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.300-4.300",
  bell: "M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.300 21a1.900 1.900 0 003.400 0",
  book: "M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2zM22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z",
  menu: "M4 6h16M4 12h16M4 18h16",
};
export const Icon = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[n]} /></svg>;

export const NAV = [
  ["", "Dashboard", "dashboard"], ["users", "Users", "users"], ["students", "Students", "students"], ["faculty", "Faculty", "faculty"],
  ["branches", "Branches", "branches"], ["subjects", "Subjects & topics", "subjects"], ["questions", "Question bank", "questions"],
  ["tests", "Tests", "tests"], ["papers", "Previous papers", "questions"], ["opportunities", "Opportunities", "opportunities"], ["content", "Content & settings", "content"],
];

const ALIAS = { subjects: ["topics"], opportunities: ["internships"] };
const on = (path, p) => { const seg = path.replace(/^\/admin\/?/, "").split("/")[0]; return seg === p || (ALIAS[p] || []).includes(seg); };

export function AdminShell({ crumb, title, subtitle, action, message, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(0);
  useEffect(() => {
    Promise.all(["faculty-requests", "companies", "jobs"].map((u) =>
      api.get(`/${u}/`, { params: { status: "PENDING", page_size: 1 } }).then((r) => r.data.count).catch(() => 0)))
      .then((a) => setPending(a.reduce((x, y) => x + y, 0)));
  }, [title]);
  const out = async () => { await logout(); nav("/login", { replace: true }); };
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="ad">
      <aside className={`ad-side ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <Logo dark />
        <div className="ad-ws">ADMIN WORKSPACE</div>
        <nav className="ad-nav">
          {NAV.map(([p, l, i]) => (
            <Link key={p} to={`/admin${p ? "/" + p : ""}`} className={on(pathname, p) ? "on" : ""}><Icon n={i} />{l}</Link>
          ))}
        </nav>
        <div className="ad-tag">Learn. Prepare. Grow.</div>
        <div className="ad-help">Your Career. Our Priority.</div>
      </aside>
      <div className="ad-body">
        <header className="ad-top">
          <button className="ad-burger" aria-label="Menu" onClick={() => setOpen(true)}><Icon n="menu" /></button>
          <form className="ad-search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/admin/users?q=${encodeURIComponent(q.trim())}`); }}>
            <Icon n="search" /><input placeholder="Search GrowHigh…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <button className="ad-bell" title={`${pending} waiting for review`} onClick={() => nav("/admin")}>
            <Icon n="bell" />{pending > 0 && <i>{pending}</i>}
          </button>
          <div className="ad-user">
            <span>{today}</span>
            <button onClick={() => setMenu(!menu)}><span className="nm">{user.full_name}</span> ▾</button>
            {menu && <div className="ad-menu"><button onClick={out}>Logout</button></div>}
          </div>
        </header>
        <main className="ad-main">
          <div className="ad-crumb">Admin workspace / {crumb || title}</div>
          <div className="ad-head">
            <div><h1>{title}</h1><p>{subtitle}</p></div>
            {action}
          </div>
          {message?.text && <div className={`ad-alert ${message.kind}`}>{message.text}</div>}
          {children}
        </main>
        <nav className="ad-tabbar">
          {[["", "Home", "dashboard"], ["users", "Users", "users"], ["opportunities", "Jobs", "opportunities"]].map(([p, l, i]) => (
            <Link key={p} to={`/admin${p ? "/" + p : ""}`} className={on(pathname, p) ? "on" : ""}><Icon n={i} />{l}</Link>))}
          <button onClick={() => setOpen(true)}><Icon n="menu" />Menu</button>
        </nav>
        <footer className="ad-foot"><a href="/#about">About</a><a href="/#contact">Contact</a><a href="/#privacy">Privacy</a><p>© 2026 GROWHIGH. All rights reserved.</p></footer>
      </div>
    </div>
  );
}

export const Stat = ({ label, value, note }) => <div className="ad-card ad-stat"><small>{label}</small><b>{value ?? "—"}</b><span>{note}</span></div>;
export const Search = ({ value, onChange, placeholder }) => (
  <div className="ad-sbox"><Icon n="search" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>
);
export const Select = ({ value, onChange, options }) => (
  <select className="ad-sel" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
);
export const Bar = ({ label, pct, dark }) => (
  <div><div className="ad-pr"><span>{label}</span><span>{pct}%</span></div><div className="ad-bar"><i style={{ width: `${pct}%` }} /></div></div>
);
export function List({ head, rows, empty = "Nothing here yet." }) {
  return (
    <div className="ad-list">
      <div className="ad-lh">{head}</div>
      {rows.length === 0 && <div className="ad-empty">{empty}</div>}
      {rows}
    </div>
  );
}
export const Row = ({ title, meta, children }) => (
  <div className="ad-row"><div className="gm"><b>{title}</b><small>{meta}</small></div><div className="ad-act">{children}</div></div>
);
export const Pager = ({ page, setPage, data }) => (
  <div className="ad-more">
    <button className="ad-btn o s" disabled={!data.previous} onClick={() => setPage(page - 1)}>Previous</button>
    <span className="ad-hint">Page {page} · {data.count} total</span>
    <button className="ad-btn o s" disabled={!data.next} onClick={() => setPage(page + 1)}>Next</button>
  </div>
);
export const Err = ({ e }) => (e ? <div className="ad-err">{e}</div> : null);
export const fmt = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

/** Fetch every page of a list endpoint. */
export async function all(url, params) {
  let page = 1, out = [];
  for (;;) {
    const { data } = await api.get(url, { params: { ...params, page, page_size: 100 } });
    out = out.concat(data.results);
    if (!data.next) return out;
    page += 1;
  }
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [onClose]);
  return createPortal(
    <div className="ad ad-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ad-card ad-form"><div className="ad-mh"><h2>{title}</h2><button className="ad-link" onClick={onClose}>✕</button></div>{children}</div>
    </div>, document.body);
}

/** Edit a user: name, email, phone, branch and year (students), department (faculty), active switch, password reset. */
export function EditUser({ u, onClose, notify, reload }) {
  const [emailToken, setEmailToken] = useState("");
  const [f, setF] = useState({ full_name: u.full_name, email: u.email || "", phone: u.phone || "", is_active: u.is_active,
    branch_id: u.branch?.id || "", year_of_study: u.year_of_study || "", department: u.department || "" });
  const [branches, setBranches] = useState([]); const [er, setEr] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (u.role === "STUDENT") all("/branches/").then(setBranches).catch(() => {}); }, [u.role]);
  const set = (e) => setF({ ...f, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setEr({});
    const body = { full_name: f.full_name, phone: f.phone, is_active: f.is_active };
    if (f.email.trim()) body.email = f.email.trim();
    if (f.email.trim().toLowerCase() !== (u.email || "").toLowerCase()) { if (!emailToken) { setEr({ email: "Verify the new email first." }); setBusy(false); return; } body.email_token = emailToken; }
    if (u.role === "STUDENT") { body.branch_id = Number(f.branch_id); body.year_of_study = Number(f.year_of_study); }
    if (u.role === "FACULTY") body.department = f.department;
    try { await api.patch(`/users/${u.id}/`, body); notify(`${f.full_name} updated.`, "success"); onClose(); reload(); }
    catch (x) { const p = parseError(x); setEr(p.fields || {}); notify(p.message, "danger"); } finally { setBusy(false); }
  };
  const [pw, setPw] = useState(""); const [pwErr, setPwErr] = useState(""); const [showPw, setShowPw] = useState(false);
  const setPassword = async () => {
    setPwErr("");
    if (!pw.trim()) { setPwErr("Type the new password first, or use Generate random."); return; }
    try { await api.post(`/users/${u.id}/reset-password/`, { password: pw }); notify(`Password changed for ${u.login_id}. Share it with the user.`, "success"); onClose(); }
    catch (x) { const p = parseError(x); setPwErr(p.fields?.password || p.message); }
  };
  const generate = async () => {
    if (!window.confirm(`Generate a random temporary password for ${u.full_name}?`)) return;
    try { const { data } = await api.post(`/users/${u.id}/reset-password/`); notify(`Temporary password for ${u.login_id}: ${data.temporary_password} (share it and ask them to change it)`, "warning"); onClose(); }
    catch (x) { setPwErr(parseError(x).message); }
  };
  const inp = (n, label, type = "text") => (<><label>{label}</label><input className="ad-in" name={n} type={type} value={f[n]} onChange={set} /><Err e={er[n]} /></>);
  return (
    <Modal title={`Edit ${u.login_id}`} onClose={onClose}>
      <form onSubmit={save} noValidate>
        {inp("full_name", "Full name")}<div style={{ marginTop: 18 }}><EmailVerify ad label="Email" value={f.email} original={u.email || ""} onChange={set} onToken={setEmailToken} error={er.email || er.email_token} /></div>{inp("phone", "Phone")}
        {u.role === "STUDENT" && <><label>Branch</label><select className="ad-in" name="branch_id" value={f.branch_id} onChange={set}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><Err e={er.branch_id} />
          <label>Year</label><select className="ad-in" name="year_of_study" value={f.year_of_study} onChange={set}>{[1, 2, 3].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></>}
        {u.role === "FACULTY" && inp("department", "Department")}
        {u.role !== "ADMIN" && <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" name="is_active" checked={f.is_active} onChange={set} /> Account is active</label>}
        <Err e={er.non_field_errors || er.is_active} />
        <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 22 }}>
          <button className="ad-btn p" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
      </form>
      <div style={{ borderTop: "1px solid #e6ecf4", marginTop: 24 }}>
        <label>Set a new password</label>
        <div style={{ position: "relative" }}><input className="ad-in" type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters, with a letter and a number" autoComplete="new-password" />
          <button type="button" className="ad-link" style={{ position: "absolute", right: 8, top: 12 }} onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button></div>
        <Err e={pwErr} />
        <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 14 }}>
          <button type="button" className="ad-btn c s" onClick={setPassword}>Change password</button>
          <button type="button" className="ad-btn o s" onClick={generate}>Generate random</button></div>
        <div className="ad-hint">Use this when someone is locked out. Tell them to change it after logging in.</div>
      </div>
    </Modal>
  );
}
