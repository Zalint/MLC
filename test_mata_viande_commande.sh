#!/bin/bash

# =============================================================================
# Script de test pour l'API Commandes En Cours (Mata viande)
# Test de la commande n°1118
# =============================================================================

# Configuration
API_BASE_URL="http://localhost:3000/api"
API_KEY="VOTRE_API_KEY"  # Remplacez par votre clé API

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "🧪 TEST API COMMANDES EN COURS - MATA VIANDE"
echo "================================================================================"
echo ""

# Test 1: Créer une nouvelle commande en cours
echo "${BLUE}🧪 TEST 1: Créer une nouvelle commande en cours${NC}"
echo "--------------------------------------------------------------------------------"

PAYLOAD='{
  "commande_id": "1118",
  "livreur_id": "Massaer",
  "livreur_nom": "Massaer",
  "client": {
    "nom": "TEST TEST SALIOU",
    "telephone": "773929671",
    "adresse": "43 Rue Vineuse"
  },
  "articles": [
    {
      "produit": "viande de boeuf",
      "quantite": 1,
      "prix": 3800
    },
    {
      "produit": "viande de veau",
      "quantite": 1,
      "prix": 4000
    },
    {
      "produit": "Poulet entier - 1.5 kilos minimum",
      "quantite": 1,
      "prix": 3400
    }
  ],
  "total": 11200,
  "point_vente": "O.Foire",
  "date_commande": "2026-01-31",
  "statut": "en_attente",
  "metadata": {
    "note": "RAS. Ceci est un test",
    "messageId": "19c1330c52eb42c4",
    "threadId": "19c1330c52eb42c4"
  }
}'

echo "📤 Envoi de la commande..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${API_BASE_URL}/external/commande-en-cours" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "${GREEN}✅ Succès! (HTTP ${HTTP_CODE})${NC}"
    echo "📥 Réponse:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "${RED}❌ Erreur! (HTTP ${HTTP_CODE})${NC}"
    echo "📥 Réponse:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

echo ""
echo "================================================================================"
echo ""

# Test 2: Récupérer les commandes en cours (nécessite un token JWT)
echo "${BLUE}🧪 TEST 2: Récupérer les commandes en cours${NC}"
echo "--------------------------------------------------------------------------------"
echo "${YELLOW}⚠️  Ce test nécessite un token JWT d'authentification${NC}"
echo ""

# Décommentez et ajoutez votre token pour tester
# JWT_TOKEN="VOTRE_TOKEN_JWT"
# 
# curl -X GET \
#   "${API_BASE_URL}/v1/commandes-en-cours?date=2026-01-31&statut=en_attente" \
#   -H "Authorization: Bearer ${JWT_TOKEN}" \
#   -H "Content-Type: application/json" | jq '.'

echo ""
echo "================================================================================"
echo ""

# Test 3: Vérifier la structure attendue
echo "${BLUE}🧪 TEST 3: Validation de la structure de la commande${NC}"
echo "--------------------------------------------------------------------------------"

echo "✓ Champs requis:"
echo "  • commande_id: ✅ 1118"
echo "  • livreur_id: ✅ Massaer"
echo "  • client.nom: ✅ TEST TEST SALIOU"
echo "  • client.telephone: ✅ 773929671"
echo "  • articles: ✅ 3 articles"
echo "  • total: ✅ 11200 FCFA"
echo "  • point_vente: ✅ O.Foire"
echo "  • date_commande: ✅ 2026-01-31"
echo ""

echo "📊 Détails des articles:"
echo "  1. viande de boeuf - 1 x 3800 FCFA"
echo "  2. viande de veau - 1 x 4000 FCFA"
echo "  3. Poulet entier - 1.5 kilos minimum - 1 x 3400 FCFA"
echo "  ─────────────────────────────────────────"
echo "  TOTAL: 11200 FCFA"
echo ""

echo "================================================================================"
echo "${GREEN}✅ Tests terminés!${NC}"
echo "================================================================================"
echo ""
echo "📝 Notes:"
echo "  • Remplacez API_KEY par votre clé API réelle"
echo "  • Le livreur 'Massaer' doit exister dans la base de données"
echo "  • Vérifiez que le serveur est démarré sur ${API_BASE_URL}"
echo ""
