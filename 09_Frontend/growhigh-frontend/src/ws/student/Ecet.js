import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Hero, Page, Panel, Stats, Tabs, Tiles } from "../kit";
import { BRANCH_PAPERS, TESTS } from "../data";
import { List, Row, Search, all } from "../../admin/ui";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export const ECET_TABS = [["Overview", "/student/ecet"], ["Curriculum", "/student/ecet/curriculum"], ["Explore subjects", "/student/ecet/explore"], ["Previous papers", "/student/ecet/papers"], ["Tests", "/student/ecet/tests/daily"], ["Results", "/student/ecet/results"]];
const P = (crumb, title, subtitle, sections, action) => <Page role="student" crumb={`ECET preparation / ${crumb}`} title={title} subtitle={subtitle} tabs={ECET_TABS} sections={sections} action={action} />;

export const EcetHome = () => P("Overview", "ECET preparation", "Learn the topics, practise questions and test yourself. Pick how you want to prepare.", [
  { k: "tiles", cols: 3, items: [
    { t: "Study your curriculum", d: "Your regulation and branch, semester by semester, with notes, videos and links for every topic.", b: ["Open curriculum", "/student/ecet/curriculum"] },
    { t: "Learn by subject", d: "Common subjects and your branch paper. Read the notes, watch the videos, then mark each item done.", b: ["Explore subjects", "/student/ecet/explore"] },
    { t: "Practise questions", d: "Short practice sets on one topic with explanations after every answer.", b: ["Choose a topic", "/student/ecet/explore"] },
    { t: "Previous papers", d: "Solve earlier AP ECET papers year by year.", b: ["Open papers", "/student/ecet/papers"] },
    { t: "Daily and weekly tests", d: "Tests set by your faculty. One attempt, instant result.", b: ["Open tests", "/student/ecet/tests/daily"] },
    { t: "Mock test", d: "A timed rehearsal drawn from the ECET question bank, up to 200 questions.", b: ["Open mock test", "/student/ecet/tests/mock"] }] },
]);

const useSubjects = (params) => {
  const [rows, setRows] = useState(null);
  useEffect(() => { all("/subjects/", params).then(setRows).catch(() => setRows([])); }, []); // eslint-disable-line
  return rows;
};
const Empty = ({ text }) => <div className="ad-empty">{text}</div>;

export function Explore() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const subs = useSubjects({ branch: user.branch?.id });
  const common = (subs || []).filter((s) => !s.branch_id && !s.regulation_id);
  const mine = (subs || []).filter((s) => s.branch_id === user.branch?.id && !s.regulation_id);
  const br = BRANCH_PAPERS.filter((b) => b.toLowerCase().includes(q.toLowerCase()));
  const tile = (s) => ({ t: s.name, d: s.marks ? `${s.marks} marks` : "", b: ["Open topics", `/student/ecet/topics/${s.id}`] });
  return (
    <WsShell role="student" crumb="ECET preparation / Explore subjects" title="Explore your subjects" subtitle="Common subjects, your branch paper and every branch.">
      <Tabs items={ECET_TABS} />
      <h2 style={{ margin: "0 0 14px" }}>Common subjects</h2>
      {subs && common.length === 0 ? <Empty text="No common subjects added yet." /> : <Tiles cols={3} items={common.map(tile)} />}
      <h2 style={{ margin: "0 0 14px" }}>Your branch paper{user.branch ? ` · ${user.branch.code}` : ""}</h2>
      {subs && mine.length === 0 ? <Empty text="No branch paper subjects added yet." /> : <Tiles cols={3} items={mine.map(tile)} />}
      <div className="ad-filters"><h2 style={{ margin: 0, flex: 1 }}>All AP ECET branches</h2><Search value={q} onChange={setQ} placeholder="Search branch" /></div>
      <div className="ws-tiles" style={{ "--c": 3 }}>{br.map((b) => <div className="ad-card ws-tile" key={b}><h3>{b}</h3><p>100 marks · branch paper</p></div>)}</div>
    </WsShell>
  );
}

export function Topics() {
  const { subject } = useParams();
  const [sub, setSub] = useState(null);
  const [topics, setTopics] = useState(null);
  const [mats, setMats] = useState([]);
  useEffect(() => {
    api.get(`/subjects/${subject}/`).then((r) => setSub(r.data)).catch(() => setSub(false));
    all("/topics/", { subject }).then(setTopics).catch(() => setTopics([]));
    all("/materials/", { subject }).then(setMats).catch(() => {});
  }, [subject]);
  const pct = (t) => { const m = mats.filter((x) => x.topic_id === t.id); return m.length ? Math.round((m.filter((x) => x.done).length / m.length) * 100) : 0; };
  return (
    <WsShell role="student" crumb={`ECET preparation / ${sub?.name || "Topics"}`} title={sub?.name || "Topics"} subtitle="Pick a topic to learn and practise.">
      <Tabs items={ECET_TABS} />
      {topics && topics.length === 0 ? <Empty text="No topics added yet." /> : <Tiles cols={3} items={(topics || []).map((t) => ({ t: t.name, d: t.description || "Notes, videos and practice", pct: pct(t), b: ["Learn", `/student/ecet/learn/${t.id}`] }))} />}
    </WsShell>
  );
}

/** One topic: learn from notes, videos and links, then practise. Finished items feed the progress bar. */
export function Learn() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [mats, setMats] = useState(null);
  const load = () => all("/materials/", { topic: id }).then(setMats).catch(() => setMats([]));
  useEffect(() => { api.get(`/topics/${id}/`).then((r) => setTopic(r.data)).catch(() => {}); load(); }, [id]); // eslint-disable-line
  const flip = async (m) => { await api.post(`/materials/${m.id}/${m.done ? "undo" : "complete"}/`).catch(() => {}); load(); };
  const done = (mats || []).filter((m) => m.done).length;
  const total = (mats || []).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <WsShell role="student" crumb="ECET preparation / Learn" title={topic?.name || "Topic"} subtitle="Learn first, then practise." action={<Btn b={["Practise this topic", `/student/ecet/practice?topic=${id}`]} kind="c" />}>
      <Tabs items={ECET_TABS} />
      <div className="ad-card" style={{ marginBottom: 20 }}><div className="ad-pr"><span>Learning progress</span><span>{done} of {total} done · {pct}%</span></div><div className="ws-pbar"><i style={{ width: `${pct}%` }} /></div></div>
      {mats && total === 0 && <Empty text="No learning material has been added for this topic yet." />}
      {(mats || []).map((m) => (
        <div className="ad-card" key={m.id} style={{ marginBottom: 16 }}>
          <div className="ad-eyebrow">{{ NOTES: "Notes", VIDEO: "Video", PDF: "PDF", LINK: "Web link" }[m.kind]}</div><h2 style={{ margin: "8px 0" }}>{m.title}</h2>
          {m.kind === "NOTES" && <p className="ws-p" style={{ whiteSpace: "pre-line" }}>{m.body}</p>}
          {m.kind === "VIDEO" && m.file_url && <video controls preload="metadata" style={{ width: "100%", maxHeight: 460, borderRadius: 14, background: "#000", marginBottom: 12 }} src={m.file_url} />}
          {m.kind !== "NOTES" && m.file_url && m.kind === "PDF" && <p className="ws-p"><a href={m.file_url} target="_blank" rel="noreferrer">Open PDF ↗</a></p>}
          {m.kind !== "NOTES" && m.url && <p className="ws-p"><a href={m.url} target="_blank" rel="noreferrer">Open {m.kind === "VIDEO" ? "video link" : m.kind === "PDF" ? "PDF link" : "link"} ↗</a></p>}
          {m.uploaded_by_name && <small style={{ color: "var(--mu)" }}>Added by {m.uploaded_by_name}</small>}
          <div className="ws-btns"><button className={`ad-btn ${m.done ? "o" : "c"} s`} onClick={() => flip(m)}>{m.done ? "Done · Undo" : "Mark as done"}</button></div>
        </div>
      ))}
    </WsShell>
  );
}

export function Branch() {
  const { user } = useAuth();
  const subs = useSubjects({ branch: user.branch?.id });
  const mine = (subs || []).filter((s) => s.branch_id === user.branch?.id && !s.regulation_id);
  return P("Branch paper", `${user.branch?.name || "Branch"} paper`, "Subjects and marks for your AP ECET branch paper.", [
    { k: "tiles", cols: 3, items: mine.map((s) => ({ t: s.name, d: s.marks ? `${s.marks} marks` : "", b: ["Open topics", `/student/ecet/topics/${s.id}`] })) },
    ...(subs && mine.length === 0 ? [{ k: "note", text: "No branch paper subjects added yet. Your admin adds them in Subjects & topics." }] : []),
  ]);
}

export function Papers() {
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const load = () => { all("/papers/").then(setRows).catch(() => setRows([])); };
  useEffect(load, []);
  const flip = async (r) => { try { await api.post(`/papers/${r.id}/${r.saved ? "unsave" : "save"}/`); setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, saved: !r.saved } : x))); } catch (e) { /* keep as is */ } };
  const years = [...new Set((rows || []).map((r) => r.year))].sort((x, y) => y - x);
  const shown = (rows || []).filter((r) => (!year || String(r.year) === year) && (!onlySaved || r.saved));
  return (
    <WsShell role="student" crumb="ECET preparation / Previous papers" title="Previous papers" subtitle="AP ECET papers for your branch. Open one, solve it, and save the ones you want to return to.">
      <Tabs items={ECET_TABS} />
      <div className="ad-filters">
        <select className="ad-in" value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <label className="ws-check"><input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} /> Saved only</label>
      </div>
      {rows && rows.length === 0 && <div className="ad-empty">No papers have been added yet. Your admin uploads them as they become available.</div>}
      {rows && rows.length > 0 && shown.length === 0 && <div className="ad-empty">{onlySaved ? "You have not saved any papers yet." : "No papers match."}</div>}
      <List head={<><span>Paper</span><span>Action</span></>} rows={shown.map((r) => (
        <Row key={r.id} title={r.title} meta={`${r.year} · ${r.branch_code || "All branches"}`}>
          <a className="ad-btn c s" href={r.file_url} target="_blank" rel="noreferrer">Open PDF</a>
          <button className="ad-btn o s" onClick={() => flip(r)}>{r.saved ? "Saved ✓" : "Save"}</button></Row>))} />
    </WsShell>
  );
}

const dayOf = (x) => new Date(`${x.scheduled_date}T00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function TestList() {
  const { type } = useParams();
  const t = TESTS[type] || TESTS.daily;
  const [mine, setMine] = useState([]);
  useEffect(() => { all("/tests/", { test_type: type }).then(setMine).catch(() => {}); }, [type]);
  const finished = (x) => x.my_attempt?.submitted;
  const due = mine.filter((x) => x.status !== "ENDED" && !finished(x));
  const past = mine.filter((x) => x.status === "ENDED" || finished(x));
  const done = mine.filter(finished);
  const avg = done.length ? `${Math.round(done.reduce((s, x) => s + x.my_attempt.percent, 0) / done.length)}%` : "—";
  const stats = type === "mock" ? t.stats : [["Assigned", String(mine.length), "Given by your faculty"], ["Completed", String(done.length), "Tests you have taken"], ["Average", avg, "Across completed tests"]];
  return (
    <WsShell role="student" crumb={`ECET preparation / ${t.title}`} title={t.title} subtitle={t.sub}>
      <Tabs items={ECET_TABS} />
      <div className="ad-tabs">{[["daily", "Daily"], ["weekly", "Weekly"], ["cumulative", "Cumulative"], ["mock", "Mock test"]].map(([k, l]) => <Link key={k} to={`/student/ecet/tests/${k}`} className={k === type ? "on" : ""}>{l}</Link>)}</div>
      <Stats items={stats} />
      {type === "mock" && <Panel dark eyebrow="Practice mock" h="Take a mock test now" p="Up to 200 questions from the ECET question bank, 54 seconds each (3 hours for 200), no negative marking. Keep this window open until you submit." btn={["Start mock test", "/student/ecet/mock"]} />}
      {type === "cumulative" && <Panel dark eyebrow="Practice" h="Cumulative practice" p="Up to 30 questions from every topic of one subject, with explanations after you finish." btn={["Choose a subject", "/student/ecet/cumulative"]} />}
      <div className="ad-card" style={{ marginBottom: 24 }}><h2>Assigned to you</h2>
        {due.length === 0 ? <p className="ws-p" style={{ marginTop: 12 }}>Nothing assigned right now. Tests from your faculty appear here.</p>
          : <div className="ad-stream">{due.map((x) => (
            <div key={x.id}><small style={{ color: "#00836d" }}>{dayOf(x)} · {x.start_time.slice(0, 5)} · {x.status === "ACTIVE" ? "Running now" : "Scheduled"}</small><b>{x.name}</b><span>{x.question_count} questions · {x.duration_minutes} min · One attempt</span>
              {x.status === "ACTIVE" ? <Link className="ad-btn c s" style={{ marginTop: 10 }} to={`/student/test/${x.id}`}>{x.my_attempt ? "Resume test" : "Start test"}</Link> : <small style={{ marginTop: 8 }}>Opens at {x.start_time.slice(0, 5)}</small>}</div>))}</div>}</div>
      <div className="ad-card"><h2>{t.head}</h2>
        {past.length === 0 ? <p className="ws-p" style={{ marginTop: 12 }}>Nothing here yet. Your completed tests will be listed after your first attempt.</p>
          : <div className="ad-stream">{past.map((x) => (
            <div key={x.id}><small>{dayOf(x)}</small><b>{x.name}</b>
              {finished(x) ? <><span>Score {x.my_attempt.percent}%</span><Link className="ad-btn o s" style={{ marginTop: 10 }} to={`/student/result/${x.my_attempt.id}`}>View result</Link></> : <span>Missed. The test ended before you took it.</span>}</div>))}</div>}</div>
    </WsShell>
  );
}

export function Results() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/attempts/").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  return (
    <WsShell role="student" crumb="ECET preparation / Results" title="Results" subtitle="Every test you have completed.">
      <Tabs items={ECET_TABS} />
      {rows && rows.length === 0 && <div className="ad-empty">No results yet. Finish a test and your score appears here.</div>}
      <List head={<><span>Test</span><span>Score</span></>} rows={(rows || []).map((a) => (
        <Row key={a.id} title={a.title} meta={`${new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${a.kind === "TEST" ? "Test" : "Practice"} · ${a.score}/${a.total} · ${a.percent}%`}><Link className="ad-btn o s" to={`/student/result/${a.id}`}>View result</Link></Row>
      ))} />
    </WsShell>
  );
}
export { Hero };
