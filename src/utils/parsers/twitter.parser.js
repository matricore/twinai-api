/**
 * Twitter/X Data Export Parser
 * Parses JS/JSON files from Twitter's "Download Your Data" feature
 * 
 * Twitter exports use .js files with format: window.YTD.xxx.part0 = [...]
 */

/**
 * Extract JSON data from Twitter's JS export format
 * @param {string} content - Raw JS file content
 * @returns {Array|Object} Parsed data
 */
const extractTwitterData = (content) => {
  try {
    // Twitter format: window.YTD.xxx.part0 = [...]
    const match = content.match(/=\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*;?\s*$/);
    if (match) {
      return JSON.parse(match[1]);
    }
    // Try direct JSON parse
    return JSON.parse(content);
  } catch {
    return null;
  }
};

/**
 * Parse tweets
 * @param {Array} data - tweet.js content
 * @returns {Object[]} Parsed tweets
 */
const parseTweets = (data) => {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    const tweet = item.tweet || item;
    return {
      type: 'tweet',
      id: tweet.id_str || tweet.id,
      timestamp: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      content: tweet.full_text || tweet.text || '',
      isRetweet: (tweet.full_text || tweet.text || '').startsWith('RT @'),
      isReply: !!tweet.in_reply_to_user_id_str,
      replyTo: tweet.in_reply_to_screen_name || null,
      likes: parseInt(tweet.favorite_count) || 0,
      retweets: parseInt(tweet.retweet_count) || 0,
      hashtags: tweet.entities?.hashtags?.map((h) => h.text) || [],
      mentions: tweet.entities?.user_mentions?.map((m) => m.screen_name) || [],
    };
  }).filter((t) => t.content && !t.isRetweet); // Exclude retweets
};

/**
 * Parse likes
 * @param {Array} data - like.js content
 * @returns {Object[]} Parsed likes
 */
const parseLikes = (data) => {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    const like = item.like || item;
    return {
      type: 'like',
      tweetId: like.tweetId,
      fullText: like.fullText || '',
      expandedUrl: like.expandedUrl || null,
    };
  }).filter((l) => l.fullText);
};

/**
 * Parse direct messages
 * @param {Array} data - direct-messages.js content
 * @param {string} ownerId - Owner's Twitter user ID
 * @returns {Object[]} Parsed DMs
 */
const parseDirectMessages = (data, ownerId = null) => {
  if (!Array.isArray(data)) return [];

  const messages = [];

  for (const conversation of data) {
    const dmConversation = conversation.dmConversation || conversation;
    const conversationId = dmConversation.conversationId;
    
    const msgs = dmConversation.messages || [];
    
    for (const msgWrapper of msgs) {
      const msg = msgWrapper.messageCreate || msgWrapper;
      if (!msg.text) continue;

      messages.push({
        type: 'dm',
        conversationId,
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        senderId: msg.senderId,
        content: msg.text,
        isOwner: ownerId ? msg.senderId === ownerId : null,
      });
    }
  }

  return messages.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Parse profile information
 * @param {Array} data - profile.js content
 * @returns {Object} Profile data
 */
const parseProfile = (data) => {
  if (!Array.isArray(data) || !data[0]) return null;

  const profile = data[0].profile || data[0];
  
  return {
    username: profile.username || '',
    displayName: profile.displayName || '',
    bio: profile.description?.bio || '',
    location: profile.description?.location || '',
    website: profile.description?.website || '',
    createdAt: profile.createdAt ? new Date(profile.createdAt) : null,
  };
};

/**
 * Parse account information (for getting user ID)
 * @param {Array} data - account.js content
 * @returns {Object} Account data
 */
const parseAccount = (data) => {
  if (!Array.isArray(data) || !data[0]) return null;

  const account = data[0].account || data[0];
  
  return {
    accountId: account.accountId,
    username: account.username,
    email: account.email,
    createdAt: account.createdAt ? new Date(account.createdAt) : null,
  };
};

/**
 * Main parser - handles Twitter export files
 * @param {Object} files - Object with filename keys and raw content values
 * @returns {Object} Complete parsed Twitter data
 */
const parseTwitterExport = (files) => {
  const result = {
    profile: null,
    account: null,
    tweets: [],
    likes: [],
    directMessages: [],
    stats: {},
  };

  // First pass: get account info for owner ID
  for (const [filename, content] of Object.entries(files)) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('account.js') || lowerName === 'account.json') {
      const data = extractTwitterData(content);
      if (data) {
        result.account = parseAccount(data);
      }
    }
  }

  const ownerId = result.account?.accountId;

  // Second pass: parse all data
  for (const [filename, content] of Object.entries(files)) {
    const lowerName = filename.toLowerCase();
    const data = extractTwitterData(content);
    
    if (!data) continue;

    if (lowerName.includes('profile.js') || lowerName === 'profile.json') {
      result.profile = parseProfile(data);
    } else if (lowerName.includes('tweet.js') || lowerName.includes('tweets.js')) {
      result.tweets.push(...parseTweets(data));
    } else if (lowerName.includes('like.js') || lowerName.includes('likes.js')) {
      result.likes.push(...parseLikes(data));
    } else if (lowerName.includes('direct-message') || lowerName.includes('dm')) {
      result.directMessages.push(...parseDirectMessages(data, ownerId));
    }
  }

  // Calculate stats
  const originalTweets = result.tweets.filter((t) => !t.isReply);
  const replies = result.tweets.filter((t) => t.isReply);
  
  result.stats = {
    tweetsCount: result.tweets.length,
    originalTweetsCount: originalTweets.length,
    repliesCount: replies.length,
    likesCount: result.likes.length,
    dmsCount: result.directMessages.length,
    totalItems: result.tweets.length + result.directMessages.length,
  };

  // Sort by date
  result.tweets.sort((a, b) => b.timestamp - a.timestamp);

  return result;
};

/**
 * Extract content for AI analysis
 * @param {Object} parsedData - Parsed Twitter data
 * @returns {Object} Data ready for AI analysis
 */
const extractForAnalysis = (parsedData) => {
  // Get original tweets (not replies)
  const originalTweets = parsedData.tweets
    .filter((t) => !t.isReply && t.content.length > 20)
    .slice(0, 50)
    .map((t) => t.content);

  // Get replies
  const replies = parsedData.tweets
    .filter((t) => t.isReply && t.content.length > 20)
    .slice(0, 30)
    .map((t) => t.content);

  // Get owner's DMs
  const ownerDMs = parsedData.directMessages
    .filter((m) => m.isOwner && m.content.length > 20)
    .slice(0, 30)
    .map((m) => m.content);

  // Get all hashtags used
  const hashtags = [...new Set(parsedData.tweets.flatMap((t) => t.hashtags))].slice(0, 30);

  // Get liked content samples
  const likedContent = parsedData.likes
    .filter((l) => l.fullText && l.fullText.length > 20)
    .slice(0, 20)
    .map((l) => l.fullText);

  return {
    profile: parsedData.profile,
    account: parsedData.account,
    originalTweets,
    replies,
    ownerDMs,
    hashtags,
    likedContent,
    stats: parsedData.stats,
    sampleSize: {
      tweets: originalTweets.length,
      replies: replies.length,
      dms: ownerDMs.length,
      liked: likedContent.length,
    },
  };
};

module.exports = {
  parseTwitterExport,
  extractForAnalysis,
  extractTwitterData,
  parseTweets,
  parseLikes,
  parseDirectMessages,
};

