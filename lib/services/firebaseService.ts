import AsyncStorage from '@react-native-async-storage/async-storage';
const SONGS_JSON_URL = "https://storage.googleapis.com/music-recommend-f68fa.firebasestorage.app/songs.json";
const SONGS_CACHE_KEY = 'cached-songs';
const LAST_CHECK_DATE_KEY = 'songs-last-check-date';

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  search_keywords?: string[];
}

export const checkForNewData = async (ignoreCache: boolean = false): Promise<boolean> => {
  return ignoreCache;
};

export const shouldCheckForNewData = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
    return lastCheckDate !== today;
  } catch (error) {
    console.warn('날짜 확인 실패:', error);
    return true;
  }
};

export const markTodayAsChecked = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, today);
  } catch (error) {
    console.warn('날짜 저장 실패:', error);
  }
};

export const fetchSongsFromFirebase = async (ignoreCache: boolean = false): Promise<Song[]> => {
  try {
    console.log('📥 Storage에서 JSON 파일 다운로드 중...');
    
    const url = ignoreCache 
      ? `${SONGS_JSON_URL}?t=${Date.now()}` 
      : SONGS_JSON_URL;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const songs: Song[] = await response.json();

    console.log(`✅ 다운로드 완료: ${songs.length}곡`);
    return songs;

  } catch (error) {
    console.error('Storage 다운로드 실패:', error);
    throw error;
  }
};

export const getCachedSongs = async (): Promise<Song[]> => {
  try {
    const cached = await AsyncStorage.getItem(SONGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('캐시된 곡 데이터 로드 실패:', error);
    return [];
  }
};

export const cacheSongs = async (songs: Song[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('곡 데이터 캐시 저장 실패:', error);
  }
};

export const fallbackSongs: Song[] = [
  {
    videoId: "oZpYEEcvu5I",
    title: "tuki.『晩餐歌』Official Music Video",
    artist: "tuki.(16)",
    thumbnail: "https://i.ytimg.com/vi/oZpYEEcvu5I/hqdefault.jpg"
  }
];