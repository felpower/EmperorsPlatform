# Server Status Note

This file previously documented a full removal of the Node server. That is no longer accurate.

## Current Reality

The project is moving toward Appwrite-only backend infrastructure, but today there are still two valid modes:

### 1. Appwrite-first production mode

- GitHub Pages frontend
- Appwrite auth
- Appwrite database
- Appwrite Functions for server-side work

### 2. Local development helper mode

- `server.mjs` is still available locally
- it provides convenience APIs for development tasks such as:
  - SEPA export
  - Clubee pass sync preview/apply
  - local diagnostics

## Direction

The intended long-term production setup is:

- static frontend on GitHub Pages
- Appwrite for everything backend-related

So this file should be read as a migration note, not as a literal description of the current repo contents.
