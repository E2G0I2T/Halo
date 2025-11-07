// app/(tabs)/index.tsx

import { View, TextInput, Text, TouchableOpacity } from "react-native";
import { useAppStyles } from "@/theme/styles";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'expo-router';
import SongList from "@/components/SongList";
import { useSongs } from "@/lib/hooks/useSongs";
import { useRatings } from "@/lib/contexts/RatingsContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RefreshProvider, useRefresh } from "@/lib/contexts/RefreshContext";
import RecommendationUpdateBar from "@/components/RecommendationUpdateBar";
import { useTheme } from "@/theme/ThemeContext";
import LoadingScreen from "@/components/LoadingScreen";

// 필터 타입 정의
type RatingFilter = 'all' | 'rated' | 'unrated';

interface PendingRecommendationUpdate {
  isScheduled: boolean;
  countdown: number;
  isCalculating: boolean;
  newOrder?: string[];
  timeoutId?: number;
}

interface IndexContentProps {
  searchText: string;
  setSearchText: (text: string) => void;
  filteredData: any[];
  isUpdating: boolean;
  pendingRecommendationUpdate: PendingRecommendationUpdate;
  applyPendingRecommendations: () => Promise<void>;
  cancelPendingRecommendations: () => void;
}

function IndexContent({ 
  searchText, 
  setSearchText, 
  filteredData, 
  isUpdating,
  pendingRecommendationUpdate,
  applyPendingRecommendations,
  cancelPendingRecommendations
}: IndexContentProps) {
  const styles = useAppStyles();
  const { getRating } = useRatings();
  const { theme } = useTheme();
  
  const { isRefreshing, canRefresh, remainingCooldown } = useRefresh();
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  const getRefreshMessage = (): string => {
    if (isRefreshing) return "곡 목록과 별점을 새로고침 중...";
    if (!canRefresh && remainingCooldown > 0) {
      const safeRemainingTime = typeof remainingCooldown === 'number' ? remainingCooldown : 0;
      return `잠시 후 다시 시도해주세요 (${safeRemainingTime}초)`;
    }
    if (isUpdating) return "새로운 곡을 불러오는 중...";
    return "";
  };

  const refreshMessage = getRefreshMessage();

  const applyRatingFilter = (songs: any[]): any[] => {
    if (!Array.isArray(songs)) return [];
    
    switch (ratingFilter) {
      case 'rated':
        return songs.filter(song => {
          try {
            return getRating(song?.videoId || '') > 0;
          } catch {
            return false;
          }
        });
      case 'unrated':
        return songs.filter(song => {
          try {
            return getRating(song?.videoId || '') === 0;
          } catch {
            return true;
          }
        });
      default:
        return songs;
    }
  };

  const safeFilteredData = Array.isArray(filteredData) ? filteredData : [];
  const finalFilteredData = applyRatingFilter(safeFilteredData);

  const handleApplyRecommendations = async () => {
    try {
      await applyPendingRecommendations();
    } catch (error) {
      console.error('추천 적용 실패:', error);
    }
  };

  const handleCancelRecommendations = () => {
    cancelPendingRecommendations();
  };

  const renderFilterButtons = () => {
    const filters: { key: RatingFilter; label: string; icon: string }[] = [
      { key: 'all', label: '전체', icon: '🎵' },
      { key: 'rated', label: '별점 있음', icon: '⭐' },
      { key: 'unrated', label: '별점 없음', icon: '☆' }
    ];

    return (
      <View style={{ 
        flexDirection: 'row', 
        marginBottom: 16,
        justifyContent: 'space-between'
      }}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setRatingFilter(filter.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              marginHorizontal: 2,
              backgroundColor: ratingFilter === filter.key ? '#ff4f4f' : 'transparent',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: ratingFilter === filter.key ? '#ff4f4f' : '#ddd',
              alignItems: 'center'
            }}
          >
            <Text style={{
              fontSize: 12,
              color: ratingFilter === filter.key ? '#fff' : styles.text.color,
              fontWeight: ratingFilter === filter.key ? '600' : 'normal'
            }}>
              {`${filter.icon} ${filter.label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderResultCount = () => {
    const safeCount = Array.isArray(finalFilteredData) ? finalFilteredData.length : 0;
    const displayCount = typeof safeCount === 'number' && !isNaN(safeCount) ? safeCount : 0;
    
    return (
      <Text style={[styles.text, { 
        fontSize: 12, 
        opacity: 0.6, 
        marginBottom: 8,
        textAlign: 'center'
      }]}>
        {`${displayCount}곡 표시됨`}
      </Text>
    );
  };

  const isRecommendationBarVisible = pendingRecommendationUpdate.isScheduled || !!pendingRecommendationUpdate.newOrder;
  const recommendationBarHeight = isRecommendationBarVisible ? 120 : 0;

  return (
    <View style={[styles.container, { paddingTop: 50 }]}>
      
      <RecommendationUpdateBar
        isVisible={isRecommendationBarVisible}
        isCalculating={pendingRecommendationUpdate.isCalculating}
        countdown={pendingRecommendationUpdate.countdown}
        hasNewOrder={!!pendingRecommendationUpdate.newOrder}
        onApply={handleApplyRecommendations}
        onCancel={handleCancelRecommendations}
      />

      <View style={{
        marginTop: recommendationBarHeight,
        flex: 1
      }}>
        
        {refreshMessage && refreshMessage.length > 0 && (
          <View style={{ 
            backgroundColor: isRefreshing ? '#e3f2fd' : '#f5f5f5', 
            padding: 8, 
            marginBottom: 8, 
            borderRadius: 4,
            borderWidth: isRefreshing ? 1 : 0,
            borderColor: '#2196f3'
          }}>
            <Text style={{ 
              textAlign: 'center', 
              fontSize: 12, 
              color: isRefreshing ? '#1976d2' : '#666',
              fontWeight: isRefreshing ? '500' : 'normal'
            }}>
              {refreshMessage}
            </Text>
          </View>
        )}
        
        <TextInput
          placeholder="곡 제목 또는 아티스트 검색"
          placeholderTextColor="#aaa"
          value={searchText}
          onChangeText={setSearchText}
          style={{
            height: 40,
            borderColor: "#ccc",
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            marginBottom: 16,
            color: styles.text.color,
          }}
        />

        {renderFilterButtons()}
        {renderResultCount()}

        <SongList
          songs={Array.isArray(finalFilteredData) ? finalFilteredData : []}
          showAds={true}
          enableRefresh={true}
        />
        
      </View>
    </View>
  );
}

// ✅ 메인 컴포넌트 - navigation 로직 제거
export default function IndexScreen() {
  const styles = useAppStyles();
  const [searchText, setSearchText] = useState("");
  
  const authState = useAuth();
  const { user, loading: authLoading, isFirebaseReady, isAuthReady } = authState;

  const authStateForUseSongs = useMemo(() => ({
    user,
    isFirebaseReady,
    isAuthReady,
    loading: authLoading
  }), [user, isFirebaseReady, isAuthReady, authLoading]);

  const songData = useSongs(authStateForUseSongs);
  const { 
    songs, 
    loading: songsLoading, 
    error, 
    isUpdating, 
    refreshData: refreshSongs,
    pendingRecommendationUpdate,
    applyPendingRecommendations,
    cancelPendingRecommendations,
    _internal 
  } = songData;
  
  const { 
    forceSyncFromCloud: refreshRatings,
    setOnRatingChangeCallback 
  } = useRatings();

  useEffect(() => {
    if (_internal?.onRatingChanged && setOnRatingChangeCallback) {
      setOnRatingChangeCallback(_internal.onRatingChanged);
      
      return () => {
        setOnRatingChangeCallback(null);
      };
    }
  }, [
    Boolean(_internal?.onRatingChanged),
    Boolean(setOnRatingChangeCallback)
  ]);

  const refreshAll = async (): Promise<void> => {
    try {
      await Promise.all([
        refreshSongs(),
        refreshRatings()
      ]);
    } catch (error: any) {
      console.error('새로고침 실패:', error);
      throw error;
    }
  };

  const safeSongs = Array.isArray(songs) ? songs : [];
  const filteredData = safeSongs.filter((song) => {
    if (!song || typeof song !== 'object') return false;
    
    const safeTitle = song.title || '';
    const safeArtist = song.artist || '';
    const lower = searchText.toLowerCase();
    
    return (
      safeTitle.toLowerCase().includes(lower) ||
      safeArtist.toLowerCase().includes(lower)
    );
  });

  // ✅ 로딩 중일 때만 로딩 화면 표시 (인증 체크 제거)
  if (authLoading || songsLoading) {
    return <LoadingScreen message="음악 데이터를 불러오는 중..." />;
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: 50, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.text, { color: '#ff4f4f', textAlign: 'center', marginBottom: 16 }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <RefreshProvider onRefresh={refreshAll}>
      <IndexContent 
        searchText={searchText}
        setSearchText={setSearchText}
        filteredData={filteredData}
        isUpdating={isUpdating}
        pendingRecommendationUpdate={pendingRecommendationUpdate}
        applyPendingRecommendations={applyPendingRecommendations}
        cancelPendingRecommendations={cancelPendingRecommendations}
      />
    </RefreshProvider>
  );
}