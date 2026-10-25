import { NavLink } from "react-router-dom";

/** Switch between the three self-registration forms. Admins cannot register: they only log in. */
export default function RoleTabs() {
  return (
    <div className="gh-roletabs">
      <NavLink to="/register" end>Student</NavLink>
      <NavLink to="/register-faculty">Faculty</NavLink>
      <NavLink to="/register-company">Company</NavLink>
    </div>
  );
}
