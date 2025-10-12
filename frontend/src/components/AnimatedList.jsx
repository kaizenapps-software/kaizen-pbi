import { useAutoAnimate } from "@formkit/auto-animate/react";

export default function AnimatedList({ items = [] }) {
  const [parent] = useAutoAnimate({ duration: 180 });
  return (
    <ul ref={parent} className="space-y-2">
      {items.map(r => <li key={r.id} className="card">{r.name}</li>)}
    </ul>
  );
}
