import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function BackForwardGuard({ enabled = true }) {
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!enabled) return;

    const push = () => {
      window.history.pushState(null, "", loc.pathname + loc.search + loc.hash);
    };

    push();

    const onPop = () => {
      push();
      navigate(loc.pathname + loc.search + loc.hash, { replace: true });
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled, loc.pathname, loc.search, loc.hash, navigate]);

  return null;
}
