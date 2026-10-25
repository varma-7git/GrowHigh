import { useCallback, useEffect, useState } from "react";
import JobCard from "../components/JobCard";
import Shell from "../components/Shell";
import api, { parseError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function StudentHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState("jobs");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState([]);
  const [mine, setMine] = useState([]);
  const [message, setMessage] = useState({ kind: "", text: "" });

  const loadJobs = useCallback(() => {
    api.get("/jobs/", { params: { page_size: 100, job_type: type || undefined, search: search || undefined } })
      .then((r) => setJobs(r.data.results)).catch((e) => setMessage({ kind: "danger", text: parseError(e).message }));
  }, [type, search]);
  const loadMine = useCallback(() => {
    api.get("/my-applications/", { params: { page_size: 100 } }).then((r) => setMine(r.data.results)).catch(() => {});
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { loadMine(); }, [loadMine]);

  const apply = async (job) => {
    try {
      await api.post(`/jobs/${job.id}/apply/`);
      setMessage({ kind: "success", text: `Applied to ${job.title}.` });
    } catch (e) {
      setMessage({ kind: "danger", text: parseError(e).message });
    }
    loadJobs(); loadMine();
  };

  return (
    <Shell title={`Welcome, ${user.full_name}`} tabs={[["jobs", "Jobs & internships"], ["mine", `My applications (${mine.length})`]]} tab={tab} onTab={setTab}>
      {message.text && <div className={`alert alert-${message.kind}`}>{message.text}</div>}
      {tab === "jobs" ? (
        <>
          <div className="row g-2 mb-3">
            <div className="col-sm-4">
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Jobs and internships</option><option value="JOB">Jobs</option><option value="INTERNSHIP">Internships</option>
              </select>
            </div>
            <div className="col-sm-8"><input className="form-control" placeholder="Search by title or company" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          {jobs.length === 0 && <p className="text-muted">No openings for your branch right now.</p>}
          {jobs.map((j) => (
            <JobCard key={j.id} job={j}>
              {j.has_applied
                ? <button className="gh-btn gh-btn-sm gh-btn-done" disabled>Applied</button>
                : <button className="gh-btn gh-btn-coral gh-btn-sm" onClick={() => apply(j)}>Apply</button>}
            </JobCard>
          ))}
        </>
      ) : (
        <>
          {mine.length === 0 && <p className="text-muted">You have not applied to anything yet.</p>}
          {mine.map((a) => (
            <div className="gh-job" key={a.id}>
              <h3 className="gh-h3">{a.job.title}</h3>
              <div className="gh-hint">{a.job.company_name} · {a.job.job_type === "INTERNSHIP" ? "Internship" : "Job"} · Applied {new Date(a.applied_at).toLocaleDateString()}</div>
            </div>
          ))}
        </>
      )}
    </Shell>
  );
}
