// lib/contexts/RatingsContext.tsx - Google 로그인 전용 수정

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, getUserId } from '@/lib/contexts/AuthContext';

// 동적 import를 위한 Firebase 서비스
let FirestoreRatingsService: any = null;
let createRatingsService: any = null;

const loadFirebaseService = async (): Promise<boolean> => {
  try {
    const module = await import('@/lib/services/firestoreRatingsService');
    FirestoreRatingsService = module.FirestoreRatingsService;
    createRatingsService = module.createRatingsService;
    return true;
  } catch (error) {
    if (__DEV__) console.warn('Firebase 서비스 로드 실패:', error);
    return false;
  }
};

// 🧹 정리: 상수들을 한 곳에 모음
const STORAGE_KEYS = {
  RATINGS: "song-ratings",
  SYNC_STATUS: "ratings-sync-status"
} as const;

// 🧹 정리: 더 명확한 타입 정의
interface SyncStatus {
  readonly lastSyncTime: number;
}

// 🆕 별점 변경 콜백 타입
type RatingChangeCallback = (videoId: string, newRating: number, oldRating: number) => void;

interface RatingsContextType {
  readonly ratings: Record<string, number>;
  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number;
  readonly loading: boolean;
  readonly isSyncing: boolean;
  readonly lastSyncTime: number;
  forceSyncFromCloud: () => Promise<void>;
  // 🆕 콜백 시스템
  setOnRatingChangeCallback: (callback: RatingChangeCallback | null) => void;
}

const RatingsContext = createContext<RatingsContextType>({
  ratings: {},
  setRating: () => {},
  getRating: () => 0,
  loading: true,
  isSyncing: false,
  lastSyncTime: 0,
  forceSyncFromCloud: async () => {},
  setOnRatingChangeCallback: () => {},
});

interface RatingsProviderProps {
  readonly children: ReactNode;
}

export const RatingsProvider: React.FC<RatingsProviderProps> = ({ children }) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  
  const { user, isFirebaseReady } = useAuth();
  const [ratingsService, setRatingsService] = useState<any>(null);

  const ratingChangeCallbackRef = useRef<RatingChangeCallback | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // 🆕 별점 변경 콜백 등록 함수
  const setOnRatingChangeCallback = useCallback((callback: RatingChangeCallback | null) => {
    ratingChangeCallbackRef.current = callback;
    console.log('📞 별점 변경 콜백 등록:', callback ? '등록됨' : '해제됨');
  }, []);

  // 🔥 안전한 사용자 ID 가져오기 (에러 처리 포함)
  const getSafeUserIdForRatings = (): string | null => {
    try {
      if (!user) {
        console.log('👤 사용자 로그인 안 됨 - 별점 기능 대기 중');
        return null;
      }
      return getUserId(user);
    } catch (error) {
      console.warn('⚠️ 사용자 ID 가져오기 실패:', error);
      return null;
    }
  };

  const initializeFirebaseService = async (userId: string): Promise<void> => {
    const serviceReady = await loadFirebaseService();
    if (serviceReady && createRatingsService) {
      const service = createRatingsService(userId);
      setRatingsService(service);
      if (__DEV__) console.log('🔥 Firebase 별점 서비스 초기화됨:', userId.slice(-8));
    }
  };

  useEffect(() => {
    const currentUserId = user ? user.uid : null;

    // 사용자 ID가 변경되었는지 확인 (로그인/로그아웃 포함)
    if (currentUserId !== lastUserIdRef.current) {
      console.log(`AUTH: 사용자 변경 감지. ${lastUserIdRef.current?.slice(-4)} -> ${currentUserId?.slice(-4)}`);
      
      // 1. 이전 상태 초기화
      setRatings({});
      setLastSyncTime(0);
      setRatingsService(null);
      
      if (currentUserId) {
        // 2. 새 사용자 로그인: 서비스 초기화 및 데이터 로드
        console.log('AUTH: 새 사용자, 서비스 초기화 및 데이터 동기화 시작...');
        initializeFirebaseService(currentUserId);
        // loadInitialData(); // 로컬 데이터 로드
        forceSyncFromCloud(currentUserId); // ☁️ 새 사용자의 클라우드 데이터 강제 동기화
      } else {
        // 3. 로그아웃: 로컬 스토리지 정리
        console.log('AUTH: 로그아웃, 로컬 별점 데이터 삭제');
        AsyncStorage.removeItem(STORAGE_KEYS.RATINGS);
        AsyncStorage.removeItem(STORAGE_KEYS.SYNC_STATUS);
      }
    }

    lastUserIdRef.current = currentUserId; // 4. 마지막 사용자 ID 업데이트
  }, [user]); // user 객체가 변경될 때마다 실행

  // 📱 앱 시작 시 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  // 📥 초기 데이터 로드 (로컬 우선)
  const loadInitialData = async (): Promise<void> => {
    try {
      // 1. 로컬 데이터 로드
      const localJson = await AsyncStorage.getItem(STORAGE_KEYS.RATINGS);
      if (localJson) {
        const localRatings = JSON.parse(localJson);
        setRatings(localRatings);
      }
      
      // 2. 동기화 상태 로드
      const syncJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
      if (syncJson) {
        const syncStatus: SyncStatus = JSON.parse(syncJson);
        setLastSyncTime(syncStatus.lastSyncTime || 0);
      }
      
    } catch (error) {
      if (__DEV__) console.error('❌ 초기 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 💾 로컬 저장
  const saveRatingsLocally = async (newRatings: Record<string, number>): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RATINGS, JSON.stringify(newRatings));
      setRatings(newRatings);
    } catch (error) {
      if (__DEV__) console.error('❌ 로컬 저장 실패:', error);
    }
  };

  // ⭐ 별점 설정 (로컬 저장 + 백그라운드 클라우드 업로드) - 🆕 콜백 시스템 추가
  const setRating = (videoId: string, rating: number): void => {
    // 0-5점 범위 검증
    if (rating < 0 || rating > 5) {
      if (__DEV__) console.warn('별점은 0-5 사이여야 합니다:', rating);
      return;
    }

    // 🆕 기존 별점 가져오기 (콜백용)
    const oldRating = ratings[videoId] || 0;

    // 변경사항이 없으면 조기 리턴
    if (oldRating === rating) {
      console.log(`⭐ 별점 변경 없음: ${videoId} = ${rating}점`);
      return;
    }

    // 1. 즉시 로컬 업데이트
    const newRatings = { ...ratings };
    
    if (rating === 0) {
      // 🔧 수정: 별점 0이면 로컬에서 삭제
      delete newRatings[videoId];
      console.log(`🗑️ 별점 삭제 (로컬): ${videoId}`);
    } else {
      // 별점이 있으면 저장
      newRatings[videoId] = rating;
      console.log(`⭐ 별점 설정 (로컬): ${videoId} = ${rating}점`);
    }
    
    saveRatingsLocally(newRatings);

    // 🆕 2. 별점 변경 콜백 호출 (추천 업데이트 트리거)
    if (ratingChangeCallbackRef.current) {
      try {
        console.log(`📞 별점 변경 콜백 호출: ${videoId} ${oldRating} → ${rating}`);
        ratingChangeCallbackRef.current(videoId, rating, oldRating);
      } catch (error) {
        console.error('❌ 별점 변경 콜백 실행 실패:', error);
      }
    } else {
      console.log('📞 별점 변경 콜백이 등록되지 않음');
    }

    // 3. 백그라운드 클라우드 업로드/삭제 (사용자가 로그인된 경우에만)
    if (ratingsService) {
      if (rating === 0) {
        deleteRatingFromCloud(videoId);
      } else {
        uploadSingleRatingToCloud(videoId, rating);
      }
    } else {
      console.log('☁️ Firebase 서비스 없음 - 클라우드 동기화 스킵');
    }
  };

  // 🗑️ 클라우드에서 별점 삭제
  const deleteRatingFromCloud = async (videoId: string): Promise<void> => {
    if (!ratingsService) return;

    try {
      console.log(`🗑️ 클라우드에서 별점 삭제: ${videoId}`);
      await ratingsService.removeRating(videoId);
      
      // 동기화 시간 업데이트
      const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(syncStatus));
      setLastSyncTime(syncStatus.lastSyncTime);
      
    } catch (error: any) {
      if (__DEV__) console.warn(`⚠️ 클라우드 삭제 실패 (${videoId}):`, error.message);
    }
  };

  // ⭐ 별점 가져오기
  const getRating = (videoId: string): number => {
    return ratings[videoId] || 0;
  };

  // ☁️ 개별 별점 클라우드 업로드 (백그라운드)
  const uploadSingleRatingToCloud = async (videoId: string, rating: number): Promise<void> => {
    if (!ratingsService) return;

    try {
      await ratingsService.uploadRating(videoId, rating);
      
      // 동기화 시간 업데이트
      const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(syncStatus));
      setLastSyncTime(syncStatus.lastSyncTime);
      
    } catch (error: any) {
      if (__DEV__) console.warn(`⚠️ 클라우드 업로드 실패 (${videoId}):`, error.message);
    }
  };

  // 📥 클라우드에서 별점 동기화
  const syncFromCloud = async (): Promise<void> => {
    if (!ratingsService) return;

    try {
      setIsSyncing(true);
      
      const cloudRatings = await ratingsService.downloadAllRatings();
      
      // 로컬과 클라우드 별점 병합 (클라우드 우선)
      const mergedRatings = { ...ratings, ...cloudRatings };
      await saveRatingsLocally(mergedRatings);
      
      // 동기화 완료 상태 저장
      const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(syncStatus));
      setLastSyncTime(syncStatus.lastSyncTime);
      
    } catch (error: any) {
      if (__DEV__) console.error('❌ 클라우드 동기화 실패:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 🤖 조건부 클라우드 동기화 (24시간 체크)
  const conditionalSyncFromCloud = async (): Promise<void> => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - lastSyncTime > dayInMs) {
      try {
        await syncFromCloud();
      } catch (error) {
        if (__DEV__) console.warn('⚠️ 자동 동기화 실패 (무시):', error);
      }
    }
  };

  const forceSyncFromCloud = async (overrideUserId?: string): Promise<void> => {
    const serviceToUse = ratingsService;
    const userIdToUse = overrideUserId || (user ? user.uid : null);

    if (!serviceToUse && !userIdToUse) {
      if (__DEV__) console.warn('Firebase 서비스 준비 안됨, 동기화 불가');
      return;
    }

    let service = serviceToUse;
    if (!service && userIdToUse) {
      // 서비스가 아직 준비되지 않았지만 ID가 있다면 즉시 생성
      const serviceReady = await loadFirebaseService();
      if (serviceReady && createRatingsService) {
        service = createRatingsService(userIdToUse);
        setRatingsService(service); // 상태에도 저장
      }
    }

    if (!service) {
       if (__DEV__) console.warn('Firebase 서비스 생성 실패, 동기화 불가');
       return;
    }

    if (__DEV__) console.log(`🔄 수동 별점 동기화 시작... (User: ${userIdToUse?.slice(-4)})`);
    
    // syncFromCloud가 serviceToUse를 사용하도록 수정
    try {
      setIsSyncing(true);
      
      const cloudRatings = await service.downloadAllRatings(); // service를 명시적으로 사용
      
      const mergedRatings = { ...ratings, ...cloudRatings };
      await saveRatingsLocally(mergedRatings);
      
      const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(syncStatus));
      setLastSyncTime(syncStatus.lastSyncTime);
      
      if (__DEV__) console.log('✅ 수동 별점 동기화 완료');
    } catch (error: any) {
      if (__DEV__) console.error('❌ 클라우드 동기화 실패:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <RatingsContext.Provider 
      value={{ 
        ratings, 
        setRating, 
        getRating, 
        loading,
        isSyncing,
        lastSyncTime,
        forceSyncFromCloud,
        // 🆕 콜백 시스템
        setOnRatingChangeCallback,
      }}
    >
      {children}
    </RatingsContext.Provider>
  );
};

// 🔗 커스텀 훅
export const useRatings = () => {
  const context = useContext(RatingsContext);
  if (!context) {
    throw new Error('useRatings must be used within a RatingsProvider');
  }
  return context;
};