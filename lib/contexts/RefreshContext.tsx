// lib/contexts/RefreshContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_REFRESH_KEY = "last-refresh-time";
const COOLDOWN_DURATION = 60 * 1000;

interface RefreshContextType {
  isRefreshing: boolean;
  canRefresh: boolean;
  remainingCooldown: number;
  refreshData: () => Promise<void>;
  checkCooldownStatus: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextType>({
  isRefreshing: false,
  canRefresh: true,
  remainingCooldown: 0,
  refreshData: async () => {},
  checkCooldownStatus: async () => {},
});

interface RefreshProviderProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
}

export const RefreshProvider: React.FC<RefreshProviderProps> = ({ 
  children, 
  onRefresh 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(true);
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  // 쿨다운 상태 확인
  const checkCooldownStatus = async () => {
    try {
      const lastRefreshStr = await AsyncStorage.getItem(LAST_REFRESH_KEY);
      if (!lastRefreshStr) {
        setCanRefresh(true);
        setRemainingCooldown(0);
        return;
      }

      const lastRefreshTime = parseInt(lastRefreshStr);
      const now = Date.now();
      const timeDiff = now - lastRefreshTime;

      if (timeDiff >= COOLDOWN_DURATION) {
        setCanRefresh(true);
        setRemainingCooldown(0);
      } else {
        setCanRefresh(false);
        setRemainingCooldown(Math.ceil((COOLDOWN_DURATION - timeDiff) / 1000));
      }
    } catch (error) {
      console.error('쿨다운 확인 실패:', error);
      setCanRefresh(true);
    }
  };

  // 새로고침 실행
  const refreshData = async () => {
    // 쿨다운 체크
    await checkCooldownStatus();
    
    if (!canRefresh) {
      console.log(`쿨다운 중: ${remainingCooldown}초 남음`);
      return;
    }

    if (isRefreshing) {
      console.log('이미 새로고침 중');
      return;
    }

    try {
      setIsRefreshing(true);
      await onRefresh();
      
      await AsyncStorage.setItem(LAST_REFRESH_KEY, Date.now().toString());
      
      // 쿨다운 상태 업데이트
      setCanRefresh(false);
      setRemainingCooldown(60);
      
      // 1초마다 남은 시간 감소
      let remaining = 60;
      const countdown = setInterval(() => {
        remaining -= 1;
        setRemainingCooldown(remaining);
        
        if (remaining <= 0) {
          clearInterval(countdown);
          setCanRefresh(true);
          setRemainingCooldown(0);
        }
      }, 1000);
      
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <RefreshContext.Provider 
      value={{ 
        isRefreshing,
        canRefresh, 
        remainingCooldown,
        refreshData,
        checkCooldownStatus
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};