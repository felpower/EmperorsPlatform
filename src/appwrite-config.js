// Free-plan cut-over switch (see FREE_PLAN_MIGRATION.md).
//   false = old setup: 6 functions, 5 buckets, Appwrite recovery emails
//   true  = new setup: emperors-public + emperors-admin, one "media" bucket, Mailgun invite/reset links
// Flip it only after the storage migration ran and both new functions are deployed and tested;
// flipping it back is the rollback (nothing old is deleted until you do that by hand).
const CLUBHUB_USE_FREE_PLAN_SETUP = false;

const CLUBHUB_LEGACY_APPWRITE_SETUP = {
  inviteFunctionId: "CreateAuthAccount",
  contactFunctionId: "ContactEmail",
  passSyncFunctionId: "PassSyncFunction",
  sepaExportFunctionId: "SepaExport",
  tryoutEmailFunctionId: "TryoutEmail",
  diagnosticsFunctionId: "69fe0260003aa6db005b",
  profilePicturesBucketId: "ProfilePictures",
  rosterPicturesBucketId: "RosterPictures",
  equipmentPicturesBucketId: "equipment",
  hallOfFamePicturesBucketId: "hall_of_fame",
  teamsBucketId: "teams",
  authEmailMode: "appwrite"
};

const CLUBHUB_FREE_PLAN_SETUP = {
  publicFunctionId: "emperors-public",
  adminFunctionId: "emperors-admin",
  inviteFunctionId: "emperors-admin",
  contactFunctionId: "emperors-public",
  passSyncFunctionId: "emperors-admin",
  sepaExportFunctionId: "emperors-admin",
  tryoutEmailFunctionId: "emperors-admin",
  diagnosticsFunctionId: "emperors-public",
  mediaBucketId: "media",
  profilePicturesBucketId: "media",
  rosterPicturesBucketId: "media",
  equipmentPicturesBucketId: "media",
  hallOfFamePicturesBucketId: "media",
  teamsBucketId: "media",
  // Permissions for new uploads into "media". Only used when the bucket has file security on.
  // Paste the block printed by: node scripts/migrate-storage-to-single-bucket.mjs --dry-run
  storageFilePermissions: null,
  authEmailMode: "mailgun"
};

window.ClubHubAppwriteConfig = Object.assign({
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "69dd0fdd00336ea1b4b5",
  databaseId: "69dd11140002e2b4254a",
  apiBaseUrl: "",
  contactRecipientEmail: "p.felbauer@emperors.at",
  teamLogoFiles: {
    "JKU Astros": "69ec923f001233031abb"
  },
  membersTableId: "members",
  memberRolesTableId: "member_roles",
  playerPassesTableId: "player_passes",
  membershipFeesTableId: "membership_fees",
  eventsTableId: "events",
  eventRecipientsTableId: "event_recipients",
  invitesTableId: "invites",
  tryoutRegistrationsTableId: "tryout_registrations",
  tryoutSettingsTableId: "tryout_settings",
  organizationTableId: "organization",
  sponsorOutreachTableId: "sponsor_outreach",
  sponsorCommunicationsTableId: "sponsor_communications",
  equipmentTableId: "equipment_inventory",
  diagnosticsTableId: "diagnostics_logs",
  hallOfFameTableId: "hall_of_fame"
}, CLUBHUB_USE_FREE_PLAN_SETUP ? CLUBHUB_FREE_PLAN_SETUP : CLUBHUB_LEGACY_APPWRITE_SETUP);
