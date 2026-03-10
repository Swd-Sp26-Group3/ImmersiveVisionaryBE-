import sql from 'mssql'
import { getDbPool } from '../config/database'

export interface Product {
  ProductId: number
  CompanyId: number
  ProductName: string
  Description: string | null
  Category: string | null
  SizeInfo: string | null
  ColorInfo: string | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreateProductInput {
  CompanyId: number
  ProductName: string
  Description?: string | null
  Category?: string | null
  SizeInfo?: string | null
  ColorInfo?: string | null
}

export interface UpdateProductInput {
  CompanyId?: number
  ProductName?: string
  Description?: string | null
  Category?: string | null
  SizeInfo?: string | null
  ColorInfo?: string | null
}

export const createProduct = async (payload: CreateProductInput): Promise<Product> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('CompanyId', sql.Int, payload.CompanyId)
    .input('ProductName', sql.NVarChar(200), payload.ProductName)
    .input('Description', sql.NVarChar(500), payload.Description ?? null)
    .input('Category', sql.NVarChar(100), payload.Category ?? null)
    .input('SizeInfo', sql.NVarChar(200), payload.SizeInfo ?? null)
    .input('ColorInfo', sql.NVarChar(200), payload.ColorInfo ?? null).query(`
      INSERT INTO [Product] (
        CompanyId,
        ProductName,
        Description,
        Category,
        SizeInfo,
        ColorInfo
      )
      OUTPUT INSERTED.*
      VALUES (
        @CompanyId,
        @ProductName,
        @Description,
        @Category,
        @SizeInfo,
        @ColorInfo
      )
    `)

  return result.recordset[0]
}

export const getProductById = async (productId: number): Promise<Product | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('ProductId', sql.Int, productId).query(`
    SELECT *
    FROM [Product]
    WHERE ProductId = @ProductId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const listProducts = async (): Promise<Product[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT *
    FROM [Product]
    WHERE IsDeleted = 0
    ORDER BY CreatedAt DESC
  `)

  return result.recordset
}

export const updateProduct = async (productId: number, payload: UpdateProductInput): Promise<Product> => {
  const pool = await getDbPool()

  const setParts: string[] = []
  const request = pool.request().input('ProductId', sql.Int, productId).input('UpdatedAt', sql.DateTime, new Date())

  if (payload.CompanyId !== undefined) {
    setParts.push('CompanyId = @CompanyId')
    request.input('CompanyId', sql.Int, payload.CompanyId)
  }

  if (payload.ProductName !== undefined) {
    setParts.push('ProductName = @ProductName')
    request.input('ProductName', sql.NVarChar(200), payload.ProductName)
  }

  if (payload.Description !== undefined) {
    setParts.push('Description = @Description')
    request.input('Description', sql.NVarChar(500), payload.Description)
  }

  if (payload.Category !== undefined) {
    setParts.push('Category = @Category')
    request.input('Category', sql.NVarChar(100), payload.Category)
  }

  if (payload.SizeInfo !== undefined) {
    setParts.push('SizeInfo = @SizeInfo')
    request.input('SizeInfo', sql.NVarChar(200), payload.SizeInfo)
  }

  if (payload.ColorInfo !== undefined) {
    setParts.push('ColorInfo = @ColorInfo')
    request.input('ColorInfo', sql.NVarChar(200), payload.ColorInfo)
  }

  if (setParts.length === 0) {
    throw new Error('NO_UPDATE_FIELDS')
  }

  setParts.push('UpdatedAt = @UpdatedAt')

  const result = await request.query(`
    UPDATE [Product]
    SET ${setParts.join(', ')}
    OUTPUT INSERTED.*
    WHERE ProductId = @ProductId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  return result.recordset[0]
}

export const deleteProduct = async (productId: number): Promise<void> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('ProductId', sql.Int, productId)
    .input('UpdatedAt', sql.DateTime, new Date())
    .query(`
      UPDATE [Product]
      SET IsDeleted = 1, UpdatedAt = @UpdatedAt
      WHERE ProductId = @ProductId AND IsDeleted = 0
    `)

  if (result.rowsAffected[0] === 0) {
    throw new Error('PRODUCT_NOT_FOUND')
  }
}
