import { getDbPool, closeDbPool } from './src/config/database'

async function runMigration() {
  try {
    const pool = await getDbPool()
    console.log('Running database migrations...')

    await pool.query(`
      -- 1A. Make ProductId and PackageId nullable
      ALTER TABLE CreativeOrder ALTER COLUMN ProductId INT NULL;
      ALTER TABLE CreativeOrder ALTER COLUMN PackageId INT NULL;
    `)
    console.log('Made ProductId and PackageId nullable')

    await pool.query(`
      -- 1B. Add new columns matching the Custom Production form
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'ProjectName' AND Object_ID = Object_ID(N'CreativeOrder'))
      BEGIN
          ALTER TABLE CreativeOrder ADD ProjectName  NVARCHAR(200) NULL;
          ALTER TABLE CreativeOrder ADD ProductType  NVARCHAR(100) NULL;
          ALTER TABLE CreativeOrder ADD Budget       NVARCHAR(50)  NULL;
          ALTER TABLE CreativeOrder ADD DeliverySpeed NVARCHAR(50) NULL;

          -- 1C. Add-on boolean flags
          ALTER TABLE CreativeOrder ADD ArOptimize   BIT DEFAULT 0;
          ALTER TABLE CreativeOrder ADD Animation    BIT DEFAULT 0;
          ALTER TABLE CreativeOrder ADD MultiVariant BIT DEFAULT 0;
          ALTER TABLE CreativeOrder ADD SourceFiles  BIT DEFAULT 0;
      END
    `)
    console.log('Added new columns to CreativeOrder')

    await pool.query(`
      -- 1D. Create OrderAttachment table for Base64 files
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderAttachment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE OrderAttachment (
              AttachmentId INT IDENTITY PRIMARY KEY,
              OrderId INT NOT NULL,
              FileName NVARCHAR(200) NOT NULL,
              MimeType NVARCHAR(100) NOT NULL,
              Base64Data VARCHAR(MAX) NOT NULL,
              CreatedAt DATETIME DEFAULT GETDATE(),

              FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId) ON DELETE CASCADE
          );
      END
    `)
    console.log('Created OrderAttachment table')

    console.log('Migration successful!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await closeDbPool()
  }
}

runMigration()
