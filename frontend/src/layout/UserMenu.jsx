import React from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"
import { LogOut, User } from "lucide-react"

export default function UserMenu({ onClose }) {
  const { logout } = useAuth()

  return (
    <>
      {/* backdrop para cerrar si se hace click fuera */}
      <div className="fixed inset-0 z-[95]" onClick={onClose} />
      <div className="user-menu">
        <Link to="/profile" onClick={onClose} className="flex items-center gap-2">
          <User size={16}/> Mi perfil
        </Link>
        <button
          onClick={async ()=>{ await logout(); onClose(); }}
          className="flex items-center gap-2"
        >
          <LogOut size={16}/> Cerrar sesión
        </button>
      </div>
    </>
  )
}
