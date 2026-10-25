import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Tabs } from "../kit";
import { Err, Search, Select } from "../../admin/ui";
import api, { parseError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const JT = [["Jobs & internships", "/student/jobs"], ["Saved", "/student/jobs/saved"]];
const getSaved = () => { try { return JSON.parse(localStorage.getItem("gh_saved") || "[]"); } catch { return []; } };
const setSaved = (a) => { try { localStorage.setItem("gh_saved", JSON.stringify(a)); } catch { /* ignore */ } };
const kind = (j) => (j.job_type === "INTERNSHIP" ? "Internship" : "Job");

function Card({ j, saved, toggle, apply }) {
  return (
    <div className="ad-card ws-job">
      <div className="top"><span>{kind(j)}</span><button className={`ws-save ${saved ? "on" : ""}`} aria-label="Save" onClick={() => toggle(j.id)}><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg></button></div>
      <h3>{j.title}</h3><div className="co">{j.company_name}</div>
      <div className="mt">{[j.location, j.pay, j.deadline && `Last date ${j.deadline}`].filter(Boolean).join(" · ")}</div>
      <div className="ws-tags">{(j.branches?.length ? j.branches.map((b) => b.code || b.name) : ["All branches"]).map((b) => <span key={b}>{b}</span>)}</div>
      <div className="ft"><Link className="ad-link" to={`/student/jobs/${j.id}`}>View details</Link>
        {j.has_applied ? <button className="ad-btn o s" disabled>Applied</button> : <button className="ad-btn c s" onClick={() => apply(j)}>Apply</button>}</div>
    </div>
  );
}

export function Jobs({ savedOnly }) {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState([]);
  const [saved, setSv] = useState(getSaved);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api.get("/jobs/", { params: { page_size: 100, job_type: type || undefined, search: q || undefined } }).then((r) => setJobs(r.data.results)).catch((e) => setErr(parseError(e).message));
  }, [type, q]);
  useEffect(() => { load(); }, [load]);
  const toggle = (id) => { const n = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id]; setSv(n); setSaved(n); };
  const apply = async (j) => {
    setErr(""); setMsg("");
    try { await api.post(`/jobs/${j.id}/apply/`); setMsg(`Applied to ${j.title}.`); } catch (e) { setErr(parseError(e).message); }
    load();
  };
  const rows = savedOnly ? jobs.filter((j) => saved.includes(j.id)) : jobs;
  return (
    <WsShell role="student" crumb="Jobs & internships" title="Jobs & internships" subtitle="Openings approved for your branch.">
      <Tabs items={JT} /><Err e={err} />{msg && <div className="ad-alert">{msg}</div>}
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search by title or company" /><Select value={type} onChange={setType} options={[["", "Jobs and internships"], ["JOB", "Jobs"], ["INTERNSHIP", "Internships"]]} /></div>
      {rows.length === 0 && <div className="ad-empty">{savedOnly ? "You have not saved any openings." : "No openings for your branch right now."}</div>}
      <div className="ws-tiles" style={{ "--c": 2 }}>{rows.map((j) => <Card key={j.id} j={j} saved={saved.includes(j.id)} toggle={toggle} apply={apply} />)}</div>
    </WsShell>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [j, setJ] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { api.get(`/jobs/${id}/`).then((r) => setJ(r.data)).catch((e) => setErr(parseError(e).message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  const apply = async () => { try { await api.post(`/jobs/${id}/apply/`); load(); } catch (e) { setErr(parseError(e).message); } };
  const skills = (j?.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <WsShell role="student" crumb="Jobs & internships / Details" title={j ? j.title : "Job details"} subtitle={j ? `${j.company_name}${j.location ? ` · ${j.location}` : ""}` : ""} action={<Btn b={["Back to jobs", "/student/jobs"]} />}>
      <Err e={err} />
      {j && (
        <div className="ws-split">
          <div className="ad-card"><div className="ad-eyebrow">{kind(j)}</div><h2 style={{ marginTop: 8 }}>About this opening</h2><p className="ws-p" style={{ whiteSpace: "pre-line" }}>{j.description}</p>
            <div className="ws-tags">{[j.pay && `Pay: ${j.pay}`, j.deadline && `Last date: ${j.deadline}`, `For: ${j.branches?.length ? j.branches.map((b) => b.code || b.name).join(", ") : "All branches"}`].filter(Boolean).map((t) => <span key={t}>{t}</span>)}</div>
            {j.apply_link && <p className="ws-p"><a href={j.apply_link} target="_blank" rel="noreferrer">External link</a></p>}
          </div>
          <div className="ad-card"><h2>Apply</h2>
            {skills.length > 0 && <div className="ws-tags">{skills.map((s) => <span key={s}>{s}</span>)}</div>}
            <div className="ws-ck" style={{ borderTop: 0 }}><span>Branch matches ({user.branch?.code || user.branch?.name || "yours"})</span><em>✓</em></div>
            <div className="ws-btns">{j.has_applied ? <button className="ad-btn o" disabled>Applied</button> : <button className="ad-btn c" onClick={apply}>Apply now</button>}</div>
          </div>
        </div>
      )}
    </WsShell>
  );
}

export function Applications() {
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get("/my-applications/", { params: { page_size: 100 } }).then((r) => setRows(r.data.results)).catch(() => setRows([])); }, []);
  const on = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <WsShell role="student" crumb="My applications" title="My applications" subtitle="Everything you have applied for.">
      {rows && rows.length === 0 && <div className="ad-empty">You have not applied to anything yet. Open Jobs &amp; internships to find an opening.</div>}
      <div className="ws-tiles" style={{ "--c": 2 }}>
        {(rows || []).map((a) => (
          <div className="ad-card ws-job" key={a.id}>
            <div className="top"><span>{a.job.job_type === "INTERNSHIP" ? "Internship" : "Job"}</span><span className="ad-pill ok">Applied</span></div>
            <h3>{a.job.title}</h3><div className="co">{a.job.company_name}</div>
            <div className="mt">{[a.job.location, `Applied on ${on(a.applied_at)}`, a.job.deadline && `Last date ${a.job.deadline}`].filter(Boolean).join(" · ")}</div>
            <div className="ft"><button className="ad-btn o s" onClick={() => nav(`/student/jobs/${a.job.id}`)}>View job</button>{a.job.apply_link && <a className="ad-link" href={a.job.apply_link} target="_blank" rel="noreferrer">Company link</a>}</div>
          </div>
        ))}
      </div>
    </WsShell>
  );
}
