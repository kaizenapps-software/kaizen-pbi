import express from "express"
import cors from "cors"
import helmet from "helmet"
import { createProxyMiddleware } from "http-proxy-middleware"
import { spawn } from "child_process"
import kill from "tree-kill"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000
const AUTH_PORT = process.env.AUTH_PORT || 4001
const EDGE_PORT = process.env.EDGE_PORT || 4002
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || true

const children = []

function spawnSvc(name, cmd, args, env = {}, cwd) {
  const child = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env }, cwd })
  children.push(child)
  child.on("exit", (code, signal) => console.error(`[${name}] exited (code=${code}, signal=${signal})`))
  return child
}

spawnSvc("auth-service", "node", ["index.js"], { PORT: AUTH_PORT, HOST: "127.0.0.1" }, path.join(__dirname, "auth-service"))
spawnSvc("edge-api", "node", ["index.js"], { PORT: EDGE_PORT, HOST: "127.0.0.1" }, path.join(__dirname, "edge-api"))

const app = express()
app.disable("x-powered-by")
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())

app.get("/healthz", (_req, res) => res.json({ ok: true }))

app.use("/auth", createProxyMiddleware({
  target: `http://127.0.0.1:${AUTH_PORT}`,
  changeOrigin: true,
  xfwd: true
}))

app.use("/reports", createProxyMiddleware({
  target: `http://127.0.0.1:${AUTH_PORT}`,
  changeOrigin: true,
  xfwd: true
}))

app.use("/api", createProxyMiddleware({
  target: `http://127.0.0.1:${EDGE_PORT}`,
  changeOrigin: true,
  xfwd: true
}))

app.use((_req, res) => res.status(404).json({ error: "not-found" }))

const server = app.listen(PORT, () =>
  console.log(`[gateway] listening on :${PORT} (auth:${AUTH_PORT}, api:${EDGE_PORT})`)
)

function shutdown() {
  try { server.close() } catch {}
  children.forEach(ch => { try { kill(ch.pid) } catch {} })
  setTimeout(() => process.exit(0), 500)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
