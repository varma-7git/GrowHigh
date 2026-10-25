import { useEffect, useState } from "react";
import api, { parseError } from "../api/client";

/** Email box that proves the address is real: availability check, then a 6-digit code sent to that inbox.
 *  `onToken(token)` is called with the proof ("" when the email changes). `original` = an address that needs no proof (editing a user). */
export default function EmailVerify({ value, onChange, onToken, error, label = "Email", original = "", ad = false, simple = false }) {
  const email = value.trim().toLowerCase();
  const valid = /^\S+@\S+\.\S+$/.test(email);
  const same = original && email === original.toLowerCase();
  const [avail, setAvail] = useState("");        // "", "checking", "free", "taken"
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState("");  // the email that was verified
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [wait, setWait] = useState(0);
  const ok = verified === email || same;

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const change = (e) => { if (simple) onToken(""); setAvail(""); setSent(false); setCode(""); setMsg(""); if (verified) { setVerified(""); onToken(""); } onChange(e); };
  const check = async () => {
    if (!valid || same) { setAvail(""); return; }
    setAvail("checking");
    try { const { data } = await api.get("/auth/check-email/", { params: { email }, skipAuth: true }); setAvail(data.available ? "free" : "taken"); }
    catch { setAvail(""); }
  };
  const send = async () => {
    setBusy(true); setMsg("");
    try { await api.post("/auth/send-email-code/", { email }, { skipAuth: true }); setSent(true); setWait(30); setMsg(`We emailed a 6-digit code to ${email}. Check your inbox and spam.`); }
    catch (e) { const p = parseError(e); setMsg(p.fields?.email || p.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setMsg("");
    try { const { data } = await api.post("/auth/verify-email-code/", { email, code: code.trim() }, { skipAuth: true }); setVerified(email); onToken(data.token); setMsg(""); }
    catch (e) { setMsg(parseError(e).message); }
    finally { setBusy(false); }
  };

  const C = ad ? { lbl: "", inp: "ad-in", btn: "ad-btn p s", btn2: "ad-btn o s", err: "ad-err", hint: "ad-hint" } : { lbl: "", inp: "form-control", btn: "gh-btn gh-btn-coral gh-btn-sm", btn2: "gh-btn gh-btn-dark gh-btn-sm", err: "gh-error", hint: "gh-hint" };
  const shownErr = error || (avail === "taken" ? "This email is already registered. Try logging in instead." : "");
  return (
    <div className={ad ? "" : "gh-field"}>
      <label htmlFor="ev-email">{label}</label>
      <input id="ev-email" name="email" type="email" className={`${C.inp} ${shownErr && !ad ? "is-invalid" : ""}`} value={value} onChange={change} onBlur={check} autoComplete="email" />
      {shownErr && <div className={C.err}>{shownErr}</div>}
      {!simple && ok && !same && <div className={C.hint} style={{ color: "#14703d", fontWeight: 700 }}>&#10003; Email verified</div>}
      {!simple && !ok && valid && avail !== "taken" && !sent && <div style={{ marginTop: 8 }}><button type="button" className={C.btn} disabled={busy} onClick={send}>{busy ? "Sending…" : "Send verification code"}</button></div>}
      {!simple && !ok && sent && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className={C.inp} style={{ maxWidth: 170 }} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className={C.btn} disabled={busy || code.length !== 6} onClick={verify}>Verify</button>
          <button type="button" className={C.btn2} disabled={busy || wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : "Resend code"}</button>
        </div>)}
      {msg && <div className={msg.startsWith("We emailed") ? C.hint : C.err}>{msg}</div>}
      {!simple && !ok && !sent && !msg && !shownErr && <div className={C.hint}>We will email a code to confirm this address is real.</div>}
    </div>
  );
}
