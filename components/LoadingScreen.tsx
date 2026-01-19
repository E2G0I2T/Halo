// components/LoadingScreen.tsx

import React from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { useAppStyles } from '@/theme/styles';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "로딩 중..." }: LoadingScreenProps) {
  const styles = useAppStyles();

  return (
    <View style={[styles.container, { 
      justifyContent: 'center', 
      alignItems: 'center',
      paddingHorizontal: 24
    }]}>
      
      <Image 
        source={require('../assets/images/icon.png')} 
        style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          marginBottom: 32
        }}
        resizeMode="cover"
      />

      <Text style={[styles.text, {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
        color: styles.text.color
      }]}>
        Halo
      </Text>

      <ActivityIndicator 
        size="large" 
        color="#ff4f4f" 
        style={{ marginBottom: 16 }} 
      />
      
      <Text style={[styles.text, { 
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center'
      }]}>
        {message}
      </Text>
      
    </View>
  );
}