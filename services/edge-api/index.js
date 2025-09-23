import "dotenv/config"
import express from "express"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import cors from "cors"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"
import morgan from "morgan"

const {
  PORT = 3001,
  CORS_ORIGIN,
  AUTH_SERVICE_URL,
  EDGE_HMAC_SECRET,
  JWT_COOKIE_DOMAIN,
  JWT_COOKIE_SECURE = "true",
  JWT_VERIFY_SECRET,
  NODE_ENV,
} = process.env

const app = express()

// Evita el error de express-rate-limit (no uses "true" sin criterio)
app.set("trust proxy", "loopback")

app.disable("x-powered-by")
app.use(helmet())
app.use(morgan("tiny"))
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: "64kb" }))
app.use(cookieParser())

console.log("[edge] AUTH_SERVICE_URL =", AUTH_SERVICE_URL)

// Rate limit solo en /auth
const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/auth/", limiter)

const NAME_AT = (NODE_ENV === "production" && JWT_COOKIE_SECURE === "true") ? "__Host-kaizen_at" : "kaizen_at"
const NAME_RT = (NODE_ENV === "production" && JWT_COOKIE_SECURE === "true") ? "__Host-kaizen_rt" : "kaizen_rt"

const sign = body =>
  crypto.createHmac("sha256", EDGE_HMAC_SECRET).update(JSON.stringify(body)).digest("hex")

const cookieOpts = ttlSec => ({
  httpOnly: true,
  secure: JWT_COOKIE_SECURE === "true",
  sameSite: "strict",
  path: "/",
  domain: JWT_COOKIE_DOMAIN || undefined,
  maxAge: ttlSec * 1000,
})
const setCookie = (res, name, value, ttlSec) => res.cookie(name, value, cookieOpts(ttlSec))

/** Login: robusto ante respuestas HTML del auth */
app.post("/auth/license/login", async (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim()
    const userAgent = req.headers["user-agent"] || ""
    const body = { license: String(req.body.license || ""), meta: { clientIp, userAgent, edgeRequestId: crypto.randomUUID() } }

    const r = await fetch(`${AUTH_SERVICE_URL}/internal/auth/license/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hmac-sign": sign(body) },
      body: JSON.stringify(body),
    })

    const raw = await r.text()
    let json
    try {
      json = JSON.parse(raw)
    } catch {
      console.error("[edge] auth raw response (first 400 chars):\n", raw.slice(0, 400))
      return res.status(502).json({ error: "bad-auth-response" })
    }

    if (!r.ok || !json.ok) return res.status(r.status).json(json)

    const { tokens, accessTtl = "900", refreshTtl = "2592000" } = json
    setCookie(res, NAME_AT, tokens.accessToken, Number(accessTtl))
    setCookie(res, NAME_RT, tokens.refreshToken, Number(refreshTtl))
    res.status(204).send()
  } catch (e) {
    console.error("edge login error", e)
    res.status(500).json({ error: "server-error" })
  }
})

/** Estado de sesión */
app.get("/auth/me", async (req, res) => {
  const at = req.cookies?.[NAME_AT]
  const rt = req.cookies?.[NAME_RT]
  const now = Math.floor(Date.now() / 1000)

  if (at) {
    try {
      const d = jwt.verify(at, JWT_VERIFY_SECRET)
      if (d.exp > now) return res.json({ ok: true, user: { id: d.sub, tenantId: d.tenantId } })
    } catch {}
  }

  if (!rt) return res.status(401).json({ error: "no-session" })

  try {
    const body = { refreshToken: rt }
    const r = await fetch(`${AUTH_SERVICE_URL}/internal/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hmac-sign": sign(body) },
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok || !json.ok) return res.status(401).json({ error: "refresh-failed" })

    const { tokens } = json
    setCookie(res, NAME_AT, tokens.accessToken, 60 * 15)
    setCookie(res, NAME_RT, tokens.refreshToken, 60 * 60 * 24 * 30)
    const d = jwt.verify(tokens.accessToken, JWT_VERIFY_SECRET)
    res.json({ ok: true, user: { id: d.sub, tenantId: d.tenantId } })
  } catch {
    res.status(401).json({ error: "refresh-failed" })
  }
})

/** Logout */
app.post("/auth/logout", (req, res) => {
  res.clearCookie(NAME_AT, { path: "/" })
  res.clearCookie(NAME_RT, { path: "/" })
  res.status(204).send()
})

app.listen(PORT, () => console.log("edge-api on", PORT))
