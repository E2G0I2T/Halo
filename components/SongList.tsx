// components/SongList.tsx

import React from "react";
import { View, Text, FlatList, TouchableOpacity, Image } from "react-native";
import { useAppStyles } from "@/theme/styles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Song } from "@/lib/types/song";
// import MyBannerAd from "./MyBannerAd";
import { useFavorites } from "@/lib/contexts/FavoritesContext";
import { useRatings } from "@/lib/contexts/RatingsContext";

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
  enableRefresh?: boolean; // Pull-to-refresh 활성화 여부
};

export default function SongList({ songs, showAds = true }: SongListProps) {
  const styles = useAppStyles();
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { setRating, getRating } = useRatings();

  // 광고 삽입
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

  // 별점 클릭 핸들러
  const handleStarPress = (
    videoId: string,
    artist: string,
    starIndex: number
  ) => {
    const newRating = starIndex + 1;
    const currentRating = getRating(videoId);

    // 같은 별을 다시 클릭하면 별점 제거 (0점)
    if (currentRating === newRating) {
      setRating(videoId, 0, artist);
    } else {
      setRating(videoId, newRating, artist);
    }
  };

  // 별점 UI 렌더링
  const renderStars = (videoId: string, artist: string) => {
    const currentRating = getRating(videoId);

    return (
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {[0, 1, 2, 3, 4].map((starIndex) => {
          const isSelected = starIndex < currentRating;

          return (
            <TouchableOpacity
              key={starIndex}
              onPress={() => handleStarPress(videoId, artist, starIndex)}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Ionicons
                name={isSelected ? "star" : "star-outline"}
                size={18}
                color={isSelected ? "#FFD700" : "#aaa"} // 금색 vs 회색
                style={{ marginRight: 2 }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // 🔧 수정: 빈 리스트 컴포넌트를 안전하게 처리
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
      renderItem={({ item }) => {
        if (item.type === "ad") {
          // return (
          //   <View style={{ paddingVertical: 16, alignItems: "center" }}>
          //     {/* <MyBannerAd /> */}
          //   </View>
          // );
          return null;
        }

        // SongItem 타입 단언
        const song = item as SongItem;
        const isFav = isFavorite(song.videoId);
        const thumbnailUrl = song.thumbnail;

        return (
          <View style={[styles.borderBottom, { paddingVertical: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={{ uri: thumbnailUrl }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 6,
                  marginRight: 12,
                }}
              />

              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { marginBottom: 4 }]}>
                  {song.title}
                </Text>
                <Text style={[styles.text, { fontSize: 14, opacity: 0.7 }]}>
                  {song.artist}
                </Text>

                {renderStars(song.videoId, song.artist)}
              </View>

              <View
                style={{
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: 72,
                  paddingVertical: 4,
                }}
              >
                <TouchableOpacity onPress={() => toggleFavorite(song.videoId)}>
                  <Ionicons
                    name={isFav ? "heart" : "heart-outline"}
                    size={24}
                    color={isFav ? "#ff4f4f" : "#aaa"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: "/player",
                      params: {
                        videoId: song.videoId,
                        title: song.title,
                        artist: song.artist,
                      },
                    });
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={renderEmptyComponent}
    />
  );
}
