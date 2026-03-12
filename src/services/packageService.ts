import sql from 'mssql'
import { getDbPool } from '../config/database'

export interface ServicePackage {
  PackageId: number
  PackageName: string
  Description: string | null
  BasePrice: number | null
  EstimatedDays: number | null
}

export interface CreatePackageInput {
  PackageName: string
  Description?: string | null
  BasePrice?: number | null
  EstimatedDays?: number | null
}

export interface UpdatePackageInput {
  PackageName?: string
  Description?: string | null
  BasePrice?: number | null
  EstimatedDays?: number | null
}

export const createPackage = async (payload: CreatePackageInput): Promise<ServicePackage> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('PackageName', sql.NVarChar(200), payload.PackageName)
    .input('Description', sql.NVarChar(500), payload.Description ?? null)
    .input('BasePrice', sql.Decimal(18, 2), payload.BasePrice ?? null)
    .input('EstimatedDays', sql.Int, payload.EstimatedDays ?? null).query(`
      INSERT INTO [ServicePackage] (
        PackageName,
        Description,
        BasePrice,
        EstimatedDays
      )
      OUTPUT INSERTED.*
      VALUES (
        @PackageName,
        @Description,
        @BasePrice,
        @EstimatedDays
      )
    `)

  return result.recordset[0]
}

export const getPackageById = async (packageId: number): Promise<ServicePackage | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('PackageId', sql.Int, packageId).query(`
    SELECT *
    FROM [ServicePackage]
    WHERE PackageId = @PackageId
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

export const listPackages = async (): Promise<ServicePackage[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT *
    FROM [ServicePackage]
    ORDER BY PackageId DESC
  `)

  return result.recordset
}

export const updatePackage = async (packageId: number, payload: UpdatePackageInput): Promise<ServicePackage> => {
  const pool = await getDbPool()

  const setParts: string[] = []
  const request = pool.request().input('PackageId', sql.Int, packageId)

  if (payload.PackageName !== undefined) {
    setParts.push('PackageName = @PackageName')
    request.input('PackageName', sql.NVarChar(200), payload.PackageName)
  }

  if (payload.Description !== undefined) {
    setParts.push('Description = @Description')
    request.input('Description', sql.NVarChar(500), payload.Description)
  }

  if (payload.BasePrice !== undefined) {
    setParts.push('BasePrice = @BasePrice')
    request.input('BasePrice', sql.Decimal(18, 2), payload.BasePrice)
  }

  if (payload.EstimatedDays !== undefined) {
    setParts.push('EstimatedDays = @EstimatedDays')
    request.input('EstimatedDays', sql.Int, payload.EstimatedDays)
  }

  if (setParts.length === 0) {
    throw new Error('NO_UPDATE_FIELDS')
  }

  const result = await request.query(`
    UPDATE [ServicePackage]
    SET ${setParts.join(', ')}
    OUTPUT INSERTED.*
    WHERE PackageId = @PackageId
  `)

  if (result.recordset.length === 0) {
    throw new Error('PACKAGE_NOT_FOUND')
  }

  return result.recordset[0]
}

export const deletePackage = async (packageId: number): Promise<void> => {
  const pool = await getDbPool()

  const result = await pool.request().input('PackageId', sql.Int, packageId).query(`
    DELETE FROM [ServicePackage]
    WHERE PackageId = @PackageId
  `)

  if (result.rowsAffected[0] === 0) {
    throw new Error('PACKAGE_NOT_FOUND')
  }
}
