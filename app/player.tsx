// app/player.tsx - 프로덕션용 정리

import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppStyles } from "@/theme/styles";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useRatings } from "@/lib/contexts/RatingsContext";

export default function PlayerScreen() {
  const styles = useAppStyles();
  const router = useRouter();
  const { setRating, getRating } = useRatings();
  const { videoId, title, artist } = useLocalSearchParams<{
    videoId: string;
    title: string;
    artist: string;
  }>();

  // 안전한 파라미터 처리
  const safeVideoId = typeof videoId === "string" ? videoId : "";
  const safeTitle = typeof title === "string" ? title : "제목 없음";
  const safeArtist = typeof artist === "string" ? artist : "아티스트 없음";

  if (!safeVideoId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: 50, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={styles.text}>잘못된 영상입니다.</Text>
      </View>
    );
  }

  const videoUrl = `https://www.youtube.com/embed/${safeVideoId}?autoplay=1`;

  // 별점 클릭 핸들러
  const handleStarPress = (starIndex: number) => {
    const newRating = starIndex + 1; // 1-5점
    const currentRating = getRating(safeVideoId);

    // 같은 별을 다시 클릭하면 별점 제거 (0점)
    if (currentRating === newRating) {
      setRating(safeVideoId, 0, safeArtist);
    } else {
      setRating(safeVideoId, newRating, safeArtist);
    }
  };

  // 안전한 별점 UI 렌더링
  const renderStars = () => {
    const currentRating = getRating(safeVideoId) || 0; // 안전한 기본값

    return (
      <View
        style={{
          flexDirection: "row",
          marginTop: 16,
          justifyContent: "center",
        }}
      >
        {[0, 1, 2, 3, 4].map((starIndex) => {
          const isSelected = starIndex < currentRating;

          return (
            <TouchableOpacity
              key={starIndex}
              onPress={() => handleStarPress(starIndex)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginHorizontal: 2 }}
            >
              <Ionicons
                name={isSelected ? "star" : "star-outline"}
                size={28}
                color={isSelected ? "#FFD700" : "#aaa"}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // 안전한 곡 정보 렌더링
  const renderSongInfo = () => {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[styles.title, { textAlign: "center", marginBottom: 8 }]}>
          {safeTitle}
        </Text>
        <Text
          style={[
            styles.text,
            { fontSize: 14, opacity: 0.7, textAlign: "center" },
          ]}
        >
          {safeArtist}
        </Text>

        {/* 터치 가능한 별점 시스템 */}
        {renderStars()}

        {/* 별점 안내 텍스트 */}
        <Text
          style={[
            styles.text,
            {
              fontSize: 12,
              opacity: 0.5,
              textAlign: "center",
              marginTop: 8,
            },
          ]}
        >
          별을 터치해서 별점을 매겨보세요
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {/* 상단 뒤로가기 버튼 */}
      <View style={{ paddingTop: 50, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 12 }}>
          <Ionicons name="arrow-back" size={24} color={styles.text.color} />
        </TouchableOpacity>
      </View>

      {/* 유튜브 영상 */}
      <View style={{ height: 220, marginBottom: 16 }}>
        <WebView
          source={{ uri: videoUrl }}
          style={{ flex: 1 }}
          allowsFullscreenVideo
        />
      </View>

      {/* 곡 정보 - 안전한 렌더링 */}
      {renderSongInfo()}
    </View>
  );
}
