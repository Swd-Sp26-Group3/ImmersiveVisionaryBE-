import fs from 'fs'
import path from 'path'
import sql from 'mssql'
import { config } from '../config/config'

type MigrationRecord = {
  name: string
  appliedAt: Date
}

const MIGRATIONS_TABLE = '__Migrations'

const getMigrationsDir = (): string => path.resolve(process.cwd(), 'migrations')

const splitSqlBatches = (sqlText: string): string[] => {
  // SQL Server drivers don't understand `GO`; it's a client-side batch separator.
  // Split on lines that contain only GO (case-insensitive).
  const parts = sqlText
    .replace(/^\uFEFF/, '')
    .split(/^\s*GO\s*$/gim)
    .map(part => part.trim())
    .filter(Boolean)

  return parts
}

const createPool = async (databaseName: string): Promise<sql.ConnectionPool> => {
  const pool = new sql.ConnectionPool({
    server: config.database.server,
    database: databaseName,
    user: config.database.user,
    password: config.database.password,
    port: config.database.port,
    options: {
      encrypt: config.database.encrypt,
      trustServerCertificate: config.database.trustServerCertificate,
      enableArithAbort: true,
      requestTimeout: 30000,
      connectTimeout: 30000
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000
    }
  })

  return pool.connect()
}

const ensureDatabaseExists = async (): Promise<void> => {
  const dbName = config.database.database
  // This is safe for Docker SQL Server with `sa`. If the login lacks permissions,
  // we'll just continue and let the normal connection error surface.
  const masterPool = await createPool('master')
  try {
    await masterPool
      .request()
      .input('dbName', sql.NVarChar(128), dbName)
      .query(`
        IF DB_ID(@dbName) IS NULL
        BEGIN
          DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE [' + REPLACE(@dbName, ']', ']]') + N']';
          EXEC sp_executesql @sql;
        END
      `)
  } finally {
    await masterPool.close()
  }
}

const ensureMigrationsTable = async (pool: sql.ConnectionPool): Promise<void> => {
  await pool.query(`
    IF OBJECT_ID(N'dbo.${MIGRATIONS_TABLE}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${MIGRATIONS_TABLE} (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME NOT NULL DEFAULT GETDATE()
      );
    END
  `)
}

const getAppliedMigrations = async (pool: sql.ConnectionPool): Promise<Set<string>> => {
  const result = await pool.query<MigrationRecord>(`SELECT Name, AppliedAt FROM dbo.${MIGRATIONS_TABLE}`)
  return new Set(result.recordset.map(r => r.name))
}

const applyMigrationFile = async (pool: sql.ConnectionPool, filename: string, fullPath: string): Promise<void> => {
  const sqlText = fs.readFileSync(fullPath, 'utf8')
  const batches = splitSqlBatches(sqlText)

  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    for (const batch of batches) {
      const request = new sql.Request(transaction)
      await request.batch(batch)
    }

    const insertRequest = new sql.Request(transaction)
    await insertRequest
      .input('name', sql.NVarChar(255), filename)
      .query(`INSERT INTO dbo.${MIGRATIONS_TABLE} (Name) VALUES (@name)`)

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export const runMigrations = async (): Promise<void> => {
  const migrationsDir = getMigrationsDir()

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations folder not found: ${migrationsDir}`)
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(name => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  if (migrationFiles.length === 0) {
    console.log('No .sql migrations found; nothing to do.')
    return
  }

  await ensureDatabaseExists()

  const pool = await createPool(config.database.database)
  try {
    await ensureMigrationsTable(pool)
    const applied = await getAppliedMigrations(pool)

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue
      }

      const fullPath = path.join(migrationsDir, file)
      console.log(`Applying migration: ${file}`)
      await applyMigrationFile(pool, file, fullPath)
      console.log(`Applied: ${file}`)
    }

    console.log('All migrations applied successfully.')
  } finally {
    await pool.close()
  }
}

const main = async (): Promise<void> => {
  try {
    await runMigrations()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exitCode = 1
  }
}

// Allow both import and direct execution
if (require.main === module) {
  void main()
}
