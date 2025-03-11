'use client';

import { useEffect, useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
// import { useAppDispatch, useAppSelector } from '@/store';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { GameAPI } from 'arcade-api/dist';
import {
  Button,
  Container,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

export default function App() {
  return <AdminDashboard />;
}
export function AdminDashboard() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { open } = useAppKit();
  const gameApi = new GameAPI(
    process.env.NEXT_PUBLIC_PROGRAM_ID || '',
    process.env.NEXT_PUBLIC_SOLANA_RPC || ''
  );

  // State for admin actions
  const [gameId, setGameId] = useState('');
  const [gameName, setGameName] = useState('');
  const [tokenAccount, setTokenAccount] = useState('');
  const [newCost, setNewCost] = useState<number | ''>('');
  const [status, setStatus] = useState('');
  const [games, setGames] = useState<{ gameId: PublicKey; gameName: string }[]>([]);

  // Fetch games on load
  useEffect(() => {
    if (connected && publicKey) {
      gameApi
        .getGameRegistry()
        .then((registry) => setGames(registry.games))
        .catch((err) => setStatus(`Error fetching games: ${err.message}`));
    }
  }, [connected, publicKey]);

  const handleInitialize = async () => {
    if (!connected || !publicKey || !signTransaction) {
      await open();
      return;
    }
    try {
      const gameIdPubkey = new PublicKey(gameId);
      const tokenAccountPubkey = new PublicKey(tokenAccount);
      const signature = await gameApi.initialize(
        { publicKey, signTransaction: async (tx: Transaction) => await signTransaction(tx) },
        gameIdPubkey,
        publicKey, // Admin is the payer
        tokenAccountPubkey,
        gameName
      );
      setStatus(`Game initialized: ${signature}`);
      // Refresh game list
      const registry = await gameApi.getGameRegistry();
      setGames(registry.games);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatus(`Error: ${errMsg}`);
    }
  };

  const handleUpdateCost = async () => {
    if (!connected || !publicKey || !signTransaction || newCost === '') {
      await open();
      return;
    }
    try {
      const gameIdPubkey = new PublicKey(gameId);
      const signature = await gameApi.updateCost(
        { publicKey, signTransaction: async (tx: Transaction) => await signTransaction(tx) },
        gameIdPubkey,
        BigInt(newCost)
      );
      setStatus(`Cost updated: ${signature}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatus(`Error: ${errMsg}`);
    }
  };

  const handleAddGame = async () => {
    if (!connected || !publicKey || !signTransaction) {
      await open();
      return;
    }
    try {
      const gameIdPubkey = new PublicKey(gameId);
      const signature = await gameApi.addGame(
        { publicKey, signTransaction: async (tx: Transaction) => await signTransaction(tx) },
        gameIdPubkey,
        gameName
      );
      setStatus(`Game added to registry: ${signature}`);
      // Refresh game list
      const registry = await gameApi.getGameRegistry();
      setGames(registry.games);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatus(`Error: ${errMsg}`);
    }
  };

  return (
    <Container size="md" style={{ padding: '20px' }}>
      <Stack align="center" gap="lg">
        <Title order={1}>Arcade Admin Dashboard</Title>
        <Button onClick={() => open()} color="blue">
          {connected && publicKey
            ? `Connected: ${publicKey.toBase58().slice(0, 6)}...`
            : 'Connect Wallet'}
        </Button>

        <Select
          label="Select Game"
          placeholder="Choose a game"
          value={gameId}
          onChange={(value) => setGameId(value || '')}
          data={games.map((game) => ({
            value: game.gameId.toBase58(),
            label: `${game.gameName} (${game.gameId.toBase58().slice(0, 6)}...)`,
          }))}
          style={{ width: '100%' }}
        />

        <Table>
          <thead>
            <tr>
              <th>Game Name</th>
              <th>Game ID</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, index) => (
              <tr key={index}>
                <td>{game.gameName}</td>
                <td>{game.gameId.toBase58().slice(0, 6)}...</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <TextInput
          label="Game ID (Public Key)"
          value={gameId}
          onChange={(e) => setGameId(e.currentTarget.value)}
          placeholder="Enter game ID"
          style={{ width: '100%' }}
        />

        <TextInput
          label="Game Name"
          value={gameName}
          onChange={(e) => setGameName(e.currentTarget.value)}
          placeholder="Enter game name"
          style={{ width: '100%' }}
        />

        <TextInput
          label="Token Account (Public Key)"
          value={tokenAccount}
          onChange={(e) => setTokenAccount(e.currentTarget.value)}
          placeholder="Enter token account"
          style={{ width: '100%' }}
        />

        <Button
          onClick={handleInitialize}
          color="green"
          disabled={!gameId || !gameName || !tokenAccount}
        >
          Initialize Game
        </Button>

        <NumberInput
          label="New Cost to Play (Tokens)"
          value={newCost}
          onChange={(value: string | number) =>
            typeof value === 'number' ? setNewCost(value) : setNewCost('')
          }
          placeholder="Enter new cost"
          min={0}
          style={{ width: '100%' }}
        />

        <Button onClick={handleUpdateCost} color="yellow" disabled={!gameId || newCost === ''}>
          Update Cost
        </Button>

        <Button onClick={handleAddGame} color="purple" disabled={!gameId || !gameName}>
          Add Game to Registry
        </Button>

        {status && <Text>{status}</Text>}
      </Stack>
    </Container>
  );
}
