SET NOCOUNT ON;

/*
  Initial schema for ImmersiveVisionary.
  - Safe to run multiple times (creates objects only if missing).
  - Does NOT drop the database.
*/

-- ROLE
IF OBJECT_ID(N'dbo.Role', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Role (
    RoleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Role PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL CONSTRAINT UQ_Role_RoleName UNIQUE
  );
END

-- Seed roles (idempotent)
IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE RoleName = N'ADMIN')
  INSERT INTO dbo.Role (RoleName) VALUES (N'ADMIN');
IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE RoleName = N'MANAGER')
  INSERT INTO dbo.Role (RoleName) VALUES (N'MANAGER');
IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE RoleName = N'ARTIST')
  INSERT INTO dbo.Role (RoleName) VALUES (N'ARTIST');
IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE RoleName = N'CUSTOMER')
  INSERT INTO dbo.Role (RoleName) VALUES (N'CUSTOMER');
GO

-- COMPANY
IF OBJECT_ID(N'dbo.Company', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Company (
    CompanyId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Company PRIMARY KEY,
    CompanyName NVARCHAR(200) NOT NULL,
    Address NVARCHAR(200) NULL,
    Email NVARCHAR(100) NULL,
    Phone NVARCHAR(50) NULL,
    Website NVARCHAR(200) NULL,
    CompanyType NVARCHAR(50) NULL,
    Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Company_Status DEFAULT N'ACTIVE',
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_Company_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Company_IsDeleted DEFAULT (0),

    CONSTRAINT CK_Company_CompanyType CHECK (CompanyType IN (N'BRAND', N'AGENCY', N'STUDIO', N'SELLER')),
    CONSTRAINT CK_Company_Status CHECK (Status IN (N'ACTIVE', N'INACTIVE', N'SUSPENDED'))
  );
END
GO

-- USER
IF OBJECT_ID(N'dbo.[User]', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.[User] (
    UserId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_User PRIMARY KEY,
    CompanyId INT NULL,
    RoleId INT NOT NULL,
    UserName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL,
    PasswordHash NVARCHAR(200) NOT NULL,
    Phone NVARCHAR(50) NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_User_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_User_IsDeleted DEFAULT (0),

    CONSTRAINT UQ_User_UserName UNIQUE (UserName),
    CONSTRAINT UQ_User_Email UNIQUE (Email),

    CONSTRAINT FK_User_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId) ON DELETE SET NULL,
    CONSTRAINT FK_User_Role FOREIGN KEY (RoleId) REFERENCES dbo.Role(RoleId)
  );
END
GO

-- PRODUCT
IF OBJECT_ID(N'dbo.Product', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Product (
    ProductId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Product PRIMARY KEY,
    CompanyId INT NOT NULL,
    ProductName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    Category NVARCHAR(100) NULL,
    SizeInfo NVARCHAR(200) NULL,
    ColorInfo NVARCHAR(200) NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_Product_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Product_IsDeleted DEFAULT (0),

    CONSTRAINT FK_Product_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId) ON DELETE CASCADE
  );
END
GO

-- SERVICE PACKAGE
IF OBJECT_ID(N'dbo.ServicePackage', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ServicePackage (
    PackageId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServicePackage PRIMARY KEY,
    PackageName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    BasePrice DECIMAL(12,2) NULL,
    EstimatedDays INT NULL
  );
END
GO

-- CREATIVE ORDER
IF OBJECT_ID(N'dbo.CreativeOrder', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CreativeOrder (
    OrderId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CreativeOrder PRIMARY KEY,
    CompanyId INT NOT NULL,
    CreatedByUserId INT NULL,
    ProductId INT NULL,
    PackageId INT NULL,
    Brief NVARCHAR(MAX) NULL,
    TargetPlatform NVARCHAR(200) NULL,
    Status NVARCHAR(50) NOT NULL CONSTRAINT DF_CreativeOrder_Status DEFAULT N'NEW',
    Deadline DATE NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_CreativeOrder_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CreativeOrder_IsDeleted DEFAULT (0),

    -- Custom Production fields
    ProjectName NVARCHAR(200) NULL,
    ProductType NVARCHAR(100) NULL,
    Budget NVARCHAR(50) NULL,
    DeliverySpeed NVARCHAR(50) NULL,
    ArOptimize BIT NOT NULL CONSTRAINT DF_CreativeOrder_ArOptimize DEFAULT (0),
    Animation BIT NOT NULL CONSTRAINT DF_CreativeOrder_Animation DEFAULT (0),
    MultiVariant BIT NOT NULL CONSTRAINT DF_CreativeOrder_MultiVariant DEFAULT (0),
    SourceFiles BIT NOT NULL CONSTRAINT DF_CreativeOrder_SourceFiles DEFAULT (0),

    CONSTRAINT CK_CreativeOrder_Status CHECK (Status IN (N'NEW', N'IN_PRODUCTION', N'REVIEW', N'COMPLETED', N'DELIVERED', N'CANCELLED')),

    CONSTRAINT FK_CreativeOrder_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId),
    CONSTRAINT FK_CreativeOrder_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.[User](UserId),
    CONSTRAINT FK_CreativeOrder_Product FOREIGN KEY (ProductId) REFERENCES dbo.Product(ProductId),
    CONSTRAINT FK_CreativeOrder_ServicePackage FOREIGN KEY (PackageId) REFERENCES dbo.ServicePackage(PackageId)
  );
END
ELSE
BEGIN
  -- Ensure nullable ProductId/PackageId
  IF EXISTS (SELECT 1 FROM sys.columns WHERE name = N'ProductId' AND object_id = OBJECT_ID(N'dbo.CreativeOrder') AND is_nullable = 0)
    ALTER TABLE dbo.CreativeOrder ALTER COLUMN ProductId INT NULL;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE name = N'PackageId' AND object_id = OBJECT_ID(N'dbo.CreativeOrder') AND is_nullable = 0)
    ALTER TABLE dbo.CreativeOrder ALTER COLUMN PackageId INT NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'CreatedByUserId' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD CreatedByUserId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_CreativeOrder_CreatedByUser' AND parent_object_id = OBJECT_ID(N'dbo.CreativeOrder')
  )
    ALTER TABLE dbo.CreativeOrder ADD CONSTRAINT FK_CreativeOrder_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.[User](UserId);

  -- Add missing custom production columns
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'ProjectName' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD ProjectName NVARCHAR(200) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'ProductType' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD ProductType NVARCHAR(100) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'Budget' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD Budget NVARCHAR(50) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'DeliverySpeed' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD DeliverySpeed NVARCHAR(50) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'ArOptimize' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD ArOptimize BIT NOT NULL CONSTRAINT DF_CreativeOrder_ArOptimize_2 DEFAULT (0);
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'Animation' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD Animation BIT NOT NULL CONSTRAINT DF_CreativeOrder_Animation_2 DEFAULT (0);
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'MultiVariant' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD MultiVariant BIT NOT NULL CONSTRAINT DF_CreativeOrder_MultiVariant_2 DEFAULT (0);
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'SourceFiles' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
    ALTER TABLE dbo.CreativeOrder ADD SourceFiles BIT NOT NULL CONSTRAINT DF_CreativeOrder_SourceFiles_2 DEFAULT (0);
END
GO

-- PRODUCTION STAGE
IF OBJECT_ID(N'dbo.ProductionStage', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductionStage (
    StageId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionStage PRIMARY KEY,
    OrderId INT NOT NULL,
    StageName NVARCHAR(100) NOT NULL,
    StageOrder INT NOT NULL,
    AssignedTo INT NULL,
    StartDate DATETIME NULL,
    EndDate DATETIME NULL,
    Status NVARCHAR(50) NOT NULL CONSTRAINT DF_ProductionStage_Status DEFAULT N'PENDING',

    CONSTRAINT CK_ProductionStage_StageName CHECK (StageName IN (N'PHOTOSHOOT', N'MODELING', N'SCENE_DESIGN', N'POST_PROCESS')),
    CONSTRAINT CK_ProductionStage_Status CHECK (Status IN (N'PENDING', N'IN_PROGRESS', N'DONE')),

    CONSTRAINT FK_ProductionStage_Order FOREIGN KEY (OrderId) REFERENCES dbo.CreativeOrder(OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_ProductionStage_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES dbo.[User](UserId) ON DELETE SET NULL
  );
END
GO

-- ASSET 3D
IF OBJECT_ID(N'dbo.Asset3D', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Asset3D (
    AssetId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Asset3D PRIMARY KEY,
    OrderId INT NULL,
    AssetName NVARCHAR(200) NOT NULL,
    PreviewImage NVARCHAR(MAX) NULL,

    CreatedBy INT NOT NULL,
    OwnerCompanyId INT NULL,

    AssetType NVARCHAR(50) NULL,

    Price DECIMAL(12,2) NULL,
    IsMarketplace BIT NOT NULL CONSTRAINT DF_Asset3D_IsMarketplace DEFAULT (0),
    Category NVARCHAR(100) NULL,
    Industry NVARCHAR(100) NULL,

    PublishStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_Asset3D_PublishStatus DEFAULT N'DRAFT',

    CreatedAt DATETIME NOT NULL CONSTRAINT DF_Asset3D_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Asset3D_IsDeleted DEFAULT (0),

    Description NVARCHAR(MAX) NULL,
    Base64Data VARCHAR(MAX) NULL,

    CONSTRAINT CK_Asset3D_AssetType CHECK (AssetType IS NULL OR AssetType IN (N'ORDER', N'MARKETPLACE', N'TEMPLATE')),
    CONSTRAINT CK_Asset3D_PublishStatus CHECK (PublishStatus IN (N'DRAFT', N'PENDING', N'PUBLISHED', N'REJECTED')),

    CONSTRAINT FK_Asset3D_Order FOREIGN KEY (OrderId) REFERENCES dbo.CreativeOrder(OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_Asset3D_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.[User](UserId),
    CONSTRAINT FK_Asset3D_OwnerCompany FOREIGN KEY (OwnerCompanyId) REFERENCES dbo.Company(CompanyId)
  );
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'Description' AND object_id = OBJECT_ID(N'dbo.Asset3D'))
    ALTER TABLE dbo.Asset3D ADD Description NVARCHAR(MAX) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.Asset3D'))
    ALTER TABLE dbo.Asset3D ADD Base64Data VARCHAR(MAX) NULL;
END
GO

-- ASSET VERSION
IF OBJECT_ID(N'dbo.AssetVersion', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AssetVersion (
    VersionId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AssetVersion PRIMARY KEY,
    AssetId INT NOT NULL,
    FileFormat NVARCHAR(50) NOT NULL,
    FileUrl NVARCHAR(500) NULL,
    PolyCount INT NULL,
    TextureSize NVARCHAR(50) NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_AssetVersion_CreatedAt DEFAULT GETDATE(),

    Base64Data VARCHAR(MAX) NULL,

    CONSTRAINT CK_AssetVersion_FileFormat CHECK (FileFormat IN (N'GLB', N'USDZ', N'FBX', N'WEBAR')),

    CONSTRAINT FK_AssetVersion_Asset FOREIGN KEY (AssetId) REFERENCES dbo.Asset3D(AssetId) ON DELETE CASCADE
  );
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.AssetVersion'))
    ALTER TABLE dbo.AssetVersion ADD Base64Data VARCHAR(MAX) NULL;
END
GO

-- MARKETPLACE ORDER
IF OBJECT_ID(N'dbo.MarketplaceOrder', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MarketplaceOrder (
    MpOrderId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MarketplaceOrder PRIMARY KEY,
    AssetId INT NOT NULL,
    BuyerCompanyId INT NOT NULL,
    BuyerUserId INT NULL,
    SellerCompanyId INT NOT NULL,
    Price DECIMAL(12,2) NULL,
    Status NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_MarketplaceOrder_CreatedAt DEFAULT GETDATE(),

    CONSTRAINT CK_MarketplaceOrder_Status CHECK (Status IN (N'PENDING', N'PAID', N'DELIVERED', N'REFUNDED')),

    CONSTRAINT FK_MarketplaceOrder_Asset FOREIGN KEY (AssetId) REFERENCES dbo.Asset3D(AssetId),
    CONSTRAINT FK_MarketplaceOrder_BuyerCompany FOREIGN KEY (BuyerCompanyId) REFERENCES dbo.Company(CompanyId),
    CONSTRAINT FK_MarketplaceOrder_BuyerUser FOREIGN KEY (BuyerUserId) REFERENCES dbo.[User](UserId),
    CONSTRAINT FK_MarketplaceOrder_SellerCompany FOREIGN KEY (SellerCompanyId) REFERENCES dbo.Company(CompanyId)
  );
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'BuyerUserId' AND object_id = OBJECT_ID(N'dbo.MarketplaceOrder'))
    ALTER TABLE dbo.MarketplaceOrder ADD BuyerUserId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_MarketplaceOrder_BuyerUser' AND parent_object_id = OBJECT_ID(N'dbo.MarketplaceOrder')
  )
    ALTER TABLE dbo.MarketplaceOrder ADD CONSTRAINT FK_MarketplaceOrder_BuyerUser FOREIGN KEY (BuyerUserId) REFERENCES dbo.[User](UserId);
END
GO

-- PAYMENT
IF OBJECT_ID(N'dbo.Payment', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Payment (
    PaymentId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payment PRIMARY KEY,
    OrderId INT NULL,
    AssetId INT NULL,
    CompanyId INT NOT NULL,
    Amount DECIMAL(12,2) NOT NULL,

    PaymentType NVARCHAR(50) NOT NULL,
    PaymentStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_Payment_PaymentStatus DEFAULT N'PENDING',
    PaymentDate DATETIME NULL,

    MpOrderId INT NULL,

    CONSTRAINT CK_Payment_PaymentType CHECK (PaymentType IN (N'DEPOSIT', N'FULL', N'MILESTONE', N'ASSET')),
    CONSTRAINT CK_Payment_PaymentStatus CHECK (PaymentStatus IN (N'PENDING', N'PAID', N'FAILED')),
    CONSTRAINT CK_Payment_OrderOrAsset CHECK (
      (OrderId IS NOT NULL AND AssetId IS NULL)
      OR
      (OrderId IS NULL AND AssetId IS NOT NULL)
    ),

    CONSTRAINT FK_Payment_Order FOREIGN KEY (OrderId) REFERENCES dbo.CreativeOrder(OrderId),
    CONSTRAINT FK_Payment_Asset FOREIGN KEY (AssetId) REFERENCES dbo.Asset3D(AssetId),
    CONSTRAINT FK_Payment_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Company(CompanyId),
    CONSTRAINT FK_Payment_MarketplaceOrder FOREIGN KEY (MpOrderId) REFERENCES dbo.MarketplaceOrder(MpOrderId)
  );
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'MpOrderId' AND object_id = OBJECT_ID(N'dbo.Payment'))
    ALTER TABLE dbo.Payment ADD MpOrderId INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Payment_MarketplaceOrder' AND parent_object_id = OBJECT_ID(N'dbo.Payment')
  )
    ALTER TABLE dbo.Payment ADD CONSTRAINT FK_Payment_MarketplaceOrder FOREIGN KEY (MpOrderId) REFERENCES dbo.MarketplaceOrder(MpOrderId);
END
GO

-- DELIVERY
IF OBJECT_ID(N'dbo.Delivery', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Delivery (
    DeliveryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Delivery PRIMARY KEY,
    OrderId INT NOT NULL,
    AssetId INT NOT NULL,
    DownloadUrl NVARCHAR(500) NULL,
    DeliveredAt DATETIME NULL,
    Status NVARCHAR(50) NOT NULL,

    CONSTRAINT CK_Delivery_Status CHECK (Status IN (N'READY', N'DOWNLOADED')),

    CONSTRAINT FK_Delivery_Order FOREIGN KEY (OrderId) REFERENCES dbo.CreativeOrder(OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_Delivery_Asset FOREIGN KEY (AssetId) REFERENCES dbo.Asset3D(AssetId)
  );
END
GO

-- REFRESH TOKEN
IF OBJECT_ID(N'dbo.RefreshToken', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.RefreshToken (
    RefreshTokenId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshToken PRIMARY KEY,
    UserId INT NOT NULL,
    Token NVARCHAR(500) NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    Revoked BIT NOT NULL CONSTRAINT DF_RefreshToken_Revoked DEFAULT (0),
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_RefreshToken_CreatedAt DEFAULT GETDATE(),
    CONSTRAINT FK_RefreshToken_User FOREIGN KEY (UserId) REFERENCES dbo.[User](UserId)
  );
END
GO

-- ORDER ATTACHMENT
IF OBJECT_ID(N'dbo.OrderAttachment', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderAttachment (
    AttachmentId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderAttachment PRIMARY KEY,
    OrderId INT NOT NULL,
    FileName NVARCHAR(200) NOT NULL,
    MimeType NVARCHAR(100) NOT NULL,
    Base64Data VARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_OrderAttachment_CreatedAt DEFAULT GETDATE(),

    CONSTRAINT FK_OrderAttachment_Order FOREIGN KEY (OrderId) REFERENCES dbo.CreativeOrder(OrderId) ON DELETE CASCADE
  );
END
GO

-- INDEXES
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_User_Email' AND object_id = OBJECT_ID(N'dbo.[User]'))
  CREATE INDEX IX_User_Email ON dbo.[User](Email);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CreativeOrder_Status' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
  CREATE INDEX IX_CreativeOrder_Status ON dbo.CreativeOrder(Status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CreativeOrder_CreatedByUserId' AND object_id = OBJECT_ID(N'dbo.CreativeOrder'))
  CREATE INDEX IX_CreativeOrder_CreatedByUserId ON dbo.CreativeOrder(CreatedByUserId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Asset3D_IsMarketplace' AND object_id = OBJECT_ID(N'dbo.Asset3D'))
  CREATE INDEX IX_Asset3D_IsMarketplace ON dbo.Asset3D(IsMarketplace);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Asset3D_PublishStatus' AND object_id = OBJECT_ID(N'dbo.Asset3D'))
  CREATE INDEX IX_Asset3D_PublishStatus ON dbo.Asset3D(PublishStatus);
GO
