// Script de test pour l'API externe d'audit client MATA
// IMPORTANT: NE JAMAIS COMMITER CE FICHIER AVEC LA VRAIE CLÉ API

require('dotenv').config();

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:4000/api/external';
const API_KEY = process.env.EXTERNAL_API_KEY; // Lue depuis .env

if (!API_KEY) {
  console.error('❌ EXTERNAL_API_KEY non trouvée dans .env');
  process.exit(1);
}

// Numéros de test dans différents formats
const testPhoneNumbers = [
  '773929671',           // Format local Sénégal
  '221773929671',        // Format international Sénégal
  '00221773929671',      // Format avec 00
  '+221773929671',       // Format avec +
  
  '679854465',           // Format local France (sans 0)
  '0679854465',          // Format national France
  '33679854465',         // Format international France
  '0033679854465',       // Format avec 00
  
  '4436273965',          // Format local USA
  '14436273965',         // Format international USA
  '0014436273965'        // Format avec 00
];

async function testClientAudit(phoneNumber) {
  console.log('\n' + '='.repeat(80));
  console.log(`📞 Test avec numéro: ${phoneNumber}`);
  console.log('='.repeat(80));

  try {
    const response = await fetch(`${API_BASE_URL}/mata/audit/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: phoneNumber
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erreur:', data.error);
      return;
    }

    console.log('✅ Succès !');
    console.log('\n📊 Résumé:');
    console.log(`   - Client: ${data.client_info.name}`);
    console.log(`   - Téléphone normalisé: ${data.normalized_phone}`);
    console.log(`   - Pays: ${data.country}`);
    console.log(`   - Nombre de commandes: ${data.client_info.total_orders}`);
    console.log(`   - Montant total: ${data.statistics.total_amount.toFixed(2)} FCFA`);
    console.log(`   - Note moyenne: ${data.statistics.avg_rating || 'N/A'}/10`);

    console.log('\n🤖 Analyse de sentiment:');
    console.log(`   - Sentiment global: ${data.sentiment_analysis.overall_sentiment}`);
    console.log(`   - Score: ${data.sentiment_analysis.sentiment_score.toFixed(2)}`);
    console.log(`   - Positifs: ${data.sentiment_analysis.positive_comments}`);
    console.log(`   - Neutres: ${data.sentiment_analysis.neutral_comments}`);
    console.log(`   - Négatifs: ${data.sentiment_analysis.negative_comments}`);
    console.log(`   - Modèle: ${data.sentiment_analysis.model_used}`);

    if (data.sentiment_analysis.summary) {
      console.log(`\n💡 Résumé: ${data.sentiment_analysis.summary}`);
    }

    if (data.sentiment_analysis.recommendations) {
      console.log(`\n📋 Recommandations: ${data.sentiment_analysis.recommendations}`);
    }

    // Afficher quelques commentaires
    const commentsWithText = data.orders_history.filter(o => o.commentaire && o.commentaire !== '-');
    if (commentsWithText.length > 0) {
      console.log(`\n💬 Derniers commentaires (${Math.min(3, commentsWithText.length)}):`);
      commentsWithText.slice(0, 3).forEach((order, i) => {
        console.log(`   ${i + 1}. [${order.date}] ${order.commentaire}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
  }
}

// Fonction principale
async function main() {
  console.log('\n🚀 TEST DE L\'API EXTERNE D\'AUDIT CLIENT MATA');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_BASE_URL}/mata/audit/client`);
  console.log(`API KEY: ${API_KEY.substring(0, 10)}...`);

  // Demander quel numéro tester
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n📝 Usage:');
    console.log('   node test_external_api_EXAMPLE.js <phone_number>');
    console.log('\n📞 Exemples de numéros:');
    testPhoneNumbers.forEach(num => console.log(`   - ${num}`));
    console.log('\n💡 Ou testez tous les formats:');
    console.log('   node test_external_api_EXAMPLE.js all');
    return;
  }

  if (args[0] === 'all') {
    console.log('\n🔄 Test de tous les formats...');
    for (const phone of testPhoneNumbers) {
      await testClientAudit(phone);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pause entre les requêtes
    }
  } else {
    await testClientAudit(args[0]);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Tests terminés !');
  console.log('='.repeat(80) + '\n');
}

main();

