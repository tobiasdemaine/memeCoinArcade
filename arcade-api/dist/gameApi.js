"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameAPI = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
class GameAPI {
    constructor(programId, rpcUrl) {
        this.programId = new web3_js_1.PublicKey(programId);
        this.connection = new web3_js_1.Connection(rpcUrl, "confirmed");
    }
    async deriveGameStatePDA(gameId) {
        const [pda] = await web3_js_1.PublicKey.findProgramAddress([Buffer.from("game_state"), gameId.toBuffer()], this.programId);
        return pda;
    }
    async deriveRegistryPDA() {
        const [pda] = await web3_js_1.PublicKey.findProgramAddress([Buffer.from("registry")], this.programId);
        return pda;
    }
    async getGameState(gameId) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const accountInfo = await this.connection.getAccountInfo(gameStateAccount);
        if (!accountInfo || !accountInfo.data) {
            throw new Error("Game state account not found");
        }
        // Manual deserialization based on Rust struct layout
        let offset = 0;
        const admin = new web3_js_1.PublicKey(accountInfo.data.slice(offset, offset + 32));
        offset += 32;
        const highScores = [];
        for (let i = 0; i < 20; i++) {
            const player = new web3_js_1.PublicKey(accountInfo.data.slice(offset, offset + 32));
            offset += 32;
            const score = BigInt(Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0));
            offset += 8;
            highScores.push({ player, score });
        }
        const gameCount = BigInt(Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0));
        offset += 8;
        const prizePool = BigInt(Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0));
        offset += 8;
        const tokenAccount = new web3_js_1.PublicKey(accountInfo.data.slice(offset, offset + 32));
        offset += 32;
        const costToPlay = BigInt(Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0));
        offset += 8;
        const minTimeSeconds = Buffer.from(accountInfo.data.slice(offset, offset + 4)).readUInt32LE(0);
        offset += 4;
        const sessionsLen = Buffer.from(accountInfo.data.slice(offset, offset + 4)).readUInt32LE(0);
        offset += 4;
        const activeSessions = [];
        for (let i = 0; i < sessionsLen; i++) {
            const player = new web3_js_1.PublicKey(accountInfo.data.slice(offset, offset + 32));
            offset += 32;
            const hash = Buffer.from(accountInfo.data.slice(offset, offset + 32)).toString("base64");
            offset += 32;
            const startTime = BigInt(Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0));
            offset += 8;
            activeSessions.push({ player, hash, startTime });
        }
        const isInitialized = accountInfo.data[offset] !== 0;
        offset += 1;
        const nameLen = Buffer.from(accountInfo.data.slice(offset, offset + 4)).readUInt32LE(0);
        offset += 4;
        const gameName = Buffer.from(accountInfo.data.slice(offset, offset + nameLen)).toString("utf8");
        return {
            admin,
            highScores,
            gameCount,
            prizePool,
            tokenAccount,
            costToPlay,
            minTimeSeconds,
            activeSessions,
            isInitialized,
            gameName,
        };
    }
    async initialize(player, gameId, admin, tokenAccount, gameName) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const registryAccount = await this.deriveRegistryPDA();
        const data = Buffer.concat([
            Buffer.from([0]), // Instruction index
            admin.toBuffer(),
            tokenAccount.toBuffer(),
            Buffer.from(Uint32Array.of(gameName.length).buffer),
            Buffer.from(gameName),
        ]);
        const tx = new web3_js_1.Transaction().add({
            keys: [
                { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
                { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // COS (placeholder)
                { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // System
                { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // Payer token (unused here)
            ],
            programId: this.programId,
            data,
        });
        const signedTx = await player.signTransaction(tx);
        return await this.connection.sendRawTransaction(signedTx.serialize());
    }
    async startGame(player, gameId, tokenMint // Added to dynamically derive payer's token account
    ) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const registryAccount = await this.deriveRegistryPDA();
        const gameState = await this.getGameState(gameId);
        const tokenAccount = gameState.tokenAccount;
        const payerTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, player.publicKey);
        const tx = new web3_js_1.Transaction();
        if (gameState.costToPlay > 0) {
            tx.add((0, spl_token_1.createTransferInstruction)(payerTokenAccount, tokenAccount, player.publicKey, Number(gameState.costToPlay), [], spl_token_1.TOKEN_PROGRAM_ID));
        }
        tx.add({
            keys: [
                { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
                { pubkey: tokenAccount, isSigner: false, isWritable: true }, // Token account
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // COS
                { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // System
                { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
                { pubkey: payerTokenAccount, isSigner: false, isWritable: true }, // Payer token
            ],
            programId: this.programId,
            data: Buffer.from([1]), // StartGame instruction
        });
        const signedTx = await player.signTransaction(tx);
        return await this.connection.sendRawTransaction(signedTx.serialize());
    }
    async submitScore(gameId, score, hash, player) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const registryAccount = await this.deriveRegistryPDA();
        const gameState = await this.getGameState(gameId);
        const tokenAccount = gameState.tokenAccount;
        const payerTokenAccount = web3_js_1.PublicKey.default; // Not used in SubmitScore
        const scoreBuffer = Buffer.alloc(8);
        scoreBuffer.writeBigUInt64LE(score);
        const hashBuffer = Buffer.from(hash, "base64");
        const data = Buffer.concat([
            Buffer.from([2]), // Instruction index
            scoreBuffer,
            hashBuffer,
        ]);
        const tx = new web3_js_1.Transaction().add({
            keys: [
                { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
                { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // COS
                { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // System
                { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
                { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
            ],
            programId: this.programId,
            data,
        });
        const signedTx = await player.signTransaction(tx);
        return await this.connection.sendRawTransaction(signedTx.serialize());
    }
    async updateCost(player, gameId, newCost) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const registryAccount = await this.deriveRegistryPDA();
        const gameState = await this.getGameState(gameId);
        const tokenAccount = gameState.tokenAccount;
        const payerTokenAccount = web3_js_1.PublicKey.default;
        const costBuffer = Buffer.alloc(8);
        costBuffer.writeBigUInt64LE(newCost);
        const data = Buffer.concat([
            Buffer.from([3]), // Instruction index
            costBuffer,
        ]);
        const tx = new web3_js_1.Transaction().add({
            keys: [
                { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
                { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // COS
                { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // System
                { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
                { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
            ],
            programId: this.programId,
            data,
        });
        const signedTx = await player.signTransaction(tx);
        return await this.connection.sendRawTransaction(signedTx.serialize());
    }
    async getGameRegistry() {
        const registryAccount = await this.deriveRegistryPDA();
        const accountInfo = await this.connection.getAccountInfo(registryAccount);
        if (!accountInfo || !accountInfo.data) {
            return { games: [] }; // Return empty if uninitialized
        }
        let offset = 0;
        const gameCount = Buffer.from(accountInfo.data.slice(offset, offset + 4)).readUInt32LE(0);
        offset += 4;
        const games = [];
        for (let i = 0; i < gameCount; i++) {
            const gameId = new web3_js_1.PublicKey(accountInfo.data.slice(offset, offset + 32));
            offset += 32;
            const nameLen = Buffer.from(accountInfo.data.slice(offset, offset + 4)).readUInt32LE(0);
            offset += 4;
            const gameName = Buffer.from(accountInfo.data.slice(offset, offset + nameLen)).toString("utf8");
            offset += nameLen;
            games.push({ gameId, gameName });
        }
        return { games };
    }
    async addGame(player, gameId, gameName) {
        const gameStateAccount = await this.deriveGameStatePDA(gameId);
        const registryAccount = await this.deriveRegistryPDA();
        const gameState = await this.getGameState(gameId);
        const tokenAccount = gameState.tokenAccount;
        const payerTokenAccount = web3_js_1.PublicKey.default;
        const data = Buffer.concat([
            Buffer.from([4]), // Instruction index
            gameId.toBuffer(),
            Buffer.from(Uint32Array.of(gameName.length).buffer),
            Buffer.from(gameName),
        ]);
        const tx = new web3_js_1.Transaction().add({
            keys: [
                { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
                { pubkey: gameStateAccount, isSigner: false, isWritable: false }, // Game state
                { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
                { pubkey: web3_js_1.PublicKey.default, isSigner: false, isWritable: false }, // COS
                { pubkey: registryAccount, isSigner: false, isWritable: true }, // Registry
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // System
                { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
                { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
            ],
            programId: this.programId,
            data,
        });
        const signedTx = await player.signTransaction(tx);
        return await this.connection.sendRawTransaction(signedTx.serialize());
    }
}
exports.GameAPI = GameAPI;
