import { PublicKey } from "@solana/web3.js";

export interface GameState {
  admin: PublicKey;
  highScores: Array<{ player: PublicKey; score: bigint }>;
  gameCount: bigint;
  prizePool: bigint;
  tokenAccount: PublicKey;
  cosAccount: PublicKey;
  costToPlay: bigint;
  minTimeSeconds: number;
  activeSessions: Array<{ player: PublicKey; hash: Buffer; timestamp: bigint }>;
  isInitialized: boolean;
  gameName: string;
}

export interface GameRegistry {
  games: Array<{ gameId: PublicKey; gameName: string }>;
}
