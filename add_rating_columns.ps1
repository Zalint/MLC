# Script PowerShell pour ajouter les colonnes de notation MATA
# Exécute le fichier SQL add_rating_columns.sql

param(
    [string]$ConnectionString = $null,
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$Database = "matix_livreur",
    [string]$Username = "postgres",
    [string]$Password = $null
)

Write-Host "🚀 Ajout des colonnes de notation MATA..." -ForegroundColor Green

# Vérifier si le fichier SQL existe
if (-not (Test-Path "add_rating_columns.sql")) {
    Write-Host "❌ Erreur: Le fichier add_rating_columns.sql n'existe pas dans le répertoire courant." -ForegroundColor Red
    exit 1
}

try {
    # Si une chaîne de connexion n'est pas fournie, construire une
    if (-not $ConnectionString) {
        if (-not $Password) {
            $Password = Read-Host "Mot de passe PostgreSQL" -AsSecureString
            $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
        }
        
        $ConnectionString = "Host=$Host;Port=$Port;Database=$Database;Username=$Username;Password=$Password"
    }

    Write-Host "📂 Lecture du fichier SQL..." -ForegroundColor Yellow
    $sqlContent = Get-Content "add_rating_columns.sql" -Raw

    Write-Host "🔗 Connexion à la base de données..." -ForegroundColor Yellow
    
    # Utiliser psql pour exécuter le SQL
    $env:PGPASSWORD = $Password
    $result = psql -h $Host -p $Port -d $Database -U $Username -f "add_rating_columns.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration réussie ! Les colonnes de notation ont été ajoutées avec succès." -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Colonnes ajoutées:" -ForegroundColor Cyan
        Write-Host "   • service_rating (DECIMAL 3,1) - Note du service de livraison (0-10)" -ForegroundColor White
        Write-Host "   • quality_rating (DECIMAL 3,1) - Note de la qualité des produits (0-10)" -ForegroundColor White
        Write-Host "   • price_rating (DECIMAL 3,1) - Note du niveau des prix pratiqués (0-10)" -ForegroundColor White
        Write-Host ""
        Write-Host "🎯 Index créé pour optimiser les requêtes de filtrage par notes." -ForegroundColor Cyan
    } else {
        Write-Host "❌ Erreur lors de l'exécution de la migration." -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer la variable d'environnement du mot de passe
    $env:PGPASSWORD = $null
}

Write-Host ""
Write-Host "🚀 Vous pouvez maintenant redémarrer votre application backend pour utiliser les nouvelles fonctionnalités de notation !" -ForegroundColor Green 