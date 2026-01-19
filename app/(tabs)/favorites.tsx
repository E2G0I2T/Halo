import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { Image } from "expo-image";
import { useAppStyles } from "@/theme/styles";
import { useState, useMemo, useCallback, memo } from "react";
import { useSongs } from "@/lib/hooks/useSongs";
import { useFavorites } from "@/lib/contexts/FavoritesContext";
import { useRatings } from "@/lib/contexts/RatingsContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type RatingFilter = 'all' | 'rated' | 'unrated';

const FavoriteListItem = memo(({ 
  item, 
  rating, 
  isFav,
  onRate, 
  onToggleFavorite, 
  onPress, 
  styles 
}: {
  item: any,
  rating: number,
  isFav: boolean,
  onRate: (videoId: string, artist: string, star: number) => void,
  onToggleFavorite: (videoId: string) => void,
  onPress: (song: any) => void,
  styles: any
}) => {
  return (
    <View style={[styles.borderBottom, { paddingVertical: 16 }]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        
        <Image
          source={item.thumbnail}
          style={{ width: 60, height: 60, borderRadius: 6, marginRight: 12 }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        <View style={{ flex: 1 }}>
          <Text style={[styles.text, { marginBottom: 4 }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.text, { fontSize: 14, opacity: 0.7 }]} numberOfLines={1}>
            {item.artist}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 4 }}>
            {[0, 1, 2, 3, 4].map((starIndex) => {
              const isSelected = starIndex < rating;
              return (
                <TouchableOpacity
                  key={starIndex}
                  onPress={() => onRate(item.videoId, item.artist, starIndex)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isSelected ? "star" : "star-outline"}
                    size={18}
                    color={isSelected ? "#FFD700" : "#aaa"}
                    style={{ marginRight: 2 }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            height: 72,
            paddingVertical: 4,
          }}
        >
          <TouchableOpacity 
            onPress={() => onToggleFavorite(item.videoId)} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={24}
              color={isFav ? "#ff4f4f" : "#aaa"}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => onPress(item)} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}, (prev, next) => {
  return (
    prev.item.videoId === next.item.videoId &&
    prev.rating === next.rating &&
    prev.isFav === next.isFav &&
    prev.item.title === next.item.title
  );
});

export default function FavoritesScreen() {
  const styles = useAppStyles();
  const router = useRouter();
  
  const { user, isFirebaseReady, isAuthReady, loading: authLoading } = useAuth();
  
  const authStateForUseSongs = useMemo(
    () => ({
      user,
      isFirebaseReady,
      isAuthReady,
      loading: authLoading,
    }),
    [user, isFirebaseReady, isAuthReady, authLoading]
  );

  const { songs, loading: songsLoading, error } = useSongs(authStateForUseSongs);
  const { favorites, loading: favoritesLoading, toggleFavorite, isFavorite } = useFavorites();
  const { getRating, setRating } = useRatings();
  
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  const safeSongs = useMemo(() => Array.isArray(songs) ? songs : [], [songs]);
  const safeFavorites = useMemo(() => Array.isArray(favorites) ? favorites : [], [favorites]);
  
  const favoriteSongs = useMemo(() => {
    return safeSongs.filter((song) => safeFavorites.includes(song.videoId));
  }, [safeSongs, safeFavorites]);

  const finalFilteredSongs = useMemo(() => {
    if (!Array.isArray(favoriteSongs)) return [];
    
    switch (ratingFilter) {
      case 'rated':
        return favoriteSongs.filter(song => getRating(song.videoId) > 0);
      case 'unrated':
        return favoriteSongs.filter(song => getRating(song.videoId) === 0);
      default:
        return favoriteSongs;
    }
  }, [favoriteSongs, ratingFilter, getRating]);

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

  const handleRate = useCallback((videoId: string, artist: string, starIndex: number) => {
    setRating(videoId, starIndex + 1, artist); 
  }, [setRating]);

  const handlePressSong = useCallback((song: any) => {
    router.push({
      pathname: "/player",
      params: {
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
      },
    });
  }, [router]);

  const handleToggleFavorite = useCallback((videoId: string) => {
    toggleFavorite(videoId);
  }, [toggleFavorite]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const rating = getRating(item.videoId);
    const isFav = isFavorite(item.videoId);

    return (
      <FavoriteListItem 
        item={item}
        rating={rating}
        isFav={isFav}
        onRate={handleRate}
        onToggleFavorite={handleToggleFavorite}
        onPress={handlePressSong}
        styles={styles}
      />
    );
  }, [styles, getRating, isFavorite, handleRate, handleToggleFavorite, handlePressSong]);

  if (authLoading || songsLoading || favoritesLoading) {
    return <LoadingScreen message="즐겨찾기를 불러오는 중..." />;
  }

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
      {renderFilterButtons()}
      {renderResultCount()}

      {Array.isArray(favoriteSongs) && favoriteSongs.length === 0 ? (
        <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
          <Text style={[styles.text, { opacity: 0.6, textAlign: 'center' }]}>
            ❤️ 하트 버튼을 눌러서{'\n'}즐겨찾기를 추가해보세요!
          </Text>
        </View>
      ) : (
        <FlatList
          data={Array.isArray(finalFilteredSongs) ? finalFilteredSongs : []}
          keyExtractor={(item) => item.videoId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          initialNumToRender={10}
          windowSize={5}
          extraData={[favorites, getRating, isFavorite]}
        />
      )}
    </View>
  );
}