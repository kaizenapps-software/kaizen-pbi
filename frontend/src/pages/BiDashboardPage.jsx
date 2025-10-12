import { useEffect, useRef, useState } from "react";
import BiDashboardEmbed from "../bi/BiDashboardEmbed.jsx";
import { initTheme } from "../lib/theme";
import { motion } from "framer-motion";

export default function BiDashboardPage() {
  const wrapRef = useRef(null);
  const [frameH, setFrameH] = useState(640);

  useEffect(() => { initTheme(); }, []);

  useEffect(() => {
    const recalc = () => {
      if (!wrapRef.current) return;
      const top = wrapRef.current.getBoundingClientRect().top;
      setFrameH(Math.max(360, window.innerHeight - top - 8));
    };
    if (window.matchMedia("(min-width:1024px)").matches) {
      recalc();
      const ro = new ResizeObserver(recalc); ro.observe(document.body);
      window.addEventListener("resize", recalc);
      return () => { ro.disconnect(); window.removeEventListener("resize", recalc); };
    }
  }, []);

  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width:1024px)").matches;

  return (
    <motion.div
      ref={wrapRef}
      className="px-3 md:px-4 pb-6 rounded-2xl border border-border overflow-hidden shadow-soft"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <BiDashboardEmbed style={isDesktop ? { height: `${frameH}px` } : undefined} />
      {!isDesktop && <div className="bi-frame hidden" />}
    </motion.div>
  );
}
