import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Stats, Tabs } from "../kit";
import { Ic } from "../icons";
import { all } from "../../admin/ui";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const KIND = { NOTES: "Notes", VIDEO: "Video", PDF: "PDF", LINK: "Web link" };

function GuideCard({ g, flip }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ad-card" style={{ marginBottom: 16 }}>
      <div className="ad-eyebrow">{KIND[g.kind]}{g.done ? " · Done" : ""}</div><h2 style={{ margin: "8px 0" }}>{g.title}</h2>
      {g.kind === "NOTES" && (open || g.body.length < 240 ? <p className="ws-p" style={{ whiteSpace: "pre-line" }}>{g.body}</p> : <p className="ws-p">{g.body.slice(0, 200)}…</p>)}
      {g.kind === "VIDEO" && g.file_url && <video controls preload="metadata" style={{ width: "100%", maxHeight: 460, borderRadius: 14, background: "#000", marginBottom: 12 }} src={g.file_url} />}
      {g.kind === "PDF" && g.file_url && <p className="ws-p"><a href={g.file_url} target="_blank" rel="noreferrer">Open PDF ↗</a></p>}
      {g.kind !== "NOTES" && g.url && <p className="ws-p"><a href={g.url} target="_blank" rel="noreferrer">Open link ↗</a></p>}
      <div className="ws-btns">
        {g.kind === "NOTES" && g.body.length >= 240 && <button className="ad-btn o s" onClick={() => setOpen(!open)}>{open ? "Show less" : "Read more"}</button>}
        <button className={`ad-btn ${g.done ? "o" : "c"} s`} onClick={() => flip(g)}>{g.done ? "Done · Undo" : "Mark as done"}</button>
      </div>
    </div>
  );
}

/** One section of Job preparation, Career growth or Communication: lessons written by the admin, with progress. */
function GuidePage({ area, areaLabel, tabs, sec, label, roadmap }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => { all("/guides/", { area, section: sec }).then(setRows).catch(() => setRows([])); }, [area, sec]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const flip = async (g) => { await api.post(`/guides/${g.id}/${g.done ? "undo" : "complete"}/`).catch(() => {}); load(); };
  const total = (rows || []).length;
  const done = (rows || []).filter((g) => g.done).length;
  const groups = [...new Set((rows || []).map((g) => g.group))];
  const firstOpen = (rows || []).findIndex((g) => !g.done);
  return (
    <WsShell role="student" crumb={`${areaLabel} / ${label}`} title={label} subtitle={`Lessons for ${label.toLowerCase()}, added by your admin.`}>
      <Tabs items={tabs} />
      <Stats items={[["Lessons", String(total), "In this section"], ["Completed", String(done), "Marked done by you"], ["Progress", total ? `${Math.round(done * 100 / total)}%` : "—", total ? "Of this section" : "Nothing added yet"]]} />
      {rows && total === 0 && <div className="ad-empty">Nothing has been added to {label} yet. Check back soon.</div>}
      {roadmap ? (rows || []).map((g, i) => (
        <div className={`ws-st ${g.done ? "" : i === firstOpen ? "cur" : "lock"}`} key={g.id}>
          <div className="dot"><Ic n={g.done ? "check" : i === firstOpen ? "mark" : "lock"} /></div>
          <div style={{ flex: 1 }}><small>Stage {i + 1}</small><h3>{g.title}</h3>{g.body && <p style={{ whiteSpace: "pre-line" }}>{g.body}</p>}
            {g.url && <p><a href={g.url} target="_blank" rel="noreferrer">Open link ↗</a></p>}
            <button className={`ad-btn ${g.done ? "o" : "c"} s`} onClick={() => flip(g)}>{g.done ? "Done · Undo" : "Mark stage done"}</button></div>
        </div>
      )) : groups.map((grp) => (
        <div key={grp || "all"}>{grp && <h2 style={{ margin: "8px 0 14px" }}>{grp}</h2>}
          {rows.filter((g) => g.group === grp).map((g) => <GuideCard key={g.id} g={g} flip={flip} />)}</div>
      ))}
    </WsShell>
  );
}

/* ---------- Job preparation ---------- */
const JP_TABS = [["Aptitude", "/student/job-prep"], ["Reasoning", "/student/job-prep/reasoning"], ["Coding", "/student/job-prep/coding"], ["Technical", "/student/job-prep/technical"], ["HR", "/student/job-prep/hr"], ["Résumé", "/student/job-prep/resume"], ["Projects", "/student/job-prep/projects"]];
const JP = { aptitude: "Aptitude", reasoning: "Reasoning", coding: "Coding practice", technical: "Technical interview", hr: "HR interview", projects: "Project preparation" };

export function JobPrep() {
  const { sec } = useParams();
  if (sec === "resume") return <Resume />;
  const key = sec && JP[sec] ? sec : "aptitude";
  return <GuidePage area="JOB_PREP" areaLabel="Job preparation" tabs={JP_TABS} sec={key} label={JP[key]} />;
}

function Resume() {
  const { user } = useAuth();
  const [r, setR] = useState({ name: user.full_name, role: "", email: user.email || "", phone: user.phone || "", summary: "", skills: "", project: "", edu: "" });
  const set = (k) => (e) => setR({ ...r, [k]: e.target.value });
  const F = ({ k, l, area }) => <><label>{l}</label>{area ? <textarea className="ad-in" rows={3} value={r[k]} onChange={set(k)} /> : <input className="ad-in" value={r[k]} onChange={set(k)} />}</>;
  return (
    <WsShell role="student" crumb="Job preparation / Résumé" title="Résumé builder" subtitle="Fill the form and watch your résumé take shape." action={<Btn b={["Download PDF", null, () => window.print()]} kind="c" />}>
      <Tabs items={JP_TABS} />
      <div className="ws-split" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="ad-card ws-form"><h2>Your details</h2>
          <F k="name" l="Full name" /><F k="role" l="Headline" /><F k="email" l="Email" /><F k="phone" l="Phone" />
          <F k="summary" l="Summary" area /><F k="skills" l="Skills (comma separated)" /><F k="project" l="Project" area /><F k="edu" l="Education" />
        </div>
        <div className="ws-rs ws-print">
          <h2>{r.name}</h2><p>{r.role} · {r.email} · {r.phone}</p>
          <h4>Summary</h4><p>{r.summary}</p><h4>Skills</h4><div className="ws-tags">{r.skills.split(",").filter(Boolean).map((s) => <span key={s}>{s.trim()}</span>)}</div>
          <h4>Projects</h4><p>{r.project}</p><h4>Education</h4><p>{r.edu}</p>
        </div>
      </div>
    </WsShell>
  );
}


/* ---------- Career growth ---------- */
const CG_TABS = [["Technologies", "/student/career"], ["Career paths", "/student/career/paths"], ["Roadmap", "/student/career/roadmap"], ["Projects", "/student/career/projects"]];
const CG = { technologies: "Technologies", paths: "Career paths", roadmap: "Roadmap", projects: "Recommended projects" };
export function Career() {
  const { sec } = useParams();
  const key = sec && CG[sec] ? sec : "technologies";
  return <GuidePage area="CAREER" areaLabel="Career growth" tabs={CG_TABS} sec={key} label={CG[key]} roadmap={key === "roadmap"} />;
}

/* ---------- Communication ---------- */
const CM_TABS = [["Spoken English", "/student/communication"], ["Vocabulary", "/student/communication/vocabulary"], ["Grammar", "/student/communication/grammar"], ["Speaking", "/student/communication/speaking"], ["Listening", "/student/communication/listening"], ["Group discussion", "/student/communication/gd"], ["Presentation", "/student/communication/presentation"], ["Interview", "/student/communication/interview"], ["Professional", "/student/communication/professional"]];
const CM = { spoken: "Spoken English", vocabulary: "Vocabulary", grammar: "Grammar", speaking: "Speaking practice", listening: "Listening", gd: "Group discussion", presentation: "Presentation skills", interview: "Interview communication", professional: "Professional communication" };
export function Comm() {
  const { sec } = useParams();
  const key = sec && CM[sec] ? sec : "spoken";
  return <GuidePage area="COMM" areaLabel="Communication" tabs={CM_TABS} sec={key} label={CM[key]} />;
}
