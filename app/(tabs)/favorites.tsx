// app/(tabs)/favorites.tsx - 프로덕션용 정리

import { View, Text, TouchableOpacity } from "react-native";
import { useAppStyles } from "@/theme/styles";
import { useState } from "react";
import SongList from "@/components/SongList";
import { useSongs } from "@/lib/hooks/useSongs";
import { useFavorites } from "@/lib/contexts/FavoritesContext";
import { useRatings } from "@/lib/contexts/RatingsContext";
import LoadingScreen from "@/components/LoadingScreen";

// 필터 타입 정의
type RatingFilter = 'all' | 'rated' | 'unrated';

export default function FavoritesScreen() {
  const styles = useAppStyles();
  
  // Firebase 연동된 useSongs 훅 사용
  const { songs, loading, error } = useSongs();
  
  // 전역 즐겨찾기 상태 사용
  const { favorites, loading: favoritesLoading } = useFavorites();
  
  // 별점 컨텍스트
  const { getRating } = useRatings();
  
  // 별점 필터 상태
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  // 안전한 배열 처리
  const safeSongs = Array.isArray(songs) ? songs : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  
  const favoriteSongs = safeSongs.filter((song) =>
    safeFavorites.includes(song.videoId)
  );

  // 별점 필터 적용
  const applyRatingFilter = (songs: any[]) => {
    if (!Array.isArray(songs)) return [];
    
    switch (ratingFilter) {
      case 'rated':
        return songs.filter(song => getRating(song.videoId) > 0);
      case 'unrated':
        return songs.filter(song => getRating(song.videoId) === 0);
      default:
        return songs;
    }
  };

  const finalFilteredSongs = applyRatingFilter(favoriteSongs);

  // 필터 버튼 렌더링
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
              {filter.icon} {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // 안전한 결과 개수 렌더링
  const renderResultCount = () => {
    const count = Array.isArray(finalFilteredSongs) ? finalFilteredSongs.length : 0;
    return (
      <Text style={[styles.text, { 
        fontSize: 12, 
        opacity: 0.6, 
        marginBottom: 8,
        textAlign: 'center'
      }]}>
        {`즐겨찾기 ${count}곡 표시됨`}
      </Text>
    );
  };

  // 로딩 중일 때
  if (loading || favoritesLoading) {
    return <LoadingScreen message="즐겨찾기를 불러오는 중..." />;
  }

  // 에러가 있을 때
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: 50, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.text, { color: '#ff4f4f', textAlign: 'center' }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 50 }]}>
      
      {/* 별점 필터 버튼들 */}
      {renderFilterButtons()}

      {/* 안전한 필터링된 결과 개수 표시 */}
      {renderResultCount()}

      {/* 안전한 조건부 렌더링 */}
      {Array.isArray(favoriteSongs) && favoriteSongs.length === 0 ? (
        <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
          <Text style={[styles.text, { opacity: 0.6, textAlign: 'center' }]}>
            ❤️ 하트 버튼을 눌러서{'\n'}즐겨찾기를 추가해보세요!
          </Text>
        </View>
      ) : (
        <SongList
          songs={Array.isArray(finalFilteredSongs) ? finalFilteredSongs : []}
          showAds={true}
        />
      )}
    </View>
  );
}