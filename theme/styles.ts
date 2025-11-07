// theme/styles.ts
import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { useTheme } from './ThemeContext';

export const useAppStyles = () => {
  const { theme } = useTheme();
  const colorSet = Colors[theme];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colorSet.background,
      padding: 16,
    },
    text: {
      color: colorSet.text,
      fontSize: 24,
    },
    title: {
      color: colorSet.text,
      fontSize: 36,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    borderBottom: {
      borderBottomWidth: 1,
      borderColor: colorSet.border,
    },
    primaryButton: {
      backgroundColor: colorSet.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    }
  });
};
