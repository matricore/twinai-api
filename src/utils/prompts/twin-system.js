/**
 * Generate system prompt for the AI twin based on user's profile and memories
 * @param {Object} twinProfile - User's twin profile data
 * @param {Object[]} relevantMemories - Semantically relevant memories
 * @returns {string} System prompt for Gemini
 */
const generateTwinSystemPrompt = (twinProfile, relevantMemories = []) => {
  const { personalityTraits, communicationStyle, interests, preferences, learnedFacts } = twinProfile;

  const traitsStr = Object.keys(personalityTraits).length
    ? `Kişilik özelliklerin: ${JSON.stringify(personalityTraits)}`
    : '';

  const styleStr = Object.keys(communicationStyle).length
    ? `İletişim tarzın: ${JSON.stringify(communicationStyle)}`
    : '';

  const interestsStr = interests?.length
    ? `İlgi alanların: ${interests.join(', ')}`
    : '';

  const factsStr = Array.isArray(learnedFacts) && learnedFacts.length
    ? `Öğrendiğin bilgiler: ${JSON.stringify(learnedFacts)}`
    : '';

  const memoriesStr = relevantMemories.length
    ? `\nİLGİLİ ANILAR/BİLGİLER:\n${relevantMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
    : '';

  return `Sen kullanıcının dijital ikizi, AI destekli kişisel klonusun. Amacın kullanıcıyı mümkün olduğunca iyi anlamak ve onun gibi düşünüp konuşabilmek.

TEMEL KURALLAR:
1. Kullanıcıyla doğal ve samimi bir şekilde sohbet et
2. Her konuşmadan yeni şeyler öğrenmeye çalış (tercihleri, alışkanlıkları, düşünce yapısı)
3. Kullanıcının tarzını taklit etmeye çalış - ama bunu yaparken samimi ol
4. Emin olmadığın konularda soru sorarak netleştir
5. Kısa ve öz cevaplar ver, gerekmedikçe uzatma
6. Türkçe konuş (kullanıcı başka dilde yazarsa o dilde cevap ver)
7. Anılarını ve öğrendiklerini doğal şekilde kullan - "veritabanımda yazıyor" gibi ifadeler KULLANMA

KULLANICI PROFİLİ:
${traitsStr}
${styleStr}
${interestsStr}
${factsStr}
${Object.keys(preferences || {}).length ? `Tercihler: ${JSON.stringify(preferences)}` : ''}
${memoriesStr}

ÖNEMLİ: Yukarıdaki bilgileri doğal konuşma içinde kullan. "Hatırladığıma göre..." veya "Daha önce söylemiştin..." gibi doğal ifadeler kullanabilirsin.`.trim();
};

/**
 * Generate prompt for analyzing a message and extracting insights/memories
 * @param {string} message - User's message
 * @param {Object} context - Conversation context
 * @returns {string} Analysis prompt
 */
const generateAnalysisPrompt = (message, context = {}) => {
  return `Aşağıdaki mesajı analiz et ve kullanıcı hakkında çıkarımlar yap.

MESAJ: "${message}"

${context.previousMessages ? `ÖNCEKİ MESAJLAR: ${JSON.stringify(context.previousMessages)}` : ''}

Şu formatta JSON döndür:
{
  "insights": [
    {
      "category": "personality|preference|behavior|memory",
      "key": "tespit_edilen_özellik",
      "value": "değer",
      "confidence": 0.0-1.0
    }
  ],
  "memories": [
    {
      "content": "hatırlanması gereken bilgi (tam cümle)",
      "summary": "kısa özet",
      "category": "fact|preference|experience|relationship|habit",
      "importance": 0.0-1.0
    }
  ],
  "suggestedQuestions": ["kullanıcıya sorulabilecek açıklayıcı sorular"]
}

KURALLAR:
- Sadece kesin veya yüksek olasılıklı çıkarımları ekle
- Genel/belirsiz bilgileri ekleme
- Önemli kişisel bilgileri (isimler, tarihler, tercihler) memory olarak kaydet
- Eğer mesajdan anlamlı bir çıkarım yapamıyorsan boş diziler döndür`;
};

module.exports = {
  generateTwinSystemPrompt,
  generateAnalysisPrompt,
};
