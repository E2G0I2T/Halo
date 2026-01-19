import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Song } from "@/lib/types/song";
import { getFunctions, httpsCallable } from "firebase/functions";
import { User } from "firebase/auth";
import {
  fetchSongsFromFirebase,
  getCachedSongs,
  cacheSongs,
  fallbackSongs,
  checkForNewData,
  shouldCheckForNewData,
  markTodayAsChecked,
} from "@/lib/services/firebaseService";

import { getUserRecommendations } from "@/lib/services/recommendationService";

const sortSongsByRecommendations = (
  songs: Song[],
  recommendationOrder: string[]
): Song[] => {
  if (!Array.isArray(songs) || songs.length === 0) return [];
  
  if (!Array.isArray(recommendationOrder) || recommendationOrder.length === 0) {
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  console.log("🔀 [useSongs] T2(추천) + T3(랜덤) 정렬 시작...");

  const priorityMap = new Map<string, number>();
  recommendationOrder.forEach((videoId, index) => {
    priorityMap.set(videoId, index);
  });

  const recommendedSongs: (Song & { priority: number })[] = [];
  const otherSongs: Song[] = [];

  songs.forEach((song) => {
    const priority = priorityMap.get(song.videoId);
    if (priority !== undefined) {
      recommendedSongs.push({ ...song, priority });
    } else {
      otherSongs.push(song);
    }
  });

  recommendedSongs.sort((a, b) => a.priority - b.priority);

  for (let i = otherSongs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
  }
  
  return [...recommendedSongs, ...otherSongs];
};

interface PendingRecommendationUpdate {
  isScheduled: boolean;
  countdown: number;
  isCalculating: boolean;
  newOrder?: string[];
  timeoutId?: number;
}

// 배열 비교 헬퍼 함수
const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

type RatingChangeCallback = (
  videoId: string,
  newRating: number,
  oldRating: number
) => void;

interface AuthState {
  user: User | null;
  isFirebaseReady: boolean;
  isAuthReady: boolean;
  loading: boolean;
}

interface UseSongsReturn {
  songs: Song[];
  loading: boolean;
  error: string | null;
  isUpdating: boolean;
  refreshData: () => Promise<void>;
  hasRecommendations: boolean;
  isLoadingRecommendations: boolean;
  recommendationOrder: string[];
  pendingRecommendationUpdate: PendingRecommendationUpdate;
  applyPendingRecommendations: () => Promise<void>;
  cancelPendingRecommendations: () => void;
  scheduleRecommendationUpdate: (delay?: number) => void;
  _internal: {
    setOnRatingChangeCallback: (callback: RatingChangeCallback) => void;
    onRatingChanged: RatingChangeCallback;
  };
}

export const useSongs = (authState?: AuthState): UseSongsReturn => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [hasRecommendations, setHasRecommendations] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);
  const [recommendationOrder, setRecommendationOrder] = useState<string[]>([]);
  const [originalSongs, setOriginalSongs] = useState<Song[]>([]);

  const [pendingRecommendationUpdate, setPendingRecommendationUpdate] =
    useState<PendingRecommendationUpdate>({
      isScheduled: false,
      countdown: 0,
      isCalculating: false,
    });

  const user = authState?.user || null;
  const isFirebaseReady = authState?.isFirebaseReady || false;
  const isAuthReady = authState?.isAuthReady || false;
  const authLoading = authState?.loading || false;

  const sortedSongs = useMemo(() => {
    return sortSongsByRecommendations(originalSongs, recommendationOrder);
  }, [originalSongs, recommendationOrder]);

  const setErrorSafely = (errorMessage: string | null) => {
    if (typeof errorMessage === "string" && errorMessage.trim() !== "") {
      setError(errorMessage);
    } else {
      setError(null);
    }
  };

  const updateRecommendationsInBackground = useCallback(async () => {
    if (!user?.uid) return;

    try {
      console.log("🔄 백그라운드 추천 계산 시작 (버튼 트리거됨)");
      const userId = user.uid;

      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isCalculating: true,
        isScheduled: true,
      }));

      let attempt = 0;
      const maxAttempts = 5;
      let finalRecommendations: string[] = [];

      while (attempt < maxAttempts) {
        attempt++;
        console.log(`🔄 추천 조회 시도 ${attempt}/${maxAttempts}`);
        if (attempt > 1) {
          console.log(`⏳ 다음 시도까지 10초 대기...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          console.log(`✅ 10초 대기 완료! (${attempt}차 시도)`);
        }

        try {
          console.log(`🎯 ${attempt}차 추천 조회 시작...`);
          const functions = getFunctions();
          const generatePersonalized = httpsCallable(
            functions,
            "generatePersonalizedRecommendations"
          );
          const result = await generatePersonalized({ userId: userId });
          const response = result.data as any;
          console.log("📡 개인화 Functions 응답:", response);

          let recommendations: string[] = [];

          if (response && !response.isDefault && response.recommendations) {
            if (
              response.recommendations.songs &&
              Array.isArray(response.recommendations.songs)
            ) {
              recommendations = response.recommendations.songs;
            } else if (
              response.recommendations?.personalizedOrder &&
              Array.isArray(response.recommendations.personalizedOrder)
            ) {
              recommendations = response.recommendations.personalizedOrder;
            }
          }
          if (recommendations.length > 0) {
            console.log(
              `✅ ${attempt}차 시도 성공: ${recommendations.length}곡`
            );
            finalRecommendations = recommendations;
            break;
          } else {
            console.log(
              `❌ ${attempt}차 시도 실패: 빈 추천 (songs 키를 확인하세요)`
            );
          }
        } catch (error) {
          console.error(`❌ ${attempt}차 시도 중 오류:`, error);
        }
      }

      if (finalRecommendations.length > 0) {
        console.log("✨ 새로운 추천 순서 자동 적용 중...");

        setRecommendationOrder(finalRecommendations);
        setHasRecommendations(true);
        console.log("✅ 새로운 추천 순서 적용 완료");
      } else {
        console.log("😞 모든 시도 실패, 추천 업데이트 취소");
      }

      setPendingRecommendationUpdate({
        isScheduled: false,
        countdown: 0,
        isCalculating: false,
        newOrder: undefined,
        timeoutId: undefined,
      });
    } catch (error: any) {
      console.error("❌ 백그라운드 추천 계산 실패:", error);
      setPendingRecommendationUpdate({
        isScheduled: false,
        countdown: 0,
        isCalculating: false,
        newOrder: undefined,
        timeoutId: undefined,
      });
    }
  }, [user?.uid]);

  const onRatingChanged = useCallback(
    (videoId: string, newRating: number, oldRating: number) => {
      console.log(
        `⭐ 별점 변경됨: ${videoId} ${oldRating} -> ${newRating}. (자동 재계산 비활성화됨)`
      );
    },
    []
  );

  const scheduleRecommendationUpdate = useCallback(
    (delay: number = 0) => {
      console.log(`🚀 추천 업데이트 즉시 실행 요청`);

      updateRecommendationsInBackground();
    },
    [updateRecommendationsInBackground]
  );

  const cancelPendingRecommendations = useCallback(() => {
    console.log("cancelPendingRecommendations (비활성화됨)");
  }, []);
  const applyPendingRecommendations = useCallback(async () => {
    console.log("applyPendingRecommendations (비활성화됨)");
  }, []);

  const loadRecommendations = async (
    userId: string,
    forceRefresh: boolean = false
  ): Promise<string[]> => {
    if (!userId || userId.trim() === "") {
      console.warn("⚠️ 유효하지 않은 사용자 ID, 추천 로드 스킵");
      setHasRecommendations(false);
      setRecommendationOrder([]);
      return [];
    }

    try {
      console.log(
        `🎯 추천 데이터 로드 시작: ${userId} (새로고침: ${forceRefresh})`
      );
      setIsLoadingRecommendations(true);

      const recommendations = await getUserRecommendations(
        userId,
        forceRefresh
      );

      if (recommendations.length > 0) {
        setHasRecommendations(true);
        setRecommendationOrder(recommendations);
        return recommendations;
      } else {
        setHasRecommendations(false);
        setRecommendationOrder([]);
        return [];
      }
    } catch (error: any) {
      console.error("❌ 추천 데이터 로드 실패:", error);
      setHasRecommendations(false);
      setRecommendationOrder([]);
      return [];
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const loadInitialData = async () => {
    try {
      console.log("📥 초기 데이터 로드 시작...");
      
      const cachedSongs = await getCachedSongs();
      let initialSongs: Song[] = [];
      if (cachedSongs.length > 0) {
        initialSongs = cachedSongs;
      } else {
        initialSongs = fallbackSongs;
      }

      setOriginalSongs(initialSongs);

      if (isAuthReady && user?.uid) {
        await loadRecommendations(user.uid);
      }

      const shouldCheck = await shouldCheckForNewData(); 

      if (shouldCheck) {
        console.log("🔍 [BG] 정기 데이터 업데이트 확인 중...");
        
        await updateDataFromFirebase(true); 
        
        await markTodayAsChecked();
      } else {
        console.log("👍 [BG] 오늘은 이미 최신 데이터를 확인했습니다.");
      }

    } catch (error: any) {
      console.error("❌ 초기 데이터 로드 실패:", error);
      if (originalSongs.length === 0) {
        setOriginalSongs(fallbackSongs);
      }
      setErrorSafely(
        `데이터 로드 실패: ${error?.message || "알 수 없는 오류"}`
      );
    } finally {
      setLoading(false);
      console.log("✅ 초기 로드 절차 완료.");
    }
  };

  const updateDataFromFirebase = async (ignoreCache: boolean = false) => {
    try {
      setIsUpdating(true);
      setErrorSafely(null);

      console.log("📥 Firebase에서 곡 데이터 업데이트...");
      const newSongs = await fetchSongsFromFirebase(ignoreCache);

      if (!Array.isArray(newSongs) || newSongs.length === 0) {
        throw new Error("Firebase에서 유효한 데이터를 받지 못했습니다");
      }
      setOriginalSongs(newSongs);

      let sortedSongs = newSongs;
      if (isAuthReady && user?.uid) {
        const recommendations = await loadRecommendations(
          user.uid,
          ignoreCache
        );
      }

      await cacheSongs(newSongs);

      console.log("✅ Firebase 데이터 업데이트 완료:", newSongs.length, "개");
    } catch (error: any) {
      console.error("❌ Firebase 업데이트 실패:", error);
      setErrorSafely(
        `데이터 업데이트 실패: ${error?.message || "알 수 없는 오류"}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const refreshData = async (): Promise<void> => {
    try {
      console.log("🔄 [useSongs] 수동 새로고침 시작 (songs.json + 기존 recs)");

      await updateDataFromFirebase(true);
    } catch (error: any) {
      console.error("❌ 수동 새로고침 실패:", error);
    }
  };

  useEffect(() => {
    if (isAuthReady) {
      loadInitialData();
    }
  }, [isAuthReady, user]);

  return {
    songs: sortedSongs,
    loading,
    error,
    isUpdating,
    refreshData,
    hasRecommendations,
    isLoadingRecommendations: isLoadingRecommendations || loading,
    recommendationOrder,
    pendingRecommendationUpdate,
    applyPendingRecommendations: async () => {},
    cancelPendingRecommendations: () => {},
    scheduleRecommendationUpdate: useCallback(
      (d = 0) => updateRecommendationsInBackground(),
      [updateRecommendationsInBackground]
    ),
    _internal: {
      setOnRatingChangeCallback: () => {},
      onRatingChanged: () => {},
    },
  };
};
