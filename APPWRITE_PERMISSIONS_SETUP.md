# Appwrite Permissions Configuration

Your app now runs **100% on Appwrite**. To make member creation and fee updates work, you need to configure **Collection Permissions** properly.

## The Problem You're Experiencing

You're getting `"No permissions provided for action 'create'"` because your Appwrite collections are locked down too restrictively. By default, users can't create or modify documents without explicit permissions.

## Solution: Set Document-Level Permissions

### For Each Collection, Go To:
1. **Appwrite Console** → Your Project
2. **Databases** → `emperor-app` 
3. Select each collection below
4. Click **Settings** → **Permissions**

### Collection: `members`

**Document-Level Permissions:**
```
Read: 
  - Any (everyone can see members)
  
Create:
  - Users (authenticated users can create)
  
Update:
  - Role: member (users can update their own)
  - Role: admin (admins can update anyone)
  
Delete:
  - Role: admin (only admins can delete)
```

In Appwrite Console:
- Add `users` permission for create
- Add `role:member` for update  
- Add `role:admin` for update and delete

### Collection: `membership_fees`

**Document-Level Permissions:**
```
Read:
  - Any
  
Create:
  - Users
  
Update:
  - Role: finance_admin
  - Role: admin
  
Delete:
  - Role: admin
```

### Collection: `player_passes`

**Document-Level Permissions:**
```
Read:
  - Any
  
Create:
  - Users
  
Update:
  - Role: admin
  - Role: coach
  - Role: member (users can update own)
  
Delete:
  - Role: admin
```

### Collection: `events`

**Document-Level Permissions:**
```
Read:
  - Any
  
Create:
  - Users
  
Update:
  - Role: admin
  - Role: coach (coaches can update)
  
Delete:
  - Role: admin
```

### Collection: `member_roles`

**Document-Level Permissions:**
```
Read:
  - Any
  
Create:
  - Users
  
Update:
  - Role: admin
  
Delete:
  - Role: admin
```

### Collection: `invites`

**Document-Level Permissions:**
```
Read:
  - Any
  
Create:
  - Users (needed for Appwrite Functions)
  
Update:
  - Role: admin
  
Delete:
  - Role: admin
```

## Testing Permissions

After configuring, test in your app:

1. **Sign in as an admin**
2. **Try to create a new member** - should work now
3. **Try to change payment status** - should work
4. **Check browser console** - look for "Appwrite Save Success"

## Roles Setup

Make sure your Appwrite project has these **roles** configured:
- `admin`
- `finance_admin`
- `coach`
- `tech_admin`
- `member`
- `player`
- `staff`

You can manage roles in **Appwrite Console** → **Settings** → **Roles** (or they're automatically created when you assign them to users).

## How Appwrite Permissions Work

- **Any** = Public (no authentication needed)
- **Users** = Any authenticated user
- **Role:XYZ** = Users with that role
- **User:ID** = Specific user ID

For your app:
- Everyone **reads** member lists (transparent organization)
- Only **authenticated members** can create/update their own data
- **Admins and finance staff** can modify fees
- **Coaches** can update passes

After configuring these permissions, your app will work directly with Appwrite - no server needed!
