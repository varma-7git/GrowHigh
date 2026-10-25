import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import { AuthFrame } from "../components/Public";
import api, { parseError } from "../api/client";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ login_id: "", token: "", new_password: "", confirm_password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const sendCode = async (e) => {
    e.preventDefault();
    setMessage(""); setErrors({});
    if (!form.login_id.trim()) return setErrors({ login_id: "Enter your email or roll number." });
    setBusy(true);
    try {
      await api.post("/auth/forgot-password/", { login_id: form.login_id.trim() }, { skipAuth: true });
      setInfo("If that email is registered, a reset code has been sent to it. Check your inbox and spam folder.");
      setStep(2);
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields); setMessage(m);
    } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setMessage(""); setErrors({});
    const errs = {};
    if (!form.token.trim()) errs.token = "Enter the code from your email.";
    if (form.new_password.length < 8) errs.new_password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.new_password) || !/\d/.test(form.new_password)) errs.new_password = "Use at least one letter and one number.";
    if (form.confirm_password !== form.new_password) errs.confirm_password = "Passwords do not match.";
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      await api.post("/auth/reset-password/", { ...form, login_id: form.login_id.trim(), token: form.token.trim() }, { skipAuth: true });
      navigate("/login", { replace: true, state: { reset: true } });
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields); setMessage(m);
    } finally { setBusy(false); }
  };

  return (
    <AuthFrame h="Forgot password">
        {message && <div className="alert alert-danger" role="alert">{message}</div>}
        {step === 1 ? (
          <form onSubmit={sendCode} noValidate>
            <p className="gh-sub">Enter your email. We will send a reset code to it.</p>
            <Field label="Email or Roll number" name="login_id" value={form.login_id} onChange={set} error={errors.login_id} autoFocus />
            <button className="gh-btn gh-btn-coral w-100 mt-3" disabled={busy}>{busy ? "Sending..." : "Send reset code"}</button>
            <p className="gh-hint mt-3">Not getting the email? Ask your admin to reset your password.</p>
          </form>
        ) : (
          <form onSubmit={reset} noValidate>
            <div className="alert alert-info">{info} The code is valid for 15 minutes.</div>
            <Field label="Reset code" name="token" value={form.token} onChange={set} error={errors.token} autoFocus />
            <Field label="New password" name="new_password" type="password" value={form.new_password} onChange={set}
              error={errors.new_password} hint="At least 8 characters, with a letter and a number." autoComplete="new-password" />
            <Field label="Confirm new password" name="confirm_password" type="password" value={form.confirm_password}
              onChange={set} error={errors.confirm_password} autoComplete="new-password" />
            <button className="gh-btn gh-btn-coral w-100 mt-3" disabled={busy}>{busy ? "Saving..." : "Change password"}</button>
          </form>
        )}
        <p className="gh-alt"><Link to="/login">Back to login</Link></p>
    </AuthFrame>
  );
}
