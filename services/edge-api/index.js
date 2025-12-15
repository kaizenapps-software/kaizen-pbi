import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  PORT = '4002',
  CORS_ORIGIN = '',
  AUTH_SERVICE_URL = 'http://127.0.0.1:4001',
} = process.env;

const app = express();

// Response compression (must be early in middleware chain)
app.use(compression({
  level: 6,           // Balance between speed and compression ratio
  threshold: 1024,    // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Parse JSON request bodies
app.use(express.json());

app.disable('x-powered-by');
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Vite dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://app.powerbi.com"],
      frameSrc: ["https://app.powerbi.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use(morgan('tiny'));

const allowList = CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
// Only allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  if (!allowList.includes('http://localhost:5173')) allowList.push('http://localhost:5173');
  if (!allowList.includes('http://localhost:3000')) allowList.push('http://localhost:3000');
}
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowList.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
}));

app.use('/auth', rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Rate limiting for reports endpoints
app.use('/reports', rateLimit({
  windowMs: 60_000,
  max: 30, // More restrictive for data endpoints
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  xfwd: true,
  changeOrigin: false,
  pathRewrite: { '^/auth': '' },
  logLevel: 'warn',
}));

const reportsProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  xfwd: true,
  changeOrigin: false,
  logLevel: 'debug',
  onProxyReq(proxyReq, req) {
    console.log('[edge→auth]', req.method, req.originalUrl, '→', AUTH_SERVICE_URL + req.originalUrl);
  },
  onProxyRes(proxyRes, req) {
    console.log('[auth→edge]', req.method, req.originalUrl, 'status=', proxyRes.statusCode);
  },
  onError(err, req, res) {
    console.error('[proxy error /reports]', err?.code || err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream-failed' });
    }
  },
});

app.all(['/reports', '/reports/*'], (req, res, next) => {
  console.log('[edge] HIT /reports -', req.method, req.originalUrl);
  return reportsProxy(req, res, next);
});

app.get('/__diag/ping-options', async (_req, res) => {
  try {
    const r = await fetch(`${AUTH_SERVICE_URL}/reports/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: 'TEST-0000-0000-0000' }),
    });
    const text = await r.text().catch(() => '');
    res.status(200).type('text').send(`status=${r.status}\n${text}`);
  } catch (e) {
    res.status(500).type('text').send(String(e?.stack || e));
  }
});



// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath, {
    maxAge: '1d',
    etag: true,
  }));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/auth') || req.path.startsWith('/reports') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use((req, _res, next) => {
  console.warn('[edge] no match ->', req.method, req.originalUrl);
  next();
});
app.use((_req, res) => res.status(404).json({ error: 'not-found' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'edge-api'
  });
});

app.listen(Number(PORT), () => {
  console.log(`[edge] listening on :${PORT} -> auth: ${AUTH_SERVICE_URL}`);
});