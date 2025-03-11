#!/bin/bash
echo "Building TypeScript API..."
npx tsc
if [ $? -ne 0 ]; then
    echo "Error: Failed to build TypeScript API"
    exit 1
fi
echo "API built successfully"
