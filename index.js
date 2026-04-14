module.exports = async ({ req, res, log }) => {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  const databaseId = String(process.env.APPWRITE_DATABASE_ID || "").trim();
  const membersCollectionId = String(process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members").trim();

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    return res.json(
      {
        error:
          "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, or APPWRITE_DATABASE_ID environment variables."
      },
      500
    );
  }

  const parseBody = () => {
    try {
      if (!req || req.body === undefined || req.body === null) return {};
      if (typeof req.body === "string") {
        return req.body.trim() ? JSON.parse(req.body) : {};
      }
      if (typeof req.body === "object") {
        return req.body;
      }
      return {};
    } catch {
      return {};
    }
  };

  const body = parseBody();
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim() || "ClubHub User";
  const memberId = String(body.memberId || "").trim();
  const sendRecovery = body.sendRecovery !== false;
  const redirectTo = String(body.redirectTo || process.env.PUBLIC_SITE_URL || "").trim();

  if (!email) {
    return res.json({ error: "email is required" }, 400);
  }

  const base = endpoint.replace(/\/$/, "");
  const headers = {
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey,
    "Content-Type": "application/json"
  };

  const request = async (pathname, { method = "GET", body: requestBody } = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  try {
    // 1) Find existing user by email.
    const search = encodeURIComponent(email);
    const list = await request(`/users?search=${search}&limit=100`);
    if (!list.response.ok) {
      return res.json({ error: list.payload?.message || "Could not search users." }, 500);
    }

    const users = Array.isArray(list.payload?.users) ? list.payload.users : [];
    let user = users.find((entry) => String(entry?.email || "").trim().toLowerCase() === email) || null;
    let createdUser = false;

    // 2) Create missing user.
    if (!user) {
      const userId = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 36);
      const tempPassword = `InviteTemp!${Math.random().toString(36).slice(2, 8)}A1`;
      const create = await request("/users", {
        method: "POST",
        body: {
          userId,
          email,
          password: tempPassword,
          name: fullName
        }
      });

      if (!create.response.ok) {
        return res.json({ error: create.payload?.message || "Could not create user." }, 500);
      }

      user = create.payload || null;
      createdUser = true;
    }

    const userId = String(user?.$id || user?.id || "").trim();

    let recoverySent = false;
    if (sendRecovery) {
      if (!redirectTo) {
        return res.json({ error: "Missing redirectTo (or PUBLIC_SITE_URL) for recovery email." }, 500);
      }

      const recovery = await request(`/users/${encodeURIComponent(userId)}/recovery`, {
        method: "POST",
        body: {
          url: redirectTo
        }
      });

      if (!recovery.response.ok) {
        return res.json(
          {
            error: recovery.payload?.message || "Could not send invite recovery email.",
            userId,
            createdUser
          },
          500
        );
      }
      recoverySent = true;
    }

    // 4) Optionally patch member linkage/invite timestamp.
    if (memberId) {
      const patch = await request(
        `/databases/${databaseId}/collections/${membersCollectionId}/documents/${encodeURIComponent(memberId)}`,
        {
          method: "PATCH",
          body: {
            data: {
              profile_id: userId || null,
              ...(recoverySent ? { invite_sent_at: new Date().toISOString() } : {})
            }
          }
        }
      );

      if (!patch.response.ok) {
        return res.json(
          {
            error: patch.payload?.message || "User created, but member row could not be updated.",
            userId,
            createdUser
          },
          500
        );
      }
    }

    log(`Invite user ensured for ${email} (${createdUser ? "created" : "existing"}), recovery ${recoverySent ? "sent" : "skipped"}.`);
    return res.json({ ok: true, email, userId, createdUser, recoverySent });
  } catch (error) {
    return res.json({ error: error instanceof Error ? error.message : "Unknown function error." }, 500);
  }
};
