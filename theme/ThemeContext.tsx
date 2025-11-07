// theme/ThemeContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

const THEME_KEY = 'user-theme';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('light');
  const [loaded, setLoaded] = useState(false);

  // 앱 시작 시 저장된 테마 불러오기
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved);
        }
      } catch (e) {
        console.warn('테마 로드 실패:', e);
      }
      setLoaded(true);
    };
    loadTheme();
  }, []);

  // 테마 토글 시 저장
  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setTheme(newTheme);
    } catch (e) {
      console.warn('테마 저장 실패:', e);
    }
  };

  const statusBarStyle = theme === 'dark' ? 'light' : 'dark';

  if (!loaded) return null; // 테마 로드 전까지 렌더링 보류

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <StatusBar style={statusBarStyle} />
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
