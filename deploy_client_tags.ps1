# ========================================
# Script de déploiement du système de tags clients
# Version: 1.0
# ========================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Déploiement du Système de Tags Clients      " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis .env
if (Test-Path ".env") {
    Write-Host "📄 Chargement des variables d'environnement..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "⚠️  Fichier .env non trouvé" -ForegroundColor Red
    Write-Host "Veuillez configurer vos variables d'environnement manuellement" -ForegroundColor Yellow
    Write-Host ""
}

# Récupérer les informations de connexion
$DB_HOST = $env:DB_HOST
$DB_PORT = $env:DB_PORT
$DB_NAME = $env:DB_NAME
$DB_USER = $env:DB_USER
$DB_PASSWORD = $env:DB_PASSWORD

if (-not $DB_HOST) {
    Write-Host "❌ Variables de base de données non configurées" -ForegroundColor Red
    Write-Host "Veuillez configurer DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Configuration détectée:" -ForegroundColor Green
Write-Host "   Host: $DB_HOST" -ForegroundColor Gray
Write-Host "   Port: $DB_PORT" -ForegroundColor Gray
Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
Write-Host "   User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Demander confirmation
$confirmation = Read-Host "Continuer avec le déploiement? (O/N)"
if ($confirmation -ne "O" -and $confirmation -ne "o") {
    Write-Host "❌ Déploiement annulé" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "ÉTAPE 1 : Exécution du script SQL" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Construire la commande psql
$env:PGPASSWORD = $DB_PASSWORD
$psqlCommand = "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f add_client_tags.sql"

Write-Host "Exécution: $psqlCommand" -ForegroundColor Yellow
Write-Host ""

try {
    # Exécuter le script SQL
    & cmd /c "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f add_client_tags.sql 2>&1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Script SQL exécuté avec succès!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Le script SQL s'est terminé avec des warnings (code: $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host "Vérifiez les messages ci-dessus pour plus de détails" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'exécution du script SQL" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "ÉTAPE 2 : Vérification de la colonne" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$verifyQuery = "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'client_credits' AND column_name = 'client_tag';"
$verifyCommand = "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c `"$verifyQuery`""

Write-Host "Vérification de la colonne client_tag..." -ForegroundColor Yellow
& cmd /c $verifyCommand

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "ÉTAPE 3 : Statistiques des tags" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$statsQuery = "SELECT COALESCE(client_tag, 'STANDARD') as tag, COUNT(*) as count FROM client_credits GROUP BY client_tag ORDER BY count DESC;"
$statsCommand = "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c `"$statsQuery`""

Write-Host "Récupération des statistiques..." -ForegroundColor Yellow
& cmd /c $statsCommand

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "ÉTAPE 4 : Redémarrage du backend (optionnel)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$restartBackend = Read-Host "Voulez-vous redémarrer le backend maintenant? (O/N)"

if ($restartBackend -eq "O" -or $restartBackend -eq "o") {
    Write-Host ""
    Write-Host "🔄 Redémarrage du backend..." -ForegroundColor Yellow
    
    # Vérifier si PM2 est installé
    $pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
    
    if ($pm2Installed) {
        Write-Host "Utilisation de PM2..." -ForegroundColor Gray
        & pm2 restart matix-backend
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Backend redémarré avec PM2" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Erreur lors du redémarrage PM2 (code: $LASTEXITCODE)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "PM2 non trouvé. Redémarrage manuel nécessaire:" -ForegroundColor Yellow
        Write-Host "  cd backend" -ForegroundColor Gray
        Write-Host "  npm restart" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  N'oubliez pas de redémarrer le backend manuellement:" -ForegroundColor Yellow
    Write-Host "  cd backend && npm restart" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Déploiement terminé!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Consultez CLIENT_TAGS_GUIDE.md pour plus d'informations" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Tester l'API: POST /api/v1/clients/credits avec client_tag" -ForegroundColor Gray
Write-Host "  2. Vérifier l'API audit: GET /api/external/mata/audit/client" -ForegroundColor Gray
Write-Host "  3. Mettre à jour le frontend pour afficher les badges" -ForegroundColor Gray
Write-Host ""
