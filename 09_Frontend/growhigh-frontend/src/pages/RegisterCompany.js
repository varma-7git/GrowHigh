import { useState } from "react";
import { Link } from "react-router-dom";
import Field from "../components/Field";
import EmailVerify from "../components/EmailVerify";
import EmailCodeDialog from "../components/EmailCodeDialog";
import RoleTabs from "../components/RoleTabs";
import { AuthFrame } from "../components/Public";
import api, { parseError } from "../api/client";

const EMPTY = {
  company_name: "", full_name: "", designation: "", login_id: "", email: "", phone: "",
  website: "", location: "", description: "", password: "", confirm_password: "",
};

function validate(f, token) {
  const e = {};
  if (!f.company_name.trim()) e.company_name = "Enter the company name.";
  if (!f.full_name.trim()) e.full_name = "Enter the contact person's name.";
  if (!f.login_id.trim()) e.login_id = "Choose a username.";
  if (!f.email.trim()) e.email = "Enter the company email.";
  else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  else if (!token) e.email = "Verify your email: send the code and enter it.";
  if (!f.phone.trim()) e.phone = "Enter a phone number.";
  else if (!/^[0-9+\- ]{7,15}$/.test(f.phone)) e.phone = "Enter a valid phone number.";
  if (f.website && !/^https?:\/\/\S+$/.test(f.website)) e.website = "Start with http:// or https://";
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use at least one letter and one number.";
  if (f.confirm_password !== f.password) e.confirm_password = "Passwords do not match.";
  return e;
}

export default function RegisterCompany() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [emailToken, setEmailToken] = useState("");
  const [ask, setAsk] = useState(false);
  const set = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setErrors((er) => ({ ...er, [e.target.name]: undefined })); };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(form, true);
    setErrors(errs); setMessage("");
    if (Object.keys(errs).length) return;
    if (!emailToken) { setAsk(true); return; }
    register(emailToken);
  };

  const register = async (token) => {
    setBusy(true);
    try {
      await api.post("/auth/register-company/", { ...form, email_token: token }, { skipAuth: true });
      setDone(true);
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields); setMessage(m);
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <AuthFrame h="Registration received">
          <p className="gh-sub">The admin has been notified and will review your company details. You can log in once your account is approved.</p>
          <Link to="/login" className="gh-btn gh-btn-coral mt-3">Back to login</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame h="@@H@@">
        <RoleTabs />
        <h2>Company registration</h2>
        <p className="gh-sub">Post jobs and internships for diploma students. The admin reviews every company before it can log in. <Link to="/login">Login</Link></p>
        {message && <div className="alert alert-danger" role="alert">{message}</div>}
        {ask && <EmailCodeDialog email={form.email.trim()} onCancel={() => setAsk(false)} onVerified={(t) => { setEmailToken(t); setAsk(false); register(t); }} />}
        <form onSubmit={submit} noValidate>
          <div className="row g-3">
            <div className="col-md-6"><Field label="Company name" name="company_name" value={form.company_name} onChange={set} error={errors.company_name} /></div>
            <div className="col-md-6"><Field label="Website (optional)" name="website" value={form.website} onChange={set} error={errors.website} placeholder="https://" /></div>
            <div className="col-md-6"><Field label="Contact person" name="full_name" value={form.full_name} onChange={set} error={errors.full_name} autoComplete="name" /></div>
            <div className="col-md-6"><Field label="Designation (optional)" name="designation" value={form.designation} onChange={set} error={errors.designation} placeholder="HR Manager" /></div>
            <div className="col-md-6"><EmailVerify simple value={form.email} onChange={set} onToken={setEmailToken} error={errors.email || errors.email_token} /></div>
            <div className="col-md-6"><Field label="Phone" name="phone" value={form.phone} onChange={set} error={errors.phone} autoComplete="tel" /></div>
            <div className="col-md-6"><Field label="Location (optional)" name="location" value={form.location} onChange={set} error={errors.location} /></div>
            <div className="col-md-6"><Field label="Username" name="login_id" value={form.login_id} onChange={set} error={errors.login_id} hint="You will log in with this." autoComplete="username" /></div>
            <div className="col-12">
              <Field label="About the company (optional)" name="description" error={errors.description}>
                <textarea id="f-description" name="description" rows="3" value={form.description} onChange={set} className="form-control" />
              </Field>
            </div>
            <div className="col-md-6"><Field label="Password" name="password" type="password" value={form.password} onChange={set} error={errors.password} hint="At least 8 characters, with a letter and a number." autoComplete="new-password" /></div>
            <div className="col-md-6"><Field label="Confirm password" name="confirm_password" type="password" value={form.confirm_password} onChange={set} error={errors.confirm_password} autoComplete="new-password" /></div>
          </div>
          <button className="gh-btn gh-btn-coral w-100 mt-3" disabled={busy}>{busy ? "Submitting..." : "Submit for approval"}</button>
        </form>
    </AuthFrame>
  );
}
