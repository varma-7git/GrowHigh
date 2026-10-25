import { useState } from "react";
import Field from "./Field";
import api from "../api/client";

/** Email input that tells the user, when they leave the field, whether the email is already registered. */
export default function EmailField({ value, onChange, error, label = "Email" }) {
  const [state, setState] = useState(""); // "", "checking", "free", "taken"

  const check = async () => {
    const email = value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setState(""); return; }
    setState("checking");
    try {
      const { data } = await api.get("/auth/check-email/", { params: { email }, skipAuth: true });
      setState(data.available ? "free" : "taken");
    } catch { setState(""); }
  };

  const hint = state === "free" ? <span className="gh-ok">&#10003; This email is available</span>
    : state === "checking" ? "Checking..." : null;

  return (
    <Field label={label} name="email" type="email" value={value} autoComplete="email"
      onChange={(e) => { setState(""); onChange(e); }} onBlur={check} hint={hint}
      error={error || (state === "taken" ? "This email is already registered. Try logging in instead." : "")} />
  );
}
