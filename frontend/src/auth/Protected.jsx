import React from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "./AuthContext"

export default function Protected() {
  const { isAuth, hydrated } = useAuth()
  const bypass = import.meta.env.VITE_BYPASS_AUTH === "true"
  if (!hydrated && !bypass) return <div className="p-6 text-muted">Cargando sesión…</div>
  if (bypass) return <Outlet/>        // <- permite pasar sin login
  return isAuth ? <Outlet/> : <Navigate to="/login" replace />
}
