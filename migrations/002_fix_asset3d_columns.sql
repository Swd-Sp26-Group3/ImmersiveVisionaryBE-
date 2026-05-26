USE ImmersiveVisionary;
GO

-- Fix 1: Expand PreviewImage from NVARCHAR(500) to NVARCHAR(MAX)
-- Required because artists upload base64 JPEG data URLs which exceed 500 chars
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'PreviewImage'
    AND object_id = OBJECT_ID(N'dbo.Asset3D')
    AND max_length != -1   -- -1 means MAX
)
BEGIN
  ALTER TABLE dbo.Asset3D ALTER COLUMN PreviewImage NVARCHAR(MAX) NULL;
  PRINT 'PreviewImage column expanded to NVARCHAR(MAX)';
END
ELSE
BEGIN
  PRINT 'PreviewImage already NVARCHAR(MAX) — skipped';
END
GO

-- Fix 2: Add Description column if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Description' AND object_id = OBJECT_ID(N'dbo.Asset3D')
)
BEGIN
  ALTER TABLE dbo.Asset3D ADD [Description] NVARCHAR(MAX) NULL;
  PRINT 'Description column added';
END
ELSE
  PRINT 'Description already exists — skipped';
GO

-- Fix 3: Add Base64Data column if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.Asset3D')
)
BEGIN
  ALTER TABLE dbo.Asset3D ADD [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'Base64Data column added';
END
ELSE
  PRINT 'Base64Data already exists — skipped';
GO

-- Fix 4: Add Base64Data to AssetVersion if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.AssetVersion')
)
BEGIN
  ALTER TABLE dbo.AssetVersion ADD [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'AssetVersion.Base64Data column added';
END
ELSE
  PRINT 'AssetVersion.Base64Data already exists — skipped';
GO

-- Fix 5: Add BuyerUserId to MarketplaceOrder if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'BuyerUserId' AND object_id = OBJECT_ID(N'dbo.MarketplaceOrder')
)
BEGIN
  ALTER TABLE dbo.MarketplaceOrder ADD BuyerUserId INT NULL;
  ALTER TABLE dbo.MarketplaceOrder ADD CONSTRAINT FK_MarketplaceOrder_BuyerUser
    FOREIGN KEY (BuyerUserId) REFERENCES dbo.[User](UserId);
  PRINT 'BuyerUserId column added to MarketplaceOrder';
END
ELSE
  PRINT 'BuyerUserId already exists — skipped';
GO

-- Fix 6: Add MpOrderId to Payment if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'MpOrderId' AND object_id = OBJECT_ID(N'dbo.Payment')
)
BEGIN
  ALTER TABLE dbo.Payment ADD MpOrderId INT NULL;
  ALTER TABLE dbo.Payment ADD CONSTRAINT FK_Payment_MarketplaceOrder
    FOREIGN KEY (MpOrderId) REFERENCES dbo.MarketplaceOrder(MpOrderId);
  PRINT 'MpOrderId column added to Payment';
END
ELSE
  PRINT 'MpOrderId already exists — skipped';
GO

-- Fix 7: Add CreatedByUserId to CreativeOrder if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'CreatedByUserId' AND object_id = OBJECT_ID(N'dbo.CreativeOrder')
)
BEGIN
  ALTER TABLE dbo.CreativeOrder ADD CreatedByUserId INT NULL;
  ALTER TABLE dbo.CreativeOrder ADD CONSTRAINT FK_CreativeOrder_CreatedByUser
    FOREIGN KEY (CreatedByUserId) REFERENCES dbo.[User](UserId);
  PRINT 'CreatedByUserId column added to CreativeOrder';
END
ELSE
  PRINT 'CreatedByUserId already exists — skipped';
GO

PRINT '✅ Migration 002 complete';
GO
