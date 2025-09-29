app.post('/auth/login', loginHandler);
app.post('/auth/license/login', loginHandler);

async function loginHandler(req, res) {
  try {
    const { license } = req.body || {};
    if (!license) return res.status(400).json({ status: 'missing-license', error: 'missing-license' });

    const prefix = extractPrefix(license);
    if (!prefix) return res.status(400).json({ status: 'invalid-license', error: 'invalid-license' });

    const licenseHash = sha256HexPeppered(license).toLowerCase();

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT LicenseID, daClientPrefix, daStatus, daExpiryDate,
                (daExpiryDate < CURDATE()) AS isExpired
           FROM daDashboard
          WHERE daLicenseHash = ?
          ORDER BY LicenseID DESC LIMIT 1`,
        [licenseHash]
      );

      const found = rows?.[0];
      let status = 'mismatch_or_not_found';

      if (found && found.daClientPrefix === prefix) {
        if (found.daStatus !== 'active') {
          status = found.daStatus;
        } else if (found.isExpired) {
          await conn.query('UPDATE daDashboard SET daStatus="expired" WHERE LicenseID=?', [found.LicenseID]);
          status = 'expired';
        } else {
          status = 'ok';
        }
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
          (req.headers['user-agent'] || '').toString().slice(0,255),
        ]
      );

      if (status === 'ok') return res.json({ status: 'ok', prefix });
      return res.status(401).json({ status, error: status });
    } finally {
      conn.release();
    }
  } catch (e) {
    return res.status(500).json({ status: 'server-error', error: 'server-error' });
  }
}
