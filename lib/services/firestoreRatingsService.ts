// lib/services/firestoreRatingsService.ts

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/config/firebase";

export interface UserRating {
  videoId: string;
  rating: number | null;
  updatedAt: any;
  deleted?: boolean;
  artist?: string;
}

export class FirestoreRatingsService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async uploadRating(
    videoId: string,
    rating: number,
    artist: string
  ): Promise<void> {
    try {
      console.log(
        `⭐ Firestore 별점 업로드: ${videoId} (${artist}) = ${rating}점`
      );
      const ratingDoc = doc(db, "users", this.userId, "ratings", videoId);

      await setDoc(
        ratingDoc,
        {
          videoId,
          rating,
          artist,
          deleted: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`✅ 별점 업로드 완료: ${videoId}`);
    } catch (error) {
      console.error(`❌ 별점 업로드 실패 (${videoId}):`, error);
      throw error;
    }
  }

  async downloadAllRatings(): Promise<Record<string, number>> {
    try {
      console.log("📥 Firestore에서 별점 다운로드...");

      const ratingsQuery = query(
        collection(db, "users", this.userId, "ratings")
      );

      const snapshot = await getDocs(ratingsQuery);
      const ratings: Record<string, number> = {};

      snapshot.forEach((doc) => {
        const data = doc.data() as UserRating;

        if (
          !data.deleted &&
          data.rating !== null &&
          data.rating &&
          data.rating > 0
        ) {
          ratings[data.videoId] = data.rating;
        }
      });

      console.log("✅ 별점 다운로드 완료:", Object.keys(ratings).length, "개");
      return ratings;
    } catch (error) {
      console.error("❌ 별점 다운로드 실패:", error);
      throw error;
    }
  }

  async getRating(videoId: string): Promise<number> {
    try {
      const ratingDoc = doc(db, "users", this.userId, "ratings", videoId);
      const docSnap = await getDoc(ratingDoc);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserRating;

        if (
          !data.deleted &&
          data.rating !== null &&
          data.rating &&
          data.rating > 0
        ) {
          return data.rating;
        }
      }

      return 0;
    } catch (error) {
      console.error(`❌ 별점 조회 실패 (${videoId}):`, error);
      return 0;
    }
  }

  async removeRating(videoId: string): Promise<void> {
    try {
      console.log(`🗑️ Firestore 별점 제거: ${videoId}`);

      const ratingDoc = doc(db, "users", this.userId, "ratings", videoId);

      await setDoc(
        ratingDoc,
        {
          videoId,
          rating: null,
          deleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`✅ 별점 제거 완료: ${videoId}`);
    } catch (error) {
      console.error(`❌ 별점 제거 실패 (${videoId}):`, error);
      throw error;
    }
  }

  async cleanupDeletedRatings(): Promise<number> {
    try {
      console.log("🧹 삭제된 별점 데이터 정리 시작...");

      const ratingsQuery = query(
        collection(db, "users", this.userId, "ratings")
      );

      const snapshot = await getDocs(ratingsQuery);
      let cleanedCount = 0;

      const cleanupPromises: Promise<void>[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserRating;

        if (data.deleted || data.rating === null) {
          const deletePromise = setDoc(
            doc(db, "users", this.userId, "ratings", docSnapshot.id),
            {
              videoId: data.videoId,
              rating: null,
              deleted: true,
              cleanedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          cleanupPromises.push(deletePromise);
          cleanedCount++;
        }
      });

      await Promise.all(cleanupPromises);

      console.log(`✅ 별점 데이터 정리 완료: ${cleanedCount}개 정리됨`);
      return cleanedCount;
    } catch (error) {
      console.error("❌ 별점 데이터 정리 실패:", error);
      throw error;
    }
  }

  async getRatingStats(): Promise<{
    totalDocs: number;
    activeDocs: number;
    deletedDocs: number;
    nullRatings: number;
  }> {
    try {
      const ratingsQuery = query(
        collection(db, "users", this.userId, "ratings")
      );

      const snapshot = await getDocs(ratingsQuery);

      let totalDocs = 0;
      let activeDocs = 0;
      let deletedDocs = 0;
      let nullRatings = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as UserRating;
        totalDocs++;

        if (data.deleted) {
          deletedDocs++;
        } else if (data.rating === null) {
          nullRatings++;
        } else if (data.rating && data.rating > 0) {
          activeDocs++;
        }
      });

      const stats = {
        totalDocs,
        activeDocs,
        deletedDocs,
        nullRatings,
      };

      console.log("📊 별점 통계:", stats);
      return stats;
    } catch (error) {
      console.error("❌ 별점 통계 조회 실패:", error);
      throw error;
    }
  }
}

export const createRatingsService = (
  userId: string
): FirestoreRatingsService => {
  return new FirestoreRatingsService(userId);
};

export const debugRatings = async (userId: string) => {
  const service = createRatingsService(userId);

  console.log("🧪 별점 디버깅 시작...");

  try {
    const stats = await service.getRatingStats();
    const ratings = await service.downloadAllRatings();

    console.log("📊 통계:", stats);
    console.log("⭐ 활성 별점:", ratings);

    return {
      stats,
      ratings,
    };
  } catch (error) {
    console.error("❌ 별점 디버깅 실패:", error);
    return null;
  }
};
