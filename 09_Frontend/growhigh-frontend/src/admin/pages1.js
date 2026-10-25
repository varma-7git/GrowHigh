import EmailVerify from "../components/EmailVerify";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { parseError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AdminShell, Bar, EditUser, Err, List, Pager, Row, Search, Select, Stat, fmt } from "./ui";

const cnt = (url, params) => api.get(url, { params: { ...params, page_size: 1 } }).then((r) => r.data.count).catch(() => 0);

export function Dashboard({ message }) {
  const [s, setS] = useState({});
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    Promise.all([cnt("/users/"), cnt("/users/", { role: "STUDENT" }), cnt("/users/", { role: "FACULTY" }), cnt("/users/", { role: "ADMIN" }),
      cnt("/users/", { role: "COMPANY" }), cnt("/branches/"), cnt("/faculty-requests/", { status: "PENDING" }), cnt("/companies/", { status: "PENDING" }),
      cnt("/jobs/", { status: "PENDING" })])
      .then(([total, students, faculty, admins, companies, branches, pf, pc, pj]) => setS({ total, students, faculty, admins, companies, branches, pf, pc, pj }));
    api.get("/users/", { params: { page_size: 100 } }).then((r) => setRecent(r.data.results)).catch(() => {});
  }, []);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const bars = days.map((d) => recent.filter((u) => new Date(u.created_at).toDateString() === d.toDateString()).length);
  const max = Math.max(...bars, 1), top = bars.indexOf(Math.max(...bars));
  const todo = [["Faculty requests", s.pf, "/admin/faculty"], ["Company requests", s.pc, "/admin/opportunities"], ["Job / internship reviews", s.pj, "/admin/opportunities"]];
  const queue = (s.pf || 0) + (s.pc || 0) + (s.pj || 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <AdminShell title="System overview" crumb="Dashboard" subtitle="An organised view of people, assessment and career content." message={message}
      action={<Link className="ad-btn p" to="/admin/users">Manage users</Link>}>
      <div className="ad-hero"><h2>A healthy learning ecosystem</h2>
        <p>{s.total ?? "…"} total users = {s.students ?? "…"} students + {s.faculty ?? "…"} faculty + {s.admins ?? "…"} admins + {s.companies ?? "…"} companies</p></div>
      <div className="ad-grid g4">
        <Stat label="Total users" value={s.total} note="All registered accounts" />
        <Stat label="Students" value={s.students} note={`Across ${s.branches ?? "…"} branches`} />
        <Stat label="Faculty" value={s.faculty} note="Teaching and assessment" />
        <Stat label="Admins" value={s.admins} note="Platform management" />
      </div>
      <div className="ad-grid g2">
        <div className="ad-card"><h2>Platform activity</h2>
          <div className="ad-hint" style={{ color: "#6b7a90" }}>New registrations · last 7 days</div>
          <div className="ad-chart">{bars.map((v, i) => (
            <div key={i}><i className={i === top && v ? "top" : ""} style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 70}ms` }} title={`${v} new`} />{"SMTWTFS"[days[i].getDay()]}</div>))}</div>
          <small style={{ color: "#6b7a90" }}>Cyan: registrations · Coral: busiest day</small></div>
        <div className="ad-card"><h2>Activity stream</h2>
          <div className="ad-stream">{recent.slice(0, 3).map((u) => (
            <div key={u.id}><small>{fmt(u.created_at)}</small><b>New {u.role.toLowerCase()} account</b><span>{u.full_name} · {u.login_id}</span></div>))}
            {recent.length === 0 && <div><span>No activity yet.</span></div>}</div></div>
      </div>
      <div className="ad-grid g2">
        <div className="ad-card"><h2>Platform operations</h2>
          <Bar label="Faculty reviewed" pct={pct((s.faculty || 0), (s.faculty || 0) + (s.pf || 0))} />
          <Bar label="Companies reviewed" pct={pct((s.companies || 0), (s.companies || 0) + (s.pc || 0))} />
          <p style={{ color: "#6b7a90" }}>Review pending registrations and postings before they go live.</p>
          <Link className="ad-btn o" to="/admin/opportunities">Review content</Link></div>
        <div className="ad-card ad-dark"><h2>Publishing checklist</h2>
          {todo.map(([l, n, to]) => <p key={l} style={{ margin: "6px 0" }}>{n ? "○" : "✓"} <Link to={to} style={{ color: "#fff" }}>{n ? `${n} ${l.toLowerCase()} waiting` : `${l} reviewed`}</Link></p>)}
          <Link className="ad-btn o" style={{ marginTop: 18 }} to={queue ? "/admin/opportunities" : "/admin/content"}>{queue ? "Open review queue" : "Open content & settings"}</Link></div>
      </div>
    </AdminShell>
  );
}

function useUsers(fixed, extra) {
  const [data, setData] = useState({ count: 0, results: [], next: null, previous: null });
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    api.get("/users/", { params: { ...fixed, ...extra, page, page_size: 10 } }).then((r) => setData(r.data)).catch(() => {});
  }, [JSON.stringify(fixed), JSON.stringify(extra), page]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [JSON.stringify(extra)]); // eslint-disable-line
  return { data, page, setPage, load };
}

function Account({ u, me, notify, reload, detail }) {
  const [edit, setEdit] = useState(false);
  const deactivate = async () => {
    if (!window.confirm(`Deactivate ${u.full_name}? They will not be able to sign in. Their records are kept.`)) return;
    try { await api.patch(`/users/${u.id}/`, { is_active: false }); notify(`${u.full_name} deactivated.`, "success"); reload(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  return (
    <Row title={u.full_name} meta={`${detail} · Status: ${u.is_active ? "Active" : "Inactive"}`}>
      <button className="ad-link" onClick={() => setEdit(true)}>Edit</button>
      {u.is_active && u.role !== "ADMIN" && u.id !== me.id && <><span className="ad-sl">/</span><button className="ad-link r" onClick={deactivate}>Deactivate</button></>}
      {edit && <EditUser u={u} onClose={() => setEdit(false)} notify={notify} reload={reload} />}
    </Row>
  );
}

export function Users({ message, notify }) {
  const { user: me } = useAuth();
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [role, setRole] = useState("");
  const [st, setSt] = useState("");
  const { data, page, setPage, load } = useUsers({}, { search: q || undefined, role: role || undefined, is_active: st || undefined });
  const [t, setT] = useState({});
  useEffect(() => { Promise.all([cnt("/users/"), cnt("/users/", { is_active: "true" }), cnt("/users/", { is_active: "false" })]).then(([a, b, c]) => setT({ a, b, c })); }, [data]);
  return (
    <AdminShell title="User management" crumb="Users" subtitle="Manage access with clear identities, roles and safe account actions." message={message}>
      <div className="ad-grid g3"><Stat label="Total users" value={t.a} note="Everyone on the platform" /><Stat label="Active accounts" value={t.b} note="Can sign in" /><Stat label="Inactive" value={t.c} note="Review access deliberately" /></div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search name or login ID" />
        <Select value={role} onChange={setRole} options={[["", "All roles"], ["STUDENT", "Student"], ["FACULTY", "Faculty"], ["COMPANY", "Company"], ["ADMIN", "Admin"]]} />
        <Select value={st} onChange={setSt} options={[["", "All statuses"], ["true", "Active"], ["false", "Inactive"]]} /></div>
      <List head="Name / Login ID / Role / Status / Actions" rows={data.results.map((u) => (
        <Account key={u.id} u={u} me={me} notify={notify} reload={load}
          detail={`Login ID: ${u.login_id} · Role: ${u.role[0] + u.role.slice(1).toLowerCase()}`} />))} empty="No users found." />
      <Pager page={page} setPage={setPage} data={data} />
      <div className="ad-grid g2">
        <div className="ad-card"><h2>Role-aware account rules</h2><p>Student login ID: roll number<br />Faculty login ID: Faculty ID<br />Admin login ID: username</p>
          <p style={{ color: "#6b7a90" }}>Admin accounts expose Edit only. Deactivation is limited to student and faculty accounts.</p></div>
        <div className="ad-card ad-dark"><h2>Handle access with care</h2><p>Deactivation should pause access without removing learning history. Confirm the account before making a change. Use Edit to reactivate or reset a password.</p></div>
      </div>
    </AdminShell>
  );
}

export function Students({ message, notify }) {
  const { user: me } = useAuth();
  const [q, setQ] = useState(""); const [br, setBr] = useState(""); const [yr, setYr] = useState("");
  const [branches, setBranches] = useState([]); const [t, setT] = useState({});
  const { data, page, setPage, load } = useUsers({ role: "STUDENT" }, { search: q || undefined, branch: br || undefined, year_of_study: yr || undefined });
  useEffect(() => { api.get("/branches/", { params: { page_size: 100 } }).then((r) => setBranches(r.data.results)); cnt("/users/", { role: "STUDENT" }).then((a) => setT({ a })); }, []);
  return (
    <AdminShell title="Manage students" crumb="Students" subtitle="Keep academic identities, branch assignments and access organised." message={message}>
      <div className="ad-grid g3"><Stat label="Students" value={t.a} note="Registered students" /><Stat label="Branches" value={branches.length} note="Common + branch preparation" /><Stat label="Matching filter" value={data.count} note="Current search and filters" /></div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search student name or roll number" />
        <Select value={br} onChange={setBr} options={[["", "All branches"], ...branches.map((b) => [b.id, b.code])]} />
        <Select value={yr} onChange={setYr} options={[["", "All years"], [1, "Year 1"], [2, "Year 2"], [3, "Year 3"]]} /></div>
      <List head="Name / Roll number / Branch / Year / Status / Actions" rows={data.results.map((u) => (
        <Account key={u.id} u={u} me={me} notify={notify} reload={load} detail={`Roll number: ${u.login_id} · Branch: ${u.branch?.code || "-"} · Year: ${u.year_of_study || "-"}`} />))} empty="No students found." />
      <Pager page={page} setPage={setPage} data={data} />
      <div className="ad-card ad-dark"><h2>Preserve the student journey</h2><p>Account access and academic history are different responsibilities. Deactivate carefully and keep records intact.</p></div>
    </AdminShell>
  );
}

export function Faculty({ message, notify }) {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const { data, page, setPage, load } = useUsers({ role: "FACULTY" }, { search: q || undefined });
  const [reqs, setReqs] = useState([]);
  const loadReqs = useCallback(() => api.get("/faculty-requests/", { params: { status: "PENDING", page_size: 50 } }).then((r) => setReqs(r.data.results)).catch(() => {}), []);
  useEffect(() => { loadReqs(); }, [loadReqs]);
  const act = async (f, a) => {
    let body;
    if (a === "reject") { const reason = window.prompt("Reason for rejecting (the faculty member will see this):"); if (!reason?.trim()) return; body = { reason: reason.trim() }; }
    try { await api.post(`/faculty-requests/${f.id}/${a}/`, body); notify(`${f.full_name} ${a === "approve" ? "approved" : "rejected"}.`, "success"); loadReqs(); load(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const E = { full_name: "", login_id: "", email: "", department: "", password: "" };
  const [f, setF] = useState(E); const [er, setEr] = useState({}); const [busy, setBusy] = useState(false);
  const [tok, setTok] = useState("");
  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); const x = {};
    Object.keys(E).forEach((k) => { if (!f[k].trim()) x[k] = "Required."; });
    if (f.email.trim() && !tok) x.email = "Verify this email: send the code to the faculty member and enter it.";
    setEr(x); if (Object.keys(x).length) return;
    setBusy(true);
    try { await api.post("/users/", { ...f, email_token: tok }); notify(`Faculty account created for ${f.full_name}.`, "success"); setF(E); setTok(""); load(); }
    catch (err) { const p = parseError(err); setEr(p.fields || {}); notify(p.message, "danger"); } finally { setBusy(false); }
  };
  const In = ({ n, label, type = "text", hint }) => (<><label>{label}</label><input className="ad-in" name={n} type={type} value={f[n]} onChange={set} /><Err e={er[n]} />{hint && !er[n] && <div className="ad-hint">{hint}</div>}</>);
  return (
    <AdminShell title="Manage faculty" crumb="Faculty" subtitle="Support your teaching team with clear access and dependable account setup." message={message}>
      <div className="ad-grid g2" style={{ alignItems: "start" }}>
        <div>
          <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search faculty name or ID" /></div>
          {reqs.length > 0 && <div className="ad-card" style={{ marginBottom: 24 }}><h2>Waiting for approval <span className="ad-pill warn">{reqs.length}</span></h2>
            {reqs.map((r) => <Row key={r.id} title={r.full_name} meta={`${r.login_id} · ${r.department} · ${r.email}`}>
              <button className="ad-btn c s" onClick={() => act(r, "approve")}>Approve</button><button className="ad-btn d s" onClick={() => act(r, "reject")}>Reject</button></Row>)}</div>}
          <div className="ad-card"><h2>Faculty directory</h2><span className="ad-eyebrow">{data.count} faculty</span>
            <div style={{ marginTop: 16 }}><List head="Name / Faculty ID / Actions" empty="No faculty yet." rows={data.results.map((u) => (
              <Account key={u.id} u={u} me={me} notify={notify} reload={load} detail={`Faculty ID: ${u.login_id} · ${u.department || "-"}`} />))} /></div>
            <Pager page={page} setPage={setPage} data={data} /></div>
        </div>
        <form className="ad-card ad-form" onSubmit={submit} noValidate><span className="ad-eyebrow">Secure onboarding</span><h2 style={{ marginTop: 8 }}>Add faculty account</h2>
          {In({ n: "full_name", label: "Full name" })}{In({ n: "login_id", label: "Faculty ID", hint: "Use a unique institutional identifier." })}
          <EmailVerify ad label="Email" value={f.email} onChange={set} onToken={setTok} error={er.email || er.email_token} />{In({ n: "department", label: "Department" })}
          {In({ n: "password", label: "Temporary password", type: "password", hint: "Share through an approved secure channel. Min 8 characters with a letter and a number." })}
          <button className="ad-btn p" style={{ marginTop: 22 }} disabled={busy}>{busy ? "Creating…" : "Create account"}</button></form>
      </div>
      <div className="ad-card ad-dark"><h2>A thoughtful onboarding flow</h2><p>Create the account, verify the teaching identity and ask the faculty member to replace the temporary password at first login.</p></div>
    </AdminShell>
  );
}
