// components/RecommendationUpdateBar.tsx

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
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (isVisible) {
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

  useEffect(() => {
    if (isVisible && countdown > 0) {
      const progressValue = countdown / 3;
      
      Animated.timing(progressAnim, {
        toValue: progressValue,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    } else if (!isVisible) {
      progressAnim.setValue(0);
    }
  }, [countdown, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 50 : 25,
          left: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
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

      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
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

        <View style={{
          flexDirection: 'row',
          gap: 8,
        }}>
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