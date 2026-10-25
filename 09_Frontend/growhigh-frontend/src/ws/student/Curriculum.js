import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import WsShell from "../Shell";
import { Btn } from "../kit";
import { Err, List, Row, all } from "../../admin/ui";
import api, { parseError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ECET_TABS } from "./Ecet";
import { Tabs } from "../kit";

/** The student's own diploma curriculum: regulation + branch, one semester at a time. */
export default function Curriculum() {
  const { user } = useAuth();
  const reg = user.regulation, br = user.branch;
  const [sem, setSem] = useState(1);
  const [subs, setSubs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!reg || !br) return;
    setOpen(null);
    all("/subjects/", { regulation: reg.id, semester: sem, branch: br.id }).then((r) => setSubs(r.filter((s) => !s.branch_id || s.branch_id === br.id))).catch((e) => setErr(parseError(e).message));
  }, [reg, br, sem]);
  useEffect(() => { if (open) api.get("/topics/", { params: { subject: open, page_size: 100 } }).then((r) => setTopics(r.data.results)).catch(() => {}); }, [open]);
  return (
    <WsShell role="student" crumb="ECET preparation / Curriculum" title="Diploma curriculum" subtitle={reg && br ? `${reg.code} · ${br.name}` : "Your regulation and branch decide your subjects."}>
      <Tabs items={ECET_TABS} /><Err e={err} />
      {!reg ? (
        <div className="ad-card"><h2>Choose your regulation</h2><p className="ws-p">Select C20, C23 or C26 in your profile to see your subjects.</p><Btn b={["Open profile", "/student/profile/edit"]} kind="c" /></div>
      ) : (
        <>
          <div className="ad-tabs">{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={sem === n ? "on" : ""} onClick={() => setSem(n)}>Semester {n}</button>)}</div>
          <List head={<><span>Subject</span><span>Action</span></>} empty="Your admin has not added subjects for this semester yet." rows={subs.map((s) => (
            <Row key={s.id} title={s.name} meta={[s.code, s.marks ? `${s.marks} marks` : null].filter(Boolean).join(" · ") || "Subject"}>
              <button className="ad-btn o s" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Hide topics" : "Topics"}</button></Row>))} />
          {open && <div className="ad-card" style={{ marginTop: 20 }}><h2>Topics</h2>
            {topics.length === 0 ? <p className="ws-p">No topics added yet.</p> : <div className="ad-stream">{topics.map((t) => <div key={t.id}><b>{t.name}</b><span>{t.description || ""}</span><Link className="ad-link" to={`/student/ecet/learn/${t.id}`}>Learn this topic</Link> · <Link className="ad-link" to={`/student/ecet/practice?topic=${t.id}`}>Practise</Link></div>)}</div>}
            </div>}
        </>
      )}
    </WsShell>
  );
}
