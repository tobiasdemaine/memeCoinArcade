import { PublicKey } from "@solana/web3.js";
import { GameState, GameRegistry } from "./types";

export function u64FromBuffer(buffer: Buffer): bigint {
  return BigInt(buffer.readUIntLE(0, 8));
}

export function deserializeSessions(
  data: Buffer
): Array<{ player: PublicKey; hash: Buffer; timestamp: bigint }> {
  let offset = 0;
  const sessions: Array<{
    player: PublicKey;
    hash: Buffer;
    timestamp: bigint;
  }> = [];
  while (offset < data.length) {
    const player = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const hash = data.slice(offset, offset + 32);
    offset += 32;
    const timestamp = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
    offset += 8;
    sessions.push({ player, hash, timestamp });
  }
  return sessions;
}

export function deserializeGameState(data: Buffer): GameState {
  let offset = 0;
  const admin = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const highScores = Array(20)
    .fill(null)
    .map((_, i) => {
      const player = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      const score = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
      offset += 8;
      return { player, score };
    });
  const gameCount = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
  offset += 8;
  const prizePool = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
  offset += 8;
  const tokenAccount = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const cosAccount = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const costToPlay = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
  offset += 8;
  const minTimeSeconds = data.readUInt32LE(offset);
  offset += 4;
  const sessionsLen = data.readUInt32LE(offset);
  offset += 4;
  const activeSessions =
    sessionsLen > 0
      ? deserializeSessions(data.slice(offset, offset + sessionsLen))
      : [];
  offset += sessionsLen;
  const isInitialized = data[offset] !== 0;
  offset += 1;
  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const gameName = data.toString("utf8", offset, offset + nameLen);

  return {
    admin,
    highScores,
    gameCount,
    prizePool,
    tokenAccount,
    cosAccount,
    costToPlay,
    minTimeSeconds,
    activeSessions,
    isInitialized,
    gameName,
  };
}

export function deserializeGameRegistry(data: Buffer): GameRegistry {
  let offset = 0;
  const gameCount = data.readUInt32LE(offset);
  offset += 4;
  const games = [];
  for (let i = 0; i < gameCount; i++) {
    const gameId = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const gameName = data.toString("utf8", offset, offset + nameLen);
    offset += nameLen;
    games.push({ gameId, gameName });
  }
  return { games };
}
