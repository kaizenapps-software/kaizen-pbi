#!/bin/bash
set -e

# Start auth-service in background
echo "Starting auth-service on port 8081..."
cd services/auth-service
PORT=8081 node index.js &
AUTH_PID=$!
cd ../..

# Wait a bit for auth-service to start
sleep 2

# Start edge-api in foreground
echo "Starting edge-api on port $PORT..."
cd services/edge-api
node index.js &
EDGE_PID=$!
cd ../..

# Keep script running and handle shutdown
trap "kill $AUTH_PID $EDGE_PID 2>/dev/null" EXIT

# Wait for both processes
wait
