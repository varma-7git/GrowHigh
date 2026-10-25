import { useState } from "react";

/** Label + input + error text. type="password" gets a Show/Hide toggle. */
export default function Field({ label, name, error, hint, type = "text", className = "", children, ...rest }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  const id = `f-${name}`;
  return (
    <div className={`gh-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="gh-input-wrap">
        {children || (
          <input id={id} name={name} type={isPw && show ? "text" : type}
            className={`form-control ${error ? "is-invalid" : ""}`} {...rest} />
        )}
        {isPw && (
          <button type="button" className="gh-toggle" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error ? <div className="gh-error">{error}</div> : hint ? <div className="gh-hint">{hint}</div> : null}
    </div>
  );
}
