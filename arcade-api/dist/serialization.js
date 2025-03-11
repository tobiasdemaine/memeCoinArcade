"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.u64FromBuffer = u64FromBuffer;
exports.deserializeSessions = deserializeSessions;
exports.deserializeGameState = deserializeGameState;
exports.deserializeGameRegistry = deserializeGameRegistry;
const web3_js_1 = require("@solana/web3.js");
function u64FromBuffer(buffer) {
    return BigInt(buffer.readUIntLE(0, 8));
}
function deserializeSessions(data) {
    let offset = 0;
    const sessions = [];
    while (offset < data.length) {
        const player = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const hash = data.slice(offset, offset + 32);
        offset += 32;
        const timestamp = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
        offset += 8;
        sessions.push({ player, hash, timestamp });
    }
    return sessions;
}
function deserializeGameState(data) {
    let offset = 0;
    const admin = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const highScores = Array(20)
        .fill(null)
        .map((_, i) => {
        const player = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const score = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
        offset += 8;
        return { player, score };
    });
    const gameCount = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
    offset += 8;
    const prizePool = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
    offset += 8;
    const tokenAccount = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const cosAccount = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const costToPlay = BigInt(u64FromBuffer(data.slice(offset, offset + 8)));
    offset += 8;
    const minTimeSeconds = data.readUInt32LE(offset);
    offset += 4;
    const sessionsLen = data.readUInt32LE(offset);
    offset += 4;
    const activeSessions = sessionsLen > 0
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
function deserializeGameRegistry(data) {
    let offset = 0;
    const gameCount = data.readUInt32LE(offset);
    offset += 4;
    const games = [];
    for (let i = 0; i < gameCount; i++) {
        const gameId = new web3_js_1.PublicKey(data.subarray(offset, offset + 32));
        offset += 32;
        const nameLen = data.readUInt32LE(offset);
        offset += 4;
        const gameName = data.toString("utf8", offset, offset + nameLen);
        offset += nameLen;
        games.push({ gameId, gameName });
    }
    return { games };
}
