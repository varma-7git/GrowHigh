import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import WsShell from "../Shell";
import { Btn, Panel, StateTabs, Stats } from "../kit";
import { Bar } from "../../admin/ui";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { all } from "../../admin/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [tests, setTests] = useState([]);
  const [pg, setPg] = useState(null);
  useEffect(() => { all("/tests/").then(setTests).catch(() => {}); api.get("/student/progress/").then((r) => setPg(r.data)).catch(() => {}); }, []);
  const shown = tests.filter((t) => t.status !== "ENDED" && !t.my_attempt?.submitted && (tab === "all" || t.test_type === tab.toUpperCase()));
  const first = user.full_name.split(" ")[0];
  return (
    <WsShell role="student" crumb="Dashboard" title={<>Welcome back, {first} 👋</>} subtitle="Small steps today. Stronger possibilities tomorrow." action={<Btn b={["Continue learning", "/student/ecet/practice"]} kind="c" />}>
      <div className="ad-hero"><h2>Your Career. Our Priority.</h2><p>Pick a topic and practise a little today.</p></div>
      <div className="ad-grid g3">
        <div className="ad-card"><h2>ECET preparation</h2><div className="ws-big">{pg ? pg.ecet_percent : 0}%</div><div className="ad-pr"><span>Study material completed</span><span>{pg ? `${pg.materials_done}/${pg.materials_total}` : "—"}</span></div><div className="ws-pbar"><i style={{ width: `${pg ? pg.ecet_percent : 0}%` }} /></div><small style={{ color: "var(--mu)" }}>{pg && pg.materials_total === 0 ? "No study material has been added for you yet." : "Mark notes and videos done as you finish them."}</small></div>
        {[["Job preparation", pg?.job_prep, "Lessons completed", "Open job preparation", "/student/job-prep"], ["Career growth", pg?.career, "Lessons completed", "Open career growth", "/student/career"]].map(([t, d, l, n, to]) => (
          <div className="ad-card" key={t}><h2>{t}</h2><div className="ws-big">{d ? d.percent : 0}%</div><div className="ad-pr"><span>{l}</span><span>{d ? `${d.done}/${d.total}` : "—"}</span></div><div className="ws-pbar"><i style={{ width: `${d ? d.percent : 0}%` }} /></div>
            <small style={{ color: "var(--mu)" }}>{d && d.total === 0 ? "No lessons have been added yet." : <Link to={to}>{n} →</Link>}</small></div>
        ))}
      </div>
      <Stats items={[["Average score", pg?.average == null ? "—" : `${pg.average}%`, pg && pg.attempts ? `${pg.questions_answered} questions answered` : "After your first practice set"], ["Study streak", `${pg ? pg.streak : 0} ${pg?.streak === 1 ? "day" : "days"}`, "Days in a row you practised"], ["Tests due", String(pg ? pg.tests_pending : 0), "Assigned and not yet taken"]]} />
      <StateTabs value={tab} onChange={setTab} items={[["all", "All"], ["daily", "Daily"], ["weekly", "Weekly"], ["cumulative", "Cumulative"]]} />
      <div className="ad-grid g2">
        <div className="ad-card">
          <div className="ad-eyebrow">Keep your momentum</div><h2 style={{ marginTop: 8 }}>Assigned tests</h2>
          {shown.length === 0 ? <p className="ws-p" style={{ marginTop: 14 }}>No tests are assigned to you yet. Tests from your faculty appear here.</p>
            : <div className="ad-stream">{shown.slice(0, 4).map((t) => <div key={t.id}><small style={{ color: "#00836d" }}>{new Date(`${t.scheduled_date}T00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {t.start_time.slice(0, 5)}</small><b>{t.name}</b><span>{t.question_count} questions · {t.duration_minutes} min · One attempt</span>{t.status === "ACTIVE" && <Link className="ad-btn c s" style={{ marginTop: 10 }} to={`/student/test/${t.id}`}>{t.my_attempt ? "Resume test" : "Start test"}</Link>}</div>)}</div>}
          <div className="ws-btns"><Btn b={["View daily tests", "/student/ecet/tests/daily"]} kind="c" /><Btn b={["View weekly", "/student/ecet/tests/weekly"]} /></div>
        </div>
        <div className="ad-card">
          <h2>Study momentum</h2>
          <div className="ad-pr" style={{ fontWeight: 500, color: "var(--mu)" }}><span>Questions you answered · last 7 days</span><b>{pg ? pg.week.reduce((t, d) => t + d.questions, 0) : 0}</b></div>
          <div className="ad-chart">{(pg?.week || Array.from({ length: 7 }, () => ({ day: "", questions: 0 }))).map((d, i, arr) => { const mx = Math.max(1, ...arr.map((x) => x.questions)); return <div key={i}><i style={{ height: `${d.questions * 100 / mx}%` }} title={`${d.questions} questions`} />{d.day}</div>; })}</div>
          <small style={{ color: "var(--mu)" }}>{pg && pg.attempts ? "Counts questions in the practice sets and tests you submitted." : "Your activity will be tracked from your first practice."}</small>
        </div>
      </div>
      <div className="ad-grid g2">
        <Panel h="Upcoming timeline" p={tests.length ? "" : "Scheduled tests and deadlines will appear here."} list={tests.filter((t) => t.status !== "ENDED").slice(0, 3).map((t) => [new Date(`${t.scheduled_date}T00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), t.name, `${t.question_count} questions · ${t.duration_minutes} min`])} />
        <div className="ad-card">
          <h2>Continue learning</h2>
          <div className="ad-card ws-tile" style={{ marginTop: 16, boxShadow: "none" }}>
            <svg viewBox="0 0 24 24"><path d="M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2zM22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z" /></svg>
            <h3>Start practising</h3><p>Choose a subject and topic and work through focused questions.</p><em>Mathematics · Physics · Chemistry</em>
            <Link className="ad-btn o s" to="/student/ecet/explore">Choose a topic</Link>
          </div>
        </div>
      </div>
    </WsShell>
  );
}
export { Bar };
