// components/NativeBannerAd.tsx
import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const adUnitId = TestIds.BANNER; // 테스트 광고 노출

export default function NativeBannerAd() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} 
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
            console.log('광고 로드 성공');
        }}
        onAdFailedToLoad={(error) => {
            console.error('광고 로드 실패', error);
        }}
      />
    </View>
  );
}