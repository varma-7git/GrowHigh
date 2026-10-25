import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Panel, Stats } from "../kit";
import { Err, List, Row, Search, Select, all } from "../../admin/ui";
import { DAYS } from "../data";
import api, { parseError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const W = (p) => <WsShell role="faculty" {...p} />;
const L = ["A", "B", "C", "D"];
const errText = (e) => { const x = parseError(e); return Object.values(x.fields || {}).join(" ") || x.message; };
const when = (t) => `${new Date(`${t.scheduled_date}T00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${t.start_time.slice(0, 5)}`;
const STATUS = { UPCOMING: ["Upcoming", "warn"], ACTIVE: ["Running", "ok"], ENDED: ["Ended", ""] };
export const Status = ({ s }) => <span className={`ad-pill ${STATUS[s][1]}`}>{STATUS[s][0]}</span>;

export function Dashboard() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [sum, setSum] = useState(null);
  useEffect(() => { all("/tests/").then(setTests).catch(() => {}); api.get("/performance/summary/").then((r) => setSum(r.data)).catch(() => {}); }, []);
  const students = new Set(tests.flatMap((t) => t.assigned_ids)).size;
  const pc = (v) => (v == null ? "—" : `${v}%`);
  const trend = sum?.trend || [];
  const weak = (sum?.weak_topics || []).slice(0, 3);
  return (
    <W crumb="Dashboard" title={`Good morning, ${user.full_name.split(" ")[0]}`} subtitle="Create tests, assign practice and follow your students." action={<Btn b={["Create a test", "/faculty/schedule"]} kind="c" />}>
      <Stats items={[["Tests created", String(tests.length), "Scheduled by you"], ["Students assigned", String(students), "Across your tests"], ["Average score", pc(sum?.average), sum?.attempts ? `From ${sum.attempts} submitted attempts` : "After students take tests"], ["Pass rate", pc(sum?.pass_rate), "Students at 40% or above"]]} />
      <div className="ad-grid g2">
        <div className="ad-card"><h2>Class trend</h2>
          {trend.length ? <div className="ad-chart">{trend.map((t, i) => <div key={i}><i style={{ height: `${t.average}%` }} title={`${t.test}: ${t.average}%`} />{t.average}%</div>)}</div>
            : <div className="ad-chart">{DAYS.map((d, i) => <div key={i}><i style={{ height: "0%" }} />{d}</div>)}</div>}
          <p className="ws-foot">{trend.length ? "Average score of your last tests, oldest first." : "The trend appears once students take your tests."}</p></div>
        <Panel h="Recent tests" p={tests.length ? "" : "No tests yet. Create your first test."} list={tests.slice(0, 3).map((t) => [when(t), t.name, `${t.branch_code || "All branches"} · ${t.year_of_study ? `Year ${t.year_of_study}` : "All years"} · ${t.question_count} questions`])} />
      </div>
      <div className="ad-grid g2">
        <Panel h="Class insights" p={weak.length ? "" : "Weak topics across your tests will appear here."} bars={weak.map((w) => [w.name, w.percent])} foot={weak.length ? "Lowest scoring topics across your tests." : ""} />
        <Panel dark eyebrow="Next step" h="Assign a test" p="Choose a test and the students who should take it." btn={["Assign test", "/faculty/assign"]} />
      </div>
    </W>
  );
}

export function Questions() {
  const [rows, setRows] = useState([]);
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState("");
  const [sub, setSub] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { all("/subjects/").then(setSubs).catch(() => {}); }, []);
  const load = useCallback(() => { all("/questions/", { search: q || undefined, subject: sub || undefined }).then(setRows).catch((e) => setErr(errText(e))); }, [q, sub]);
  useEffect(() => { load(); }, [load]);
  const del = async (x) => {
    if (!window.confirm("Delete this question?")) return;
    setErr("");
    try { await api.delete(`/questions/${x.id}/`); load(); } catch (e) { setErr(errText(e)); }
  };
  const hide = async (x) => { try { await api.patch(`/questions/${x.id}/`, { is_active: !x.is_active }); load(); } catch (e) { setErr(errText(e)); } };
  return (
    <W crumb="Question bank" title="Question bank" subtitle={`${rows.length} questions`} action={<Btn b={["Add question", "/faculty/questions/new"]} kind="c" />}>
      <Err e={err} />
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search questions" /><Select value={sub} onChange={setSub} options={[["", "All subjects"], ...subs.map((s) => [String(s.id), s.name])]} /></div>
      <List head={<><span>Question</span><span>Actions</span></>} empty="No questions yet. Add the first one." rows={rows.map((x) => (
        <Row key={x.id} title={<>{x.text}{!x.is_active && <span className="ad-pill bad">Hidden</span>}</>} meta={`${x.subject_name} · ${x.topic_name} · Answer ${L[x.correct]} · ${x.mine ? "Added by you" : x.created_by_name || ""}`}>
          {x.mine && <><Link className="ad-btn o s" to={`/faculty/questions/${x.id}`}>Edit</Link><button className="ad-btn o s" onClick={() => hide(x)}>{x.is_active ? "Hide" : "Show"}</button><button className="ad-btn d s" onClick={() => del(x)}>Delete</button></>}
        </Row>))} />
    </W>
  );
}

export function QuestionForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [subs, setSubs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [f, setF] = useState({ subject: "", topic_id: "", text: "", options: ["", "", "", ""], correct: 0, explanation: "" });
  const [er, setEr] = useState({});
  const [err, setErr] = useState("");
  const set = (k, v) => setF((c) => ({ ...c, [k]: v }));
  useEffect(() => {
    all("/subjects/").then((s) => { setSubs(s); if (!id && s[0]) setF((c) => ({ ...c, subject: String(s[0].id) })); }).catch(() => {});
    if (id) api.get(`/questions/${id}/`).then((r) => setF({ subject: String(r.data.subject_id), topic_id: String(r.data.topic_id), text: r.data.text, options: r.data.options, correct: r.data.correct, explanation: r.data.explanation })).catch((e) => setErr(errText(e)));
  }, [id]);
  useEffect(() => {
    if (!f.subject) return;
    all("/topics/", { subject: f.subject }).then((t) => { setTopics(t); setF((c) => (t.some((x) => String(x.id) === c.topic_id) ? c : { ...c, topic_id: t[0] ? String(t[0].id) : "" })); }).catch(() => {});
  }, [f.subject]);
  const opt = (i, v) => set("options", f.options.map((o, k) => (k === i ? v : o)));
  const save = async () => {
    setErr(""); setEr({});
    const body = { topic_id: Number(f.topic_id) || null, text: f.text, options: f.options, correct: f.correct, explanation: f.explanation };
    try { await (id ? api.patch(`/questions/${id}/`, body) : api.post("/questions/", body)); nav("/faculty/questions"); }
    catch (e) { const p = parseError(e); setEr(p.fields || {}); setErr(p.message); }
  };
  return (
    <W crumb="Question bank / Question" title={id ? "Edit question" : "Add question"} subtitle="One correct answer, with an explanation students will see after the test.">
      <div className="ws-split">
        <div className="ad-card ws-form"><Err e={err} />
          <div className="ws-two"><div><label>Subject</label><Select value={f.subject} onChange={(v) => set("subject", v)} options={subs.length ? subs.map((s) => [String(s.id), s.name]) : [["", "No subjects yet"]]} /></div>
            <div><label>Topic</label><Select value={f.topic_id} onChange={(v) => set("topic_id", v)} options={topics.length ? topics.map((t) => [String(t.id), t.name]) : [["", "No topics yet"]]} /><Err e={er.topic_id} /></div></div>
          <label>Question</label><textarea className="ad-in" rows={3} value={f.text} onChange={(e) => set("text", e.target.value)} /><Err e={er.text} />
          {f.options.map((o, i) => <div key={i}><label>Option {L[i]}</label><input className="ad-in" value={o} onChange={(e) => opt(i, e.target.value)} /></div>)}<Err e={er.options} />
          <label>Correct answer</label><Select value={String(f.correct)} onChange={(v) => set("correct", Number(v))} options={L.map((l, i) => [String(i), `Option ${l}`])} /><Err e={er.correct} />
          <label>Explanation</label><textarea className="ad-in" rows={3} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} />
          <div className="ws-btns"><Btn b={["Save question", null, save]} kind="c" /><Btn b={["Cancel", "/faculty/questions"]} /></div>
        </div>
        <div className="ad-card"><div className="ad-eyebrow">Student preview</div><div className="ws-qt" style={{ fontSize: 20 }}>{f.text || "Your question appears here."}</div>
          {f.options.map((o, i) => <div key={i} className={`ws-opt ${i === f.correct ? "ok" : ""}`} style={{ cursor: "default" }}><i>{L[i]}</i>{o || `Option ${L[i]}`}</div>)}</div>
      </div>
    </W>
  );
}

export function Schedule() {
  const nav = useNavigate();
  const [branches, setBranches] = useState([]);
  const [subs, setSubs] = useState([]);
  const [subF, setSubF] = useState("");
  const [qs, setQs] = useState([]);
  const [sel, setSel] = useState([]);
  const [f, setF] = useState({ name: "", test_type: "DAILY", scheduled_date: "", start_time: "09:00", duration_minutes: 30, branch_id: "", year_of_study: "" });
  const [er, setEr] = useState({});
  const [err, setErr] = useState("");
  const set = (k) => (v) => setF((c) => ({ ...c, [k]: v }));
  useEffect(() => { all("/branches/").then(setBranches).catch(() => {}); all("/subjects/").then(setSubs).catch(() => {}); }, []);
  useEffect(() => { all("/questions/", { subject: subF || undefined, is_active: "true" }).then(setQs).catch(() => {}); }, [subF]);
  const tog = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const go = async () => {
    setErr(""); setEr({});
    try {
      const { data } = await api.post("/tests/", { ...f, duration_minutes: Number(f.duration_minutes), branch_id: f.branch_id ? Number(f.branch_id) : null, year_of_study: f.year_of_study ? Number(f.year_of_study) : null, question_ids: sel });
      nav(`/faculty/assign?test=${data.id}`);
    } catch (e) { const p = parseError(e); setEr(p.fields || {}); setErr(p.message); }
  };
  const In = ({ l, k, type = "text" }) => <><label>{l}</label><input className="ad-in" type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} /><Err e={er[k]} /></>;
  return (
    <W crumb="Create & schedule" title="Create & schedule" subtitle="Pick questions and set when the test runs.">
      <div className="ws-split">
        <div className="ad-card ws-form"><Err e={err} />
          <In l="Test name" k="name" />
          <div className="ws-two"><div><label>Type</label><Select value={f.test_type} onChange={set("test_type")} options={[["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["CUMULATIVE", "Cumulative"], ["MOCK", "Mock"]]} /></div><div><In l="Date" k="scheduled_date" type="date" /></div></div>
          <div className="ws-two"><div><In l="Start time" k="start_time" type="time" /></div><div><In l="Duration (minutes)" k="duration_minutes" type="number" /></div></div>
          <div className="ws-two"><div><label>Branch</label><Select value={f.branch_id} onChange={set("branch_id")} options={[["", "All branches"], ...branches.map((b) => [String(b.id), b.code])]} /></div><div><label>Year</label><Select value={f.year_of_study} onChange={set("year_of_study")} options={[["", "All years"], ["1", "1st year"], ["2", "2nd year"], ["3", "3rd year"]]} /></div></div>
          <h2 style={{ marginTop: 26 }}>Select questions</h2>
          <Select value={subF} onChange={setSubF} options={[["", "All subjects"], ...subs.map((s) => [String(s.id), s.name])]} /><Err e={er.question_ids} />
          <div className="ws-ck hd"><span>Question</span><span>Subject</span></div>
          {qs.map((x) => <label className="ws-ck" key={x.id}><input type="checkbox" checked={sel.includes(x.id)} onChange={() => tog(x.id)} /><span>{x.text}</span><em>{x.subject_name}</em></label>)}
          {qs.length === 0 && <div className="ad-empty">No questions yet. <Link to="/faculty/questions/new">Add questions</Link> first.</div>}
        </div>
        <Panel dark eyebrow="Summary" h={f.name || "New test"} p={`${sel.length} questions · ${f.duration_minutes || 0} min · ${branches.find((b) => String(b.id) === f.branch_id)?.code || "All branches"} · ${f.year_of_study ? `Year ${f.year_of_study}` : "All years"}`} btn={["Schedule test", null, go]} />
      </div>
    </W>
  );
}

export function Assign() {
  const [params] = useSearchParams();
  const [tests, setTests] = useState([]);
  const [tid, setTid] = useState(params.get("test") || "");
  const [roster, setRoster] = useState([]);
  const [sel, setSel] = useState([]);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { all("/tests/").then((t) => { setTests(t); setTid((c) => c || (t[0] ? String(t[0].id) : "")); }).catch(() => {}); }, []);
  const test = tests.find((t) => String(t.id) === tid);
  useEffect(() => {
    if (!test) { setRoster([]); return; }
    setSel(test.assigned_ids);
    all("/roster/", { branch: test.branch_id || undefined, year_of_study: test.year_of_study || undefined }).then(setRoster).catch(() => {});
  }, [test]);
  const all_ = roster.length > 0 && roster.every((s) => sel.includes(s.id));
  const tog = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const go = async () => {
    setErr(""); setOk("");
    try {
      await api.post(`/tests/${tid}/assign/`, { student_ids: sel });
      setOk(`Assigned to ${sel.length} students.`);
      all("/tests/").then(setTests).catch(() => {});
    } catch (e) { setErr(errText(e)); }
  };
  return (
    <W crumb="Assign tests" title="Assign tests" subtitle="Choose a test and the students who should take it.">
      <div className="ws-split">
        <div className="ad-card ws-form">{ok && <div className="ad-alert">{ok}</div>}<Err e={err} />
          <label>Test</label><Select value={tid} onChange={setTid} options={tests.length ? tests.map((x) => [String(x.id), `${x.name} · ${when(x)}`]) : [["", "No tests yet"]]} />
          {test && <div className="ad-hint">{test.branch_code || "All branches"} · {test.year_of_study ? `Year ${test.year_of_study}` : "All years"} · {test.question_count} questions · {test.duration_minutes} min</div>}
          <div className="ws-ck hd"><input type="checkbox" checked={all_} onChange={() => setSel(all_ ? [] : roster.map((s) => s.id))} /><span>Select all students</span></div>
          {roster.length === 0 && <div className="ad-empty">{test ? "No registered students match this branch and year yet." : "Create a test first."}</div>}
          {roster.map((s) => <label className="ws-ck" key={s.id}><input type="checkbox" checked={sel.includes(s.id)} onChange={() => tog(s.id)} /><span>{s.full_name}<br /><small style={{ color: "var(--mu)" }}>{s.login_id}</small></span></label>)}
        </div>
        <Panel dark eyebrow="Summary" h={`${sel.length} students selected`} p="Students see the test on their dashboard." btn={["Assign test", null, go]} />
      </div>
    </W>
  );
}

export function Students() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [perf, setPerf] = useState({});
  const [branches, setBranches] = useState([]);
  const [br, setBr] = useState("");
  const [yr, setYr] = useState("");
  useEffect(() => { all("/branches/").then(setBranches).catch(() => {}); api.get("/performance/students/").then((r) => setPerf(r.data)).catch(() => {}); }, []);
  useEffect(() => { all("/roster/", { search: q || undefined, branch: br || undefined, year_of_study: yr || undefined }).then(setRows).catch(() => {}); }, [q, br, yr]);
  return (
    <W crumb="Students" title="Students" subtitle="Registered students you can assign tests to, with their results on your tests.">
      <div className="ad-filters"><Search value={q} onChange={setQ} placeholder="Search by name or roll number" />
        <Select value={br} onChange={setBr} options={[["", "All branches"], ...branches.map((b) => [String(b.id), b.code])]} />
        <Select value={yr} onChange={setYr} options={[["", "All years"], ["1", "1st year"], ["2", "2nd year"], ["3", "3rd year"]]} /></div>
      <List head={<><span>Student</span><span>Results</span></>} empty="No students match." rows={rows.map((s) => {
        const p = perf[String(s.id)];
        return (
          <Row key={s.id} title={s.full_name} meta={`${s.login_id} · ${s.branch_code} · Year ${s.year_of_study}${s.regulation ? ` · ${s.regulation}` : ""}`}>
            {p ? <><span className="ad-hint">{p.tests_taken} test{p.tests_taken === 1 ? "" : "s"} · avg {p.average}%</span><span className={`ad-pill ${p.needs_help ? "bad" : "ok"}`}>{p.needs_help ? "Needs help" : "On track"}</span></> : <span className="ad-hint">No tests taken</span>}
          </Row>
        );
      })} />
    </W>
  );
}

export function Performance() {
  const [sum, setSum] = useState(null);
  const [pick, setPick] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/performance/summary/").then((r) => setSum(r.data)).catch((e) => setErr(errText(e))); }, []);
  useEffect(() => { if (!pick) { setRes(null); return; } api.get(`/performance/tests/${pick}/`).then((r) => setRes(r.data)).catch((e) => setErr(errText(e))); }, [pick]);
  const pc = (v) => (v == null ? "—" : `${v}%`);
  const STAT = { SUBMITTED: "Submitted", IN_PROGRESS: "In progress", NOT_ATTEMPTED: "Not attempted" };
  return (
    <W crumb="Performance" title="Performance" subtitle="Weak topics and results for your class.">
      <Err e={err} />
      <Stats items={[["Submitted attempts", String(sum?.attempts ?? 0), "Across your tests"], ["Class average", pc(sum?.average), "Mean of all scores"], ["Pass rate", pc(sum?.pass_rate), "Students at 40% or above"]]} />
      <div className="ad-grid g2">
        <Panel h="Class weak topics" p={sum?.weak_topics?.length ? "" : "Appears once students take your tests."} bars={(sum?.weak_topics || []).map((w) => [w.name, w.percent])} foot={sum?.weak_topics?.length ? "Lowest scoring topics first." : ""} />
        <Panel h="Your tests" p={sum?.recent?.length ? "" : "No tests yet."} list={(sum?.recent || []).slice(0, 5).map((t) => [when({ scheduled_date: t.date, start_time: "00:00:00" }).split(" · ")[0], t.name, `${t.attempts}/${t.assigned} submitted · average ${pc(t.average)}`])} />
      </div>
      <div className="ad-card"><h2>Results by test</h2>
        <div className="ad-filters"><Select value={pick} onChange={setPick} options={[["", "Choose a test"], ...(sum?.recent || []).map((t) => [String(t.id), t.name])]} /></div>
        {res && <List head={<><span>Student</span><span>Score</span></>} empty="No students are assigned to this test." rows={res.results.map((r) => (
          <Row key={r.student_id} title={r.student_name} meta={r.login_id}>
            <span className="ad-hint">{r.status === "SUBMITTED" ? `${r.score}/${r.total} · ${r.percent}%` : STAT[r.status]}</span>
            {r.status === "SUBMITTED" && <span className={`ad-pill ${r.passed ? "ok" : "bad"}`}>{r.passed ? "Pass" : "Needs help"}</span>}
          </Row>
        ))} />}
        {!res && <p className="ws-foot">Pick a test to see every assigned student's result.</p>}
      </div>
    </W>
  );
}
