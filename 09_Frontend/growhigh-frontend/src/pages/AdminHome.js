import { useCallback, useEffect, useState } from "react";
import Applicants from "../components/Applicants";
import JobCard, { STATUS_CLASS } from "../components/JobCard";
import JobForm from "../components/JobForm";
import Shell from "../components/Shell";
import UsersPanel from "../components/UsersPanel";
import api, { parseError } from "../api/client";

function Companies({ notify }) {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const load = useCallback(() => {
    api.get("/companies/", { params: { status, page_size: 100 } }).then((r) => setRows(r.data.results))
      .catch((e) => notify(parseError(e).message, "danger"));
  }, [status, notify]);
  useEffect(() => { load(); }, [load]);

  const act = async (c, action) => {
    let body;
    if (action === "reject") {
      const reason = window.prompt("Reason for rejecting (the company will see this):");
      if (!reason || !reason.trim()) return;
      body = { reason: reason.trim() };
    }
    try {
      await api.post(`/companies/${c.id}/${action}/`, body);
      notify(`${c.company_name} ${action === "approve" ? "approved" : "rejected"}.`, "success");
      load();
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  return (
    <>
      <div className="mb-3 d-flex gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="text-muted">No {status.toLowerCase()} companies.</p>}
      {rows.map((c) => (
        <div className="gh-job" key={c.id}>
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <h3 className="gh-h3">{c.company_name}</h3>
            <span className={`badge text-bg-${STATUS_CLASS[c.status]} align-self-start`}>{c.status}</span>
          </div>
          <div className="gh-meta mb-2">
            <span>Contact: <b>{c.contact_person}</b>{c.designation ? ` (${c.designation})` : ""}</span>
            <span>Email: {c.email}</span><span>Phone: {c.phone}</span>
            {c.location && <span>Location: {c.location}</span>}
            {c.website && <span><a href={c.website} target="_blank" rel="noreferrer">{c.website}</a></span>}
            <span>Username: {c.login_id}</span>
            <span>Registered: {new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          {c.description && <p className="gh-desc">{c.description}</p>}
          {c.status === "REJECTED" && c.rejection_reason && <div className="gh-error">Rejected: {c.rejection_reason}</div>}
          <div className="d-flex gap-2 mt-2">
            {c.status !== "APPROVED" && <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={() => act(c, "approve")}>Approve</button>}
            {c.status !== "REJECTED" && <button className="btn btn-sm btn-outline-danger" onClick={() => act(c, "reject")}>Reject</button>}
          </div>
        </div>
      ))}
    </>
  );
}

function FacultyRequests({ notify }) {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const load = useCallback(() => {
    api.get("/faculty-requests/", { params: { status, page_size: 100 } }).then((r) => setRows(r.data.results))
      .catch((e) => notify(parseError(e).message, "danger"));
  }, [status, notify]);
  useEffect(() => { load(); }, [load]);

  const act = async (f, action) => {
    let body;
    if (action === "reject") {
      const reason = window.prompt("Reason for rejecting (the faculty member will see this):");
      if (!reason || !reason.trim()) return;
      body = { reason: reason.trim() };
    }
    try {
      await api.post(`/faculty-requests/${f.id}/${action}/`, body);
      notify(`${f.full_name} ${action === "approve" ? "approved" : "rejected"}.`, "success");
      load();
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  return (
    <>
      <div className="mb-3 d-flex gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="text-muted">No {status.toLowerCase()} faculty.</p>}
      {rows.map((f) => (
        <div className="gh-job" key={f.id}>
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <h3 className="gh-h3">{f.full_name}</h3>
            <span className={`badge text-bg-${STATUS_CLASS[f.status]} align-self-start`}>{f.status}</span>
          </div>
          <div className="gh-meta mb-2">
            <span>Faculty ID: <b>{f.login_id}</b></span><span>Department: {f.department}</span>
            <span>Email: {f.email}</span><span>Phone: {f.phone || "-"}</span>
            <span>Registered: {new Date(f.created_at).toLocaleDateString()}</span>
          </div>
          {f.status === "REJECTED" && f.rejection_reason && <div className="gh-error">Rejected: {f.rejection_reason}</div>}
          <div className="d-flex gap-2 mt-2">
            {f.status !== "APPROVED" && <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={() => act(f, "approve")}>Approve</button>}
            {f.status !== "REJECTED" && <button className="btn btn-sm btn-outline-danger" onClick={() => act(f, "reject")}>Reject</button>}
          </div>
        </div>
      ))}
    </>
  );
}

function Jobs({ notify }) {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => {
    api.get("/jobs/", { params: { status, page_size: 100 } }).then((r) => setRows(r.data.results))
      .catch((e) => notify(parseError(e).message, "danger"));
  }, [status, notify]);
  useEffect(() => { load(); }, [load]);

  const act = async (j, action) => {
    let body;
    if (action === "reject") {
      const reason = window.prompt("Reason for rejecting (the company will see this):");
      if (!reason || !reason.trim()) return;
      body = { reason: reason.trim() };
    }
    try {
      await api.post(`/jobs/${j.id}/${action}/`, body);
      notify(`"${j.title}" ${action === "approve" ? "approved" : "rejected"}.`, "success");
      load();
    } catch (e) { notify(parseError(e).message, "danger"); }
  };

  if (viewing) return <Applicants job={viewing} onClose={() => setViewing(null)} />;
  return (
    <>
      <div className="mb-3 d-flex gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="text-muted">Nothing here.</p>}
      {rows.map((j) => (
        <JobCard key={j.id} job={j} showStatus>
          {j.status !== "APPROVED" && <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={() => act(j, "approve")}>Approve</button>}
          {j.status !== "REJECTED" && <button className="btn btn-sm btn-outline-danger" onClick={() => act(j, "reject")}>Reject</button>}
          {j.status === "APPROVED" && <button className="gh-btn gh-btn-sm gh-btn-dark" onClick={() => setViewing(j)}>Applicants ({j.applicant_count})</button>}
        </JobCard>
      ))}
    </>
  );
}

function Report() {
  const [type, setType] = useState("INTERNSHIP");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/jobs/applications-summary/", { params: { job_type: type } }).then((r) => setRows(r.data))
      .catch((e) => setError(parseError(e).message));
  }, [type]);
  return (
    <>
      <div className="mb-3 d-flex gap-2">
        {[["INTERNSHIP", "Internships"], ["JOB", "Jobs"]].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${type === k ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {rows.length === 0 && <p className="text-muted">No approved postings yet.</p>}
      {rows.map((r) => (
        <div className="gh-job" key={r.job_id}>
          <div className="d-flex justify-content-between flex-wrap">
            <div><h3 className="gh-h3">{r.title}</h3><div className="gh-hint">{r.company_name}</div></div>
            <div><b className="fs-4">{r.total}</b> <span className="gh-hint">applied</span></div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            {r.by_branch.length === 0 ? <span className="gh-hint">No applications yet</span>
              : r.by_branch.map((b) => <span className="gh-badge" key={b.branch_id}>{b.branch_name}: <b>{b.count}</b></span>)}
          </div>
        </div>
      ))}
    </>
  );
}

export default function AdminHome() {
  const [tab, setTab] = useState("users");
  const [message, setMessage] = useState({ kind: "", text: "" });
  const notify = useCallback((text, kind = "success") => setMessage({ kind, text }), []);
  return (
    <Shell title="Admin dashboard" tab={tab} onTab={(t) => { setTab(t); setMessage({ kind: "", text: "" }); }}
      tabs={[["users", "All users"], ["faculty", "Faculty requests"], ["companies", "Companies"], ["jobs", "Job reviews"], ["post", "Post job / internship"], ["report", "Applications by course"]]}>
      {message.text && <div className={`alert alert-${message.kind}`}>{message.text}</div>}
      {tab === "users" && <UsersPanel notify={notify} />}
      {tab === "faculty" && <FacultyRequests notify={notify} />}
      {tab === "companies" && <Companies notify={notify} />}
      {tab === "jobs" && <Jobs notify={notify} />}
      {tab === "post" && <JobForm needCompany onDone={() => { notify("Posted. Students can see it now."); setTab("jobs"); }} />}
      {tab === "report" && <Report />}
    </Shell>
  );
}
