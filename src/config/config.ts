import dotenv from 'dotenv'

dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'development'

const requiredEnv = (name: string, fallback = ''): string => {
  const value = process.env[name]?.trim()

  if (nodeEnv === 'production' && (!value || value === fallback)) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value || fallback
}

export const config = {
  port: Number.parseInt(process.env.PORT || '5000'),

  database: {
    server: requiredEnv('DB_SERVER', 'localhost'),
    database: requiredEnv('DB_NAME', 'ImmersiveVisionary'),
    user: requiredEnv('DB_USER', 'sa'),
    password: requiredEnv('DB_PASSWORD', '12345'),
    port: Number.parseInt(process.env.DB_PORT || '1433'),
    encrypt: process.env.DB_ENCRYPT ? process.env.DB_ENCRYPT === 'true' : nodeEnv === 'production',
    trustServerCertificate: process.env.DB_TRUST_CERT ? process.env.DB_TRUST_CERT === 'true' : nodeEnv !== 'production'
  },

  jwt: {
    secret: requiredEnv('JWT_SECRET', 'hackhocai'),
    refreshSecret: requiredEnv('JWT_REFRESH_SECRET', 'hackhocai'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  cors: {
    origin: requiredEnv('CORS_ORIGIN', 'http://localhost:5000'),
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
    email: requiredEnv('DEFAULT_ADMIN_EMAIL', 'admin@electricvehicle.com'),
    password: requiredEnv('DEFAULT_ADMIN_PASSWORD', 'Admin123!'),
    roleName: process.env.DEFAULT_ADMIN_ROLE || 'ADMIN'
  },

  vnpay: {
    tmnCode: process.env.VNP_TMN_CODE || '',
    hashSecret: process.env.VNP_HASH_SECRET || '',
    url: process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNP_RETURN_URL || 'http://localhost:5000/api/payments/vnpay-return'
  },

  nodeEnv
}
