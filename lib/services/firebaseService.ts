//lib/services/firebaseService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_URL = 'https://music-recommend-f68fa.web.app';
const SONGS_CACHE_KEY = 'cached-songs';
const LAST_MODIFIED_KEY = 'songs-last-modified';
const LAST_CHECK_DATE_KEY = 'songs-last-check-date';

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

// 새 데이터가 있는지 확인 (HEAD 요청으로 Last-Modified 체크)
export const checkForNewData = async (ignoreCache: boolean = false): Promise<boolean> => {
  try {
    const url = ignoreCache 
      ? `${FIREBASE_URL}/songs.json?t=${Date.now()}`
      : `${FIREBASE_URL}/songs.json`;
      
    const response = await fetch(url, {
      method: 'HEAD',
      ...(ignoreCache && {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
    });
    
    const lastModified = response.headers.get('Last-Modified');
    if (!lastModified) return false;
    
    const cachedLastModified = await AsyncStorage.getItem(LAST_MODIFIED_KEY);
    
    return !cachedLastModified || cachedLastModified !== lastModified;
  } catch (error) {
    console.warn('새 데이터 확인 실패:', error);
    return false;
  }
};

// 오늘 첫 실행인지 확인
export const shouldCheckForNewData = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // "2025-06-08"
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
    
    return lastCheckDate !== today;
  } catch (error) {
    console.warn('날짜 확인 실패:', error);
    return true; // 에러 시 안전하게 체크 실행
  }
};

// 오늘 체크 완료로 기록
export const markTodayAsChecked = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, today);
  } catch (error) {
    console.warn('날짜 저장 실패:', error);
  }
};

// Firebase에서 songs.json 가져오기
export const fetchSongsFromFirebase = async (ignoreCache: boolean = false): Promise<Song[]> => {
  try {
    const url = ignoreCache 
      ? `${FIREBASE_URL}/songs.json?t=${Date.now()}`
      : `${FIREBASE_URL}/songs.json`;
      
    console.log('🔍 앱에서 호출하는 URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      ...(ignoreCache && {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const songs: Song[] = await response.json();
    
    // Last-Modified 저장
    const lastModified = response.headers.get('Last-Modified');
    if (lastModified) {
      await AsyncStorage.setItem(LAST_MODIFIED_KEY, lastModified);
    }
    
    return songs;
  } catch (error) {
    console.error('Firebase에서 곡 데이터 가져오기 실패:', error);
    throw error;
  }
};

// 캐시된 곡 데이터 가져오기
export const getCachedSongs = async (): Promise<Song[]> => {
  try {
    const cached = await AsyncStorage.getItem(SONGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('캐시된 곡 데이터 로드 실패:', error);
    return [];
  }
};

// 곡 데이터 캐시에 저장
export const cacheSongs = async (songs: Song[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('곡 데이터 캐시 저장 실패:', error);
  }
};

// 더미 데이터 (fallback용)
export const fallbackSongs: Song[] = [
  {
    videoId: "oZpYEEcvu5I",
    title: "tuki.『晩餐歌』Official Music Video",
    artist: "tuki.(16)",
    thumbnail: "https://i.ytimg.com/vi/oZpYEEcvu5I/hqdefault.jpg"
  },
  {
    videoId: "mX9IJ7Urn28",
    title: "月面着陸計画 - Moon Landing Plan",
    artist: "tuki. - Topic",
    thumbnail: "https://i.ytimg.com/vi/mX9IJ7Urn28/hqdefault.jpg"
  },
  {
    videoId: "goCvO7uJhu8",
    title: "tuki.『純恋愛のインゴット』Official Music Video",
    artist: "tuki.(16)",
    thumbnail: "https://i.ytimg.com/vi/goCvO7uJhu8/hqdefault.jpg"
  }
];