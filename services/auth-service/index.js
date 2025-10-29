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
const PEP = RAW_PEP.trim().replace(/["']/g, '').replace(/[\r\n\t\u200B-\u200D\uFEFF]/g, '')
if (DEBUG_AUTH === '1') console.log('[auth] PEP(hex)=', Buffer.from(PEP, 'utf8').toString('hex'))

const sha256HexPeppered = (v) => crypto.createHash('sha256').update(PEP + v).digest('hex')
const extractPrefix = (license) => {
  const m = /^([A-Za-z]{2,6})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/i.exec(String(license).trim())
  return m ? m[1].toUpperCase() : null
}

async function spLoginAuditLock(conn, { prefix, licenseId, ok, reason, ip, ua }) {
  await conn.query('SET @o_locked := NULL, @o_until := NULL')
  await conn.query('CALL spLoginAuditLock(?,?,?,?,?,?,@o_locked,@o_until)', [
    prefix, licenseId || null, ok ? 1 : 0, reason, ip || null, ua || null
  ])
  const [rows] = await conn.query('SELECT @o_locked AS locked, @o_until AS until')
  const r = rows?.[0] || {}
  return { locked: Number(r.locked || 0), until: r.until || null }
}

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }))

app.post('/login', loginHandler)
app.post('/license/login', loginHandler)

async function loginHandler(req, res) {
  try {
    const { license } = req.body || {}
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })
    const prefix = extractPrefix(license)
    if (!prefix) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' })

    const canon = String(license).trim().toUpperCase()
    const licenseHash = sha256HexPeppered(canon).toLowerCase()
    if (DEBUG_AUTH === '1') console.log('[auth] /auth/login canon=', canon, 'hash=', licenseHash)

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate,
                (daExpiryDate < UTC_TIMESTAMP()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )

      const found = rows?.[0]
      let status = 'mismatch_or_not_found'
      let licId = null

      if (found && found.daClientPrefix === prefix) {
        licId = found.LicenseID
        if (found.daStatus !== 'active') status = found.daStatus
        else if (Boolean(found.isExpired)) {
          await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [found.LicenseID])
          status = 'expired'
        } else {
          status = 'ok'
        }
      }

      if (status === 'ok') {
        await spLoginAuditLock(conn, { prefix, licenseId: licId, ok: 1, reason: 'ok', ip: req.ip, ua: req.get('user-agent') })
        return res.json({ status: 'ok', prefix })
      } else {
        const audit = await spLoginAuditLock(conn, { prefix, licenseId: licId, ok: 0, reason: status, ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status, error: status })
      }
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
            (daExpiryDate < UTC_TIMESTAMP()) AS isExpired
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
    if (DEBUG_AUTH === '1') console.log('[auth] /reports/options license=', license)
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' })

    const licenseHash = sha256HexPeppered(license).toLowerCase()
    if (DEBUG_AUTH === '1') console.log('[auth] /reports/options hash=', licenseHash)

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix AS prefix, daStatus, daExpiryDate,
                daAllowAll, (daExpiryDate < UTC_TIMESTAMP()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )
      const lic = rows?.[0]
      if (!lic) {
        const audit = await spLoginAuditLock(conn, { prefix: null, licenseId: null, ok: 0, reason: 'mismatch_or_not_found', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'mismatch_or_not_found', error: 'mismatch_or_not_found' })
      }
      if (lic.daStatus !== 'active') {
        const audit = await spLoginAuditLock(conn, { prefix: lic.prefix, licenseId: lic.LicenseID, ok: 0, reason: lic.daStatus, ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: lic.daStatus, error: lic.daStatus })
      }
      if (lic.isExpired) {
        await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [lic.LicenseID])
        const audit = await spLoginAuditLock(conn, { prefix: lic.prefix, licenseId: lic.LicenseID, ok: 0, reason: 'expired', ip: req.ip, ua: req.get('user-agent') })
        if (audit.locked) return res.status(429).json({ status: 'rate-limited', error: 'rate-limited', until: audit.until })
        return res.status(401).json({ status: 'expired', error: 'expired' })
      }

      await spLoginAuditLock(conn, { prefix: lic.prefix, licenseId: lic.LicenseID, ok: 1, reason: 'ok', ip: req.ip, ua: req.get('user-agent') })

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
        url:  r.url,
        isDefault: !!r.isDefault
      }))
      const defaultReportCode = reports.find(r => r.isDefault)?.code || reports[0]?.code || null

      return res.json({
        status: 'ok',
        client:  { prefix: lic.prefix },
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

app.get('/reports/client-info', async (req, res) => {
  try {
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })

    const conn = await pool.getConnection()
    try {
      const [licRows] = await conn.query(
        `SELECT daClientName AS name,
                daStatus      AS status,
                COALESCE(daExpiryAt, daExpiryDate) AS expiryAt,
                (COALESCE(daExpiryAt, daExpiryDate) <= UTC_TIMESTAMP()) AS isExpired
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
        license: { status: lic.status, expiryAt: lic.expiryAt, isExpired: !!lic.isExpired, expiryDate: lic.expiryAt },
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


app.get('/reports/home', async (req, res) => {
  try {
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })
    const conn = await pool.getConnection()
    try {
      await conn.query('SET @o_status := NULL, @o_url := NULL, @o_code := NULL')
      await conn.query('CALL spResolveReport(?, ?, NULL, @o_status, @o_url, @o_code)', ['HOME', prefix])
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
    const prefix = String(req.query?.prefix || '').trim().toUpperCase()
    const { reportCode } = req.params
    if (!prefix) return res.status(400).json({ status: 'invalid-prefix', error: 'invalid-prefix' })
    const conn = await pool.getConnection()
    try {
      await conn.query('SET @o_status := NULL, @o_url := NULL, @o_code := NULL')
      await conn.query('CALL spResolveReport(?, ?, ?, @o_status, @o_url, @o_code)', ['BY_CODE', prefix, reportCode])
      const [rows] = await conn.query('SELECT @o_status AS status, @o_url AS url, @o_code AS reportCode')
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

if (DEBUG_AUTH === '1') {
  app.post('/__debug/hash', (req, res) => {
    const license = String(req.body?.license || '').trim().toUpperCase()
    const hash = sha256HexPeppered(license).toLowerCase()
    res.json({ canon: license, hash, pepHex: Buffer.from(PEP, 'utf8').toString('hex') })
  })
}

const { ASSISTANT_ID = '' } = process.env

app.post('/assist/thread', async (req, res) => {
  try {
    const lic = String(req.body?.license || '').trim().toUpperCase()
    if (!lic) return res.status(400).json({ error: 'missing-license' })

    const prefix = extractPrefix(lic)
    if (!prefix) return res.status(400).json({ error: 'invalid-license' })

    const canon = lic
    const licenseHash = sha256HexPeppered(canon).toLowerCase()

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix AS prefix, daClientName AS clientName,
                daStatus, (daExpiryDate < UTC_TIMESTAMP()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )
      const licRow = rows?.[0]
      if (!licRow || licRow.prefix !== prefix) return res.status(401).json({ error: 'mismatch_or_not_found' })
      if (licRow.daStatus !== 'active') return res.status(401).json({ error: licRow.daStatus })
      if (licRow.isExpired) {
        await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [licRow.LicenseID])
        return res.status(401).json({ error: 'expired' })
      }

      const [thrRows] = await conn.query(
        `SELECT ctThreadID AS threadId, ctAssistantID AS assistantId
           FROM daChatThread
          WHERE ctClientPrefix = ?
          LIMIT 1`, [prefix]
      )
      const existing = thrRows?.[0] || null

      return res.json({
        status: 'ok',
        prefix,
        clientName: licRow.clientName || prefix,
        threadId: existing?.threadId || null,
        assistantId: existing?.assistantId || ASSISTANT_ID || null
      })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ error: 'server-error' })
  }
})

app.post('/assist/thread/save', async (req, res) => {
  try {
    const lic = String(req.body?.license || '').trim().toUpperCase()
    const threadId = String(req.body?.threadId || '').trim()
    const assistantId = String(req.body?.assistantId || '').trim() || ASSISTANT_ID
    if (!lic || !threadId) return res.status(400).json({ error: 'missing-params' })

    const prefix = extractPrefix(lic)
    if (!prefix) return res.status(400).json({ error: 'invalid-license' })

    const canon = lic
    const licenseHash = sha256HexPeppered(canon).toLowerCase()

    const conn = await pool.getConnection()
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix AS prefix
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC
          LIMIT 1`,
        [licenseHash]
      )
      const licRow = rows?.[0]
      if (!licRow || licRow.prefix !== prefix) return res.status(401).json({ error: 'mismatch_or_not_found' })

      await conn.query(
        `INSERT INTO daChatThread (ctClientPrefix, ctLicenseID, ctThreadID, ctAssistantID)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ctLicenseID = VALUES(ctLicenseID),
           ctThreadID = VALUES(ctThreadID),
           ctAssistantID = VALUES(ctAssistantID)`,
        [prefix, licRow.LicenseID, threadId, assistantId || null]
      )
      return res.json({ status: 'ok' })
    } finally {
      conn.release()
    }
  } catch {
    return res.status(500).json({ error: 'server-error' })
  }
})

app.post('/licensing/issue', async (req, res) => {
  try {
    const op = 'ISSUE';
    const prefix     = String(req.body?.prefix || '').trim().toUpperCase();
    const clientName = String(req.body?.clientName || '').trim();
    const expiryAt   = String(req.body?.expiryAt || '').trim(); 
    const pipe       = String(req.body?.pipe || '').trim();    
    const allow      = String(req.body?.allow || '*').trim();

    if (!prefix || !clientName || !expiryAt || !pipe) {
      return res.status(400).json({ status: 'bad-request' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.query('SET @st := NULL, @lic := NULL, @id := NULL');
      await conn.query(
        'CALL spLicensingAdmin(?,?,?,?,?,?,?,?,?, @st,@lic,@id)',
        [op, prefix, clientName, expiryAt, pipe, allow, null, null, null]
      );
      const [rows] = await conn.query('SELECT @st AS st, @lic AS license, @id AS id');
      const out = rows?.[0] || {};
      const st  = String(out.st || '').toLowerCase();

      if (st && st !== 'ok') {
        return res.status(400).json({ status: st, license: out.license || null, id: out.id || null });
      }
      return res.json({ status: 'ok', license: out.license || null, id: out.id || null });
    } finally {
      conn.release();
    }
  } catch (e) {
    return res.status(500).json({ status: 'server-error' });
  }
});


app.post('/logout', (_req, res) => res.status(204).end())

const port = process.env.PORT ? Number(process.env.PORT) : 4001
app.listen(port, () => {
  console.log(`auth-service listening on :${port}`)
  if (DEBUG_AUTH === '1') {
    const out = []
    app._router.stack.forEach(l => {
      if (!l.route) return
      const methods = Object.keys(l.route.methods).filter(Boolean).join(',')
      out.push(`${methods.toUpperCase()} ${l.route.path}`)
    })
    console.log('[auth] routes:\n' + out.sort().map(s => '  ' + s).join('\n'))
  }
})
