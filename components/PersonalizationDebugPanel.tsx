// components/PersonalizationDebugPanel.tsx
// 수정된 버전 - getAllRatings 에러 해결

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../lib/contexts/AuthContext';
import { useRatings } from '../lib/contexts/RatingsContext';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/config/firebase';

const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

interface DiagnosisResult {
  step: string;
  status: 'success' | 'error' | 'info';
  message: string;
  data?: any;
}

export const PersonalizationDebugPanel: React.FC = () => {
  const { user } = useAuth();
  const { getRating } = useRatings(); // getAllRatings 제거
  const [results, setResults] = useState<DiagnosisResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (step: string, status: 'success' | 'error' | 'info', message: string, data?: any) => {
    const result: DiagnosisResult = { step, status, message, data };
    console.log(`🔍 ${step}: ${message}`, data);
    setResults(prev => [...prev, result]);
  };

  const runFullDiagnosis = async () => {
    if (!user?.uid) {
      Alert.alert('오류', '로그인이 필요합니다');
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      addResult('초기화', 'info', `진단 시작 - 사용자 ID: ${user.uid}`, { userId: user.uid });

      // === 1단계: 클라이언트 별점 데이터 확인 (수정됨) ===
      addResult('1단계', 'info', 'RatingsContext에서 별점 데이터 확인 중...');
      
      // 🔧 getAllRatings 대신 알려진 videoId들로 테스트
      const testVideoIds = [
        'oZpYEEcvu5I', 'mX9IJ7Urn28', 'goCvO7uJhu8', 
        '4Bqaflz8XZU', 'F8p-5hGLe7s', 'QjZKNhEMeM4'
      ];
      
      const localRatings: { [key: string]: number } = {};
      let ratingCount = 0;
      
      for (const videoId of testVideoIds) {
        try {
          const rating = getRating(videoId);
          if (rating > 0) {
            localRatings[videoId] = rating;
            ratingCount++;
          }
        } catch (error) {
          // 개별 별점 조회 실패는 무시
        }
      }
      
      if (ratingCount > 0) {
        addResult('1단계', 'success', `로컬 별점 데이터 발견: ${ratingCount}개`, localRatings);
        
        // 샘플 별점 표시
        Object.entries(localRatings).forEach(([videoId, rating]) => {
          addResult('1단계', 'info', `샘플 별점: ${videoId} = ${rating}점`);
        });
      } else {
        addResult('1단계', 'error', '로컬 별점 데이터가 없습니다 - 먼저 곡에 별점을 매겨보세요');
      }

      // === 2단계: Firestore 직접 확인 ===
      addResult('2단계', 'info', 'Firestore에서 별점 데이터 직접 확인 중...');
      
      const possiblePaths = [
        `users/${user.uid}/ratings`,
        `ratings/${user.uid}`,
        `userRatings/${user.uid}`,
        `user_ratings/${user.uid}`
      ];

      let foundData = false;
      let successPath = '';
      let firestoreRatings: any[] = [];

      for (const path of possiblePaths) {
        try {
          addResult('2단계', 'info', `Firestore 경로 확인: ${path}`);
          
          const collectionRef = collection(db, path);
          const snapshot = await getDocs(collectionRef);
          
          if (!snapshot.empty) {
            foundData = true;
            successPath = path;
            firestoreRatings = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            addResult('2단계', 'success', 
              `Firestore 데이터 발견! 경로: ${path}, 문서 수: ${snapshot.size}`, 
              firestoreRatings.slice(0, 3)
            );
            break;
          } else {
            addResult('2단계', 'info', `경로 ${path}에서 데이터 없음`);
          }
        } catch (error: any) {
          addResult('2단계', 'error', `경로 ${path} 접근 실패: ${error.message}`);
        }
      }

      if (!foundData) {
        addResult('2단계', 'error', '모든 가능한 Firestore 경로에서 데이터를 찾지 못했습니다');
        
        // 특정 문서 직접 확인
        if (ratingCount > 0) {
          const sampleVideoId = Object.keys(localRatings)[0];
          addResult('2단계', 'info', `특정 문서 직접 확인: ${sampleVideoId}`);
          
          const directPaths = [
            `users/${user.uid}/ratings/${sampleVideoId}`,
            `ratings/${user.uid}/${sampleVideoId}`,
            `userRatings/${user.uid}/${sampleVideoId}`
          ];
          
          for (const docPath of directPaths) {
            try {
              const docRef = doc(db, docPath);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                addResult('2단계', 'success', `직접 문서 발견: ${docPath}`, docSnap.data());
                foundData = true;
                successPath = docPath.substring(0, docPath.lastIndexOf('/'));
                break;
              }
            } catch (error: any) {
              addResult('2단계', 'error', `직접 문서 확인 실패 ${docPath}: ${error.message}`);
            }
          }
        }
      }

      // === 3단계: Firebase Functions 호출 테스트 ===
      addResult('3단계', 'info', 'Firebase Functions 호출 테스트 중...');
      
      try {
        const generateRecommendations = httpsCallable(functions, 'generatePersonalizedRecommendations');
        
        addResult('3단계', 'info', 'Functions 호출 시작...');
        const result = await generateRecommendations({ userId: user.uid });
        
        addResult('3단계', 'info', 'Functions 응답 받음', result.data);
        
        const responseData = result.data as any;
        
        if (responseData.isDefault === false && responseData.userRatingCount > 0) {
          addResult('3단계', 'success', '🎉 개인화 추천 성공!', responseData);
        } else {
          addResult('3단계', 'error', 
            `Functions가 기본 추천만 반환: isDefault=${responseData.isDefault}, userRatingCount=${responseData.userRatingCount}`,
            responseData
          );
        }
        
        // 디버그 정보가 있다면 표시
        if (responseData.debug) {
          addResult('3단계', 'info', 'Functions 디버그 정보', responseData.debug);
        }
        
      } catch (error: any) {
        addResult('3단계', 'error', `Functions 호출 실패: ${error.message}`, { error: error.toString() });
      }

      // === 4단계: 권한 및 규칙 확인 ===
      addResult('4단계', 'info', 'Firebase 권한 및 보안 규칙 테스트 중...');
      
      try {
        // 간단한 읽기 테스트
        const testPath = `users/${user.uid}`;
        const testRef = doc(db, testPath);
        await getDoc(testRef);
        
        addResult('4단계', 'success', '기본 사용자 경로 읽기 권한 확인됨');
      } catch (error: any) {
        addResult('4단계', 'error', `권한 테스트 실패: ${error.message}`);
      }

      // === 5단계: 종합 진단 ===
      addResult('5단계', 'info', '종합 진단 중...');
      
      if (ratingCount > 0 && foundData) {
        addResult('5단계', 'success', '클라이언트와 Firestore 데이터 모두 정상');
        addResult('5단계', 'info', `성공 경로: ${successPath}`);
        addResult('5단계', 'info', '문제: Functions가 올바른 경로에서 데이터를 읽지 못하고 있을 수 있음');
      } else if (ratingCount > 0 && !foundData) {
        addResult('5단계', 'error', '클라이언트에는 별점이 있지만 Firestore에 없음 - 동기화 문제');
      } else if (ratingCount === 0) {
        addResult('5단계', 'info', '별점 데이터가 없음 - 먼저 곡에 별점을 매겨보세요');
      }

    } catch (error: any) {
      addResult('오류', 'error', `진단 중 예외 발생: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const testQuickRating = async () => {
    if (!user?.uid) return;

    try {
      addResult('테스트', 'info', '별점 함수 테스트 중...');
      
      // 몇 개 videoId로 별점 테스트
      const testVideoIds = ['oZpYEEcvu5I', 'mX9IJ7Urn28'];
      
      for (const videoId of testVideoIds) {
        try {
          const rating = getRating(videoId);
          addResult('테스트', 'info', `${videoId} 별점: ${rating}점`);
        } catch (error: any) {
          addResult('테스트', 'error', `${videoId} 별점 조회 실패: ${error.message}`);
        }
      }
      
    } catch (error: any) {
      addResult('테스트', 'error', `별점 테스트 실패: ${error.message}`);
    }
  };

  const getStatusColor = (status: 'success' | 'error' | 'info') => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'info': return '#2196F3';
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'info') => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
    }
  };

  return (
    <View style={{ 
      backgroundColor: '#f8f9fa', 
      margin: 10, 
      padding: 15, 
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#e9ecef'
    }}>
      <Text style={{ 
        fontSize: 16, 
        fontWeight: 'bold', 
        marginBottom: 15,
        textAlign: 'center'
      }}>
        🔍 개인화 추천 문제 진단
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: isRunning ? '#ccc' : '#007AFF',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center'
          }}
          onPress={runFullDiagnosis}
          disabled={isRunning}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
            {isRunning ? '진단 중...' : '🚀 전체 진단 실행'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: '#28a745',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center'
          }}
          onPress={testQuickRating}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
            🧪 별점 함수 테스트
          </Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 && (
        <ScrollView style={{ maxHeight: 400 }}>
          {results.map((result, index) => (
            <View key={index} style={{
              padding: 8,
              marginBottom: 5,
              backgroundColor: 'white',
              borderRadius: 4,
              borderLeftWidth: 3,
              borderLeftColor: getStatusColor(result.status)
            }}>
              <Text style={{ 
                fontSize: 12, 
                fontWeight: 'bold',
                color: getStatusColor(result.status)
              }}>
                {getStatusIcon(result.status)} {result.step}
              </Text>
              <Text style={{ fontSize: 11, marginTop: 2 }}>
                {result.message}
              </Text>
              {result.data && (
                <Text style={{ 
                  fontSize: 10, 
                  marginTop: 4, 
                  fontFamily: 'monospace',
                  backgroundColor: '#f8f9fa',
                  padding: 4
                }}>
                  {JSON.stringify(result.data, null, 2)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {results.length === 0 && (
        <Text style={{ 
          textAlign: 'center', 
          fontSize: 12, 
          color: '#666',
          fontStyle: 'italic'
        }}>
          진단을 실행하여 문제를 파악해보세요
        </Text>
      )}
    </View>
  );
};