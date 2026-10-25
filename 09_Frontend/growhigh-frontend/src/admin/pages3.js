import { useCallback, useEffect, useState } from "react";
import api, { parseError } from "../api/client";
import { AdminShell, Err, List, Row, Search, Select, Stat, all } from "./ui";

const L = ["A", "B", "C", "D"];
const SL = <span className="ad-sl">/</span>;
const TYPES = { DAILY: "Daily", WEEKLY: "Weekly", CUMULATIVE: "Cumulative", MOCK: "Mock" };
const STATUS = { UPCOMING: ["Upcoming", "warn"], ACTIVE: ["Running", "ok"], ENDED: ["Ended", ""] };

export function QuestionBank({ message, notify }) {
  const [rows, setRows] = useState([]);
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState("");
  const [sub, setSub] = useState("");
  const [open, setOpen] = useState(null);
  useEffect(() => { all("/subjects/").then(setSubs).catch(() => {}); }, []);
  const load = useCallback(() => { all("/questions/", { search: q || undefined, subject: sub || undefined }).then(setRows).catch((e) => notify(parseError(e).message, "danger")); }, [q, sub, notify]);
  useEffect(() => { load(); }, [load]);
  const hide = async (x) => { try { await api.patch(`/questions/${x.id}/`, { is_active: !x.is_active }); load(); } catch (e) { notify(parseError(e).message, "danger"); } };
  const del = async (x) => {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    try { await api.delete(`/questions/${x.id}/`); notify("Question deleted.", "success"); load(); } catch (e) { notify(parseError(e).message, "danger"); }
  };
  return (
    <AdminShell title="Question bank oversight" crumb="Question bank" subtitle="Maintain clarity, provenance and quality across faculty-authored questions." message={message}>
      <div className="ad-grid g3">
        <Stat label="Questions" value={rows.length} note="Matching your search" />
        <Stat label="Contributors" value={new Set(rows.map((r) => r.created_by_name)).size} note="People who added questions" />
        <Stat label="Hidden" value={rows.filter((r) => !r.is_active).length} note="Not available for new tests" />
      </div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search question text or topic" /><Select value={sub} onChange={setSub} options={[["", "All subjects"], ...subs.map((s) => [String(s.id), s.name])]} /></div>
      <List head="Question / Subject / Added by / Actions" empty="No questions yet. Faculty add them from their workspace." rows={rows.map((x) => (
        <div key={x.id}>
          <Row title={<span style={{ cursor: "pointer" }} onClick={() => setOpen(open === x.id ? null : x.id)}>{x.text}{!x.is_active && <span className="ad-pill bad">Hidden</span>}</span>} meta={`${x.subject_name} · ${x.topic_name} · ${x.created_by_name || "Unknown"}`}>
            <button className="ad-link" onClick={() => setOpen(open === x.id ? null : x.id)}>{open === x.id ? "Close" : "View"}</button>{SL}
            <button className="ad-link" onClick={() => hide(x)}>{x.is_active ? "Hide" : "Show"}</button>{SL}
            <button className="ad-link r" onClick={() => del(x)}>Delete</button></Row>
          {open === x.id && <div style={{ padding: "0 4px 18px" }}>{x.options.map((o, i) => <div key={i} style={{ padding: "4px 0", fontWeight: i === x.correct ? 700 : 400, color: i === x.correct ? "#14703d" : "inherit" }}>{L[i]}. {o}{i === x.correct ? " ✓" : ""}</div>)}
            {x.explanation && <p style={{ color: "#6b7a90" }}>{x.explanation}</p>}</div>}
        </div>))} />
      <div className="ad-card" style={{ marginTop: 24 }}><h2>Quality over quantity</h2><p style={{ color: "#6b7a90" }}>Review one correct answer, plausible distractors, clear topic mapping and a useful explanation. A question used in a test cannot be deleted: hide it instead.</p></div>
    </AdminShell>
  );
}

export function AdminTests({ message, notify }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const load = useCallback(() => { all("/tests/", { search: q || undefined, test_type: type || undefined }).then(setRows).catch((e) => notify(parseError(e).message, "danger")); }, [q, type, notify]);
  useEffect(() => { load(); }, [load]);
  const del = async (t) => {
    if (!window.confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    try { await api.delete(`/tests/${t.id}/`); notify("Test deleted.", "success"); load(); } catch (e) { notify(parseError(e).message, "danger"); }
  };
  const count = (s) => rows.filter((r) => r.status === s).length;
  return (
    <AdminShell title="Test management" crumb="Tests" subtitle="See assessment coverage, schedules and completion across the platform." message={message}>
      <div className="ad-grid g3">
        <Stat label="Scheduled" value={count("UPCOMING")} note="Not started yet" />
        <Stat label="Active" value={count("ACTIVE")} note="Running now" />
        <Stat label="Completed" value={count("ENDED")} note="Finished" />
      </div>
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search assessment name" /><Select value={type} onChange={setType} options={[["", "All types"], ...Object.entries(TYPES)]} /></div>
      <List head="Test / Type / Date / Branch / Year / Status / Action" empty="No tests yet. Faculty create them from their workspace." rows={rows.map((t) => (
        <Row key={t.id} title={<>{t.name}<span className={`ad-pill ${STATUS[t.status][1]}`}>{STATUS[t.status][0]}</span></>}
          meta={`${TYPES[t.test_type]} · ${t.scheduled_date} ${t.start_time.slice(0, 5)} · ${t.branch_code || "All branches"} · ${t.year_of_study ? `Year ${t.year_of_study}` : "All years"} · ${t.question_count} questions · ${t.assigned_count} students · by ${t.created_by_name || "—"}`}>
          <button className="ad-link r" onClick={() => del(t)}>Delete</button></Row>))} />
      <div className="ad-card" style={{ marginTop: 24 }}><h2>Consistent rules, clearer expectations</h2><p style={{ color: "#6b7a90" }}>Assigned tests allow one attempt. AP ECET mocks use 200 questions, 200 marks, 3 hours and no negative marking.</p></div>
    </AdminShell>
  );
}

export function AdminPapers({ message, notify }) {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [f, setF] = useState(null);
  const [er, setEr] = useState({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { all("/papers/").then(setRows).catch((e) => notify(parseError(e).message, "danger")); }, [notify]);
  useEffect(() => { load(); all("/branches/").then(setBranches).catch(() => {}); }, [load]);
  const save = async (e) => {
    e.preventDefault(); setEr({}); setBusy(true);
    const fd = new FormData();
    fd.append("year", f.year); fd.append("title", f.title);
    if (f.branch_id) fd.append("branch_id", f.branch_id);
    if (f.file) fd.append("file", f.file);
    try { await api.post("/papers/", fd); notify("Paper added.", "success"); setF(null); load(); }
    catch (x) { const p2 = parseError(x); setEr(p2.fields || {}); notify(p2.message, "danger"); }
    setBusy(false);
  };
  const toggle = async (r) => { try { await api.patch(`/papers/${r.id}/`, { is_active: !r.is_active }); load(); } catch (x) { notify(parseError(x).message, "danger"); } };
  const del = async (r) => {
    if (!window.confirm(`Delete ${r.title}? Students who saved it will lose it.`)) return;
    try { await api.delete(`/papers/${r.id}/`); notify("Paper deleted.", "success"); load(); } catch (x) { notify(parseError(x).message, "danger"); }
  };
  return (
    <AdminShell title="Previous papers" crumb="Previous papers" subtitle="Upload earlier AP ECET papers as PDFs for students to open and save." message={message}>
      <div className="ad-grid g3">
        <Stat label="Papers" value={rows.length} note="Uploaded so far" />
        <Stat label="Visible" value={rows.filter((r) => r.is_active).length} note="Shown to students" />
        <Stat label="Hidden" value={rows.filter((r) => !r.is_active).length} note="Not shown" />
      </div>
      <List head="Paper / Branch / Action" empty="No papers yet. Add the first one." rows={rows.map((r) => (
        <Row key={r.id} title={<>{r.title}{!r.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={`${r.year} · ${r.branch_code || "All branches"}`}>
          <a className="ad-link" href={r.file_url} target="_blank" rel="noreferrer">Open</a>{SL}<button className="ad-link" onClick={() => toggle(r)}>{r.is_active ? "Hide" : "Show"}</button>{SL}<button className="ad-link r" onClick={() => del(r)}>Delete</button></Row>))} />
      <div className="ad-card" style={{ marginTop: 24 }}><h2>Add a paper</h2>
        {f ? (
          <form onSubmit={save} className="ad-form">
            <label>Year</label><input className="ad-in" type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /><Err e={er.year} />
            <label>Title</label><input className="ad-in" placeholder="AP ECET 2023 · Computer Science" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Err e={er.title} />
            <label>Branch</label><select className="ad-in" value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value })}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
            <label>PDF file (up to 25 MB)</label><input className="ad-in" type="file" accept="application/pdf,.pdf" onChange={(e) => setF({ ...f, file: e.target.files[0] })} /><Err e={er.file} />
            <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 14 }}><button className="ad-btn p" disabled={busy}>{busy ? "Uploading…" : "Save"}</button><button type="button" className="ad-btn o" onClick={() => setF(null)}>Cancel</button></div>
          </form>
        ) : <button className="ad-btn o" onClick={() => setF({ year: "", title: "", branch_id: "", file: null })}>Add paper</button>}
      </div>
    </AdminShell>
  );
}

const AREAS = {
  JOB_PREP: ["Job preparation", [["aptitude", "Aptitude"], ["reasoning", "Reasoning"], ["coding", "Coding"], ["technical", "Technical interview"], ["hr", "HR interview"], ["projects", "Projects"]]],
  CAREER: ["Career growth", [["technologies", "Technologies"], ["paths", "Career paths"], ["roadmap", "Roadmap (one lesson per stage, in order)"], ["projects", "Projects"]]],
  COMM: ["Communication", [["spoken", "Spoken English"], ["vocabulary", "Vocabulary"], ["grammar", "Grammar"], ["speaking", "Speaking"], ["listening", "Listening"], ["gd", "Group discussion"], ["presentation", "Presentation"], ["interview", "Interview"], ["professional", "Professional"]]],
};
const GKIND = [["NOTES", "Written notes"], ["VIDEO", "Video"], ["PDF", "PDF"], ["LINK", "Web link"]];

export function AdminContent({ message, notify }) {
  const [area, setArea] = useState("JOB_PREP");
  const [sec, setSec] = useState("aptitude");
  const [rows, setRows] = useState([]);
  const [all2, setAll2] = useState([]);
  const [f, setF] = useState(null);
  const [er, setEr] = useState({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    all("/guides/", { area, section: sec }).then(setRows).catch((e) => notify(parseError(e).message, "danger"));
    all("/guides/").then(setAll2).catch(() => {});
  }, [area, sec, notify]);
  useEffect(() => { load(); }, [load]);
  const pickArea = (a) => { setArea(a); setSec(AREAS[a][1][0][0]); setF(null); };
  const save = async (e) => {
    e.preventDefault(); setEr({}); setBusy(true);
    const fd = new FormData();
    fd.append("area", area); fd.append("section", sec); fd.append("group", f.group); fd.append("kind", f.kind); fd.append("title", f.title);
    fd.append("body", f.kind === "NOTES" ? f.body : ""); fd.append("url", f.kind === "NOTES" ? "" : f.url); fd.append("order_no", f.order_no || 0);
    if (f.file) fd.append("file", f.file);
    try { f.id ? await api.patch(`/guides/${f.id}/`, fd) : await api.post("/guides/", fd); notify("Lesson saved.", "success"); setF(null); load(); }
    catch (x) { const p2 = parseError(x); setEr(p2.fields || {}); notify(p2.message, "danger"); }
    setBusy(false);
  };
  const toggle = async (g) => { try { await api.patch(`/guides/${g.id}/`, { is_active: !g.is_active }); load(); } catch (x) { notify(parseError(x).message, "danger"); } };
  const del = async (g) => {
    if (!window.confirm(`Delete ${g.title}? Students' progress on it is removed too.`)) return;
    try { await api.delete(`/guides/${g.id}/`); notify("Lesson deleted.", "success"); load(); } catch (x) { notify(parseError(x).message, "danger"); }
  };
  const count = (a) => all2.filter((g) => g.area === a).length;
  return (
    <AdminShell title="Content & settings" crumb="Content & settings" subtitle="Write the lessons students see in Job preparation, Career growth and Communication." message={message}>
      <div className="ad-grid g3">{Object.entries(AREAS).map(([k, [l]]) => <Stat key={k} label={l} value={count(k)} note="Lessons added" />)}</div>
      <div className="ad-filters">
        <Select value={area} onChange={pickArea} options={Object.entries(AREAS).map(([k, [l]]) => [k, l])} />
        <Select value={sec} onChange={(v) => { setSec(v); setF(null); }} options={AREAS[area][1]} />
      </div>
      <List head="Lesson / Type / Action" empty="No lessons in this section yet." rows={rows.map((g) => (
        <Row key={g.id} title={<>{g.title}{!g.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={`${GKIND.find((k) => k[0] === g.kind)?.[1]}${g.group ? ` · ${g.group}` : ""} · order ${g.order_no}`}>
          <button className="ad-link" onClick={() => setF({ id: g.id, group: g.group, kind: g.kind, title: g.title, body: g.body, url: g.url, order_no: g.order_no, file: null })}>Edit</button>{SL}
          <button className="ad-link" onClick={() => toggle(g)}>{g.is_active ? "Hide" : "Show"}</button>{SL}<button className="ad-link r" onClick={() => del(g)}>Delete</button></Row>))} />
      <div className="ad-card" style={{ marginTop: 24 }}><h2>{f?.id ? "Edit lesson" : "Add a lesson"}</h2>
        {f ? (
          <form onSubmit={save} className="ad-form">
            <label>Type</label><select className="ad-in" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{GKIND.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <label>Title</label><input className="ad-in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Err e={er.title} />
            <label>Heading inside the section (optional)</label><input className="ad-in" placeholder="e.g. Quantitative" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} />
            {f.kind === "NOTES" ? <><label>Notes</label><textarea className="ad-in" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><Err e={er.body} /></>
              : <><label>Link</label><input className="ad-in" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /><Err e={er.url} />
                {(f.kind === "VIDEO" || f.kind === "PDF") && <><label>Or upload a file ({f.kind === "VIDEO" ? "MP4, WebM or MOV, up to 300 MB" : "PDF, up to 25 MB"})</label><input className="ad-in" type="file" accept={f.kind === "VIDEO" ? "video/*" : "application/pdf"} onChange={(e) => setF({ ...f, file: e.target.files[0] })} /><Err e={er.file} /></>}</>}
            <label>Order (smaller shows first)</label><input className="ad-in" type="number" value={f.order_no} onChange={(e) => setF({ ...f, order_no: e.target.value })} />
            <div className="ad-act" style={{ justifyContent: "flex-start", marginTop: 14 }}><button className="ad-btn p" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="ad-btn o" onClick={() => setF(null)}>Cancel</button></div>
          </form>
        ) : <button className="ad-btn o" onClick={() => setF({ group: "", kind: "NOTES", title: "", body: "", url: "", order_no: rows.length, file: null })}>Add lesson to {AREAS[area][1].find((x) => x[0] === sec)?.[1]}</button>}
      </div>
    </AdminShell>
  );
}
