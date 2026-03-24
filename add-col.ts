import { getDbPool, closeDbPool } from './src/config/database'

async function check() {
  const pool = await getDbPool()
  const result = await pool.request().query(`
    IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[OrderAttachment]') 
        AND name = 'Base64Data'
    )
    BEGIN
        ALTER TABLE OrderAttachment ADD Base64Data VARCHAR(MAX) NULL;
    END
  `)
  console.log('Column check complete', result)
  await closeDbPool()
}
check().catch(console.error)
