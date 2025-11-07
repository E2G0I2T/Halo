// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // 텍스트 제거
        tabBarActiveTintColor: '#ff4f4f', // 활성 아이콘 색상
        tabBarStyle: {
          backgroundColor: 'white',
        },
        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'index') iconName = 'musical-notes';
          else if (route.name === 'favorites') iconName = 'heart';
          else if (route.name === 'settings') iconName = 'settings';
          else iconName = 'ellipse';

          return <Ionicons name={iconName} size={26} color={color} />; // ✅ 작고 안정적인 크기
        },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
