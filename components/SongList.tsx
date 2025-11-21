import React, { useCallback, memo } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { Image } from "expo-image"; 
import { useAppStyles } from "@/theme/styles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Song } from "@/lib/types/song";
import { useFavorites } from "@/lib/contexts/FavoritesContext";
import { useRatings } from "@/lib/contexts/RatingsContext";
import MyBannerAd from "./MyBannerAd";

// 타입 정의
export type SongItem = {
  type: "song";
  key: string;
} & Song;

type AdItem = {
  type: "ad";
  key: string;
};

type ListItem = SongItem | AdItem;

type SongListProps = {
  songs: Song[];
  showAds?: boolean;
  enableRefresh?: boolean;
};

const SongListItem = memo(
  ({
    song,
    isFav,
    rating,
    onToggleFavorite,
    onRate,
    onPress,
  }: {
    song: Song;
    isFav: boolean;
    rating: number;
    onToggleFavorite: (id: string) => void;
    onRate: (id: string, artist: string, star: number) => void;
    onPress: (song: Song) => void;
  }) => {
    const styles = useAppStyles();

    return (
      <View style={[styles.borderBottom, { paddingVertical: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          
          <Image
            source={song.thumbnail}
            style={{ width: 60, height: 60, borderRadius: 6, marginRight: 12 }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />

          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { marginBottom: 4 }]}>{song.title}</Text>
            <Text style={[styles.text, { fontSize: 14, opacity: 0.7 }]}>
              {song.artist}
            </Text>

            {/* 별점 UI */}
            <View style={{ flexDirection: "row", marginTop: 4 }}>
              {[0, 1, 2, 3, 4].map((starIndex) => {
                const isSelected = starIndex < rating;
                return (
                  <TouchableOpacity
                    key={starIndex}
                    onPress={() => onRate(song.videoId, song.artist, starIndex)}
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
            <TouchableOpacity onPress={() => onToggleFavorite(song.videoId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={24}
                color={isFav ? "#ff4f4f" : "#aaa"}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onPress(song)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
  (prev, next) => {
    return (
      prev.isFav === next.isFav &&
      prev.rating === next.rating &&
      prev.song.videoId === next.song.videoId
    );
  }
);

export default function SongList({ songs, showAds = true }: SongListProps) {
  const styles = useAppStyles();
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { setRating, getRating } = useRatings();

  const insertAds = (items: Song[], interval = 5): ListItem[] => {
    const merged: ListItem[] = [];
    for (let i = 0; i < items.length; i++) {
      if (showAds && i > 0 && i % interval === 0) {
        merged.push({ type: "ad", key: `ad-${i}` });
      }
      merged.push({
        type: "song",
        key: items[i].videoId,
        ...items[i],
      });
    }
    return merged;
  };

  const dataWithAds = insertAds(songs);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
    },
    [toggleFavorite]
  );

  const handleRate = useCallback(
    (videoId: string, artist: string, starIndex: number) => {
      const currentRating = getRating(videoId); 
      const newRating = starIndex + 1;
      if (currentRating === newRating) {
        setRating(videoId, 0, artist);
      } else {
        setRating(videoId, newRating, artist);
      }
    },
    [setRating, getRating]
  );

  const handlePressSong = useCallback(
    (song: Song) => {
      router.push({
        pathname: "/player",
        params: {
          videoId: song.videoId,
          title: song.title,
          artist: song.artist,
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "ad") {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <MyBannerAd />
          </View>
        );
      }

      const song = item as SongItem;
      
      return (
        <SongListItem
          song={song}
          isFav={isFavorite(song.videoId)}
          rating={getRating(song.videoId)}
          onToggleFavorite={handleToggleFavorite}
          onRate={handleRate}
          onPress={handlePressSong}
        />
      );
    },
    [isFavorite, getRating, handleToggleFavorite, handleRate, handlePressSong]
  );

  const renderEmptyComponent = () => (
    <Text
      style={[
        styles.text,
        { marginTop: 20, textAlign: "center", opacity: 0.6 },
      ]}
    >
      표시할 곡이 없습니다.
    </Text>
  );

  return (
    <FlatList<ListItem>
      data={dataWithAds}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      ListEmptyComponent={renderEmptyComponent}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
}