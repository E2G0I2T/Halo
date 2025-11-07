// components/LogoutButton.tsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { useAuth } from '../lib/contexts/AuthContext';

export default function LogoutButton() {
  const { logout, user } = useAuth(); // 🔧 signOut → logout으로 수정

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠어요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 로그아웃 시작...');
              await logout(); // 🔧 signOut() → logout()으로 수정
              console.log('✅ 로그아웃 완료');
            } catch (error) {
              console.error('❌ 로그아웃 실패:', error);
              Alert.alert('오류', '로그아웃 중 문제가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        backgroundColor: '#ff4444',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
      }}
    >
      <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center', fontSize: 16 }}>
        로그아웃
      </Text>
    </TouchableOpacity>
  );
}