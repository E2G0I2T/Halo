import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/config/firebase'; // Compat DB 객체 가져오기

const SONGS_CACHE_KEY = 'cached-songs';
const LAST_CHECK_DATE_KEY = 'songs-last-check-date';

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  search_keywords?: string[];
}

// 1. 새 데이터 확인 로직
export const checkForNewData = async (ignoreCache: boolean = false): Promise<boolean> => {
  return ignoreCache;
};

// 2. 오늘 첫 실행인지 확인
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

// 3. Firestore에서 곡 데이터 가져오기 (Compat 스타일로 수정됨)
export const fetchSongsFromFirebase = async (ignoreCache: boolean = false): Promise<Song[]> => {
  try {
    console.log('🔥 Firestore(Compat)에서 최신 곡 목록 로딩 중...');
    
    // ✅ 수정됨: Compat 문법 사용 (db.collection().get())
    const snapshot = await db.collection('songs').get();
    
    const songs: Song[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // 데이터 유효성 검사 및 매핑
      songs.push({
        videoId: data.videoId || doc.id,
        title: data.title || '제목 없음',
        artist: data.artist || 'Unknown',
        thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`,
        search_keywords: data.search_keywords || []
      });
    });

    console.log(`✅ Firestore 로드 완료: ${songs.length}곡`);
    return songs;

  } catch (error) {
    console.error('Firestore에서 곡 데이터 가져오기 실패:', error);
    throw error;
  }
};

// 4. 캐시된 곡 데이터 가져오기
export const getCachedSongs = async (): Promise<Song[]> => {
  try {
    const cached = await AsyncStorage.getItem(SONGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('캐시된 곡 데이터 로드 실패:', error);
    return [];
  }
};

// 5. 곡 데이터 캐시에 저장
export const cacheSongs = async (songs: Song[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('곡 데이터 캐시 저장 실패:', error);
  }
};

// 더미 데이터
export const fallbackSongs: Song[] = [
  {
    videoId: "oZpYEEcvu5I",
    title: "tuki.『晩餐歌』Official Music Video",
    artist: "tuki.(16)",
    thumbnail: "https://i.ytimg.com/vi/oZpYEEcvu5I/hqdefault.jpg"
  }
];