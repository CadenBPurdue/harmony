// src/main/utils/match_scoring.js
/**
 * A utility module for song matching algorithms used across music services
 */

/**
 * Calculates the similarity between two strings
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} A similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
  
    if (s1 === s2) return 1;
  
    // Remove common filler words that might confuse matching
    const fillerWords = ['feat', 'ft', 'featuring', 'with', 'prod', 'produced', 'by', 'the', 'a', 'an'];
    
    // Remove special characters and normalize spaces
    const normalize = (str) => {
      return str
        .replace(/[&\/\\#,+()$~%.'":*?<>{}[\]|-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const cleanStr1 = normalize(s1);
    const cleanStr2 = normalize(s2);
    
    const words1 = cleanStr1.split(' ').filter(word => word.length > 1 && !fillerWords.includes(word));
    const words2 = cleanStr2.split(' ').filter(word => word.length > 1 && !fillerWords.includes(word));
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Check for exact matches and partial matches
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const word1 of words1) {
      let bestMatch = 0;
      
      for (const word2 of words2) {
        if (word1 === word2) {
          exactMatches++;
          bestMatch = 1;
          break;
        } else if (word1.length >= 3 && word2.length >= 3) {
          // Check if one is substring of the other for longer words
          if (word1.includes(word2) || word2.includes(word1)) {
            bestMatch = Math.max(bestMatch, 0.8);
          } else {
            // Calculate Levenshtein distance for similar words
            const distance = levenshteinDistance(word1, word2);
            const maxLength = Math.max(word1.length, word2.length);
            const similarity = 1 - (distance / maxLength);
            
            if (similarity > 0.7) {
              bestMatch = Math.max(bestMatch, similarity);
            }
          }
        }
      }
      
      partialMatches += bestMatch;
    }
    
    // Weight exact matches more heavily
    return ((exactMatches * 1.5) + partialMatches) / (words1.length * 1.5);
  }
  
  /**
   * Calculates Levenshtein distance between two strings
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @returns {number} Levenshtein distance
   */
  function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    
    // Create matrix
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    // Initialize matrix
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,        // deletion
          dp[i][j - 1] + 1,        // insertion
          dp[i - 1][j - 1] + cost  // substitution
        );
      }
    }
    
    return dp[m][n];
  }
  
  /**
   * Extracts the core title from formatted song titles
   * @param {string} title - Original song title
   * @returns {string} Clean core title
   */
  function extractCoreTitle(title) {
    if (!title) return '';
    
    // Remove hashtags and anything after them
    let cleanTitle = title.split('#')[0].trim();
    
    // Remove quotes, especially doubled quotes
    cleanTitle = cleanTitle.replace(/["""'']/g, '').trim();
    
    // Remove featured artists section (the most common pattern in Apple Music)
    cleanTitle = cleanTitle.replace(/\(feat\..*\)$/, '').trim();
    cleanTitle = cleanTitle.replace(/\(ft\..*\)$/, '').trim();
    cleanTitle = cleanTitle.replace(/feat\..*$/, '').trim();
    cleanTitle = cleanTitle.replace(/ft\..*$/, '').trim();
    
    return cleanTitle;
  }
  
  /**
   * Normalizes a track title by removing featured artist info and standardizing format
   * @param {string} title - Track title
   * @returns {string} Normalized title
   */
  function normalizeTrackTitle(title) {
    if (!title) return '';
    
    // Step 1: Normalize accented characters (but preserve them for matching)
    let normalizedTitle = title
      // First preserve but normalize accented characters
      .normalize("NFC")
      // Fix common misspellings
      .replace(/rednose/i, 'red nosed')
      .replace(/red nose/i, 'red nosed')
      .replace(/red-nose/i, 'red nosed')
      .replace(/rednosed/i, 'red nosed');
    
    // Step 2: Handle acronyms and spacing
    // "S.A.D." -> "SAD", "S. A. D." -> "SAD"
    normalizedTitle = normalizedTitle
      .replace(/([A-Z])\.\s?([A-Z])\.\s?([A-Z])\./gi, "$1$2$3")
      .replace(/([A-Z])\.\s?([A-Z])\./gi, "$1$2")
      .replace(/([A-Z])\./gi, "$1");
    
    // Step 3: Remove featured artists and other extras
    normalizedTitle = normalizedTitle
      // Remove parenthesized extras typically at the end
      .replace(/\s*\([^)]*\)\s*$/, '')
      // Remove bracketed extras
      .replace(/\s*\[[^\]]*\]\s*$/, '')
      // Remove anything after a dash (often remixes, versions, etc.)
      .split(/\s+[-–—]\s+/)[0]
      // Remove standard extras
      .replace(/\(feat\..*\)/gi, '')
      .replace(/\(ft\..*\)/gi, '')
      .replace(/feat\..*$/gi, '')
      .replace(/ft\..*$/gi, '')
      // Clean up remaining text
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .trim();
    
    return normalizedTitle;
  }
  
  /**
   * Cleans up a string for better matching by removing special characters
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  function cleanText(text) {
    if (!text) return '';
    
    return text
      // First normalize to handle accented characters
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      // Then remove all special characters
      .replace(/[&\/\\#,+()$~%.'":*?<>{}[\]|-]/g, ' ')
      // Normalize spaces
      .replace(/\s+/g, ' ')
      .trim()
      // Convert to lowercase for better comparison
      .toLowerCase();
  }
  
  /**
   * Normalizes artist names for better matching
   * @param {string} artist - Artist name
   * @returns {string} Normalized artist name
   */
  function normalizeArtistName(artist) {
    if (!artist) return '';
    
    // Keep original case but normalize spaces and special characters
    return artist
      // First normalize to handle accented characters but keep them
      .normalize("NFC")
      // Fix spacing
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Checks if a song is likely a cover, karaoke, or tribute version
   * @param {string} title - Song title
   * @param {string} artist - Artist name
   * @returns {boolean} True if likely a cover version
   */
  function isCoverVersion(title, artist) {
    const lowerTitle = title.toLowerCase();
    const lowerArtist = artist.toLowerCase();
    
    const coverKeywords = [
      'karaoke', 
      'originally performed', 
      'made popular', 
      'tribute',
      'as made famous',
      'in the style of',
      'instrumental version',
      'cover',
      'remix',
      'version'
    ];
    
    // Check title for cover keywords
    for (const keyword of coverKeywords) {
      if (lowerTitle.includes(keyword)) return true;
    }
    
    // Check artist for cover keywords
    if (lowerArtist.includes('karaoke') || 
        lowerArtist.includes('tribute') || 
        lowerArtist.includes('studio musicians')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks if the found artist likely matches the original artist
   * @param {string} foundArtist - Found artist name
   * @param {string} originalArtist - Original artist name
   * @returns {boolean} True if likely the same artist
   */
  function isOriginalArtist(foundArtist, originalArtist) {
    if (!foundArtist || !originalArtist) return false;
    
    // Normalize both for comparison
    const found = normalizeArtistName(foundArtist).toLowerCase();
    const original = normalizeArtistName(originalArtist).toLowerCase();
    
    // Compare with accents removed
    const foundNoAccents = cleanText(foundArtist);
    const originalNoAccents = cleanText(originalArtist);
    
    // Direct inclusion check
    if (found.includes(original) || original.includes(found)) return true;
    if (foundNoAccents.includes(originalNoAccents) || originalNoAccents.includes(foundNoAccents)) return true;
    
    // Check if the first word of the artist names match
    const foundFirstWord = found.split(' ')[0];
    const originalFirstWord = original.split(' ')[0];
    if (foundFirstWord && originalFirstWord && foundFirstWord === originalFirstWord && foundFirstWord.length > 1) {
      return true;
    }
    
    // Calculate similarity for more complex cases
    const similarity = calculateSimilarity(found, original);
    return similarity >= 0.7;
  }
  
  /**
   * Checks if two song titles are equivalent despite formatting differences
   * @param {string} title1 - First title
   * @param {string} title2 - Second title
   * @returns {boolean} True if titles are equivalent
   */
  function areEquivalentTitles(title1, title2) {
    if (!title1 || !title2) return false;
    
    // Case 1: Direct match after normalization
    const normalized1 = normalizeTrackTitle(title1).toLowerCase();
    const normalized2 = normalizeTrackTitle(title2).toLowerCase();
    if (normalized1 === normalized2) return true;
    
    // Case 2: Match after removing all spaces and special chars
    const stripped1 = normalized1.replace(/[^\w]/g, '');
    const stripped2 = normalized2.replace(/[^\w]/g, '');
    if (stripped1 === stripped2 && stripped1.length > 3) return true;
    
    // Case 3: Spelling variations - "Red Nosed" vs "Rednose"
    const simplified1 = normalized1
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
      
    const simplified2 = normalized2
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
      
    if (simplified1 === simplified2 && simplified1.length > 3) return true;
    
    // Case 4: Very high similarity score
    const similarity = calculateSimilarity(normalized1, normalized2);
    if (similarity >= 0.9) return true;
    
    return false;
  }
  
  /**
   * Calculates a duration match score between two song durations
   * @param {number} duration1 - Duration in milliseconds
   * @param {number} duration2 - Duration in milliseconds
   * @returns {number} Score between 0.6 and 1.0
   */
  function calculateDurationScore(duration1, duration2) {
    if (!duration1 || !duration2) return 1; // Skip if either duration is missing
    
    const durationDiff = Math.abs(duration1 - duration2);
    const durationDiffPercent = durationDiff / Math.max(duration1, duration2);
    
    if (durationDiffPercent <= 0.05) return 1.0; // Perfect match
    if (durationDiffPercent <= 0.10) return 0.9; // Very close
    if (durationDiffPercent <= 0.15) return 0.8; // Close
    if (durationDiffPercent <= 0.25) return 0.7; // Somewhat different
    return 0.6; // Different but not a deal-breaker
  }
  
  /**
   * Compares two track titles accounting for featured artists
   * @param {string} title1 - First track title
   * @param {string} title2 - Second track title 
   * @returns {object} Scoring information
   */
  function compareTrackTitles(title1, title2) {
    if (!title1 || !title2) return { score: 0, isExactMatch: false };
    
    // Check for equivalent titles first
    if (areEquivalentTitles(title1, title2)) {
      return { score: 1, isExactMatch: true };
    }
    
    // Get normalized versions of both titles (no features)
    const normalizedTitle1 = normalizeTrackTitle(title1).toLowerCase();
    const normalizedTitle2 = normalizeTrackTitle(title2).toLowerCase();
    
    // Calculate similarity between normalized titles
    const similarityScore = calculateSimilarity(normalizedTitle1, normalizedTitle2);
    
    return {
      score: similarityScore,
      isExactMatch: similarityScore >= 0.9
    };
  }
  
  /**
   * Checks if an album title matches or is a variation
   * @param {string} album1 - First album title
   * @param {string} album2 - Second album title
   * @returns {boolean} True if albums match or are variations
   */
  function isAlbumMatch(album1, album2) {
    if (!album1 || !album2) return false;
    
    // Normalize both album titles
    const norm1 = album1.toLowerCase().trim();
    const norm2 = album2.toLowerCase().trim();
    
    // Direct match
    if (norm1 === norm2) return true;
    
    // Check if one contains the other (for variations like "Album" vs "Album - Single")
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    // Get the base names (before any dash, parenthesis, etc.)
    const base1 = norm1.split(/\s+[-–—(]/)[0].trim();
    const base2 = norm2.split(/\s+[-–—(]/)[0].trim();
    
    // Match on base names if they're substantial
    if (base1 === base2 && base1.length > 3) return true;
    
    return false;
  }
  
  /**
   * Scores a potential song match
   * @param {Object} candidate - Song candidate
   * @param {Object} searchSong - Song being searched for
   * @param {Object} options - Optional parameters
   * @returns {Object} Scoring details
   */
  function scoreSongMatch(candidate, searchSong, options = {}) {
    const { 
      nameWeight = 0.45, 
      artistWeight = 0.40, 
      durationWeight = 0.05, 
      albumWeight = 0.10,
      coverPenalty = 0.3,
      originalArtistBonus = 1.2,
      featureBonus = 1.8,  // Bonus for matching base title when features differ
      exactTitleBonus = 1.5 // Bonus for exact title match
    } = options;
    
    // Check if this is a cover version
    const isCover = isCoverVersion(candidate.name, candidate.artist);
    
    // Check if the artist matches (accounting for variations)
    const artistMatches = isOriginalArtist(candidate.artist, searchSong.artist);
    
    // Compare track titles accounting for featured artists
    const titleComparison = compareTrackTitles(candidate.name, searchSong.name);
    
    // Check if albums match
    const albumMatches = isAlbumMatch(candidate.album, searchSong.album);
    
    // Calculate base name score
    const nameScore = titleComparison.score;
    
    // Calculate artist score
    const artistScore = calculateSimilarity(normalizeArtistName(candidate.artist), 
                                            normalizeArtistName(searchSong.artist));
    
    // Calculate album score if available
    const albumScore = searchSong.album 
      ? (albumMatches ? 1 : calculateSimilarity(candidate.album, searchSong.album)) 
      : 1;
    
    // Calculate duration score if available
    const durationScore = calculateDurationScore(
      candidate.duration,
      searchSong.duration
    );
    
    // Special handling for cases where base title matches but featured artists differ
    const titleMultiplier = titleComparison.isExactMatch ? exactTitleBonus : 1;
    const artistMultiplier = artistMatches ? 1.5 : 1;
    
    // Apply cover penalty
    const coverMultiplier = isCover ? coverPenalty : 1.0;
    
    // Calculate weighted base score
    const baseScore = (
      (nameScore * titleMultiplier * nameWeight) +
      (artistScore * artistMultiplier * artistWeight) +
      (durationScore * durationWeight) +
      (albumScore * albumWeight)
    ) * coverMultiplier;
    
    // Apply original artist bonus for exact title matches
    const finalScore = (titleComparison.isExactMatch && artistMatches) 
      ? baseScore * originalArtistBonus 
      : baseScore;
    
    return {
      score: finalScore,
      details: {
        name: candidate.name,
        normalizedName: normalizeTrackTitle(candidate.name),
        artist: candidate.artist,
        album: candidate.album,
        duration: candidate.duration,
        isOriginalArtist: artistMatches,
        isCover: isCover,
        isTitleMatch: titleComparison.isExactMatch,
        albumMatch: albumMatches,
        areEquivalentTitles: areEquivalentTitles(candidate.name, searchSong.name)
      },
      scores: {
        name: nameScore,
        nameExact: titleComparison.isExactMatch,
        artist: artistScore,
        artistExact: artistMatches,
        album: albumScore,
        albumExact: albumMatches,
        duration: durationScore,
        cover: coverMultiplier,
        titleMultiplier,
        artistMultiplier,
        total: finalScore
      }
    };
  }
  
  /**
   * Checks if an exact match exists in the candidate list
   * @param {Array} candidates - List of candidates
   * @param {Object} searchSong - Song being searched for
   * @returns {Object|null} Best match or null
   */
  function findExactMatch(candidates, searchSong) {
    if (!candidates || candidates.length === 0) return null;
    
    // Look for an exact same song
    for (const candidate of candidates) {
      // Perfect match: same title (after normalization) + original artist
      if (areEquivalentTitles(candidate.details.name, searchSong.name) && 
          candidate.details.isOriginalArtist && 
          !candidate.details.isCover) {
        return candidate;
      }
    }
    
    // No perfect match found
    return null;
  }
  
  /**
   * Find the best match for a song from a list of candidates
   * @param {Array} candidates - List of candidates
   * @param {Object} searchSong - Song being searched for
   * @param {Object} options - Optional parameters
   * @returns {Object|null} Best match or null
   */
  function findBestMatch(candidates, searchSong, options = {}) {
    if (!candidates || candidates.length === 0) return null;
    
    const {
      minScore = 0.6,           // Minimum score to consider a match
      preferOriginalArtist = true, // Prefer matches by the original artist
      strictTitleMatch = false    // Require exact title match
    } = options;
    
    // Sort candidates by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Check for exact match first
    const exactMatch = findExactMatch(candidates, searchSong);
    if (exactMatch) return exactMatch;
    
    // Get the best scoring match
    const bestMatch = candidates[0];
    
    // Check if it meets our basic requirements
    if (bestMatch.score < minScore) {
      return null;
    }
    
    // If we require strict title matching and this isn't a title match, reject
    if (strictTitleMatch && !bestMatch.details.isTitleMatch && !bestMatch.details.areEquivalentTitles) {
      return null;
    }
    
    // Apply some additional rules
    
    // Case 1: Strong artist match with decent score
    if (bestMatch.details.isOriginalArtist && bestMatch.score >= 0.75) {
      return bestMatch;
    }
    
    // Case 2: Perfect title match
    if (bestMatch.details.isTitleMatch && bestMatch.score >= 0.7) {
      return bestMatch;
    }
    
    // Case 3: Perfect album match
    if (bestMatch.details.albumMatch && bestMatch.score >= 0.7) {
      return bestMatch;
    }
    
    // Case 4: Very high score match
    if (bestMatch.score >= 0.9) {
      return bestMatch;
    }
    
    // For other cases, return null to keep searching
    return null;
  }
  
  export {
    calculateSimilarity,
    levenshteinDistance,
    extractCoreTitle,
    normalizeTrackTitle,
    normalizeArtistName,
    cleanText,
    isCoverVersion,
    isOriginalArtist,
    isAlbumMatch,
    areEquivalentTitles,
    calculateDurationScore,
    compareTrackTitles,
    scoreSongMatch,
    findExactMatch,
    findBestMatch
  };