import { CONFIG } from "./config.js";
import { normalizeText } from "./utils.js";

export async function searchAndLoadArtist(artistName, options = {}) {
  if (artistName.trim() === "") {
    throw new Error(CONFIG.MESSAGES.ARTIST_REQUIRED);
  }

  try {
    // Search for the artist
    const artistSearchUrl = `${
      CONFIG.ITUNES_API.BASE_URL
    }/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=${
      CONFIG.ITUNES_API.ARTIST_SEARCH_LIMIT
    }`;

    const artistData = await fetchJson(artistSearchUrl, options.signal);

    if (artistData.results.length === 0) {
      throw new Error(CONFIG.MESSAGES.ARTIST_NOT_FOUND);
    }

    const artist = artistData.results[0];

    // Fetch all songs by the artist
    const songLookupUrl = `${CONFIG.ITUNES_API.BASE_URL}/lookup?id=${artist.artistId}&entity=song&limit=${CONFIG.ITUNES_API.SONG_LOOKUP_LIMIT}`;
    const songsData = await fetchJson(songLookupUrl, options.signal);

    // Filter and validate songs
    const songs = filterValidSongs(songsData.results, artist.artistName);

    if (songs.length === 0) {
      throw new Error(CONFIG.MESSAGES.NO_SONGS_FOUND);
    }

    return {
      artistId: artist.artistId,
      artistName: artist.artistName,
      songs,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    if (
      error.message.includes(CONFIG.MESSAGES.ARTIST_REQUIRED) ||
      error.message.includes(CONFIG.MESSAGES.ARTIST_NOT_FOUND) ||
      error.message.includes(CONFIG.MESSAGES.NO_SONGS_FOUND)
    ) {
      throw error;
    }
    throw new Error(CONFIG.MESSAGES.LOAD_ERROR);
  }
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function filterValidSongs(allTracks, artistName) {
  const normalizedArtistName = normalizeText(artistName);

  const filteredTracks = allTracks.filter((track) => {
    // Must be a track and have preview URL
    if (track.wrapperType !== "track" || !track.previewUrl) return false;

    const normalizedTrackName = normalizeText(track.trackName);

    // Exclude remixes, instrumentals, and tracks that are artist's name
    for (const keyword of CONFIG.FILTERS.EXCLUDED_KEYWORDS) {
      if (normalizedTrackName.includes(keyword)) return false;
    }
    if (isLiveVersionTitle(track.trackName)) return false;
    if (normalizedTrackName === normalizedArtistName) return false;

    return true;
  });

  return dedupeTracks(filteredTracks);
}

function isLiveVersionTitle(trackName) {
  const normalizedTitle = String(trackName || "").toLowerCase();

  return (
    /\(([^)]*\blive\b[^)]*)\)/i.test(normalizedTitle) ||
    /\[([^\]]*\blive\b[^\]]*)\]/i.test(normalizedTitle) ||
    /-\s*live\b/i.test(normalizedTitle) ||
    /\blive\s+(at|from|in)\b/i.test(normalizedTitle) ||
    /\blive\s+version\b/i.test(normalizedTitle)
  );
}

function dedupeTracks(tracks) {
  const seenTitles = new Set();
  const seenPreviewUrls = new Set();
  const uniqueTracks = [];

  for (const track of tracks) {
    const normalizedTrackName = normalizeText(track.trackName);
    if (!normalizedTrackName) {
      continue;
    }

    if (seenTitles.has(normalizedTrackName)) {
      continue;
    }

    if (seenPreviewUrls.has(track.previewUrl)) {
      continue;
    }

    seenTitles.add(normalizedTrackName);
    seenPreviewUrls.add(track.previewUrl);
    uniqueTracks.push(track);
  }

  return uniqueTracks;
}
