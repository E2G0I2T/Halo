//lib/ types/song.ts
export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

// SongList.tsx에서 사용하던 기존 타입 업데이트
export type SongItem = {
  type: "song";
  key: string;
} & Song;