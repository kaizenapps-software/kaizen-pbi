import "dotenv/config"
import express from "express"
import helmet from "helmet"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"
import fs from "fs"
import path from "path"

const app = express()
app.disable("x-powered-by")
app.use(helmet())
app.use(express.json({ limit: "64kb" }))

const {
  PORT = 8081,
  MYSQL_HOST,
  MYSQL_PORT = 3306,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DB,
  MYSQL_SSL_CA_PATH,             
  MYSQL_SSL_CA_BASE64,            
  MYSQL_SSL_REJECT_UNAUTHORIZED = "true",
  AUTH_PEPPER = "",
  JWT_SECRET = "",
  JWT_ACCESS_TTL = "15m",
  JWT_REFRESH_TTL = "30d",
  EDGE_HMAC_SECRET = "",
} = process.env

function buildSslConfig() {
  const cfg = {
    minVersion: "TLSv1.2",
    rejectUnauthorized: MYSQL_SSL_REJECT_UNAUTHORIZED === "true",
  }

  if ((MYSQL_SSL_CA_BASE64 ?? "").trim()) {
    cfg.ca = Buffer.from(MYSQL_SSL_CA_BASE64.trim(), "base64").toString("utf8")
    return cfg
  }

  const p = (MYSQL_SSL_CA_PATH ?? "./certs/server-ca.pem").trim()
  const abs = path.resolve(p)
  if (fs.existsSync(abs)) {
    cfg.ca = fs.readFileSync(abs, "utf8")
  }
  return cfg
}

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DB,
  connectionLimit: 5,
  ssl: buildSslConfig(),
  connectTimeout: 10_000,
})

pool.query("SELECT 1").then(() => {
  console.log("[auth] DB ok", {
    host: MYSQL_HOST,
    user: MYSQL_USER,
    pwdLen: (MYSQL_PASSWORD || "").length,
  })
}).catch(e => {
  console.error("[auth] DB fail:", e.code, e.message, {
    host: MYSQL_HOST,
    user: MYSQL_USER,
    pwdLen: (MYSQL_PASSWORD || "").length,
  })
})


const normalize = s => s.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
const sha256hex = s => crypto.createHash("sha256").update(s).digest("hex")
const safeEqHex = (a, b) => {
  try { return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")) }
  catch { return a === b }
}
const hmacOk = (body, sig) => safeEqHex(
  crypto.createHmac("sha256", EDGE_HMAC_SECRET).update(JSON.stringify(body)).digest("hex"),
  (sig || "")
)
const signTokens = payload => ({
  accessToken:  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL }),
  refreshToken: jwt.sign({ type: "refresh", ...payload }, JWT_SECRET, { expiresIn: JWT_REFRESH_TTL }),
})

/** Logger de requests para depurar */
app.use((req, _res, next) => {
  console.log("[auth] req", req.method, req.url, req.headers["content-type"])
  next()
})

/** Healthcheck */
app.get("/health", (_req, res) => res.type("text").send("ok"))

/** Guardado de auditoría */
async function auditLogin({ success, reason, dbid = null, licenseId = null, tenantId = null, ip = "", ua = "", edgeId = "" }) {
  try {
    const ipHashHex = ip ? sha256hex(ip) : null
    const uaHashHex = ua ? sha256hex(ua) : null
    const lastOctet = /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? Number(ip.split(".").pop()) : null
    await pool.query(`
      INSERT INTO daLogin
        (LoginAuditID, DatabaseID, LicenseID, TenantID, laSuccess, laReason, laIpHash, laIpLastOctet, laUserAgentHash, laEdgeRequestId)
      VALUES
        (UUID(), ?, ?, ?, ?, ?, ${ipHashHex ? "UNHEX(?)" : "?"}, ?, ${uaHashHex ? "UNHEX(?)" : "?"}, ?)
    `, [dbid, licenseId, tenantId, success ? 1 : 0, reason, ipHashHex, lastOctet, uaHashHex, edgeId])
  } catch (e) {
    console.error("[auth] audit error", e)
  }
}

/** Login por licencia */
app.post("/internal/auth/license/login", async (req, res) => {
  console.log("[auth] hit /internal/auth/license/login body=", req.body)
  const meta = (req.body && req.body.meta) || {}
  try {
    if (!hmacOk(req.body, req.headers["x-hmac-sign"])) {
      await auditLogin({ success: false, reason: "invalid-signature", ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })
      return res.status(401).json({ error: "invalid-signature" })
    }

    const { license } = req.body || {}
    if (!license || typeof license !== "string") {
      await auditLogin({ success: false, reason: "missing-license", ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })
      return res.status(400).json({ error: "missing-license" })
    }

    const normalized = normalize(license)
    const licenseHashHex = sha256hex((AUTH_PEPPER || "") + normalized).toUpperCase()

    // Tablas/columnas nuevas
    const [rows] = await pool.query(`
      SELECT
        LicenseID  AS id,
        DatabaseID AS dbid,
        TenantID   AS tenantId,
        (lcActive+0) AS active,         -- BIT(1) -> INT
        lcExpiresAt   AS expiresAt
      FROM daDashboard
      WHERE lcLicenseHash = UNHEX(?)
      LIMIT 1
    `, [licenseHashHex])

    if (!rows.length) {
      await auditLogin({ success: false, reason: "invalid-license", ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })
      return res.status(401).json({ error: "invalid-license" })
    }

    const row = rows[0]
    if (row.active !== 1) {
      await auditLogin({ success: false, reason: "license-inactive", dbid: row.dbid, licenseId: row.id, tenantId: row.tenantId, ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })
      return res.status(403).json({ error: "license-not-active" })
    }
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      await auditLogin({ success: false, reason: "license-expired", dbid: row.dbid, licenseId: row.id, tenantId: row.tenantId, ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })
      return res.status(403).json({ error: "license-expired" })
    }

    // touch
    pool.query(`UPDATE daDashboard SET lcLastUsedAt = NOW() WHERE LicenseID = ?`, [row.id]).catch(() => {})

    const payload = { sub: String(row.id), tenantId: row.tenantId, scope: ["dash:view"] }
    const tokens = signTokens(payload)

    await auditLogin({ success: true, reason: "ok", dbid: row.dbid, licenseId: row.id, tenantId: row.tenantId, ip: meta.clientIp, ua: meta.userAgent, edgeId: meta.edgeRequestId })

    res.json({ ok: true, claims: payload, tokens, accessTtl: "900", refreshTtl: "2592000" })
  } catch (e) {
    console.error("[auth] login error", e)
    await auditLogin({
      success: false,
      reason: "server-error",
      ip: (req.body?.meta?.clientIp || ""),
      ua: (req.body?.meta?.userAgent || ""),
      edgeId: (req.body?.meta?.edgeRequestId || "")
    })
    res.status(500).json({ error: "server-error" })
  }
})

/** Refresh */
app.post("/internal/auth/refresh", (req, res) => {
  try {
    if (!hmacOk(req.body, req.headers["x-hmac-sign"])) return res.status(401).json({ error: "invalid-signature" })
    const { refreshToken } = req.body || {}
    const d = jwt.verify(refreshToken, JWT_SECRET)
    if (d.type !== "refresh") return res.status(401).json({ error: "invalid-token" })
    const payload = { sub: d.sub, tenantId: d.tenantId, scope: d.scope }
    const tokens = signTokens(payload)
    res.json({ ok: true, claims: payload, tokens })
  } catch {
    res.status(401).json({ error: "refresh-failed" })
  }
})

/** Start HTTP (loopback IPv4) */
const HOST = "127.0.0.1"
app.listen(PORT, HOST, () => {
  console.log(`[auth] http listening on http://${HOST}:${PORT}`)
}).on("error", err => {
  console.error("[auth] listen error", err)
})
