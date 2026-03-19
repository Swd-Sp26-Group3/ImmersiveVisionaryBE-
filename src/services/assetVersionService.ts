import sql from 'mssql'
import { getDbPool } from '../config/database'

export type FileFormat = 'GLB' | 'USDZ' | 'FBX' | 'WEBAR' | 'OBJ'

export interface AssetVersion {
  VersionId: number
  AssetId: number
  FileFormat: FileFormat
  FileUrl: string | null
  Base64Data: string | null
  PolyCount: number | null
  TextureSize: string | null
  CreatedAt: Date
}

export interface CreateAssetVersionInput {
  FileFormat: FileFormat
  FileUrl?: string | null
  Base64Data?: string | null
  PolyCount?: number | null
  TextureSize?: string | null
}

export const createAssetVersion = async (assetId: number, payload: CreateAssetVersionInput): Promise<AssetVersion> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .input('FileFormat', sql.NVarChar(50), payload.FileFormat)
    .input('FileUrl', sql.NVarChar(500), payload.FileUrl ?? null)
    .input('Base64Data', sql.VarChar(sql.MAX), payload.Base64Data ?? null)
    .input('PolyCount', sql.Int, payload.PolyCount ?? null)
    .input('TextureSize', sql.NVarChar(100), payload.TextureSize ?? null)
    .query(`
      INSERT INTO [AssetVersion] (AssetId, FileFormat, FileUrl, Base64Data, PolyCount, TextureSize)
      OUTPUT INSERTED.*
      VALUES (@AssetId, @FileFormat, @FileUrl, @Base64Data, @PolyCount, @TextureSize)
    `)

  return result.recordset[0]
}

export const getAssetVersions = async (assetId: number): Promise<AssetVersion[]> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('AssetId', sql.Int, assetId)
    .query(`
      SELECT *
      FROM [AssetVersion]
      WHERE AssetId = @AssetId
      ORDER BY CreatedAt DESC
    `)

  return result.recordset
}

export const getAssetVersionById = async (versionId: number): Promise<AssetVersion | null> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('VersionId', sql.Int, versionId)
    .query(`
      SELECT *
      FROM [AssetVersion]
      WHERE VersionId = @VersionId
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}
