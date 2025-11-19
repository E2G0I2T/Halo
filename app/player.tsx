// app/player.tsx

import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"; // ActivityIndicator 추가
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

  // ✅ 핵심 수정 1: 공백 제거 (.trim())
  const safeVideoId = typeof videoId === "string" ? videoId.trim() : "";
  const safeTitle = typeof title === "string" ? title : "제목 없음";
  const safeArtist = typeof artist === "string" ? artist : "아티스트 없음";

  // ✅ 디버깅용: 로그 확인 (터미널에서 videoId가 정확한지 확인하세요)
  console.log("Current Video ID:", `"${safeVideoId}"`);

  if (!safeVideoId) {
    return (
      <View style={[styles.container, localStyles.centerContainer]}>
        <Text style={styles.text}>잘못된 영상입니다.</Text>
      </View>
    );
  }

  // ✅ 핵심 수정 2: 도메인 변경 (youtube-nocookie.com) 및 HTML 최적화
  const embedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body { margin: 0; padding: 0; background-color: black; display: flex; justify-content: center; align-items: center; height: 100%; overflow: hidden; }
          iframe { width: 100%; height: 100%; border: 0; }
        </style>
      </head>
      <body>
        <iframe
          src="https://www.youtube-nocookie.com/embed/${safeVideoId}?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1&fs=1"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </body>
    </html>
  `;

  const handleStarPress = (starIndex: number) => {
    const newRating = starIndex + 1;
    const currentRating = getRating(safeVideoId);
    if (currentRating === newRating) {
      setRating(safeVideoId, 0, safeArtist);
    } else {
      setRating(safeVideoId, newRating, safeArtist);
    }
  };

  const renderStars = () => {
    const currentRating = getRating(safeVideoId) || 0;
    return (
      <View style={localStyles.starsContainer}>
        {[0, 1, 2, 3, 4].map((starIndex) => {
          const isSelected = starIndex < currentRating;
          return (
            <TouchableOpacity
              key={starIndex}
              onPress={() => handleStarPress(starIndex)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={localStyles.starButton}
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

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={localStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color={styles.text.color} />
        </TouchableOpacity>
      </View>

      <View style={localStyles.webViewContainer}>
        <WebView
          style={{ flex: 1, backgroundColor: "black" }}
          source={{
            html: embedHtml,
            // ✅ 핵심 수정 3: baseUrl을 youtube-nocookie로 변경
            baseUrl: "https://www.youtube-nocookie.com" 
          }}
          // ✅ 핵심 수정 4: UserAgent를 조금 더 일반적인 값으로 변경 (또는 제거해봐도 됨)
          userAgent="Mozilla/5.0 (Linux; Android 10; Android SDK built for x86) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={localStyles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ff4f4f" />
            </View>
          )}
          // 에러 발생 시 로그 출력
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
        />
      </View>

      <View style={localStyles.infoContainer}>
        <Text style={[styles.title, localStyles.titleText]}>{safeTitle}</Text>
        <Text style={[styles.text, localStyles.artistText]}>{safeArtist}</Text>
        {renderStars()}
        <Text style={[styles.text, localStyles.hintText]}>
          별을 터치해서 별점을 매겨보세요
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  // ... (기존 스타일 유지)
  centerContainer: {
    paddingTop: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 12,
  },
  webViewContainer: {
    height: 220,
    backgroundColor: "black",
    marginBottom: 16,
  },
  infoContainer: {
    paddingHorizontal: 16,
  },
  titleText: {
    textAlign: "center",
    marginBottom: 8,
  },
  artistText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "center",
  },
  starButton: {
    marginHorizontal: 2,
  },
  hintText: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: "center",
    marginTop: 8,
  },
  loadingOverlay: { // 새로 추가된 스타일
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "black",
  }
});