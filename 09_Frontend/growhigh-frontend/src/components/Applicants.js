import { useEffect, useState } from "react";
import api, { parseError } from "../api/client";

/** Applicants of one job: the count per branch plus the full list. */
export default function Applicants({ job, onClose }) {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/jobs/${job.id}/application-stats/`),
      api.get(`/jobs/${job.id}/applications/`, { params: { page_size: 100 } }),
    ]).then(([s, a]) => { setStats(s.data); setRows(a.data.results); })
      .catch((e) => setError(parseError(e).message));
  }, [job.id]);

  return (
    <div className="gh-panel">
      <div className="d-flex justify-content-between align-items-start">
        <div><h3 className="gh-h3">{job.title}</h3><div className="gh-hint">{job.company_name}</div></div>
        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
      </div>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {stats && (
        <>
          <p className="mt-3 mb-2"><b>{stats.total}</b> student{stats.total === 1 ? "" : "s"} applied</p>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {stats.by_branch.map((b) => <span className="gh-badge" key={b.branch_id}>{b.branch_name}: <b>{b.count}</b></span>)}
          </div>
          {rows.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm gh-table-stack align-middle">
                <thead><tr><th>Roll no.</th><th>Name</th><th>Branch</th><th>Year</th><th>Email</th><th>Phone</th><th>Applied</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Roll no.">{r.roll_number}</td><td data-label="Name">{r.full_name}</td><td data-label="Branch">{r.branch}</td><td data-label="Year">{r.year_of_study}</td>
                      <td data-label="Email">{r.email}</td><td data-label="Phone">{r.phone || "-"}</td><td data-label="Applied">{new Date(r.applied_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
