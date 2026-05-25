SET NOCOUNT ON;

/*
  Compatibility patch for production databases created before user-link columns existed.
  Safe to run multiple times.
*/

-- CreativeOrder.CreatedByUserId (used by order service joins/inserts)
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
END
GO

-- MarketplaceOrder.BuyerUserId (used by marketplace order creation flows)
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
GO

-- Optional index to speed up "my orders" lookup by creator
IF OBJECT_ID(N'dbo.CreativeOrder', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_CreativeOrder_CreatedByUserId'
      AND object_id = OBJECT_ID(N'dbo.CreativeOrder')
  )
    CREATE INDEX IX_CreativeOrder_CreatedByUserId ON dbo.CreativeOrder(CreatedByUserId);
END
GO
