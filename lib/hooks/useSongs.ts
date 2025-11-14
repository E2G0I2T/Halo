import { useState, useEffect, useRef, useCallback } from "react";
import { Song } from "@/lib/types/song";
import { getFunctions, httpsCallable } from "firebase/functions"; // ✅ 'firebase/functions'에서 올바르게 임포트됩니다.
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

import {
  getUserRecommendations,
  sortSongsByRecommendations,
  refreshRecommendations,
} from "@/lib/services/recommendationService";

// 추천 업데이트 상태 타입
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

// Auth 상태 인터페이스
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
  // 기본 상태들
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false); // 추천 관련 상태들

  const [hasRecommendations, setHasRecommendations] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);
  const [recommendationOrder, setRecommendationOrder] = useState<string[]>([]); // 부드러운 업데이트 상태

  const [pendingRecommendationUpdate, setPendingRecommendationUpdate] =
    useState<PendingRecommendationUpdate>({
      isScheduled: false,
      countdown: 0,
      isCalculating: false,
    }); // 원본 곡 목록

  const [originalSongs, setOriginalSongs] = useState<Song[]>([]); // Auth 상태 (props에서 가져오기)

  const user = authState?.user || null;
  const isFirebaseReady = authState?.isFirebaseReady || false;
  const isAuthReady = authState?.isAuthReady || false;
  const authLoading = authState?.loading || false;

  const setErrorSafely = (errorMessage: string | null) => {
    if (typeof errorMessage === "string" && errorMessage.trim() !== "") {
      setError(errorMessage);
    } else {
      setError(null);
    }
  }; // 🔧 백그라운드 추천 계산 (재시도 로직 포함)

  const updateRecommendationsInBackground = useCallback(async () => {
    if (!user?.uid) return;

    try {
      console.log("🔄 백그라운드 추천 계산 시작 (버튼 트리거됨)");
      const userId = user.uid;

      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isCalculating: true,
        isScheduled: true, // ➕ '계산 중' 상태를 UI에 알리기 위해 true로 설정
      }));

      let attempt = 0;
      const maxAttempts = 5;
      let finalRecommendations: string[] = [];

      while (attempt < maxAttempts) {
        attempt++;
        console.log(`🔄 추천 조회 시도 ${attempt}/${maxAttempts}`);
        if (attempt > 1) {
          // 2번째 시도부터 10초 대기
          console.log(`⏳ 다음 시도까지 10초 대기...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          console.log(`✅ 10초 대기 완료! (${attempt}차 시도)`);
        }

        try {
          console.log(`🎯 ${attempt}차 추천 조회 시작...`);
          console.log("📤 전송할 userId:", userId); // 확인 // Functions 직접 호출

          const functions = getFunctions();
          const generatePersonalized = httpsCallable(
            functions,
            "generatePersonalizedRecommendations"
          );
          const result = await generatePersonalized({ userId: userId });
          const response = result.data as any;
          console.log("📡 개인화 Functions 응답:", response);

          let recommendations = [];
          if (response && !response.isDefault) {
            if (response.recommendations?.recommendations?.personalizedOrder) {
              recommendations =
                response.recommendations.recommendations.personalizedOrder;
            } else if (response.recommendations?.personalizedOrder) {
              recommendations = response.recommendations.personalizedOrder;
            }
          }

          if (recommendations.length > 0) {
            finalRecommendations = recommendations;
            break; // 성공 시 루프 탈출
          } else {
            console.log(`❌ ${attempt}차 시도 실패: 빈 추천`);
          }
        } catch (error) {
          console.error(`❌ ${attempt}차 시도 중 오류:`, error);
        }
      }

      if (finalRecommendations.length > 0) {
        // ‼️ [수정] ‼️
        // newOrder에 저장하는 대신, 즉시 자동 적용합니다.
        console.log("✨ 새로운 추천 순서 자동 적용 중...");
        const sortedSongs = sortSongsByRecommendations(
          originalSongs, // 훅 내부의 원본 곡 목록 상태
          finalRecommendations
        );

        setSongs(sortedSongs); // ⬅️ 즉시 UI 업데이트
        setRecommendationOrder(finalRecommendations);
        setHasRecommendations(true);
        console.log("✅ 새로운 추천 순서 자동 적용 완료");
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
        // 🔧 실패 시에도 상태 초기화
        isScheduled: false,
        countdown: 0,
        isCalculating: false,
        newOrder: undefined,
        timeoutId: undefined,
      });
    }
  }, [user?.uid, originalSongs]); // 🔧 별점 변경 처리 함수 (Auth 타이밍 이슈 해결의 핵심)

  const onRatingChanged = useCallback(
    (videoId: string, newRating: number, oldRating: number) => {
      // 🔕 별점 변경을 감지하지만, 아무것도(재계산) 하지 않습니다.
      console.log(
        `⭐ 별점 변경됨: ${videoId} ${oldRating} -> ${newRating}. (자동 재계산 비활성화됨)`
      );
    },
    [] // ➖ 의존성 모두 제거
  ); // 지연된 추천 업데이트 스케줄링

  const scheduleRecommendationUpdate = useCallback(
    (delay: number = 0) => {
      console.log(`🚀 추천 업데이트 즉시 실행 요청`);

      updateRecommendationsInBackground();
    },
    [pendingRecommendationUpdate.timeoutId, updateRecommendationsInBackground]
  ); // 🔧 [수정] 대기 중인 추천 취소/적용 (타입 호환을 위해 빈 함수로 둠)

  const cancelPendingRecommendations = useCallback(() => {
    console.log("cancelPendingRecommendations (비활성화됨)");
  }, []);
  const applyPendingRecommendations = useCallback(async () => {
    console.log("applyPendingRecommendations (비활성화됨)");
  }, []); // 추천 데이터 로드

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
        console.log("✅ 추천 데이터 로드 성공:", recommendations.length, "곡");
        setHasRecommendations(true);
        setRecommendationOrder(recommendations);
        return recommendations;
      } else {
        console.log("📭 추천 데이터 없음");
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
  }; // 곡 목록을 추천 순서로 정렬

  const applySongSorting = (
    rawSongs: Song[],
    recommendations: string[]
  ): Song[] => {
    if (!Array.isArray(rawSongs) || rawSongs.length === 0) {
      return rawSongs;
    }
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.log("📝 추천 순서 없음, 원본 순서 유지");
      return rawSongs;
    }
    console.log("🔀 곡 목록을 추천 순서로 정렬 중...");
    const sortedSongs = sortSongsByRecommendations(rawSongs, recommendations);
    console.log("✅ 추천 정렬 완료:", {
      totalSongs: rawSongs.length,
      recommendedSongs: recommendations.length,
      sortedSongs: sortedSongs.length,
    });
    return sortedSongs;
  }; // 초기 데이터 로드

  const loadInitialData = async () => {
    try {
      console.log("📥 초기 데이터 로드 시작...");

      // 1. 캐시/폴백으로 원본 곡 목록 확보
      const cachedSongs = await getCachedSongs();
      let initialSongs: Song[] = [];
      if (cachedSongs.length > 0) {
        console.log("✅ 캐시된 곡 로드:", cachedSongs.length, "개");
        initialSongs = cachedSongs;
      } else {
        console.log("📦 Fallback 곡 데이터 사용:", fallbackSongs.length, "개");
        initialSongs = fallbackSongs;
      }
      setOriginalSongs(initialSongs);

      // 2. Auth 상태에 따라 추천 목록 로드 (로그인 상태 확인)
      let recommendations: string[] = [];
      if (isAuthReady && user?.uid) {
        // ⬅️ isAuthReady 체크
        console.log("📥 초기 로드 중 추천 목록 가져오기...");
        recommendations = await loadRecommendations(user.uid);
      }

      // 3. 정렬된 목록으로 'songs' 상태 설정
      const sortedSongs = applySongSorting(initialSongs, recommendations);
      setSongs(sortedSongs); // 4. 백그라운드에서 새 데이터 확인
      const shouldCheck = await shouldCheckForNewData();
      if (shouldCheck) {
        console.log("🔍 [BG] 새 데이터 확인 중...");
        const hasNewData = await checkForNewData();

        if (hasNewData) {
          console.log("🆕 [BG] 새 데이터 발견, 업데이트 중...");
          await updateDataFromFirebase(); // ⬅️ 이것은 setSongs를 다시 호출함
        } else {
          console.log("👍 [BG] 데이터가 최신입니다.");
        }
        await markTodayAsChecked();
      }
    } catch (error: any) {
      console.error("❌ 초기 데이터 로드 실패:", error);
      if (songs.length === 0) {
        // ⬅️ state 'songs'
        setOriginalSongs(fallbackSongs);
        setSongs(fallbackSongs);
        console.log("🔄 에러 발생, Fallback 데이터 사용");
      }
      setErrorSafely(
        `데이터 로드 실패: ${error?.message || "알 수 없는 오류"}`
      );
    } finally {
      // ‼️ [수정] 모든 작업이 끝난 후 로딩 해제
      setLoading(false);
      console.log("✅ 초기 로드 절차 완료. UI 렌더링.");
    }
  }; // Firebase에서 새 데이터 업데이트

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
        console.log("🎯 추천 데이터도 함께 새로고침...");
        const recommendations = await loadRecommendations(
          user.uid,
          ignoreCache
        );
        sortedSongs = applySongSorting(newSongs, recommendations);
      }

      setSongs(sortedSongs);
      await cacheSongs(newSongs);

      console.log(
        "✅ Firebase 데이터 업데이트 완료:",
        sortedSongs.length,
        "개"
      );
    } catch (error: any) {
      console.error("❌ Firebase 업데이트 실패:", error);
      setErrorSafely(
        `데이터 업데이트 실패: ${error?.message || "알 수 없는 오류"}`
      );
    } finally {
      setIsUpdating(false);
    }
  }; // 수동 새로고침

  const refreshData = async (): Promise<void> => {
    try {
      console.log("🔄 [useSongs] 수동 새로고침 시작 (songs.json + 기존 recs)");

      cancelPendingRecommendations();

      if (isAuthReady && user?.uid) {
        console.log("🎯 추천 데이터 강제 새로고침...");
        await refreshRecommendations(user.uid);
      }

      await updateDataFromFirebase(true);
    } catch (error: any) {
      console.error("❌ 수동 새로고침 실패:", error);
    }
  };

  useEffect(() => {
    // ‼️ [수정] Auth 상태가 준비된(true) 후에만 초기 로드를 시작
    if (isAuthReady) {
      loadInitialData();
    }
  }, [isAuthReady, user]);

  return {
    songs,
    loading,
    error,
    isUpdating,
    refreshData, // ⬅️ 'songs.json' 동기화용
    hasRecommendations,
    isLoadingRecommendations: isLoadingRecommendations || loading,
    pendingRecommendationUpdate, // ⬅️ '계산 중' 상태 확인용 // 🔧 [수정] 타입 호환을 위한 빈 함수
    applyPendingRecommendations,
    cancelPendingRecommendations,
    scheduleRecommendationUpdate, // ⬅️ '재계산' 트리거용
    _internal: {
      // 🔧 [수정] 타입 호환을 위한 빈 함수
      setOnRatingChangeCallback: () => {},
      onRatingChanged: () => {},
    },
  };
};
