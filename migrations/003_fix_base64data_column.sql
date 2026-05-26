USE ImmersiveVisionary;
GO

-- ─── Migration 003: Fix Base64Data column types ───────────────────────────────
--
-- Root cause: The `Base64Data` column on Asset3D (and AssetVersion) was created
-- with a fixed VARCHAR length on the production database (not VARCHAR(MAX)).
-- The mssql driver validates string length against the declared column type and
-- throws "value out of range" when the base64 string exceeds that length.
-- This migration forces both columns to VARCHAR(MAX) regardless of their current state.

-- Fix 1: Ensure Asset3D.Base64Data is VARCHAR(MAX)
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data'
    AND object_id = OBJECT_ID(N'dbo.Asset3D')
    AND max_length != -1   -- -1 = MAX; anything else means a fixed/too-small size
)
BEGIN
  ALTER TABLE dbo.Asset3D ALTER COLUMN [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'Asset3D.Base64Data altered to VARCHAR(MAX)';
END
ELSE IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.Asset3D')
)
BEGIN
  ALTER TABLE dbo.Asset3D ADD [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'Asset3D.Base64Data column added as VARCHAR(MAX)';
END
ELSE
  PRINT 'Asset3D.Base64Data already VARCHAR(MAX) — skipped';
GO

-- Fix 2: Ensure AssetVersion.Base64Data is VARCHAR(MAX)
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data'
    AND object_id = OBJECT_ID(N'dbo.AssetVersion')
    AND max_length != -1
)
BEGIN
  ALTER TABLE dbo.AssetVersion ALTER COLUMN [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'AssetVersion.Base64Data altered to VARCHAR(MAX)';
END
ELSE IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE name = N'Base64Data' AND object_id = OBJECT_ID(N'dbo.AssetVersion')
)
BEGIN
  ALTER TABLE dbo.AssetVersion ADD [Base64Data] VARCHAR(MAX) NULL;
  PRINT 'AssetVersion.Base64Data column added as VARCHAR(MAX)';
END
ELSE
  PRINT 'AssetVersion.Base64Data already VARCHAR(MAX) — skipped';
GO

PRINT '✅ Migration 003 complete';
GO
