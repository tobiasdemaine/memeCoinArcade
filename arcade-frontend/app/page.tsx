'use client';

import { useEffect, useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { GameAPI } from 'arcade-api/dist';
import { Button, Container, Select, Stack, Table, Text, Title } from '@mantine/core';

interface Game {
  id: string;
  name: string;
  path: string;
}

export default function ArcadeHome() {
  const { open } = useAppKit();
  const { publicKey, connected, signTransaction } = useWallet();
  const gameApi = new GameAPI(
    process.env.NEXT_PUBLIC_PROGRAM_ID || '',
    process.env.NEXT_PUBLIC_SOLANA_RPC || ''
  );
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [highScores, setHighScores] = useState<{ player: string; score: bigint }[]>([]);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [costToPlay, setCostToPlay] = useState<bigint | null>(null);

  // Hardcoded token mint for now; replace with actual mint address or fetch from game state
  const tokenMint = new PublicKey('7xKXLY1R43KxHP5N8KkzXBSYCQN4xSQiPZ6Zw7Xc2unW'); // Example mint (Devnet USDC)

  // Load games from JSON file
  useEffect(() => {
    fetch('/games/games.json')
      .then((res) => res.json())
      .then((data: Game[]) => setGames(data))
      .catch((err) => console.error('Error loading games:', err));
  }, []);

  // Load game state when a game is selected
  useEffect(() => {
    if (selectedGame && connected && publicKey) {
      const gameId = new PublicKey(selectedGame);
      gameApi
        .getGameState(gameId)
        .then((state) => {
          setHighScores(
            state.highScores.map(({ player, score }) => ({
              player: player.toBase58(),
              score,
            }))
          );
          setCostToPlay(state.costToPlay);
        })
        .catch((err) => console.error('Error loading game state:', err));
    }
  }, [selectedGame, connected, publicKey]);

  // Handle payment and start game
  const payToPlay = async () => {
    if (!connected || !publicKey || !selectedGame || !signTransaction) {
      await open();
      return;
    }
    try {
      const gameId = new PublicKey(selectedGame);
      const signature = await gameApi.startGame(
        {
          publicKey,
          signTransaction: async (tx: Transaction) => {
            const signedTx = await signTransaction(tx);
            return signedTx;
          },
        },
        gameId,
        tokenMint // Pass token mint for payer token account derivation
      );
      console.log('Game started with payment, Signature:', signature);
      setGameStarted(true); // Enable gameplay after payment
    } catch (error) {
      console.error('Error paying to play:', error);
    }
  };

  // Handle game score submission
  const submitScore = async (score: number) => {
    if (!connected || !publicKey || !selectedGame || !signTransaction) {
      await open();
      return;
    }
    try {
      const gameId = new PublicKey(selectedGame);
      const hash = Buffer.from(new Uint8Array(32)).toString('base64'); // Placeholder hash
      const signature = await gameApi.submitScore(gameId, BigInt(score), hash, {
        publicKey,
        signTransaction: async (tx: Transaction) => {
          const signedTx = await signTransaction(tx);
          return signedTx;
        },
      });
      console.log('Score submitted:', score, 'Signature:', signature);
      await fetchHighScores(gameId); // Refresh high scores
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  const fetchHighScores = async (gameId: PublicKey) => {
    const state = await gameApi.getGameState(gameId);
    setHighScores(
      state.highScores.map(({ player, score }) => ({
        player: player.toBase58(),
        score,
      }))
    );
  };

  // Handle game score submission from the embedded game
  useEffect(() => {
    const handleScoreSubmit = (event: MessageEvent) => {
      if (event.data.type === 'submitScore') {
        setCurrentScore(event.data.score);
        submitScore(event.data.score);
      }
    };
    window.addEventListener('message', handleScoreSubmit);
    return () => window.removeEventListener('message', handleScoreSubmit);
  }, [connected, publicKey, selectedGame, signTransaction, gameStarted]);

  return (
    <Container size="lg" style={{ minHeight: '100vh', padding: '20px' }}>
      <Stack align="center" gap="lg">
        <Title order={1}>MemeCoinArcade</Title>
        <Button onClick={() => open()} color="blue">
          {connected && publicKey
            ? `Connected: ${publicKey.toBase58().slice(0, 6)}...`
            : 'Connect Wallet'}
        </Button>

        <Select
          label="Select Game"
          placeholder="Choose a game"
          value={selectedGame}
          onChange={(value) => {
            setSelectedGame(value);
            setGameStarted(false); // Reset game state on selection
          }}
          data={games.map((game) => ({ value: game.id, label: game.name }))}
          style={{ width: '300px' }}
        />

        {selectedGame && (
          <>
            {costToPlay !== null && !gameStarted && (
              <Stack align="center" gap="md">
                <Text>Cost to Play: {costToPlay.toString()} tokens</Text>
                <Button onClick={payToPlay} color="green">
                  Pay to Play
                </Button>
              </Stack>
            )}
            {gameStarted && (
              <>
                <iframe
                  src={`/games/${games.find((g) => g.id === selectedGame)?.path}/index.html`}
                  style={{ width: '800px', height: '600px', border: 'none' }}
                  title="Game Canvas"
                />
                <Text>Current Score: {currentScore}</Text>
                <Table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highScores.map((entry, index) => (
                      <tr key={index}>
                        <td>{entry.player.slice(0, 6)}...</td>
                        <td>{entry.score.toString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
