import { useEffect, useRef, useState } from "react"
import BiDashboardEmbed from "../bi/BiDashboardEmbed.jsx"
import { initTheme } from "../lib/theme"

export default function BiDashboardPage() {
  const wrapRef = useRef(null)
  const [frameH, setFrameH] = useState(640)

  useEffect(() => { initTheme() }, [])

  useEffect(() => {
    const recalc = () => {
      if (!wrapRef.current) return
      const top = wrapRef.current.getBoundingClientRect().top
      setFrameH(Math.max(360, window.innerHeight - top - 8))
    }
    recalc()
    const ro = new ResizeObserver(recalc); ro.observe(document.body)
    window.addEventListener("resize", recalc)
    return () => { ro.disconnect(); window.removeEventListener("resize", recalc) }
  }, [])

  return (
    <div ref={wrapRef} className="px-4 pb-6 anim-page rounded-2xl border border-border overflow-hidden shadow-soft anim-fade-up">
      <BiDashboardEmbed style={{ height: `${frameH}px` }} />
    </div>
  )
}
