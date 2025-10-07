import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import crypto from 'crypto'
import fs from 'fs'
import { createPool } from 'mysql2/promise'

const app = express()
app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const {
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB,
  AUTH_PEPPER, MYSQL_SSL_CA_PATH, MYSQL_SSL_REJECT_UNAUTHORIZED,
  DEBUG_AUTH,
} = process.env

const ssl = MYSQL_SSL_CA_PATH
  ? { ca: fs.readFileSync(MYSQL_SSL_CA_PATH), rejectUnauthorized: String(MYSQL_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' }
  : undefined

const pool = createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD || undefined,
  database: MYSQL_DB,
  connectionLimit: 8,
  namedPlaceholders: true,
  ...(ssl ? { ssl } : {}),
})

const RAW_PEP = AUTH_PEPPER || ''
const PEP = RAW_PEP.trim().replace(/["']/g, '').replace(/[\s\u200B-\u200D\uFEFF]/g, '')
if (DEBUG_AUTH === '1') console.log('[auth] PEP(hex) =', Buffer.from(PEP, 'utf8').toString('hex'))

const sha256HexPeppered = (v) => crypto.createHash('sha256').update(PEP + v).digest('hex')

const extractPrefix = (license) => {
  const m = /^([A-Za-z]{2,6})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/i.exec(String(license).trim())
  return m ? m[1].toUpperCase() : null
}

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }))

app.post('/login', loginHandler)
app.post('/license/login', loginHandler)

if (DEBUG_AUTH === '1') {
  app.post('/__debug/hash', (req, res) => {
    const license = String(req.body?.license || '').trim().toUpperCase()
    const hash = sha256HexPeppered(license).toLowerCase()
    res.json({ canon: license, hash, pepHex: Buffer.from(PEP, 'utf8').toString('hex') })
  })
}

async function loginHandler(req, res) {
  try {
    const { license } = req.body || {}
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })
    const prefix = extractPrefix(license)
    if (!prefix) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' })

    const canon = String(license).trim().toUpperCase()
    const licenseHash = sha256HexPeppered(canon).toLowerCase()
    if (DEBUG_AUTH === '1') console.log('[auth] login canon=', canon, ' hash=', licenseHash)

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate,
                (daExpiryDate < CURDATE()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )

      const found = rows?.[0]
      let status = 'mismatch_or_not_found'

      if (found && found.daClientPrefix === prefix) {
        if (found.daStatus !== 'active') status = found.daStatus
        else if (Boolean(found.isExpired)) {
          await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [found.LicenseID])
          status = 'expired'
        } else {
          status = 'ok'
        }
      }

      const xff = (req.headers['x-forwarded-for'] || '').toString()
      const ip = (xff.split(',')[0] || req.socket.remoteAddress || '').toString().slice(0, 45)
      const ua = (req.headers['user-agent'] || '').toString().slice(0, 255)

      await conn.query(
        `INSERT INTO daLogin (loLicensePrefix, LicenseID, loStatus, loReason, loIpAddress, loUserAgent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [prefix, found?.LicenseID || null, status === 'ok' ? 'success' : 'failed', status, ip, ua]
      )

      if (DEBUG_AUTH === '1') console.log('[auth] result:', { status, found: found && { LicenseID: found.LicenseID, daClientPrefix: found.daClientPrefix, daStatus: found.daStatus, daExpiryDate: found.daExpiryDate } })

      if (status === 'ok') return res.json({ status: 'ok', prefix })
      return res.status(401).json({ status, error: status })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
}

async function reportsHomeHandler(req, res) {
  try {
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
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
}

async function reportCodeHandler(req, res) {
  try {
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
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
}

async function clientInfoHandler(req, res) {
  try {
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })

    const conn = await pool.getConnection()
    try {
      const [licRows] = await conn.query(
        `SELECT daClientName AS name, daStatus AS status, daExpiryDate AS expiryDate
           FROM daDashboard
          WHERE daClientPrefix = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [prefix]
      )
      const lic = licRows?.[0] || null

      const [repRows] = await conn.query(
        `SELECT c.crReportCode AS code,
                IFNULL(c.crReportName, IFNULL(r.daReportName, c.crReportCode)) AS name,
                c.crIsDefault AS isDefault,
                c.crIsActive  AS isActive,
                c.crEmbedUrl  AS url
           FROM daClientReport c
      LEFT JOIN daReportCatalog r ON r.daReportCode = c.crReportCode
          WHERE c.crClientPrefix = ?
            AND c.crIsActive = 1
          ORDER BY c.crIsDefault DESC, name`,
        [prefix]
      )

      const reports = (repRows || []).map(r => ({
        code: r.code,
        name: r.name,
        isDefault: !!r.isDefault,
        url: r.url,
      }))
      const defaultReportCode = reports.find(r => r.isDefault)?.code || null

      if (!lic) return res.status(404).json({ status: 'not_found', error: 'not_found' })

      return res.json({
        status: 'ok',
        client: { prefix, name: lic.name || prefix },
        license: { status: lic.status, expiryDate: lic.expiryDate },
        defaultReportCode,
        reports
      })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
}

async function resolveLicense(conn, canonHashLower) {
  const [rows] = await conn.query(
    `SELECT LicenseID, daClientPrefix AS prefix, daStatus, daExpiryDate,
            (daExpiryDate < CURDATE()) AS isExpired
       FROM daDashboard
      WHERE daLicenseHash = ?
      ORDER BY LicenseID DESC
      LIMIT 1`,
    [canonHashLower]
  )
  return rows?.[0] || null
}

app.post('/reports/options', async (req, res) => {
  try {
    const license = String(req.body?.license || '').trim().toUpperCase()
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })

    const licenseHash = sha256HexPeppered(license).toLowerCase()
    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix AS prefix, daStatus, daExpiryDate,
                daAllowAll, (daExpiryDate < CURDATE()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )
      const lic = rows?.[0]
      if (!lic) return res.status(401).json({ status: 'mismatch_or_not_found', error: 'mismatch_or_not_found' })
      if (lic.daStatus !== 'active') return res.status(401).json({ status: lic.daStatus, error: lic.daStatus })
      if (lic.isExpired) {
        await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [lic.LicenseID])
        return res.status(401).json({ status: 'expired', error: 'expired' })
      }

      let repRows
      if (lic.daAllowAll) {
        ;[repRows] = await conn.query(
          `SELECT c.crReportCode AS code,
                  COALESCE(c.crReportName, r.daReportName, c.crReportCode) AS name,
                  c.crIsDefault AS isDefault,
                  c.crEmbedUrl  AS url
             FROM daClientReport c
        LEFT JOIN daReportCatalog r ON r.daReportCode = c.crReportCode
            WHERE c.crClientPrefix = ?
              AND c.crIsActive = 1
            ORDER BY c.crIsDefault DESC, name`,
          [lic.prefix]
        )
      } else {
        ;[repRows] = await conn.query(
          `SELECT c.crReportCode AS code,
                  COALESCE(c.crReportName, r.daReportName, c.crReportCode) AS name,
                  c.crIsDefault AS isDefault,
                  c.crEmbedUrl  AS url
             FROM daLicenseReport lr
             JOIN daClientReport  c
               ON c.crClientPrefix = ?
              AND c.crReportCode   = lr.lrReportCode
              AND c.crIsActive     = 1
        LEFT JOIN daReportCatalog r ON r.daReportCode = c.crReportCode
            WHERE lr.LicenseID     = ?
            ORDER BY c.crIsDefault DESC, name`,
          [lic.prefix, lic.LicenseID]
        )
      }

      const reports = (repRows || []).map(r => ({
        code: r.code,
        name: r.name,
        url: r.url,
        isDefault: !!r.isDefault
      }))
      const defaultReportCode = reports.find(r => r.isDefault)?.code || reports[0]?.code || null

      return res.json({
        status: 'ok',
        client: { prefix: lic.prefix },
        license: { status: lic.daStatus, expiryDate: lic.daExpiryDate, allowAll: !!lic.daAllowAll },
        defaultReportCode,
        reports
      })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ status: 'server-error', error: 'server-error' })
  }
})

app.post('/reports/home', async (req, res) => {
  try {
    const license = String(req.body?.license || '').trim()
    const conn = await pool.getConnection()
    try {
      if (license) {
        const canon = license.toUpperCase()
        const hash  = sha256HexPeppered(canon).toLowerCase()
        const lic   = await resolveLicense(conn, hash)
        if (!lic) return res.status(401).json({ status: 'mismatch_or_not_found', error: 'mismatch_or_not_found' })
        if (lic.daStatus !== 'active') return res.status(401).json({ status: lic.daStatus, error: lic.daStatus })
        if (lic.isExpired) {
          await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [lic.LicenseID])
          return res.status(401).json({ status: 'expired', error: 'expired' })
        }

        const [flag] = await conn.query(`SELECT daAllowAll FROM daDashboard WHERE LicenseID=? LIMIT 1`, [lic.LicenseID])
        const allowAll = !!(flag?.[0]?.daAllowAll)

        if (allowAll) {
          const [rows] = await conn.query(
            `SELECT c.crEmbedUrl AS url, c.crReportCode AS reportCode
               FROM daClientReport c
              WHERE c.crClientPrefix = ?
                AND c.crIsActive     = 1
              ORDER BY c.crIsDefault DESC, c.crUpdatedAt DESC
              LIMIT 1`,
            [lic.prefix]
          )
          const r = rows?.[0] || {}
          if (r.url) return res.json({ status: 'ok', url: r.url, reportCode: r.reportCode })
          return res.status(400).json({ status: 'no_default', error: 'no_default' })
        } else {
          const [rows] = await conn.query(
            `SELECT c.crEmbedUrl AS url, c.crReportCode AS reportCode
               FROM daLicenseReport lr
               JOIN daClientReport  c
                 ON c.crClientPrefix = ?
                AND c.crReportCode   = lr.lrReportCode
                AND c.crIsActive     = 1
              WHERE lr.LicenseID     = ?
              ORDER BY c.crIsDefault DESC, c.crUpdatedAt DESC
              LIMIT 1`,
            [lic.prefix, lic.LicenseID]
          )
          const r = rows?.[0] || {}
          if (r.url) return res.json({ status: 'ok', url: r.url, reportCode: r.reportCode })
          return res.status(400).json({ status: 'no_default', error: 'no_default' })
        }
      }

      const prefix = String(req.query?.prefix || '').trim().toUpperCase()
      if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })
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

app.post('/options',        app._router.stack.find(l => l.route && l.route.path==='/reports/options').route.stack[0].handle);
app.post('/home',           app._router.stack.find(l => l.route && l.route.path==='/reports/home').route.stack[0].handle);
app.get ('/client-info',    app._router.stack.find(l => l.route && l.route.path==='/reports/client-info').route.stack[0].handle);


app.post('/reports/options',   );
app.post('/reports/home',      );
app.get ('/reports/client-info',);


const port = process.env.PORT ? Number(process.env.PORT) : 4001
app.listen(port, () => { console.log(`auth-service listening on :${port}`) })
