/**
 * Instagram Data Export Parser
 * Parses JSON files from Instagram's "Download Your Information" feature
 */

/**
 * Decode Instagram's Unicode escape sequences
 * Instagram exports use \u00xx format for non-ASCII characters
 */
const decodeInstagramText = (text) => {
  if (!text) return '';
  try {
    // Handle Instagram's weird encoding
    return text.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
  } catch {
    return text;
  }
};

/**
 * Parse Instagram posts
 * @param {Object} data - posts_1.json content
 * @returns {Object[]} Parsed posts
 */
const parsePosts = (data) => {
  if (!Array.isArray(data)) return [];
  
  return data.map((post) => {
    const media = post.media?.[0] || {};
    return {
      type: 'post',
      timestamp: media.creation_timestamp 
        ? new Date(media.creation_timestamp * 1000) 
        : new Date(),
      caption: decodeInstagramText(media.title || ''),
      uri: media.uri || null,
    };
  }).filter((p) => p.caption); // Only posts with captions
};

/**
 * Parse Instagram stories
 * @param {Object} data - stories.json content
 * @returns {Object[]} Parsed stories
 */
const parseStories = (data) => {
  if (!data?.ig_stories) return [];
  
  return data.ig_stories.map((story) => ({
    type: 'story',
    timestamp: story.creation_timestamp 
      ? new Date(story.creation_timestamp * 1000) 
      : new Date(),
    caption: decodeInstagramText(story.title || ''),
    uri: story.uri || null,
  })).filter((s) => s.caption);
};

/**
 * Parse Instagram reels
 * @param {Object} data - reels.json content
 * @returns {Object[]} Parsed reels
 */
const parseReels = (data) => {
  if (!data?.ig_reels_media) return [];
  
  return data.ig_reels_media.map((reel) => ({
    type: 'reel',
    timestamp: reel.creation_timestamp 
      ? new Date(reel.creation_timestamp * 1000) 
      : new Date(),
    caption: decodeInstagramText(reel.title || ''),
    uri: reel.uri || null,
  })).filter((r) => r.caption);
};

/**
 * Parse liked posts
 * @param {Object} data - liked_posts.json content
 * @returns {Object[]} Parsed likes
 */
const parseLikes = (data) => {
  const likes = data?.likes_media_likes || [];
  
  return likes.map((like) => {
    const stringData = like.string_list_data?.[0] || {};
    return {
      type: 'like',
      timestamp: stringData.timestamp 
        ? new Date(stringData.timestamp * 1000) 
        : new Date(),
      href: stringData.href || null,
      value: decodeInstagramText(stringData.value || ''),
    };
  });
};

/**
 * Parse saved posts
 * @param {Object} data - saved_posts.json content
 * @returns {Object[]} Parsed saved posts
 */
const parseSavedPosts = (data) => {
  const saved = data?.saved_saved_media || [];
  
  return saved.map((item) => {
    const stringData = item.string_map_data || {};
    return {
      type: 'saved',
      timestamp: stringData.Saved?.timestamp 
        ? new Date(stringData.Saved.timestamp * 1000) 
        : new Date(),
      caption: decodeInstagramText(stringData['Caption']?.value || ''),
    };
  }).filter((s) => s.caption);
};

/**
 * Parse Instagram messages (DMs)
 * @param {Object} data - message_1.json content from inbox folder
 * @param {string} ownerName - Name of the account owner
 * @returns {Object[]} Parsed messages
 */
const parseMessages = (data, ownerName = null) => {
  if (!data?.messages) return [];
  
  const participants = data.participants?.map((p) => decodeInstagramText(p.name)) || [];
  
  return data.messages
    .filter((msg) => msg.content) // Only text messages
    .map((msg) => ({
      type: 'message',
      timestamp: msg.timestamp_ms 
        ? new Date(msg.timestamp_ms) 
        : new Date(),
      sender: decodeInstagramText(msg.sender_name || ''),
      content: decodeInstagramText(msg.content || ''),
      isOwner: ownerName 
        ? msg.sender_name?.toLowerCase().includes(ownerName.toLowerCase())
        : null,
      participants,
    }));
};

/**
 * Parse comments made by user
 * @param {Object} data - post_comments_1.json content
 * @returns {Object[]} Parsed comments
 */
const parseComments = (data) => {
  if (!Array.isArray(data)) return [];
  
  return data.map((comment) => {
    const stringData = comment.string_map_data || {};
    return {
      type: 'comment',
      timestamp: stringData.Time?.timestamp 
        ? new Date(stringData.Time.timestamp * 1000) 
        : new Date(),
      content: decodeInstagramText(stringData.Comment?.value || ''),
      mediaOwner: decodeInstagramText(stringData['Media Owner']?.value || ''),
    };
  }).filter((c) => c.content);
};

/**
 * Parse profile information
 * @param {Object} data - profile.json or personal_information.json content
 * @returns {Object} Profile data
 */
const parseProfile = (data) => {
  const profile = data?.profile_user?.[0]?.string_map_data || {};
  
  return {
    username: decodeInstagramText(profile.Username?.value || ''),
    name: decodeInstagramText(profile.Name?.value || ''),
    bio: decodeInstagramText(profile.Bio?.value || ''),
    email: profile.Email?.value || '',
    phone: profile['Phone Number']?.value || '',
    gender: profile.Gender?.value || '',
    dateOfBirth: profile['Date of Birth']?.value || '',
  };
};

/**
 * Main parser - handles ZIP or individual JSON files
 * @param {Object} files - Object with filename keys and parsed JSON values
 * @param {string} ownerName - Name of the account owner
 * @returns {Object} Complete parsed Instagram data
 */
const parseInstagramExport = (files, ownerName = null) => {
  const result = {
    profile: null,
    posts: [],
    stories: [],
    reels: [],
    likes: [],
    saved: [],
    messages: [],
    comments: [],
    stats: {},
  };

  for (const [filename, data] of Object.entries(files)) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('profile') || lowerName.includes('personal_information')) {
      result.profile = parseProfile(data);
    } else if (lowerName.includes('posts_') || lowerName === 'posts.json') {
      result.posts.push(...parsePosts(data));
    } else if (lowerName.includes('stories')) {
      result.stories.push(...parseStories(data));
    } else if (lowerName.includes('reels')) {
      result.reels.push(...parseReels(data));
    } else if (lowerName.includes('liked_posts') || lowerName.includes('likes')) {
      result.likes.push(...parseLikes(data));
    } else if (lowerName.includes('saved')) {
      result.saved.push(...parseSavedPosts(data));
    } else if (lowerName.includes('message_')) {
      result.messages.push(...parseMessages(data, ownerName));
    } else if (lowerName.includes('comments')) {
      result.comments.push(...parseComments(data));
    }
  }

  // Calculate stats
  result.stats = {
    postsCount: result.posts.length,
    storiesCount: result.stories.length,
    reelsCount: result.reels.length,
    likesCount: result.likes.length,
    savedCount: result.saved.length,
    messagesCount: result.messages.length,
    commentsCount: result.comments.length,
    totalItems: result.posts.length + result.stories.length + result.reels.length + 
                result.messages.length + result.comments.length,
  };

  // Sort by date
  result.posts.sort((a, b) => b.timestamp - a.timestamp);
  result.messages.sort((a, b) => b.timestamp - a.timestamp);

  return result;
};

/**
 * Extract content for AI analysis
 * @param {Object} parsedData - Parsed Instagram data
 * @param {string} ownerName - Owner's name for filtering messages
 * @returns {Object} Data ready for AI analysis
 */
const extractForAnalysis = (parsedData, ownerName) => {
  // Get post captions
  const postCaptions = parsedData.posts
    .filter((p) => p.caption && p.caption.length > 10)
    .slice(0, 50)
    .map((p) => p.caption);

  // Get owner's messages
  const ownerMessages = parsedData.messages
    .filter((m) => m.isOwner && m.content && m.content.length > 10)
    .slice(0, 50)
    .map((m) => m.content);

  // Get comments
  const userComments = parsedData.comments
    .slice(0, 30)
    .map((c) => c.content);

  return {
    profile: parsedData.profile,
    postCaptions,
    ownerMessages,
    userComments,
    stats: parsedData.stats,
    sampleSize: {
      posts: postCaptions.length,
      messages: ownerMessages.length,
      comments: userComments.length,
    },
  };
};

module.exports = {
  parseInstagramExport,
  extractForAnalysis,
  decodeInstagramText,
  parsePosts,
  parseMessages,
  parseComments,
  parseLikes,
};

