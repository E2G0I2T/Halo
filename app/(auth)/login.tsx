// app/(auth)/login.tsx - 단순화된 로그인 화면

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { signInWithGoogle, loading, error } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('로그인 실패', error.message);
    }
  };

  const handlePrivacyPolicy = () => {
    // 방금 만든 개인정보 처리방침 URL을 넣으세요
    Linking.openURL('https://0paleblue0.blogspot.com/2025/11/halo.html'); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* 상단 여백 (1/3) */}
        <View style={styles.topSpacer} />
        
        {/* 아이콘 영역 */}
        <View style={styles.iconPlaceholder}>
          <Image 
            source={require('../../assets/images/icon.png')} 
            style={styles.iconImage}
            resizeMode="cover"
          />
        </View>

        {/* 로그인 섹션 */}
        <View style={styles.loginSection}>
          <Text style={styles.loginPrompt}>
            더 나은 음악 추천을 위해{'\n'}
            Google 계정으로 로그인해주세요
          </Text>

          {/* 에러 메시지 */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* 로딩 또는 로그인 버튼 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285f4" />
              <Text style={styles.loadingText}>로그인 중...</Text>
            </View>
          ) : (
            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={handleGoogleSignIn}
            />
          )}
        </View>

        {/* 하단 여백 공간 확보 */}
        <View style={styles.bottomSpacer} />

        {/* 개인정보 안내 */}
        <View style={styles.privacy}>
          <Text style={styles.privacyText}>
            로그인 시{' '}
            <Text style={styles.privacyLink} onPress={handlePrivacyPolicy}>
              개인정보 처리방침
            </Text>
            에 동의하게 됩니다.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topSpacer: {
    flex: 1,
  },
  iconPlaceholder: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginPrompt: {
    fontSize: 18,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4285f4',
  },
  googleButton: {
    width: 200,
    height: 48,
  },
  bottomSpacer: {
    flex: 0.5,
  },
  privacy: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  privacyLink: {
    fontSize: 13,
    color: '#4285f4',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});