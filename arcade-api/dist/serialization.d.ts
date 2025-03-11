import { PublicKey } from "@solana/web3.js";
import { GameState, GameRegistry } from "./types";
export declare function u64FromBuffer(buffer: Buffer): bigint;
export declare function deserializeSessions(data: Buffer): Array<{
    player: PublicKey;
    hash: Buffer;
    timestamp: bigint;
}>;
export declare function deserializeGameState(data: Buffer): GameState;
export declare function deserializeGameRegistry(data: Buffer): GameRegistry;
