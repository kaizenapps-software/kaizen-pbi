import { NavLink } from "react-router-dom"
import { LayoutDashboard, BarChart3 } from "lucide-react"
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import wordWhite from "../assets/img/kaizen-title-w.png"
import logo from "../assets/img/logo-b.jpg"

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports/costos", label: "Costos", icon: BarChart3 },
]

const logout = () => {
  try { localStorage.removeItem("currentUser"); } catch {}
  window.location.href = "/login";
};


export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("kz-auth");

    navigate("/login", { replace: true });
    window.history.replaceState(null, "", "/login");

    const blocker = () => {
      navigate("/login", { replace: true });
      window.history.replaceState(null, "", "/login");
    };
    window.addEventListener("popstate", blocker, { once: true });
  };
  
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Kaizen" className="h-7" />
        <img src={wordWhite} alt="Kaizen" className="h-4 opacity-80 hidden md:block" />
      </div>
      <nav className="mt-2">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
  )
}

<div className="sidebar__logout">
  <button
    type="button"
    onClick={logout}
    className="nav-item has-sheen pressable"
    title="Cerrar sesión"
  >
    <span className="nav-icon"><LogOut size={18} /></span>
    <span className="truncate">Cerrar sesión</span>
  </button>
</div>