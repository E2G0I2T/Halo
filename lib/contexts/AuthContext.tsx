import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
// 🔧 firebase/compat/app에서 타입과 객체를 가져옵니다.
import { firebase, auth } from "@/lib/config/firebase";
import "firebase/compat/auth";

import {
  GoogleSignin,
  statusCodes,
  type User as GoogleUser,
  type SignInResponse, // 🔧 v13 반환 타입
  type SignInSilentlyResponse, // 🔧 v13 반환 타입
} from "@react-native-google-signin/google-signin";

// 🔧 Firebase User 타입을 compat에서 가져옵니다.
type User = firebase.User;
// 🔧 GoogleAuthProvider를 compat 객체에서 가져옵니다.
const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;

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
  const [user, setUser] = useState<User | null>(null); // Firebase User (compat)
  const [loading, setLoading] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null); // Google Sign-In 초기화

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      try {
        GoogleSignin.configure({
          webClientId:
            "9597600331-5q75bthvmqql01ga66s528se448eg64u.apps.googleusercontent.com",
          offlineAccess: true,
        });
        console.log("✅ Google Sign-In 설정 완료");
      } catch (error) {
        console.error("❌ Google Sign-In 설정 실패:", error);
        setError("Google Sign-In 설정 실패");
      }
    };

    initializeGoogleSignIn();
  }, []); // Firebase 인증 헬퍼

  const authenticateWithFirebase = async (idToken: string) => {
    try {
      console.log("🔥 Firebase 인증 시작...");
      const credential = GoogleAuthProvider.credential(idToken); // 🔧 수정: auth.signInWithCredential (compat 방식)
      const result = await auth.signInWithCredential(credential);
      console.log("🔥 Firebase 로그인 성공:", result.user!.uid.slice(-8));
      return result.user;
    } catch (error: any) {
      console.error("❌ Firebase 인증 실패:", error);
      return null;
    }
  }; // 자동 로그인 시도

  const attemptAutoLogin = async () => {
    try {
      console.log("🔍 자동 로그인 시도...");
      
      // 🔧 [수정] stale token 오류를 피하기 위해 getCurrentUser() 로직 제거
      
      // 2. Silent Sign-In 시도 (v13 - 항상 새로운 토큰을 가져옴)
      await GoogleSignin.hasPlayServices(); 
      const silentResult: SignInSilentlyResponse =
        await GoogleSignin.signInSilently(); 
      if (silentResult && "data" in silentResult) {
        const silentUser = silentResult.data; 
        console.log("📱 Silent 로그인 성공:", silentUser.user.email); 
        const { idToken } = await GoogleSignin.getTokens();
        if (idToken) {
          // 🔧 [수정] Firebase 인증 성공 여부 확인
          const firebaseUser = await authenticateWithFirebase(idToken);
          if (firebaseUser) {
            console.log("✅ 자동 로그인 성공 (silent + getTokens)");
            return true;
          }
        }
      }
      return false;
    } catch (error: any) {
      console.log("⚠️ 자동 로그인 실패 (정상):", error.message);
      return false;
    }
  }; // Firebase Auth 리스너

  useEffect(() => {
    // 🔧 수정: auth.onAuthStateChanged (compat 방식)
    const unsubscribe = auth.onAuthStateChanged(
      async (firebaseUser) => {
        console.log(
          "🔐 Auth 상태 변경:",
          firebaseUser?.uid
            ? `로그인됨 (${firebaseUser.uid.slice(-8)})`
            : "로그아웃됨"
        );

        setUser(firebaseUser);
        setIsAuthReady(true);
        setError(null);

        if (!firebaseUser && loading) {
          console.log("🔄 첫 실행 로그아웃 상태, 자동 로그인 시도...");
          await attemptAutoLogin();
        }

        setLoading(false);
      },
      (authError) => {
        console.error("❌ Auth 리스너 오류:", authError);
        setError(authError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []); // Google 로그인

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🚀 Google 로그인 시작...");

      await GoogleSignin.hasPlayServices(); // 🔧 [수정] v13 반환 타입 처리 (제안해주신 로직)
      const signInResult: SignInResponse = await GoogleSignin.signIn(); // 🔧 [수정] "data"가 있는지 확인 (성공 여부)
      if (signInResult && "data" in signInResult) {
        const userResponse = signInResult.data; // userResponse는 GoogleUser 타입 // 🔧 [수정] getTokens()로 idToken 별도 요청
        const { idToken } = await GoogleSignin.getTokens();
        if (idToken) {
          await authenticateWithFirebase(idToken);
          console.log("✅ Google 로그인 완료");
        } else {
          throw new Error("Google 로그인 후 idToken을 받지 못했습니다");
        }
      } else {
        // "data"가 없는 경우는 사용자가 취소했거나 오류가 발생한 경우입니다.
        // catch 블록에서 처리되므로 여기서는 별도 처리가 필요 없습니다.
        // (signInResult.type === 'cancel' 등)
        throw new Error("Google 로그인에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("❌ Google 로그인 실패:", error.code, error.message);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        setError("로그인이 취소되었습니다");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        setError("이미 로그인 진행 중입니다");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services를 사용할 수 없습니다");
      } else {
        setError(error.message || "로그인 실패");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }; // 로그아웃

  const logout = async () => {
    try {
      setLoading(true);
      console.log("👋 로그아웃 시작...");

      await GoogleSignin.signOut();
      console.log("📱 Google 로그아웃 완료"); // 🔧 수정: auth.signOut (compat 방식)

      await auth.signOut();
      console.log("🔥 Firebase 로그아웃 완료");

      console.log("✅ 로그아웃 완료");
    } catch (error: any) {
      console.error("❌ 로그아웃 실패:", error);
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
        error,
      }}
    >{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const getUserId = (user: User | null): string => {
  if (!user?.uid) {
    throw new Error("사용자가 로그인되지 않았습니다");
  }
  return user.uid;
};