import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "child_process";
import kill from "tree-kill";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const AUTH_PORT = Number(process.env.AUTH_PORT || 4001);
const FRONTEND = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  if (!FRONTEND.includes("http://localhost:5173")) FRONTEND.push("http://localhost:5173");
  if (!FRONTEND.includes("http://localhost:3000")) FRONTEND.push("http://localhost:3000");
}

const children = [];
function spawnSvc(name, cmd, args, env = {}, cwd) {
  const ch = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env }, cwd });
  children.push(ch);
  ch.on("exit", (code, sig) => console.error(`[${name}] exited (code=${code}, sig=${sig})`));
  return ch;
}

spawnSvc(
  "auth-service",
  "node",
  ["index.js"],
  { PORT: String(AUTH_PORT), HOST: "127.0.0.1" },
  path.join(__dirname, "../auth-service")
);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (!FRONTEND.length || FRONTEND.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
  credentials: true
}));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/auth", createProxyMiddleware({
  target: `http://127.0.0.1:${AUTH_PORT}`,
  changeOrigin: false,
  xfwd: true,
  pathRewrite: { "^/auth": "" },
  logLevel: "warn"
}));

app.use("/reports", createProxyMiddleware({
  target: `http://127.0.0.1:${AUTH_PORT}`,
  changeOrigin: false,
  xfwd: true,
  logLevel: "warn"
}));

app.use((_req, res) => res.status(404).json({ error: "not-found" }));

const server = app.listen(PORT, () =>
  console.log(`[gateway] listening on :${PORT} -> auth: 127.0.0.1:${AUTH_PORT}`)
);

function shutdown() {
  try { server.close(); } catch { }
  children.forEach(ch => { try { kill(ch.pid); } catch { } });
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
