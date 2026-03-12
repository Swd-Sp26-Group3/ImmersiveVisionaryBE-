import sql from 'mssql'
import { getDbPool } from '../config/database'

export type CompanyType = 'BRAND' | 'AGENCY' | 'STUDIO'
export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface Company {
  CompanyId: number
  CompanyName: string
  Address: string | null
  Email: string | null
  Phone: string | null
  Website: string | null
  CompanyType: CompanyType | null
  Status: CompanyStatus
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

export interface CreateCompanyInput {
  CompanyName: string
  Address?: string
  Email?: string
  Phone?: string
  Website?: string
  CompanyType?: CompanyType
  Status?: CompanyStatus
}

export interface UpdateCompanyInput {
  CompanyName?: string
  Address?: string | null
  Email?: string | null
  Phone?: string | null
  Website?: string | null
  CompanyType?: CompanyType | null
  Status?: CompanyStatus
}

export const createCompany = async (payload: CreateCompanyInput): Promise<Company> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('CompanyName', sql.NVarChar(200), payload.CompanyName)
    .input('Address', sql.NVarChar(200), payload.Address ?? null)
    .input('Email', sql.NVarChar(100), payload.Email ?? null)
    .input('Phone', sql.NVarChar(50), payload.Phone ?? null)
    .input('Website', sql.NVarChar(200), payload.Website ?? null)
    .input('CompanyType', sql.NVarChar(50), payload.CompanyType ?? null)
    .input('Status', sql.NVarChar(50), payload.Status ?? 'ACTIVE').query(`
      INSERT INTO [Company] (
        CompanyName,
        Address,
        Email,
        Phone,
        Website,
        CompanyType,
        Status
      )
      OUTPUT INSERTED.*
      VALUES (
        @CompanyName,
        @Address,
        @Email,
        @Phone,
        @Website,
        @CompanyType,
        @Status
      )
    `)

  return result.recordset[0]
}

export const getCompanyById = async (companyId: number): Promise<Company | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('CompanyId', sql.Int, companyId).query(`
    SELECT *
    FROM [Company]
    WHERE CompanyId = @CompanyId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const listCompanies = async (): Promise<Company[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT *
    FROM [Company]
    WHERE IsDeleted = 0
    ORDER BY CreatedAt DESC
  `)

  return result.recordset
}

export const updateCompany = async (companyId: number, payload: UpdateCompanyInput): Promise<Company> => {
  const pool = await getDbPool()

  const setParts: string[] = []
  const request = pool.request().input('CompanyId', sql.Int, companyId).input('UpdatedAt', sql.DateTime, new Date())

  if (payload.CompanyName !== undefined) {
    setParts.push('CompanyName = @CompanyName')
    request.input('CompanyName', sql.NVarChar(200), payload.CompanyName)
  }

  if (payload.Address !== undefined) {
    setParts.push('Address = @Address')
    request.input('Address', sql.NVarChar(200), payload.Address)
  }

  if (payload.Email !== undefined) {
    setParts.push('Email = @Email')
    request.input('Email', sql.NVarChar(100), payload.Email)
  }

  if (payload.Phone !== undefined) {
    setParts.push('Phone = @Phone')
    request.input('Phone', sql.NVarChar(50), payload.Phone)
  }

  if (payload.Website !== undefined) {
    setParts.push('Website = @Website')
    request.input('Website', sql.NVarChar(200), payload.Website)
  }

  if (payload.CompanyType !== undefined) {
    setParts.push('CompanyType = @CompanyType')
    request.input('CompanyType', sql.NVarChar(50), payload.CompanyType)
  }

  if (payload.Status !== undefined) {
    setParts.push('Status = @Status')
    request.input('Status', sql.NVarChar(50), payload.Status)
  }

  if (setParts.length === 0) {
    throw new Error('NO_UPDATE_FIELDS')
  }

  setParts.push('UpdatedAt = @UpdatedAt')

  const result = await request.query(`
    UPDATE [Company]
    SET ${setParts.join(', ')}
    OUTPUT INSERTED.*
    WHERE CompanyId = @CompanyId AND IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    throw new Error('COMPANY_NOT_FOUND')
  }

  return result.recordset[0]
}
