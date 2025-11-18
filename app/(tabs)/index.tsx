// app/(tabs)/index.tsx

import { View, TextInput, Text, TouchableOpacity, Alert } from "react-native";
import { useAppStyles } from "@/theme/styles";
import { useState, useEffect, useMemo } from "react";
import SongList from "@/components/SongList";
import { useSongs } from "@/lib/hooks/useSongs";
import { useRatings } from "@/lib/contexts/RatingsContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RefreshProvider, useRefresh } from "@/lib/contexts/RefreshContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/lib/types/song";

// 필터 타입 정의
type RatingFilter = "all" | "rated" | "unrated";

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
}

function IndexContent({
  searchText,
  setSearchText,
  filteredData,
  isUpdating,
  pendingRecommendationUpdate,
}: IndexContentProps) {
  const styles = useAppStyles();
  const { getRating } = useRatings();

  const { isRefreshing, canRefresh, remainingCooldown, refreshData } =
    useRefresh();
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");

  const getRefreshMessage = (): string => {
    const isRecalculating =
      pendingRecommendationUpdate.isScheduled ||
      pendingRecommendationUpdate.isCalculating;

    if (isRefreshing) return "새로고침 중...";
    if (isRecalculating) return "추천 목록을 계산 중입니다...";
    if (isUpdating) return "새로운 곡을 불러오는 중...";
    return "";
  };

  const refreshMessage = getRefreshMessage();

  const applyRatingFilter = (songs: any[]): any[] => {
    if (!Array.isArray(songs)) return [];

    switch (ratingFilter) {
      case "rated":
        return songs.filter((song) => {
          try {
            return getRating(song?.videoId || "") > 0;
          } catch {
            return false;
          }
        });
      case "unrated":
        return songs.filter((song) => {
          try {
            return getRating(song?.videoId || "") === 0;
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

  const renderFilterButtons = () => {
    const filters: { key: RatingFilter; label: string; icon: string }[] = [
      { key: "all", label: "전체", icon: "🎵" },
      { key: "rated", label: "별점 있음", icon: "⭐" },
      { key: "unrated", label: "별점 없음", icon: "☆" },
    ];

    return (
      <View
        style={{
          flexDirection: "row",
          marginBottom: 16,
          justifyContent: "space-between",
        }}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setRatingFilter(filter.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              marginHorizontal: 2,
              backgroundColor:
                ratingFilter === filter.key ? "#ff4f4f" : "transparent",
              borderRadius: 6,
              borderWidth: 1,
              borderColor: ratingFilter === filter.key ? "#ff4f4f" : "#ddd",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: ratingFilter === filter.key ? "#fff" : styles.text.color,
                fontWeight: ratingFilter === filter.key ? "600" : "normal",
              }}
            >
              {`${filter.icon} ${filter.label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderResultCount = () => {
    const safeCount = Array.isArray(finalFilteredData)
      ? finalFilteredData.length
      : 0;
    const displayCount =
      typeof safeCount === "number" && !isNaN(safeCount) ? safeCount : 0;

    return (
      <Text
        style={[
          styles.text,
          {
            fontSize: 12,
            opacity: 0.6,
            marginBottom: 8,
            textAlign: "center",
          },
        ]}
      >
        {`${displayCount}곡 표시됨`}
      </Text>
    );
  };

  const isRecalculating =
    pendingRecommendationUpdate.isScheduled ||
    pendingRecommendationUpdate.isCalculating;
  const isCooldownActive = !canRefresh;

  const isButtonBusy = isRefreshing || isRecalculating || isUpdating;

  const handleRefreshPress = () => {
    if (isButtonBusy) {
      if (isRecalculating) {
        Alert.alert(
          "계산 중",
          "별점 데이터를 계산 중입니다. 계산이 종료된 후 다시 눌러주세요"
        );
      } else if (isRefreshing) {
        const safeRemainingTime =
          typeof remainingCooldown === "number" ? remainingCooldown : 0;
        Alert.alert(
          "쿨다운",
          `새로고침을 1분에 1번 가능합니다 (${safeRemainingTime}초 남음)`
        );
      } else if (isUpdating) {
        Alert.alert("동기화 중", "새로운 곡 목록을 불러오는 중입니다.");
      }
      return;
    }

    if (isCooldownActive) {
      const safeRemainingTime =
        typeof remainingCooldown === "number" ? remainingCooldown : 0;
      Alert.alert(
        "쿨다운",
        `새로고침을 1분에 1번 가능합니다 (${safeRemainingTime}초 남음)`
      );
      return;
    }

    if (refreshData) {
      console.log("🔘 새로고침 버튼 클릭 -> refreshData() 호출");
      refreshData();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: 50 }]}>
      <View style={{ flex: 1 }}>
        {refreshMessage && refreshMessage.length > 0 && (
          <View
            style={{
              backgroundColor:
                isRefreshing || isRecalculating ? "#e3f2fd" : "#f5f5f5",
              padding: 8,
              marginBottom: 8,
              borderRadius: 4,
              borderWidth: isRefreshing || isRecalculating ? 1 : 0,
              borderColor: "#2196f3",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 12,
                color: isRefreshing || isRecalculating ? "#1976d2" : "#666",
                fontWeight: isRefreshing || isRecalculating ? "500" : "normal",
              }}
            >
              {refreshMessage}
            </Text>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
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
              color: styles.text.color,
              flex: 1,
              marginRight: 8,
            }}
          />
          <TouchableOpacity
            onPress={handleRefreshPress}
            disabled={isButtonBusy}
            style={{
              backgroundColor: isButtonBusy ? "#ccc" : "#ff4f4f",
              width: 40,
              height: 40,
              borderRadius: 8,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {renderFilterButtons()}
        {renderResultCount()}
        <SongList
          songs={Array.isArray(finalFilteredData) ? finalFilteredData : []}
          showAds={true}
        />
      </View>
    </View>
  );
}

export default function IndexScreen() {
  const styles = useAppStyles();
  const [searchText, setSearchText] = useState("");

  const authState = useAuth();
  const {
    user,
    loading: authLoading,
    isFirebaseReady,
    isAuthReady,
  } = authState;

  const authStateForUseSongs = useMemo(
    () => ({
      user,
      isFirebaseReady,
      isAuthReady,
      loading: authLoading,
    }),
    [user, isFirebaseReady, isAuthReady, authLoading]
  );

  const songData = useSongs(authStateForUseSongs);
  const {
    songs, // ⬅️ useSongs가 이미 [T2(추천) + T3(셔플)] 정렬을 완료해서 보낸 목록
    loading: songsLoading,
    error,
    isUpdating,
    refreshData: refreshSongs,
    pendingRecommendationUpdate,
    scheduleRecommendationUpdate,
    _internal,
  } = songData;

  const [isRefreshingUI, setIsRefreshingUI] = useState(false);
  const [bufferedSongs, setBufferedSongs] = useState<Song[]>([]);
  useEffect(() => {
    if (!isRefreshingUI) {
      setBufferedSongs(songs);
    }
  }, [songs, isRefreshingUI]);

  const {
    forceSyncFromCloud: refreshRatings,
    setOnRatingChangeCallback,
    getRating,
    ratings,
  } = useRatings();

  const [frozenRatings, setFrozenRatings] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    if (_internal?.onRatingChanged && setOnRatingChangeCallback) {
    }
  }, [Boolean(_internal?.onRatingChanged), Boolean(setOnRatingChangeCallback)]);

  useEffect(() => {
    // 초기 로딩 시, ratings가 로드되면 스냅샷 저장
    if (songs.length > 0 && Object.keys(ratings).length > 0 && Object.keys(frozenRatings).length === 0) {
      console.log("🧊 초기 별점 스냅샷 저장");
      setFrozenRatings(ratings);
    }
  }, [songs, ratings]);

  const refreshAll = async (): Promise<void> => {
    try {
      console.log("🔄 [RefreshButton] 통합 새로고침 시작...");

      setIsRefreshingUI(true);

      console.log("🧮 1단계: 개인화 추천 재계산 요청 (즉시)");
      scheduleRecommendationUpdate(0);

      console.log("📥 2단계: songs.json 및 ratings 동기화");
      await Promise.all([refreshSongs(), refreshRatings()]);
      
      console.log("🧊 최종 별점 스냅샷 갱신");
      setFrozenRatings(ratings); 

      console.log("✅ 2단계 완료 (songs.json, ratings)");
    } catch (error: any) {
      console.error("새로고침 실패:", error);
    } finally {
      setIsRefreshingUI(false);
    }
  };

  const finalSongList = useMemo(() => {
    const safeSongs = Array.isArray(bufferedSongs) ? bufferedSongs : [];
    if (safeSongs.length === 0) return [];

    const currentRatings = Object.keys(frozenRatings).length > 0 ? frozenRatings : ratings;
    const getSnapshotRating = (id: string) => currentRatings[id] || 0;

    console.log("✅ [최종] 3단계 정렬 적용 (T1 분리 -> 나머지 순서 유지)");

    const ratedSongs: Song[] = [];
    const otherSongs: Song[] = [];

    safeSongs.forEach((song) => {
      if (!song || !song.videoId) return;
      if (getSnapshotRating(song.videoId) > 0) {
        ratedSongs.push(song);
      } else {
        otherSongs.push(song);
      }
    });

    // 1. T1(별점) 안정적 정렬
    ratedSongs.sort((a, b) => {
      const ratingA = getSnapshotRating(a.videoId);
      const ratingB = getSnapshotRating(b.videoId);
      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }
      const titleA = a.title || "";
      const titleB = b.title || "";
      return titleA.localeCompare(titleB);
    });
    
    return [...ratedSongs, ...otherSongs];

  }, [bufferedSongs, frozenRatings, ratings]); // recommendationOrder 의존성 제거

  const filteredData = useMemo(() => {
    const safeSongs = Array.isArray(finalSongList) ? finalSongList : [];
    if (searchText === "") {
      return safeSongs;
    }

    const lower = searchText.toLowerCase();
    return safeSongs.filter((song) => {
      if (!song || typeof song !== "object") return false;
      const safeTitle = song.title || "";
      const safeArtist = song.artist || "";
      return (
        safeTitle.toLowerCase().includes(lower) ||
        safeArtist.toLowerCase().includes(lower)
      );
    });
  }, [finalSongList, searchText]);

  if (authLoading || songsLoading) {
    return <LoadingScreen message="음악 데이터를 불러오는 중..." />;
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: 50, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: "#ff4f4f", textAlign: "center", marginBottom: 16 },
          ]}
        >
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
      />
    </RefreshProvider>
  );
}