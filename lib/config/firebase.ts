import firebase from 'firebase/compat/app';
import 'firebase/compat/auth'; // 🔧 수정: auth compat 임포트
import 'firebase/compat/firestore'; // 🔧 수정: firestore compat 임포트
import 'firebase/compat/functions'; // 🔧 수정: functions compat 임포트
// 🔧 수정: RN Async Storage는 auth가 자동으로 감지하므로 여기서 임포트할 필요 없습니다.

const firebaseConfig = {
  apiKey: "AIzaSyCGWf9IRNzyR_izaO9lapdq0WJQtdFmHs4",
  authDomain: "music-recommend-f68fa.firebaseapp.com",
  projectId: "music-recommend-f68fa",
  storageBucket: "music-recommend-f68fa.appspot.com",
  messagingSenderId: "9597600331",
  appId: "1:9597600331:web:16634e7e625deb0effc3ce"
};

let app;
if (firebase.apps.length === 0) { // 🔧 수정: firebase.apps로 변경
  app = firebase.initializeApp(firebaseConfig); // 🔧 수정: firebase.initializeApp
  console.log('🔥 Firebase 앱 초기화됨 (compat)');
} else {
  app = firebase.app(); // 🔧 수정: firebase.app()
  console.log('🔥 기존 Firebase 앱 사용 (compat)');
}

// 🔐 Auth 초기화 (Compat)
// React Native 환경에서는 compat이 자동으로 AsyncStorage를 사용합니다.
const auth = firebase.auth();
console.log('✅ Firebase Auth 초기화됨 (compat)');

// 🗄️ Firestore 초기화 (Compat)
const db = firebase.firestore();
console.log('✅ Firestore 초기화됨 (compat)');

// 🚀 Functions 초기화 (Compat)
const functions = app.functions('us-central1');
console.log('✅ Firebase Functions 초기화됨 (compat)');

export { auth, db, functions, firebase }; // 🔧 수정: firebase 객체도 내보내기
export default app;