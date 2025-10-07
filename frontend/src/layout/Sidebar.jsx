import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import wordWhite from "../assets/img/kaizen-title-w.png";
import logo from "../assets/img/logo-b.jpg";
import { useEffect, useState } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports/costos", label: "Costos", icon: BarChart3 },
];

const logout = () => {
  try { localStorage.removeItem("currentUser"); } catch {}
  sessionStorage.removeItem("kz-auth");
  window.location.href = "/login";
};

export default function Sidebar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setOpen(v => !v);
    document.addEventListener("kz:toggleSidebar", onToggle);
    return () => document.removeEventListener("kz:toggleSidebar", onToggle);
  }, []);

  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <div className={`sidebar-backdrop lg:hidden ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Kaizen" className="h-7" />
          <img src={wordWhite} alt="Kaizen" className="h-4 opacity-80 hidden md:block" />
        </div>
        <nav className="mt-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item has-sheen pressable ${isActive ? "nav-active" : ""}`}
            >
              <span className="nav-icon"><Icon size={18} /></span>
              <span className="truncate">{label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={logout}
            className="nav-item has-sheen pressable logout-mobile"
            title="Cerrar sesión"
          >
            <span className="nav-icon"><LogOut size={18} /></span>
            <span className="truncate">Salir</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
