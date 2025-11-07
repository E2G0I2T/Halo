// components/RecommendationUpdateBar.tsx
// 부드러운 추천 업데이트 알림 바 컴포넌트

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useAppStyles } from '@/theme/styles';
import { useTheme } from '@/theme/ThemeContext';

interface RecommendationUpdateBarProps {
  isVisible: boolean;
  isCalculating: boolean;
  countdown: number;
  hasNewOrder: boolean;
  onApply: () => void;
  onCancel: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const RecommendationUpdateBar: React.FC<RecommendationUpdateBarProps> = ({
  isVisible,
  isCalculating,
  countdown,
  hasNewOrder,
  onApply,
  onCancel,
}) => {
  const styles = useAppStyles();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  // 테마별 색상 정의
  const colors = {
    background: isDarkMode ? '#2c2c2c' : '#f8f9fa',
    border: isDarkMode ? '#404040' : '#e9ecef',
    progressBg: isDarkMode ? '#404040' : '#e9ecef',
    primaryText: isDarkMode ? '#ffffff' : '#333333',
    secondaryText: isDarkMode ? '#cccccc' : '#6c757d',
    successText: isDarkMode ? '#4caf50' : '#28a745',
    hintText: isDarkMode ? '#999999' : '#adb5bd',
    progressBar: isCalculating ? '#ffc107' : '#007bff',
  };
  
  // 애니메이션 값들
  const slideAnim = useRef(new Animated.Value(-100)).current; // 위에서 아래로 슬라이드
  const progressAnim = useRef(new Animated.Value(0)).current; // 진행 바
  const scaleAnim = useRef(new Animated.Value(0.95)).current; // 버튼 스케일

  // 슬라이드 인/아웃 애니메이션
  useEffect(() => {
    if (isVisible) {
      // 슬라이드 인
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 7,
        }),
      ]).start();
    } else {
      // 슬라이드 아웃
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // 카운트다운 진행 바 애니메이션
  useEffect(() => {
    if (isVisible && countdown > 0) {
      // 진행 바를 카운트다운에 맞춰 감소
      const progressValue = countdown / 3; // 3초 기준
      
      Animated.timing(progressAnim, {
        toValue: progressValue,
        duration: 1000, // 1초마다 업데이트
        useNativeDriver: false, // width 애니메이션은 native driver 사용 불가
      }).start();
    } else if (!isVisible) {
      // 숨길 때 진행 바 리셋
      progressAnim.setValue(0);
    }
  }, [countdown, isVisible]);

  // 렌더링하지 않을 조건
  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 50 : 25, // 상태바 높이 고려
          left: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          // 그림자 효과
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 8,
          elevation: 5,
        },
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {/* 상단 진행 바 */}
      <View style={{
        height: 3,
        backgroundColor: colors.progressBg,
      }}>
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: colors.progressBar,
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>

      {/* 메인 콘텐츠 */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        {/* 상단 메시지 */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>
            {isCalculating ? '🔄' : '💫'}
          </Text>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.primaryText,
            flex: 1,
          }}>
            {isCalculating
              ? '새로운 추천 순서를 계산하고 있어요...'
              : hasNewOrder
              ? '추천 순서를 업데이트할까요?'
              : `추천 업데이트 준비 중... ${countdown}초`
            }
          </Text>
        </View>

        {/* 카운트다운 또는 로딩 상태 */}
        {isCalculating ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <ActivityIndicator size="small" color="#007bff" style={{ marginRight: 8 }} />
            <Text style={{
              fontSize: 12,
              color: colors.secondaryText,
            }}>
              개인화된 추천을 생성하고 있습니다
            </Text>
          </View>
        ) : hasNewOrder ? (
          <Text style={{
            fontSize: 12,
            color: colors.successText,
            marginBottom: 12,
            fontWeight: '500',
          }}>
            새로운 추천 순서가 준비되었습니다!
          </Text>
        ) : (
          <Text style={{
            fontSize: 12,
            color: colors.secondaryText,
            marginBottom: 12,
          }}>
            별점을 반영한 개인화 추천을 준비하고 있어요
          </Text>
        )}

        {/* 액션 버튼들 */}
        <View style={{
          flexDirection: 'row',
          gap: 8,
        }}>
          {/* 나중에 버튼 */}
          <TouchableOpacity
            onPress={onCancel}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: 'transparent',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#dc3545',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#dc3545',
            }}>
              나중에
            </Text>
          </TouchableOpacity>

          {/* 지금 적용 버튼 */}
          <TouchableOpacity
            onPress={onApply}
            disabled={isCalculating || !hasNewOrder}
            style={{
              flex: 2,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: (isCalculating || !hasNewOrder) ? colors.border : '#007bff',
              borderRadius: 6,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            {isCalculating && (
              <ActivityIndicator 
                size="small" 
                color="#fff" 
                style={{ marginRight: 4 }} 
              />
            )}
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: (isCalculating || !hasNewOrder) ? colors.secondaryText : '#fff',
            }}>
              {isCalculating ? '계산 중...' : hasNewOrder ? '지금 적용' : '준비 중...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 힌트 텍스트 */}
        {!isCalculating && (
          <Text style={{
            fontSize: 10,
            color: colors.hintText,
            textAlign: 'center',
            marginTop: 8,
            fontStyle: 'italic',
          }}>
            {hasNewOrder 
              ? '새로운 순서로 곡 목록이 재정렬됩니다'
              : '별점을 더 많이 매기면 추천이 정확해져요'
            }
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

export default RecommendationUpdateBar;