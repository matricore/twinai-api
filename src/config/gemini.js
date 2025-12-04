const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./index');

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// Chat model - using stable version
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.8,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  },
});

// Vision model - for image analysis
const visionModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 4096,
  },
});

module.exports = { genAI, model, visionModel };
