window.ClubHubData = {
  demoData: {
    members: [
    {
      id: "m1",
      name: "Felix Bauer",
      email: "felix@example.com",
      roles: ["player", "tech_admin", "finance_admin"],
      jerseyNumber: 8,
      membershipStatus: "active",
      passStatus: "valid",
      passExpiry: "2026-09-15",
      feeStatus: "paid",
      notes: "Can manage technical setup and finance.",
      lastInviteResponse: "confirmed"
    },
    {
      id: "m2",
      name: "Luca Steiner",
      email: "luca@example.com",
      roles: ["coach"],
      jerseyNumber: null,
      membershipStatus: "active",
      passStatus: "valid",
      passExpiry: "2026-07-31",
      feeStatus: "paid",
      notes: "Head coach for matchday squad planning.",
      lastInviteResponse: "maybe"
    },
    {
      id: "m3",
      name: "Jonas Huber",
      email: "jonas@example.com",
      roles: ["player"],
      jerseyNumber: 11,
      membershipStatus: "active",
      passStatus: "expiring",
      passExpiry: "2026-05-03",
      feeStatus: "due",
      notes: "Pass renewal needed soon.",
      lastInviteResponse: "pending"
    },
    {
      id: "m4",
      name: "Nico Schmid",
      email: "nico@example.com",
      roles: ["player", "admin"],
      jerseyNumber: 1,
      membershipStatus: "pending",
      passStatus: "expired",
      passExpiry: "2026-03-21",
      feeStatus: "overdue",
      notes: "Waiting for updated federation documents.",
      lastInviteResponse: "declined"
    }
  ],
    fees: [
    {
      id: "f1",
      memberId: "m1",
      season: "2025/26",
      amount: 180,
      paidAmount: 180,
      status: "paid",
      dueDate: "2025-09-30"
    },
    {
      id: "f2",
      memberId: "m3",
      season: "2025/26",
      amount: 180,
      paidAmount: 100,
      status: "due",
      dueDate: "2025-09-30"
    },
    {
      id: "f3",
      memberId: "m4",
      season: "2025/26",
      amount: 180,
      paidAmount: 0,
      status: "overdue",
      dueDate: "2025-09-30"
    }
  ],
    events: [
    {
      id: "e1",
      title: "Tuesday Training",
      type: "practice",
      date: "2026-04-14",
      location: "Main Pitch",
      inviteStatus: "scheduled",
      attending: ["m1", "m2"],
      maybe: ["m3"],
      unavailable: ["m4"]
    },
    {
      id: "e2",
      title: "League Match vs. FC Nord",
      type: "game",
      date: "2026-04-18",
      location: "Away",
      inviteStatus: "ready",
      attending: ["m1", "m3"],
      maybe: [],
      unavailable: ["m4"]
    }
  ],
    invites: [
    {
      id: "i1",
      eventId: "e1",
      channel: "email",
      sentAt: "2026-04-10T18:00:00Z",
      recipients: 24,
      opens: 20,
      confirmations: 15
    },
    {
      id: "i2",
      eventId: "e2",
      channel: "push",
      sentAt: "2026-04-11T08:00:00Z",
      recipients: 18,
      opens: 12,
      confirmations: 8
    }
    ]
  }
};
