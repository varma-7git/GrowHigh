import { useCallback, useEffect, useState } from "react";
import api, { parseError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Act, Card, Filter, FormModal, Head, Pager, Rows, Search, Stat, Stats } from "./ui";

const cnt = (path, params) => api.get(path, { params: { ...params, page_size: 1 } }).then((r) => r.data.count).catch(() => 0);
const fail = (e) => { throw parseError(e); };
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const YEARS = [["", "All years"], ["1", "Year 1"], ["2", "Year 2"], ["3", "Year 3"]];

function useBranches() {
  const [b, setB] = useState([]);
  useEffect(() => { api.get("/branches/", { params: { page_size: 100 } }).then((r) => setB(r.data.results)).catch(() => {}); }, []);
  return b;
}

/** One list used by both the Users and the Students pages. */
function UserList({ role, notify, initialSearch = "", students }) {
  const { user: me } = useAuth();
  const branches = useBranches();
  const [f, setF] = useState({ role, status: "", branch: "", year: "" });
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [], next: null, previous: null });
  const [stats, setStats] = useState({});
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    api.get("/users/", { params: {
      role: (students ? "STUDENT" : f.role) || undefined, search: search || undefined, page, page_size: 8,
      is_active: f.status || undefined, branch: f.branch || undefined, year_of_study: f.year || undefined,
    } }).then((r) => setData(r.data)).catch((e) => notify(parseError(e).message, "danger"));
    const base = students ? { role: "STUDENT" } : {};
    Promise.all([cnt("/users/", base), cnt("/users/", { ...base, is_active: "true" }), cnt("/users/", { ...base, is_active: "false" })])
      .then(([total, active, inactive]) => setStats({ total, active, inactive }));
  }, [f, search, page, students, notify]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (v) => { setF({ ...f, [k]: v }); setPage(1); };

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u.id}/`, { is_active: !u.is_active });
      notify(`${u.full_name} ${u.is_active ? "deactivated" : "reactivated"}.`, "success"); load();
    } catch (e) { notify(parseError(e).message, "danger"); }
  };
  const reset = async (u) => {
    if (!window.confirm(`Reset the password for ${u.full_name}?`)) return;
    try {
      const { data: d } = await api.post(`/users/${u.id}/reset-password/`);
      notify(`New temporary password for ${u.login_id}: ${d.temporary_password} (share it securely; they should change it).`, "warning");
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  const fields = (u) => [
    { name: "full_name", label: "Full name" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
    ...(u.role === "STUDENT" ? [
      { name: "branch_id", label: "Branch", type: "select", options: branches.map((b) => [String(b.id), b.name]) },
      { name: "year_of_study", label: "Year", type: "select", options: [["1", "1"], ["2", "2"], ["3", "3"]] }] : []),
    ...(u.role === "FACULTY" ? [{ name: "department", label: "Department" }] : []),
  ];

  const rows = data.results.map((u) => ({
    id: u.id, title: u.full_name,
    meta: students
      ? [`Roll number: ${u.login_id}`, `Branch: ${u.branch?.code || u.branch?.name || "-"}`, `Year: ${u.year_of_study || "-"}`, `Status: ${u.is_active ? "Active" : "Inactive"}`]
      : [`Login ID: ${u.login_id}`, `Role: ${cap(u.role)}`, `Status: ${u.is_active ? "Active" : "Inactive"}`],
    actions: (<>
      <Act onClick={() => setEdit(u)}>Edit</Act>
      {u.role !== "ADMIN" && u.id !== me.id && <><em>/</em><Act danger={u.is_active} onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Reactivate"}</Act>
        <em>/</em><Act onClick={() => reset(u)}>Reset password</Act></>}
    </>),
  }));

  return (
    <>
      <Stats>
        <Stat label={students ? "Students" : "Total users"} value={stats.total} note={students ? "Registered learners" : "All roles"} />
        <Stat label={students ? "Active" : "Active accounts"} value={stats.active} note="Can log in" />
        <Stat label="Inactive" value={stats.inactive} note="Review access deliberately" />
      </Stats>
      <Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={students ? "Search student name or roll number" : "Search name or login ID"}>
        {students ? (<>
          <Filter value={f.branch} onChange={set("branch")} options={[["", "All branches"], ...branches.map((b) => [String(b.id), b.code || b.name])]} />
          <Filter value={f.year} onChange={set("year")} options={YEARS} />
        </>) : (<>
          <Filter value={f.role} onChange={set("role")} options={[["", "All roles"], ["STUDENT", "Students"], ["FACULTY", "Faculty"], ["COMPANY", "Companies"], ["ADMIN", "Admins"]]} />
          <Filter value={f.status} onChange={set("status")} options={[["", "All statuses"], ["true", "Active"], ["false", "Inactive"]]} />
        </>)}
      </Search>
      <Rows head={students ? "Name / Roll number / Branch / Year / Status / Actions" : "Name / Login ID / Role / Status / Actions"} rows={rows} empty="No users found." />
      <Pager page={page} setPage={setPage} data={data} />
      {edit && <FormModal title={`Edit ${edit.full_name}`} fields={fields(edit)}
        initial={{ ...edit, phone: edit.phone || "", branch_id: edit.branch ? String(edit.branch.id) : "", year_of_study: edit.year_of_study ? String(edit.year_of_study) : "" }}
        onClose={() => setEdit(null)}
        onSave={async (v) => {
          const body = { ...v }; if (!body.phone) delete body.phone;
          if (body.branch_id === "") delete body.branch_id; if (body.year_of_study === "") delete body.year_of_study;
          await api.patch(`/users/${edit.id}/`, body).catch(fail); notify("Saved.", "success"); load();
        }} />}
    </>
  );
}

export function Users({ notify, initialSearch }) {
  return (
    <>
      <Head crumb="Users" title="User management" sub="Manage access with clear identities, roles and safe account actions." />
      <UserList notify={notify} initialSearch={initialSearch} />
      <div className="a-two">
        <Card title="Role-aware account rules">
          <p className="a-body-text">Student login ID: roll number · Faculty login ID: Faculty ID · Company login ID: username · Admin login ID: username.</p>
          <p className="a-note">Admin accounts can only be edited. Deactivating pauses access without removing any history.</p>
        </Card>
        <Card dark title="Handle access with care">
          <p>Deactivation pauses sign-in but keeps learning history. Confirm the account before making a change.</p>
        </Card>
      </div>
    </>
  );
}

export function Students({ notify }) {
  return (
    <>
      <Head crumb="Students" title="Manage students" sub="Keep academic identities, branch assignments and access organised." />
      <UserList students notify={notify} />
      <div className="a-two">
        <Card title="Academic data quality"><p className="a-body-text">Review branch and year before assigning tests or publishing branch-specific content.</p></Card>
        <Card dark title="Preserve the student journey"><p>Account access and academic history are different responsibilities. Deactivate carefully and keep records intact.</p></Card>
      </div>
    </>
  );
}

export function Faculty({ notify, go }) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ results: [] });
  const [reqs, setReqs] = useState([]);
  const [form, setForm] = useState({ full_name: "", login_id: "", email: "", department: "", password: "" });
  const [err, setErr] = useState({ message: "", fields: {} });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/users/", { params: { role: "FACULTY", search: search || undefined, page_size: 50 } }).then((r) => setData(r.data)).catch((e) => notify(parseError(e).message, "danger"));
    api.get("/faculty-requests/", { params: { status: "PENDING", page_size: 50 } }).then((r) => setReqs(r.data.results)).catch(() => {});
  }, [search, notify]);
  useEffect(() => { load(); }, [load]);

  const review = async (f, action) => {
    let body;
    if (action === "reject") { const reason = window.prompt("Reason for rejecting (the faculty member will see this):"); if (!reason || !reason.trim()) return; body = { reason: reason.trim() }; }
    try { await api.post(`/faculty-requests/${f.id}/${action}/`, body); notify(`${f.full_name} ${action === "approve" ? "approved" : "rejected"}.`, "success"); load(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/users/${u.id}/`, { is_active: !u.is_active }); notify(`${u.full_name} ${u.is_active ? "deactivated" : "reactivated"}.`, "success"); load(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr({ message: "", fields: {} });
    try { await api.post("/users/", form); notify(`Faculty account ${form.login_id} created.`, "success"); setForm({ full_name: "", login_id: "", email: "", department: "", password: "" }); load(); }
    catch (x) { setErr(parseError(x)); } finally { setBusy(false); }
  };
  const inp = (name, label, type = "text", hint) => (
    <label className="a-field"><span>{label}</span>
      <input type={type} value={form[name]} autoComplete="off" onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {err.fields[name] ? <small className="bad">{err.fields[name]}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );

  return (
    <>
      <Head crumb="Faculty" title="Manage faculty" sub="Support your teaching team with clear access and dependable account setup." />
      <div className="a-two a-two-wide">
        <div className="a-stack">
          <Search value={search} onChange={setSearch} placeholder="Search faculty name or ID" />
          {reqs.length > 0 && (
            <Card title="Waiting for approval" tag={`${reqs.length} REQUEST${reqs.length > 1 ? "S" : ""}`}>
              <Rows head="Name / Faculty ID / Actions" rows={reqs.map((r) => ({
                id: r.id, title: r.full_name, meta: [`Faculty ID: ${r.login_id}`, r.department, r.email],
                actions: <><Act onClick={() => review(r, "approve")}>Approve</Act><em>/</em><Act danger onClick={() => review(r, "reject")}>Reject</Act></>,
              }))} />
            </Card>
          )}
          <Card title="Faculty directory" tag={`${data.count ?? data.results.length} FACULTY`}>
            <Rows head="Name / Faculty ID / Actions" empty="No faculty yet." rows={data.results.map((u) => ({
              id: u.id, title: u.full_name, meta: [`Faculty ID: ${u.login_id}`, u.department, u.is_active ? null : "Inactive"],
              actions: <><Act onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Reactivate"}</Act></>,
            }))} />
          </Card>
          <Card dark title="A thoughtful onboarding flow"><p>Create the account, verify the teaching identity and ask the faculty member to replace the temporary password at first login.</p></Card>
        </div>
        <Card title="Add faculty account" tag="SECURE ONBOARDING" className="a-form">
          <form onSubmit={create} noValidate>
            {err.message && <div className="a-alert a-alert-danger">{err.message}</div>}
            {inp("full_name", "Full name")}
            {inp("login_id", "Faculty ID", "text", "Use a unique institutional identifier.")}
            {inp("email", "Email", "email")}
            {inp("department", "Department")}
            {inp("password", "Temporary password", "password", "8+ characters with a letter and a number. Share securely.")}
            <button className="a-btn a-btn-coral" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
            <p className="a-note">The new faculty member receives the Faculty role and can log in immediately.</p>
          </form>
        </Card>
      </div>
    </>
  );
}
