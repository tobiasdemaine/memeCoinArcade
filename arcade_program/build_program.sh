#!/bin/bash
echo "Building Solana program..."
cargo build-bpf
if [ $? -ne 0 ]; then
    echo "Error: Failed to build Solana program"
    exit 1
fi
echo "Program built successfully"
