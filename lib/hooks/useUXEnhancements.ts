// lib/hooks/useUXEnhancements.ts
// 부드러운 추천 UX를 위한 고급 기능들 - 완전 타입 안전 버전

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// 🎯 디바운싱 훅 - 연속된 별점 변경을 배치 처리
export const useDebounce = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const timeoutRef = useRef<number | undefined>(undefined); // React Native 타입
  const callbackRef = useRef(callback);

  // 콜백 참조 업데이트
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: T) => {
      // 기존 타이머 취소
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 새로운 타이머 설정
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay) as unknown as number;
    },
    [delay]
  );

  // 정리 함수
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

// 📱 앱 상태 감지 훅 - 포그라운드/백그라운드 전환
export const useAppState = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isActive, setIsActive] = useState<boolean>(AppState.currentState === 'active');
  const [backgroundTime, setBackgroundTime] = useState<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appState;
      
      console.log(`📱 앱 상태 변경: ${previousState} → ${nextAppState}`);
      
      if (previousState !== 'active' && nextAppState === 'active') {
        // 백그라운드에서 포그라운드로 복귀
        console.log('🔄 앱이 포그라운드로 복귀');
        setIsActive(true);
        
        if (backgroundTime) {
          const timeInBackground = Date.now() - backgroundTime;
          console.log(`⏰ 백그라운드 시간: ${Math.round(timeInBackground / 1000)}초`);
          
          // 5분 이상 백그라운드에 있었다면 자동 업데이트 트리거
          if (timeInBackground > 5 * 60 * 1000) {
            console.log('🔄 장시간 백그라운드 후 자동 업데이트 필요');
          }
        }
        setBackgroundTime(null);
      } else if (previousState === 'active' && nextAppState !== 'active') {
        // 포그라운드에서 백그라운드로 이동
        console.log('🌙 앱이 백그라운드로 이동');
        setIsActive(false);
        setBackgroundTime(Date.now());
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [appState, backgroundTime]);

  return {
    appState,
    isActive,
    backgroundTime,
    timeInBackground: backgroundTime ? Date.now() - backgroundTime : 0
  };
};

// 🔄 배치 처리 훅 - 여러 작업을 모아서 한 번에 실행
export const useBatchProcessor = <T>(
  processor: (items: T[]) => Promise<void>,
  batchSize: number = 5,
  delay: number = 1000
) => {
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<number | undefined>(undefined); // React Native 타입
  const processingRef = useRef<boolean>(false);

  const processBatch = useCallback(async () => {
    if (processingRef.current || batchRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    const items = [...batchRef.current];
    batchRef.current = [];

    try {
      console.log(`📦 배치 처리 시작: ${items.length}개 항목`);
      await processor(items);
      console.log(`✅ 배치 처리 완료: ${items.length}개 항목`);
    } catch (error) {
      console.error('❌ 배치 처리 실패:', error);
      // 실패한 항목들을 다시 큐에 추가 (재시도)
      batchRef.current.unshift(...items);
    } finally {
      processingRef.current = false;
    }
  }, [processor]);

  const addItem = useCallback((item: T) => {
    batchRef.current.push(item);

    // 배치 크기에 도달하면 즉시 처리
    if (batchRef.current.length >= batchSize) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      processBatch();
      return;
    }

    // 그렇지 않으면 지연 후 처리
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      processBatch();
    }, delay) as unknown as number;
  }, [batchSize, delay, processBatch]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    processBatch();
  }, [processBatch]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    addItem,
    flush,
    pending: batchRef.current.length,
    isProcessing: processingRef.current
  };
};

// 🎭 부드러운 애니메이션을 위한 상태 관리 훅
export const useSmoothTransition = (initialValue: any, duration: number = 300) => {
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const timeoutRef = useRef<number | undefined>(undefined); // React Native 타입

  const updateValue = useCallback((newValue: any) => {
    if (currentValue === newValue) return;

    setIsTransitioning(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCurrentValue(newValue);
      setIsTransitioning(false);
    }, duration) as unknown as number;
  }, [currentValue, duration]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    value: currentValue,
    updateValue,
    isTransitioning
  };
};

// 📊 성능 모니터링 훅
export const usePerformanceMonitor = (name: string) => {
  const startTimeRef = useRef<number>(Date.now());
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
  });

  useEffect(() => {
    const renderTime = Date.now() - startTimeRef.current;
    
    setMetrics(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newAverageTime = (prev.averageRenderTime * prev.renderCount + renderTime) / newRenderCount;
      
      return {
        renderCount: newRenderCount,
        averageRenderTime: newAverageTime,
        lastRenderTime: renderTime
      };
    });

    if (__DEV__ && renderTime > 100) {
      console.warn(`⚠️ 느린 렌더링 감지 (${name}): ${renderTime}ms`);
    }

    startTimeRef.current = Date.now();
  });

  return metrics;
};

// 🔐 안전한 상태 업데이트 훅
export const useSafeState = <T>(initialValue: T) => {
  const [state, setState] = useState<T>(initialValue);
  const mountedRef = useRef<boolean>(true);

  const safeSetState = useCallback((newState: T | ((prev: T) => T)) => {
    if (mountedRef.current) {
      setState(newState);
    } else {
      console.warn('🚫 언마운트된 컴포넌트에서 상태 업데이트 시도');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return [state, safeSetState] as const;
};

// 🎨 접근성 개선 유틸리티
export const useAccessibility = () => {
  const announceForScreenReader = useCallback((message: string) => {
    // React Native의 접근성 API를 사용한 스크린 리더 알림
    console.log(`📢 접근성 알림: ${message}`);
    // 실제 구현에서는 AccessibilityInfo.announceForAccessibility(message) 사용
  }, []);

  const getAccessibilityProps = useCallback((
    label: string,
    role?: string,
    hint?: string
  ) => {
    return {
      accessible: true,
      accessibilityLabel: label,
      accessibilityRole: role as any,
      accessibilityHint: hint,
    };
  }, []);

  return {
    announceForScreenReader,
    getAccessibilityProps
  };
};

// 📱 배터리 절약 모드
export const useBatterySaver = () => {
  const [isLowPowerMode, setIsLowPowerMode] = useState<boolean>(false);
  const [backgroundTime, setBackgroundTime] = useState<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        setBackgroundTime(Date.now());
      } else if (nextAppState === 'active' && backgroundTime) {
        const timeInBackground = Date.now() - backgroundTime;
        
        // 30분 이상 백그라운드에 있었다면 절약 모드 활성화
        if (timeInBackground > 30 * 60 * 1000) {
          setIsLowPowerMode(true);
          console.log('🔋 배터리 절약 모드 활성화');
          
          // 5분 후 자동 해제
          setTimeout(() => {
            setIsLowPowerMode(false);
            console.log('🔋 배터리 절약 모드 해제');
          }, 5 * 60 * 1000);
        }
        
        setBackgroundTime(null);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [backgroundTime]);

  return {
    isLowPowerMode,
    enableSaver: () => setIsLowPowerMode(true),
    disableSaver: () => setIsLowPowerMode(false)
  };
};

// ⚡ 성능 기반 품질 조정
export const useAdaptiveQuality = () => {
  const [performanceLevel, setPerformanceLevel] = useState<'high' | 'medium' | 'low'>('high');
  const frameDropCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const monitorFrameRate = () => {
      const now = Date.now();
      const frameTime = now - lastFrameTimeRef.current;
      
      // 16.67ms (60fps) 보다 느리면 프레임 드롭
      if (frameTime > 20) {
        frameDropCountRef.current += 1;
        
        // 연속 10회 프레임 드롭 시 품질 하향
        if (frameDropCountRef.current >= 10) {
          setPerformanceLevel(prev => {
            if (prev === 'high') return 'medium';
            if (prev === 'medium') return 'low';
            return 'low';
          });
          frameDropCountRef.current = 0;
          console.log('📉 성능 품질 하향 조정');
        }
      } else {
        frameDropCountRef.current = Math.max(0, frameDropCountRef.current - 1);
      }
      
      lastFrameTimeRef.current = now;
      requestAnimationFrame(monitorFrameRate);
    };

    if (__DEV__) {
      requestAnimationFrame(monitorFrameRate);
    }
  }, []);

  return {
    performanceLevel,
    config: {
      enableAnimations: performanceLevel !== 'low',
      animationDuration: performanceLevel === 'high' ? 300 : performanceLevel === 'medium' ? 200 : 100,
      enableHaptics: performanceLevel === 'high',
      cacheSize: performanceLevel === 'high' ? 100 : performanceLevel === 'medium' ? 50 : 20,
    }
  };
};

// 🌐 네트워크 상태 감지 (추가 개선용)
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  // React Native의 NetInfo 라이브러리 사용 시 구현
  // 현재는 기본값만 제공
  
  return {
    isConnected,
    connectionType,
    isSlowConnection: connectionType === '2g' || connectionType === 'slow-2g'
  };
};

// 📊 성능 메트릭 수집
export const usePerformanceMetrics = () => {
  const metricsRef = useRef({
    appLaunchTime: Date.now(),
    recommendationCalculations: 0,
    averageCalculationTime: 0,
    cacheHitRate: 0,
    userInteractions: 0,
    errorCount: 0,
  });

  const recordMetric = useCallback((type: string, value?: number, metadata?: any) => {
    const metrics = metricsRef.current;
    
    switch (type) {
      case 'recommendation_calculation':
        metrics.recommendationCalculations += 1;
        if (value) {
          metrics.averageCalculationTime = 
            (metrics.averageCalculationTime * (metrics.recommendationCalculations - 1) + value) /
            metrics.recommendationCalculations;
        }
        break;
        
      case 'cache_hit':
        // 캐시 히트율 계산 로직
        break;
        
      case 'user_interaction':
        metrics.userInteractions += 1;
        break;
        
      case 'error':
        metrics.errorCount += 1;
        console.error('📊 에러 메트릭 기록:', metadata);
        break;
    }

    // 프로덕션에서는 Analytics로 전송
    if (!__DEV__ && type === 'recommendation_calculation') {
      // analytics().logEvent('recommendation_calculated', {
      //   calculation_time: value,
      //   user_id: metadata?.userId,
      //   song_count: metadata?.songCount,
      // });
    }
  }, []);

  return {
    recordMetric,
    getMetrics: () => ({ ...metricsRef.current }),
  };
};

// 🔧 종합 UX 개선 훅 - 모든 기능을 하나로 통합
export const useRecommendationUXEnhancements = () => {
  const appState = useAppState();
  const networkStatus = useNetworkStatus();
  const accessibility = useAccessibility();

  // 🎯 스마트 업데이트 결정 로직
  const shouldAutoUpdate = useCallback(() => {
    const conditions = {
      isAppActive: appState.isActive,
      hasGoodConnection: networkStatus.isConnected && !networkStatus.isSlowConnection,
      timeSinceBackground: appState.timeInBackground > 5 * 60 * 1000, // 5분 이상
    };

    const shouldUpdate = conditions.isAppActive && 
                        conditions.hasGoodConnection && 
                        conditions.timeSinceBackground;

    if (__DEV__) {
      console.log('🤖 자동 업데이트 조건 확인:', conditions, '→', shouldUpdate);
    }

    return shouldUpdate;
  }, [appState, networkStatus]);

  // 🎭 사용자 친화적 메시지 생성
  const getContextualMessage = useCallback((action: string) => {
    if (!networkStatus.isConnected) {
      return `${action}을 위해 인터넷 연결을 확인해주세요`;
    }
    if (networkStatus.isSlowConnection) {
      return `느린 연결로 인해 ${action}에 시간이 걸릴 수 있습니다`;
    }
    if (!appState.isActive) {
      return `앱이 활성화되면 ${action}이 진행됩니다`;
    }
    return `${action} 중입니다...`;
  }, [networkStatus, appState]);

  return {
    appState,
    networkStatus,
    accessibility,
    shouldAutoUpdate,
    getContextualMessage
  };
};