import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import crypto from 'node:crypto'
import mysql from 'mysql2/promise'
import fs from 'node:fs'

const app = express()
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL || 10),
  ssl: process.env.MYSQL_SSL_CA_PATH
    ? {
        ca: fs.readFileSync(process.env.MYSQL_SSL_CA_PATH, 'utf8'),
        rejectUnauthorized: String(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || 'true') === 'true'
      }
    : undefined
})

const LICENSE_RE = /^([A-Za-z]{2,6})-([A-F0-9]{4}-){3}[A-F0-9]{4}$/i

function normalizePepper(s) {
  if (!s) return ''
  return String(s).trim().replace(/["']/g, '').replace(/\r|\n|\t/g, '').replace(/\u200B/g, '')
}
function canonLicense(raw) {
  if (!raw) return null
  const up = String(raw).toUpperCase().trim()
  if (!LICENSE_RE.test(up)) return null
  return up
}
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}
function licenseHash(canon, pepperEnv) {
  const pep = normalizePepper(pepperEnv || '')
  return sha256Hex(pep + canon).toLowerCase()
}

async function callSpWithOut(conn, callSql, inParams, outMap) {
  const assigns = Object.values(outMap).map(v => `SET ${v}=NULL`).join('; ')
  await conn.query(assigns || 'SELECT 1')
  await conn.query(callSql, inParams)
  const [rows] = await conn.query(
    `SELECT ${Object.entries(outMap).map(([k, v]) => `${v} AS ${k}`).join(', ')}`
  )
  return rows[0] || {}
}
async function spLoginAuditLock(conn, { prefix, licenseId, ok, reason, ip, ua }) {
  const res = await callSpWithOut(
    conn,
    'CALL spLoginAuditLock(?,?,?,?,?,?,@o_locked,@o_until)',
    [prefix, licenseId || null, ok ? 1 : 0, reason, ip || null, ua || null],
    { locked: '@o_locked', until: '@o_until' }
  )
  return { locked: Number(res.locked || 0), until: res.until }
}
async function spResolveReport(conn, { mode, prefix, reportCode }) {
  const res = await callSpWithOut(
    conn,
    'CALL spResolveReport(?,?,?,@o_status,@o_url,@o_report)',
    [mode, prefix, reportCode || null],
    { status: '@o_status', url: '@o_url', report: '@o_report' }
  )
  return res
}

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.post(['/login', '/license/login'], async (req, res) => {
  try {
    const { license } = req.body || {}
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })
    const canon = canonLicense(license)
    if (!canon) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' })
    const prefix = canon.match(LICENSE_RE)[1].toUpperCase()
    const hash = licenseHash(canon, process.env.AUTH_PEPPER)

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        'SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate FROM daDashboard WHERE daLicenseHash=? LIMIT 1',
        [hash]
      )
      const row = rows[0]
      if (!row || row.daClientPrefix !== prefix) {
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: null, ok: 0, reason: 'mismatch_or_not_found', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'mismatch_or_not_found', error: 'mismatch_or_not_found' })
      }
      if (row.daStatus !== 'active') {
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 0, reason: row.daStatus, ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: row.daStatus, error: row.daStatus })
      }
      const today = new Date(); today.setHours(0,0,0,0)
      const exp = new Date(row.daExpiryDate)
      if (exp < today) {
        await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [row.LicenseID])
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 0, reason: 'expired', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'expired', error: 'expired' })
      }
      await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 1, reason: 'ok', ip: req.ip, ua: req.get('user-agent') })
      return res.json({ status: 'ok', prefix })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
})

app.get('/reports/home', async (req, res) => {
  const prefix = String(req.query.prefix || '').toUpperCase().trim()
  if (!prefix) return res.status(400).json({ status: 'missing-prefix', error: 'missing-prefix' })
  const conn = await pool.getConnection()
  try {
    const out = await spResolveReport(conn, { mode: 'HOME', prefix })
    if (out.status === 'ok') return res.json({ status: 'ok', url: out.url, reportCode: out.report })
    return res.status(400).json({ status: out.status, error: out.status })
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  } finally {
    conn.release()
  }
})

app.get('/reports/:reportCode', async (req, res) => {
  const prefix = String(req.query.prefix || '').toUpperCase().trim()
  const reportCode = String(req.params.reportCode || '').trim()
  if (!prefix || !reportCode) return res.status(400).json({ status: 'missing-params', error: 'missing-params' })
  const conn = await pool.getConnection()
  try {
    const out = await spResolveReport(conn, { mode: 'BY_CODE', prefix, reportCode })
    if (out.status === 'ok') return res.json({ status: 'ok', url: out.url })
    return res.status(400).json({ status: out.status, error: out.status })
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  } finally {
    conn.release()
  }
})

app.post('/reports/options', async (req, res) => {
  try {
    const { license } = req.body || {}
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })
    const canon = canonLicense(license)
    if (!canon) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' })
    const prefix = canon.match(LICENSE_RE)[1].toUpperCase()
    const hash = licenseHash(canon, process.env.AUTH_PEPPER)

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        'SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate, daAllowAll FROM daDashboard WHERE daLicenseHash=? LIMIT 1',
        [hash]
      )
      const row = rows[0]
      if (!row || row.daClientPrefix !== prefix) {
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: null, ok: 0, reason: 'mismatch_or_not_found', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'mismatch_or_not_found', error: 'mismatch_or_not_found' })
      }
      if (row.daStatus !== 'active') {
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 0, reason: row.daStatus, ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: row.daStatus, error: row.daStatus })
      }
      const today = new Date(); today.setHours(0,0,0,0)
      const exp = new Date(row.daExpiryDate)
      if (exp < today) {
        await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [row.LicenseID])
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 0, reason: 'expired', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'expired', error: 'expired' })
      }
      await spLoginAuditLock(conn, { prefix, licenseId: row.LicenseID, ok: 1, reason: 'ok', ip: req.ip, ua: req.get('user-agent') })
      let reports = []
      if (row.daAllowAll) {
        const [r] = await conn.query(
          `SELECT crReportCode AS code,
                  COALESCE(NULLIF(crReportName,''), crReportCode) AS name,
                  crEmbedUrl AS url,
                  crIsDefault AS isDefault
           FROM daClientReport
           WHERE crClientPrefix=? AND crIsActive=1
           ORDER BY crReportCode`, [prefix]
        )
        reports = r
      } else {
        const [r] = await conn.query(
          `SELECT c.crReportCode AS code,
                  COALESCE(NULLIF(c.crReportName,''), c.crReportCode) AS name,
                  c.crEmbedUrl AS url,
                  c.crIsDefault AS isDefault
           FROM daLicenseReport lr
           JOIN daClientReport c
             ON c.crReportCode=lr.lrReportCode
            AND c.crClientPrefix=?
            AND c.crIsActive=1
           WHERE lr.LicenseID=?
           ORDER BY c.crReportCode`, [prefix, row.LicenseID]
        )
        reports = r
      }
      const def = reports.find(x => x.isDefault === 1) || null
      return res.json({
        status: 'ok',
        client: { prefix },
        license: { status: 'active', expiryDate: row.daExpiryDate, allowAll: !!row.daAllowAll },
        defaultReportCode: def ? def.code : null,
        reports
      })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
})

app.post('/__debug/hash', (req, res) => {
  if (String(process.env.DEBUG_AUTH || '0') !== '1') return res.status(404).json({ error: 'not-found' })
  const { license } = req.body || {}
  const canon = canonLicense(license)
  if (!canon) return res.status(400).json({ error: 'invalid-license' })
  const pep = normalizePepper(process.env.AUTH_PEPPER || '')
  const hash = licenseHash(canon, process.env.AUTH_PEPPER)
  return res.json({ canon, hash, pepHex: Buffer.from(pep, 'utf8').toString('hex') })
})

const port = Number(process.env.PORT || 4001)
app.listen(port, () => {})
