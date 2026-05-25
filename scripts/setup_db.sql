USE master;
GO

IF DB_ID('ImmersiveVisionary') IS NOT NULL
BEGIN
    ALTER DATABASE ImmersiveVisionary SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE ImmersiveVisionary;
END
GO

CREATE DATABASE ImmersiveVisionary;
GO

USE ImmersiveVisionary;
GO

-- ROLE
CREATE TABLE Role (
    RoleId INT IDENTITY PRIMARY KEY,
    RoleName NVARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO Role (RoleName) VALUES
('ADMIN'),('MANAGER'),('ARTIST'),('CUSTOMER');

-- COMPANY
CREATE TABLE Company (
    CompanyId INT IDENTITY PRIMARY KEY,
    CompanyName NVARCHAR(200) NOT NULL,
    Address NVARCHAR(200),
    Email NVARCHAR(100),
    Phone NVARCHAR(50),
    Website NVARCHAR(200),
    CompanyType NVARCHAR(50) CHECK (CompanyType IN ('BRAND','AGENCY','STUDIO','SELLER')),
    Status NVARCHAR(50) DEFAULT 'ACTIVE'
        CHECK (Status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT DEFAULT 0
);

-- USER
CREATE TABLE [User] (
    UserId INT IDENTITY PRIMARY KEY,
    CompanyId INT NULL,
    RoleId INT NOT NULL,
    UserName NVARCHAR(100) UNIQUE NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(200) NOT NULL,
    Phone NVARCHAR(50),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT DEFAULT 0,
    FOREIGN KEY (CompanyId) REFERENCES Company(CompanyId) ON DELETE SET NULL,
    FOREIGN KEY (RoleId) REFERENCES Role(RoleId)
);

-- PRODUCT
CREATE TABLE Product (
    ProductId INT IDENTITY PRIMARY KEY,
    CompanyId INT NOT NULL,
    ProductName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    Category NVARCHAR(100),
    SizeInfo NVARCHAR(200),
    ColorInfo NVARCHAR(200),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT DEFAULT 0,
    FOREIGN KEY (CompanyId) REFERENCES Company(CompanyId) ON DELETE CASCADE
);

-- SERVICE PACKAGE
CREATE TABLE ServicePackage (
    PackageId INT IDENTITY PRIMARY KEY,
    PackageName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    BasePrice DECIMAL(12,2),
    EstimatedDays INT
);

-- CREATIVE ORDER (with all columns inline - nullable ProductId/PackageId, add-ons, etc.)
CREATE TABLE CreativeOrder (
    OrderId INT IDENTITY PRIMARY KEY,
    CompanyId INT NOT NULL,
    ProductId INT NULL,
    PackageId INT NULL,
    Brief NVARCHAR(MAX),
    TargetPlatform NVARCHAR(200),
    Status NVARCHAR(50) DEFAULT 'NEW'
        CHECK (Status IN ('NEW','IN_PRODUCTION','REVIEW','COMPLETED','DELIVERED','CANCELLED')),
    Deadline DATE,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT DEFAULT 0,
    ProjectName  NVARCHAR(200) NULL,
    ProductType  NVARCHAR(100) NULL,
    Budget       NVARCHAR(50)  NULL,
    DeliverySpeed NVARCHAR(50) NULL,
    ArOptimize   BIT DEFAULT 0,
    Animation    BIT DEFAULT 0,
    MultiVariant BIT DEFAULT 0,
    SourceFiles  BIT DEFAULT 0,
    FOREIGN KEY (CompanyId) REFERENCES Company(CompanyId),
    FOREIGN KEY (ProductId) REFERENCES Product(ProductId),
    FOREIGN KEY (PackageId) REFERENCES ServicePackage(PackageId)
);

-- ORDER ATTACHMENT
CREATE TABLE OrderAttachment (
    AttachmentId INT IDENTITY PRIMARY KEY,
    OrderId INT NOT NULL,
    FileName NVARCHAR(200) NOT NULL,
    MimeType NVARCHAR(100) NOT NULL,
    Base64Data VARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId) ON DELETE CASCADE
);

-- PRODUCTION STAGE
CREATE TABLE ProductionStage (
    StageId INT IDENTITY PRIMARY KEY,
    OrderId INT NOT NULL,
    StageName NVARCHAR(100)
        CHECK (StageName IN ('PHOTOSHOOT','MODELING','SCENE_DESIGN','POST_PROCESS')),
    StageOrder INT NOT NULL,
    AssignedTo INT NULL,
    StartDate DATETIME,
    EndDate DATETIME,
    Status NVARCHAR(50) DEFAULT 'PENDING'
        CHECK (Status IN ('PENDING','IN_PROGRESS','DONE')),
    FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId) ON DELETE CASCADE,
    FOREIGN KEY (AssignedTo) REFERENCES [User](UserId) ON DELETE SET NULL
);

-- ASSET 3D (with Description and Base64Data inline)
CREATE TABLE Asset3D (
    AssetId INT IDENTITY PRIMARY KEY,
    OrderId INT NULL,
    AssetName NVARCHAR(200) NOT NULL,
    PreviewImage NVARCHAR(500),
    CreatedBy INT NOT NULL,
    OwnerCompanyId INT NULL,
    AssetType NVARCHAR(50)
        CHECK (AssetType IN ('ORDER','MARKETPLACE','TEMPLATE')),
    Price DECIMAL(12,2) NULL,
    IsMarketplace BIT DEFAULT 0,
    Category NVARCHAR(100),
    Industry NVARCHAR(100),
    PublishStatus NVARCHAR(50) DEFAULT 'DRAFT'
        CHECK (PublishStatus IN ('DRAFT','PENDING','PUBLISHED','REJECTED')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    IsDeleted BIT DEFAULT 0,
    Description NVARCHAR(MAX) NULL,
    Base64Data VARCHAR(MAX) NULL,
    FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId) ON DELETE CASCADE,
    FOREIGN KEY (CreatedBy) REFERENCES [User](UserId),
    FOREIGN KEY (OwnerCompanyId) REFERENCES Company(CompanyId)
);

-- ASSET VERSION (with Base64Data inline)
CREATE TABLE AssetVersion (
    VersionId INT IDENTITY PRIMARY KEY,
    AssetId INT NOT NULL,
    FileFormat NVARCHAR(50)
        CHECK (FileFormat IN ('GLB','USDZ','FBX','WEBAR')),
    FileUrl NVARCHAR(500),
    PolyCount INT,
    TextureSize NVARCHAR(50),
    CreatedAt DATETIME DEFAULT GETDATE(),
    Base64Data VARCHAR(MAX) NULL,
    FOREIGN KEY (AssetId) REFERENCES Asset3D(AssetId) ON DELETE CASCADE
);

-- PAYMENT
CREATE TABLE Payment (
    PaymentId INT IDENTITY PRIMARY KEY,
    OrderId INT NULL,
    AssetId INT NULL,
    CompanyId INT NOT NULL,
    Amount DECIMAL(12,2) NOT NULL,
    PaymentType NVARCHAR(50)
        CHECK (PaymentType IN ('DEPOSIT','FULL','MILESTONE','ASSET')),
    PaymentStatus NVARCHAR(50) DEFAULT 'PENDING'
        CHECK (PaymentStatus IN ('PENDING','PAID','FAILED')),
    PaymentDate DATETIME,
    CHECK (
        (OrderId IS NOT NULL AND AssetId IS NULL)
        OR
        (OrderId IS NULL AND AssetId IS NOT NULL)
    ),
    FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId),
    FOREIGN KEY (AssetId) REFERENCES Asset3D(AssetId),
    FOREIGN KEY (CompanyId) REFERENCES Company(CompanyId)
);

-- DELIVERY
CREATE TABLE Delivery (
    DeliveryId INT IDENTITY PRIMARY KEY,
    OrderId INT NOT NULL,
    AssetId INT NOT NULL,
    DownloadUrl NVARCHAR(500),
    DeliveredAt DATETIME,
    Status NVARCHAR(50)
        CHECK (Status IN ('READY','DOWNLOADED')),
    FOREIGN KEY (OrderId) REFERENCES CreativeOrder(OrderId) ON DELETE CASCADE,
    FOREIGN KEY (AssetId) REFERENCES Asset3D(AssetId)
);

-- MARKETPLACE ORDER
CREATE TABLE MarketplaceOrder (
    MpOrderId INT IDENTITY PRIMARY KEY,
    AssetId INT NOT NULL,
    BuyerCompanyId INT NOT NULL,
    SellerCompanyId INT NOT NULL,
    Price DECIMAL(12,2),
    Status NVARCHAR(50)
        CHECK (Status IN ('PENDING','PAID','DELIVERED','REFUNDED')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AssetId) REFERENCES Asset3D(AssetId),
    FOREIGN KEY (BuyerCompanyId) REFERENCES Company(CompanyId),
    FOREIGN KEY (SellerCompanyId) REFERENCES Company(CompanyId)
);

-- REFRESH TOKEN
CREATE TABLE [RefreshToken] (
    [RefreshTokenId] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [Token] NVARCHAR(500) NOT NULL,
    [ExpiresAt] DATETIME NOT NULL,
    [Revoked] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [FK_RefreshToken_User] FOREIGN KEY ([UserId]) REFERENCES [User]([UserId])
);

-- INDEXES
CREATE INDEX IX_User_Email ON [User](Email);
CREATE INDEX IX_CreativeOrder_Status ON CreativeOrder(Status);
CREATE INDEX IX_Asset3D_IsMarketplace ON Asset3D(IsMarketplace);
CREATE INDEX IX_Asset3D_PublishStatus ON Asset3D(PublishStatus);
