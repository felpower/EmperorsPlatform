# Appwrite + Deployment Guide

Your app is now **Appwrite-native**. Render and Supabase are no longer needed.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Frontend      │ ◄────► │   Appwrite       │
│ (Static HTML)   │         │   (Backend)      │
│                 │         │ - Collections    │
│ GitHub Pages or │         │ - Auth           │
│ Appwrite        │         │ - Functions (opt)│
└─────────────────┘         └──────────────────┘
```

## Step 1: Build Your Frontend

```bash
npm run build
```

This creates a `dist/` folder with your static website.

## Deployment Option A: Appwrite Static Hosting (Best)

Appwrite can host your frontend:

### Using Appwrite CLI

```bash
# Install CLI
npm install -g appwrite-cli

# Login to Appwrite
appwrite login

# Deploy to Appwrite
appwrite deploy --type=web dist/
```

Or **manually** in Appwrite Console:
1. Go to **Storage** section
2. Create new bucket for frontend
3. Upload contents of `dist/` folder
4. Enable **Public access** 
5. Set **CORS** to allow your domain
6. Your app runs at: `https://[appwrite-endpoint]/v1/storage/buckets/[bucket-id]/files/index.html`

### Enable Static Hosting (if available in your Appwrite version)

Modern Appwrite versions have built-in Static Hosting:
1. **Settings** → **Static Hosting**
2. Select your frontend bucket
3. Get your public URL

## Deployment Option B: GitHub Pages (Free Alternative)

Host on GitHub Pages + Appwrite backend:

```bash
# 1. Create GitHub repo if you don't have one
git init
git add .
git commit -m "Appwrite-native app"
git remote add origin https://github.com/YOUR_USERNAME/EmperorsApp
git branch -M main
git push -u origin main

# 2. Enable GitHub Pages in your repo settings:
# Settings → Pages → Source: Deploy from a branch
# Select: main / (root)

# 3. Deploy frontend
npm run build

# 4. Create deploy workflow file
# .github/workflows/deploy.yml
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Then:
```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment"
git push
```

Your site will be live at: `https://YOUR_USERNAME.github.io/EmperorsApp/`

## Step 2: Configure Frontend

Update your frontend config (`src/supabase-config.js`):

```javascript
window.ClubHubAppwriteConfig = {
  projectId: "YOUR_PROJECT_ID",
  databaseId: "emperor-app",
  endpoint: "https://fra.cloud.appwrite.io/v1", // Your Appwrite endpoint
  apiKey: "YOUR_API_KEY"  // Public API key, NOT admin key
};
```

Rebuild and redeploy:
```bash
npm run build
# Then deploy to Appwrite or GitHub Pages
```

## Step 3: Configure Appwrite Permissions

See `APPWRITE_PERMISSIONS_SETUP.md` for how to set collection permissions.

After setting permissions, test:
1. Open your deployed app (GitHub Pages or Appwrite)
2. Sign in as admin
3. Try creating a member - should work now
4. Check browser console for success messages

## HTTPS & Custom Domain (Optional)

### GitHub Pages with Custom Domain
```
Settings → Pages → Custom domain
Enter: emperors.example.com
```

Then add DNS record:
```
CNAME emperors.example.com 
CNAME -> YOUR_USERNAME.github.io
```

### Appwrite with Custom Domain
Contact your Appwrite provider or use your own reverse proxy.

## Environment Variables

Remove all these since they're no longer used:
- `RENDER` ✗
- `SUPABASE_URL` ✗
- `SUPABASE_SERVICE_ROLE_KEY` ✗
- `APPWRITE_API_KEY` (server admin key) ✗ 

Keep only:
- `APPWRITE_ENDPOINT` (your Appwrite cloud endpoint)
- `APPWRITE_PROJECT_ID`

These go in your deployment settings (GitHub Secrets, Appwrite environment, etc).

## Troubleshooting

### "Permission denied" errors
→ See `APPWRITE_PERMISSIONS_SETUP.md` - your collections need proper permissions

### "Appwrite client not available"
→ Verify `window.ClubHubAppwriteConfig` is set correctly in `src/supabase-config.js`

### "Static mode - no data persistence"
→ You're running locally without Appwrite. Sign in with email to use Appwrite backend.

### Member invites not working 
→ See `APPWRITE_FUNCTIONS_SETUP.md` (optional feature using Appwrite Functions)

## Cost

- **GitHub Pages**: Free
- **Appwrite Community**: Free tier available
- **Appwrite Cloud**: Pay-as-you-go ($5+/month depending on usage)

## Next Steps

1. ✅ Set up Appwrite permissions (APPWRITE_PERMISSIONS_SETUP.md)
2. ✅ Build your frontend: `npm run build`
3. ✅ Deploy to GitHub Pages or Appwrite
4. ✅ Test member creation
5. (Optional) Set up Appwrite Functions for email invites

**Done!** Your app is now in the cloud, no server management needed.
