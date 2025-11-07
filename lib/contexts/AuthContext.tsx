import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { auth } from '@/lib/config/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isFirebaseReady: boolean;
    isAuthReady: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isFirebaseReady: false,
    isAuthReady: false,
    signInWithGoogle: async () => {},
    logout: async () => {},
    isAuthenticated: false,
    error: null,
});

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFirebaseReady, setIsFirebaseReady] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Google Sign-In 초기화
    useEffect(() => {
        const initializeGoogleSignIn = () => {
            try {
                GoogleSignin.configure({
                    webClientId: '9597600331-5q75bthvmqql01ga66s528se448eg64u.apps.googleusercontent.com',
                    offlineAccess: true,
                });
                console.log('✅ Google Sign-In 설정 완료');
            } catch (error) {
                console.error('❌ Google Sign-In 설정 실패:', error);
                setError('Google Sign-In 설정 실패');
            }
        };

        initializeGoogleSignIn();
    }, []);

    // Firebase 인증 헬퍼
    const authenticateWithFirebase = async (idToken: string) => {
        try {
            console.log('🔥 Firebase 인증 시작...');
            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(auth, credential);
            console.log('🔥 Firebase 로그인 성공:', result.user.uid.slice(-8));
            return result.user;
        } catch (error: any) {
            console.error('❌ Firebase 인증 실패:', error);
            return null;
        }
    };

    // 자동 로그인 시도
    const attemptAutoLogin = async () => {
        try {
            console.log('🔍 자동 로그인 시도...');
            
            // getCurrentUser 반환값 수정
            const currentUserResponse = await GoogleSignin.getCurrentUser();
            if (currentUserResponse?.type === 'success') {
                const idToken = currentUserResponse.data.idToken;
                const userEmail = currentUserResponse.data.user.email;
                
                if (idToken) {
                    console.log('📱 기존 Google 계정 발견:', userEmail);
                    await authenticateWithFirebase(idToken);
                    console.log('✅ 자동 로그인 성공 (캐시)');
                    return true;
                }
            }

            // Silent Sign-In 시도
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signInSilently();
            
            if (response.type === 'success' && response.data.idToken) {
                console.log('📱 Silent 로그인 성공:', response.data.user.email);
                await authenticateWithFirebase(response.data.idToken);
                console.log('✅ 자동 로그인 성공 (silent)');
                return true;
            }
            
            return false;
        } catch (error: any) {
            console.log('⚠️ 자동 로그인 실패 (정상):', error.message);
            return false;
        }
    };

    // Firebase Auth 리스너
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log('🔐 Auth 상태 변경:', firebaseUser?.uid ? `로그인됨 (${firebaseUser.uid.slice(-8)})` : '로그아웃됨');
            
            setUser(firebaseUser);
            setIsAuthReady(true);
            setError(null);
            
            if (!firebaseUser && loading) {
                console.log('🔄 첫 실행 로그아웃 상태, 자동 로그인 시도...');
                await attemptAutoLogin();
            }
            
            setLoading(false);
        }, (authError) => {
            console.error('❌ Auth 리스너 오류:', authError);
            setError(authError.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Google 로그인
    const signInWithGoogle = async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('🚀 Google 로그인 시작...');
            
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            
            if (response.type === 'success' && response.data.idToken) {
                await authenticateWithFirebase(response.data.idToken);
                console.log('✅ Google 로그인 완료');
            } else {
                throw new Error('Google 로그인에서 idToken을 받지 못했습니다');
            }
        } catch (error: any) {
            console.error('❌ Google 로그인 실패:', error);
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                setError('로그인이 취소되었습니다');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                setError('이미 로그인 진행 중입니다');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                setError('Google Play Services를 사용할 수 없습니다');
            } else {
                setError(error.message || '로그인 실패');
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // 로그아웃
    const logout = async () => {
        try {
            setLoading(true);
            console.log('👋 로그아웃 시작...');
            
            await GoogleSignin.signOut();
            console.log('📱 Google 로그아웃 완료');
            
            await signOut(auth);
            console.log('🔥 Firebase 로그아웃 완료');
            
            console.log('✅ 로그아웃 완료');
        } catch (error: any) {
            console.error('❌ 로그아웃 실패:', error);
            setError(error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider 
            value={{ 
                user, 
                loading, 
                isFirebaseReady,
                isAuthReady,
                signInWithGoogle, 
                logout,
                isAuthenticated: !!user,
                error
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const getUserId = (user: User | null): string => {
  if (!user?.uid) {
    throw new Error('사용자가 로그인되지 않았습니다');
  }
  return user.uid;
};