import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

export default function Cards() {
  useEffect(() => { AOS.init({ duration: 300, once: true }); }, []);
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} data-aos="fade-up" className="card h-40" />
      ))}
    </div>
  );
}
