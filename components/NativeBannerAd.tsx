// components/NativeBannerAd.tsx
import React from "react";
import { View, Text } from "react-native"; // 임시 import

export default function NativeBannerAd() {
  return (
    <View style={{ backgroundColor: "#f5f5f5", height: 60, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#888" }}>[네이티브 광고 제거됨]</Text>
    </View>
  );
  /* // react-native-google-mobile-ads 관련 코드 전체 주석 처리
  import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

  return (
    <BannerAd
      unitId={TestIds.BANNER}
      size={BannerAdSize.ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={error => console.warn(error)}
    />
  );
  */
}