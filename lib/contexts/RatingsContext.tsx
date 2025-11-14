import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, getUserId } from "@/lib/contexts/AuthContext";

// 동적 import를 위한 Firebase 서비스
let FirestoreRatingsService: any = null;
let createRatingsService: any = null;

const loadFirebaseService = async (): Promise<boolean> => {
  try {
    const module = await import("@/lib/services/firestoreRatingsService");
    FirestoreRatingsService = module.FirestoreRatingsService;
    createRatingsService = module.createRatingsService;
    return true;
  } catch (error) {
    if (__DEV__) console.warn("Firebase 서비스 로드 실패:", error);
    return false;
  }
};

// 🧹 정리: 상수들을 한 곳에 모음
const STORAGE_KEYS = {
  RATINGS: "song-ratings",
  SYNC_STATUS: "ratings-sync-status",
} as const;

// 🧹 정리: 더 명확한 타입 정의
interface SyncStatus {
  readonly lastSyncTime: number;
}

// 🆕 별점 변경 콜백 타입
type RatingChangeCallback = (
  videoId: string,
  newRating: number,
  oldRating: number
) => void;

interface RatingsContextType {
  readonly ratings: Record<string, number>;
  setRating: (videoId: string, rating: number) => void;
  getRating: (videoId: string) => number;
  readonly loading: boolean;
  readonly isSyncing: boolean;
  readonly lastSyncTime: number;
  forceSyncFromCloud: () => Promise<void>; // 🆕 콜백 시스템
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

export const RatingsProvider: React.FC<RatingsProviderProps> = ({
  children,
}) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const { user, isFirebaseReady } = useAuth();
  const [ratingsService, setRatingsService] = useState<any>(null);

  const ratingChangeCallbackRef = useRef<RatingChangeCallback | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  const setOnRatingChangeCallback = useCallback(
    (callback: RatingChangeCallback | null) => {
      ratingChangeCallbackRef.current = callback;
      console.log("📞 별점 변경 콜백 등록:", callback ? "등록됨" : "해제됨");
    },
    []
  );

  const initializeFirebaseService = useCallback(
    async (userId: string): Promise<void> => {
      const serviceReady = await loadFirebaseService();
      if (serviceReady && createRatingsService) {
        const service = createRatingsService(userId);
        setRatingsService(service);
        if (__DEV__)
          console.log("🔥 Firebase 별점 서비스 초기화됨:", userId.slice(-8));
      }
    },
    []
  ); // 📥 [순서 변경] 1. loadInitialData 선언

  const loadInitialData = useCallback(async (): Promise<void> => {
    try {
      const localJson = await AsyncStorage.getItem(STORAGE_KEYS.RATINGS);
      if (localJson) {
        const localRatings = JSON.parse(localJson);
        setRatings(localRatings);
      }
      const syncJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
      if (syncJson) {
        const syncStatus: SyncStatus = JSON.parse(syncJson);
        setLastSyncTime(syncStatus.lastSyncTime || 0);
      }
    } catch (error) {
      if (__DEV__) console.error("❌ 초기 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, []); // [순서 변경] 2. saveRatingsLocally 선언

  const saveRatingsLocally = useCallback(
    async (newRatings: Record<string, number>): Promise<void> => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.RATINGS,
          JSON.stringify(newRatings)
        );
        setRatings(newRatings);
      } catch (error) {
        if (__DEV__) console.error("❌ 로컬 저장 실패:", error);
      }
    },
    []
  ); // [순서 변경] 3. delete/upload 선언
  const deleteRatingFromCloud = useCallback(
    async (videoId: string): Promise<void> => {
      if (!ratingsService) return;
      try {
        await ratingsService.removeRating(videoId);
        const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
        await AsyncStorage.setItem(
          STORAGE_KEYS.SYNC_STATUS,
          JSON.stringify(syncStatus)
        );
        setLastSyncTime(syncStatus.lastSyncTime);
      } catch (error: any) {
        if (__DEV__)
          console.warn(`⚠️ 클라우드 삭제 실패 (${videoId}):`, error.message);
      }
    },
    [ratingsService]
  );

  const uploadSingleRatingToCloud = useCallback(
    async (videoId: string, rating: number): Promise<void> => {
      if (!ratingsService) return;
      try {
        await ratingsService.uploadRating(videoId, rating);
        const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
        await AsyncStorage.setItem(
          STORAGE_KEYS.SYNC_STATUS,
          JSON.stringify(syncStatus)
        );
        setLastSyncTime(syncStatus.lastSyncTime);
      } catch (error: any) {
        if (__DEV__)
          console.warn(`⚠️ 클라우드 업로드 실패 (${videoId}):`, error.message);
      }
    },
    [ratingsService]
  ); // [순서 변경] 4. setRating 선언 (delete/upload에 의존)

  const setRating = useCallback(
    (videoId: string, rating: number): void => {
      if (rating < 0 || rating > 5) return;
      setRatings((prevRatings) => {
        const oldRating = prevRatings[videoId] || 0;
        if (oldRating === rating) {
          console.log(`⭐ 별점 변경 없음: ${videoId} = ${rating}점`);
          return prevRatings;
        }

        const newRatings = { ...prevRatings };
        if (rating === 0) {
          delete newRatings[videoId];
          console.log(`🗑️ 별점 삭제 (로컬): ${videoId}`);
        } else {
          newRatings[videoId] = rating;
          console.log(`⭐ 별점 설정 (로컬): ${videoId} = ${rating}점`);
        }

        AsyncStorage.setItem(
          STORAGE_KEYS.RATINGS,
          JSON.stringify(newRatings)
        ).catch((error) => console.error("❌ 로컬 저장 실패:", error));

        if (ratingChangeCallbackRef.current) {
          try {
            ratingChangeCallbackRef.current(videoId, rating, oldRating);
          } catch (error) {
            console.error("❌ 별점 변경 콜백 실행 실패:", error);
          }
        }

        if (ratingsService) {
          if (rating === 0) {
            deleteRatingFromCloud(videoId);
          } else {
            uploadSingleRatingToCloud(videoId, rating);
          }
        }

        return newRatings;
      });
    },
    [ratingsService, deleteRatingFromCloud, uploadSingleRatingToCloud]
  );

  const getRating = useCallback(
    (videoId: string): number => {
      return ratings[videoId] || 0;
    },
    [ratings]
  ); // [순서 변경] 5. forceSyncFromCloud 선언

  const forceSyncFromCloud = useCallback(
    async (overrideUserId?: string): Promise<void> => {
      const userIdToUse = overrideUserId || (user ? user.uid : null);

      let service = ratingsService;
      if (!service && userIdToUse) {
        const serviceReady = await loadFirebaseService();
        if (serviceReady && createRatingsService) {
          service = createRatingsService(userIdToUse);
          setRatingsService(service);
        }
      }

      if (!service) {
        if (__DEV__) console.warn("Firebase 서비스 생성 실패, 동기화 불가");
        return;
      }

      if (__DEV__)
        console.log(
          `🔄 수동 별점 동기화 시작... (User: ${userIdToUse?.slice(-4)})`
        );
      try {
        setIsSyncing(true);
        const cloudRatings = await service.downloadAllRatings();
        setRatings((prevRatings) => {
          const merged = { ...prevRatings, ...cloudRatings };
          AsyncStorage.setItem(
            STORAGE_KEYS.RATINGS,
            JSON.stringify(merged)
          ).catch((e) => console.error("❌ 동기화 중 로컬 저장 실패:", e));
          return merged;
        });

        const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
        await AsyncStorage.setItem(
          STORAGE_KEYS.SYNC_STATUS,
          JSON.stringify(syncStatus)
        );
        setLastSyncTime(syncStatus.lastSyncTime);
        if (__DEV__) console.log("✅ 수동 별점 동기화 완료");
      } catch (error: any) {
        if (__DEV__) console.error("❌ 클라우드 동기화 실패:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [user, ratingsService]
  ); // [순서 변경] 6. syncFromCloud / conditionalSyncFromCloud 선언

  const syncFromCloud = useCallback(async (): Promise<void> => {
    if (!ratingsService) return;
    try {
      setIsSyncing(true);
      const cloudRatings = await ratingsService.downloadAllRatings();
      const mergedRatings = { ...ratings, ...cloudRatings };
      await saveRatingsLocally(mergedRatings);

      const syncStatus: SyncStatus = { lastSyncTime: Date.now() };
      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNC_STATUS,
        JSON.stringify(syncStatus)
      );
      setLastSyncTime(syncStatus.lastSyncTime);
    } catch (error: any) {
      if (__DEV__) console.error("❌ 클라우드 동기화 실패:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [ratingsService, ratings, saveRatingsLocally]);

  const conditionalSyncFromCloud = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now - lastSyncTime > dayInMs) {
      try {
        await syncFromCloud();
      } catch (error) {
        if (__DEV__) console.warn("⚠️ 자동 동기화 실패 (무시):", error);
      }
    }
  }, [lastSyncTime, syncFromCloud]); // [순서 변경] 7. useEffect 훅 (선언된 함수들에 의존)

  useEffect(() => {
    const currentUserId = user ? user.uid : null;

    if (currentUserId !== lastUserIdRef.current) {
      console.log(
        `AUTH: 사용자 변경 감지. ${lastUserIdRef.current?.slice(
          -4
        )} -> ${currentUserId?.slice(-4)}`
      );
      setRatings({});
      setLastSyncTime(0);
      setRatingsService(null);
      if (currentUserId) {
        console.log("AUTH: 새 사용자, 서비스 초기화 및 데이터 동기화 시작...");
        initializeFirebaseService(currentUserId);
        forceSyncFromCloud(currentUserId);
      } else {
        console.log("AUTH: 로그아웃, 로컬 별점 데이터 삭제");
        AsyncStorage.removeItem(STORAGE_KEYS.RATINGS);
        AsyncStorage.removeItem(STORAGE_KEYS.SYNC_STATUS);
      }
    }
    lastUserIdRef.current = currentUserId;
  }, [user, forceSyncFromCloud, initializeFirebaseService]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]); // [순서 변경] 8. useMemo (모든 함수가 선언된 후)

  const contextValue = useMemo(
    () => ({
      ratings,
      setRating,
      getRating,
      loading,
      isSyncing,
      lastSyncTime,
      forceSyncFromCloud,
      setOnRatingChangeCallback,
    }),
    [
      ratings,
      setRating,
      getRating,
      loading,
      isSyncing,
      lastSyncTime,
      forceSyncFromCloud,
      setOnRatingChangeCallback,
    ]
  );

  return (
    <RatingsContext.Provider value={contextValue}>
      {children}
    </RatingsContext.Provider>
  );
};
// 🔗 커스텀 훅
export const useRatings = () => {
  const context = useContext(RatingsContext);
  if (!context) {
    throw new Error("useRatings must be used within a RatingsProvider");
  }
  return context;
};
