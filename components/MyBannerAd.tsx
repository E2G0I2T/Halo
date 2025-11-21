import React from "react";
import { View, Text } from "react-native";
import NativeBannerAd from "./NativeBannerAd"; // 👈 직접 import

export default function MyBannerAd() {
  // Expo Go에서 실행 중일 때를 대비한 방어 코드 (선택 사항)
  // Development Build에서는 정상 작동함
  try {
    return <NativeBannerAd />;
  } catch (error) {
    return (
      <View style={{ height: 60, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}>
        <Text>광고 로드 중 오류 발생</Text>
      </View>
    );
  }
}