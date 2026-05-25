$server = $env:DB_SERVER ?? "localhost"
$sqlFile = Join-Path $PSScriptRoot "setup_db.sql"

# Use SQL auth if DB_USER/DB_PASSWORD env vars are set, else Windows Auth
if ($env:DB_USER -and $env:DB_PASSWORD) {
    $connStr = "Server=$server;User Id=$($env:DB_USER);Password=$($env:DB_PASSWORD);TrustServerCertificate=True;"
    Write-Host "Using SQL Server authentication as '$($env:DB_USER)'" -ForegroundColor Yellow
} else {
    $connStr = "Server=$server;Integrated Security=True;TrustServerCertificate=True;"
    Write-Host "Using Windows Authentication" -ForegroundColor Yellow
}
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)

try {
    $conn.Open()
    Write-Host "Connected via Windows Auth to SQL Server $($conn.ServerVersion)" -ForegroundColor Green

    $sqlContent = Get-Content -Path $sqlFile -Raw

    # Split on GO statements (batch separator)
    $batches = $sqlContent -split '\r?\nGO\r?\n|\r?\nGO$'

    $batchNum = 0
    foreach ($batch in $batches) {
        $trimmed = $batch.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }

        $batchNum++
        try {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $trimmed
            $cmd.CommandTimeout = 60
            $cmd.ExecuteNonQuery() | Out-Null
            Write-Host "  Batch $batchNum OK" -ForegroundColor Cyan
        } catch {
            Write-Host "  Batch $batchNum FAILED: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  SQL: $($trimmed.Substring(0, [Math]::Min(300, $trimmed.Length)))" -ForegroundColor Yellow
        }
    }

    Write-Host "`nDone! Database ImmersiveVisionary has been recreated." -ForegroundColor Green
} catch {
    Write-Host "Connection failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($conn.State -eq 'Open') { $conn.Close() }
}
