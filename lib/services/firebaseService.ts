import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. 방금 파이썬 스크립트 실행 후 얻은 URL 또는 Firebase Console의 다운로드 URL
// (둘 중 접속 잘 되는 것으로 사용하시면 됩니다.)
const SONGS_JSON_URL = "https://storage.googleapis.com/music-recommend-f68fa.firebasestorage.app/songs.json";
// 또는: const SONGS_JSON_URL = "https://firebasestorage.googleapis.com/v0/b/music-recommend-f68fa.firebasestorage.app/o/songs.json?alt=media";

const SONGS_CACHE_KEY = 'cached-songs';
const LAST_CHECK_DATE_KEY = 'songs-last-check-date';

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  search_keywords?: string[];
}

// 2. 새 데이터 확인 로직
// 파일 다운로드 방식은 비용이 거의 0원이므로, 복잡한 로직 없이 캐시 무시 여부만 반환해도 충분합니다.
export const checkForNewData = async (ignoreCache: boolean = false): Promise<boolean> => {
  return ignoreCache;
};

// 3. 오늘 첫 실행인지 확인
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

// 4. [핵심] Storage에서 JSON 파일 다운로드 (비용 절감)
export const fetchSongsFromFirebase = async (ignoreCache: boolean = false): Promise<Song[]> => {
  try {
    console.log('📥 Storage에서 JSON 파일 다운로드 중...');
    
    // ignoreCache가 true일 때 쿼리 스트링을 붙여 캐시 우회 (강제 최신 데이터 로드)
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

// 5. 캐시된 곡 데이터 가져오기
export const getCachedSongs = async (): Promise<Song[]> => {
  try {
    const cached = await AsyncStorage.getItem(SONGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('캐시된 곡 데이터 로드 실패:', error);
    return [];
  }
};

// 6. 곡 데이터 캐시에 저장
export const cacheSongs = async (songs: Song[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('곡 데이터 캐시 저장 실패:', error);
  }
};

// 더미 데이터 (Fallback)
export const fallbackSongs: Song[] = [
  {
    videoId: "oZpYEEcvu5I",
    title: "tuki.『晩餐歌』Official Music Video",
    artist: "tuki.(16)",
    thumbnail: "https://i.ytimg.com/vi/oZpYEEcvu5I/hqdefault.jpg"
  }
];