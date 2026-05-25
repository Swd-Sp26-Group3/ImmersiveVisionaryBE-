
## Database migrations (SQL Server)

This project uses SQL Server via the `mssql` driver. Database schema changes are applied by running numbered `.sql` files in the `migrations/` folder.

### Run migrations

- Development (TypeScript): `npm run migrate`
- Production (compiled JS): `npm run migrate:prod`

The migrator will:

- Ensure the target database exists (connects to `master` first; requires permission).
- Create a tracking table `dbo.__Migrations`.
- Apply any new `migrations/*.sql` files (sorted by filename) exactly once.

### Typical Docker SQL Server (VPS)

If your SQL Server runs in Docker on the VPS, set these env vars for the backend container:

- `DB_SERVER` = the SQL Server hostname (e.g. `sqlserver` if same docker network)
- `DB_PORT` = `1433`
- `DB_USER` = `sa` (or your SQL login)
- `DB_PASSWORD` = your SQL password
- `DB_NAME` = `ImmersiveVisionary`

Then run `npm run migrate:prod` during deploy (before starting the API).

