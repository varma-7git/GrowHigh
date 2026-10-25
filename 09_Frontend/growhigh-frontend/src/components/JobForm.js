import { useEffect, useState } from "react";
import Field from "./Field";
import api, { parseError } from "../api/client";

const EMPTY = { title: "", company_name: "", job_type: "JOB", description: "", location: "", pay: "", deadline: "", apply_link: "", branch_ids: [] };

/** Post a job or internship. `needCompany` is true for the admin (company users post under their own company). */
export default function JobForm({ needCompany, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [branches, setBranches] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/branches/", { params: { page_size: 100 } }).then((r) => setBranches(r.data.results)).catch(() => {});
  }, []);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const toggle = (id) => setForm({
    ...form, branch_ids: form.branch_ids.includes(id) ? form.branch_ids.filter((b) => b !== id) : [...form.branch_ids, id],
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "Enter a title.";
    if (needCompany && !form.company_name.trim()) errs.company_name = "Enter the company name.";
    if (!form.description.trim()) errs.description = "Enter a description.";
    if (form.apply_link && !/^https?:\/\/\S+$/.test(form.apply_link)) errs.apply_link = "Start with http:// or https://";
    setErrors(errs); setMessage("");
    if (Object.keys(errs).length) return;
    const body = { ...form };
    ["location", "pay", "deadline", "apply_link"].forEach((k) => { if (!body[k]) delete body[k]; });
    if (!needCompany || !body.company_name) delete body.company_name;
    setBusy(true);
    try {
      const { data } = await api.post("/jobs/", body);
      setForm(EMPTY);
      onDone(data);
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields); setMessage(m);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="gh-panel">
      {message && <div className="alert alert-danger">{message}</div>}
      <div className="row g-3">
        <div className="col-md-6"><Field label="Title" name="title" value={form.title} onChange={set} error={errors.title} /></div>
        <div className="col-md-6">
          <Field label="Type" name="job_type">
            <select id="f-job_type" name="job_type" className="form-select" value={form.job_type} onChange={set}>
              <option value="JOB">Job</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </Field>
        </div>
        {needCompany && <div className="col-md-6"><Field label="Company name" name="company_name" value={form.company_name} onChange={set} error={errors.company_name} /></div>}
        <div className="col-md-6"><Field label="Location (optional)" name="location" value={form.location} onChange={set} error={errors.location} /></div>
        <div className="col-md-6"><Field label="Salary / stipend (optional)" name="pay" value={form.pay} onChange={set} error={errors.pay} placeholder="e.g. 15,000 per month" /></div>
        <div className="col-md-6"><Field label="Last date to apply (optional)" name="deadline" type="date" value={form.deadline} onChange={set} error={errors.deadline} /></div>
        <div className="col-12">
          <Field label="Description" name="description" error={errors.description}>
            <textarea id="f-description" name="description" rows="4" className={`form-control ${errors.description ? "is-invalid" : ""}`} value={form.description} onChange={set} />
          </Field>
        </div>
        <div className="col-12">
          <label className="gh-lbl">Open to branches <span className="gh-hint">(leave all unticked for every branch)</span></label>
          <div className="gh-checks">
            {branches.map((b) => (
              <label key={b.id} className="gh-check">
                <input type="checkbox" checked={form.branch_ids.includes(b.id)} onChange={() => toggle(b.id)} /> {b.name}
              </label>
            ))}
          </div>
          {errors.branch_ids && <div className="gh-error">{errors.branch_ids}</div>}
        </div>
        <div className="col-12"><Field label="Apply link (optional)" name="apply_link" value={form.apply_link} onChange={set} error={errors.apply_link} placeholder="https://" /></div>
      </div>
      <button className="gh-btn gh-btn-coral mt-3" disabled={busy}>{busy ? "Posting..." : needCompany ? "Post job" : "Post for review"}</button>
    </form>
  );
}
