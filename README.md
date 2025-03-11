# MemeCoinArcade

A Solana-based gaming platform where players can play various arcade games using meme coins to play, compete for high scores, and win prizes from a pooled prize system.

## Project Structure

- **arcade_program/**: Rust Solana program (smart contract)
  - `build_program.sh`: Script to build the Solana program
  - `deploy_program.sh`: Script to deploy the Solana program to devnet
- **arcade-api/**: TypeScript API for interacting with the program
  - `build_api.sh`: Script to build the TypeScript API
- **arcade-frontend/**: Next.js frontend for the arcade games
- **admin-frontend/**: Next.js frontend for admin interface

## Prerequisites

- Ubuntu Linux (tested on 20.04+)
- Rust (installed via rustup)
- Node.js/npm (v18+)
- Solana CLI (v1.18.0)
- Reown Project ID (get from https://reown.com/)

### 1. Configure the Frontends

1. Get a Reown Project ID from https://reown.com/
2. Update both `arcade-frontend/.env.local` and `admin-frontend/.env.local` with your Program ID and Reown Project ID:

```
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
NEXT_PUBLIC_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

### 3. Run the Frontends

- Arcade Frontend:

```bash
cd arcade-frontend
npm run dev
```

- Open http://localhost:3000 in your browser

- Admin Frontend:

```bash
cd admin-frontend
npm run dev
```

- Open http://localhost:3000 in your browser (runs on a different port if arcade-frontend is running)

## Development

### Arcade Frontend

- Access the game interface at `arcade-frontend`
- Currently set up with a basic "Start Game" button
- Extend with game-specific UI and logic in `src/app/page.tsx`

### Admin Functions (Admin Frontend)

- **Access**: Load the admin frontend
- **Add Game**: Enter a new game ID (generate via `solana-keygen new`) and name
- **Update Cost**: Select a game and enter new cost in Token (converts to lamports)
- **Game List**: Automatically displays all registered games with IDs and names

### Adding New Games

- Use the admin frontend to add new games
- Update the arcade frontend to support game-specific interfaces
- Update the Solana program logic as needed
