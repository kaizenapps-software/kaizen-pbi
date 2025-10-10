import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()
app.use(helmet({ contentSecurityPolicy: false }))
app.use(morgan('tiny'))

const origins = String(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true)
    return cb(new Error('CORS'), false)
  },
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:4001'

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/auth', limiter)

const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: { '^/auth': '' }
})

const reportsProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  xfwd: true
})

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.all(['/auth', '/auth/*'], authProxy)
app.all(['/reports', '/reports/*'], reportsProxy)

app.use((req, res) => res.status(404).json({ error: 'not-found' }))

const port = Number(process.env.PORT || 4002)
app.listen(port, () => {})
