import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCGWf9IRNzyR_izaO9lapdq0WJQtdFmHs4",
  authDomain: "music-recommend-f68fa.firebaseapp.com",
  projectId: "music-recommend-f68fa",
  storageBucket: "music-recommend-f68fa.appspot.com",
  messagingSenderId: "9597600331",
  appId: "1:9597600331:web:16634e7e625deb0effc3ce"
};

let app;
if (firebase.apps.length === 0) {
  app = firebase.initializeApp(firebaseConfig);
  console.log('🔥 Firebase 앱 초기화됨 (compat)');
} else {
  app = firebase.app();
  console.log('🔥 기존 Firebase 앱 사용 (compat)');
}

const auth = firebase.auth();
console.log('✅ Firebase Auth 초기화됨 (compat)');

const db = firebase.firestore();
console.log('✅ Firestore 초기화됨 (compat)');

const functions = app.functions('us-central1');
console.log('✅ Firebase Functions 초기화됨 (compat)');

export { auth, db, functions, firebase };
export default app;