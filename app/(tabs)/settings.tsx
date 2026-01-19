import { View, Text, Switch, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useAppStyles } from '@/theme/styles';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRatings } from '@/lib/contexts/RatingsContext';
import { Ionicons } from '@expo/vector-icons';
import LogoutButton from '@/components/LogoutButton';

export default function SettingsScreen() {
  const styles = useAppStyles();
  const { theme, toggleTheme } = useTheme();
  const { isFirebaseReady, user } = useAuth();
  const { isSyncing, lastSyncTime } = useRatings();

  const isDarkMode = theme === 'dark';

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://0paleblue0.blogspot.com/2025/11/halo.html'); 
  };

  const getLastSyncText = (): string => {
    if (!lastSyncTime || typeof lastSyncTime !== 'number') {
      return '별점 동기화 기록 없음';
    }
    
    const now = Date.now();
    const diffMs = now - lastSyncTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return '방금 동기화됨';
    if (diffMinutes < 60) return `${diffMinutes}분 전 동기화`;
    if (diffHours < 24) return `${diffHours}시간 전 동기화`;
    return `${diffDays}일 전 동기화`;
  };

  const getServerStatus = () => {
    if (!isFirebaseReady) {
      return {
        text: '오프라인',
        color: '#666',
        icon: 'cloud-offline-outline' as keyof typeof Ionicons.glyphMap,
        detail: '로컬 모드로 사용 중'
      };
    }
    
    if (isSyncing) {
      return {
        text: '동기화 중',
        color: '#2196F3',
        icon: 'sync' as keyof typeof Ionicons.glyphMap,
        detail: '별점 데이터 동기화 중...'
      };
    }
    
    return {
      text: '연결됨',
      color: '#4CAF50',
      icon: 'cloud-done-outline' as keyof typeof Ionicons.glyphMap,
      detail: getLastSyncText()
    };
  };

  const serverStatus = getServerStatus();

  const renderThemeSettings = () => {
    return (
      <View style={{ marginBottom: 40 }}>
        <Text style={[styles.text, { fontSize: 28, fontWeight: 'bold', marginBottom: 16 }]}>
          테마 설정
        </Text>
        
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingVertical: 16,
          paddingHorizontal: 8
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons 
              name={isDarkMode ? "moon" : "sunny"} 
              size={28} 
              color={styles.text.color} 
              style={{ marginRight: 16 }} 
            />
            <Text style={styles.text}>다크 모드</Text>
          </View>
          <Switch 
            value={isDarkMode} 
            onValueChange={toggleTheme}
            trackColor={{ false: '#e0e0e0', true: '#ff4f4f' }}
            thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
            style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
          />
        </View>
      </View>
    );
  };

  const renderServerStatus = () => {
    return (
      <View style={{ marginBottom: 40 }}>
        <Text style={[styles.text, { fontSize: 28, fontWeight: 'bold', marginBottom: 16 }]}>
          서버 연결 상태
        </Text>
        
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 20,
          backgroundColor: isDarkMode ? '#333' : '#f8f9fa',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDarkMode ? '#444' : '#e9ecef'
        }}>
          <Ionicons 
            name={serverStatus.icon} 
            size={32} 
            color={serverStatus.color} 
            style={{ marginRight: 16 }} 
          />
          
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.text, 
              { 
                fontWeight: '600', 
                color: serverStatus.color,
                marginBottom: 8
              }
            ]}>
              {serverStatus.text || '상태 확인 중'}
            </Text>
            <Text style={[
              styles.text, 
              { 
                fontSize: 18,
                opacity: 0.7,
                lineHeight: 24
              }
            ]}>
              {serverStatus.detail || '정보 로드 중...'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAccountInfo = () => {
    if (!user) return null;

    return (
      <View style={{ marginBottom: 40 }}>
        <Text style={[styles.text, { fontSize: 28, fontWeight: 'bold', marginBottom: 16 }]}>
          계정 정보
        </Text>
        
        <View style={{ 
          padding: 20,
          backgroundColor: isDarkMode ? '#333' : '#f8f9fa',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDarkMode ? '#444' : '#e9ecef',
          marginBottom: 20
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: 16
          }}>
            <Ionicons 
              name="person-circle" 
              size={32} 
              color={styles.text.color} 
              style={{ marginRight: 16 }} 
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.text, { fontWeight: '600', fontSize: 16 }]}>
                {user.email || '이메일 없음'}
              </Text>
            </View>
          </View>
        </View>

        <LogoutButton />
      </View>
    );
  };

  const renderAppInfo = () => {
    return (
      <View style={{ marginBottom: 40 }}>
        <Text style={[styles.text, { fontSize: 28, fontWeight: 'bold', marginBottom: 16 }]}>
          앱 정보
        </Text>
        
        <View style={{ 
          padding: 20,
          backgroundColor: isDarkMode ? '#333' : '#f8f9fa',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDarkMode ? '#444' : '#e9ecef'
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: 16
          }}>
            <Ionicons 
              name="musical-notes" 
              size={28} 
              color={styles.text.color} 
              style={{ marginRight: 12 }} 
            />
            <Text style={[styles.text, { fontWeight: '600' }]}>
              일본 음악 추천 앱
            </Text>
          </View>
          
          <Text style={[styles.text, { 
            fontSize: 18,
            opacity: 0.7, 
            lineHeight: 28 
          }]}>
            버전 1.0.0
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: 50 }]}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      
      {renderThemeSettings()}

      {renderServerStatus()}

      {renderAccountInfo()}

      {renderAppInfo()}

      <View style={{ 
        paddingBottom: 40,
        alignItems: 'center',
        gap: 12
      }}>
        <Text style={[
          styles.text, 
          { 
            fontSize: 14,
            opacity: 0.5,
            textAlign: 'center'
          }
        ]}>
          개인화 음악 추천 시스템
        </Text>

        <TouchableOpacity onPress={handlePrivacyPolicy}>
          <Text style={[
            styles.text, 
            { 
              fontSize: 13,
              opacity: 0.7,
              textAlign: 'center',
              textDecorationLine: 'underline',
              marginTop: 8
            }
          ]}>
            개인정보 처리방침
          </Text>
        </TouchableOpacity>
      </View>
      
    </ScrollView>
  );
}