/**
 * WhatsApp Chat Export Parser
 * Supports multiple export formats from different WhatsApp versions
 */

// Common date/time patterns in WhatsApp exports
const PATTERNS = [
  // [DD.MM.YYYY, HH:MM:SS] Name: Message (Turkish/European format with dots)
  /^\[(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*([^:]+):\s*(.+)$/,
  // [DD/MM/YYYY, HH:MM:SS] Name: Message
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*([^:]+):\s*(.+)$/,
  // DD.MM.YYYY, HH:MM - Name: Message (without brackets)
  /^(\d{1,2}\.\d{1,2}\.\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s*([^:]+):\s*(.+)$/,
  // DD/MM/YYYY, HH:MM - Name: Message
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s*([^:]+):\s*(.+)$/,
  // MM/DD/YY, HH:MM AM/PM - Name: Message (US format)
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[APap][Mm])\s*-\s*([^:]+):\s*(.+)$/,
];

// System messages to skip
const SYSTEM_PATTERNS = [
  /mesaj(lar)?\s*(silindi|değiştirildi)/i,
  /messages?\s*(deleted|changed)/i,
  /\<media omitted\>/i,
  /\<medya dahil edilmedi\>/i,
  /güvenlik kodu/i,
  /security code/i,
  /şifreleme/i,
  /encryption/i,
  /grub(a|dan)/i,
  /group/i,
  /eklendi|çıkarıldı|ayrıldı/i,
  /added|removed|left/i,
  /bu sohbetin/i,
  /uçtan uca/i,
];

/**
 * Parse WhatsApp export text into structured messages
 * @param {string} content - Raw export file content
 * @param {string} ownerName - Name of the chat owner (to identify their messages)
 * @returns {Object} Parsed chat data
 */
const parseWhatsAppExport = (content, ownerName = null) => {
  const lines = content.split('\n');
  const messages = [];
  const participants = new Set();
  let currentMessage = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let matched = false;

    for (const pattern of PATTERNS) {
      const match = trimmedLine.match(pattern);
      if (match) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const [, date, time, sender, text] = match;
        const senderName = sender.trim();

        // Skip system messages
        if (isSystemMessage(text) || isSystemMessage(senderName)) {
          currentMessage = null;
          matched = true;
          break;
        }

        participants.add(senderName);

        currentMessage = {
          timestamp: parseDateTime(date, time),
          sender: senderName,
          content: text.trim(),
          isOwner: ownerName ? senderName.toLowerCase().includes(ownerName.toLowerCase()) : null,
        };

        matched = true;
        break;
      }
    }

    // If no pattern matched, it's a continuation of previous message
    if (!matched && currentMessage) {
      currentMessage.content += '\n' + trimmedLine;
    }
  }

  // Don't forget the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return {
    messageCount: messages.length,
    participants: Array.from(participants),
    messages,
    dateRange: messages.length > 0 ? {
      start: messages[0].timestamp,
      end: messages[messages.length - 1].timestamp,
    } : null,
  };
};

/**
 * Check if message is a system message
 */
const isSystemMessage = (text) => {
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * Parse date and time string to Date object
 * Supports both / and . separators
 */
const parseDateTime = (dateStr, timeStr) => {
  try {
    // Replace dots with slashes for uniform processing
    const normalizedDate = dateStr.replace(/\./g, '/');
    const dateParts = normalizedDate.split('/');
    let day, month, year;

    if (dateParts[0].length === 4) {
      // YYYY/MM/DD
      [year, month, day] = dateParts;
    } else if (parseInt(dateParts[0]) > 12) {
      // DD/MM/YYYY (European) - day > 12
      [day, month, year] = dateParts;
    } else if (parseInt(dateParts[1]) > 12) {
      // MM/DD/YYYY (US) - second part > 12 means it's day
      [month, day, year] = dateParts;
    } else {
      // Ambiguous - assume DD/MM/YYYY (European default)
      [day, month, year] = dateParts;
    }

    // Handle 2-digit year
    if (year.length === 2) {
      year = '20' + year;
    }

    // Parse time
    let hours, minutes, seconds = 0;
    const timeParts = timeStr.replace(/\s*[APap][Mm]/, '').split(':');
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    if (timeParts[2]) {
      seconds = parseInt(timeParts[2]);
    }

    // Handle AM/PM
    if (/[Pp][Mm]/.test(timeStr) && hours < 12) {
      hours += 12;
    } else if (/[Aa][Mm]/.test(timeStr) && hours === 12) {
      hours = 0;
    }

    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch {
    return new Date();
  }
};

/**
 * Extract key information from parsed messages for AI analysis
 * @param {Object[]} messages - Parsed messages
 * @param {string} ownerName - Owner's name
 * @returns {Object} Extracted data for analysis
 */
const extractForAnalysis = (messages, ownerName) => {
  const ownerMessages = messages.filter((m) => 
    m.sender.toLowerCase().includes(ownerName.toLowerCase())
  );

  // Group messages by date for pattern analysis
  const messagesByDate = {};
  ownerMessages.forEach((m) => {
    const dateKey = m.timestamp.toISOString().split('T')[0];
    if (!messagesByDate[dateKey]) {
      messagesByDate[dateKey] = [];
    }
    messagesByDate[dateKey].push(m);
  });

  // Extract sample messages (for AI analysis, not all)
  const sampleSize = Math.min(100, ownerMessages.length);
  const step = Math.floor(ownerMessages.length / sampleSize) || 1;
  const sampleMessages = ownerMessages.filter((_, i) => i % step === 0).slice(0, sampleSize);

  return {
    totalMessages: ownerMessages.length,
    sampleMessages: sampleMessages.map((m) => m.content),
    activeDays: Object.keys(messagesByDate).length,
    avgMessagesPerDay: ownerMessages.length / Object.keys(messagesByDate).length || 0,
  };
};

module.exports = {
  parseWhatsAppExport,
  extractForAnalysis,
};
