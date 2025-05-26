# Simple setup script for Matix Livreur PostgreSQL database
$PGPATH = "C:\Program Files\PostgreSQL\17\bin"

Write-Host "Setting up Matix Livreur database..." -ForegroundColor Green
Write-Host "Please enter the PostgreSQL postgres user password when prompted." -ForegroundColor Yellow

try {
    # Create database
    Write-Host "Creating database..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS matix_livreur;"
    & "$PGPATH\psql.exe" -U postgres -c "CREATE DATABASE matix_livreur;"
    
    # Create user
    Write-Host "Creating user..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U postgres -c "DROP USER IF EXISTS matix_user;"
    & "$PGPATH\psql.exe" -U postgres -c "CREATE USER matix_user WITH PASSWORD 'mlc2024';"
    & "$PGPATH\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE matix_livreur TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -c "ALTER USER matix_user CREATEDB;"
    
    # Grant schema permissions
    Write-Host "Setting up permissions..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "GRANT ALL ON SCHEMA public TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO matix_user;"
    
    Write-Host "Database and user created successfully!" -ForegroundColor Green
    
    # Run migration script as postgres user
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -f "backend\scripts\migrate.sql"
    
    Write-Host "Migrations completed!" -ForegroundColor Green
    
    # Grant permissions on created tables
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO matix_user;"
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO matix_user;"
    
    # Run seed script as postgres user
    Write-Host "Seeding database with default users..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U postgres -d matix_livreur -f "backend\scripts\seed.sql"
    
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    Write-Host "You can now start the application with: npm start" -ForegroundColor Cyan
    
    # Test connection
    Write-Host "Testing connection..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U matix_user -d matix_livreur -c "SELECT COUNT(*) as user_count FROM users;"
    
} catch {
    Write-Host "Error during database setup: $($_.Exception.Message)" -ForegroundColor Red
} 