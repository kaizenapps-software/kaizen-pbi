import React, { useEffect, useRef, useState } from "react";
import slide1 from "../assets/img/imagen1.jpeg";
import slide2 from "../assets/img/imagen2.jpg";
import slide3 from "../assets/img/imagen3.jpg";
import "./Banner.css";

const slides = [
  {
    image: slide1,
    title: "Gestiona tus presupuestos",
    text: "Planifica, controla y analiza recursos con dashboards claros y accionables.",
  },
  {
    image: slide2,
    title: "Controla tus recursos",
    text: "Monitorea gastos, actividades y decisiones en tiempo real.",
  },
  {
    image: slide3,
    title: "Reportes y resultados",
    text: "Visualiza KPIs y genera reportes listos para compartir.",
  },
];

export default function Banner() {
  const [current, setCurrent] = useState(0);
  const startX = useRef(null);
  const boxRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  // autoplay
  useEffect(() => {
    const iv = setInterval(() => setCurrent((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(iv);
  }, []);

  const onStart = (e) => (startX.current = e.touches ? e.touches[0].clientX : e.clientX);
  const onEnd = (e) => {
    if (startX.current == null) return;
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = endX - startX.current;
    if (dx > 50) setCurrent((i) => (i - 1 + slides.length) % slides.length);
    else if (dx < -50) setCurrent((i) => (i + 1) % slides.length);
    startX.current = null;
  };

  // tilt 3D suave con el mouse
  const onMove = (e) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;   // 0..1
    const y = (e.clientY - r.top) / r.height;   // 0..1
    const ry = (x - 0.5) * 8;                    // rotateY
    const rx = (0.5 - y) * 6;                    // rotateX
    setTilt({ rx, ry });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0 });

  return (
    <aside className="banner">
      <div
        ref={boxRef}
        className="banner__image-container"
        onMouseDown={onStart}
        onMouseUp={onEnd}
        onMouseLeave={(e) => { onEnd(e); onLeave(); }}
        onTouchStart={onStart}
        onTouchEnd={onEnd}
        onMouseMove={onMove}
      >
        <img
          key={slides[current].image}               // fuerza re-mount para animación
          src={slides[current].image}
          alt={slides[current].title}
          className="banner__image fade-in"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          }}
          draggable={false}
        />
      </div>

      <h2 className="banner__title">{slides[current].title}</h2>
      <p className="banner__text">{slides[current].text}</p>

      <div className="banner__dots">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`dot${i === current ? " active" : ""}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
    </aside>
  );
}
