// components/TestButtons.tsx

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/config/firebase';
import { useAuth } from '@/lib/contexts/AuthContext';

// 타입 정의
interface GlobalStatsResult {
  success: boolean;
  message: string;
  stats?: {
    totalUsers: number;
    totalRatings: number;
    totalSongs: number;
    popularSongs: any[];
    lastUpdated: string;
    processingTime: number;
  };
}

interface UserRecommendationResult {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    songs: string[];
    userRatingCount: number;
    scores?: Record<string, number>;
    categories?: Record<string, any>;
    generatedAt: string;
    processingTime: number;
  };
}

interface UserRatingsResult {
  success: boolean;
  userId: string;
  ratingsCount: number;
  ratings: Record<string, any>;
}

export const TestButtons = () => {
  const { user } = useAuth();

  const testGlobalStats = async () => {
    try {
      console.log('🔄 글로벌 통계 계산 시작...');
      
      const calculateGlobalStatsFunction = httpsCallable(functions, 'calculateGlobalStats');
      
      // 🔧 현재 사용자 ID를 debugUserId로 전달
      const result = await calculateGlobalStatsFunction({ 
        debugUserId: user?.uid 
      });
      
      // 🔧 타입 단언 추가
      const data = result.data as GlobalStatsResult;
      
      console.log('✅ 글로벌 통계 계산 완료:', data);
      Alert.alert(
        '성공!', 
        `${data.message}\n총 사용자: ${data.stats?.totalUsers || 0}\n총 별점: ${data.stats?.totalRatings || 0}`
      );
    } catch (error: any) {
      console.error('❌ 글로벌 통계 계산 실패:', error);
      Alert.alert('실패', `${error.message || '알 수 없는 오류'}`);
    }
  };

  // 🔧 사용자 별점 확인 함수 추가 (디버깅용)
  const testUserRatings = async () => {
    if (!user?.uid) {
      Alert.alert('오류', '사용자 로그인이 필요합니다');
      return;
    }

    try {
      console.log('📊 사용자 별점 조회 시작...');
      
      const getUserRatingsFunction = httpsCallable(functions, 'getUserRatings');
      const result = await getUserRatingsFunction({ userId: user.uid });
      const data = result.data as UserRatingsResult;
      
      console.log('📊 사용자 별점 확인:', data);
      Alert.alert(
        '별점 정보', 
        `사용자: ${data.userId.substring(0, 8)}...\n별점 개수: ${data.ratingsCount}\n성공: ${data.success}`
      );
    } catch (error: any) {
      console.error('❌ 사용자 별점 조회 실패:', error);
      Alert.alert('실패', `${error.message || '알 수 없는 오류'}`);
    }
  };

  const testUserRecommendations = async () => {
    if (!user?.uid) {
      Alert.alert('오류', '사용자 로그인이 필요합니다');
      return;
    }

    try {
      console.log('🎯 개인 추천 생성 시작...');
      
      const generateUserRecommendationsFunction = httpsCallable(functions, 'generateUserRecommendations');
      const result = await generateUserRecommendationsFunction({ userId: user.uid });
      const data = result.data as UserRecommendationResult;
      
      console.log('✅ 개인 추천 생성 완료:', data);
      Alert.alert(
        '성공!', 
        `${data.message || '완료'}\n추천곡 수: ${data.data?.songs?.length || 0}\n별점 수: ${data.data?.userRatingCount || 0}`
      );
    } catch (error: any) {
      console.error('❌ 개인 추천 생성 실패:', error);
      Alert.alert('실패', `${error.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Functions 테스트</Text>
      <Text style={styles.userId}>사용자: {user?.uid?.substring(0, 8)}...</Text>
      
      {/* 🔧 사용자 별점 확인 버튼 추가 */}
      <TouchableOpacity style={[styles.button, styles.orangeButton]} onPress={testUserRatings}>
        <Text style={styles.buttonText}>📊 사용자 별점 확인</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.greenButton]} onPress={testGlobalStats}>
        <Text style={styles.buttonText}>🔄 글로벌 통계 계산</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.blueButton]} onPress={testUserRecommendations}>
        <Text style={styles.buttonText}>🎯 개인 추천 생성</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#f0f0f0',
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  userId: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginBottom: 12,
  },
  button: {
    padding: 12,
    borderRadius: 6,
    marginVertical: 4,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  orangeButton: {
    backgroundColor: '#FF9800',
  },
  greenButton: {
    backgroundColor: '#4CAF50',
  },
  blueButton: {
    backgroundColor: '#2196F3',
  },
});