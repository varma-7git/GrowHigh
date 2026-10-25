import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import EmailVerify from "../components/EmailVerify";
import EmailCodeDialog from "../components/EmailCodeDialog";
import RoleTabs from "../components/RoleTabs";
import { AuthFrame } from "../components/Public";
import api, { parseError } from "../api/client";
import { homeFor, useAuth } from "../context/AuthContext";

const EMPTY = {
  full_name: "", login_id: "", email: "", phone: "", college_name: "",
  branch_id: "", regulation_id: "", year_of_study: "", password: "", confirm_password: "",
};

function validate(f, token) {
  const e = {};
  if (!f.full_name.trim()) e.full_name = "Enter your full name.";
  if (!f.login_id.trim()) e.login_id = "Enter your roll number.";
  else if (f.login_id.trim().length > 30) e.login_id = "Roll number can be at most 30 characters.";
  if (!f.email.trim()) e.email = "Email is required, so you can reset a forgotten password.";
  else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  else if (!token) e.email = "Verify your email: send the code and enter it.";
  if (f.phone && !/^[0-9+\- ]{7,15}$/.test(f.phone)) e.phone = "Enter a valid phone number.";
  if (!f.branch_id) e.branch_id = "Select your branch.";
  if (!f.year_of_study) e.year_of_study = "Select your year.";
  if (!f.regulation_id) e.regulation_id = "Select your regulation.";
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use at least one letter and one number.";
  if (f.confirm_password !== f.password) e.confirm_password = "Passwords do not match.";
  return e;
}

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [branches, setBranches] = useState([]);
  const [regs, setRegs] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailToken, setEmailToken] = useState("");
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    api.get("/branches/", { params: { page_size: 100 }, skipAuth: true })
      .then((r) => setBranches(r.data.results))
      .catch((err) => setMessage(parseError(err).message));
    api.get("/regulations/", { params: { page_size: 100 }, skipAuth: true }).then((r) => setRegs(r.data.results)).catch(() => {});
  }, []);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

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
      await api.post("/auth/register/", {
        ...form,
        full_name: form.full_name.trim(),
        login_id: form.login_id.trim(),
        email: form.email.trim(),
        email_token: token,
        branch_id: Number(form.branch_id),
        year_of_study: Number(form.year_of_study),
        regulation_id: Number(form.regulation_id),
      }, { skipAuth: true });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields);
      setMessage(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame h="@@H@@">
        <RoleTabs />
        <h2>Student registration</h2>
        <p className="gh-sub">Already registered? <Link to="/login">Login</Link></p>
        {message && <div className="alert alert-danger" role="alert">{message}</div>}
        {ask && <EmailCodeDialog email={form.email.trim()} onCancel={() => setAsk(false)} onVerified={(t) => { setEmailToken(t); setAsk(false); register(t); }} />}
        <form onSubmit={submit} noValidate>
          <Field label="Full name" name="full_name" value={form.full_name} onChange={set} error={errors.full_name} autoComplete="name" />
          <div className="row g-3">
            <div className="col-md-6">
              <Field label="Roll number (Login ID)" name="login_id" value={form.login_id} onChange={set}
                error={errors.login_id} placeholder="21001-CM-001" hint="You cannot change this later." />
            </div>
            <div className="col-md-6">
              <EmailVerify simple value={form.email} onChange={set} onToken={setEmailToken} error={errors.email || errors.email_token} />
            </div>
            <div className="col-md-6">
              <Field label="Phone (optional)" name="phone" value={form.phone} onChange={set} error={errors.phone} autoComplete="tel" />
            </div>
            <div className="col-md-6">
              <Field label="College (optional)" name="college_name" value={form.college_name} onChange={set} error={errors.college_name} />
            </div>
            <div className="col-md-6">
              <Field label="Branch" name="branch_id" error={errors.branch_id}>
                <select id="f-branch_id" name="branch_id" value={form.branch_id} onChange={set}
                  className={`form-select ${errors.branch_id ? "is-invalid" : ""}`}>
                  <option value="">Select branch</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Year of study" name="year_of_study" error={errors.year_of_study}>
                <select id="f-year_of_study" name="year_of_study" value={form.year_of_study} onChange={set}
                  className={`form-select ${errors.year_of_study ? "is-invalid" : ""}`}>
                  <option value="">Select year</option>
                  <option value="1">1st year</option>
                  <option value="2">2nd year</option>
                  <option value="3">3rd year</option>
                </select>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Regulation" name="regulation_id" error={errors.regulation_id} hint="Your curriculum scheme, such as C23.">
                <select id="f-regulation_id" name="regulation_id" value={form.regulation_id} onChange={set}
                  className={`form-select ${errors.regulation_id ? "is-invalid" : ""}`}>
                  <option value="">Select regulation</option>
                  {regs.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                </select>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Password" name="password" type="password" value={form.password} onChange={set}
                error={errors.password} hint="At least 8 characters, with a letter and a number." autoComplete="new-password" />
            </div>
            <div className="col-md-6">
              <Field label="Confirm password" name="confirm_password" type="password" value={form.confirm_password}
                onChange={set} error={errors.confirm_password} autoComplete="new-password" />
            </div>
          </div>
          <button className="gh-btn gh-btn-coral w-100 mt-3" disabled={busy}>{busy ? "Creating account..." : "Register"}</button>
        </form>
    </AuthFrame>
  );
}
