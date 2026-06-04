USE ImmersiveVisionary;
GO

IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.AssetVersion')
    AND [definition] NOT LIKE N'%OBJ%'
)
BEGIN
  DECLARE @constraintName NVARCHAR(200);

  SELECT TOP 1 @constraintName = name
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.AssetVersion')
    AND [definition] LIKE N'%FileFormat%';

  IF @constraintName IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE dbo.AssetVersion DROP CONSTRAINT [' + @constraintName + ']');
    PRINT 'Dropped old constraint: ' + @constraintName;
  END

  ALTER TABLE dbo.AssetVersion
    ADD CONSTRAINT CK_AssetVersion_FileFormat
    CHECK (FileFormat IN (N'GLB', N'USDZ', N'FBX', N'WEBAR', N'OBJ'));

  PRINT 'New constraint CK_AssetVersion_FileFormat added with OBJ included.';
END
ELSE
BEGIN
  PRINT 'Constraint already includes OBJ — no changes made.';
END
GO
