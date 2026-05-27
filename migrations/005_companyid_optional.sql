USE ImmersiveVisionary;
GO

-- Migration 005: Make CompanyId optional across key tables
-- Cho phep user khong co CompanyId dat order, thanh toan, mua marketplace asset.
-- Script nay idempotent: chay nhieu lan khong bi loi.

-- ----------------------------------------------------------------
-- 1. Payment.CompanyId -> NULL
-- ----------------------------------------------------------------
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = 'CompanyId'
    AND object_id = OBJECT_ID('dbo.Payment')
    AND is_nullable = 0
)
BEGIN
  DECLARE @sql1 NVARCHAR(500)
  SELECT @sql1 = 'ALTER TABLE dbo.Payment DROP CONSTRAINT [' + fk.name + ']'
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Payment')
    AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'CompanyId'
  IF @sql1 IS NOT NULL EXEC(@sql1)

  ALTER TABLE dbo.Payment ALTER COLUMN CompanyId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Payment_Company' AND parent_object_id = OBJECT_ID('dbo.Payment')
  )
    ALTER TABLE dbo.Payment ADD CONSTRAINT FK_Payment_Company
      FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId);

  PRINT 'Payment.CompanyId altered to NULL';
END
ELSE
  PRINT 'Payment.CompanyId already nullable - skipped';
GO

-- ----------------------------------------------------------------
-- 2. CreativeOrder.CompanyId -> NULL
-- ----------------------------------------------------------------
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = 'CompanyId'
    AND object_id = OBJECT_ID('dbo.CreativeOrder')
    AND is_nullable = 0
)
BEGIN
  DECLARE @sql2 NVARCHAR(500)
  SELECT @sql2 = 'ALTER TABLE dbo.CreativeOrder DROP CONSTRAINT [' + fk.name + ']'
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.CreativeOrder')
    AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'CompanyId'
  IF @sql2 IS NOT NULL EXEC(@sql2)

  ALTER TABLE dbo.CreativeOrder ALTER COLUMN CompanyId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_CreativeOrder_Company' AND parent_object_id = OBJECT_ID('dbo.CreativeOrder')
  )
    ALTER TABLE dbo.CreativeOrder ADD CONSTRAINT FK_CreativeOrder_Company
      FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId);

  PRINT 'CreativeOrder.CompanyId altered to NULL';
END
ELSE
  PRINT 'CreativeOrder.CompanyId already nullable - skipped';
GO

-- ----------------------------------------------------------------
-- 3. MarketplaceOrder.BuyerCompanyId -> NULL
-- ----------------------------------------------------------------
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = 'BuyerCompanyId'
    AND object_id = OBJECT_ID('dbo.MarketplaceOrder')
    AND is_nullable = 0
)
BEGIN
  DECLARE @sql3 NVARCHAR(500)
  SELECT @sql3 = 'ALTER TABLE dbo.MarketplaceOrder DROP CONSTRAINT [' + fk.name + ']'
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.MarketplaceOrder')
    AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'BuyerCompanyId'
  IF @sql3 IS NOT NULL EXEC(@sql3)

  ALTER TABLE dbo.MarketplaceOrder ALTER COLUMN BuyerCompanyId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_MarketplaceOrder_BuyerCompany' AND parent_object_id = OBJECT_ID('dbo.MarketplaceOrder')
  )
    ALTER TABLE dbo.MarketplaceOrder ADD CONSTRAINT FK_MarketplaceOrder_BuyerCompany
      FOREIGN KEY (BuyerCompanyId) REFERENCES dbo.Company(CompanyId);

  PRINT 'MarketplaceOrder.BuyerCompanyId altered to NULL';
END
ELSE
  PRINT 'MarketplaceOrder.BuyerCompanyId already nullable - skipped';
GO

PRINT 'Migration 005 complete';
GO
