# Setup script for Matix Livreur PostgreSQL database
$PGPATH = "C:\Program Files\PostgreSQL\17\bin"
$POSTGRES_PASSWORD = "mlc2024"

Write-Host "Setting up Matix Livreur database..." -ForegroundColor Green

# Set PGPASSWORD environment variable to avoid password prompts
$env:PGPASSWORD = $POSTGRES_PASSWORD

try {
    # Create database and user
    Write-Host "Creating database and user..." -ForegroundColor Yellow
    
    & "$PGPATH\psql.exe" -U postgres -c "CREATE DATABASE matix_livreur;"
    & "$PGPATH\psql.exe" -U postgres -c "CREATE USER matix_user WITH PASSWORD 'mlc2024';"
    & "$PGPATH\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE matix_livreur TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -c "ALTER USER matix_user CREATEDB;"
    
    Write-Host "Database and user created successfully!" -ForegroundColor Green
    
    # Run migration script
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U matix_user -d matix_livreur -f "backend\scripts\migrate.sql"
    
    Write-Host "Migrations completed!" -ForegroundColor Green
    
    # Run seed script
    Write-Host "Seeding database with default users..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U matix_user -d matix_livreur -f "backend\scripts\seed.sql"
    
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    Write-Host "You can now start the application with: npm start" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error during database setup: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Clear the password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
} 