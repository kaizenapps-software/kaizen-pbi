import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Moon } from "lucide-react"
import { getDarkPref, setDarkMode } from "../lib/theme"

export default function ThemeButton({ className="" }) {
  const [dark, setDark] = useState(getDarkPref())
  useEffect(()=>{ setDark(getDarkPref()) },[])
  const toggle=()=>{ const on=!dark; setDark(on); setDarkMode(on) }
  return (
    <button aria-label="Cambiar tema" onClick={toggle} className={`btn-ghost ${className}`}>
      <AnimatePresence initial={false} mode="wait">
        {dark ? (
          <motion.span key="sun" initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}} transition={{duration:.18}}>
            <Sun size={18}/>
          </motion.span>
        ) : (
          <motion.span key="moon" initial={{rotate:90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:-90,opacity:0}} transition={{duration:.18}}>
            <Moon size={18}/>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
