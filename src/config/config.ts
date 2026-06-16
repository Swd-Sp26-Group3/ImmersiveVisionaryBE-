import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })

const nodeEnv = process.env.NODE_ENV || 'development'

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  return fallback
}

/**
 * Build a dynamic CORS origin checker.
 *
 * Allowed origins (checked in order):
 *  1. Exact matches from CORS_ORIGIN env var (comma-separated)
 *  2. Any *.vercel.app subdomain  — covers ALL preview deployments automatically
 *  3. Any localhost / 127.0.0.1 on any port — covers local dev
 */
type CorsCallback = (err: Error | null, allow?: boolean) => void
const buildCorsOrigin = (envValue: string) => {
  const exactOrigins = new Set(
    envValue.split(',').map(o => o.trim()).filter(Boolean)
  )

  return (origin: string | undefined, callback: CorsCallback) => {
    // No origin = non-browser request (curl, Postman, SSR) → allow
    if (!origin) return callback(null, true)

    // 1. Exact match from env var
    if (exactOrigins.has(origin)) return callback(null, true)

    // 2. Any Vercel deployment (preview or production)
    if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true)

    // 3. Localhost on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true)

    // Blocked
    console.warn(`[CORS] Blocked origin: ${origin}`)
    callback(new Error(`CORS: origin '${origin}' not allowed`))
  }
}

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim()

  if (nodeEnv === 'production' && !value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value || ''
}

const optionalEnv = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim()

  return value || fallback
}

export const config = {
  port: Number.parseInt(process.env.PORT || '5000'),

  database: {
    server: nodeEnv === 'production' ? requiredEnv('DB_SERVER') : optionalEnv('DB_SERVER', 'localhost'),
    database: nodeEnv === 'production' ? requiredEnv('DB_NAME') : optionalEnv('DB_NAME', 'ImmersiveVisionary'),
    user: nodeEnv === 'production' ? requiredEnv('DB_USER') : optionalEnv('DB_USER', 'sa'),
    password: nodeEnv === 'production' ? requiredEnv('DB_PASSWORD') : optionalEnv('DB_PASSWORD', '12345'),
    port: Number.parseInt(process.env.DB_PORT || '1433'),
    encrypt: parseBoolean(process.env.DB_ENCRYPT, nodeEnv === 'production'),
    trustServerCertificate: parseBoolean(process.env.DB_TRUST_CERT, nodeEnv !== 'production')
  },

  jwt: {
    secret: optionalEnv('JWT_SECRET', 'hackhocai'),
    refreshSecret: optionalEnv('JWT_REFRESH_SECRET', 'hackhocai'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  cors: {
    origin: buildCorsOrigin(process.env.CORS_ORIGIN || ''),
    credentials: true
  },


  // email: {
  //   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  //   port: Number.parseInt(process.env.EMAIL_PORT || '587'),
  //   secure: process.env.EMAIL_SECURE === 'true',
  //   user: process.env.EMAIL_USER || '',
  //   password: process.env.EMAIL_PASSWORD || ''
  // },

  // upload: {
  //   maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  //   allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword']
  // },

  admin: {
    email: optionalEnv('DEFAULT_ADMIN_EMAIL', 'admin@electricvehicle.com'),
    password: optionalEnv('DEFAULT_ADMIN_PASSWORD', 'Admin123!'),
    roleName: process.env.DEFAULT_ADMIN_ROLE || 'ADMIN'
  },

  nodeEnv
}
