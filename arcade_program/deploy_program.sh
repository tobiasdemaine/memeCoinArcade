#!/bin/bash
echo "Deploying Solana program to devnet..."
solana program deploy --url devnet ./target/deploy/arcade_program.so
if [ $? -ne 0 ]; then
    echo "Error: Failed to deploy Solana program"
    echo "Ensure you have a Solana wallet configured and sufficient SOL for deployment"
    exit 1
fi
echo "Program deployed successfully"
echo "Note the Program ID from the output above and update .env.local files in frontends"
