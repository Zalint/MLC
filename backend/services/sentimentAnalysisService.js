// Service d'analyse de sentiment avec OpenAI

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyse les commentaires d'un client avec OpenAI
 * @param {Array} orders - Historique des commandes avec commentaires
 * @param {Object} clientInfo - Informations du client
 * @returns {Object} - Analyse de sentiment détaillée
 */
async function analyzeClientSentiment(orders, clientInfo) {
  try {
    // Extraire les commentaires non vides
    const comments = orders
      .filter(order => order.commentaire && order.commentaire.trim() !== '' && order.commentaire !== '-')
      .map(order => ({
        date: order.date,
        commentaire: order.commentaire,
        rating: calculateAverageRating(order)
      }));

    if (comments.length === 0) {
      return {
        overall_sentiment: 'neutral',
        sentiment_score: 0,
        confidence: 0,
        positive_comments: 0,
        neutral_comments: 0,
        negative_comments: 0,
        keywords: {
          positive: [],
          negative: [],
          neutral: []
        },
        recommendations: 'Aucun commentaire disponible pour l\'analyse.',
        summary: 'Client sans historique de commentaires.'
      };
    }

    // Construire le prompt pour OpenAI
    const prompt = `Tu es un expert en analyse de sentiment pour un service de livraison au Sénégal.

Analyse les commentaires suivants d'un client nommé "${clientInfo.name || 'Client'}" qui a passé ${orders.length} commandes :

${comments.map((c, i) => `${i + 1}. [${c.date}] Note: ${c.rating}/10 - "${c.commentaire}"`).join('\n')}

Fournis une analyse JSON structurée avec:
1. overall_sentiment: "positive", "neutral" ou "negative"
2. sentiment_score: score de -1 (très négatif) à 1 (très positif)
3. confidence: niveau de confiance 0-1
4. positive_comments: nombre de commentaires positifs
5. neutral_comments: nombre de commentaires neutres
6. negative_comments: nombre de commentaires négatifs
7. keywords: {positive: [...], negative: [...], neutral: [...]}
8. recommendations: recommandations en français pour améliorer le service
9. summary: résumé de la satisfaction client en 1-2 phrases

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse de sentiment. Tu réponds toujours en JSON valide, sans texte additionnel.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Valeur par défaut pour analyse précise
      max_tokens: 1000   // Valeur par défaut suffisante pour l'analyse
    });

    const content = response.choices[0].message.content.trim();
    
    // Nettoyer le JSON (enlever les backticks markdown si présents)
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const analysis = JSON.parse(jsonContent);

    // Ajouter des métadonnées
    analysis.total_comments_analyzed = comments.length;
    analysis.analyzed_at = new Date().toISOString();
    analysis.model_used = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    return analysis;

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse de sentiment:', error);
    
    // Fallback: analyse basique sans OpenAI
    return performBasicSentimentAnalysis(orders);
  }
}

/**
 * Calcule la note moyenne d'une commande
 */
function calculateAverageRating(order) {
  const ratings = [
    order.service_rating,
    order.quality_rating,
    order.price_rating,
    order.commercial_service_rating
  ].filter(r => r !== null && r !== undefined).map(r => parseFloat(r));

  if (ratings.length === 0) return 'N/A';
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
}

/**
 * Analyse de sentiment basique (fallback si OpenAI échoue)
 */
function performBasicSentimentAnalysis(orders) {
  const comments = orders
    .filter(order => order.commentaire && order.commentaire.trim() !== '')
    .map(order => order.commentaire.toLowerCase());

  const positiveWords = ['satisfait', 'content', 'excellent', 'rapide', 'bon', 'merci', 'super', 'parfait', 'top', 'recommande'];
  const negativeWords = ['mécontent', 'déçu', 'retard', 'froid', 'mauvais', 'lent', 'problème', 'pas content'];

  let positiveCount = 0;
  let negativeCount = 0;

  comments.forEach(comment => {
    const hasPositive = positiveWords.some(word => comment.includes(word));
    const hasNegative = negativeWords.some(word => comment.includes(word));

    if (hasPositive && !hasNegative) positiveCount++;
    else if (hasNegative && !hasPositive) negativeCount++;
  });

  const neutralCount = comments.length - positiveCount - negativeCount;
  const sentimentScore = comments.length > 0 
    ? (positiveCount - negativeCount) / comments.length 
    : 0;

  let overall_sentiment = 'neutral';
  if (sentimentScore > 0.3) overall_sentiment = 'positive';
  else if (sentimentScore < -0.3) overall_sentiment = 'negative';

  return {
    overall_sentiment,
    sentiment_score: sentimentScore,
    confidence: 0.6,
    positive_comments: positiveCount,
    neutral_comments: neutralCount,
    negative_comments: negativeCount,
    keywords: {
      positive: positiveWords.filter(w => comments.some(c => c.includes(w))),
      negative: negativeWords.filter(w => comments.some(c => c.includes(w))),
      neutral: []
    },
    recommendations: 'Analyse basique effectuée. Connecter OpenAI pour une analyse détaillée.',
    summary: `Client avec ${positiveCount} commentaires positifs, ${neutralCount} neutres et ${negativeCount} négatifs.`,
    total_comments_analyzed: comments.length,
    analyzed_at: new Date().toISOString(),
    model_used: 'basic-fallback'
  };
}

module.exports = {
  analyzeClientSentiment
};

