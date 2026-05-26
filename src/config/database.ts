import sql from 'mssql'
import bcrypt from 'bcryptjs'
import { config } from './config'

let pool: sql.ConnectionPool | null = null

const ensureCompatibilityColumns = async (dbPool: sql.ConnectionPool): Promise<void> => {
  await dbPool.query(`
    IF OBJECT_ID(N'dbo.CreativeOrder', N'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE name = N'CreatedByUserId'
          AND object_id = OBJECT_ID(N'dbo.CreativeOrder')
      )
        ALTER TABLE dbo.CreativeOrder ADD CreatedByUserId INT NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_CreativeOrder_CreatedByUser'
          AND parent_object_id = OBJECT_ID(N'dbo.CreativeOrder')
      )
        ALTER TABLE dbo.CreativeOrder
        ADD CONSTRAINT FK_CreativeOrder_CreatedByUser
        FOREIGN KEY (CreatedByUserId) REFERENCES dbo.[User](UserId);

      IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_CreativeOrder_CreatedByUserId'
          AND object_id = OBJECT_ID(N'dbo.CreativeOrder')
      )
        CREATE INDEX IX_CreativeOrder_CreatedByUserId ON dbo.CreativeOrder(CreatedByUserId);
    END

    IF OBJECT_ID(N'dbo.MarketplaceOrder', N'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE name = N'BuyerUserId'
          AND object_id = OBJECT_ID(N'dbo.MarketplaceOrder')
      )
        ALTER TABLE dbo.MarketplaceOrder ADD BuyerUserId INT NULL;

      IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_MarketplaceOrder_BuyerUser'
          AND parent_object_id = OBJECT_ID(N'dbo.MarketplaceOrder')
      )
        ALTER TABLE dbo.MarketplaceOrder
        ADD CONSTRAINT FK_MarketplaceOrder_BuyerUser
        FOREIGN KEY (BuyerUserId) REFERENCES dbo.[User](UserId);
    END

    -- Make Asset3D.AssetType nullable (was NOT NULL, causing 500 when not provided)
    IF OBJECT_ID(N'dbo.Asset3D', N'U') IS NOT NULL
    BEGIN
      IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = N'AssetType'
          AND object_id = OBJECT_ID(N'dbo.Asset3D')
          AND is_nullable = 0
      )
      BEGIN
        -- Drop the CHECK constraint referencing AssetType first
        IF EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = N'CK_Asset3D_AssetType'
            AND parent_object_id = OBJECT_ID(N'dbo.Asset3D')
        )
          ALTER TABLE dbo.Asset3D DROP CONSTRAINT CK_Asset3D_AssetType;

        ALTER TABLE dbo.Asset3D ALTER COLUMN AssetType NVARCHAR(50) NULL;

        -- Re-add the CHECK constraint allowing NULL
        IF NOT EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = N'CK_Asset3D_AssetType'
            AND parent_object_id = OBJECT_ID(N'dbo.Asset3D')
        )
          ALTER TABLE dbo.Asset3D
          ADD CONSTRAINT CK_Asset3D_AssetType
          CHECK (AssetType IS NULL OR AssetType IN (N'ORDER', N'MARKETPLACE', N'TEMPLATE'));
      END
    END

    -- Alter PreviewImage to NVARCHAR(MAX) to support Base64 images
    IF OBJECT_ID(N'dbo.Asset3D', N'U') IS NOT NULL
    BEGIN
      DECLARE @max_len INT;
      SELECT @max_len = CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Asset3D' AND COLUMN_NAME = 'PreviewImage';
      
      IF @max_len IS NOT NULL AND @max_len <> -1
      BEGIN
        ALTER TABLE dbo.Asset3D ALTER COLUMN PreviewImage NVARCHAR(MAX) NULL;
      END
    END

    -- Ensure Base64Data is VARCHAR(MAX) on Asset3D (fixes mssql "value out of range" on large .obj files)
    IF OBJECT_ID(N'dbo.Asset3D', N'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.Asset3D')
      )
        ALTER TABLE dbo.Asset3D ADD [Base64Data] VARCHAR(MAX) NULL;
      ELSE IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = N'Base64Data'
          AND object_id = OBJECT_ID(N'dbo.Asset3D')
          AND max_length != -1
      )
        ALTER TABLE dbo.Asset3D ALTER COLUMN [Base64Data] VARCHAR(MAX) NULL;
    END

    -- Ensure Base64Data is VARCHAR(MAX) on AssetVersion
    IF OBJECT_ID(N'dbo.AssetVersion', N'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.AssetVersion')
      )
        ALTER TABLE dbo.AssetVersion ADD [Base64Data] VARCHAR(MAX) NULL;
      ELSE IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = N'Base64Data'
          AND object_id = OBJECT_ID(N'dbo.AssetVersion')
          AND max_length != -1
      )
        ALTER TABLE dbo.AssetVersion ALTER COLUMN [Base64Data] VARCHAR(MAX) NULL;
    END
  `)
}

const dbConfig: sql.config = {
  server: config.database.server,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  port: config.database.port,
  options: {
    encrypt: config.database.encrypt,
    trustServerCertificate: config.database.trustServerCertificate,
    enableArithAbort: true,
    requestTimeout: 120000, // 2 minutes — needed for large Base64 asset uploads
    connectTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
}

export const connectToDatabase = async (): Promise<void> => {
  try {
    if (pool) return
    pool = await new sql.ConnectionPool(dbConfig).connect()
    await ensureCompatibilityColumns(pool)
    console.log('✅ Database connected successfully')
  } catch (error) {
    console.error('❌ Database connection failed:', {
      server: config.database.server,
      database: config.database.database,
      user: config.database.user,
      port: config.database.port,
      encrypt: config.database.encrypt,
      trustServerCertificate: config.database.trustServerCertificate,
      passwordProvided: Boolean(config.database.password)
    })
    console.error(error)
    throw error
  }
}

export const getDbPool = async (): Promise<sql.ConnectionPool> => {
  if (!pool) await connectToDatabase()
  return pool!
}

export const closeDbPool = async (): Promise<void> => {
  if (pool) {
    await pool.close()
    pool = null
    console.log('🛑 Database connection closed')
  }
}

export const createDefaultAdmin = async (): Promise<void> => {
  try {
    const dbPool = await getDbPool()
    const adminUserName = 'System Administrator'

    // Check by both email and username to avoid unique constraint conflicts.
    const existingAdmin = await dbPool
      .request()
      .input('email', sql.VarChar, config.admin.email)
      .input('userName', sql.NVarChar(100), adminUserName)
      .query('SELECT UserId FROM [User] WHERE Email = @email OR UserName = @userName')

    if (existingAdmin.recordset.length > 0) {
      console.log('⚠️ Default admin already exists')
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(config.admin.password, 12)
    
    // Get ADMIN role id
    const roleResult = await dbPool
      .request()
      .input('roleName', sql.NVarChar(50), 'ADMIN')
      .query('SELECT RoleId FROM [Role] WHERE RoleName = @roleName')
    
    if (roleResult.recordset.length === 0) {
      throw new Error('ADMIN role not found in database')
    }
    
    const adminRoleId = roleResult.recordset[0].RoleId
    
    // Tạo admin
    await dbPool
      .request()
      .input('email', sql.NVarChar(100), config.admin.email)
      .input('passwordHash', sql.NVarChar(200), hashedPassword)
      .input('userName', sql.NVarChar(100), adminUserName)
      .input('roleId', sql.Int, adminRoleId)
      .query(`
        INSERT INTO [User] (Email, PasswordHash, UserName, RoleId)
        VALUES (@email, @passwordHash, @userName, @roleId)
      `)

    console.log('✅ Default admin created successfully')
  } catch (error) {
    // SQL Server duplicate key numbers: 2601 (duplicate index), 2627 (duplicate constraint)
    const duplicateNumber = (error as { number?: number; originalError?: { info?: { number?: number } } }).number
      ?? (error as { originalError?: { info?: { number?: number } } }).originalError?.info?.number
    if (duplicateNumber === 2601 || duplicateNumber === 2627) {
      console.log('⚠️ Default admin already exists')
      return
    }

    console.error('❌ Failed to create default admin:', error)
    throw error
  }
}
