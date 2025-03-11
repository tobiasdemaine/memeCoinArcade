import { PublicKey, Transaction } from "@solana/web3.js";
export declare class GameAPI {
    private connection;
    private programId;
    constructor(programId: string, rpcUrl: string);
    deriveGameStatePDA(gameId: PublicKey): Promise<PublicKey>;
    deriveRegistryPDA(): Promise<PublicKey>;
    getGameState(gameId: PublicKey): Promise<{
        admin: PublicKey;
        highScores: {
            player: PublicKey;
            score: bigint;
        }[];
        gameCount: bigint;
        prizePool: bigint;
        tokenAccount: PublicKey;
        costToPlay: bigint;
        minTimeSeconds: number;
        activeSessions: {
            player: PublicKey;
            hash: string;
            startTime: bigint;
        }[];
        isInitialized: boolean;
        gameName: string;
    }>;
    initialize(player: {
        publicKey: PublicKey;
        signTransaction: (tx: Transaction) => Promise<Transaction>;
    }, gameId: PublicKey, admin: PublicKey, tokenAccount: PublicKey, gameName: string): Promise<string>;
    startGame(player: {
        publicKey: PublicKey;
        signTransaction: (tx: Transaction) => Promise<Transaction>;
    }, gameId: PublicKey, tokenMint: PublicKey): Promise<string>;
    submitScore(gameId: PublicKey, score: bigint, hash: string, player: {
        publicKey: PublicKey;
        signTransaction: (tx: Transaction) => Promise<Transaction>;
    }): Promise<string>;
    updateCost(player: {
        publicKey: PublicKey;
        signTransaction: (tx: Transaction) => Promise<Transaction>;
    }, gameId: PublicKey, newCost: bigint): Promise<string>;
    getGameRegistry(): Promise<{
        games: {
            gameId: PublicKey;
            gameName: string;
        }[];
    }>;
    addGame(player: {
        publicKey: PublicKey;
        signTransaction: (tx: Transaction) => Promise<Transaction>;
    }, gameId: PublicKey, gameName: string): Promise<string>;
}
