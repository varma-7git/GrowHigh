import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import { AuthFrame } from "../components/Public";
import { parseError } from "../api/client";
import { homeFor, useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login_id: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.login_id.trim()) errs.login_id = "Enter your email or roll number.";
    if (!form.password) errs.password = "Enter your password.";
    setErrors(errs);
    setMessage("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await login(form.login_id.trim(), form.password);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      const { message: m, fields } = parseError(err);
      setErrors(fields);
      setMessage(err.response?.status === 401 ? "Wrong email / roll number or password." : m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame eyebrow="YOUR NEXT CHAPTER STARTS HERE" h="Welcome back" sub="Pick up where you left off. Your goals are waiting.">
      {location.state?.registered && <div className="alert alert-success">Account created. Please login.</div>}
      {location.state?.reset && <div className="alert alert-success">Password changed. Please login.</div>}
      {message && <div className="alert alert-danger" role="alert">{message}</div>}
      <form onSubmit={submit} noValidate>
        <Field label="Email or Roll number" name="login_id" value={form.login_id} onChange={set}
          error={errors.login_id} placeholder="you@example.com or 21001-CM-001" autoComplete="username" autoFocus />
        <Field label="Password" name="password" type="password" value={form.password} onChange={set}
          error={errors.password} placeholder="Your password" autoComplete="current-password" />
        <div className="pb-fg"><Link to="/forgot-password">Forgot password?</Link></div>
        <button className="gh-btn gh-btn-coral" disabled={busy}>{busy ? "Logging in..." : "Login"}</button>
      </form>
      <p className="pb-alt">New to GrowHigh? <Link to="/register">Register</Link></p>
      <p className="pb-fine">By continuing, you agree to the Terms and Privacy policy.</p>
    </AuthFrame>
  );
}
