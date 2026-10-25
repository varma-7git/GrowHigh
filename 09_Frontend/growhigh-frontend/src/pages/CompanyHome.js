import { useCallback, useEffect, useState } from "react";
import Applicants from "../components/Applicants";
import JobCard from "../components/JobCard";
import JobForm from "../components/JobForm";
import Shell from "../components/Shell";
import api, { parseError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CompanyHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState("jobs");
  const [jobs, setJobs] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [message, setMessage] = useState({ kind: "", text: "" });

  const load = useCallback(() => {
    api.get("/jobs/", { params: { page_size: 100 } }).then((r) => setJobs(r.data.results))
      .catch((e) => setMessage({ kind: "danger", text: parseError(e).message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (job) => {
    try { await api.patch(`/jobs/${job.id}/`, { is_active: !job.is_active }); load(); }
    catch (e) { setMessage({ kind: "danger", text: parseError(e).message }); }
  };

  return (
    <Shell title={user.company_name || "Company"} tabs={[["jobs", "My jobs"], ["post", "Post a job"]]} tab={tab} onTab={(t) => { setTab(t); setViewing(null); }}>
      {message.text && <div className={`alert alert-${message.kind}`}>{message.text}</div>}
      {tab === "post" ? (
        <JobForm needCompany={false} onDone={() => { setMessage({ kind: "success", text: "Sent to the admin for approval. Students see it once it is approved." }); setTab("jobs"); load(); }} />
      ) : viewing ? (
        <Applicants job={viewing} onClose={() => setViewing(null)} />
      ) : (
        <>
          {jobs.length === 0 && <p className="text-muted">You have not posted anything yet.</p>}
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} showStatus>
              {j.status === "APPROVED" && <button className="gh-btn gh-btn-sm gh-btn-dark" onClick={() => setViewing(j)}>View applicants ({j.applicant_count})</button>}
              <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(j)}>{j.is_active ? "Close posting" : "Reopen"}</button>
            </JobCard>
          ))}
        </>
      )}
    </Shell>
  );
}
