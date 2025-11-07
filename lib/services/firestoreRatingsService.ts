// lib/services/firestoreRatingsService.ts - 완전히 수정된 버전

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  getDocs,
  serverTimestamp
  // 🔧 deleteDoc 제거 (import 에러 해결)
} from 'firebase/firestore';
import { db } from '@/lib/config/firebase';

// 타입 정의
export interface UserRating {
  videoId: string;
  rating: number | null; // 1-5점 또는 null (삭제됨)
  updatedAt: any; // Firestore Timestamp
  deleted?: boolean; // 삭제 플래그 (선택적)
}

// Firestore 별점 서비스 클래스
export class FirestoreRatingsService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // 🔄 개별 별점 업로드 (자동 업로드에 필요)
  async uploadRating(videoId: string, rating: number): Promise<void> {
    try {
      console.log(`⭐ Firestore 별점 업로드: ${videoId} = ${rating}점`);
      
      const ratingDoc = doc(db, 'users', this.userId, 'ratings', videoId);
      
      await setDoc(ratingDoc, {
        videoId,
        rating,
        deleted: false, // 삭제되지 않음을 명시
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ 별점 업로드 완료: ${videoId}`);
    } catch (error) {
      console.error(`❌ 별점 업로드 실패 (${videoId}):`, error);
      throw error;
    }
  }

  // 📥 사용자 모든 별점 다운로드 (삭제된 항목 제외)
  async downloadAllRatings(): Promise<Record<string, number>> {
    try {
      console.log('📥 Firestore에서 별점 다운로드...');
      
      const ratingsQuery = query(
        collection(db, 'users', this.userId, 'ratings')
      );
      
      const snapshot = await getDocs(ratingsQuery);
      const ratings: Record<string, number> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data() as UserRating;
        
        // 🔧 수정: 삭제되지 않았고, rating이 null이 아니며, 0보다 큰 경우만 포함
        if (!data.deleted && data.rating !== null && data.rating && data.rating > 0) {
          ratings[data.videoId] = data.rating;
        }
      });
      
      console.log('✅ 별점 다운로드 완료:', Object.keys(ratings).length, '개');
      return ratings;
    } catch (error) {
      console.error('❌ 별점 다운로드 실패:', error);
      throw error;
    }
  }

  // 🔍 특정 곡의 별점 가져오기
  async getRating(videoId: string): Promise<number> {
    try {
      const ratingDoc = doc(db, 'users', this.userId, 'ratings', videoId);
      const docSnap = await getDoc(ratingDoc);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UserRating;
        
        // 🔧 수정: 삭제되지 않았고 유효한 별점인 경우만 반환
        if (!data.deleted && data.rating !== null && data.rating && data.rating > 0) {
          return data.rating;
        }
      }
      
      return 0;
    } catch (error) {
      console.error(`❌ 별점 조회 실패 (${videoId}):`, error);
      return 0;
    }
  }

  // 🗑️ 별점 삭제 (deleteDoc 대신 삭제 플래그 설정)
  async removeRating(videoId: string): Promise<void> {
    try {
      console.log(`🗑️ Firestore 별점 제거: ${videoId}`);
      
      const ratingDoc = doc(db, 'users', this.userId, 'ratings', videoId);
      
      // 🔧 수정: deleteDoc 대신 삭제 플래그 설정
      await setDoc(ratingDoc, {
        videoId,
        rating: null, // rating을 null로 설정
        deleted: true, // 삭제 플래그 설정
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ 별점 제거 완료: ${videoId}`);
    } catch (error) {
      console.error(`❌ 별점 제거 실패 (${videoId}):`, error);
      throw error;
    }
  }

  // 🧹 완전히 삭제된 별점 데이터 정리 (선택적 - 나중에 사용)
  async cleanupDeletedRatings(): Promise<number> {
    try {
      console.log('🧹 삭제된 별점 데이터 정리 시작...');
      
      const ratingsQuery = query(
        collection(db, 'users', this.userId, 'ratings')
      );
      
      const snapshot = await getDocs(ratingsQuery);
      let cleanedCount = 0;
      
      const cleanupPromises: Promise<void>[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserRating;
        
        // 삭제 플래그가 있거나 rating이 null인 경우
        if (data.deleted || data.rating === null) {
          const deletePromise = setDoc(doc(db, 'users', this.userId, 'ratings', docSnapshot.id), {
            videoId: data.videoId,
            rating: null,
            deleted: true,
            cleanedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          cleanupPromises.push(deletePromise);
          cleanedCount++;
        }
      });
      
      await Promise.all(cleanupPromises);
      
      console.log(`✅ 별점 데이터 정리 완료: ${cleanedCount}개 정리됨`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ 별점 데이터 정리 실패:', error);
      throw error;
    }
  }

  // 📊 별점 통계 조회 (디버깅용)
  async getRatingStats(): Promise<{
    totalDocs: number;
    activeDocs: number;
    deletedDocs: number;
    nullRatings: number;
  }> {
    try {
      const ratingsQuery = query(
        collection(db, 'users', this.userId, 'ratings')
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
        nullRatings
      };
      
      console.log('📊 별점 통계:', stats);
      return stats;
    } catch (error) {
      console.error('❌ 별점 통계 조회 실패:', error);
      throw error;
    }
  }
}

// 🛠️ 헬퍼 함수들
export const createRatingsService = (userId: string): FirestoreRatingsService => {
  return new FirestoreRatingsService(userId);
};

// 🧪 개발자용 유틸리티 함수
export const debugRatings = async (userId: string) => {
  const service = createRatingsService(userId);
  
  console.log('🧪 별점 디버깅 시작...');
  
  try {
    const stats = await service.getRatingStats();
    const ratings = await service.downloadAllRatings();
    
    console.log('📊 통계:', stats);
    console.log('⭐ 활성 별점:', ratings);
    
    return {
      stats,
      ratings
    };
  } catch (error) {
    console.error('❌ 별점 디버깅 실패:', error);
    return null;
  }
};