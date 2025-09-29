import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import crypto from 'crypto'
import { createPool } from 'mysql2/promise'

const app = express()
app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, PEPPER } = process.env

const pool = createPool({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASS || undefined,
  database: DB_NAME,
  connectionLimit: 8,
  namedPlaceholders: true
})

function sha256HexPeppered(v) {
  return crypto.createHash('sha256').update((PEPPER || '') + v).digest('hex')
}

function extractPrefix(license) {
  const m = /^([A-Za-z]{2,6})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/i.exec(license.trim())
  return m ? m[1].toUpperCase() : null
}

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }))

app.post('/auth/login', loginHandler)
app.post('/auth/license/login', loginHandler)

async function loginHandler(req, res) {
  try {
    const { license } = req.body || {}
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })
    const prefix = extractPrefix(license)
    if (!prefix) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' })
    const licenseHash = sha256HexPeppered(license).toLowerCase()
    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate,
                (daExpiryDate < CURDATE()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC LIMIT 1`,
        [licenseHash]
      )
      const found = rows?.[0]
      let status = 'mismatch_or_not_found'
      if (found && found.daClientPrefix === prefix) {
        if (found.daStatus !== 'active') status = found.daStatus
        else if (found.isExpired) { await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [found.LicenseID]); status = 'expired' }
        else status = 'ok'
      }
      await conn.query(
        `INSERT INTO daLogin (loLicensePrefix, LicenseID, loStatus, loReason, loIpAddress, loUserAgent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          prefix,
          found?.LicenseID || null,
          status === 'ok' ? 'success' : 'failed',
          status,
          (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0,45),
          (req.headers['user-agent'] || '').toString().slice(0,255)
        ]
      )
      if (status === 'ok') return res.json({ status: 'ok', prefix })
      return res.status(401).json({ status, error: status })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
}

app.get('/reports/home', async (req, res) => {
  try {
    const { prefix } = req.query
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })
    const conn = await pool.getConnection()
    try {
      await conn.query('SET @o_status := NULL, @o_url := NULL, @o_code := NULL')
      await conn.query('CALL sp_daSelectHomeLink(?, @o_status, @o_url, @o_code)', [prefix])
      const [rows] = await conn.query('SELECT @o_status AS status, @o_url AS url, @o_code AS reportCode')
      const r = rows?.[0] || {}
      if (r.status === 'ok') return res.json({ status: 'ok', url: r.url, reportCode: r.reportCode })
      return res.status(400).json({ status: r.status || 'error', error: r.status || 'error' })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
})

app.get('/reports/:reportCode', async (req, res) => {
  try {
    const { prefix } = req.query
    const { reportCode } = req.params
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })
    const conn = await pool.getConnection()
    try {
      await conn.query('SET @o_status := NULL, @o_url := NULL')
      await conn.query('CALL sp_daSelectLinkFor(?, ?, @o_status, @o_url)', [prefix, reportCode])
      const [rows] = await conn.query('SELECT @o_status AS status, @o_url AS url')
      const r = rows?.[0] || {}
      if (r.status === 'ok') return res.json({ status: 'ok', url: r.url })
      return res.status(400).json({ status: r.status || 'error', error: r.status || 'error' })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
})

const port = process.env.PORT ? Number(process.env.PORT) : 4001
app.listen(port, () => { console.log(`auth-service listening on :${port}`) })
