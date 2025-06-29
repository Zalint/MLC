#!/bin/bash
# =====================================================
# COMMANDES DE DÉPLOIEMENT GPS MATIX LIVREUR
# =====================================================
# Script pour automatiser le déploiement GPS sur Render
# =====================================================

echo "🚀 Déploiement GPS MATIX LIVREUR sur Render"
echo "=============================================="

# Variables
DATABASE_URL=${DATABASE_URL:-"postgresql://user:password@host:port/database"}

echo ""
echo "📋 Étapes de déploiement :"
echo "1. Déploiement base de données"
echo "2. Vérification post-déploiement" 
echo "3. Tests API"
echo ""

# Étape 1 : Déploiement base de données
echo "🗄️ ÉTAPE 1: Déploiement base de données..."
if [ -f "deploy-gps-render.sql" ]; then
    echo "Exécution du script SQL de déploiement..."
    psql $DATABASE_URL -f deploy-gps-render.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Déploiement base de données réussi"
    else
        echo "❌ Erreur lors du déploiement base de données"
        exit 1
    fi
else
    echo "❌ Fichier deploy-gps-render.sql non trouvé"
    exit 1
fi

echo ""

# Étape 2 : Vérification
echo "🔍 ÉTAPE 2: Vérification post-déploiement..."
if [ -f "verify-gps-deployment.sql" ]; then
    echo "Exécution des vérifications..."
    psql $DATABASE_URL -f verify-gps-deployment.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Vérifications terminées"
    else
        echo "⚠️ Des erreurs ont été détectées lors des vérifications"
    fi
else
    echo "⚠️ Fichier verify-gps-deployment.sql non trouvé"
fi

echo ""

# Étape 3 : Tests API (optionnel)
echo "🧪 ÉTAPE 3: Tests API (optionnel)..."
read -p "Voulez-vous tester les endpoints GPS ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Entrez l'URL de votre app Render (ex: https://myapp.onrender.com): " APP_URL
    read -p "Entrez votre JWT token pour les tests: " JWT_TOKEN
    
    echo "Test de l'endpoint /api/gps/stats..."
    curl -X GET "$APP_URL/api/gps/stats" \
         -H "Authorization: Bearer $JWT_TOKEN" \
         -H "Content-Type: application/json"
    
    echo ""
    echo "Test de l'endpoint /api/gps/analytics/overview..."
    curl -X GET "$APP_URL/api/gps/analytics/overview" \
         -H "Authorization: Bearer $JWT_TOKEN" \
         -H "Content-Type: application/json"
    
    echo ""
    echo "✅ Tests API terminés"
fi

echo ""
echo "🎉 DÉPLOIEMENT GPS TERMINÉ !"
echo ""
echo "📋 Checklist post-déploiement :"
echo "- [ ] Vérifier les logs Render pour erreurs"
echo "- [ ] Uploader les assets Leaflet dans frontend/assets/"
echo "- [ ] Ajouter la section GPS dans index.html" 
echo "- [ ] Tester l'interface GPS côté manager"
echo "- [ ] Activer le GPS pour au moins un livreur"
echo "- [ ] Tester l'enregistrement de positions GPS"
echo ""
echo "📖 Consultez README_GPS_DEPLOY.md pour plus de détails" 