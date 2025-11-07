// lib/contexts/FavoritesContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITE_KEY = "favorite-songs";

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (videoId: string) => void;
  isFavorite: (videoId: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
  loading: true,
});

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 즐겨찾기 데이터 로드
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const json = await AsyncStorage.getItem(FAVORITE_KEY);
      if (json) {
        setFavorites(JSON.parse(json));
      }
    } catch (error) {
      console.error('즐겨찾기 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITE_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('즐겨찾기 데이터 저장 실패:', error);
    }
  };

  const toggleFavorite = (videoId: string) => {
    const newFavorites = favorites.includes(videoId)
      ? favorites.filter((id) => id !== videoId)
      : [...favorites, videoId];
    
    saveFavorites(newFavorites);
  };

  const isFavorite = (videoId: string) => {
    return favorites.includes(videoId);
  };

  return (
    <FavoritesContext.Provider 
      value={{ 
        favorites, 
        toggleFavorite, 
        isFavorite, 
        loading 
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

// 커스텀 훅
export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};