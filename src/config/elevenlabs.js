const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const config = require('./index');

let client = null;

const getClient = () => {
  if (!client && config.elevenlabs.apiKey) {
    client = new ElevenLabsClient({
      apiKey: config.elevenlabs.apiKey,
    });
  }
  return client;
};

module.exports = { getClient };

