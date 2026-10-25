import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import WsShell from "../Shell";
import { Btn } from "../kit";
import { Err, all } from "../../admin/ui";
import api, { parseError } from "../../api/client";

const L = ["A", "B", "C", "D"];
const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

/** Question card, navigator and submit button. `qs` = [{ id, text, options, topic_name, selected }]; `secs` is null for untimed practice.
 * onPick(questionId, option) saves each answer; onSubmit({ [questionId]: option }) finishes. */
export function Runner({ qs, secs, one, onSubmit, onPick, busy }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState(() => Object.fromEntries(qs.map((q, k) => [k, q.selected]).filter(([, v]) => v !== null && v !== undefined)));
  const timed = secs !== null && secs !== undefined;
  const [left, setLeft] = useState(secs || 0);
  const sent = useRef(false);
  const finish = () => {
    if (sent.current) return;
    sent.current = true;
    onSubmit(Object.fromEntries(Object.entries(ans).map(([k, v]) => [qs[k].id, v])));
  };
  useEffect(() => { if (!timed) return undefined; const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(t); }, [timed]);
  useEffect(() => { if (timed && left === 0) finish(); }); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (k) => { setAns({ ...ans, [i]: k }); if (onPick) onPick(q.id, k); };
  const q = qs[i];
  const done = Object.keys(ans).length;
  return (
    <div className="ws-split">
      <div className="ad-card">
        <div className="ws-bar2"><span className="ad-eyebrow">Question {i + 1} of {qs.length}</span>{timed && <span className={`ws-timer ${left < 60 ? "low" : ""}`}>{clock(left)}</span>}</div>
        <span className="ad-pill">{q.topic_name}</span>
        <div className="ws-qt">{q.text}</div>
        {q.options.map((o, k) => <button key={k} className={`ws-opt ${ans[i] === k ? "on" : ""}`} onClick={() => pick(k)}><i>{L[k]}</i>{o}</button>)}
        <div className="ws-btns">
          <button className="ad-btn o" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
          <button className="ad-btn c" disabled={i === qs.length - 1} onClick={() => setI(i + 1)}>Next question</button>
        </div>
      </div>
      <div>
        <div className="ad-card">
          <h2>Question navigator</h2>
          <div className="ws-nv">{qs.map((_, k) => <button key={k} className={k === i ? "cur" : ans[k] !== undefined ? "done" : ""} onClick={() => setI(k)}>{k + 1}</button>)}</div>
          <div className="ws-leg"><b style={{ background: "#8fe3f1" }} />Answered ({done}) &nbsp; <b style={{ background: "#0b2a45" }} />Current &nbsp; <b style={{ background: "#e1e6ee" }} />Not answered</div>
        </div>
        <div className="ad-card ad-dark" style={{ marginTop: 20 }}>
          <h2>Stay focused</h2>
          <p className="ws-p">{one ? "This test allows one attempt. Do not close or refresh this window. It submits by itself when the time ends." : "Take your time and read each option carefully. Explanations appear in your results."}</p>
          <button className="ad-btn c" disabled={busy} onClick={() => { if (!one || window.confirm(`Submit now? You answered ${done} of ${qs.length}.`)) finish(); }}>{busy ? "Submitting…" : one ? "Submit test" : "Finish practice"}</button>
        </div>
      </div>
    </div>
  );
}

const answerSaver = (attemptId) => (question_id, selected) => { api.post(`/attempts/${attemptId}/answer/`, { question_id, selected }).catch(() => {}); };

/** Real practice on one topic: /student/ecet/practice?topic=ID */
export function Practice() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const topic = params.get("topic");
  const [run, setRun] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!topic) return;
    api.post("/practice/start/", { topic_id: Number(topic), count: 10 }).then((r) => setRun(r.data)).catch((e) => setErr(parseError(e).message));
  }, [topic]);
  const submit = async (answers) => {
    setBusy(true);
    try { const { data } = await api.post(`/attempts/${run.id}/submit/`, { answers }); nav(`/student/result/${data.id}`, { replace: true }); }
    catch (e) { setErr(parseError(e).message); setBusy(false); }
  };
  return (
    <WsShell role="student" crumb="ECET preparation / Practice" title="Practice" subtitle="Ten focused questions with explanations after you finish." action={<Btn b={["Back to subjects", "/student/ecet/explore"]} />}>
      <Err e={err} />
      {!topic && <div className="ad-card"><h2>Choose a topic first</h2><p className="ws-p">Open a subject, pick a topic and press Practise.</p><Btn b={["Explore subjects", "/student/ecet/explore"]} kind="c" /></div>}
      {run && <Runner key={run.id} qs={run.questions} secs={null} busy={busy} onPick={answerSaver(run.id)} onSubmit={submit} />}
    </WsShell>
  );
}

/** Self-started sets: kind "mock" (timed, up to 200 questions) or "cumulative" (one whole subject). */
export function SelfTest({ kind }) {
  const nav = useNavigate();
  const mock = kind === "mock";
  const [run, setRun] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [regs, setRegs] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!mock) { all("/subjects/").then(setSubjects).catch(() => {}); all("/regulations/").then((r) => setRegs(Object.fromEntries(r.map((x) => [x.id, x.code])))).catch(() => {}); } }, [mock]);
  const start = async () => {
    setErr(""); setBusy(true);
    try { const { data } = await api.post("/practice/start/", mock ? { kind } : { kind, subject_id: Number(subject) }); setRun(data); }
    catch (e) { setErr(parseError(e).message); }
    setBusy(false);
  };
  const submit = async (answers) => {
    setBusy(true);
    try { const { data } = await api.post(`/attempts/${run.id}/submit/`, { answers }); nav(`/student/result/${data.id}`, { replace: true }); }
    catch (e) { setErr(parseError(e).message); setBusy(false); }
  };
  return (
    <WsShell role="student" crumb={`ECET preparation / ${mock ? "Mock test" : "Cumulative practice"}`} title={mock ? "Mock test" : "Cumulative practice"}
      subtitle={mock ? "A timed rehearsal from the ECET question bank." : "Questions from every topic of one subject."} action={<Btn b={["Back to tests", `/student/ecet/tests/${kind}`]} />}>
      <Err e={err} />
      {!run && (
        <div className="ad-card"><h2>{mock ? "Before you begin" : "Choose a subject"}</h2>
          {mock ? <p className="ws-p">You get up to 200 questions, 54 seconds for each (3 hours for 200). There is no negative marking. The test submits itself when time ends, so keep this window open.</p>
            : <><p className="ws-p">You get up to 30 random questions from the subject, without a timer. Explanations appear after you submit.</p>
              <select className="ad-in" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Select a subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.regulation_id && regs[s.regulation_id] ? ` · ${regs[s.regulation_id]}` : ""}</option>)}</select></>}
          <div className="ws-btns"><button className="ad-btn c" disabled={busy || (!mock && !subject)} onClick={start}>{busy ? "Starting…" : mock ? "Start mock test" : "Start practice"}</button></div></div>
      )}
      {run && <Runner key={run.id} qs={run.questions} secs={mock ? run.remaining_seconds : null} busy={busy} onPick={answerSaver(run.id)} onSubmit={submit} />}
    </WsShell>
  );
}

/** Full-screen timed test (one attempt) for a test assigned by faculty. */
export function TakeTest() {
  const { id } = useParams();
  const nav = useNavigate();
  const [run, setRun] = useState(null);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/tests/${id}/`).then((r) => setInfo(r.data)).catch((e) => setErr(parseError(e).message)); }, [id]);
  const start = async () => {
    setErr(""); setBusy(true);
    try { const { data } = await api.post(`/tests/${id}/start/`); setRun(data); } catch (e) { setErr(parseError(e).message); }
    setBusy(false);
  };
  const submit = async (answers) => {
    setBusy(true);
    try { const { data } = await api.post(`/attempts/${run.id}/submit/`, { answers }); nav(`/student/result/${data.id}`, { replace: true }); }
    catch (e) { setErr(parseError(e).message); setBusy(false); }
  };
  return (
    <div className="ad ws-take">
      <header><span className="ws-badge">One attempt · Do not close this window</span><b style={{ color: "#fff", fontSize: 18 }}>{info?.name}</b></header>
      <main>
        <h1>{info?.name || "Test"}</h1><Err e={err} />
        {run ? <Runner qs={run.questions} secs={run.remaining_seconds} one busy={busy} onPick={answerSaver(run.id)} onSubmit={submit} /> : info && (
          <div className="ad-card" style={{ maxWidth: 640 }}>
            <h2>Before you begin</h2>
            <p className="ws-p">{info.question_count} questions · {info.duration_minutes} minutes · one attempt. The timer starts when you press Start. When time ends, the test is submitted automatically. Each question is worth one mark and there is no negative marking.</p>
            <div className="ws-btns"><button className="ad-btn c" disabled={busy || info.my_attempt?.submitted} onClick={start}>{busy ? "Starting…" : info.my_attempt && !info.my_attempt.submitted ? "Resume test" : "Start test"}</button><Link className="ad-btn o" to="/student/ecet/tests/daily">Not now</Link></div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Score, topic-wise performance and the answer review for one attempt (test or practice). */
export function ResultView() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => { api.get(`/attempts/${id}/`).then((x) => setR(x.data)).catch((e) => setErr(parseError(e).message)); }, [id]);
  const weak = r && [...r.topics].sort((a, b) => a.percent - b.percent)[0];
  return (
    <WsShell role="student" crumb="ECET preparation / Result" title={r?.title || "Result"} subtitle="Your result and what to do next." action={<Btn b={["All results", "/student/ecet/results"]} />}>
      <Err e={err} />
      {r && (
        <>
          <div className="ad-grid g2">
            <div className="ad-card ad-dark"><div className="ad-eyebrow">Your score</div><div className="ws-big" style={{ color: "#fff" }}>{r.score}/{r.total}</div><p className="ws-p">{r.percent}% correct · {r.passed ? "Good work. Keep the streak going." : "Below 40%. This needs more practice."}</p></div>
            <div className="ad-card"><h2>Topic-wise performance</h2>{r.topics.map((t) => <div key={t.name}><div className="ad-pr"><span>{t.name}</span><span>{t.percent}%</span></div><div className="ad-bar"><i style={{ width: `${t.percent}%` }} /></div></div>)}</div>
          </div>
          <div className="ad-card" style={{ marginBottom: 24 }}>
            <div className="ad-eyebrow">Next step</div><h2 style={{ marginTop: 8 }}>{weak && weak.percent < 100 ? `Revise ${weak.name}` : "Keep practising"}</h2>
            <p className="ws-p">{weak && weak.percent < 100 ? "Spend 20 minutes on your weakest topic, then try a short practice set." : "You answered everything correctly. Try a harder topic."}</p>
            <div className="ws-btns"><Btn b={["Open ECET preparation", "/student/ecet"]} kind="c" /><Btn b={[show ? "Hide answers" : "Review answers", null, () => setShow(!show)]} /></div>
          </div>
          {show && r.review.map((q, i) => (
            <div className="ad-card" key={q.id} style={{ marginBottom: 16 }}>
              <div className="ad-eyebrow">Question {i + 1} · {q.topic_name}</div><div className="ws-qt" style={{ fontSize: 22 }}>{q.text}</div>
              {q.options.map((o, k) => <div key={k} className={`ws-opt ${k === q.correct ? "ok" : q.selected === k ? "no" : ""}`} style={{ cursor: "default" }}><i>{L[k]}</i>{o}</div>)}
              <p className="ws-p">{q.selected === null ? "Not answered. " : ""}{q.explanation}</p>
            </div>
          ))}
        </>
      )}
    </WsShell>
  );
}
