import React from "react";
import { View, Text } from "react-native";
import NativeBannerAd from "./NativeBannerAd";

export default function MyBannerAd() {
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