import sql from 'mssql'
import { getDbPool } from '../config/database'

export type PaymentType = 'DEPOSIT' | 'FULL' | 'MILESTONE' | 'ASSET'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED'

export interface Payment {
  PaymentId: number
  OrderId: number | null
  AssetId: number | null
  MpOrderId: number | null
  CompanyId: number
  Amount: number
  PaymentType: PaymentType | null
  PaymentStatus: PaymentStatus
  PaymentDate: Date | null
  // Detailed info
  CompanyName?: string | null
  CompanyEmail?: string | null
  CompanyPhone?: string | null
  ProjectName?: string | null
  AssetName?: string | null
  OrderStatus?: string | null
  MpOrderStatus?: string | null
  BuyerName?: string | null
  BuyerPhone?: string | null
}

export interface CreatePaymentInput {
  OrderId?: number | null
  AssetId?: number | null
  MpOrderId?: number | null
  CompanyId: number
  Amount: number
  PaymentType?: PaymentType | null
}

export const createPayment = async (payload: CreatePaymentInput): Promise<Payment> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('OrderId', sql.Int, payload.OrderId ?? null)
    .input('AssetId', sql.Int, payload.AssetId ?? null)
    .input('MpOrderId', sql.Int, payload.MpOrderId ?? null)
    .input('CompanyId', sql.Int, payload.CompanyId)
    .input('Amount', sql.Decimal(18, 2), payload.Amount)
    .input('PaymentType', sql.NVarChar(50), payload.PaymentType ?? null)
    .input('PaymentStatus', sql.NVarChar(50), 'PENDING')
    .query(`
      INSERT INTO [Payment] (OrderId, AssetId, MpOrderId, CompanyId, Amount, PaymentType, PaymentStatus)
      OUTPUT INSERTED.*
      VALUES (@OrderId, @AssetId, @MpOrderId, @CompanyId, @Amount, @PaymentType, @PaymentStatus)
    `)

  return result.recordset[0]
}

export const confirmPayment = async (paymentId: number): Promise<Payment> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('PaymentId', sql.Int, paymentId)
    .input('PaymentStatus', sql.NVarChar(50), 'PAID')
    .input('PaymentDate', sql.DateTime, new Date())
    .query(`
      UPDATE [Payment]
      SET PaymentStatus = @PaymentStatus, PaymentDate = @PaymentDate
      OUTPUT INSERTED.*
      WHERE PaymentId = @PaymentId AND PaymentStatus = 'PENDING'
    `)

  if (result.recordset.length === 0) {
    const existing = await getPaymentById(paymentId)
    if (!existing) {
      throw new Error('PAYMENT_NOT_FOUND')
    }
    throw new Error('PAYMENT_CANNOT_CONFIRM')
  }

  return result.recordset[0]
}

export const getPaymentById = async (paymentId: number): Promise<Payment | null> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('PaymentId', sql.Int, paymentId)
    .query(`
      SELECT 
        p.*, 
        c.CompanyName, 
        c.Email as CompanyEmail,
        c.Phone as CompanyPhone,
        o.ProjectName, 
        o.Status as OrderStatus,
        a.AssetName,
        mo.Status as MpOrderStatus,
        COALESCE(bu.UserName, ou.UserName) as BuyerName,
        COALESCE(bu.Phone, ou.Phone) as BuyerPhone
      FROM [Payment] p
      LEFT JOIN [Company] c ON p.CompanyId = c.CompanyId
      LEFT JOIN [CreativeOrder] o ON p.OrderId = o.OrderId
      LEFT JOIN [Asset3D] a ON p.AssetId = a.AssetId
      LEFT JOIN [MarketplaceOrder] mo ON p.MpOrderId = mo.MpOrderId
      LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
      LEFT JOIN [User] ou ON o.CreatedByUserId = ou.UserId
      WHERE p.PaymentId = @PaymentId
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const listPayments = async (companyId?: number): Promise<Payment[]> => {
  const pool = await getDbPool()
  const request = pool.request()

  try {
    let query = `
      SELECT 
        p.*, 
        c.CompanyName, 
        c.Email as CompanyEmail,
        c.Phone as CompanyPhone,
        o.ProjectName, 
        o.Status as OrderStatus,
        a.AssetName,
        mo.Status as MpOrderStatus,
        COALESCE(bu.UserName, ou.UserName) as BuyerName,
        COALESCE(bu.Phone, ou.Phone) as BuyerPhone
      FROM [Payment] p
      LEFT JOIN [Company] c ON p.CompanyId = c.CompanyId
      LEFT JOIN [CreativeOrder] o ON p.OrderId = o.OrderId
      LEFT JOIN [Asset3D] a ON p.AssetId = a.AssetId
      LEFT JOIN [MarketplaceOrder] mo ON p.MpOrderId = mo.MpOrderId
      LEFT JOIN [User] bu ON mo.BuyerUserId = bu.UserId
      LEFT JOIN [User] ou ON o.CreatedByUserId = ou.UserId
    `

    if (companyId !== undefined) {
      request.input('CompanyId', sql.Int, companyId)
      query += ` WHERE p.CompanyId = @CompanyId`
    }

    query += ` ORDER BY p.PaymentId DESC`

    const result = await request.query(query)
    return result.recordset
  } catch (error) {
    console.error('SQL Error in listPayments (with joins):', error)

    // Fallback: try without the new MarketplaceOrder join just in case migration failed
    try {
      let fallbackQuery = `
        SELECT 
          p.*, 
          c.CompanyName, 
          o.ProjectName, 
          a.AssetName
        FROM [Payment] p
        LEFT JOIN [Company] c ON p.CompanyId = c.CompanyId
        LEFT JOIN [CreativeOrder] o ON p.OrderId = o.OrderId
        LEFT JOIN [Asset3D] a ON p.AssetId = a.AssetId
      `
      if (companyId !== undefined) {
        fallbackQuery += ` WHERE p.CompanyId = @CompanyId`
      }
      fallbackQuery += ` ORDER BY p.PaymentId DESC`

      const result = await request.query(fallbackQuery)
      return result.recordset
    } catch (fallbackError) {
      console.error('SQL Error in listPayments (fallback):', fallbackError)

      // Ultra-fallback: just raw payments without ANY joins
      try {
        let ultraFallback = `SELECT * FROM [Payment]`
        if (companyId !== undefined) {
          ultraFallback += ` WHERE CompanyId = @CompanyId`
        }
        ultraFallback += ` ORDER BY PaymentId DESC`
        const result = await request.query(ultraFallback)
        return result.recordset
      } catch (ultraError) {
        console.error('SQL Error in listPayments (ultra-fallback):', ultraError)
        throw ultraError
      }
    }
  }
}
export const updatePaymentStatus = async (paymentId: number, status: PaymentStatus): Promise<Payment> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('PaymentId', sql.Int, paymentId)
    .input('PaymentStatus', sql.NVarChar(50), status)
    .input('PaymentDate', sql.DateTime, status === 'PAID' ? new Date() : null)
    .query(`
      UPDATE [Payment]
      SET PaymentStatus = @PaymentStatus, PaymentDate = @PaymentDate
      OUTPUT INSERTED.*
      WHERE PaymentId = @PaymentId
    `)

  if (result.recordset.length === 0) {
    throw new Error('PAYMENT_NOT_FOUND')
  }

  return result.recordset[0]
}
