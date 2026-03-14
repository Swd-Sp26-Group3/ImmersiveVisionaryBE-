import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from './config/config'
import { connectToDatabase, createDefaultAdmin } from './config/database'

import  authRoutes  from './routes/authRoutes'
import { adminRoutes } from './routes/adminRoutes'
import userRoutes from './routes/userRoutes'
import companyRoutes from './routes/companyRoutes'
import productRoutes from './routes/productRoutes'
import packageRoutes from './routes/packageRoutes'
import orderRoutes from './routes/orderRoutes'
import assetRoutes from './routes/assetRoutes'
import assetVersionRoutes from './routes/assetVersionRoutes'
import paymentRoutes from './routes/paymentRoutes'
import marketplaceOrderRoutes from './routes/marketplaceOrderRoutes'

// Import routes


const app = express()
app.use(express.json())


app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
})
app.use(limiter)

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/users', userRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/products', productRoutes)
app.use('/api/packages', packageRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/asset-versions', assetVersionRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/marketplace-orders', marketplaceOrderRoutes)

// Initialize application
export const initializeApp = async (): Promise<void> => {
  try {
    // Connect to database
    await connectToDatabase()
    console.log('✅ Database connected successfully')

    // Create default admin account
    await createDefaultAdmin()
    console.log('✅ Default admin account verified')

    console.log('✅ Application initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize application:', error)
    throw error
  }
}

export default app
