//lib/ types/song.ts
export interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

export type SongItem = {
  type: "song";
  key: string;
} & Song;