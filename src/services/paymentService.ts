import sql from 'mssql'
import { getDbPool } from '../config/database'

export type PaymentType = 'DEPOSIT' | 'FULL' | 'MILESTONE' | 'ASSET'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED'

export interface Payment {
  PaymentId: number
  OrderId: number | null
  AssetId: number | null
  CompanyId: number
  Amount: number
  PaymentType: PaymentType | null
  PaymentStatus: PaymentStatus
  PaymentDate: Date | null
}

export interface CreatePaymentInput {
  OrderId?: number | null
  AssetId?: number | null
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
    .input('CompanyId', sql.Int, payload.CompanyId)
    .input('Amount', sql.Decimal(18, 2), payload.Amount)
    .input('PaymentType', sql.NVarChar(50), payload.PaymentType ?? null)
    .input('PaymentStatus', sql.NVarChar(50), 'PENDING')
    .query(`
      INSERT INTO [Payment] (OrderId, AssetId, CompanyId, Amount, PaymentType, PaymentStatus)
      OUTPUT INSERTED.*
      VALUES (@OrderId, @AssetId, @CompanyId, @Amount, @PaymentType, @PaymentStatus)
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
      SELECT * FROM [Payment]
      WHERE PaymentId = @PaymentId
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const listPayments = async (companyId?: number): Promise<Payment[]> => {
  const pool = await getDbPool()

  const request = pool.request()

  let query = `SELECT * FROM [Payment]`

  if (companyId !== undefined) {
    request.input('CompanyId', sql.Int, companyId)
    query += ` WHERE CompanyId = @CompanyId`
  }

  query += ` ORDER BY PaymentId DESC`

  const result = await request.query(query)

  return result.recordset
}
