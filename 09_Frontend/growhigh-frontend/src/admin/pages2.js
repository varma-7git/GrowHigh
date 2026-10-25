import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Applicants from "../components/Applicants";
import api, { parseError } from "../api/client";
import { AdminShell, Bar, Err, Icon, List, Row, Search, Select, Stat, all } from "./ui";

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const SL = <span className="ad-sl">/</span>;
async function remove(url, what, notify, done) {
  if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return;
  try { await api.delete(url); notify(`${what} deleted.`, "success"); done(); } catch (e) { notify(parseError(e).message, "danger"); }
}

export function Branches({ message, notify }) {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(""); const [lvl, setLvl] = useState("");
  const [form, setForm] = useState(null); const [er, setEr] = useState({});
  const load = useCallback(async () => {
    try {
      const [bs, subs, tops] = await Promise.all([all("/branches/"), all("/subjects/"), all("/topics/")]);
      const withTopics = new Set(tops.map((t) => t.subject_id));
      const counts = await Promise.all(bs.map((b) => api.get("/users/", { params: { role: "STUDENT", branch: b.id, page_size: 1 } }).then((r) => r.data.count)));
      setRows(bs.map((b, i) => { const s = subs.filter((x) => x.branch_id === b.id); return { ...b, students: counts[i], subjects: s.length, coverage: pct(s.filter((x) => withTopics.has(x.id)).length, s.length) }; }));
    } catch (e) { notify(parseError(e).message, "danger"); }
  }, [notify]);
  useEffect(() => { load(); }, [load]);
  const shown = rows.filter((b) => (b.name + b.code).toLowerCase().includes(q.toLowerCase())
    && (!lvl || (lvl === "high" ? b.coverage >= 80 : lvl === "mid" ? b.coverage >= 50 && b.coverage < 80 : b.coverage < 50)));
  const save = async (e) => {
    e.preventDefault(); setEr({});
    const body = { name: form.name, code: form.code, is_active: form.is_active !== false };
    try { form.id ? await api.patch(`/branches/${form.id}/`, body) : await api.post("/branches/", body); notify("Branch saved.", "success"); setForm(null); load(); }
    catch (x) { const p = parseError(x); setEr(p.fields || {}); notify(p.message, "danger"); }
  };
  const edit = (b) => setForm({ id: b.id, name: b.name, code: b.code, is_active: b.is_active });
  const del = (b) => remove(`/branches/${b.id}/`, b.name, notify, load);
  return (
    <AdminShell title="Branches & learning capacity" crumb="Branches" subtitle="Keep academic structure connected to students, subjects and syllabus coverage." message={message}
      action={<button className="ad-btn p" onClick={() => setForm({ name: "", code: "", is_active: true })}>Add branch</button>}>
      <div className="ad-grid g3"><Stat label="Branches" value={rows.length} note="Curriculum structure" /><Stat label="Students" value={rows.reduce((a, b) => a + b.students, 0)} note="Total across branches" /><Stat label="Mapped subjects" value={rows.reduce((a, b) => a + b.subjects, 0)} note="Subjects linked to a branch" /></div>
      {form && <form className="ad-card ad-form" style={{ marginBottom: 24 }} onSubmit={save}><h2>{form.id ? "Edit branch" : "Add branch"}</h2>
        <div className="ad-grid g2" style={{ marginBottom: 0 }}><div><label>Branch name</label><input className="ad-in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Err e={er.name} /></div>
          <div><label>Code</label><input className="ad-in" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /><Err e={er.code} /></div></div>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible to students</label>
        <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 20 }}><button className="ad-btn p">Save</button><button type="button" className="ad-btn o" onClick={() => setForm(null)}>Cancel</button></div></form>}
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search branch" />
        <Select value={lvl} onChange={setLvl} options={[["", "All coverage levels"], ["high", "80% and above"], ["mid", "50% to 79%"], ["low", "Below 50%"]]} /></div>
      <div className="ad-bcs">{shown.map((b) => (
        <div className="ad-card ad-bc" key={b.id}><Icon n="book" /><h3>{b.name}{!b.is_active && <span className="ad-pill bad">Hidden</span>}</h3>
          <p>{b.students} students · {b.subjects} mapped subjects</p><em>{b.code} · {b.coverage}% content coverage</em>
          <button className="ad-btn o s" onClick={() => edit(b)}>Edit</button> {SL} <button className="ad-btn o s" onClick={() => del(b)}>Delete</button></div>))}
        {shown.length === 0 && <div className="ad-card ad-empty">No branches found.</div>}</div>
      <div className="ad-card"><h2>Branch relationships</h2><List head="Branch / Students / Subjects / Coverage / Actions" rows={shown.map((b) => (
        <Row key={b.id} title={b.code} meta={`Students: ${b.students} · Subjects: ${b.subjects} · Coverage: ${b.coverage}%`}>
          <button className="ad-link" onClick={() => edit(b)}>Edit</button>{SL}<button className="ad-link r" onClick={() => del(b)}>Delete</button></Row>))} />
        <small style={{ color: "#6b7a90" }}>Check linked students and subject content before deleting a branch. A linked branch cannot be deleted; untick "Visible to students" to hide it.</small></div>
    </AdminShell>
  );
}

const KINDS = [["NOTES", "Notes"], ["VIDEO", "Video link"], ["PDF", "PDF link"], ["LINK", "Web link"]];
function Materials({ topics, notify }) {
  const [tid, setTid] = useState("");
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(null); const [er, setEr] = useState({});
  const cur = tid || String(topics[0]?.id || "");
  const load = useCallback(() => { if (cur) api.get("/materials/", { params: { topic: cur, page_size: 100 } }).then((r) => setRows(r.data.results)).catch(() => {}); else setRows([]); }, [cur]);
  useEffect(() => { load(); }, [load]);
  const save = async (e) => {
    e.preventDefault(); setEr({});
    const body = { topic_id: Number(cur), kind: f.kind, title: f.title, body: f.kind === "NOTES" ? f.body : "", url: f.kind === "NOTES" ? "" : f.url };
    try { f.id ? await api.patch(`/materials/${f.id}/`, body) : await api.post("/materials/", body); notify("Material saved.", "success"); setF(null); load(); }
    catch (x) { const p2 = parseError(x); setEr(p2.fields || {}); notify(p2.message, "danger"); }
  };
  const toggle = async (m) => { try { await api.patch(`/materials/${m.id}/`, { is_active: !m.is_active }); load(); } catch (x) { notify(parseError(x).message, "danger"); } };
  return (
    <div className="ad-card" style={{ marginBottom: 24 }}><h2>Learning material</h2>
      <p style={{ color: "#6b7a90", marginTop: 0 }}>Notes, videos, PDFs and links that students use to learn a topic before practising.</p>
      <select className="ad-in" value={cur} onChange={(e) => { setTid(e.target.value); setF(null); }}>{topics.length === 0 && <option value="">Select a subject with topics</option>}{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <div style={{ marginTop: 14 }}><List head="Material / Type / Action" empty="No material for this topic yet." rows={rows.map((m) => (
        <Row key={m.id} title={<>{m.title}{!m.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={KINDS.find((k) => k[0] === m.kind)?.[1]}>
          <button className="ad-link" onClick={() => setF({ id: m.id, kind: m.kind, title: m.title, body: m.body, url: m.url })}>Edit</button>{SL}<button className="ad-link" onClick={() => toggle(m)}>{m.is_active ? "Hide" : "Show"}</button></Row>))} /></div>
      {f ? (
        <form onSubmit={save} className="ad-form" style={{ marginTop: 14 }}>
          <label>Type</label><select className="ad-in" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label>Title</label><input className="ad-in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Err e={er.title} />
          {f.kind === "NOTES" ? <><label>Notes</label><textarea className="ad-in" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><Err e={er.body} /></>
            : <><label>Link</label><input className="ad-in" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /><Err e={er.url} /></>}
          <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 14 }}><button className="ad-btn p">Save</button><button type="button" className="ad-btn o" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      ) : <button className="ad-btn o" style={{ marginTop: 14 }} disabled={!cur} onClick={() => setF({ kind: "NOTES", title: "", body: "", url: "" })}>Add material</button>}
    </div>
  );
}

export function Subjects({ message, notify }) {
  const [subs, setSubs] = useState([]); const [branches, setBranches] = useState([]); const [topics, setTopics] = useState([]);
  const [sel, setSel] = useState(null); const [q, setQ] = useState(""); const [scope, setScope] = useState("");
  const [sf, setSf] = useState(null); const [er, setEr] = useState({});
  const [regs, setRegs] = useState([]); const [regScope, setRegScope] = useState(""); const [rf, setRf] = useState(null);
  const loadRegs = useCallback(() => { all("/regulations/").then(setRegs).catch(() => {}); }, []);
  useEffect(() => { loadRegs(); }, [loadRegs]);
  const saveReg = async (e) => {
    e.preventDefault();
    try { await api.post("/regulations/", { code: rf.code }); notify("Regulation saved.", "success"); setRf(null); loadRegs(); } catch (x2) { notify(parseError(x2).message, "danger"); }
  };
  const toggleReg = async (r) => { try { await api.patch(`/regulations/${r.id}/`, { is_active: !r.is_active }); loadRegs(); } catch (x2) { notify(parseError(x2).message, "danger"); } };
  const load = useCallback(async () => {
    try { const [s, t] = await Promise.all([all("/subjects/"), all("/topics/")]); setSubs(s); setTopics(t); setSel((c) => c || s[0]?.id || null); }
    catch (e) { notify(parseError(e).message, "danger"); }
  }, [notify]);
  useEffect(() => { load(); all("/branches/").then(setBranches); }, [load]);
  const cur = subs.find((s) => s.id === sel); const mine = topics.filter((t) => t.subject_id === sel);
  const shown = subs.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) && (regScope === "" || (regScope === "none" ? !s.regulation_id : String(s.regulation_id) === regScope)) && (scope === "" || (scope === "common" ? !s.branch_id : String(s.branch_id) === scope)));
  const save = async (e) => {
    e.preventDefault(); setEr({});
    const body = { name: sf.name, code: sf.code || null, marks: sf.marks === "" || sf.marks == null ? null : Number(sf.marks), branch_id: sf.branch_id ? Number(sf.branch_id) : null, regulation_id: sf.regulation_id ? Number(sf.regulation_id) : null, semester: sf.semester ? Number(sf.semester) : null, is_active: sf.is_active !== false };
    try { sf.id ? await api.patch(`/subjects/${sf.id}/`, body) : await api.post("/subjects/", body); notify("Subject saved.", "success"); setSf(null); load(); }
    catch (x) { const p = parseError(x); setEr(p.fields || {}); notify(p.message, "danger"); }
  };
  const editS = (s) => setSf({ id: s.id, name: s.name, code: s.code || "", marks: s.marks ?? "", branch_id: s.branch_id || "", regulation_id: s.regulation_id || "", semester: s.semester || "", is_active: s.is_active });
  return (
    <AdminShell title="Subjects & topics" crumb="Subjects & topics" subtitle="A relationship-first workspace for syllabus content and question coverage." message={message}
      action={<button className="ad-btn p" onClick={() => setSf({ name: "", code: "", marks: "", branch_id: "", regulation_id: "", semester: "", is_active: true })}>Add subject</button>}>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search subject or linked topic" />
        <Select value={scope} onChange={setScope} options={[["", "All subjects"], ["common", "Common subjects"], ...branches.map((b) => [String(b.id), b.code])]} />
        <Select value={regScope} onChange={setRegScope} options={[["", "All regulations"], ["none", "ECET subjects"], ...regs.map((r) => [String(r.id), r.code])]} /></div>
      {sf && <form className="ad-card ad-form" style={{ marginBottom: 24 }} onSubmit={save}><h2>{sf.id ? "Edit subject" : "Add subject"}</h2>
        <div className="ad-grid g2" style={{ marginBottom: 0 }}>
          <div><label>Subject name</label><input className="ad-in" value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} /><Err e={er.name} /></div>
          <div><label>Branch</label><select className="ad-in" value={sf.branch_id} onChange={(e) => setSf({ ...sf, branch_id: e.target.value })}><option value="">Common (all branches)</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label>Regulation</label><select className="ad-in" value={sf.regulation_id} onChange={(e) => setSf({ ...sf, regulation_id: e.target.value })}><option value="">Not tied to a regulation (ECET subject)</option>{regs.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</select><Err e={er.regulation_id} /></div>
          <div><label>Semester</label><select className="ad-in" value={sf.semester} onChange={(e) => setSf({ ...sf, semester: e.target.value })}><option value="">Not applicable</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Semester {n}</option>)}</select><Err e={er.semester} /></div>
          <div><label>Code (optional)</label><input className="ad-in" value={sf.code} onChange={(e) => setSf({ ...sf, code: e.target.value })} /><Err e={er.code} /></div>
          <div><label>Marks</label><input className="ad-in" type="number" min="0" value={sf.marks} onChange={(e) => setSf({ ...sf, marks: e.target.value })} /><Err e={er.marks} /></div></div>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={sf.is_active !== false} onChange={(e) => setSf({ ...sf, is_active: e.target.checked })} /> Visible to students</label>
        <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 20 }}><button className="ad-btn p">Save</button><button type="button" className="ad-btn o" onClick={() => setSf(null)}>Cancel</button></div></form>}
      <div className="ad-grid g2" style={{ alignItems: "start" }}>
        <div className="ad-card"><h2>Subject library</h2>{cur && <span className="ad-eyebrow">{cur.name} selected</span>}
          <div style={{ marginTop: 16 }}><List head="Subject / Topics / Marks / Action" empty="No subjects." rows={shown.map((s) => (
            <Row key={s.id} title={<span style={{ cursor: "pointer", color: s.id === sel ? "#0aa5c0" : "" }} onClick={() => setSel(s.id)}>{s.name}{!s.is_active && <span className="ad-pill bad">Hidden</span>}</span>}
              meta={`Topics: ${topics.filter((t) => t.subject_id === s.id).length} · Marks: ${s.marks ?? "-"} · ${s.regulation_id ? `${regs.find((r) => r.id === s.regulation_id)?.code || ""} Sem ${s.semester || "-"}` : "ECET"} · ${s.branch_id ? branches.find((b) => b.id === s.branch_id)?.code || "Branch" : "Common"}`}>
              <button className="ad-link" onClick={() => editS(s)}>Edit</button>{SL}<button className="ad-link r" onClick={() => remove(`/subjects/${s.id}/`, s.name, notify, () => { setSel(null); load(); })}>Delete</button></Row>))} /></div>
          <button className="ad-btn o" onClick={() => setSf({ name: "", code: "", marks: "", branch_id: "", regulation_id: "", semester: "", is_active: true })}>Add subject</button></div>
        <div className="ad-card"><h2>{cur ? `${cur.name} → linked topics` : "Linked topics"}</h2>
          <List head="Topic / Questions / Action" empty={cur ? "No topics yet." : "Select a subject."} rows={mine.map((t) => (
            <Row key={t.id} title={t.name} meta="Questions: 0"><Link className="ad-link" to={`/admin/topics?edit=${t.id}`}>Edit</Link></Row>))} />
          <Link className="ad-btn p" to={`/admin/topics${cur ? `?subject=${cur.id}` : ""}`}>Add topic</Link></div>
      </div>
      <Materials topics={mine} notify={notify} />
      <div className="ad-card" style={{ marginBottom: 24 }}><h2>Regulations</h2>
        <p style={{ color: "#6b7a90", marginTop: 0 }}>Add each curriculum scheme, then add its subjects with a regulation and semester. Students see only their own regulation and branch.</p>
        <List head="Regulation / Subjects / Action" empty="No regulations yet." rows={regs.map((r) => (
          <Row key={r.id} title={<>{r.code}{!r.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={`Subjects: ${subs.filter((s) => s.regulation_id === r.id).length}`}>
            <button className="ad-link" onClick={() => toggleReg(r)}>{r.is_active ? "Hide" : "Show"}</button></Row>))} />
        {rf ? <form onSubmit={saveReg} className="ad-form" style={{ marginTop: 14 }}><label>Regulation code</label><input className="ad-in" value={rf.code} placeholder="e.g. C26" onChange={(e) => setRf({ code: e.target.value })} />
          <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 14 }}><button className="ad-btn p">Save</button><button type="button" className="ad-btn o" onClick={() => setRf(null)}>Cancel</button></div></form>
          : <button className="ad-btn o" onClick={() => setRf({ code: "" })}>Add regulation</button>}
      </div>
      <div className="ad-grid g2">
        <div className="ad-card ad-dark"><h2>Keep the hierarchy clear</h2><p>Regulation → Branch → Semester → Subject → Topic → Question. Moving or deleting a topic can affect question mapping and test coverage.</p><p>A subject or topic that is linked to other records cannot be deleted; untick "Visible to students" to hide it.</p></div>
        <div className="ad-card"><h2>Content health</h2><Bar label="Subjects with topics" pct={pct(new Set(topics.map((t) => t.subject_id)).size, subs.length)} />
          <Bar label="Topics with a description" pct={pct(topics.filter((t) => t.description).length, topics.length)} /><small style={{ color: "#6b7a90" }}>Calculated from your live subject and topic data.</small></div>
      </div>
    </AdminShell>
  );
}

export function Topics({ message, notify }) {
  const qs = new URLSearchParams(window.location.search);
  const [subs, setSubs] = useState([]); const [topics, setTopics] = useState([]); const [q, setQ] = useState("");
  const [subj, setSubj] = useState(qs.get("subject") || ""); const [cov, setCov] = useState("");
  const [f, setF] = useState({ subject_id: qs.get("subject") || "", name: "", description: "", order_no: 0 }); const [editId, setEditId] = useState(null); const [er, setEr] = useState({});
  const load = useCallback(async () => {
    try { const [s, t] = await Promise.all([all("/subjects/"), all("/topics/")]); setSubs(s); setTopics(t);
      const eid = Number(qs.get("edit")); if (eid && !editId) { const x = t.find((y) => y.id === eid); if (x) startEdit(x); }
      setF((c) => (c.subject_id ? c : { ...c, subject_id: s[0]?.id || "" })); }
    catch (e) { notify(parseError(e).message, "danger"); }
  }, [notify]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const startEdit = (t) => { setEditId(t.id); setF({ subject_id: t.subject_id, name: t.name, description: t.description || "", order_no: t.order_no }); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); };
  const sname = (id) => subs.find((s) => s.id === id)?.name || "-";
  const shown = topics.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) && (!subj || String(t.subject_id) === String(subj)) && (!cov || (cov === "ok" ? t.description : !t.description)));
  const inSubj = topics.filter((t) => !subj || String(t.subject_id) === String(subj));
  const save = async (e) => {
    e.preventDefault(); setEr({});
    const body = { subject_id: Number(f.subject_id), name: f.name, description: f.description, order_no: Number(f.order_no || 0) };
    try { editId ? await api.patch(`/topics/${editId}/`, body) : await api.post("/topics/", body); notify("Topic saved.", "success"); setEditId(null); setF({ ...f, name: "", description: "" }); load(); }
    catch (x) { const p = parseError(x); setEr(p.fields || {}); notify(p.message, "danger"); }
  };
  const covPct = pct(inSubj.filter((t) => t.description).length, inSubj.length);
  return (
    <AdminShell title="Topic management" crumb="Subjects & topics" subtitle="Make every practice topic easy to find, maintain and connect to questions." message={message}
      action={<button className="ad-btn p" onClick={() => { setEditId(null); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Add topic</button>}>
      <div className="ad-grid g3"><Stat label={`${subj ? sname(Number(subj)) : "All"} topics`} value={inSubj.length} note="In the selected subject" /><Stat label="Questions mapped" value={0} note="Appears once the question bank is built" /><Stat label="Needs review" value={inSubj.filter((t) => !t.description).length} note="Topics without a description" /></div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search topics" />
        <Select value={subj} onChange={setSubj} options={[["", "All subjects"], ...subs.map((s) => [String(s.id), s.name])]} />
        <Select value={cov} onChange={setCov} options={[["", "All coverage"], ["ok", "Described"], ["no", "Needs description"]]} /></div>
      <List head="Topic / Subject / Questions / Actions" empty="No topics found." rows={shown.map((t) => (
        <Row key={t.id} title={t.name} meta={`Subject: ${sname(t.subject_id)} · Questions: 0${t.is_active ? "" : " · Hidden"}`}>
          <button className="ad-link" onClick={() => startEdit(t)}>Edit</button>{SL}<button className="ad-link r" onClick={() => remove(`/topics/${t.id}/`, t.name, notify, load)}>Delete</button></Row>))} />
      <div className="ad-grid g2" style={{ alignItems: "start" }}>
        <form className="ad-card ad-form" onSubmit={save} noValidate><h2>{editId ? "Edit topic" : "Add a topic"}</h2>
          <label>Subject</label><select className="ad-in" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Err e={er.subject_id} />
          <label>Topic name</label><input className="ad-in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Err e={er.name} />
          <label>Description</label><input className="ad-in" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /><Err e={er.description} />
          <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 22 }}><button className="ad-btn p">{editId ? "Save topic" : "Add topic"}</button>
            {editId && <button type="button" className="ad-btn o" onClick={() => { setEditId(null); setF({ ...f, name: "", description: "" }); }}>Cancel</button>}</div></form>
        <div className="ad-card ad-dark"><h2>Coverage matters</h2><p>A topic is useful when students can practise it and understand their mistakes. Review question variety and explanation quality before publishing.</p>
          <Bar label={`${subj ? sname(Number(subj)) : "All subjects"} coverage`} pct={covPct} /><small>Share of topics with a description · deleting a topic needs a linked-question review.</small></div>
      </div>
    </AdminShell>
  );
}

const EMPTY = { title: "", company_name: "", job_type: "INTERNSHIP", location: "", duration: "", pay: "", deadline: "", apply_link: "", description: "", branch_ids: [] };
const toForm = (j) => ({ ...EMPTY, ...Object.fromEntries(Object.entries(j).filter(([k]) => k in EMPTY && j[k] != null)), branch_ids: (j.branches || []).map((b) => b.id) });
const clean = (f) => { const b = { ...f }; ["location", "duration", "pay", "deadline", "apply_link"].forEach((k) => { if (!b[k]) b[k] = null; }); return b; };

function Opportunities2({ message, notify, internships }) {
  const [rows, setRows] = useState([]); const [companies, setCompanies] = useState([]); const [branches, setBranches] = useState([]);
  const [q, setQ] = useState(""); const [type, setType] = useState(""); const [status, setStatus] = useState(internships ? "" : "PENDING"); const [dur, setDur] = useState(""); const [loc, setLoc] = useState("");
  const [viewing, setViewing] = useState(null); const [f, setF] = useState({ ...EMPTY, job_type: internships ? "INTERNSHIP" : "INTERNSHIP" }); const [editId, setEditId] = useState(null); const [er, setEr] = useState({}); const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    all("/jobs/", { status: status || undefined, job_type: internships ? "INTERNSHIP" : type || undefined }).then(setRows).catch((e) => notify(parseError(e).message, "danger"));
    if (!internships) all("/companies/", { status: "PENDING" }).then(setCompanies).catch(() => {});
  }, [status, type, internships, notify]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { all("/branches/").then(setBranches); }, []);
  const review = async (base, o, a, label) => {
    let body;
    if (a === "reject") { const reason = window.prompt("Reason for rejecting (they will see this):"); if (!reason?.trim()) return; body = { reason: reason.trim() }; }
    try { await api.post(`${base}${o.id}/${a}/`, body); notify(`${label} ${a === "approve" ? "approved" : "rejected"}.`, "success"); load(); }
    catch (e) { notify(parseError(e).message, "danger"); }
  };
  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });
  const tog = (id) => setF({ ...f, branch_ids: f.branch_ids.includes(id) ? f.branch_ids.filter((b) => b !== id) : [...f.branch_ids, id] });
  const reset = () => { setEditId(null); setF({ ...EMPTY, job_type: internships ? "INTERNSHIP" : "INTERNSHIP" }); setEr({}); };
  const submit = async (e) => {
    e.preventDefault(); const x = {};
    ["title", "company_name"].forEach((k) => { if (!f[k].trim()) x[k] = "Required."; });
    if (!internships && !f.description.trim()) x.description = "Required.";
    if (f.apply_link && !/^https?:\/\/\S+$/.test(f.apply_link)) x.apply_link = "Start with http:// or https://";
    setEr(x); if (Object.keys(x).length) return;
    const body = clean(f); if (!body.description) body.description = `${f.title} at ${f.company_name}`;
    setBusy(true);
    try { editId ? await api.patch(`/jobs/${editId}/`, body) : await api.post("/jobs/", body); notify(editId ? "Listing updated." : "Posted. Students can see it now.", "success"); reset(); load(); }
    catch (err) { const p = parseError(err); setEr(p.fields || {}); notify(p.message, "danger"); } finally { setBusy(false); }
  };
  const startEdit = (j) => { setEditId(j.id); setF(toForm(j)); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); };
  const shown = rows.filter((j) => (j.title + j.company_name).toLowerCase().includes(q.toLowerCase()) && (!dur || j.duration === dur) && (!loc || j.location === loc));
  const uniq = (k) => [...new Set(rows.map((j) => j[k]).filter(Boolean))];
  const fld = (n, label, type = "text") => (<><label>{label}</label><input className="ad-in" name={n} type={type} value={f[n]} onChange={set} /><Err e={er[n]} /></>);
  const actions = (j) => (<>
    {j.status === "PENDING" && <button className="ad-btn c s" onClick={() => review("/jobs/", j, "approve", j.title)}>Approve</button>}
    {j.status === "PENDING" && <><button className="ad-link r" onClick={() => review("/jobs/", j, "reject", j.title)}>Reject</button>{SL}</>}
    {j.status === "APPROVED" && <><button className="ad-link" onClick={() => setViewing(j)}>Applicants ({j.applicant_count})</button>{SL}</>}
    <button className="ad-link" onClick={() => startEdit(j)}>Edit</button>{SL}<button className="ad-link r" onClick={() => remove(`/jobs/${j.id}/`, j.title, notify, load)}>Remove</button></>);
  if (viewing) return <AdminShell title="Applicants" crumb="Opportunities" subtitle={viewing.title} message={message}><Applicants job={viewing} onClose={() => setViewing(null)} /></AdminShell>;
  const tabs = <div className="ad-tabs">{[["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["", "All"]].map(([s, l]) => <button key={l} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{l}</button>)}</div>;
  const goTop = () => { reset(); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); };
  if (internships) return (
    <AdminShell title="Manage internships" crumb="Opportunities" subtitle="Keep learning opportunities specific, current and easy for students to understand." message={message}
      action={<button className="ad-btn p" onClick={goTop}>Add internship</button>}>
      <div className="ad-grid g3"><Stat label="Listed internships" value={rows.filter((j) => j.status === "APPROVED").length} note="Live for students" /><Stat label="Ready for review" value={rows.filter((j) => j.status === "PENDING").length} note="Source and requirement checks" /><Stat label="Locations" value={uniq("location").length} note="On-site, hybrid and remote" /></div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search internship or company" />
        <Select value={dur} onChange={setDur} options={[["", "All durations"], ...uniq("duration").map((d) => [d, d])]} /><Select value={loc} onChange={setLoc} options={[["", "All locations"], ...uniq("location").map((d) => [d, d])]} /></div>
      {tabs}
      <List head="Title / Company / Duration / Location / Actions" empty="No internships found." rows={shown.map((j) => (
        <Row key={j.id} title={<>{j.title}{j.status !== "APPROVED" && <span className={`ad-pill ${j.status === "PENDING" ? "warn" : "bad"}`}>{j.status[0] + j.status.slice(1).toLowerCase()}</span>}</>}
          meta={`Company: ${j.company_name} · Duration: ${j.duration || "-"} · Location: ${j.location || "-"}`}>{actions(j)}</Row>))} />
      <div className="ad-grid g2" style={{ alignItems: "start" }}>
        <form className="ad-card ad-form" onSubmit={submit} noValidate><h2>{editId ? "Edit internship details" : "Add internship details"}</h2>
          <div className="ad-grid g2" style={{ marginBottom: 0 }}><div>{fld("title", "Title")}</div><div>{fld("company_name", "Company")}</div><div>{fld("duration", "Duration")}</div><div>{fld("location", "Location")}</div></div>
          <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 22 }}><button className="ad-btn p" disabled={busy}>{editId ? "Save internship" : "Add internship"}</button>{editId && <button type="button" className="ad-btn o" onClick={reset}>Cancel</button>}</div></form>
        <div className="ad-card ad-dark"><h2>A useful listing answers real questions</h2><span className="ad-pill">EDITORIAL CHECKLIST</span>
          <p style={{ marginTop: 14 }}>What will the student learn? What skills are expected? How long is the internship? What is the location and stipend? Where is the verified application source?</p>
          <p style={{ fontSize: 14 }}>For full details such as stipend and apply link, use <Link to="/admin/opportunities" style={{ color: "#22d3ee" }}>Opportunities</Link>.</p></div>
      </div>
    </AdminShell>);
  return (
    <AdminShell title="Jobs & internships management" crumb="Opportunities" subtitle="Publish useful opportunities with clear sources, accurate details and a careful review." message={message}
      action={<Link className="ad-btn o" to="/admin/internships">Manage internships</Link>}>
      {companies.length > 0 && <div className="ad-card" style={{ marginBottom: 24 }}><h2>Company approvals <span className="ad-pill warn">{companies.length}</span></h2>
        {companies.map((c) => <Row key={c.id} title={c.company_name} meta={`${c.contact_person} · ${c.email} · ${c.phone}${c.location ? " · " + c.location : ""}`}>
          <button className="ad-btn c s" onClick={() => review("/companies/", c, "approve", c.company_name)}>Approve</button>
          <button className="ad-btn d s" onClick={() => review("/companies/", c, "reject", c.company_name)}>Reject</button></Row>)}</div>}
      <div className="ad-grid g2" style={{ alignItems: "start" }}>
        <div>
          <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search listing title or company" />
            <Select value={type} onChange={setType} options={[["", "All types"], ["JOB", "Job"], ["INTERNSHIP", "Internship"]]} /></div>
          {tabs}
          <div className="ad-card"><h2>Opportunity library</h2>
            <List head="Title / Company / Type / Actions" empty="No listings here." rows={shown.map((j) => (
              <Row key={j.id} title={<>{j.title}{j.status !== "APPROVED" && <span className={`ad-pill ${j.status === "PENDING" ? "warn" : "bad"}`}>{j.status[0] + j.status.slice(1).toLowerCase()}</span>}</>}
                meta={`Company: ${j.company_name} · Type: ${j.job_type === "JOB" ? "Job" : "Internship"}`}>{actions(j)}</Row>))} /></div>
          <div className="ad-card ad-dark" style={{ marginTop: 24 }}><h2>Listing preview</h2><span className="ad-pill">DRAFT · {editId ? "EDITING" : "NEW LISTING"}</span>
            <h2 style={{ marginTop: 14 }}>{f.title || "Listing title"}</h2><p>{[f.company_name, f.location, f.duration, f.pay].filter(Boolean).join(" · ") || "Company · Location · Duration"}<br />{f.description || "Summary appears here."}</p>
            <p style={{ fontSize: 14 }}>Verify the original source before publication.</p></div>
        </div>
        <form className="ad-card ad-form" onSubmit={submit} noValidate><h2>{editId ? "Edit opportunity" : "Add an opportunity"}</h2>
          {fld("title", "Listing title")}{fld("company_name", "Company")}
          <label>Type</label><select className="ad-in" name="job_type" value={f.job_type} onChange={set}><option value="INTERNSHIP">Internship</option><option value="JOB">Job</option></select>
          {fld("apply_link", "Apply link")}<div className="ad-hint">Use a verified original listing URL.</div>
          {fld("location", "Location")}{fld("duration", "Duration")}{fld("pay", "Salary / stipend")}{fld("deadline", "Last date to apply", "date")}
          <label>Summary</label><textarea className="ad-in" rows="4" name="description" value={f.description} onChange={set} /><Err e={er.description} />
          <label>Open to branches <span className="ad-hint">(none ticked = all branches)</span></label>
          <div className="ad-chk">{branches.map((b) => <label key={b.id}><input type="checkbox" checked={f.branch_ids.includes(b.id)} onChange={() => tog(b.id)} /> {b.code}</label>)}</div>
          <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 22 }}><button className="ad-btn p" disabled={busy}>{busy ? "Saving…" : editId ? "Save listing" : "Publish listing"}</button>{editId && <button type="button" className="ad-btn o" onClick={reset}>Cancel</button>}</div>
          <p className="ad-hint" style={{ marginTop: 14 }}>Admin listings go live immediately.</p></form>
      </div>
      <Report />
    </AdminShell>
  );
}
export const Opportunities = (p) => <Opportunities2 {...p} />;
export const Internships = (p) => <Opportunities2 {...p} internships />;

function Report() {
  const [type, setType] = useState("INTERNSHIP"); const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/jobs/applications-summary/", { params: { job_type: type } }).then((r) => setRows(r.data)).catch(() => {}); }, [type]);
  return (
    <div className="ad-card" style={{ marginTop: 24 }}><h2>Applications by course</h2>
      <div className="ad-tabs">{[["INTERNSHIP", "Internships"], ["JOB", "Jobs"]].map(([k, l]) => <button key={k} className={type === k ? "on" : ""} onClick={() => setType(k)}>{l}</button>)}</div>
      <List head="Listing / Applied / By branch" empty="No approved postings yet." rows={rows.map((r) => (
        <Row key={r.job_id} title={r.title} meta={r.company_name}><div className="ad-sub"><span>{r.total} applied</span>{r.by_branch.map((b) => <span key={b.branch_id}>{b.branch_name}: {b.count}</span>)}</div></Row>))} /></div>
  );
}

export function Soon({ title, crumb, subtitle, stats, filters, head, note, noteBody, message }) {
  return (
    <AdminShell title={title} crumb={crumb} subtitle={subtitle} message={message}>
      <div className="ad-grid g3">{stats.map((s) => <Stat key={s} label={s} value="—" note="Available once this module is built" />)}</div>
      <div className="ad-filters"><Search value="" onChange={() => {}} placeholder={filters} /></div>
      <List head={head} rows={[]} empty="Nothing here yet. This module arrives in a later phase of the project." />
      <div className="ad-card ad-dark"><h2>{note}</h2><p>{noteBody}</p></div>
    </AdminShell>
  );
}
