import { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '@/lib/types/song';
import { getFunctions, httpsCallable } from 'firebase/functions'; // ✅ 'firebase/functions'에서 올바르게 임포트됩니다.
import { User } from 'firebase/auth';
import { 
  fetchSongsFromFirebase, 
  getCachedSongs, 
  cacheSongs, 
  fallbackSongs,
  checkForNewData,
  shouldCheckForNewData,
  markTodayAsChecked
} from '@/lib/services/firebaseService';

import { 
  getUserRecommendations,
  sortSongsByRecommendations,
  refreshRecommendations 
} from '@/lib/services/recommendationService';

// 지연된 별점 변경 타입
interface PendingRatingChange {
  videoId: string;
  newRating: number;
  oldRating: number;
  timestamp: number;
}

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
  const [isUpdating, setIsUpdating] = useState(false);

  // 추천 관련 상태들
  const [hasRecommendations, setHasRecommendations] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);
  const [recommendationOrder, setRecommendationOrder] = useState<string[]>([]);

  // 부드러운 업데이트 상태
  const [pendingRecommendationUpdate, setPendingRecommendationUpdate] =
    useState<PendingRecommendationUpdate>({
      isScheduled: false,
      countdown: 0,
      isCalculating: false,
    });

  // 원본 곡 목록
  const [originalSongs, setOriginalSongs] = useState<Song[]>([]);

  // 🆕 지연된 별점 변경 큐 (핵심 해결책)
  const [pendingRatingChanges, setPendingRatingChanges] = useState<
    PendingRatingChange[]
  >([]);

  // 별점 변경 콜백 참조
  const ratingChangeCallbackRef = useRef<RatingChangeCallback | null>(null);

  // Auth 상태 (props에서 가져오기)
  const user = authState?.user || null;
  const isFirebaseReady = authState?.isFirebaseReady || false;
  const isAuthReady = authState?.isAuthReady || false;
  const authLoading = authState?.loading || false;

  // 카운트다운 타이머 참조
  const countdownTimerRef = useRef<number | undefined>(undefined);

  const setErrorSafely = (errorMessage: string | null) => {
    if (typeof errorMessage === "string" && errorMessage.trim() !== "") {
      setError(errorMessage);
    } else {
      setError(null);
    }
  };

  const setOnRatingChangeCallback = useCallback(
    (callback: RatingChangeCallback) => {
      console.log("🔗 별점 변경 콜백 등록:", callback ? "등록됨" : "해제됨");
      ratingChangeCallbackRef.current = callback;
    },
    []
  );

  // 🆕 지연된 별점 변경 처리 함수
  const processPendingRatingChanges = useCallback(async () => {
    if (pendingRatingChanges.length === 0) {
      console.log("📝 처리할 지연된 별점 변경 없음");
      return;
    }

    if (!isAuthReady || !user?.uid) {
      console.log("⏳ Auth 아직 준비 안됨, 지연된 별점 변경 계속 대기");
      return;
    }

    console.log(`🔄🔄🔄 === 지연된 별점 변경 처리 시작 ===`);
    console.log(`📝 처리할 변경 건수: ${pendingRatingChanges.length}`);

    // 가장 최근 의미있는 변경만 찾기
    const significantChanges = pendingRatingChanges.filter((change) => {
      const isSignificant =
        (change.oldRating === 0 && change.newRating > 0) ||
        (change.oldRating > 0 && change.newRating === 0) ||
        (change.oldRating > 0 &&
          change.newRating > 0 &&
          change.oldRating !== change.newRating);
      return isSignificant;
    });

    if (significantChanges.length > 0) {
      console.log(
        `✨ 의미있는 지연된 변경 발견: ${significantChanges.length}건`
      );
      console.log("🎯 추천 업데이트 스케줄링...");

      // 3초 카운트다운으로 추천 업데이트
      scheduleRecommendationUpdate(3000);
    } else {
      console.log("📝 의미있는 변경 없음, 추천 업데이트 스킵");
    }

    // 처리된 변경들 제거
    setPendingRatingChanges([]);
    console.log("✅ 지연된 별점 변경 처리 완료");
  }, [pendingRatingChanges, isAuthReady, user?.uid]);

  // 🔧 백그라운드 추천 계산 (재시도 로직 포함)
  const updateRecommendationsInBackground = useCallback(async () => {
    if (!user?.uid) return;

    try {
      console.log("🔄 백그라운드 추천 계산 시작...");
      console.log("🆕🆕🆕 === 재시도 로직 버전 실행 ===");

      const userId = user.uid; // userId 변수 확실히 저장
      console.log("🔑 userId 확인:", userId); // 디버깅용

      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isCalculating: true,
      }));

      let attempt = 0;
      const maxAttempts = 5;
      let finalRecommendations: string[] = [];

      while (attempt < maxAttempts) {
        attempt++;
        console.log(`🔄 추천 조회 시도 ${attempt}/${maxAttempts}`);

        if (attempt > 1) {
          console.log(`⏳ 다음 시도까지 30초 대기...`);
          await new Promise((resolve) => setTimeout(resolve, 30000));
          console.log(`✅ 30초 대기 완료! (${attempt}차 시도)`);
        } else {
          console.log(`⏳ 첫 번째 시도 - 10초 대기...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          console.log(`✅ 10초 대기 완료! (첫 시도)`);
        }

        try {
          console.log(`🎯 ${attempt}차 추천 조회 시작...`);
          console.log("📤 전송할 userId:", userId); // 확인

          // Functions 직접 호출
          const functions = getFunctions();
          const generatePersonalized = httpsCallable(
            functions,
            "generatePersonalizedRecommendations"
          );
          const result = await generatePersonalized({
            userId: userId, // 명확한 userId 전달
          });

          const response = result.data as any;
          console.log("📡 개인화 Functions 응답:", response);

          let recommendations = [];

          // 응답 파싱
          if (response && !response.isDefault) {
            if (response.recommendations?.recommendations?.personalizedOrder) {
              recommendations =
                response.recommendations.recommendations.personalizedOrder;
            }
            // (혹시 모를) 이전 버전 호환용
            else if (response.recommendations?.personalizedOrder) {
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
            console.log(`❌ ${attempt}차 시도 실패: 빈 추천`);
          }
        } catch (error) {
          console.error(`❌ ${attempt}차 시도 중 오류:`, error);
        }
      }

      if (finalRecommendations.length > 0) {
        console.log("🎉 최종 추천 결과:", finalRecommendations.length, "곡");

        setPendingRecommendationUpdate((prev) => ({
          ...prev,
          isCalculating: false,
          newOrder: finalRecommendations,
        }));
      } else {
        console.log("😞 모든 시도 실패, 추천 업데이트 취소");
        setPendingRecommendationUpdate({
          isScheduled: false,
          countdown: 0,
          isCalculating: false,
          newOrder: undefined,
          timeoutId: undefined,
        });
        // ❌ 아래 줄은 복사/붙여넣기 오류입니다. 제거합니다.
        // _http_chunk_receiver.http_chunk_receiver.js:1248 
      }
    } catch (error: any) {
      console.error("❌ 백그라운드 추천 계산 실패:", error);
      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isCalculating: false,
      }));
    }
  }, [user?.uid]);

  // 🔧 별점 변경 처리 함수 (Auth 타이밍 이슈 해결의 핵심)
  const onRatingChanged = useCallback(
    (videoId: string, newRating: number, oldRating: number) => {
      console.log("🟦🟦🟦 === onRatingChanged 호출됨! ===");
      console.log("🟦🟦🟦 파라미터:", { videoId, newRating, oldRating });

      console.log("🟦🟦🟦 현재 Auth 상태:", {
        isAuthReady,
        hasUser: !!user?.uid,
        userId: user?.uid,
        isFirebaseReady,
        authLoading,
      });

      console.log(`⭐ 별점 변경 감지: ${videoId} ${oldRating} → ${newRating}`);

      const isSignificantChange =
        (oldRating === 0 && newRating > 0) ||
        (oldRating > 0 && newRating === 0) ||
        (oldRating > 0 && newRating > 0 && oldRating !== newRating);

      console.log("🔍🔍🔍 === 상태 체크 상세 정보 ===");
      console.log(`   significant=${isSignificantChange}`);
      console.log(`   hasUser=${!!user?.uid}`);
      console.log(`   authReady=${isAuthReady}`);
      console.log(`   firebaseReady=${isFirebaseReady}`);
      console.log(`   userId=${user?.uid || "null"}`);
      console.log(`   authLoading=${authLoading}`);

      // 의미없는 변경은 무시
      if (!isSignificantChange) {
        console.log(`❌❌❌ 별점 변경이 미미함 (${oldRating} → ${newRating})`);
        return;
      }

      // 🆕 핵심 해결책: Auth가 준비되지 않은 경우 지연 처리
      if (!isAuthReady || !user?.uid) {
        console.log(`⏳⏳⏳ === Auth 준비 안됨, 지연 처리 ===`);
        console.log(`   isAuthReady: ${isAuthReady}`);
        console.log(`   user?.uid: ${user?.uid || "null"}`);

        const pendingChange: PendingRatingChange = {
          videoId,
          newRating,
          oldRating,
          timestamp: Date.now(),
        };

        setPendingRatingChanges((prev) => {
          // 같은 videoId의 이전 변경은 제거하고 최신 것만 유지
          const filtered = prev.filter((change) => change.videoId !== videoId);
          const newQueue = [...filtered, pendingChange];

          console.log(
            `📝 지연된 별점 변경 큐에 추가: ${videoId} (큐 크기: ${newQueue.length})`
          );
          return newQueue;
        });

        console.log(
          `⏳ Auth 준비 후 처리 예정: ${videoId} ${oldRating} → ${newRating}`
        );
        return;
      }

      // 🎉 Auth 준비 완료 - 즉시 추천 업데이트
      console.log(`✅✅✅ === Auth 준비 완료! 즉시 추천 업데이트 ===`);
      console.log("📅 추천 업데이트 스케줄링...");

      // 기존 타이머들 정리
      if (pendingRecommendationUpdate.timeoutId) {
        console.log(
          "🛑 기존 타이머 정리:",
          pendingRecommendationUpdate.timeoutId
        );
        clearTimeout(pendingRecommendationUpdate.timeoutId);
      }
      if (countdownTimerRef.current) {
        console.log(
          "🛑 기존 카운트다운 타이머 정리:",
          countdownTimerRef.current
        );
        clearTimeout(countdownTimerRef.current);
      }

      const delay = 3000; // 3초
      const startTime = Date.now();
      const countdownSeconds = Math.ceil(delay / 1000);

      console.log("⏰⏰⏰ === 알림 바 표시 시작 ===");
      console.log(`⏰ 알림 바 표시 시작, ${countdownSeconds}초 카운트다운`);

      // 카운트다운 함수
      const updateCountdown = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((delay - elapsed) / 1000));

        console.log(`⏰ 카운트다운 업데이트: ${remaining}초 남음`);

        setPendingRecommendationUpdate((prev) => {
          const newState = {
            ...prev,
            isScheduled: true,
            countdown: remaining,
          };
          return newState;
        });

        if (remaining > 0) {
          countdownTimerRef.current = setTimeout(updateCountdown, 1000) as unknown as number;
        }
      };

      updateCountdown();

      // 3초 후 백그라운드 추천 계산
      const timeoutId = setTimeout(() => {
        console.log("🔄🔄🔄 === 3초 후 백그라운드 계산 시작 ===");
        updateRecommendationsInBackground();
      }, delay);

      console.log(`⏲️ 메인 타이머 설정: ${timeoutId}`);

      // 타이머 ID 저장
      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isScheduled: true,
        countdown: countdownSeconds,
        timeoutId: timeoutId as unknown as number,
      }));

      console.log("🟦🟦🟦 === onRatingChanged 완료 ===");
    },
    [
      user,
      isAuthReady,
      isFirebaseReady,
      authLoading,
      updateRecommendationsInBackground,
      pendingRecommendationUpdate.timeoutId,
    ]
  );

  // 🆕 Auth 상태 변경 시 지연된 별점 변경 처리 (핵심 해결 로직)
  useEffect(() => {
    console.log("🔄📝 === Auth 상태 변경 - 지연된 별점 변경 체크 ===");
    console.log(`   isAuthReady: ${isAuthReady}`);
    console.log(`   user?.uid: ${user?.uid}`);
    console.log(
      `   pendingRatingChanges.length: ${pendingRatingChanges.length}`
    );

    if (isAuthReady && user?.uid && pendingRatingChanges.length > 0) {
      console.log("🔄 Auth 준비 완료 + 지연된 변경 있음 → 처리 시작");
      processPendingRatingChanges();
    }
  }, [
    isAuthReady,
    user?.uid,
    pendingRatingChanges.length,
    processPendingRatingChanges,
  ]);

  // 지연된 추천 업데이트 스케줄링
  const scheduleRecommendationUpdate = useCallback(
    (delay: number = 3000) => {
      // 기존 스케줄 취소
      if (pendingRecommendationUpdate.timeoutId) {
        clearTimeout(pendingRecommendationUpdate.timeoutId);
      }

      console.log(`⏰ 추천 업데이트 스케줄: ${delay}ms 후`);

      // 즉시 실행인 경우
      if (delay === 0) {
        console.log("🚀 즉시 추천 업데이트 실행");
        updateRecommendationsInBackground();
        return;
      }

      // 카운트다운 시작
      const startTime = Date.now();
      const countdownSeconds = Math.ceil(delay / 1000);

      const updateCountdown = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((delay - elapsed) / 1000));

        setPendingRecommendationUpdate((prev) => ({
          ...prev,
          isScheduled: true,
          countdown: remaining,
        }));

        if (remaining > 0) {
          // ✅ TypeScript 'Timeout' 타입 오류 수정
          setTimeout(updateCountdown, 1000) as unknown as number;
        }
      };

      updateCountdown();

      // 백그라운드에서 추천 계산 시작
      const timeoutId = setTimeout(() => {
        updateRecommendationsInBackground();
      }, delay);

      setPendingRecommendationUpdate((prev) => ({
        ...prev,
        isScheduled: true,
        countdown: countdownSeconds,
        timeoutId: timeoutId as unknown as number,
      }));
    },
    [pendingRecommendationUpdate.timeoutId, updateRecommendationsInBackground]
  );

  // 대기 중인 추천 취소
  const cancelPendingRecommendations = useCallback(() => {
    console.log("🛑 추천 업데이트 취소: 모든 타이머 정리 중...");

    if (pendingRecommendationUpdate.timeoutId) {
      clearTimeout(pendingRecommendationUpdate.timeoutId);
    }
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = undefined;
    }

    setPendingRecommendationUpdate({
      isScheduled: false,
      countdown: 0,
      isCalculating: false,
      newOrder: undefined,
      timeoutId: undefined,
    });

    console.log("❌ 추천 업데이트 취소됨");
  }, [pendingRecommendationUpdate.timeoutId]);

  // 대기 중인 추천 적용
  const applyPendingRecommendations = useCallback(async () => {
    if (!pendingRecommendationUpdate.newOrder || originalSongs.length === 0) {
      console.warn("적용할 추천 순서가 없습니다");
      return;
    }

    try {
      console.log("✨ 새로운 추천 순서 적용 중...");

      const sortedSongs = sortSongsByRecommendations(
        originalSongs,
        pendingRecommendationUpdate.newOrder
      );

      setSongs(sortedSongs);
      setRecommendationOrder(pendingRecommendationUpdate.newOrder);
      setHasRecommendations(true);

      console.log("✅ 새로운 추천 순서 적용 완료");

      cancelPendingRecommendations();
    } catch (error: any) {
      console.error("❌ 추천 순서 적용 실패:", error);
      cancelPendingRecommendations();
    }
  }, [
    pendingRecommendationUpdate.newOrder,
    originalSongs,
    cancelPendingRecommendations,
  ]);

  // 추천 데이터 로드
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
  };

  // 곡 목록을 추천 순서로 정렬
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
  };

  // 초기 데이터 로드
  const loadInitialData = async () => {
    try {
      console.log("📥 초기 데이터 로드 시작...");

      const cachedSongs = await getCachedSongs();
      if (cachedSongs.length > 0) {
        console.log("✅ 캐시된 곡 로드:", cachedSongs.length, "개");

        setOriginalSongs(cachedSongs);

        if (isAuthReady && user?.uid) {
          const recommendations = await loadRecommendations(user.uid);
          const sortedSongs = applySongSorting(cachedSongs, recommendations);
          setSongs(sortedSongs);
        } else {
          setSongs(cachedSongs);
        }
      } else {
        setOriginalSongs(fallbackSongs);
        setSongs(fallbackSongs);
        console.log("📦 Fallback 곡 데이터 사용:", fallbackSongs.length, "개");
      }

      setLoading(false);

      const shouldCheck = await shouldCheckForNewData();
      if (shouldCheck) {
        console.log("🔍 새 데이터 확인 중...");
        const hasNewData = await checkForNewData();

        if (hasNewData) {
          console.log("🆕 새 데이터 발견, 업데이트 중...");
          await updateDataFromFirebase();
        }

        await markTodayAsChecked();
      }
    } catch (error: any) {
      console.error("❌ 초기 데이터 로드 실패:", error);

      if (songs.length === 0) {
        setOriginalSongs(fallbackSongs);
        setSongs(fallbackSongs);
        console.log("🔄 에러 발생, Fallback 데이터 사용");
      }

      setErrorSafely(
        `데이터 로드 실패: ${error?.message || "알 수 없는 오류"}`
      );
      setLoading(false);
    }
  };

  // Firebase에서 새 데이터 업데이트
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
  };

  // 수동 새로고침
  const refreshData = async (): Promise<void> => {
    try {
      console.log("🔄 수동 새로고침 시작...");

      cancelPendingRecommendations();

      if (isAuthReady && user?.uid) {
        console.log("🎯 추천 데이터 강제 새로고침...");
        await refreshRecommendations(user.uid);
      }

      await updateDataFromFirebase(true);
    // ❌ 아래 'S'는 복사/붙여넣기 오류입니다. 제거합니다.
    } catch (error: any) {
      console.error("❌ 수동 새로고침 실패:", error);
    }
  };

  // useEffect들
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    console.log("🔄🔄🔄 === Auth 상태 변경 감지 useEffect 실행 ===");
    console.log(`   isAuthReady: ${isAuthReady}`);
    console.log(`   user?.uid: ${user?.uid}`);
    console.log(`   originalSongs.length: ${originalSongs.length}`);

    if (isAuthReady && user?.uid && originalSongs.length > 0) {
      console.log("🔄 Auth 준비 완료 - 사용자 상태 재체크:", user.uid);

      loadRecommendations(user.uid).then((recommendations) => {
        if (recommendations.length > 0) {
          const sortedSongs = applySongSorting(originalSongs, recommendations);
          setSongs(sortedSongs);
          console.log("✅ Auth 준비 완료 후 추천 정렬 적용 완료");
        }
      });
    } else if (isAuthReady && !user && originalSongs.length > 0) {
      console.log("🔐 사용자 로그아웃, 추천 상태 초기화");
      setHasRecommendations(false);
      setRecommendationOrder([]);
      cancelPendingRecommendations();

      setSongs(originalSongs);
    } else {
      console.log("⏳ Auth 상태 변경 조건 미충족, 대기 중...");
    }
  }, [user?.uid, isAuthReady, originalSongs]);

  useEffect(() => {
    console.log("🔗🔗🔗 === useSongs와 RatingsContext 연결 체크 ===");
    console.log(`   콜백 등록됨: ${!!ratingChangeCallbackRef.current}`);

    if (ratingChangeCallbackRef.current) {
      console.log("✅ useSongs ↔ RatingsContext 연결 완료");
    } else {
      console.log("⚠️⚠️⚠️ RatingsContext 콜백이 아직 등록되지 않음");
    }
    // ❌ 아래 'M'은 복사/붙여넣기 오류입니다. 제거합니다.

    return () => {
      console.log("🔌 useSongs ↔ RatingsContext 연결 해제");
    };
  }, [ratingChangeCallbackRef.current]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (pendingRecommendationUpdate.timeoutId) {
        clearTimeout(pendingRecommendationUpdate.timeoutId);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [pendingRecommendationUpdate.timeoutId]);

  return {
    songs,
    loading,
    error,
    isUpdating,
    refreshData,
    hasRecommendations,
    isLoadingRecommendations: isLoadingRecommendations || loading,
    pendingRecommendationUpdate,
    applyPendingRecommendations,
    cancelPendingRecommendations,
    scheduleRecommendationUpdate,
    _internal: {
      setOnRatingChangeCallback,
      onRatingChanged,
    },
  };
};