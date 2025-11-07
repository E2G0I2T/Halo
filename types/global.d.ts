// types/global.d.ts (확장된 버전)

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: any;
  export default AsyncStorage;
}

// Firebase 타입 문제 해결
declare module 'firebase/auth' {
  export const getAuth: any;
  export const initializeAuth: any;
  export const signInAnonymously: any;
  export const onAuthStateChanged: any;
  export const signOut: any;
  export type User = any;
}

declare module 'firebase/firestore' {
  export const getFirestore: any;
  export const doc: any;
  export const setDoc: any;
  export const getDoc: any;
  export const collection: any;
  export const query: any;
  export const where: any;
  export const getDocs: any;
  export const serverTimestamp: any;
  export const writeBatch: any;
}

declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
}