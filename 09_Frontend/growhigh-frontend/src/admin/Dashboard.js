import { useEffect, useState } from "react";
import api from "../api/client";
import { Card, Head, Progress, Stat, Stats } from "./ui";

const cnt = (path, params) => api.get(path, { params: { ...params, page_size: 1 } }).then((r) => r.data.count).catch(() => 0);
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const KIND = { STUDENT: "student", FACULTY: "faculty", COMPANY: "company", ADMIN: "admin" };

export default function Dashboard({ go }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      const [students, faculty, companies, admins, fp, ft, cp, ct, jp, jt, recent] = await Promise.all([
        cnt("/users/", { role: "STUDENT" }), cnt("/users/", { role: "FACULTY" }), cnt("/users/", { role: "COMPANY" }), cnt("/users/", { role: "ADMIN" }),
        cnt("/faculty-requests/", { status: "PENDING" }), cnt("/faculty-requests/"),
        cnt("/companies/", { status: "PENDING" }), cnt("/companies/"), cnt("/jobs/", { status: "PENDING" }), cnt("/jobs/"),
        api.get("/users/", { params: { page_size: 100 } }).then((r) => r.data.results).catch(() => []),
      ]);
      setD({ students, faculty, companies, admins, fp, ft, cp, ct, jp, jt, recent });
    })();
  }, []);
  if (!d) return <div className="a-loading">Loading…</div>;

  const total = d.students + d.faculty + d.companies + d.admins;
  const days = [...Array(7)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - (6 - i)); x.setHours(0, 0, 0, 0); return x; });
  const bars = days.map((day) => d.recent.filter((u) => new Date(u.created_at).toDateString() === day.toDateString()).length);
  const max = Math.max(1, ...bars); const best = bars.indexOf(Math.max(...bars));
  const pct = (p, t) => (t ? ((t - p) / t) * 100 : 100);

  return (
    <>
      <Head crumb="Dashboard" title="System overview" sub="An organised view of people, assessment and career content."
        action={<button className="a-btn a-btn-coral" onClick={() => go("users")}>Manage users</button>} />
      <div className="a-hero"><h2>A healthy learning ecosystem</h2>
        <p>{total} total users = {d.students} students + {d.faculty} faculty + {d.companies} companies + {d.admins} admins.</p></div>
      <Stats>
        <Stat label="Total users" value={total} note="Everyone on the platform" />
        <Stat label="Students" value={d.students} note="Registered learners" />
        <Stat label="Faculty" value={d.faculty} note="Teaching and assessment" />
        <Stat label="Companies" value={d.companies} note="Job and internship partners" />
      </Stats>
      <div className="a-two">
        <div className="a-stack">
          <Card title="Platform activity">
            <div className="a-sub"><span>New registrations · last 7 days</span><b>7 days</b></div>
            <div className="a-chart">
              {bars.map((n, i) => (
                <div key={i}><span className="a-n">{n}</span><i className={i === best && n > 0 ? "best" : ""} style={{ height: `${Math.max(6, (n / max) * 100)}%`, animationDelay: `${i * 70}ms` }} /><em>{DAYS[days[i].getDay()]}</em></div>
              ))}
            </div>
            <p className="a-note">Cyan: registrations · Coral: busiest day</p>
          </Card>
          <Card title="Platform operations">
            <Progress label="Faculty requests reviewed" pct={pct(d.fp, d.ft)} />
            <Progress label="Company requests reviewed" pct={pct(d.cp, d.ct)} />
            <Progress label="Job postings reviewed" pct={pct(d.jp, d.jt)} />
            <p className="a-note">Review pending items so students see only verified opportunities.</p>
            <button className="a-btn a-btn-light" onClick={() => go("opps")}>Review opportunities</button>
          </Card>
        </div>
        <div className="a-stack">
          <Card title="Activity stream">
            <div className="a-stream">
              {d.recent.slice(0, 3).map((u) => (
                <div key={u.id}><small>{new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</small>
                  <strong>New {KIND[u.role]} account</strong><p>{u.full_name} · {u.login_id}</p></div>
              ))}
              {d.recent.length === 0 && <p className="a-note">No registrations yet.</p>}
            </div>
          </Card>
          <Card dark title="Publishing checklist">
            <ul className="a-check">
              <li className="ok">Admin account active</li>
              <li className={d.fp ? "" : "ok"}>{d.fp ? `${d.fp} faculty awaiting approval` : "Faculty requests reviewed"}</li>
              <li className={d.cp ? "" : "ok"}>{d.cp ? `${d.cp} companies awaiting approval` : "Company requests reviewed"}</li>
              <li className={d.jp ? "" : "ok"}>{d.jp ? `${d.jp} postings awaiting review` : "Job postings reviewed"}</li>
            </ul>
            <button className="a-btn a-btn-white" onClick={() => go(d.fp ? "faculty" : "opps")}>Open review queue</button>
          </Card>
        </div>
      </div>
    </>
  );
}
