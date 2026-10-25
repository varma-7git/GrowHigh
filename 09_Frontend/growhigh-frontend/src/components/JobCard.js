export const STATUS_CLASS = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

/** One job or internship. `children` are the action buttons. */
export default function JobCard({ job, showStatus, children }) {
  return (
    <div className={`gh-job gh-job-${job.status && job.status !== "APPROVED" ? "REVIEW" : job.job_type}`}>
      <div className="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <h3 className="gh-h3">{job.title}</h3>
          <div className="gh-hint">{job.company_name}{job.location ? ` · ${job.location}` : ""}</div>
        </div>
        <div className="d-flex gap-2 align-items-start flex-wrap">
          <span className={`gh-badge gh-badge-${job.job_type}`}>{job.job_type === "INTERNSHIP" ? "Internship" : "Job"}</span>
          {showStatus && job.status && <span className={`badge text-bg-${STATUS_CLASS[job.status]}`}>{job.status}</span>}
          {showStatus && !job.is_active && <span className="badge text-bg-secondary">CLOSED</span>}
        </div>
      </div>
      <p className="gh-desc">{job.description}</p>
      <div className="gh-meta">
        {job.pay && <span>Pay: {job.pay}</span>}
        {job.deadline && <span>Last date: {job.deadline}</span>}
        <span>For: {job.branches?.length ? job.branches.map((b) => b.code || b.name).join(", ") : "All branches"}</span>
        {job.applicant_count !== undefined && <span>Applicants: <b>{job.applicant_count}</b></span>}
      </div>
      {job.status === "REJECTED" && job.rejection_reason && <div className="gh-error mt-2">Rejected: {job.rejection_reason}</div>}
      {job.apply_link && <div className="mt-2"><a href={job.apply_link} target="_blank" rel="noreferrer">External link</a></div>}
      {children && <div className="d-flex gap-2 flex-wrap mt-3">{children}</div>}
    </div>
  );
}
