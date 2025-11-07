// components/MyBannerAd.tsx

import React from "react";
import { View, Text } from "react-native";

export default function MyBannerAd() {
  // 개발(Expo Go)에서는 더미 광고
  return (
    <View style={{ backgroundColor: "#f5f5f5", height: 60, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#888" }}>[광고 제거됨]</Text>
    </View>
  );

  /* // EAS 빌드 관련 코드 전체 주석 처리
  if (__DEV__) {
    // ... (기존 더미 광고 로직)
  }
  // EAS 빌드에서는 동적 import 사용 (동기 방식 불가, hooks/상태 등 필요)
  const BannerAdComponent = require("./NativeBannerAd").default;
  return <BannerAdComponent />;
  */
}