import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth
} from 'firebase/auth'; 
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCGWf9IRNzyR_izaO9lapdq0WJQtdFmHs4",
  authDomain: "music-recommend-f68fa.firebaseapp.com",
  projectId: "music-recommend-f68fa",
  storageBucket: "music-recommend-f68fa.appspot.com",
  messagingSenderId: "9597600331",
  appId: "1:9597600331:web:16634e7e625deb0effc3ce"
};

// 🔥 중복 초기화 방지
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('🔥 Firebase 앱 초기화됨');
} else {
  app = getApps()[0];
  console.log('🔥 기존 Firebase 앱 사용');
}

// 🔐 Auth 초기화
const auth = getAuth(app);
console.log('✅ Firebase Auth 초기화됨');

// 🗄️ Firestore 초기화
const db = getFirestore(app);
console.log('✅ Firestore 초기화됨');

// 🚀 Functions 초기화
const functions = getFunctions(app, 'us-central1');
console.log('✅ Firebase Functions 초기화됨');

export { auth, db, functions };
export default app;