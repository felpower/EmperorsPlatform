# Appwrite Functions Setup (Optional)

This guide is **only needed if you want email invites to work**. If you don't need invites, skip this.

## What Changed

Previously, invites were sent via Express server calling Appwrite Admin API.

Now you have two options:
1. **Use Appwrite Functions** (recommended) - serverless email function
2. **Manual emails** - Users reset their password manually to activate
3. **Never invite** - Skip this feature entirely

## Option 1: Use Appwrite Functions (Recommended)

### Step 1: Create Function in Appwrite Console

1. Go to **Appwrite Console** → **Functions**
2. Click **Create New**
3. **Name**: `send-member-invite`
4. **Runtime**: Node.js  
5. **Click Create**

### Step 2: Copy Function Code

```javascript
const sdk = require("node-appwrite");

module.exports = async function (req, res) {
  const client = new sdk.Client();
  const appwrite = new sdk.Account(client);

  client
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)
    .setSelfSigned(true);

  try {
    const { email, memberId } = JSON.parse(req.body);

    if (!email || !memberId) {
      return res.send({ error: "Email and memberId are required" }, 400);
    }

    // Create/get user
    let user;
    const users = new sdk.Users(client);
    
    try {
      // Try to find existing user
      const list = await users.list([sdk.Query.equal("email", email)]);
      user = list.users[0];
    } catch {
      // User doesn't exist, create
      user = await users.create(
        sdk.ID.unique(),
        email,
        undefined,
        undefined,
        `temp-${Math.random().toString(36).slice(2)}`
      );
    }

    // Send recovery email (password setup)
    const userId = user.$id;
    const account = new sdk.Account(client);
    
    await account.createRecovery(
      email,
      `${process.env.RECOVERY_URL || 'http://localhost:4173'}#recovery`
    );

    // Update member with profile_id
    const databases = new sdk.Databases(client);
    await databases.updateDocument(
      process.env.DATABASE_ID,
      "members",
      memberId,
      {
        profile_id: userId,
        invite_sent_at: new Date().toISOString()
      }
    );

    return res.json({ ok: true, email, userId });
  } catch (error) {
    return res.send({ error: error.message }, 500);
  }
};
```

### Step 3: Set Environment Variables

In Appwrite Console → Function → Settings:

Add these environment variables:
```
APPWRITE_ENDPOINT = https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID = (your project ID)
APPWRITE_API_KEY = (your server API key)
DATABASE_ID = emperor-app
RECOVERY_URL = https://your-app-domain.com
```

### Step 4: Set Function Permissions

In Function settings, add execution permissions:
- **Any** OR
- **Users** (authenticated only)

### Step 5: Deploy Function

Your function is now live at:
```
https://fra.cloud.appwrite.io/v1/functions/[FUNCTION_ID]/executions
```

### Step 6: Update Frontend

Update the `inviteRecipient` function in `app.bundle.js`:

```javascript
async function inviteRecipient(payload) {
  if (!backendClient) {
    throw new Error("Appwrite client not configured.");
  }

  // Call your Appwrite Function
  const response = await fetch(
    'https://fra.cloud.appwrite.io/v1/functions/[YOUR_FUNCTION_ID]/executions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': '[PROJECT_ID]'
      },
      body: JSON.stringify({
        email: payload.email,
        memberId: payload.memberId
      })
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Could not send invite');
  }
  return result;
}
```

## Option 2: Manual Email Setup

Skip the function. Users activate by:
1. Admin creates member without email invite
2. User requests password reset via sign-in page
3. Appwrite sends them recovery email
4. They set password and activate

## Option 3: External Email Service

Use SendGrid, Mailgun, or Resend via Appwrite Function:

```javascript
// In same function above, after creating recovery:

const secrets = new sdk.GraphQL(client);
const message = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email }] }],
    from: { email: 'noreply@emperors.example.com' },
    subject: 'Join Uni Wien Emperors',
    html: `<p>Click here to set your password: 
      <a href="${recoveryUrl}">Activate Account</a></p>`
  })
});
```

## Testing

1. Go to your app
2. Create a member with email
3. Click "Invite" button
4. Check email (may take 5-30 seconds)
5. Click recovery link
6. Set password

## Troubleshooting

### "Function not found"
→ Copy the correct Function ID from Appwrite Console

### "Unauthorized execution"
→ Check function permissions - set to "Any" or "Users"

### "Email not received"
→ Check RECOVERY_URL is correct
→ Check spam folder
→ Verify Appwrite SMTP settings (if self-hosted)

## Disabling Invites

If invites aren't essential, you can disable the feature:
1. Hide the invite button in `app.bundle.js`
2. Users manually request password reset instead
3. No function needed

---

**You now have a complete serverless application with Appwrite!**
