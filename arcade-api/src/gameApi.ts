import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export class GameAPI {
  private connection: Connection;
  private programId: PublicKey;

  constructor(programId: string, rpcUrl: string) {
    this.programId = new PublicKey(programId);
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  async deriveGameStatePDA(gameId: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("game_state"), gameId.toBuffer()],
      this.programId
    );
    return pda;
  }

  async deriveRegistryPDA(): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("registry")],
      this.programId
    );
    return pda;
  }

  async getGameState(gameId: PublicKey): Promise<{
    admin: PublicKey;
    highScores: { player: PublicKey; score: bigint }[];
    gameCount: bigint;
    prizePool: bigint;
    tokenAccount: PublicKey;
    costToPlay: bigint;
    minTimeSeconds: number;
    activeSessions: { player: PublicKey; hash: string; startTime: bigint }[];
    isInitialized: boolean;
    gameName: string;
  }> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const accountInfo = await this.connection.getAccountInfo(gameStateAccount);
    if (!accountInfo || !accountInfo.data) {
      throw new Error("Game state account not found");
    }

    // Manual deserialization based on Rust struct layout
    let offset = 0;
    const admin = new PublicKey(accountInfo.data.slice(offset, offset + 32));
    offset += 32;
    const highScores = [];
    for (let i = 0; i < 20; i++) {
      const player = new PublicKey(accountInfo.data.slice(offset, offset + 32));
      offset += 32;
      const score = BigInt(
        Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(
          0
        )
      );
      offset += 8;
      highScores.push({ player, score });
    }
    const gameCount = BigInt(
      Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0)
    );
    offset += 8;
    const prizePool = BigInt(
      Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0)
    );
    offset += 8;
    const tokenAccount = new PublicKey(
      accountInfo.data.slice(offset, offset + 32)
    );
    offset += 32;
    const costToPlay = BigInt(
      Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(0)
    );
    offset += 8;
    const minTimeSeconds = Buffer.from(
      accountInfo.data.slice(offset, offset + 4)
    ).readUInt32LE(0);
    offset += 4;
    const sessionsLen = Buffer.from(
      accountInfo.data.slice(offset, offset + 4)
    ).readUInt32LE(0);
    offset += 4;
    const activeSessions = [];
    for (let i = 0; i < sessionsLen; i++) {
      const player = new PublicKey(accountInfo.data.slice(offset, offset + 32));
      offset += 32;
      const hash = Buffer.from(
        accountInfo.data.slice(offset, offset + 32)
      ).toString("base64");
      offset += 32;
      const startTime = BigInt(
        Buffer.from(accountInfo.data.slice(offset, offset + 8)).readBigUInt64LE(
          0
        )
      );
      offset += 8;
      activeSessions.push({ player, hash, startTime });
    }
    const isInitialized = accountInfo.data[offset] !== 0;
    offset += 1;
    const nameLen = Buffer.from(
      accountInfo.data.slice(offset, offset + 4)
    ).readUInt32LE(0);
    offset += 4;
    const gameName = Buffer.from(
      accountInfo.data.slice(offset, offset + nameLen)
    ).toString("utf8");

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

  async initialize(
    player: {
      publicKey: PublicKey;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    },
    gameId: PublicKey,
    admin: PublicKey,
    tokenAccount: PublicKey,
    gameName: string
  ): Promise<string> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const registryAccount = await this.deriveRegistryPDA();

    const data = Buffer.concat([
      Buffer.from([0]), // Instruction index
      admin.toBuffer(),
      tokenAccount.toBuffer(),
      Buffer.from(Uint32Array.of(gameName.length).buffer),
      Buffer.from(gameName),
    ]);

    const tx = new Transaction().add({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
        { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // COS (placeholder)
        { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Payer token (unused here)
      ],
      programId: this.programId,
      data,
    });

    const signedTx = await player.signTransaction(tx);
    return await this.connection.sendRawTransaction(signedTx.serialize());
  }

  async startGame(
    player: {
      publicKey: PublicKey;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    },
    gameId: PublicKey,
    tokenMint: PublicKey // Added to dynamically derive payer's token account
  ): Promise<string> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const registryAccount = await this.deriveRegistryPDA();
    const gameState = await this.getGameState(gameId);
    const tokenAccount = gameState.tokenAccount;
    const payerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      player.publicKey
    );

    const tx = new Transaction();

    if (gameState.costToPlay > 0) {
      tx.add(
        createTransferInstruction(
          payerTokenAccount,
          tokenAccount,
          player.publicKey,
          Number(gameState.costToPlay),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    tx.add({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
        { pubkey: tokenAccount, isSigner: false, isWritable: true }, // Token account
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // COS
        { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
        { pubkey: payerTokenAccount, isSigner: false, isWritable: true }, // Payer token
      ],
      programId: this.programId,
      data: Buffer.from([1]), // StartGame instruction
    });

    const signedTx = await player.signTransaction(tx);
    return await this.connection.sendRawTransaction(signedTx.serialize());
  }

  async submitScore(
    gameId: PublicKey,
    score: bigint,
    hash: string,
    player: {
      publicKey: PublicKey;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    }
  ): Promise<string> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const registryAccount = await this.deriveRegistryPDA();
    const gameState = await this.getGameState(gameId);
    const tokenAccount = gameState.tokenAccount;
    const payerTokenAccount = PublicKey.default; // Not used in SubmitScore

    const scoreBuffer = Buffer.alloc(8);
    scoreBuffer.writeBigUInt64LE(score);
    const hashBuffer = Buffer.from(hash, "base64");

    const data = Buffer.concat([
      Buffer.from([2]), // Instruction index
      scoreBuffer,
      hashBuffer,
    ]);

    const tx = new Transaction().add({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
        { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // COS
        { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
        { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
      ],
      programId: this.programId,
      data,
    });

    const signedTx = await player.signTransaction(tx);
    return await this.connection.sendRawTransaction(signedTx.serialize());
  }

  async updateCost(
    player: {
      publicKey: PublicKey;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    },
    gameId: PublicKey,
    newCost: bigint
  ): Promise<string> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const registryAccount = await this.deriveRegistryPDA();
    const gameState = await this.getGameState(gameId);
    const tokenAccount = gameState.tokenAccount;
    const payerTokenAccount = PublicKey.default;

    const costBuffer = Buffer.alloc(8);
    costBuffer.writeBigUInt64LE(newCost);

    const data = Buffer.concat([
      Buffer.from([3]), // Instruction index
      costBuffer,
    ]);

    const tx = new Transaction().add({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: gameStateAccount, isSigner: false, isWritable: true }, // Game state
        { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // COS
        { pubkey: registryAccount, isSigner: false, isWritable: false }, // Registry
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
        { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
      ],
      programId: this.programId,
      data,
    });

    const signedTx = await player.signTransaction(tx);
    return await this.connection.sendRawTransaction(signedTx.serialize());
  }

  async getGameRegistry(): Promise<{
    games: { gameId: PublicKey; gameName: string }[];
  }> {
    const registryAccount = await this.deriveRegistryPDA();
    const accountInfo = await this.connection.getAccountInfo(registryAccount);
    if (!accountInfo || !accountInfo.data) {
      return { games: [] }; // Return empty if uninitialized
    }

    let offset = 0;
    const gameCount = Buffer.from(
      accountInfo.data.slice(offset, offset + 4)
    ).readUInt32LE(0);
    offset += 4;
    const games = [];
    for (let i = 0; i < gameCount; i++) {
      const gameId = new PublicKey(accountInfo.data.slice(offset, offset + 32));
      offset += 32;
      const nameLen = Buffer.from(
        accountInfo.data.slice(offset, offset + 4)
      ).readUInt32LE(0);
      offset += 4;
      const gameName = Buffer.from(
        accountInfo.data.slice(offset, offset + nameLen)
      ).toString("utf8");
      offset += nameLen;
      games.push({ gameId, gameName });
    }

    return { games };
  }

  async addGame(
    player: {
      publicKey: PublicKey;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    },
    gameId: PublicKey,
    gameName: string
  ): Promise<string> {
    const gameStateAccount = await this.deriveGameStatePDA(gameId);
    const registryAccount = await this.deriveRegistryPDA();
    const gameState = await this.getGameState(gameId);
    const tokenAccount = gameState.tokenAccount;
    const payerTokenAccount = PublicKey.default;

    const data = Buffer.concat([
      Buffer.from([4]), // Instruction index
      gameId.toBuffer(),
      Buffer.from(Uint32Array.of(gameName.length).buffer),
      Buffer.from(gameName),
    ]);

    const tx = new Transaction().add({
      keys: [
        { pubkey: player.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: gameStateAccount, isSigner: false, isWritable: false }, // Game state
        { pubkey: tokenAccount, isSigner: false, isWritable: false }, // Token account
        { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // COS
        { pubkey: registryAccount, isSigner: false, isWritable: true }, // Registry
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token
        { pubkey: payerTokenAccount, isSigner: false, isWritable: false }, // Payer token
      ],
      programId: this.programId,
      data,
    });

    const signedTx = await player.signTransaction(tx);
    return await this.connection.sendRawTransaction(signedTx.serialize());
  }
}
