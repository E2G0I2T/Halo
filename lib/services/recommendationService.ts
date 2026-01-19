// lib/services/recommendationService.ts

import { httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { functions } from "@/lib/config/firebase";
import { Song } from "@/lib/types/song";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RECOMMENDATIONS_CACHE_KEY = "user-recommendations";
const RECOMMENDATIONS_CACHE_EXPIRY_KEY = "recommendations-cache-expiry";
const CACHE_DURATION = 60 * 60 * 1000;

export interface UserRecommendation {
  userId: string;
  songs: string[];
  scores?: Record<string, number>;
  categories?: Record<string, any>;
  generatedAt: string;
  processingTime?: number;
  userRatingCount?: number;
}

export interface RecommendationServiceResponse {
  success: boolean;
  data?: UserRecommendation;
  message?: string;
  error?: string;
}

class RecommendationService {
  private getUserRecommendationsFunction: any;
  private generateUserRecommendationsFunction: any;

  constructor() {
    this.getUserRecommendationsFunction = httpsCallable(
      functions,
      "getUserRecommendations"
    );
    this.generateUserRecommendationsFunction = httpsCallable(
      functions,
      "generateUserRecommendations"
    );

    if (__DEV__ && false) {
      try {
        connectFunctionsEmulator(functions, "localhost", 5001);
        console.log("🔧 Functions 에뮬레이터 연결됨");
      } catch (error) {
        console.warn("⚠️ Functions 에뮬레이터 연결 실패:", error);
      }
    }
  }

  async getUserRecommendations(
    userId: string,
    forceRefresh: boolean = false
  ): Promise<string[]> {
    try {
      console.log(`🎯 사용자 추천 조회: ${userId} (새로고침: ${forceRefresh})`);

      // userId 유효성 검사
      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        console.error("❌ 유효하지 않은 userId:", userId);
        return [];
      }

      if (!forceRefresh) {
        const cachedRecommendations = await this.getCachedRecommendations(
          userId
        );
        if (cachedRecommendations.length > 0) {
          console.log(
            "✅ 캐시된 추천 사용:",
            cachedRecommendations.length,
            "곡"
          );
          return cachedRecommendations;
        }
      }

      try {
        console.log("🔍 Firebase Functions 호출 중...", { userId: userId });
        const result = await this.getUserRecommendationsFunction({ userId });
        const response = result.data as RecommendationServiceResponse;

        console.log("📡 Functions 응답:", response);

        if (response.success && response.data?.songs?.length > 0) {
          const recommendations = response.data.songs;
          console.log(
            "✅ 서버에서 추천 조회 성공:",
            recommendations.length,
            "곡"
          );

          await this.cacheRecommendations(userId, recommendations);
          return recommendations;
        } else {
          console.log("📭 서버에 추천 데이터 없음, 더미 추천 사용");
          const dummyRecommendations = this.generateDummyRecommendations();
          if (dummyRecommendations.length > 0) {
            await this.cacheRecommendations(userId, dummyRecommendations);
            return dummyRecommendations;
          }
          return [];
        }
      } catch (functionsError: any) {
        console.error("❌ Functions 호출 실패:", functionsError);
        console.error("❌ Functions 에러 상세:", {
          code: functionsError.code,
          message: functionsError.message,
          details: functionsError.details,
        });

        // Functions 에러 시 더미 추천으로 폴백
        console.log("🔄 Functions 에러 시 더미 추천 제공...");
        const dummyRecommendations = this.generateDummyRecommendations();
        if (dummyRecommendations.length > 0) {
          console.log(
            "✅ 더미 추천 생성 성공 (폴백):",
            dummyRecommendations.length,
            "곡"
          );
          await this.cacheRecommendations(userId, dummyRecommendations);
          return dummyRecommendations;
        }

        return [];
      }
    } catch (error: any) {
      console.error("❌ 추천 조회 실패:", error);

      const cachedRecommendations = await this.getCachedRecommendations(userId);
      if (cachedRecommendations.length > 0) {
        console.log(
          "🔄 에러 시 캐시 데이터 사용:",
          cachedRecommendations.length,
          "곡"
        );
        return cachedRecommendations;
      }

      return [];
    }
  }
\
  private generateDummyRecommendations(): string[] {
    const availableVideoIds = [
      "oZpYEEcvu5I",
      "mX9IJ7Urn28",
      "goCvO7uJhu8",
      "4Bqaflz8XZU",
      "F8p-5hGLe7s",
      "QjZKNhEMeM4",
      "K3XcXH8_ZlY",
    ];

    const shuffled = [...availableVideoIds].sort(() => Math.random() - 0.5);
    const selectedCount = Math.min(
      5 + Math.floor(Math.random() * 3),
      shuffled.length
    );

    console.log("🧪 더미 추천 생성:", selectedCount, "곡");
    return shuffled.slice(0, selectedCount);
  }

  async generateUserRecommendations(userId: string): Promise<boolean> {
    try {
      console.log(`🎯 새로운 추천 생성 요청: ${userId}`);

      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        console.error("❌ 유효하지 않은 userId:", userId);
        return false;
      }

      console.log("🔍 Firebase Functions 추천 생성 호출 중...", {
        userId: userId,
      });
      const result = await this.generateUserRecommendationsFunction({ userId });
      const response = result.data as RecommendationServiceResponse;

      console.log("📡 추천 생성 응답:", response);

      if (response.success) {
        console.log("✅ 추천 생성 성공");

        if (response.data?.songs) {
          await this.cacheRecommendations(userId, response.data.songs);
        }

        return true;
      } else {
        console.error("❌ 추천 생성 실패:", response.message);
        return false;
      }
    } catch (error: any) {
      console.error("❌ 추천 생성 요청 실패:", error);
      console.error("❌ 에러 상세:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return false;
    }
  }

  private async cacheRecommendations(
    userId: string,
    recommendations: string[]
  ): Promise<void> {
    try {
      const cacheKey = `${RECOMMENDATIONS_CACHE_KEY}_${userId}`;
      const expiryKey = `${RECOMMENDATIONS_CACHE_EXPIRY_KEY}_${userId}`;
      const expiry = Date.now() + CACHE_DURATION;

      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(recommendations)),
        AsyncStorage.setItem(expiryKey, expiry.toString()),
      ]);

      console.log(
        "💾 추천 데이터 캐시 저장 완료:",
        recommendations.length,
        "곡"
      );
    } catch (error) {
      console.warn("⚠️ 추천 캐시 저장 실패:", error);
    }
  }

  private async getCachedRecommendations(userId: string): Promise<string[]> {
    try {
      const cacheKey = `${RECOMMENDATIONS_CACHE_KEY}_${userId}`;
      const expiryKey = `${RECOMMENDATIONS_CACHE_EXPIRY_KEY}_${userId}`;

      const [cachedData, expiryData] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(expiryKey),
      ]);

      if (expiryData) {
        const expiry = parseInt(expiryData, 10);
        if (Date.now() > expiry) {
          console.log("⏰ 추천 캐시 만료됨");
          await this.clearRecommendationsCache(userId);
          return [];
        }
      }

      if (cachedData) {
        const recommendations = JSON.parse(cachedData);
        if (Array.isArray(recommendations) && recommendations.length > 0) {
          return recommendations;
        }
      }

      return [];
    } catch (error) {
      console.warn("⚠️ 추천 캐시 조회 실패:", error);
      return [];
    }
  }

  async clearRecommendationsCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${RECOMMENDATIONS_CACHE_KEY}_${userId}`;
      const expiryKey = `${RECOMMENDATIONS_CACHE_EXPIRY_KEY}_${userId}`;

      await Promise.all([
        AsyncStorage.removeItem(cacheKey),
        AsyncStorage.removeItem(expiryKey),
      ]);

      console.log("🗑️ 추천 캐시 삭제 완료");
    } catch (error) {
      console.warn("⚠️ 추천 캐시 삭제 실패:", error);
    }
  }

  async refreshRecommendations(userId: string): Promise<string[]> {
    console.log("🔄 추천 데이터 강제 새로고침");
    await this.clearRecommendationsCache(userId);
    return await this.getUserRecommendations(userId, true);
  }
}

const recommendationService = new RecommendationService();

export const getUserRecommendations = (
  userId: string,
  forceRefresh?: boolean
) => recommendationService.getUserRecommendations(userId, forceRefresh);

export const generateUserRecommendations = (userId: string) =>
  recommendationService.generateUserRecommendations(userId);

export const refreshRecommendations = (userId: string) =>
  recommendationService.refreshRecommendations(userId);

export const clearRecommendationsCache = (userId: string) =>
  recommendationService.clearRecommendationsCache(userId);

export const sortSongsByRecommendations = (
  songs: Song[],
  recommendationOrder: string[]
): Song[] => {
  if (
    !Array.isArray(songs) ||
    !Array.isArray(recommendationOrder) ||
    recommendationOrder.length === 0
  ) {
    return songs;
  }

  console.log("🔀 곡 목록을 추천 순서 + 랜덤 셔플로 정렬 중...");

  // 추천 순서에 따라 우선순위 맵 생성
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

  console.log(`🔀 비추천 곡 ${otherSongs.length}개 랜덤 셔플 중...`);
  for (let i = otherSongs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
  }

  const sortedSongs = [...recommendedSongs, ...otherSongs];

  console.log("✅ 추천 순서 정렬 완료 (랜덤 셔플 포함):", {
    totalSongs: songs.length,
    recommendedCount: recommendedSongs.length,
    otherCount: otherSongs.length,
  });

  return sortedSongs;
};

export const getRecommendationStats = async (userId: string) => {
  try {
    const recommendations = await getUserRecommendations(userId);
    return {
      userId,
      recommendationCount: recommendations.length,
      hasRecommendations: recommendations.length > 0,
      sampleRecommendations: recommendations.slice(0, 5),
    };
  } catch (error) {
    return {
      userId,
      error: error.message,
      recommendationCount: 0,
      hasRecommendations: false,
    };
  }
};

export default recommendationService;
