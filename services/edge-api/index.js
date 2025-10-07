import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

const {
  PORT = '4002',
  CORS_ORIGIN = '',
  AUTH_SERVICE_URL = 'http://127.0.0.1:4001', 
} = process.env;

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', ['loopback','linklocal','uniquelocal']);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('tiny'));

const allowList = CORS_ORIGIN.split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowList.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
}));

app.use('/auth', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

app.use('/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  xfwd: true,
  changeOrigin: false,
  pathRewrite: { '^/auth': '' }  
}));

app.use('/reports', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  xfwd: true,
  changeOrigin: false,
}));

app.get('/health', (_req, res) => res.type('text').send('ok'));
app.use((_req, res) => res.status(404).json({ error: 'not-found' }));

app.listen(Number(PORT), () => {
  console.log(`[edge] listening on :${PORT} -> auth: ${AUTH_SERVICE_URL}`);
});
