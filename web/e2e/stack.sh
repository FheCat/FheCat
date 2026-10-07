#!/usr/bin/env bash
# Local end-to-end stack: Hardhat chain with the CoFHE mocks, a fresh FheCatLocal
# deployment and the site with the one-click dev wallet.
#
#   bash e2e/stack.sh        # then open http://localhost:5173
#
# `npm run test:e2e` starts it automatically. Needs `npm install` in ../contracts.
set -euo pipefail
cd "$(dirname "$0")/../../contracts"

rpc_up() {
  curl -s -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545 > /dev/null
}

if ! rpc_up; then
  npx hardhat node > ../web/test-results-node.log 2>&1 &
  NODE_PID=$!
  trap 'kill $NODE_PID 2> /dev/null' EXIT
  for _ in $(seq 1 90); do rpc_up && break; sleep 1; done
fi

# No wallet limit locally: the e2e tests mint several times from the dev wallet.
MAX_PER_WALLET=0 npx hardhat run scripts/deploy.ts --network localhost
cd ../web
# The published testnet deployment is in deployments.json too; the local chain comes first here.
VITE_DEV_WALLET=true VITE_DEFAULT_CHAIN_ID=31337 npx vite --port 5173 --strictPort
