// components/NativeBannerAd.tsx

import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 실제 배포 시에는 본인의 광고 단위 ID(Ad Unit ID)를 넣어야 합니다.
// 개발 중에는 TestIds.BANNER를 사용해야 계정 정지를 피할 수 있습니다.
const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-xxxxxxxxxxxxx/yyyyy';

export default function NativeBannerAd() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
      <BannerAd
        unitId={adUnitId}
        // 🔧 수정됨: ANCHored -> ANCHORED (전부 대문자여야 합니다)
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