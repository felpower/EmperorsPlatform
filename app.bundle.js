(async function () {
  const APPWRITE_CONFIG = window.ClubHubAppwriteConfig || null;
  const moduleRegistry = window.ClubHubModules || {};
  const cacheModule = moduleRegistry.cache || null;
  const ibanModule = moduleRegistry.iban || null;
  const profileFinanceModule = moduleRegistry.profileFinance || null;

  const demoData = {
    source: "demo",
    permissionsModel: {
      note: "Admins inherit all coach, player, finance, and tech capabilities.",
      restrictedAreas: {
        fees: ["admin"],
        playerPasses: ["admin", "coach", "tech_admin"]
      }
    },
    members: [],
    fees: [],
    events: [],
    invites: [],
    organization: [
      {
        id: "org-emperors",
        headOf: "Emperors",
        verantwortung: "Jimmy Huynh",
        coVerantwortung: "Lukas Steiner",
        aufgaben: "Jahresbericht, Jahresvoranschlag, Stadlaukontakt/ Vertragsverlängerung, Raumbuchungen Stadlau, Camps planen & buchen, Weihnachtsfeier veranstalten"
      },
      {
        id: "org-finanzen",
        headOf: "Finanzen",
        verantwortung: "Patrick Felbauer",
        coVerantwortung: "",
        aufgaben: "Jahresbericht, Jahresvoranschlag, Einzahler überprüfen, Auszahlungen tätigen, SEPA-Lastschriften austeilen & einsammeln"
      },
      {
        id: "org-technik",
        headOf: "Technik",
        verantwortung: "Patrick Felbauer",
        coVerantwortung: "",
        aufgaben: ""
      },
      {
        id: "org-coaching",
        headOf: "Coaching",
        verantwortung: "Max Frank",
        coVerantwortung: "Benedikt Leitner",
        aufgaben: "Trainingsplan- Erstellung, Hudl managen, Coaches organisieren, ACSL-Sitzungen"
      },
      {
        id: "org-equipment",
        headOf: "Equipment",
        verantwortung: "Max Van der Werf",
        coVerantwortung: "",
        aufgaben: "Gameday-organisation, Inventur, Bestellungen von Equipment, Jerseyvergabe und -Überwachung, Jersey-Bestellung planen, Equipment überprüfen und pflegen, Equ.Transport planen"
      },
      {
        id: "org-sportliche-leitung",
        headOf: "Sportliche Leitung",
        verantwortung: "Max Jeftenic",
        coVerantwortung: "Benjamin Zitta",
        aufgaben: "Camps planen & buchen, Tryouts organisieren, Rookie-Leitfaden erstellen/Updaten, Testspiele organisieren, Coaching-Qualitätsmonitoring: Feedbackbögen erstellen und auswerten + rückmelden"
      },
      {
        id: "org-administration",
        headOf: "Administration",
        verantwortung: "Arthur Wäscher",
        coVerantwortung: "",
        aufgaben: "Förderungen erschließen, Weihnachtsfeier veranstalten, Stadlaukontakt/ Vertragsverlängerung, Raumbuchungen Stadlau, Spielerpässe überprüfen"
      },
      {
        id: "org-social-media",
        headOf: "Social Media",
        verantwortung: "Angie",
        coVerantwortung: "Martin Stockinger",
        aufgaben: "Posts erstellen, Informationen nach außen transportieren, Insta-Anfragen beantworten, Media-Days planen"
      }
    ],
    equipment: []
  };
  const CLUBEE_GAMES_SOURCE_URL = "https://clubee.com/afbo/spiele-568998v4/leagues/16957/seasons/218";
  const EMPERORS_TEAM_NAME = "UNI-Wien Emperors";
  const CLUBEE_GAMES_SNAPSHOT = [
    {
      id: "2805871",
      phase: "RegularSeason 2025/26",
      startsAt: "2025-10-11T16:15:00+00:00",
      venueName: "",
      venueCity: "",
      info: "2",
      streamLink: "",
      homeTeam: { name: "UNI-Wien Emperors", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/uni-wien-emperors-1590_1773399143_small.png" },
      awayTeam: { name: "BOKU Beez", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/boku-beez-4768_1773399154_small.png" },
      homeScore: 37,
      awayScore: 14
    },
    {
      id: "2805869",
      phase: "RegularSeason 2025/26",
      startsAt: "2025-10-18T17:30:00+00:00",
      venueName: "",
      venueCity: "",
      info: "0",
      streamLink: "",
      homeTeam: { name: "WU Tigers", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/wu-tigers-431431_1773399181_small.png" },
      awayTeam: { name: "UNI-Wien Emperors", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/uni-wien-emperors-1590_1773399143_small.png" },
      homeScore: 7,
      awayScore: 23
    },
    {
      id: "2805889",
      phase: "RegularSeason 2025/26",
      startsAt: "2026-04-18T17:30:00+00:00",
      venueName: "Footballzentrum Ravelin",
      venueCity: "Wien",
      info: "5",
      streamLink: "https://www.youtube.com/watch?v=zdSiCyKyLu4",
      homeTeam: { name: "TU Robots", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/tu-robots-2198_1773399105_small.png" },
      awayTeam: { name: "UNI-Wien Emperors", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/uni-wien-emperors-1590_1773399143_small.png" },
      homeScore: 13,
      awayScore: 20
    },
    {
      id: "2805893",
      phase: "RegularSeason 2025/26",
      startsAt: "2026-05-15T19:00:00+00:00",
      venueName: "ABC ASKÖ Bewegungscenter",
      venueCity: "Linz",
      info: "10",
      streamLink: "",
      homeTeam: { name: "JKU Astros", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/jku-astros-6632_1773399167_small.png" },
      awayTeam: { name: "UNI-Wien Emperors", logo: "https://clubee-websites-prod.s3.eu-central-1.amazonaws.com/17538/logo/uni-wien-emperors-1590_1773399143_small.png" },
      homeScore: null,
      awayScore: null
    }
  ];
  const GAMES_FILTER_STORAGE_KEY = "emperors-games-team-filter-v1";
  const TEAM_BUCKET_FILE_MAP = {
    "BOKU Beez": "Beez",
    "UNI-Wien Emperors": "Emperors",
    "WU Tigers": "Tigers",
    "TU Robots": "Robots",
    "JKU Astros": "Astros",
    "Med Uni Wien Serpents": "Serpents"
  };
  const LEAGUE_GAMES_SNAPSHOT = [
    { id: "g-2025-10-11-emperors-beez", stage: "Spieltag 1", subtitle: "", startsAt: "2025-10-11T16:15:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "UNI-Wien Emperors" }, awayTeam: { name: "BOKU Beez" }, homeScore: 37, awayScore: 14 },
    { id: "g-2025-10-11-tigers-robots", stage: "Spieltag 1", subtitle: "", startsAt: "2025-10-11T17:30:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "WU Tigers" }, awayTeam: { name: "TU Robots" }, homeScore: 23, awayScore: 14 },
    { id: "g-2025-10-18-astros-beez", stage: "Spieltag 1", subtitle: "", startsAt: "2025-10-18T14:15:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "JKU Astros" }, awayTeam: { name: "BOKU Beez" }, homeScore: 7, awayScore: 37 },
    { id: "g-2025-10-18-tigers-emperors", stage: "Spieltag 1", subtitle: "", startsAt: "2025-10-18T17:30:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "WU Tigers" }, awayTeam: { name: "UNI-Wien Emperors" }, homeScore: 7, awayScore: 23 },
    { id: "g-2025-10-31-astros-robots", stage: "Spieltag 1", subtitle: "", startsAt: "2025-10-31T19:00:00+01:00", venueName: "", venueCity: "", homeTeam: { name: "JKU Astros" }, awayTeam: { name: "TU Robots" }, homeScore: 14, awayScore: 19 },
    { id: "g-2026-04-12-serpents-tigers", stage: "Spieltag 2", subtitle: "", startsAt: "2026-04-12T14:15:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "Med Uni Wien Serpents" }, awayTeam: { name: "WU Tigers" }, homeScore: 3, awayScore: 40 },
    { id: "g-2026-04-18-beez-serpents", stage: "Spieltag 2", subtitle: "", startsAt: "2026-04-18T14:15:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "BOKU Beez" }, awayTeam: { name: "Med Uni Wien Serpents" }, homeScore: 3, awayScore: 6 },
    { id: "g-2026-04-18-robots-emperors", stage: "Spieltag 2", subtitle: "", startsAt: "2026-04-18T17:30:00+02:00", venueName: "Footballzentrum Ravelin", venueCity: "Wien", streamLink: "https://www.youtube.com/watch?v=zdSiCyKyLu4", isReplay: true, homeTeam: { name: "TU Robots" }, awayTeam: { name: "UNI-Wien Emperors" }, homeScore: 13, awayScore: 20 },
    { id: "g-2026-04-24-astros-serpents", stage: "Spieltag 2", subtitle: "", startsAt: "2026-04-24T19:00:00+02:00", venueName: "ABC ASKÖ Bewegungscenter", venueCity: "Linz", streamLink: "https://www.youtube.com/live/WfA_Se67oFo?si=XTe5rlfKrkbKNjoh", isReplay: true, homeTeam: { name: "JKU Astros" }, awayTeam: { name: "Med Uni Wien Serpents" }, homeScore: 36, awayScore: 9 },
    { id: "g-2026-05-09-serpents-robots", stage: "Spieltag 2", subtitle: "", startsAt: "2026-05-09T14:15:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "Med Uni Wien Serpents" }, awayTeam: { name: "TU Robots" }, homeScore: null, awayScore: null },
    { id: "g-2026-05-09-tigers-beez", stage: "Spieltag 2", subtitle: "", startsAt: "2026-05-09T17:30:00+02:00", venueName: "", venueCity: "", homeTeam: { name: "WU Tigers" }, awayTeam: { name: "BOKU Beez" }, homeScore: null, awayScore: null },
    { id: "g-2026-05-15-astros-emperors", stage: "Spieltag 2", subtitle: "", startsAt: "2026-05-15T19:00:00+02:00", venueName: "ABC ASKÖ Bewegungscenter", venueCity: "Linz", homeTeam: { name: "JKU Astros" }, awayTeam: { name: "UNI-Wien Emperors" }, homeScore: null, awayScore: null },
    { id: "g-2026-05-23-wildcard-1", stage: "Playoffs", subtitle: "Wildcard ACSL 3. vs. 6.", startsAt: "2026-05-23T14:15:00+02:00", venueName: "Footballzentrum Ravelin", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null },
    { id: "g-2026-05-23-wildcard-2", stage: "Playoffs", subtitle: "Wildcard ACSL 4. vs. 5.", startsAt: "2026-05-23T17:30:00+02:00", venueName: "Footballzentrum Ravelin", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null },
    { id: "g-2026-06-06-semi-1", stage: "Semifinals", subtitle: "Semi Finals ACSL 1. vs Lowest Seed", startsAt: "2026-06-06T14:15:00+02:00", venueName: "Sportanlage Stadlau", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null },
    { id: "g-2026-06-06-semi-2", stage: "Semifinals", subtitle: "Semi Finals ACSL 2. vs Higest Seed", startsAt: "2026-06-06T17:30:00+02:00", venueName: "Sportanlage Stadlau", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null },
    { id: "g-2026-06-27-third-place", stage: "3rd place", subtitle: "ACSL Spiel um Platz 3", startsAt: "2026-06-27T14:00:00+02:00", venueName: "Hohe Warte Stadion", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null },
    { id: "g-2026-06-27-final", stage: "Final", subtitle: "ACSL Summer Bowl", startsAt: "2026-06-27T17:30:00+02:00", venueName: "Hohe Warte Stadion", venueCity: "Wien", homeTeam: { name: "TBA" }, awayTeam: { name: "TBA" }, homeScore: null, awayScore: null }
  ];

  const STORAGE_KEY = "emperors-local-state-v3";
  const ACCESS_KEY = "emperors-local-access-role";
  const FEE_FILTER_KEY = "emperors-fee-period-filter";
  const FEE_STATUS_FILTER_KEY = "emperors-fee-status-filter";
  const TABLE_SORT_KEY = "emperors-table-sort-v1";
  const MEMBER_FILTER_KEY = "emperors-member-filters-v1";
  const PASS_FILTER_KEY = "emperors-pass-filters-v1";
  const EQUIPMENT_STORAGE_KEY = "emperors-equipment-v1";
  const EQUIPMENT_SHEET_KEY = "emperors-equipment-sheet-v1";
  const EQUIPMENT_KIND_FILTER_KEY = "emperors-equipment-kind-filter-v1";
  const EQUIPMENT_SHEETS_STORAGE_KEY = "emperors-equipment-sheets-v1";
  const EQUIPMENT_EXPANDED_CONTAINERS_KEY = "emperors-equipment-expanded-containers-v1";
  const DEFAULT_EQUIPMENT_SHEETS = [
    { key: "all", label: "All sheets" },
    { key: "training", label: "Training" },
    { key: "gameday", label: "Gameday" },
    { key: "technik", label: "Technik" }
  ];
  const INVITE_ROLE_OPTIONS = ["admin", "coach", "finance_admin", "tech_admin", "player", "staff"];
  const FEE_STATUSES = ["paid", "paid_rookie_fee", "paid_with_fee", "partial", "pending", "not_collected", "exempt", "exit", "not_applicable"];
  const FEE_PAID_STATUSES = ["paid", "paid_rookie_fee", "paid_with_fee"];
  const FEE_ZERO_PAID_STATUSES = ["pending", "not_collected", "exempt", "exit", "not_applicable"];
  const FEE_COLLECTIBLE_STATUSES = [...FEE_PAID_STATUSES, "partial", "pending", "not_collected"];
  const viewIds = ["dashboard", "members", "fees", "user", "passes", "organization", "equipment", "pass-sync", "events", "invites", "settings", "recovery"];
  const accessRoleOptions = ["admin", "finance_admin", "coach", "tech_admin", "player"];
  const memberRoleOptions = ["player", "coach", "admin", "finance_admin", "tech_admin", "staff"];
  const memberPositionOptions = [
    "QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "DB", "CB", "S", "K", "P",
    "OT", "OG", "C", "DT", "DE", "NT", "ILB", "OLB"
  ];
  const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024;
  const MAX_AVATAR_DIMENSION = 1280;
  const MAX_EQUIPMENT_PHOTO_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_EQUIPMENT_PHOTO_DIMENSION = 1600;
  const INLINE_AVATAR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23f2f3f5'/%3E%3Ccircle cx='80' cy='62' r='28' fill='%23d0d5dd'/%3E%3Crect x='34' y='104' width='92' height='42' rx='21' fill='%23d0d5dd'/%3E%3C/svg%3E";
  const DEFAULT_PROFILE_AVATAR_URL = String(APPWRITE_CONFIG?.fallbackProfileImageUrl || "").trim();

  const backendClient =
    window.ClubHubDataClient && typeof window.ClubHubDataClient.createClient === "function"
      ? window.ClubHubDataClient.createClient()
      : null;

  let state = loadState();
  let bootstrapMeta = {
    source: state.source || "demo",
    permissionsModel: state.permissionsModel || demoData.permissionsModel
  };
  let currentAccessRole = loadStoredValue(ACCESS_KEY, "admin");
  let selectedFeePeriod = loadStoredValue(FEE_FILTER_KEY, "latest");
  let selectedFeeStatuses = loadStatusFilter();
  let feeEditMode = false;
  let feeInlineEditId = null;
  let memberMergeMode = false;
  let memberFiltersExpanded = false;
  let feeFiltersExpanded = false;
  let passFiltersExpanded = false;
  let feeBulkStatus = "paid";
  let selectedFeeMemberIds = [];
  let selectedUserMemberId = "";
  let profileRouteMode = "member";
  let organizationDialogEditingId = "";
  let authInviteRole = "admin";
  let teardownMembersStickyHeader = null;
  let teardownFeesStickyHeader = null;
  let teardownPassesStickyHeader = null;
  let tableSort = loadTableSort();
  let memberFilters = loadMemberFilters();
  let passFilters = loadPassFilters();
  let equipmentSheets = loadEquipmentSheets();
  let selectedEquipmentSheet = loadStoredValue(EQUIPMENT_SHEET_KEY, "all");
  let selectedEquipmentKindFilter = loadStoredValue(EQUIPMENT_KIND_FILTER_KEY, "all");
  let selectedGameTeams = loadStoredArray(GAMES_FILTER_STORAGE_KEY);
  let expandedEquipmentContainerIds = loadStoredArray(EQUIPMENT_EXPANDED_CONTAINERS_KEY);
  let equipmentInlineEditId = "";
  let equipmentInlineDraftById = {};
  let equipmentCreateDraft = null;
  let equipmentPhotoDraftsById = {};
  let passSyncPreview = null;
  let selectedPassSyncMemberIds = [];
  let passSyncUpload = null;
  let sepaExportPreview = null;
  let authState = {
    mode: "local",
    status: "Local development mode active.",
    user: null,
    ready: false,
    loading: true,
    roles: [],
    pendingAction: ""
  };
  let recoveryState = {
    show: false,
    status: "",
    loading: false
  };
  let buttonFeedbackBound = false;
  let equipmentStorageMode = "local";
  let equipmentStatus = "";
  let isSyncing = false;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const BOOTSTRAP_CACHE_KEY = "emperors-bootstrap-cache-v1";
  const EQUIPMENT_CACHE_KEY = "emperors-equipment-cache-v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCacheWithTTL(key) {
    if (cacheModule && typeof cacheModule.getCacheWithTTL === "function") {
      return cacheModule.getCacheWithTTL(key, CACHE_TTL);
    }
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCacheWithTTL(key, data) {
    if (cacheModule && typeof cacheModule.setCacheWithTTL === "function") {
      cacheModule.setCacheWithTTL(key, data);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
      console.warn("[Cache] Failed to save cache:", error);
    }
  }

  function invalidateCache(key) {
    if (cacheModule && typeof cacheModule.invalidateCache === "function") {
      cacheModule.invalidateCache(key);
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  function apiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    const configuredBase = String(APPWRITE_CONFIG?.apiBaseUrl || window.ClubHubApiBaseUrl || "").trim();
    if (!configuredBase) {
      return normalizedPath;
    }
    const sanitizedBase = configuredBase.replace(/\/+$/, "");
    return `${sanitizedBase}${normalizedPath}`;
  }

  function hasConfiguredApiBaseUrl() {
    return Boolean(String(APPWRITE_CONFIG?.apiBaseUrl || window.ClubHubApiBaseUrl || "").trim());
  }

  function hasSepaExportCapability() {
    return Boolean(
      String(APPWRITE_CONFIG?.sepaExportFunctionId || "").trim() ||
      hasConfiguredApiBaseUrl() ||
      isLocalDevHost()
    );
  }

  function loadStoredValue(key, fallback) {
    const saved = localStorage.getItem(key);
    return saved || fallback;
  }

  function saveStoredValue(key, value) {
    localStorage.setItem(key, value);
  }

  function loadStoredArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveStoredArray(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function profileAvatarVersionKey(memberId) {
    return `clubhub-profile-avatar-version-${String(memberId || "").trim()}`;
  }

  function profileAvatarVersion(memberId) {
    const key = profileAvatarVersionKey(memberId);
    return String(localStorage.getItem(key) || "").trim();
  }

  function bumpProfileAvatarVersion(memberId) {
    const key = profileAvatarVersionKey(memberId);
    localStorage.setItem(key, String(Date.now()));
  }

  function profileAvatarFileId(memberId) {
    const normalized = String(memberId || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const safe = normalized || "unknown";
    return `avatar-${safe}`.slice(0, 36);
  }

  function storageAvatarUrlForMember(memberId) {
    const bucketId = String(APPWRITE_CONFIG?.profilePicturesBucketId || "").trim();
    const endpoint = String(APPWRITE_CONFIG?.endpoint || "").trim();
    const projectId = String(APPWRITE_CONFIG?.projectId || "").trim();
    const normalizedMemberId = String(memberId || "").trim();
    if (!bucketId || !endpoint || !projectId || !normalizedMemberId) return "";
    const base = endpoint.replace(/\/$/, "");
    const fileId = profileAvatarFileId(normalizedMemberId);
    const version = profileAvatarVersion(normalizedMemberId);
    const query = new URLSearchParams({ project: projectId });
    if (version) query.set("v", version);
    return `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(fileId)}/view?${query.toString()}`;
  }

  function equipmentPhotoVersionKey(equipmentId) {
    return `clubhub-equipment-photo-version-${String(equipmentId || "").trim()}`;
  }

  function equipmentPhotoVersion(equipmentId) {
    const key = equipmentPhotoVersionKey(equipmentId);
    return key ? String(localStorage.getItem(key) || "").trim() : "";
  }

  function bumpEquipmentPhotoVersion(equipmentId) {
    const key = equipmentPhotoVersionKey(equipmentId);
    if (!key) return;
    localStorage.setItem(key, String(Date.now()));
  }

  function equipmentPhotoFileId(equipmentId) {
    const normalized = String(equipmentId || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const safe = normalized || "unknown";
    return `equipment-${safe}`.slice(0, 36);
  }

  function storageEquipmentPhotoUrl(fileId, equipmentId = "") {
    const bucketId = String(APPWRITE_CONFIG?.equipmentPicturesBucketId || "").trim();
    const endpoint = String(APPWRITE_CONFIG?.endpoint || "").trim();
    const projectId = String(APPWRITE_CONFIG?.projectId || "").trim();
    const normalizedFileId = String(fileId || "").trim();
    if (!bucketId || !endpoint || !projectId || !normalizedFileId) return "";
    const base = endpoint.replace(/\/$/, "");
    const version = equipmentPhotoVersion(equipmentId || normalizedFileId);
    const query = new URLSearchParams({ project: projectId });
    if (version) query.set("v", version);
    return `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(normalizedFileId)}/view?${query.toString()}`;
  }

  function storageTeamLogoUrl(fileId) {
    const bucketId = String(APPWRITE_CONFIG?.teamsBucketId || "").trim();
    const endpoint = String(APPWRITE_CONFIG?.endpoint || "").trim();
    const projectId = String(APPWRITE_CONFIG?.projectId || "").trim();
    const normalizedFileId = String(fileId || "").trim();
    if (!bucketId || !endpoint || !projectId || !normalizedFileId) return "";
    const base = endpoint.replace(/\/$/, "");
    const query = new URLSearchParams({ project: projectId });
    return `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(normalizedFileId)}/view?${query.toString()}`;
  }

  function teamLogoUrl(teamName) {
    const normalizedTeamName = String(teamName || "").trim();
    if (!normalizedTeamName || normalizedTeamName.toUpperCase() === "TBA") return "";
    const fileId = TEAM_BUCKET_FILE_MAP[normalizedTeamName];
    return fileId ? storageTeamLogoUrl(fileId) : "";
  }

  function avatarFallbackOnErrorAttr() {
    const inlineFallback = INLINE_AVATAR_PLACEHOLDER.replaceAll("\"", "&quot;");
    return `this.src=&quot;${inlineFallback}&quot;;this.onerror=null;`;
  }

  async function uploadProfileAvatarToStorage(file) {
    const bucketId = String(APPWRITE_CONFIG?.profilePicturesBucketId || "").trim();
    if (!bucketId) {
      throw new Error("Missing profilePicturesBucketId in Appwrite config.");
    }
    const ownMember = signedInMemberRecord();
    const memberId = String(ownMember?.id || "").trim();
    if (!memberId) {
      throw new Error("Your account is not linked to a member profile yet.");
    }

    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Storage !== "function") {
      throw new Error("Appwrite Storage API is unavailable in this browser runtime.");
    }

    const client = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));

    const storage = new appwriteSdk.Storage(client);
    const fileId = profileAvatarFileId(memberId);

    try {
      if (typeof storage.deleteFile === "function") {
        await storage.deleteFile(bucketId, fileId);
      }
    } catch {
      // Ignore missing file errors; create below will handle fresh uploads.
    }

    await storage.createFile(bucketId, fileId, file);
    bumpProfileAvatarVersion(memberId);
    return storageAvatarUrlForMember(memberId);
  }

  async function uploadEquipmentPhotoToStorage(file, equipmentId) {
    const bucketId = String(APPWRITE_CONFIG?.equipmentPicturesBucketId || "").trim();
    if (!bucketId) {
      throw new Error("Missing equipmentPicturesBucketId in Appwrite config.");
    }
    const normalizedEquipmentId = String(equipmentId || "").trim();
    if (!normalizedEquipmentId) {
      throw new Error("Equipment item id is missing.");
    }

    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Storage !== "function") {
      throw new Error("Appwrite Storage API is unavailable in this browser runtime.");
    }

    const client = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));

    const storage = new appwriteSdk.Storage(client);
    const fileId = equipmentPhotoFileId(normalizedEquipmentId);

    try {
      if (typeof storage.deleteFile === "function") {
        await storage.deleteFile(bucketId, fileId);
      }
    } catch {
      // Ignore missing file errors; create below will handle fresh uploads.
    }

    await storage.createFile(bucketId, fileId, file);
    bumpEquipmentPhotoVersion(normalizedEquipmentId);
    return {
      photoFileId: fileId,
      photoUrl: storageEquipmentPhotoUrl(fileId, normalizedEquipmentId)
    };
  }

  async function deleteEquipmentPhotoFromStorage(equipmentId, photoFileId) {
    const bucketId = String(APPWRITE_CONFIG?.equipmentPicturesBucketId || "").trim();
    if (!bucketId) return;
    const normalizedEquipmentId = String(equipmentId || "").trim();
    const normalizedFileId = String(photoFileId || equipmentPhotoFileId(normalizedEquipmentId)).trim();
    if (!normalizedFileId) return;

    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Storage !== "function") {
      return;
    }

    const client = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));

    const storage = new appwriteSdk.Storage(client);
    try {
      await storage.deleteFile(bucketId, normalizedFileId);
    } catch {
      // Ignore missing file errors so photo removal stays idempotent.
    }
    bumpEquipmentPhotoVersion(normalizedEquipmentId);
  }

  function resolveEquipmentPhotoSrc(item) {
    const photoUrl = String(item?.photoUrl || item?.photo_url || "").trim();
    if (photoUrl) return photoUrl;
    const photoFileId = String(item?.photoFileId || item?.photo_file_id || "").trim();
    const equipmentId = String(item?.id || "").trim();
    const draftPhoto = equipmentId ? equipmentPhotoDraftsById[equipmentId] : null;
    if (draftPhoto?.photoUrl) return String(draftPhoto.photoUrl || "").trim();
    if (draftPhoto?.photoFileId) return storageEquipmentPhotoUrl(draftPhoto.photoFileId, equipmentId);
    if (photoFileId) return storageEquipmentPhotoUrl(photoFileId, equipmentId);
    return "";
  }

  function resolveAvatarSrcForMember(member) {
    const memberId = String(member?.id || "").trim();
    if (memberId) {
      const storageUrl = storageAvatarUrlForMember(memberId);
      if (storageUrl) return storageUrl;
    }
    if (member && authState.user && isOwnProfile(member)) {
      const localAvatar = loadProfileAvatar();
      if (localAvatar) return localAvatar;
    }
    if (DEFAULT_PROFILE_AVATAR_URL) return DEFAULT_PROFILE_AVATAR_URL;
    return INLINE_AVATAR_PLACEHOLDER;
  }

  function profileAvatarStorageKey() {
    const userId = String(authState.user?.id || "").trim();
    if (!userId) return "";
    return `clubhub-profile-avatar-${userId}`;
  }

  function loadProfileAvatar() {
    const key = profileAvatarStorageKey();
    if (!key) return "";
    return String(localStorage.getItem(key) || "").trim();
  }

  function saveProfileAvatar(dataUrl) {
    const key = profileAvatarStorageKey();
    if (!key) return;
    localStorage.setItem(key, String(dataUrl || "").trim());
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read selected image."));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElementFromFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not decode selected image."));
      };
      image.src = objectUrl;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not encode compressed image."));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality
      );
    });
  }

  async function compressImageForAvatar(file, { maxBytes = MAX_AVATAR_UPLOAD_BYTES, maxDimension = MAX_AVATAR_DIMENSION } = {}) {
    if (!file || Number(file.size || 0) <= maxBytes) return file;

    const sourceImage = await loadImageElementFromFile(file);
    const scale = Math.min(1, maxDimension / Math.max(sourceImage.width || 1, sourceImage.height || 1));
    let width = Math.max(1, Math.round((sourceImage.width || 1) * scale));
    let height = Math.max(1, Math.round((sourceImage.height || 1) * scale));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;

    let quality = 0.88;
    let compressedBlob = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(sourceImage, 0, 0, width, height);
      compressedBlob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (compressedBlob.size <= maxBytes) break;

      if (quality > 0.52) {
        quality -= 0.12;
      } else {
        width = Math.max(320, Math.round(width * 0.85));
        height = Math.max(320, Math.round(height * 0.85));
      }
    }

    if (!compressedBlob) return file;
    const baseName = String(file.name || "avatar").replace(/\.[^.]+$/, "");
    return new File([compressedBlob], `${baseName}-compressed.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  }

  function ensureToastStack() {
    let toastStack = document.getElementById("toast-stack");
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.id = "toast-stack";
      toastStack.className = "toast-stack";
      toastStack.setAttribute("aria-live", "polite");
      toastStack.setAttribute("aria-atomic", "true");
      document.body.appendChild(toastStack);
    }
    return toastStack;
  }

  function showToast(message, tone = "info") {
    const text = String(message || "").trim();
    if (!text) return;
    const toastStack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;
    toast.textContent = text;
    toastStack.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 220);
    }, 8000);
  }

  function buttonLabelForToast(button) {
    const explicitLabel = String(button?.dataset?.toast || "").trim();
    if (explicitLabel) return explicitLabel;
    const ariaLabel = String(button?.getAttribute("aria-label") || "").trim();
    if (ariaLabel) return ariaLabel;
    return String(button?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function bindButtonFeedback() {
    if (buttonFeedbackBound) return;
    buttonFeedbackBound = true;

    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button || button.disabled || button.dataset.noToast === "true") {
          return;
        }

        button.classList.add("is-clicked");
        window.setTimeout(() => {
          button.classList.remove("is-clicked");
        }, 180);

        const label = buttonLabelForToast(button);
        if (label) {
          showToast(label, button.classList.contains("danger-button") ? "error" : "info");
        }
      },
      true
    );
  }

  function loadStatusFilter() {
    try {
      const saved = localStorage.getItem(FEE_STATUS_FILTER_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveStatusFilter() {
    localStorage.setItem(FEE_STATUS_FILTER_KEY, JSON.stringify(selectedFeeStatuses));
  }

  function loadMemberFilters() {
    try {
      const saved = sessionStorage.getItem(MEMBER_FILTER_KEY);
      if (!saved) return { positions: [], roles: [], membership: ["active"], passStatuses: [], showDeleted: false, search: "" };
      const parsed = JSON.parse(saved);
      return {
        positions: Array.isArray(parsed?.positions) ? parsed.positions : [],
        roles: Array.isArray(parsed?.roles) ? parsed.roles : [],
        membership: Array.isArray(parsed?.membership) && parsed.membership.length ? parsed.membership : ["active"],
        passStatuses: Array.isArray(parsed?.passStatuses) ? parsed.passStatuses.filter(Boolean) : [],
        showDeleted: Boolean(parsed?.showDeleted),
        search: String(parsed?.search || "").trim()
      };
    } catch {
      return { positions: [], roles: [], membership: ["active"], passStatuses: [], showDeleted: false, search: "" };
    }
  }

  function saveMemberFilters() {
    sessionStorage.setItem(MEMBER_FILTER_KEY, JSON.stringify(memberFilters));
  }

  function loadPassFilters() {
    try {
      const saved = sessionStorage.getItem(PASS_FILTER_KEY);
      if (!saved) {
        return {
          search: "",
          from: "",
          to: "",
          statuses: [],
          positions: [],
          membership: ["active"],
          showDeleted: false
        };
      }
      const parsed = JSON.parse(saved);
      return {
        search: String(parsed?.search || "").trim(),
        from: String(parsed?.from || "").trim(),
        to: String(parsed?.to || "").trim(),
        statuses: Array.isArray(parsed?.statuses) ? parsed.statuses.filter(Boolean) : [],
        positions: Array.isArray(parsed?.positions) ? parsed.positions.filter(Boolean) : [],
        membership: Array.isArray(parsed?.membership) && parsed.membership.length ? parsed.membership.filter(Boolean) : ["active"],
        showDeleted: Boolean(parsed?.showDeleted)
      };
    } catch {
      return {
        search: "",
        from: "",
        to: "",
        statuses: [],
        positions: [],
        membership: ["active"],
        showDeleted: false
      };
    }
  }

  function savePassFilters() {
    sessionStorage.setItem(PASS_FILTER_KEY, JSON.stringify(passFilters));
  }

  function defaultTableSort() {
    return {
      members: { key: "lastName", direction: "asc" },
      fees: { key: "member", direction: "asc" },
      passes: { key: "firstName", direction: "asc" },
      equipment: { key: "article", direction: "asc" }
    };
  }

  function loadTableSort() {
    try {
      const saved = localStorage.getItem(TABLE_SORT_KEY);
      if (!saved) return defaultTableSort();
      const parsed = JSON.parse(saved);
      return {
        members: parsed?.members || defaultTableSort().members,
        fees: parsed?.fees || defaultTableSort().fees,
        passes: parsed?.passes || defaultTableSort().passes,
        equipment: parsed?.equipment || defaultTableSort().equipment
      };
    } catch {
      return defaultTableSort();
    }
  }

  function saveTableSort() {
    localStorage.setItem(TABLE_SORT_KEY, JSON.stringify(tableSort));
  }

  function splitNameParts(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" ")
    };
  }

  function normalizeLookupToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function memberNameTokens(member) {
    const fallback = splitNameParts(member?.name || "");
    const first = normalizeLookupToken(member?.firstName || fallback.firstName || "");
    const last = normalizeLookupToken(member?.lastName || fallback.lastName || "");
    const full = `${member?.firstName || ""} ${member?.lastName || ""} ${member?.name || ""}`;
    const fullTokens = String(full)
      .split(/\s+/)
      .map((part) => normalizeLookupToken(part))
      .filter(Boolean);
    const tokenSet = new Set(fullTokens);
    if (first) tokenSet.add(first);
    if (last) tokenSet.add(last);
    return {
      first,
      last,
      tokens: Array.from(tokenSet)
    };
  }

  function mergeSuggestionScore(keepMember, candidateMember) {
    const keep = memberNameTokens(keepMember);
    const candidate = memberNameTokens(candidateMember);
    const keepTokens = new Set(keep.tokens);
    const candidateTokens = new Set(candidate.tokens);
    let overlap = 0;
    keepTokens.forEach((token) => {
      if (candidateTokens.has(token)) overlap += 1;
    });

    let score = 0;
    if (keep.last && candidate.last && keep.last === candidate.last) score += 12;
    if (keep.first && candidate.first && (keep.first === candidate.first || keep.first.startsWith(candidate.first) || candidate.first.startsWith(keep.first))) score += 8;
    score += overlap * 2;
    if (keep.last && candidate.tokens.includes(keep.last)) score += 3;
    if (candidate.last && keep.tokens.includes(candidate.last)) score += 3;
    return score;
  }

  function capabilitySet(roles) {
    return Array.from(new Set(Array.isArray(roles) ? roles.filter(Boolean) : []));
  }

  function isLocalDevHost() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function isLocalhostAuthBypassEnabled() {
    return isLocalDevHost() && window.ClubHubLocalhostAuthBypass !== false;
  }

  function isLocalPreviewMode() {
    return isLocalhostAuthBypassEnabled() && !authState.user;
  }

  function shouldRequireAuth() {
    if (isLocalhostAuthBypassEnabled()) return false;
    const hasAppwriteConfig = Boolean(
      APPWRITE_CONFIG &&
      String(APPWRITE_CONFIG.projectId || "").trim() &&
      String(APPWRITE_CONFIG.databaseId || "").trim()
    );
    return Boolean(backendClient) || hasAppwriteConfig;
  }

  function extractUserRoles(user) {
    const metadata = user?.user_metadata || {};
    const appMetadata = user?.app_metadata || {};
    const rawRoles = Array.isArray(metadata.roles)
      ? metadata.roles
      : Array.isArray(appMetadata.roles)
        ? appMetadata.roles
        : [];
    return capabilitySet(rawRoles.map((role) => String(role || "").trim()).filter(Boolean));
  }

  function primaryRoleFromRoles(roles) {
    const available = capabilitySet(roles);
    const preferred = ["admin", "finance_admin", "coach", "tech_admin", "player", "staff"];
    return preferred.find((role) => available.includes(role)) || "player";
  }

  function authDisplayName() {
    const ownMember = signedInMemberRecord();
    if (ownMember?.name) return String(ownMember.name).trim();
    if (ownMember?.firstName || ownMember?.lastName) {
      const fullName = `${String(ownMember.firstName || "").trim()} ${String(ownMember.lastName || "").trim()}`.trim();
      if (fullName) return fullName;
    }
    const metadata = authState.user?.user_metadata || {};
    return String(metadata.full_name || metadata.name || authState.user?.email || "").trim();
  }

  function authActionActive(action) {
    return String(authState.pendingAction || "") === String(action || "");
  }

  function needsPasswordSetup() {
    return Boolean(authState.user) && !authState.user?.user_metadata?.password_set;
  }

  function syncAuthSession(session) {
    authState.ready = true;
    authState.loading = false;
    authState.user = session?.user || null;
    authState.roles = extractUserRoles(session?.user);
    if (authState.user) {
      if (authState.roles.length) {
        currentAccessRole = primaryRoleFromRoles(authState.roles);
      } else {
        currentAccessRole = loadStoredValue(ACCESS_KEY, currentAccessRole || "player");
      }
      saveStoredValue(ACCESS_KEY, currentAccessRole);
      authState.mode = "remote";
      if (needsPasswordSetup()) {
        authState.status = "Set your password to finish activating this account.";
        if (!/^recovery/i.test(String(window.location.hash || "").replace("#", ""))) {
          window.location.hash = "#recovery";
        }
      } else {
        authState.status = `Signed in as ${authDisplayName() || authState.user.full_name}.`;
      }
      return;
    }
    currentAccessRole = loadStoredValue(ACCESS_KEY, "admin");
    authState.mode = backendClient ? "remote" : "local";
    authState.status = isLocalPreviewMode()
      ? "Local preview mode active. Choose Admin or Athlete to test without sign-in."
      : shouldRequireAuth()
      ? "Sign in with email and password to continue."
      : (window.location.hostname.includes("localhost") || window.location.hostname === "127.0.0.1"
        ? "Local database mode active."
        : "Static preview mode active.");
  }

  function renderAuthGate() {
    const signInBusy = authActionActive("sign-in");
    const resetBusy = authActionActive("reset-password");
    const signOutBusy = authActionActive("sign-out");
    const authMessage = authState.loading
      ? "Checking your session..."
      : shouldRequireAuth()
        ? "Use your email and password to sign in. If you were invited, set your password from the email you received first."
        : "Sign in is available for Appwrite users, but local demo mode is still active on localhost.";

    return `
      <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
        <div>
          <p class="eyebrow">Authentication</p>
          <h3 style="margin-top: 4px;">Sign in</h3>
          <p class="muted">${authMessage}</p>
        </div>
        <div class="auth-status" role="status" aria-live="polite">${authState.status || "Enter your email and password to continue."}</div>
        ${signInBusy || resetBusy || signOutBusy ? `<div class="auth-progress"><span class="auth-spinner" aria-hidden="true"></span><span>${authState.status || "Working..."}</span></div>` : ""}
        <div class="form-grid">
          <label>Email<input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" ${signInBusy || resetBusy ? "disabled" : ""} /></label>
          <label>Password<input id="auth-password" type="password" autocomplete="current-password" placeholder="••••••••" /></label>
        </div>
        <div class="button-row">
          <button id="auth-sign-in" type="button" class="primary-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""}>${signInBusy ? "Signing in..." : "Sign in"}</button>
          <button id="auth-reset-password" type="button" class="ghost-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""} aria-label="Send password reset email">${resetBusy ? "Sending reset email..." : "Forgot password?"}</button>
          <button id="auth-sign-out" type="button" class="ghost-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""}>${signOutBusy ? "Signing out..." : "Sign out"}</button>
        </div>
        <p class="meta">Invited users must set their password first before normal sign-in. Use Forgot password? to send a reset email and return to the password setup screen.</p>
      </article>
    `;
  }

  async function signInWithEmailPassword(email, password) {
    if (!backendClient) {
      throw new Error("Appwrite auth is not configured.");
    }
    const response = await backendClient.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (response.error) {
      throw response.error;
    }
    if (response.data?.user && !response.data.user?.user_metadata?.password_set) {
      await backendClient.auth.updateUser({
        data: {
          ...(response.data.user.user_metadata || {}),
          password_set: true
        }
      });
    }
    syncAuthSession(response.data.session || null);
  }

  async function sendResetPasswordEmail(email) {
    if (!backendClient) {
      throw new Error("Appwrite auth is not configured.");
    }
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) {
      throw new Error("Enter your email address first.");
    }
    const redirectTo = window.location.href.startsWith("http")
      ? `${window.location.origin}${window.location.pathname}#recovery`
      : undefined;
    const response = await backendClient.auth.resetPasswordForEmail(normalizedEmail, {
      ...(redirectTo ? { redirectTo } : {})
    });
    if (response.error) {
      throw response.error;
    }
  }

  async function signOut() {
    if (!backendClient) return;
    const response = await backendClient.auth.signOut();
    if (response.error) {
      throw response.error;
    }
    syncAuthSession(null);
  }

  function readRecoveryParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashRaw = String(window.location.hash || "").replace(/^#/, "");
    const hashQueryPart = hashRaw.includes("?") ? hashRaw.split("?").slice(1).join("?") : hashRaw;
    const hashParams = new URLSearchParams(hashQueryPart);
    const userId = String(searchParams.get("userId") || hashParams.get("userId") || "").trim();
    const secret = String(searchParams.get("secret") || hashParams.get("secret") || "").trim();
    const email = String(searchParams.get("email") || hashParams.get("email") || "").trim();
    return { userId, secret, email };
  }

  async function setRecoveryPassword(password) {
    if (!backendClient) {
      throw new Error("Appwrite auth is not configured.");
    }
    recoveryState.loading = true;
    recoveryState.status = "Setting password...";
    try {
      const recovery = readRecoveryParams();
      const usingRecoveryToken = Boolean(recovery.userId && recovery.secret);
      const response = usingRecoveryToken
        ? await backendClient.auth.updateRecovery({
            userId: recovery.userId,
            secret: recovery.secret,
            password: String(password || "")
          })
        : await backendClient.auth.updateUser({
            password: String(password || ""),
            data: {
              ...(authState.user?.user_metadata || {}),
              password_set: true
            }
          });
      if (response.error) {
        throw response.error;
      }
      if (response.data?.user) {
        syncAuthSession({ user: response.data.user });
      }
      recoveryState.status = "Password set successfully! Redirecting...";
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + "#dashboard";
      }, 1500);
    } catch (error) {
      recoveryState.status = error.message || "Failed to set password.";
    } finally {
      recoveryState.loading = false;
    }
  }

  function renderRecoveryGate() {
    const recovery = readRecoveryParams();
    const hasRecoveryToken = Boolean(recovery.userId && recovery.secret);
    const email = authState.user?.email || recovery.email || "your email";
    const isFirstTime = hasRecoveryToken || !authState.user?.user_metadata?.password_set;

    if (!authState.user && !hasRecoveryToken) {
      return `
        <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
          <div>
            <p class="eyebrow">Password setup</p>
            <h3 style="margin-top: 4px;">This recovery link is no longer active</h3>
            <p class="muted">Invite and reset links are time-limited. Request a new invite or use Forgot password? from the sign-in screen to get a fresh link.</p>
          </div>
          <div class="auth-status" role="status" aria-live="polite">No active recovery session was found.</div>
          <div class="button-row">
            <button id="recovery-back-to-sign-in" type="button" class="primary-button" data-no-toast="true">Back to sign in</button>
          </div>
        </article>
      `;
    }

    return `
      <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
        <div>
          <p class="eyebrow">Set Your Password</p>
          <h3 style="margin-top: 4px;">${isFirstTime ? "Complete Your Registration" : "Reset Your Password"}</h3>
          <p class="muted">${isFirstTime ? "You were invited to join Uni Wien Emperors. Set a password to activate your account." : "Create a new password for your account."}</p>
        </div>
        <div>
          <p><strong>Email:</strong> ${email}</p>
        </div>
        <div class="form-grid">
          <label>New Password<input id="recovery-password" type="password" autocomplete="new-password" placeholder="••••••••" minlength="8" /></label>
          <label>Confirm Password<input id="recovery-password-confirm" type="password" autocomplete="new-password" placeholder="••••••••" minlength="8" /></label>
        </div>
        <div class="button-row">
          <button id="recovery-submit" type="button" class="primary-button" ${recoveryState.loading ? "disabled" : ""}>${recoveryState.loading ? "Setting password..." : "Set Password"}</button>
          ${(!isFirstTime && authState.user) ? `<button id="recovery-cancel" type="button" class="ghost-button">Cancel</button>` : ""}
        </div>
        ${recoveryState.status ? `<p class="meta" style="color: ${recoveryState.status.includes("successfully") ? "#00aa00" : "#ff6b6b"};">${recoveryState.status}</p>` : ""}
        <p class="meta">Your password must be at least 8 characters long.</p>
      </article>
    `;
  }

  async function inviteRecipient(payload) {
    if (!backendClient) {
      throw new Error("Appwrite client not configured. Cannot send invites.");
    }
    const memberId = String(payload?.memberId || "").trim();
    const resolvedMember = memberId ? memberById(memberId) : null;
    const email = String(payload?.email || resolvedMember?.email || "").trim();
    const fullName = String(
      payload?.fullName ||
      resolvedMember?.name ||
      `${resolvedMember?.firstName || ""} ${resolvedMember?.lastName || ""}`
    ).trim();
    const roles = Array.isArray(payload?.roles)
      ? payload.roles
      : Array.isArray(resolvedMember?.roles)
        ? resolvedMember.roles
        : ["player"];
    if (!email) {
      throw new Error("Invite email is missing for this member.");
    }

    const invokeInviteFunction = async ({ sendRecovery = true } = {}) => {
      const functionId = String(APPWRITE_CONFIG?.inviteFunctionId || "").trim();
      if (!functionId) {
        throw new Error("Invite function is required. Configure ClubHubAppwriteConfig.inviteFunctionId to create auth users before sending invites.");
      }

      const appwriteSdk = window.Appwrite || window.appwrite;
      if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Functions !== "function") {
        throw new Error("Appwrite SDK Functions API is unavailable in this browser runtime.");
      }

      const inviteClient = new appwriteSdk.Client()
        .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
        .setProject(String(APPWRITE_CONFIG?.projectId || ""));

      const functionsApi = new appwriteSdk.Functions(inviteClient);
      const execution = await functionsApi.createExecution(
        functionId,
        JSON.stringify({
          email,
          fullName,
          roles,
          memberId,
          sendRecovery,
          redirectTo: `${window.location.origin}${window.location.pathname}#recovery`
        }),
        false
      );

      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const terminalStatuses = new Set(["completed", "failed", "crashed", "timeout", "canceled"]);
      let finalExecution = execution;

      // Some runtimes return an execution before logs/body are finalized.
      for (let i = 0; i < 8; i += 1) {
        const status = String(finalExecution?.status || "").toLowerCase();
        if (terminalStatuses.has(status)) break;
        if (typeof functionsApi.getExecution === "function" && finalExecution?.$id) {
          await wait(350);
          finalExecution = await functionsApi.getExecution(functionId, String(finalExecution.$id));
          continue;
        }
        break;
      }

      const finalStatus = String(finalExecution?.status || "").toLowerCase();
      if (finalStatus && finalStatus !== "completed") {
        const statusCode = String(finalExecution?.responseStatusCode || "").trim();
        const stderr = String(finalExecution?.stderr || "").trim();
        const bodyText = String(finalExecution?.responseBody || "").trim();
        throw new Error(
          `Invite function failed (${finalStatus}${statusCode ? `:${statusCode}` : ""}). ${stderr || bodyText || "Check function logs in Appwrite Console."}`.trim()
        );
      }

      const responseBodyRaw = String(finalExecution?.responseBody || "").trim();
      let parsedBody = null;
      if (responseBodyRaw) {
        try {
          parsedBody = JSON.parse(responseBodyRaw);
          if (parsedBody?.error) {
            throw new Error(String(parsedBody.error));
          }
        } catch (parseError) {
          const parseMessage = String(parseError?.message || "");
          if (!parseMessage.toLowerCase().includes("json")) {
            throw parseError;
          }
        }
      }

      return parsedBody;
    };

    const redirectTo = `${window.location.origin}${window.location.pathname}#recovery`;
    let functionResult = null;
    let functionFailureMessage = "";
    try {
      functionResult = await invokeInviteFunction({ sendRecovery: true });
    } catch (error) {
      functionFailureMessage = String(error?.message || "Invite function failed.").trim();
    }

    const alreadySentRecovery = Boolean(functionResult?.ok && functionResult?.recoverySent);
    let response = { data: {}, error: null };
    if (!alreadySentRecovery) {
      response = await backendClient.auth.resetPasswordForEmail(email, { redirectTo });
    }
    if (response?.error) {
      if (functionFailureMessage) {
        throw new Error(`${functionFailureMessage} Recovery fallback failed: ${response.error.message || "Could not send recovery email."}`);
      }
      throw response.error;
    }

    if (memberId) {
      const updateResponse = await backendClient.from("members").update({ invite_sent_at: new Date().toISOString() }).eq("id", memberId);
      if (updateResponse.error) {
        throw updateResponse.error;
      }
    }

    return { ok: true, usedRecoveryFallback: Boolean(functionFailureMessage) };
  }

  async function provisionAuthForMember({ memberId, email, fullName, roles }) {
    const functionId = String(APPWRITE_CONFIG?.inviteFunctionId || "").trim();
    if (!functionId) {
      throw new Error("Missing inviteFunctionId. Cannot provision auth user on member creation.");
    }
    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Functions !== "function") {
      throw new Error("Appwrite Functions API is unavailable in this browser runtime.");
    }
    const functionClient = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));
    const functionsApi = new appwriteSdk.Functions(functionClient);
    const execution = await functionsApi.createExecution(
      functionId,
      JSON.stringify({
        email,
        fullName,
        roles,
        memberId,
        sendRecovery: false,
        redirectTo: `${window.location.origin}${window.location.pathname}#recovery`
      }),
      false
    );

    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const terminalStatuses = new Set(["completed", "failed", "crashed", "timeout", "canceled"]);
    let finalExecution = execution;

    for (let i = 0; i < 8; i += 1) {
      const status = String(finalExecution?.status || "").toLowerCase();
      if (terminalStatuses.has(status)) break;
      if (typeof functionsApi.getExecution === "function" && finalExecution?.$id) {
        await wait(350);
        finalExecution = await functionsApi.getExecution(functionId, String(finalExecution.$id));
        continue;
      }
      break;
    }

    const finalStatus = String(finalExecution?.status || "").toLowerCase();
    if (finalStatus && finalStatus !== "completed") {
      const statusCode = String(finalExecution?.responseStatusCode || "").trim();
      const stderr = String(finalExecution?.stderr || "").trim();
      const bodyText = String(finalExecution?.responseBody || "").trim();
      throw new Error(
        `Auth provisioning function failed (${finalStatus}${statusCode ? `:${statusCode}` : ""}). ${stderr || bodyText || "Check function logs in Appwrite Console."}`.trim()
      );
    }

    const responseBodyRaw = String(finalExecution?.responseBody || "").trim();
    if (responseBodyRaw) {
      try {
        const parsedBody = JSON.parse(responseBodyRaw);
        if (parsedBody?.error) {
          throw new Error(String(parsedBody.error));
        }
      } catch (parseError) {
        const parseMessage = String(parseError?.message || "");
        if (!parseMessage.toLowerCase().includes("json")) {
          throw parseError;
        }
      }
    }
  }

  async function inviteMember(memberId) {
    const member = memberById(memberId);
    return inviteRecipient({ memberId, email: member?.email || "" });
  }

  async function inviteAdmin(email, fullName, roles) {
    return inviteRecipient({ email, fullName, roles });
  }

  function normalizeMember(member, index) {
    const fallbackParts = splitNameParts(member.name || "");
    const firstName = String(member.firstName || fallbackParts.firstName || "").trim();
    const lastName = String(member.lastName || fallbackParts.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || member.name || "Unknown member";
    return {
      id: member.id || `member-${index + 1}`,
      firstName,
      lastName,
      name: fullName,
      email: member.email || "",
      iban: String(member.iban || "").trim(),
      memberIban: String(member.memberIban || member.iban || "").trim(),
      positions: Array.isArray(member.positions) ? member.positions.filter(Boolean) : [],
      roles: capabilitySet(Array.isArray(member.roles) ? member.roles : ["player"]),
      jerseyNumber: member.jerseyNumber === null || member.jerseyNumber === undefined || member.jerseyNumber === "" ? null : Number(member.jerseyNumber),
      active: Boolean(member.active),
      rookie: Boolean(member.rookie),
      inClubee: Boolean(member.inClubee),
      membershipStatus: member.membershipStatus || (member.active ? "active" : "inactive"),
      deletedAt: member.deletedAt || null,
      profileId: member.profileId || null,
      inviteSentAt: member.inviteSentAt || null,
      activatedAt: member.activatedAt || null,
      passStatus: member.passStatus || "missing",
      passExpiry: member.passExpiry || "",
      licenseName: member.licenseName || "",
      feeStatus: member.feeStatus || "pending",
      notes: member.notes || "",
      lastInviteResponse: member.lastInviteResponse || "pending"
    };
  }

  function normalizeFee(fee, index) {
    return {
      id: fee.id || `fee-${index + 1}`,
      memberId: fee.memberId,
      season: String(fee.season || ""),
      feePeriod: String(fee.feePeriod || fee.period || ""),
      amount: Number(fee.amount || 0),
      paidAmount: Number(fee.paidAmount || 0),
      status: fee.status || "pending",
      iban: String(fee.iban || "").trim(),
      note: fee.note || ""
    };
  }

  function generateEquipmentId() {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `equipment-${Date.now()}-${randomPart}`;
  }

  function normalizeEquipmentSheetKey(value) {
    return normalizeLookupToken(value).replace(/^sheet/, "");
  }

  function prettifyEquipmentSheetLabel(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "Custom";
    return normalized
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function defaultEquipmentSheetEntries() {
    return DEFAULT_EQUIPMENT_SHEETS.map((sheet) => ({ key: sheet.key, label: sheet.label }));
  }

  function equipmentSheetEntries() {
    return Array.isArray(equipmentSheets) && equipmentSheets.length
      ? equipmentSheets
      : defaultEquipmentSheetEntries();
  }

  function isBuiltinEquipmentSheetKey(sheetKey) {
    const normalized = normalizeEquipmentSheetKey(sheetKey);
    return DEFAULT_EQUIPMENT_SHEETS.some((sheet) => sheet.key === normalized);
  }

  function saveEquipmentSheets() {
    const custom = equipmentSheetEntries().filter((sheet) => !isBuiltinEquipmentSheetKey(sheet.key));
    localStorage.setItem(EQUIPMENT_SHEETS_STORAGE_KEY, JSON.stringify(custom));
  }

  function loadEquipmentSheets() {
    const byKey = new Map();
    defaultEquipmentSheetEntries().forEach((sheet) => {
      byKey.set(sheet.key, { key: sheet.key, label: sheet.label });
    });

    try {
      const saved = localStorage.getItem(EQUIPMENT_SHEETS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          const rawLabel = typeof entry === "string" ? entry : String(entry?.label || entry?.key || "").trim();
          const normalizedKey = normalizeEquipmentSheetKey(typeof entry === "string" ? entry : (entry?.key || rawLabel));
          if (!normalizedKey || normalizedKey === "all" || isBuiltinEquipmentSheetKey(normalizedKey)) return;
          const label = String(rawLabel || prettifyEquipmentSheetLabel(normalizedKey)).trim() || prettifyEquipmentSheetLabel(normalizedKey);
          byKey.set(normalizedKey, { key: normalizedKey, label });
        });
      }
    } catch {
      // Ignore invalid stored sheet config.
    }

    const allEntry = byKey.get("all") || { key: "all", label: "All sheets" };
    byKey.delete("all");
    const base = DEFAULT_EQUIPMENT_SHEETS
      .filter((sheet) => sheet.key !== "all")
      .map((sheet) => byKey.get(sheet.key) || { key: sheet.key, label: sheet.label });

    const custom = Array.from(byKey.values())
      .filter((sheet) => !isBuiltinEquipmentSheetKey(sheet.key))
      .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), undefined, { sensitivity: "base" }));

    return [allEntry, ...base, ...custom];
  }

  function addEquipmentSheet(sheetLabel) {
    const label = String(sheetLabel || "").trim();
    const key = normalizeEquipmentSheetKey(label);
    if (!label) {
      throw new Error("Sheet name is required.");
    }
    if (!key || key === "all") {
      throw new Error("Choose a different sheet name.");
    }
    if (equipmentSheetEntries().some((sheet) => sheet.key === key)) {
      throw new Error("A sheet with that name already exists.");
    }

    const allEntry = equipmentSheetEntries().find((sheet) => sheet.key === "all") || { key: "all", label: "All sheets" };
    const withoutAll = equipmentSheetEntries().filter((sheet) => sheet.key !== "all");
    equipmentSheets = [allEntry, ...withoutAll, { key, label }];
    saveEquipmentSheets();
    saveEquipmentSheetKey(key);
    return key;
  }

  function removeEquipmentSheet(sheetKey) {
    const normalized = normalizeEquipmentSheetKey(sheetKey);
    if (!normalized || normalized === "all" || isBuiltinEquipmentSheetKey(normalized)) {
      throw new Error("This sheet cannot be removed.");
    }
    equipmentSheets = equipmentSheetEntries().filter((sheet) => sheet.key !== normalized);
    saveEquipmentSheets();
    if (selectedEquipmentSheet === normalized) {
      saveEquipmentSheetKey("all");
    }
  }

  function availableEquipmentSheetKeys() {
    return equipmentSheetEntries().map((sheet) => sheet.key);
  }

  function resolveEquipmentSheetKey(sheetKey) {
    const normalized = normalizeEquipmentSheetKey(sheetKey);
    if (equipmentSheetEntries().some((sheet) => sheet.key === normalized)) {
      return normalized;
    }
    return "all";
  }

  function equipmentSheetLabel(sheetKey) {
    const normalized = resolveEquipmentSheetKey(sheetKey);
    const preset = equipmentSheetEntries().find((sheet) => sheet.key === normalized);
    return preset?.label || "General";
  }

  function equipmentSheetPromptDefaultGroup(sheetKey) {
    const normalized = resolveEquipmentSheetKey(sheetKey);
    if (normalized === "all") {
      const first = equipmentSheetEntries().find((sheet) => sheet.key !== "all");
      return first?.label || "Training";
    }
    return equipmentSheetLabel(normalized);
  }

  function equipmentGroupOptions() {
    const defaults = equipmentSheetEntries()
      .filter((sheet) => sheet.key !== "all")
      .map((sheet) => String(sheet.label || "").trim())
      .filter(Boolean);
    const fromRows = Array.from(new Set((state.equipment || []).map((item) => String(item.group || "").trim()).filter(Boolean)));
    const all = Array.from(new Set([...defaults, ...fromRows]));
    return all.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  }

  function createEquipmentDraft(initial = {}, fallbackGroup = "Training") {
    return normalizeEquipmentItem(
      {
        id: initial.id || generateEquipmentId(),
        group: initial.group || fallbackGroup,
        itemKind: initial.itemKind || initial.item_kind || "item",
        parentItemId: initial.parentItemId || initial.parent_item_id || "",
        category: initial.category || "",
        article: initial.article || "",
        quantity: initial.quantity || "",
        condition: initial.condition || "",
        location: initial.location || "",
        checkedAt: initial.checkedAt ? normalizeToIsoDate(initial.checkedAt) : (initial.id ? "" : getTodayIsoDate()),
        notes: initial.notes || "",
        photoFileId: initial.photoFileId || initial.photo_file_id || "",
        photoUrl: initial.photoUrl || initial.photo_url || ""
      },
      0
    );
  }

  function equipmentSheetRows(rows, sheetKey) {
    const normalizedSheetKey = resolveEquipmentSheetKey(sheetKey);
    const normalizedRows = sortEquipmentRows(rows);
    if (normalizedSheetKey === "all") {
      return normalizedRows;
    }
    return normalizedRows.filter((row) => normalizeEquipmentSheetKey(row.group) === normalizedSheetKey);
  }

  function saveEquipmentSheetKey(sheetKey) {
    const normalized = resolveEquipmentSheetKey(sheetKey);
    selectedEquipmentSheet = normalized;
    saveStoredValue(EQUIPMENT_SHEET_KEY, normalized);
  }

  function equipmentSheetCounts(rows) {
    const normalizedRows = sortEquipmentRows(rows);
    return equipmentSheetEntries().map((sheet) => ({
      ...sheet,
      count: sheet.key === "all"
        ? normalizedRows.length
        : normalizedRows.filter((row) => normalizeEquipmentSheetKey(row.group) === sheet.key).length
    }));
  }

  function normalizeEquipmentKindFilter(value) {
    const normalized = String(value || "all").trim().toLowerCase();
    if (normalized === "containers") return "containers";
    if (normalized === "items") return "items";
    return "all";
  }

  function saveEquipmentKindFilter(value) {
    const normalized = normalizeEquipmentKindFilter(value);
    selectedEquipmentKindFilter = normalized;
    saveStoredValue(EQUIPMENT_KIND_FILTER_KEY, normalized);
  }

  function filterEquipmentRowsByKind(rows, kindFilter) {
    const normalized = normalizeEquipmentKindFilter(kindFilter);
    if (normalized === "containers") {
      return rows.filter((row) => String(row.itemKind || "").toLowerCase() === "container");
    }
    if (normalized === "items") {
      return rows.filter((row) => String(row.itemKind || "").toLowerCase() !== "container");
    }
    return rows;
  }

  function normalizeEquipmentItem(item, index) {
    const itemKindRaw = String(item?.itemKind ?? item?.item_kind ?? "item").trim().toLowerCase();
    const itemKind = itemKindRaw === "container" ? "container" : "item";
    const id = String(item?.id || `equipment-${index + 1}`).trim();
    const parentItemIdRaw = String(item?.parentItemId ?? item?.parent_item_id ?? "").trim();
    const parentItemId = itemKind === "container" || parentItemIdRaw === id ? "" : parentItemIdRaw;
    return {
      id,
      group: String(item?.group || "General").trim() || "General",
      itemKind,
      parentItemId,
      category: String(item?.category || "").trim(),
      article: String(item?.article || "").trim(),
      quantity: String(item?.quantity || "").trim(),
      condition: String(item?.condition || "").trim(),
      location: String(item?.location || "").trim(),
      checkedAt: normalizeToIsoDate(item?.checkedAt),
      notes: String(item?.notes || "").trim(),
      photoFileId: String(item?.photoFileId ?? item?.photo_file_id ?? "").trim(),
      photoUrl: String(item?.photoUrl ?? item?.photo_url ?? "").trim()
    };
  }

  function normalizeEquipmentRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((item, index) => normalizeEquipmentItem(item, index))
      .filter((item) => item.article || item.category || item.quantity || item.location || item.notes || item.parentItemId);
  }

  function generateOrganizationId() {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `organization-${Date.now()}-${randomPart}`;
  }

  function organizationRowValue(row, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const direct = row?.[key];
      if (direct !== undefined) return direct;
      const camel = String(key || "").replace(/-([a-z])/gi, function (_, letter) {
        return String(letter || "").toUpperCase();
      });
      if (row && Object.prototype.hasOwnProperty.call(row, camel)) return row[camel];
      const underscore = String(key || "").replace(/-/g, "_");
      if (row && Object.prototype.hasOwnProperty.call(row, underscore)) return row[underscore];
    }
    return undefined;
  }

  function normalizeOrganizationEntry(row, index) {
    return {
      id: String(organizationRowValue(row, ["id", "$id"]) || `organization-${index + 1}`).trim(),
      headOf: String(organizationRowValue(row, ["Head-of", "head_of", "headOf", "head"]) || "").trim(),
      verantwortung: String(organizationRowValue(row, ["verantwortung"]) || "").trim(),
      coVerantwortung: String(organizationRowValue(row, ["co-verantwortung", "co_verantwortung", "coVerantwortung"]) || "").trim(),
      aufgaben: String(organizationRowValue(row, ["aufgaben"]) || "").trim()
    };
  }

  function sortOrganizationRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => normalizeOrganizationEntry(row, index))
      .filter((row) => row.headOf || row.verantwortung || row.coVerantwortung || row.aufgaben)
      .sort((left, right) => String(left.headOf || "").localeCompare(String(right.headOf || ""), undefined, { sensitivity: "base" }));
  }

  function sortEquipmentRows(rows) {
    const sorted = [...normalizeEquipmentRows(rows)].sort((left, right) => {
      const groupCompare = String(left.group || "").localeCompare(String(right.group || ""), undefined, { sensitivity: "base" });
      if (groupCompare !== 0) return groupCompare;
      const categoryCompare = String(left.category || "").localeCompare(String(right.category || ""), undefined, { sensitivity: "base" });
      if (categoryCompare !== 0) return categoryCompare;
      return String(left.article || "").localeCompare(String(right.article || ""), undefined, { sensitivity: "base" });
    });
    const byParent = new Map();
    sorted.forEach((item) => {
      const parentId = String(item.parentItemId || "").trim();
      if (!parentId) return;
      const list = byParent.get(parentId) || [];
      list.push(item);
      byParent.set(parentId, list);
    });
    const roots = [];
    const seen = new Set();
    sorted.forEach((item) => {
      const parentId = String(item.parentItemId || "").trim();
      const parentExists = parentId && sorted.some((candidate) => String(candidate.id) === parentId);
      if (!parentId || !parentExists) {
        roots.push(item);
      }
    });
    const flattened = [];
    const appendItem = (item) => {
      const itemId = String(item.id || "");
      if (!itemId || seen.has(itemId)) return;
      seen.add(itemId);
      flattened.push(item);
      const children = byParent.get(itemId) || [];
      children.forEach(appendItem);
    };
    roots.forEach(appendItem);
    sorted.forEach(appendItem);
    return flattened;
  }

  function equipmentContainerOptions(rows, currentItemId = "", groupHint = "") {
    return sortEquipmentRows(rows)
      .filter((item) => item.itemKind === "container")
      .filter((item) => String(item.id) !== String(currentItemId || ""))
      .filter((item) => !groupHint || String(item.group || "").trim().toLowerCase() === String(groupHint || "").trim().toLowerCase());
  }

  function isEquipmentContainerExpanded(containerId) {
    return expandedEquipmentContainerIds.includes(String(containerId || "").trim());
  }

  function setEquipmentContainerExpanded(containerId, expanded) {
    const normalizedId = String(containerId || "").trim();
    if (!normalizedId) return;
    const next = new Set(expandedEquipmentContainerIds);
    if (expanded) next.add(normalizedId);
    else next.delete(normalizedId);
    expandedEquipmentContainerIds = Array.from(next);
    saveStoredArray(EQUIPMENT_EXPANDED_CONTAINERS_KEY, expandedEquipmentContainerIds);
  }

  function loadEquipmentFromStorage() {
    try {
      const saved = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (!saved) return [];
      return sortEquipmentRows(JSON.parse(saved));
    } catch {
      return [];
    }
  }

  function saveEquipmentToStorage(rows) {
    const normalizedRows = sortEquipmentRows(rows);
    localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(normalizedRows));
    setCacheWithTTL(EQUIPMENT_CACHE_KEY, normalizedRows);
    state.equipment = normalizedRows;
    saveState();
  }

  function normalizeState(value) {
    return {
      source: value.source || "demo",
      permissionsModel: value.permissionsModel || demoData.permissionsModel,
      members: Array.isArray(value.members) ? value.members.map(normalizeMember) : [],
      fees: Array.isArray(value.fees) ? value.fees.map(normalizeFee) : [],
      events: Array.isArray(value.events) ? value.events : [],
      invites: Array.isArray(value.invites) ? value.invites : [],
      organization: sortOrganizationRows(value.organization),
      equipment: sortEquipmentRows(value.equipment)
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return normalizeState(demoData);
      return normalizeState(JSON.parse(saved));
    } catch {
      return normalizeState(demoData);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "emperors-local-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function canAccess(area) {
    const restricted = bootstrapMeta.permissionsModel?.restrictedAreas?.[area];
    if (!Array.isArray(restricted) || !restricted.length) return true;
    return capabilitySet([currentAccessRole]).some((role) => restricted.includes(role));
  }

  function memberName(memberId) {
    const member = state.members.find((item) => String(item.id) === String(memberId));
    return member ? member.name : "Unknown";
  }

  function memberById(memberId) {
    return state.members.find((item) => String(item.id) === String(memberId)) || null;
  }

  function signedInUserEmail() {
    return String(authState.user?.email || "").trim().toLowerCase();
  }

  function signedInUserMemberId() {
    const metadata = authState.user?.user_metadata || {};
    const appMetadata = authState.user?.app_metadata || {};
    return String(metadata.member_id || appMetadata.member_id || "").trim();
  }

  function signedInMemberRecord() {
    if (!authState.user) return null;
    const explicitMemberId = signedInUserMemberId();
    if (explicitMemberId) {
      const explicitMatch = state.members.find((member) => String(member.id || "") === explicitMemberId);
      if (explicitMatch) return explicitMatch;
    }
    const profileMatch = state.members.find((member) => String(member.profileId || "") === String(authState.user.id || ""));
    if (profileMatch) return profileMatch;
    const email = signedInUserEmail();
    if (!email) return null;
    return state.members.find((member) => String(member.email || "").trim().toLowerCase() === email) || null;
  }

  async function repairCurrentUserMemberLink() {
    if (!backendClient || !authState.user) return;

    const currentUserId = String(authState.user?.id || "").trim();
    const currentUserEmail = String(authState.user?.email || "").trim().toLowerCase();
    if (!currentUserId || !currentUserEmail) return;

    const memberRowsResponse = await backendClient
      .from("members")
      .select("id, email, profile_id, deleted_at");

    if (memberRowsResponse.error) {
      throw memberRowsResponse.error;
    }

    const memberRows = Array.isArray(memberRowsResponse.data) ? memberRowsResponse.data : [];
    const exactEmailMatches = memberRows.filter((row) => String(row?.email || "").trim().toLowerCase() === currentUserEmail);
    if (!exactEmailMatches.length) return;

    if (exactEmailMatches.some((row) => String(row?.profile_id || "").trim() === currentUserId)) {
      return;
    }

    const nonDeletedMatches = exactEmailMatches.filter((row) => !row?.deleted_at);
    const preferredPool = nonDeletedMatches.length ? nonDeletedMatches : exactEmailMatches;
    const candidates = preferredPool.filter((row) => !String(row?.profile_id || "").trim());

    if (candidates.length !== 1) {
      return;
    }

    const targetMemberId = String(candidates[0]?.id || "").trim();
    if (!targetMemberId) return;

    const updateResponse = await backendClient
      .from("members")
      .update({ profile_id: currentUserId })
      .eq("id", targetMemberId);

    if (updateResponse.error) {
      throw updateResponse.error;
    }
  }

  function canEditMemberProfile(member) {
    if (!member) return false;
    if (currentAccessRole === "admin") return true;
    if (currentAccessRole !== "player") return false;

    const loggedInMemberId = signedInUserMemberId();
    if (loggedInMemberId && String(member.id) === loggedInMemberId) return true;

    const loggedInEmail = signedInUserEmail();
    if (!loggedInEmail) return false;
    return String(member.email || "").trim().toLowerCase() === loggedInEmail;
  }

  function isOwnProfile(member) {
    if (!member) return false;
    const loggedInMemberId = String(signedInUserMemberId() || "").trim();
    if (loggedInMemberId && String(member.id) === loggedInMemberId) return true;
    const loggedInEmail = signedInUserEmail();
    if (!loggedInEmail) return false;
    return String(member.email || "").trim().toLowerCase() === loggedInEmail;
  }

  function canViewSensitiveProfileFields(member) {
    return currentAccessRole === "admin" || isOwnProfile(member);
  }

  function shiftQuarterToken(token, offset) {
    const [quarterRaw, yearRaw] = String(token || "Q1_2025").split("_");
    let quarter = Number(String(quarterRaw || "Q1").replace("Q", "")) || 1;
    let year = Number(yearRaw || 2025);
    for (let i = 0; i < Math.abs(offset); i += 1) {
      if (offset > 0) {
        quarter += 1;
        if (quarter > 4) {
          quarter = 1;
          year += 1;
        }
      } else {
        quarter -= 1;
        if (quarter < 1) {
          quarter = 4;
          year -= 1;
        }
      }
    }
    return `Q${quarter}_${year}`;
  }

  function profileQuarterWindowTokens() {
    const current = currentQuarterToken();
    return [
      shiftQuarterToken(current, -4),
      shiftQuarterToken(current, -3),
      shiftQuarterToken(current, -2),
      shiftQuarterToken(current, -1),
      current,
      shiftQuarterToken(current, 1),
      shiftQuarterToken(current, 2)
    ];
  }

  function memberFeesByPeriod(memberId) {
    if (profileFinanceModule && typeof profileFinanceModule.memberFeesByPeriod === "function") {
      return profileFinanceModule.memberFeesByPeriod(state.fees, memberId);
    }
    const map = new Map();
    state.fees
      .filter((fee) => String(fee.memberId) === String(memberId))
      .forEach((fee) => {
        if (fee.feePeriod) map.set(fee.feePeriod, fee);
      });
    return map;
  }

  function memberIban(memberId) {
    const member = memberById(memberId);
    if (profileFinanceModule && typeof profileFinanceModule.memberIban === "function") {
      return profileFinanceModule.memberIban(member, state.fees, memberId);
    }
    const memberLevelIban = String(member?.iban || "").trim();
    if (memberLevelIban) return memberLevelIban;
    const fees = state.fees
      .filter((fee) => String(fee.memberId) === String(memberId) && String(fee.iban || "").trim())
      .sort((left, right) => String(right.feePeriod || "").localeCompare(String(left.feePeriod || "")));
    return fees[0]?.iban || "";
  }

  function memberFirstName(memberId) {
    const member = memberById(memberId);
    if (!member) return "";
    if (member.firstName) return member.firstName;
    return splitNameParts(member.name).firstName;
  }

  function memberLastName(memberId) {
    const member = memberById(memberId);
    if (!member) return "";
    if (member.lastName) return member.lastName;
    return splitNameParts(member.name).lastName;
  }

  function statusLabel(value) {
    const normalized = String(value || "pending").toLowerCase();
    if (normalized === "paid_rookie_fee") return "paid rookie fee";
    if (normalized === "paid_with_fee") return "paid with fee";
    if (normalized === "not_applicable") return "not in team";
    return normalized.replaceAll("_", " ");
  }

  function statusPill(value, label) {
    const normalized = String(value || "pending").toLowerCase();
    return `<span class="status ${normalized}">${label || statusLabel(normalized)}</span>`;
  }

  function roleLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    const labels = {
      player: "Athlete",
      admin: "Admin",
      finance_admin: "Finance",
      tech_admin: "Tech",
      coach: "Coach",
      staff: "Staff"
    };
    return labels[normalized] || value;
  }

  function rolePill(value) {
    return plainPill(roleLabel(value));
  }

  function memberInviteState(member) {
    if (member?.activatedAt) return "activated";
    if (member?.inviteSentAt) return "invited";
    if (member?.profileId) return "activated"; // Fallback for old records without activatedAt
    return "ready";
  }

  function renderMemberInviteAction(member) {
    if (currentAccessRole !== "admin") return "";
    if (member?.deletedAt) return "";
    if (!String(member?.email || "").trim()) return "";
    const state = memberInviteState(member);
    if (state === "activated") return "";
    const label = state === "invited" ? "Invited" : "Invite";
    return `<button class="ghost-button small-button invite-member-button" type="button" data-member-id="${member.id}" data-invite-state="${state}">${label}</button>`;
  }

  function memberInviteStateLabel(member) {
    const state = memberInviteState(member);
    if (state === "activated") return "Activated";
    if (state === "invited") return "Invite pending";
    return "Not invited";
  }

  function renderMemberInvitePill(member) {
    if (currentAccessRole !== "admin") return "";
    if (member?.deletedAt) return "";
    if (!String(member?.email || "").trim()) return `<span class="meta">No email</span>`;
    const state = memberInviteState(member);
    if (state === "activated") return statusPill("activated", "Activated");
    if (state === "invited") return statusPill("invited", "Invited");
    return statusPill("not_invited", "Not invited");
  }

  async function promoteInvitedMemberOnFirstSignIn() {
    if (!backendClient) return;
    const profileId = String(authState.user?.id || "").trim();
    if (!profileId) return;

    const memberQueryResponse = await backendClient
      .from("members")
      .select("id, invite_sent_at, activated_at")
      .eq("profile_id", profileId);

    if (memberQueryResponse.error) {
      throw memberQueryResponse.error;
    }

    const members = (memberQueryResponse.data || []).filter((member) => member && member.invite_sent_at);
    for (const member of members) {
      const memberId = String(member.id || "").trim();
      if (!memberId) continue;

      const updateResponse = await backendClient
        .from("members")
        .update({
          invite_sent_at: null,
          activated_at: member.activated_at || new Date().toISOString()
        })
        .eq("id", memberId);

      if (updateResponse.error) {
        throw updateResponse.error;
      }
    }
  }

  function userPageMemberIdFromHash() {
    const hash = String(window.location.hash || "").replace("#", "").trim();
    const match = hash.match(/^user\/(.+)$/i);
    if (!match) return "";
    const decoded = decodeURIComponent(match[1]);
    if (decoded.toLowerCase() === "me") {
      return String(signedInMemberRecord()?.id || "");
    }
    return decoded;
  }

  function plainPill(label) {
    return `<span class="pill">${label}</span>`;
  }

  function renderSortButton(tableKey, columnKey, label) {
    const activeSort = tableSort[tableKey] || { key: "", direction: "asc" };
    const isActive = activeSort.key === columnKey;
    const marker = isActive ? (activeSort.direction === "asc" ? " ▲" : " ▼") : "";
    return `<button class="sort-button ${isActive ? "is-active" : ""}" type="button" data-sort-table="${tableKey}" data-sort-key="${columnKey}">${label}${marker}</button>`;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(Number(amount || 0));
  }

  function normalizeIbanText(value) {
    if (ibanModule && typeof ibanModule.normalizeIbanText === "function") {
      return ibanModule.normalizeIbanText(value);
    }
    return String(value || "").replace(/\s+/g, "").toUpperCase().trim();
  }

  function formatIbanDisplay(value) {
    if (ibanModule && typeof ibanModule.formatIbanDisplay === "function") {
      return ibanModule.formatIbanDisplay(value);
    }
    const normalized = normalizeIbanText(value);
    if (!normalized) return "";
    return normalized.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatDate(dateText) {
    if (!dateText) return "-";
    const normalized = normalizeToIsoDate(dateText) || String(dateText || "").trim();
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(dateText);
    return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function displayPassStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized || normalized === "pending" || normalized === "missing" || normalized === "unknown") return "missing";
    if (normalized === "expired") return "expired";
    return "valid";
  }

  function defaultPassExpiryDate() {
    const now = new Date();
    return `${now.getFullYear() + 1}-12-30`;
  }

  function isPassExpiringSoon(expiryText) {
    if (!expiryText) return false;
    const expiryDate = new Date(`${expiryText}T00:00:00`);
    if (Number.isNaN(expiryDate.getTime())) return false;
    const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  }

  function isIsoDateText(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
  }

  function normalizePassFilterDate(value) {
    const text = String(value || "").trim();
    if (!isIsoDateText(text)) return "";
    const year = Number(text.slice(0, 4));
    if (!Number.isFinite(year) || year < 2020) return "";
    return text;
  }

  function normalizeToIsoDate(dateValue) {
    if (!dateValue) return "";
    const text = String(dateValue || "").trim();
    
    // Already ISO format (YYYY-MM-DD)
    if (isIsoDateText(text)) {
      return text;
    }

    // Try parsing D.M.YYYY / DD.MM.YYYY / D.M.YY and similar separators.
    const localMatch = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})\.?$/);
    if (localMatch) {
      const dayNum = Number(localMatch[1]);
      const monthNum = Number(localMatch[2]);
      const yearRaw = localMatch[3];
      const yearNum = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        const day = String(dayNum).padStart(2, "0");
        const month = String(monthNum).padStart(2, "0");
        const year = String(yearNum);
        return `${year}-${month}-${day}`;
      }
    }

    // Try parsing as Date object for remaining browser-supported formats
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Couldn't normalize, return empty
    return "";
  }

  function getTodayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatFeePeriod(period) {
    return String(period || "-").replace("_", " ");
  }

  function formatList(items, emptyLabel) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    return values.length ? values.join(", ") : emptyLabel;
  }

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replaceAll("\"", "\"\"")}"`;
    }
    return text;
  }

  function downloadBlobFile(content, type, fileName) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function decodeBase64Unicode(base64Value) {
    const normalized = String(base64Value || "").trim();
    if (!normalized) return "";
    const binary = window.atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (typeof TextDecoder === "function") {
      return new TextDecoder("utf-8").decode(bytes);
    }
    let escaped = "";
    bytes.forEach((value) => {
      escaped += `%${value.toString(16).padStart(2, "0")}`;
    });
    return decodeURIComponent(escaped);
  }

  function downloadCsv(columns, rows, fileName) {
    const header = columns.map((column) => escapeCsvValue(column.label)).join(",");
    const body = rows
      .map((row) => columns.map((column) => escapeCsvValue(row[column.key])).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    downloadBlobFile(csv, "text/csv;charset=utf-8", fileName);
  }

  function downloadExcel(columns, rows, fileName) {
    const headerHtml = columns.map((column) => `<th>${String(column.label || "")}</th>`).join("");
    const bodyHtml = rows
      .map((row) => `<tr>${columns.map((column) => `<td>${String(row[column.key] ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const html = `
      <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    downloadBlobFile(html, "application/vnd.ms-excel;charset=utf-8", fileName);
  }

  async function downloadFromApi(url, fallbackFileName) {
    const response = await fetch(url);
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const payload = await response.json();
        message = payload?.error || message;
      } catch {
        // ignore JSON parse errors for non-JSON error responses
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
    const extractedName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || "");
    const fileName = extractedName || fallbackFileName;
    const urlObject = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = urlObject;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(urlObject);
  }

  function memberExportRows() {
    return sortedMembers().map((member) => ({
      id: member.id,
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      email: member.email || "",
      positions: (member.positions || []).join(", "),
      roles: (member.roles || []).map((role) => roleLabel(role)).join(", "),
      jerseyNumber: member.jerseyNumber ?? "",
      membershipStatus: member.membershipStatus || "",
      passStatus: member.passStatus || "",
      passExpiry: member.passExpiry || "",
      deletedAt: member.deletedAt || ""
    }));
  }

  function feeExportRows() {
    return sortedVisibleFees().map((fee) => ({
      memberId: fee.memberId,
      firstName: memberFirstName(fee.memberId) || "",
      lastName: memberLastName(fee.memberId) || "",
      feePeriod: fee.feePeriod || "",
      amount: Number(fee.amount || 0).toFixed(2),
      paidAmount: Number(fee.paidAmount || 0).toFixed(2),
      status: statusLabel(fee.status),
      iban: fee.iban || ""
    }));
  }

  function emptyState(title, copy) {
    return `<article class="setup-card empty-state"><p class="eyebrow">No data yet</p><h3>${title}</h3><p>${copy}</p></article>`;
  }

  function lockedState(title, copy) {
    return `
      <article class="setup-card locked-card">
        <p class="eyebrow">Restricted area</p>
        <h3>${title}</h3>
        <p>${copy}</p>
        <div class="pill-row">
          ${plainPill(`Viewing as ${roleLabel(currentAccessRole)}`)}
          ${plainPill("Admins inherit all capabilities")}
        </div>
      </article>
    `;
  }

  function getFeePeriods() {
    const values = Array.from(new Set(state.fees.map((fee) => fee.feePeriod).filter(Boolean)));
    values.sort((left, right) => {
      const [lQuarter, lYear] = String(left).split("_");
      const [rQuarter, rYear] = String(right).split("_");
      const leftScore = Number(lYear || 0) * 10 + Number(String(lQuarter || "Q0").replace("Q", ""));
      const rightScore = Number(rYear || 0) * 10 + Number(String(rQuarter || "Q0").replace("Q", ""));
      return rightScore - leftScore;
    });
    return values;
  }

  function currentQuarterToken() {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${quarter}_${now.getFullYear()}`;
  }

  function ensureValidFeeFilter() {
    const periods = getFeePeriods();
    if (!periods.length) {
      selectedFeePeriod = "";
      return;
    }
    const currentQuarter = currentQuarterToken();
    if ((selectedFeePeriod === "latest" || !selectedFeePeriod) && periods.includes(currentQuarter)) {
      selectedFeePeriod = currentQuarter;
      saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
      return;
    }
    if (periods.includes(selectedFeePeriod)) return;
    selectedFeePeriod = periods.includes(currentQuarter) ? currentQuarter : periods[0];
    saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
  }

  function currentFeePeriod() {
    const periods = getFeePeriods();
    if (!periods.length) return "";
    return periods.includes(selectedFeePeriod) ? selectedFeePeriod : periods[0];
  }

  function compareValues(left, right) {
    const leftValue = left === null || left === undefined ? "" : left;
    const rightValue = right === null || right === undefined ? "" : right;
    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return Number(leftValue || 0) - Number(rightValue || 0);
    }
    return String(leftValue).localeCompare(String(rightValue), undefined, {
      sensitivity: "base",
      numeric: true
    });
  }

  function sortRows(rows, tableKey, selectValue) {
    const sortConfig = tableSort[tableKey] || { key: "", direction: "asc" };
    const multiplier = sortConfig.direction === "desc" ? -1 : 1;
    return [...rows].sort((left, right) => {
      const leftValue = selectValue(left, sortConfig.key);
      const rightValue = selectValue(right, sortConfig.key);
      return compareValues(leftValue, rightValue) * multiplier;
    });
  }

  function sortedMembers() {
    return sortRows(filteredMembers(), "members", (member, key) => {
      if (key === "id") return String(member.id || "");
      if (key === "firstName") return member.firstName || "";
      if (key === "lastName") return member.lastName || "";
      if (key === "jerseyNumber") return member.jerseyNumber || 0;
      if (key === "passStatus") return member.passStatus || "";
      return member.name || "";
    });
  }

  function memberFilterOptions() {
    return {
      positions: Array.from(new Set(state.members.flatMap((member) => member.positions || []).filter(Boolean))).sort(),
      roles: Array.from(new Set(state.members.flatMap((member) => member.roles || []).filter(Boolean))).sort(),
      membership: Array.from(new Set(state.members.map((member) => member.membershipStatus).filter(Boolean))).sort(),
      passStatuses: ["valid", "missing", "expired"]
    };
  }

  function filteredMembers() {
    return state.members.filter((member) => {
      const query = String(memberFilters.search || "").trim().toLowerCase();
      if (query) {
        const haystack = [
          member.name,
          member.firstName,
          member.lastName,
          member.email,
          member.id
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (member.deletedAt && !memberFilters.showDeleted) {
        return false;
      }
      if (memberFilters.positions.length && !memberFilters.positions.some((position) => (member.positions || []).includes(position))) {
        return false;
      }
      if (memberFilters.roles.length && !memberFilters.roles.some((role) => (member.roles || []).includes(role))) {
        return false;
      }
      if (memberFilters.membership.length && !memberFilters.membership.includes(member.membershipStatus)) {
        return false;
      }
      if (memberFilters.passStatuses.length) {
        const status = displayPassStatus(member.passStatus);
        if (!memberFilters.passStatuses.includes(status)) {
          return false;
        }
      }
      return true;
    });
  }

  function passFilterOptions() {
    const includeDeleted = currentAccessRole === "admin" && Boolean(passFilters.showDeleted);
    const playerMembers = state.members.filter((member) => (member.roles || []).includes("player") && (includeDeleted || !member.deletedAt));
    return {
      statuses: ["valid", "missing", "expired"],
      positions: Array.from(new Set(playerMembers.flatMap((member) => member.positions || []).filter(Boolean))).sort(),
      membership: Array.from(new Set(playerMembers.map((member) => member.membershipStatus).filter(Boolean))).sort()
    };
  }

  function filteredPassMembers() {
    const includeDeleted = currentAccessRole === "admin" && Boolean(passFilters.showDeleted);
    return state.members.filter((member) => {
      if (!(member.roles || []).includes("player")) {
        return false;
      }
      if (member.deletedAt && !includeDeleted) {
        return false;
      }

      const query = String(passFilters.search || "").trim().toLowerCase();
      if (query) {
        const haystack = [
          member.firstName,
          member.lastName,
          member.name,
          member.email
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (passFilters.statuses.length) {
        const status = displayPassStatus(member.passStatus);
        if (!passFilters.statuses.includes(status)) {
          return false;
        }
      }

      if (passFilters.positions.length && !passFilters.positions.some((position) => (member.positions || []).includes(position))) {
        return false;
      }

      if (passFilters.membership.length && !passFilters.membership.includes(member.membershipStatus)) {
        return false;
      }

      const fromDate = normalizePassFilterDate(passFilters.from);
      const toDate = normalizePassFilterDate(passFilters.to);
      const hasFrom = Boolean(fromDate);
      const hasTo = Boolean(toDate);
      if (hasFrom || hasTo) {
        if (!member.passExpiry) {
          return false;
        }
        if (hasFrom && member.passExpiry < fromDate) {
          return false;
        }
        if (hasTo && member.passExpiry > toDate) {
          return false;
        }
      }

      return true;
    });
  }

  function sortedPassMembers() {
    return sortRows(filteredPassMembers(), "passes", (member, key) => {
      if (key === "firstName") return member.firstName || "";
      if (key === "lastName") return member.lastName || "";
      if (key === "position") return (member.positions || []).join(", ") || "";
      if (key === "expiry") return member.passExpiry || "";
      if (key === "status") return displayPassStatus(member.passStatus) || "";
      if (key === "profile") return member.id || "";
      return member.firstName || "";
    });
  }

  function sortedVisibleFees() {
    return sortRows(filteredFees(), "fees", (fee, key) => {
      if (key === "member") return memberName(fee.memberId);
      if (key === "firstName") return memberFirstName(fee.memberId);
      if (key === "lastName") return memberLastName(fee.memberId);
      if (key === "period") return fee.feePeriod || "";
      if (key === "season") return fee.season || "";
      if (key === "amount") return fee.amount || 0;
      if (key === "paid") return fee.paidAmount || 0;
      if (key === "status") return fee.status || "";
      if (key === "note") return fee.note || "";
      return "";
    });
  }

  function filteredFees() {
    const current = currentFeePeriod();
    let rows = current ? state.fees.filter((fee) => fee.feePeriod === current) : state.fees;
    if (selectedFeeStatuses.length) {
      rows = rows.filter((fee) => selectedFeeStatuses.includes(fee.status));
    }
    return rows;
  }

  function availableFeeStatuses() {
    const current = currentFeePeriod();
    const rows = current ? state.fees.filter((fee) => fee.feePeriod === current) : state.fees;
    return Array.from(new Set(rows.map((fee) => fee.status).filter(Boolean))).sort();
  }

  function defaultFeeStatuses() {
    const available = availableFeeStatuses();
    const preferred = ["paid", "paid_rookie_fee", "paid_with_fee", "pending", "not_collected"];
    const selected = preferred.filter((status) => available.includes(status));
    return selected.length ? selected : available;
  }

  function reconcileFeeStatusFilter() {
    const available = new Set(availableFeeStatuses());
    if (!selectedFeeStatuses.length) {
      selectedFeeStatuses = defaultFeeStatuses();
      saveStatusFilter();
      return;
    }
    const next = selectedFeeStatuses.filter((status) => available.has(status));
    if (next.length === selectedFeeStatuses.length) return;
    selectedFeeStatuses = next.length ? next : defaultFeeStatuses();
    saveStatusFilter();
  }

  function applyBootstrap(bootstrap) {
    const previousOrganization = Array.isArray(state?.organization) ? state.organization : [];
    const previousEquipment = Array.isArray(state?.equipment) ? state.equipment : [];
    state = normalizeState({
      ...bootstrap,
      organization: Array.isArray(bootstrap?.organization) ? bootstrap.organization : previousOrganization,
      equipment: Array.isArray(bootstrap?.equipment) ? bootstrap.equipment : previousEquipment
    });
    bootstrapMeta = {
      source: bootstrap.source || "local-sqlite",
      permissionsModel: bootstrap.permissionsModel || demoData.permissionsModel
    };
    ensureValidFeeFilter();
    saveState();
  }

  function shouldUseRemoteData() {
    const hasAppwriteConfig = Boolean(
      APPWRITE_CONFIG &&
      String(APPWRITE_CONFIG.projectId || "").trim() &&
      String(APPWRITE_CONFIG.databaseId || "").trim()
    );
    return Boolean(backendClient) || hasAppwriteConfig;
  }

  function parseJsonArrayField(value, fallback = []) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

    function normalizePassStatus({ status, expiry, licenseName }) {
      const normalized = String(status || "").trim().toLowerCase();
      const hasExpiry = Boolean(String(expiry || "").trim());
      const hasLicense = Boolean(String(licenseName || "").trim());
      if (!normalized) return "missing";
      if (normalized === "expired" && !hasExpiry && !hasLicense) return "missing";
      return normalized;
    }

  async function loadRemoteBootstrap() {
    if (!backendClient) {
      authState.status = "Appwrite client not ready yet. Please refresh the page and try again.";
      return;
    }
    if (!authState.user) {
      authState.status = "Sign in with email and password to continue.";
      return;
    }

    await repairCurrentUserMemberLink();

    const canReadFeesOnline = currentAccessRole === "admin" || currentAccessRole === "finance_admin";
    const canReadPassesOnline = currentAccessRole === "admin" || currentAccessRole === "coach" || currentAccessRole === "tech_admin";
    const canReadAllMemberRolesOnline = currentAccessRole === "admin" || currentAccessRole === "coach" || currentAccessRole === "finance_admin" || currentAccessRole === "tech_admin";

    const queryWarnings = [];
    const selectMaybe = async (table, columns, optional = false) => {
      const response = await backendClient.from(table).select(columns);
      if (response.error) {
        if (optional) {
          queryWarnings.push(`${table}: ${response.error.message || "read blocked"}`);
          return [];
        }
        throw response.error;
      }
      return response.data || [];
    };

    let memberRowsResponse = await backendClient.from("members").select("id, profile_id, first_name, last_name, display_name, email, iban, positions_json, roles_json, jersey_number, membership_status, notes, deleted_at, invite_sent_at, activated_at");
    if (memberRowsResponse.error && /(invite_sent_at|activated_at)/i.test(String(memberRowsResponse.error?.message || ""))) {
      memberRowsResponse = await backendClient.from("members").select("id, profile_id, first_name, last_name, display_name, email, iban, positions_json, roles_json, jersey_number, membership_status, notes, deleted_at");
    }
    if (memberRowsResponse.error && /iban/i.test(String(memberRowsResponse.error?.message || ""))) {
      memberRowsResponse = await backendClient.from("members").select("id, profile_id, first_name, last_name, display_name, email, positions_json, roles_json, jersey_number, membership_status, notes, deleted_at");
    }
    if (memberRowsResponse.error) {
      throw memberRowsResponse.error;
    }
    const memberRows = memberRowsResponse.data || [];
    const memberRoleRows = canReadAllMemberRolesOnline
      ? await selectMaybe("member_roles", "profile_id, role_code", true)
      : await selectMaybe("member_roles", "profile_id, role_code", true);
    const passRows = canReadPassesOnline
      ? await selectMaybe("player_passes", "member_id, pass_status, expires_on, federation_reference, notes, updated_at", true)
      : [];
    const feeRows = canReadFeesOnline
      ? await selectMaybe("membership_fees", "id, member_id, fee_period, season_label, amount_cents, paid_cents, status, iban, status_note, due_date, created_at", true)
      : [];
    const organizationRows = await selectMaybe("organization", "*", true);
    const eventRows = await selectMaybe("events", "id, title, event_type, starts_at, location, notes, created_by, created_at", true);
    const recipientRows = await selectMaybe("event_recipients", "event_id, member_id, response, responded_at", true);
    const inviteRows = await selectMaybe("invites", "id, event_id, channel, sent_by, sent_at, recipient_count", true);

    const rolesByProfile = new Map();
    (memberRoleRows || []).forEach((row) => {
      const profileId = String(row.profile_id || "").trim();
      const roleCode = String(row.role_code || "").trim();
      if (!profileId || !roleCode) return;
      const roles = rolesByProfile.get(profileId) || [];
      roles.push(roleCode);
      rolesByProfile.set(profileId, roles);
    });

    const canonicalMemberIdByAnyId = new Map();
    (memberRows || []).forEach((row) => {
      const canonicalMemberId = String(row.id || "").trim();
      const legacyMemberId = String(row.legacy_id || "").trim();
      if (canonicalMemberId) {
        canonicalMemberIdByAnyId.set(canonicalMemberId, canonicalMemberId);
      }
      if (legacyMemberId && canonicalMemberId) {
        canonicalMemberIdByAnyId.set(legacyMemberId, canonicalMemberId);
      }
    });

    const passesByMember = new Map();
    (passRows || []).forEach((row) => {
      const rawMemberId = String(row.member_id || "").trim();
      const canonicalMemberId = canonicalMemberIdByAnyId.get(rawMemberId) || rawMemberId;
      passesByMember.set(canonicalMemberId, row);
    });

    const feesByMember = new Map();
    (feeRows || []).forEach((row) => {
      const rawMemberId = String(row.member_id || "").trim();
      const memberId = canonicalMemberIdByAnyId.get(rawMemberId) || rawMemberId;
      const list = feesByMember.get(memberId) || [];
      list.push(row);
      feesByMember.set(memberId, list);
    });
    feesByMember.forEach((rows) => {
      rows.sort((left, right) => String(right.season_label || right.due_date || right.created_at || "").localeCompare(String(left.season_label || left.due_date || left.created_at || "")));
    });

    const recipientsByEvent = new Map();
    (recipientRows || []).forEach((row) => {
      const eventId = String(row.event_id || "");
      const list = recipientsByEvent.get(eventId) || [];
      list.push(row);
      recipientsByEvent.set(eventId, list);
    });

    const normalizeDisplayName = (row) => {
      const firstName = String(row.first_name || "").trim();
      const lastName = String(row.last_name || "").trim();
      const fallback = String(row.display_name || "").trim();
      const displayName = `${firstName} ${lastName}`.trim() || fallback || "Unknown member";
      return { firstName, lastName, displayName };
    };

    const members = (memberRows || []).map((row) => {
      const { firstName, lastName, displayName } = normalizeDisplayName(row);
      const memberId = String(row.id || "");
      const pass = passesByMember.get(memberId) || null;
      const passExpiry = String(pass?.expires_on || "");
      const licenseName = String(pass?.federation_reference || "");
      const rawPassStatus = String(pass?.pass_status || "");
      const memberFees = feesByMember.get(memberId) || [];
      const latestFee = memberFees[0] || null;
      return {
        id: memberId,
        firstName,
        lastName,
        name: displayName,
        email: String(row.email || ""),
        iban: String(row.iban || latestFee?.iban || "").trim(),
        memberIban: String(row.iban || "").trim(),
        positions: parseJsonArrayField(row.positions_json, []),
        roles: capabilitySet(rolesByProfile.get(String(row.profile_id || "")) || parseJsonArrayField(row.roles_json, ["player"])),
        jerseyNumber: row.jersey_number === null || row.jersey_number === undefined ? null : Number(row.jersey_number),
        active: String(row.membership_status || "") === "active",
        rookie: false,
        inClubee: Boolean(row.profile_id),
        membershipStatus: row.membership_status || "pending",
        deletedAt: row.deleted_at || null,
        profileId: row.profile_id || null,
        inviteSentAt: row.invite_sent_at || null,
        activatedAt: row.activated_at || null,
        passStatus: normalizePassStatus({
          status: rawPassStatus,
          expiry: passExpiry,
          licenseName
        }),
        passExpiry,
        licenseName,
        feeStatus: latestFee
          ? String(latestFee.status || (Number(latestFee.paid_cents || 0) >= Number(latestFee.amount_cents || 0) && Number(latestFee.amount_cents || 0) > 0 ? "paid" : (Number(latestFee.paid_cents || 0) > 0 ? "partial" : "pending")))
          : "pending",
        notes: String(row.notes || ""),
        lastInviteResponse: "pending"
      };
    });

    const fees = (feeRows || []).map((row) => ({
      id: String(row.id || ""),
      memberId: canonicalMemberIdByAnyId.get(String(row.member_id || "").trim()) || String(row.member_id || "").trim(),
      season: String(row.season_label || ""),
      feePeriod: String(row.fee_period || row.season_label || ""),
      amount: Number(row.amount_cents || 0) / 100,
      paidAmount: Number(row.paid_cents || 0) / 100,
      status: String(row.status || (String(row.paid_cents || 0) >= Number(row.amount_cents || 0) && Number(row.amount_cents || 0) > 0 ? "paid" : (Number(row.paid_cents || 0) > 0 ? "partial" : "pending"))),
      iban: String(row.iban || ""),
      note: String(row.status_note || "")
    }));

    const eventRecipientsByEvent = new Map();
    (recipientRows || []).forEach((row) => {
      const eventId = String(row.event_id || "");
      const list = eventRecipientsByEvent.get(eventId) || [];
      list.push(row);
      eventRecipientsByEvent.set(eventId, list);
    });

    const events = (eventRows || []).map((row) => {
      const recipients = eventRecipientsByEvent.get(String(row.id || "")) || [];
      return {
        id: String(row.id || ""),
        title: String(row.title || ""),
        type: String(row.event_type || "practice"),
        date: String(row.starts_at || "").slice(0, 10),
        location: String(row.location || ""),
        inviteStatus: recipients.length ? "sent" : "scheduled",
        attending: recipients.filter((recipient) => recipient.response === "confirmed").map((recipient) => String(recipient.member_id || "")),
        maybe: recipients.filter((recipient) => recipient.response === "maybe").map((recipient) => String(recipient.member_id || "")),
        unavailable: recipients.filter((recipient) => recipient.response === "declined").map((recipient) => String(recipient.member_id || ""))
      };
    });

    const invites = (inviteRows || []).map((row) => ({
      id: String(row.id || ""),
      eventId: String(row.event_id || ""),
      channel: String(row.channel || "email"),
      sentAt: String(row.sent_at || ""),
      recipients: Number(row.recipient_count || 0),
      opens: 0,
      confirmations: 0
    }));
    const organization = sortOrganizationRows(organizationRows || []);

    const currentUserRoles = (memberRoleRows || [])
      .filter((row) => String(row.profile_id || "") === String(authState.user.id || ""))
      .map((row) => String(row.role_code || "").trim())
      .filter(Boolean);
    const profileMatchedMember = (memberRows || []).find((row) => String(row.profile_id || "") === String(authState.user.id || ""));
    const emailMatchedMember = profileMatchedMember
      ? null
      : (memberRows || []).find((row) => String(row.email || "").trim().toLowerCase() === String(authState.user?.email || "").trim().toLowerCase());
    const memberRoleFallback = parseJsonArrayField(profileMatchedMember?.roles_json ?? emailMatchedMember?.roles_json, []);
    const effectiveRoles = currentUserRoles.length ? currentUserRoles : (memberRoleFallback.length ? memberRoleFallback : authState.roles);
    if (effectiveRoles.length) {
      currentAccessRole = primaryRoleFromRoles(effectiveRoles);
      saveStoredValue(ACCESS_KEY, currentAccessRole);
    }

    applyBootstrap({
      source: "appwrite",
      permissionsModel: demoData.permissionsModel,
      members,
      fees,
      organization: organization.length ? organization : state.organization,
      events,
      invites
    });
    authState.status = `Appwrite data loaded for ${authDisplayName() || authState.user.email}.`;
    if (queryWarnings.length) {
      authState.status += ` Some data may be hidden by permissions (${queryWarnings.join(" | ")}).`;
    }
  }

  async function loadBootstrapDataWithCache() {
    // Try cache first
    const cached = getCacheWithTTL(BOOTSTRAP_CACHE_KEY);
    if (cached) {
      applyBootstrap(cached);
      return;
    }

    // Load from source and cache
    await loadBootstrapData();

    // Cache the loaded state
    setCacheWithTTL(BOOTSTRAP_CACHE_KEY, {
      members: state.members,
      fees: state.fees,
      events: state.events,
      invites: state.invites,
      equipment: state.equipment,
      source: bootstrapMeta.source,
      permissionsModel: bootstrapMeta.permissionsModel
    });
  }

  async function loadEquipmentDataWithCache() {
    // Try cache first
    const cached = getCacheWithTTL(EQUIPMENT_CACHE_KEY);
    if (cached) {
      state.equipment = cached;
      return;
    }

    // Load from source and cache
    await loadEquipmentData();

    // Cache the loaded equipment
    setCacheWithTTL(EQUIPMENT_CACHE_KEY, state.equipment);
  }

  async function backgroundLoadData() {
    try {
      isSyncing = true;
      renderHeroNotice(); // Update syncing indicator
      await loadBootstrapDataWithCache();
      await loadEquipmentDataWithCache();
      isSyncing = false;
      renderHeroNotice(); // Remove syncing indicator
      mount(); // Re-render with new data
    } catch (error) {
      console.error("[Background Load] Failed:", error);
      isSyncing = false;
      renderHeroNotice();
    }
  }

  async function loadBootstrapData() {
    // Pure Appwrite only
    if (backendClient && authState.user) {
      await loadRemoteBootstrap();
    } else {
      await loadLocalBootstrap();
    }
  }

  async function loadLocalBootstrap() {
    // Pure Appwrite - no local API
    if (isLocalPreviewMode()) {
      authState.status = "Local preview mode active. Role controls are available in the header.";
      bootstrapMeta = {
        source: state.source || "demo",
        permissionsModel: state.permissionsModel || demoData.permissionsModel
      };
      ensureValidFeeFilter();
      return;
    }

    if (!backendClient) {
      authState.status = "Static demo mode. No data persistence.";
      bootstrapMeta = {
        source: state.source || "demo",
        permissionsModel: state.permissionsModel || demoData.permissionsModel
      };
      ensureValidFeeFilter();
      return;
    }
    // Fall back to loading via Appwrite
    await loadRemoteBootstrap();
  }

  function mapEquipmentRowFromRemote(row, index) {
    const checkedAt = row?.checked_at ?? row?.checkedAt ?? row?.checkedDate ?? row?.last_checked ?? "";
    return normalizeEquipmentItem(
      {
        id: row?.id,
        group: row?.group_name,
        itemKind: row?.item_kind,
        parentItemId: row?.parent_item_id,
        category: row?.category,
        article: row?.article,
        quantity: row?.quantity,
        condition: row?.condition,
        location: row?.location,
        checkedAt,
        notes: row?.notes,
        photoFileId: row?.photo_file_id ?? row?.photoFileId,
        photoUrl: row?.photo_url ?? row?.photoUrl
      },
      index
    );
  }

  function mapEquipmentRowToRemote(row) {
    return {
      id: String(row?.id || generateEquipmentId()).trim(),
      group_name: String(row?.group || "General").trim() || "General",
      item_kind: String(row?.itemKind || "item").trim() || "item",
      parent_item_id: String(row?.parentItemId || "").trim() || null,
      category: String(row?.category || "").trim() || null,
      article: String(row?.article || "").trim() || null,
      quantity: String(row?.quantity || "").trim() || null,
      condition: String(row?.condition || "").trim() || null,
      location: String(row?.location || "").trim() || null,
      checked_at: String(row?.checkedAt || "").trim() || null,
      notes: String(row?.notes || "").trim() || null,
      photo_file_id: String(row?.photoFileId || "").trim() || null,
      photo_url: String(row?.photoUrl || "").trim() || null
    };
  }

  async function loadEquipmentData() {
    const localRows = loadEquipmentFromStorage();

    if (backendClient && authState.user) {
      try {
        const remoteResponse = await backendClient
          .from("equipment_inventory")
          .select("id, group_name, item_kind, parent_item_id, category, article, quantity, condition, location, checked_at, notes, photo_file_id, photo_url");

        let remoteData = remoteResponse.data || [];
        if (remoteResponse.error && /(item_kind|parent_item_id|photo_file_id|photo_url)/i.test(String(remoteResponse.error?.message || ""))) {
          const legacyResponse = await backendClient
            .from("equipment_inventory")
            .select("id, group_name, category, article, quantity, condition, location, checked_at, notes");
          if (legacyResponse.error) {
            throw legacyResponse.error;
          }
          remoteData = legacyResponse.data || [];
          equipmentStatus = "Some equipment table attributes are not on the remote table yet. Photo and subgroup fields may only work locally until the table is updated.";
        } else if (remoteResponse.error) {
          throw remoteResponse.error;
        }
        const remoteRows = sortEquipmentRows(remoteData.map(mapEquipmentRowFromRemote));
        equipmentStorageMode = "remote";
        equipmentStatus = equipmentStatus || (remoteRows.length
          ? ""
          : "No equipment entries found in database yet. Admins can add items now.");
        saveEquipmentToStorage(remoteRows);
        return;
      } catch (error) {
        equipmentStorageMode = "local";
        equipmentStatus = `Equipment remote table unavailable. Using local storage (${String(error?.message || "unknown error")}).`;
      }
    } else {
      equipmentStorageMode = "local";
      equipmentStatus = "";
    }

    if (localRows.length) {
      saveEquipmentToStorage(localRows);
      return;
    }

    saveEquipmentToStorage([]);
  }

  async function upsertEquipmentRow(row) {
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can edit equipment.");
    }

    const normalizedId = String(row?.id || generateEquipmentId()).trim();
    const draftPhoto = equipmentPhotoDraftsById[normalizedId] || null;
    const normalizedRow = normalizeEquipmentItem({
      ...row,
      id: normalizedId,
      photoFileId: row?.photoFileId || draftPhoto?.photoFileId || "",
      photoUrl: row?.photoUrl || draftPhoto?.photoUrl || ""
    }, 0);

    if (backendClient && authState.user) {
      const remotePayload = mapEquipmentRowToRemote(normalizedRow);
      let response = await backendClient.from("equipment_inventory").upsert(remotePayload, { onConflict: "id" });
      if (response.error && /(item_kind|parent_item_id|photo_file_id|photo_url)/i.test(String(response.error?.message || ""))) {
        const fallbackPayload = Object.assign({}, remotePayload);
        delete fallbackPayload.item_kind;
        delete fallbackPayload.parent_item_id;
        delete fallbackPayload.photo_file_id;
        delete fallbackPayload.photo_url;
        response = await backendClient.from("equipment_inventory").upsert(fallbackPayload, { onConflict: "id" });
        if (!response.error) {
          equipmentStatus = "Some equipment table attributes are not on the remote table yet. Photo and subgroup fields are only stored locally until the table is updated.";
        }
      }
      if (response.error) {
        throw response.error;
      }
      equipmentStorageMode = "remote";
      equipmentStatus = equipmentStatus || "";
    }

    const currentRows = Array.isArray(state.equipment) ? state.equipment : [];
    const existingIndex = currentRows.findIndex((item) => String(item.id) === String(normalizedRow.id));
    const nextRows = existingIndex >= 0
      ? currentRows.map((item, index) => (index === existingIndex ? normalizedRow : item))
      : [...currentRows, normalizedRow];
    saveEquipmentToStorage(nextRows);
    if (normalizedRow.photoFileId || normalizedRow.photoUrl) {
      equipmentPhotoDraftsById[normalizedId] = {
        photoFileId: normalizedRow.photoFileId || "",
        photoUrl: normalizedRow.photoUrl || ""
      };
    } else {
      delete equipmentPhotoDraftsById[normalizedId];
    }
  }

  async function deleteEquipmentRow(equipmentId) {
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can edit equipment.");
    }

    const normalizedId = String(equipmentId || "").trim();
    if (!normalizedId) return;
    const children = (Array.isArray(state.equipment) ? state.equipment : []).filter((item) => String(item.parentItemId || "") === normalizedId);
    if (children.length) {
      throw new Error("Delete or move the contained items first.");
    }
    const currentRow = (Array.isArray(state.equipment) ? state.equipment : []).find((item) => String(item.id) === normalizedId);

    if (backendClient && authState.user) {
      const response = await backendClient.from("equipment_inventory").delete().eq("id", normalizedId);
      if (response.error) {
        throw response.error;
      }
      equipmentStorageMode = "remote";
      equipmentStatus = "";
    }

    if (currentRow?.photoFileId || currentRow?.photoUrl) {
      await deleteEquipmentPhotoFromStorage(normalizedId, currentRow.photoFileId);
    }
    delete equipmentPhotoDraftsById[normalizedId];

    const nextRows = (Array.isArray(state.equipment) ? state.equipment : []).filter((item) => String(item.id) !== normalizedId);
    saveEquipmentToStorage(nextRows);
  }

  function normalizeFeeStatusValue(value) {
    const normalized = String(value || "pending").trim().toLowerCase();
    const aliases = {
      paid: "paid",
      paid_rookie_fee: "paid_rookie_fee",
      "paid rookie fee": "paid_rookie_fee",
      "paid rookie": "paid_rookie_fee",
      paid_with_fee: "paid_with_fee",
      "paid with fee": "paid_with_fee",
      "paid with fees": "paid_with_fee",
      partial: "partial",
      pending: "pending",
      "not paid": "pending",
      not_collected: "not_collected",
      "not collected": "not_collected",
      exempt: "exempt",
      exit: "exit",
      not_applicable: "not_applicable",
      "not applicable": "not_applicable"
    };
    return aliases[normalized] || "pending";
  }

  function fullNameFromPayload(firstName, lastName) {
    const fullName = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();
    return fullName || "Unknown member";
  }

  // Permission error fallback removed - trusting Appwrite permissions

  // Removed server admin fallback functions - now using pure Appwrite
  async function updateFeeStatusesBulkViaServerAdmin() {
    throw new Error("Fee bulk update fallback is disabled. Grant the current Appwrite admin role direct write access to membership_fees.");
  }

  async function updateFeeRowViaServerAdmin() {
    throw new Error("Fee update fallback is disabled. Grant the current Appwrite admin role direct write access to membership_fees.");
  }

  async function saveMemberViaRemote(memberPayload) {
    if (!backendClient) {
      console.error("[Appwrite Client Not Available]");
      throw new Error("Appwrite client is not available.");
    }

    try {
      const memberId = String(memberPayload.memberId || "").trim();
      const firstName = String(memberPayload.firstName || "").trim();
      const lastName = String(memberPayload.lastName || "").trim();
      const displayName = fullNameFromPayload(firstName, lastName);
      const positions = Array.isArray(memberPayload.positions)
        ? Array.from(new Set(memberPayload.positions.map((entry) => String(entry || "").trim().toUpperCase()).filter(Boolean)))
        : [];
      const roles = Array.isArray(memberPayload.roles)
        ? Array.from(new Set(memberPayload.roles.map((entry) => String(entry || "").trim()).filter(Boolean)))
        : ["player"];
      const jerseyRaw = String(memberPayload.jerseyNumber ?? "").trim();
      const jerseyNumber = jerseyRaw === "" ? null : Number(jerseyRaw);
      const passFieldsProvided = Object.prototype.hasOwnProperty.call(memberPayload, "passStatus") || Object.prototype.hasOwnProperty.call(memberPayload, "passExpiry");
      const normalizedPassStatus = (() => {
        const value = String(memberPayload.passStatus || "").trim().toLowerCase();
        if (!value || value === "pending" || value === "missing" || value === "unknown") return "missing";
        if (value === "expired") return "expired";
        return "valid";
      })();
      const normalizedPassExpiry = normalizedPassStatus === "missing"
        ? ""
        : String(memberPayload.passExpiry || "").trim();

      const patch = {
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName,
        email: String(memberPayload.email || "").trim(),
        positions_json: positions,
        roles_json: roles.length ? roles : ["player"],
        jersey_number: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
        membership_status: String(memberPayload.membershipStatus || "pending").trim() || "pending",
        notes: String(memberPayload.notes || "").trim(),
        deleted_at: null
      };
      if (Object.prototype.hasOwnProperty.call(memberPayload, "iban")) {
        patch.iban = String(memberPayload.iban || "").trim() || null;
      }

      let savedMemberId = memberId;

      if (memberId) {
        const updateResponse = await backendClient.from("members").update(patch).eq("id", memberId).select("id, profile_id").single();
        if (updateResponse.error) throw updateResponse.error;
        savedMemberId = String(updateResponse.data?.id || memberId);

        if (currentAccessRole === "admin" && updateResponse.data?.profile_id) {
          const profileId = String(updateResponse.data.profile_id);
          const deleteResponse = await backendClient.from("member_roles").delete().eq("profile_id", profileId);
          if (deleteResponse.error) throw deleteResponse.error;
          const insertRows = (roles.length ? roles : ["player"]).map((role) => ({ profile_id: profileId, role_code: role }));
          const insertResponse = await backendClient.from("member_roles").insert(insertRows);
          if (insertResponse.error) throw insertResponse.error;
        }
      } else {
        const insertResponse = await backendClient.from("members").insert([patch]).select("id, profile_id").single();
        if (insertResponse.error) throw insertResponse.error;
        savedMemberId = String(insertResponse.data?.id || "");

        if (savedMemberId && String(patch.email || "").trim()) {
          try {
            await provisionAuthForMember({
              memberId: savedMemberId,
              email: String(patch.email || "").trim(),
              fullName: displayName,
              roles: roles.length ? roles : ["player"]
            });
          } catch (provisionError) {
            const provisionMessage = String(provisionError?.message || "");
            showToast(`Member created, but auth account provisioning failed: ${provisionMessage}`, "error");
          }
        }
      }

      if (passFieldsProvided && savedMemberId) {
        const passPayload = {
          member_id: savedMemberId,
          pass_status: normalizedPassStatus,
          expires_on: normalizedPassExpiry || null
        };

        let passResponse = await backendClient.from("player_passes").upsert(passPayload, { onConflict: "member_id" });

        if (passResponse.error && normalizedPassStatus === "missing") {
          const message = String(passResponse.error?.message || "").toLowerCase();
          const likelyOldStatusConstraint =
            message.includes("player_passes_pass_status_check") ||
            message.includes("violates check constraint") ||
            message.includes("pass_status");

          if (likelyOldStatusConstraint) {
            // Compatibility mode for older schemas that don't accept 'missing'.
            passResponse = await backendClient.from("player_passes").upsert(
              {
                member_id: savedMemberId,
                pass_status: "expired",
                expires_on: null
              },
              { onConflict: "member_id" }
            );
          }
        }

        if (passResponse.error) throw passResponse.error;
      }

      invalidateCache(BOOTSTRAP_CACHE_KEY);
      await loadBootstrapData();
    } catch (error) {
      console.error("[Appwrite Save Failed]", error);
      throw error;
    }
  }

  async function removeMemberViaRemote(memberId) {
    if (!backendClient) throw new Error("Appwrite client not available.");
    const response = await backendClient
      .from("members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", memberId);
    if (response.error) throw response.error;
    invalidateCache(BOOTSTRAP_CACHE_KEY);
    await loadBootstrapData();
  }

  async function undeleteMemberViaRemote(memberId) {
    if (!backendClient) throw new Error("Appwrite client not available.");
    const response = await backendClient.from("members").update({ deleted_at: null }).eq("id", memberId);
    if (response.error) throw response.error;
    invalidateCache(BOOTSTRAP_CACHE_KEY);
    await loadBootstrapData();
  }

  async function mergeMembersViaRemote({ keepMemberId, removeMemberId }) {
    if (!backendClient) throw new Error("Appwrite client is not available.");

    const keepId = String(keepMemberId || "").trim();
    const removeId = String(removeMemberId || "").trim();
    if (!keepId || !removeId || keepId === removeId) {
      throw new Error("Keep and remove member must be different.");
    }

    const feeMove = await backendClient.from("membership_fees").update({ member_id: keepId }).eq("member_id", removeId);
    if (feeMove.error) throw feeMove.error;

    const keepPass = await backendClient.from("player_passes").select("id").eq("member_id", keepId).maybeSingle();
    if (keepPass.error) throw keepPass.error;
    const removePass = await backendClient.from("player_passes").select("id").eq("member_id", removeId).maybeSingle();
    if (removePass.error) throw removePass.error;
    if (removePass.data?.id) {
      if (keepPass.data?.id) {
        const deletePass = await backendClient.from("player_passes").delete().eq("member_id", removeId);
        if (deletePass.error) throw deletePass.error;
      } else {
        const movePass = await backendClient.from("player_passes").update({ member_id: keepId }).eq("member_id", removeId);
        if (movePass.error) throw movePass.error;
      }
    }

    const deleteMember = await backendClient.from("members").delete().eq("id", removeId);
    if (deleteMember.error) throw deleteMember.error;

    invalidateCache(BOOTSTRAP_CACHE_KEY);
    await loadBootstrapData();
  }

  async function updateFeeStatusesBulkViaRemote({ feePeriod, status, memberIds }) {
    if (!backendClient) throw new Error("Appwrite client is not available.");

    try {
      const normalizedStatus = normalizeFeeStatusValue(status);
      const ids = (Array.isArray(memberIds) ? memberIds : []).map((id) => String(id || "").trim()).filter(Boolean);
      if (!ids.length) throw new Error("Select at least one member.");

      const query = await backendClient
        .from("membership_fees")
        .select("id, amount_cents, paid_cents")
        .eq("fee_period", String(feePeriod || ""))
        .in("member_id", ids);
      if (query.error) throw query.error;

      const rows = query.data || [];
      for (const row of rows) {
        const amountCents = Number(row.amount_cents || 0);
        let paidCents = Number(row.paid_cents || 0);
        if (FEE_PAID_STATUSES.includes(normalizedStatus)) paidCents = amountCents;
        else if (normalizedStatus === "partial") paidCents = paidCents > 0 && paidCents < amountCents ? paidCents : Math.round(amountCents / 2);
        else paidCents = 0;

        const update = await backendClient
          .from("membership_fees")
          .update({ status: normalizedStatus, paid_cents: paidCents })
          .eq("id", row.id);
        if (update.error) throw update.error;
      }

      invalidateCache(BOOTSTRAP_CACHE_KEY);
      await loadBootstrapData();
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        await updateFeeStatusesBulkViaServerAdmin({ feePeriod, status, memberIds });
        return;
      }
      throw error;
    }
  }

  async function updateFeeRowViaRemote({ feeId, status, amount, paidAmount, note, iban }) {
    if (!backendClient) throw new Error("Appwrite client is not available.");

    try {
      const normalizedStatus = normalizeFeeStatusValue(status);
      const amountCents = Math.max(0, Math.round(Number(amount || 0) * 100));
      let paidCents = Math.max(0, Math.round(Number(paidAmount || 0) * 100));

      if (FEE_PAID_STATUSES.includes(normalizedStatus) && normalizedStatus !== "paid_with_fee") paidCents = amountCents;
      else if (FEE_ZERO_PAID_STATUSES.includes(normalizedStatus)) paidCents = 0;

      const response = await backendClient
        .from("membership_fees")
        .update({
          status: normalizedStatus,
          amount_cents: amountCents,
          paid_cents: paidCents,
          status_note: String(note || "").trim() || null,
          iban: String(iban || "").trim() || null
        })
        .eq("id", String(feeId || ""));
      if (response.error) throw response.error;

      invalidateCache(BOOTSTRAP_CACHE_KEY);
      await loadBootstrapData();
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        await updateFeeRowViaServerAdmin({ feeId, status, amount, paidAmount, note, iban });
        return;
      }
      throw error;
    }
  }

  async function saveMember(memberPayload) {
    if (shouldUseRemoteData()) {
      await saveMemberViaRemote(memberPayload);
      return;
    }
    const memberId = String(memberPayload.memberId || "").trim();
    const url = memberId ? apiUrl(`/api/members/${memberId}`) : apiUrl("/api/members");
    const method = memberId ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: memberPayload.firstName,
        lastName: memberPayload.lastName,
        email: memberPayload.email,
        positions: memberPayload.positions,
        roles: memberPayload.roles,
        jerseyNumber: memberPayload.jerseyNumber,
        membershipStatus: memberPayload.membershipStatus,
        passStatus: memberPayload.passStatus,
        passExpiry: memberPayload.passExpiry,
        notes: memberPayload.notes
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save member.");
    applyBootstrap(payload);
  }

  async function removeMember(memberId) {
    if (shouldUseRemoteData()) {
      await removeMemberViaRemote(memberId);
      return;
    }
    const response = await fetch(apiUrl(`/api/members/${memberId}`), { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not delete member.");
    applyBootstrap(payload);
  }

  async function undeleteMember(memberId) {
    if (shouldUseRemoteData()) {
      await undeleteMemberViaRemote(memberId);
      return;
    }
    const response = await fetch(apiUrl(`/api/members/${memberId}/undelete`), { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not undelete member.");
    applyBootstrap(payload);
  }

  async function mergeMemberRecords({ keepMemberId, removeMemberId, firstName, lastName }) {
    if (shouldUseRemoteData()) {
      await mergeMembersViaRemote({ keepMemberId, removeMemberId, firstName, lastName });
      return;
    }
    const response = await fetch(apiUrl("/api/members/merge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepMemberId, removeMemberId, firstName, lastName })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not merge members.");
    applyBootstrap(payload);
  }

  async function updateFeeStatusesBulk({ feePeriod, status, memberIds }) {
    if (shouldUseRemoteData()) {
      await updateFeeStatusesBulkViaRemote({ feePeriod, status, memberIds });
      return;
    }
    const response = await fetch(apiUrl("/api/fees/bulk-status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feePeriod, status, memberIds })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not update fee statuses.");
    applyBootstrap(payload);
  }

  async function updateFeeRow({ feeId, status, amount, paidAmount, note, iban }) {
    if (shouldUseRemoteData()) {
      await updateFeeRowViaRemote({ feeId, status, amount, paidAmount, note, iban });
      return;
    }
    const response = await fetch(apiUrl(`/api/fees/${feeId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, amount, paidAmount, note, iban })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not update fee row.");
    applyBootstrap(payload);
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",").pop() || "" : result);
      };
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  async function invokePassSyncFunction({ mode, memberIds = [] } = {}) {
    const functionId = String(APPWRITE_CONFIG?.passSyncFunctionId || "").trim();
    if (!functionId) {
      return null;
    }

    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Functions !== "function") {
      throw new Error("Appwrite Functions API is unavailable in this browser runtime.");
    }

    const passSyncClient = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));

    const functionsApi = new appwriteSdk.Functions(passSyncClient);
    const execution = await functionsApi.createExecution(
      functionId,
      JSON.stringify({
        action: mode === "apply" ? "apply" : "preview",
        fileName: passSyncUpload?.fileName || "",
        fileBase64: passSyncUpload?.fileBase64 || "",
        memberIds: Array.isArray(memberIds) ? memberIds : []
      }),
      false
    );

    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const terminalStatuses = new Set(["completed", "failed", "crashed", "timeout", "canceled"]);
    let finalExecution = execution;

    for (let index = 0; index < 12; index += 1) {
      const status = String(finalExecution?.status || "").toLowerCase();
      if (terminalStatuses.has(status)) break;
      if (typeof functionsApi.getExecution === "function" && finalExecution?.$id) {
        await wait(350);
        finalExecution = await functionsApi.getExecution(functionId, String(finalExecution.$id));
        continue;
      }
      break;
    }

    const finalStatus = String(finalExecution?.status || "").toLowerCase();
    if (finalStatus && finalStatus !== "completed") {
      const statusCode = String(finalExecution?.responseStatusCode || "").trim();
      const stderr = String(finalExecution?.stderr || "").trim();
      const bodyText = String(finalExecution?.responseBody || "").trim();
      throw new Error(
        `Pass sync function failed (${finalStatus}${statusCode ? `:${statusCode}` : ""}). ${stderr || bodyText || "Check function logs in Appwrite Console."}`.trim()
      );
    }

    const responseBodyRaw = String(finalExecution?.responseBody || "").trim();
    if (!responseBodyRaw) {
      throw new Error("Pass sync function returned an empty response body.");
    }

    try {
      const parsed = JSON.parse(responseBodyRaw);
      if (parsed?.error) {
        throw new Error(String(parsed.error));
      }
      return parsed;
    } catch (error) {
      throw new Error(String(error?.message || "Could not parse pass sync function response."));
    }
  }

  async function previewClubeePassSync() {
    const functionPayload = await invokePassSyncFunction({ mode: "preview" });
    if (functionPayload) {
      return functionPayload.preview || null;
    }

    const response = await fetch(apiUrl("/api/passes/sync-clubee/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: passSyncUpload?.fileName || "",
        fileBase64: passSyncUpload?.fileBase64 || ""
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 405) {
        throw new Error(
          "Pass sync preview endpoint is not available on this host. Set ClubHubAppwriteConfig.apiBaseUrl to your backend URL (for example https://your-backend-domain) so /api/passes/sync-clubee/preview is called there."
        );
      }
      throw new Error(payload.error || "Could not build Clubee pass preview.");
    }
    return payload.preview || null;
  }

  async function applyClubeePassSync(memberIds) {
    const functionPayload = await invokePassSyncFunction({ mode: "apply", memberIds });
    if (functionPayload) {
      invalidateCache(BOOTSTRAP_CACHE_KEY);
      await loadBootstrapData();
      return functionPayload.passSyncApply || null;
    }

    const response = await fetch(apiUrl("/api/passes/sync-clubee/apply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds,
        fileName: passSyncUpload?.fileName || "",
        fileBase64: passSyncUpload?.fileBase64 || ""
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 405) {
        throw new Error(
          "Pass sync apply endpoint is not available on this host. Set ClubHubAppwriteConfig.apiBaseUrl to your backend URL (for example https://your-backend-domain) so /api/passes/sync-clubee/apply is called there."
        );
      }
      throw new Error(payload.error || "Could not apply Clubee pass sync.");
    }
    if (Array.isArray(payload?.members) || Array.isArray(payload?.fees)) {
      applyBootstrap(payload);
    } else {
      invalidateCache(BOOTSTRAP_CACHE_KEY);
      await loadBootstrapData();
    }
    return payload.passSyncApply || null;
  }

  async function exportSepaXmlViaFunction(periodToken) {
    const functionId = String(APPWRITE_CONFIG?.sepaExportFunctionId || "").trim();
    if (!functionId) {
      throw new Error("SEPA export function is not configured.");
    }

    const appwriteSdk = window.Appwrite || window.appwrite;
    if (!appwriteSdk || typeof appwriteSdk.Client !== "function" || typeof appwriteSdk.Functions !== "function") {
      throw new Error("Appwrite Functions API is unavailable in this browser runtime.");
    }

    const functionClient = new appwriteSdk.Client()
      .setEndpoint(String(APPWRITE_CONFIG?.endpoint || "https://fra.cloud.appwrite.io/v1"))
      .setProject(String(APPWRITE_CONFIG?.projectId || ""));
    const functionsApi = new appwriteSdk.Functions(functionClient);

    const membersPayload = state.members.map((member) => ({
      id: String(member.id || "").trim(),
      firstName: String(member.firstName || "").trim(),
      lastName: String(member.lastName || "").trim(),
      name: String(member.name || "").trim(),
      iban: String(memberIban(member.id) || "").trim()
    }));
    const feesPayload = state.fees.map((fee) => ({
      id: String(fee.id || "").trim(),
      memberId: String(fee.memberId || "").trim(),
      feePeriod: String(fee.feePeriod || "").trim(),
      amount: Number(fee.amount || 0),
      paidAmount: Number(fee.paidAmount || 0),
      status: String(fee.status || "").trim(),
      iban: String(fee.iban || "").trim()
    }));

    const execution = await functionsApi.createExecution(
      functionId,
      JSON.stringify({
        feePeriod: periodToken,
        members: membersPayload,
        fees: feesPayload
      }),
      false
    );

    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const terminalStatuses = new Set(["completed", "failed", "crashed", "timeout", "canceled"]);
    let finalExecution = execution;

    for (let index = 0; index < 12; index += 1) {
      const status = String(finalExecution?.status || "").toLowerCase();
      if (terminalStatuses.has(status)) break;
      if (typeof functionsApi.getExecution === "function" && finalExecution?.$id) {
        await wait(350);
        finalExecution = await functionsApi.getExecution(functionId, String(finalExecution.$id));
        continue;
      }
      break;
    }

    const finalStatus = String(finalExecution?.status || "").toLowerCase();
    if (finalStatus && finalStatus !== "completed") {
      const statusCode = String(finalExecution?.responseStatusCode || "").trim();
      const stderr = String(finalExecution?.stderr || "").trim();
      const bodyText = String(finalExecution?.responseBody || "").trim();
      throw new Error(
        `SEPA export function failed (${finalStatus}${statusCode ? `:${statusCode}` : ""}). ${stderr || bodyText || "Check function logs in Appwrite Console."}`.trim()
      );
    }

    const responseBodyRaw = String(finalExecution?.responseBody || "").trim();
    if (!responseBodyRaw) {
      throw new Error("SEPA export function returned an empty response body.");
    }

    let parsedBody = null;
    try {
      parsedBody = JSON.parse(responseBodyRaw);
    } catch {
      throw new Error("SEPA export function returned invalid JSON.");
    }

    if (!parsedBody?.ok) {
      throw new Error(String(parsedBody?.error || "SEPA export did not return a file."));
    }

    const xmlText = decodeBase64Unicode(parsedBody.xmlBase64 || "");
    if (!xmlText) {
      throw new Error("SEPA export function returned no XML content.");
    }

    downloadBlobFile(
      xmlText,
      "application/xml;charset=utf-8",
      String(parsedBody.fileName || `SEPA_Lastschrift_${periodToken}.xml`).trim()
    );

    sepaExportPreview = parsedBody.preview || null;
    return parsedBody;
  }

  function formatSepaSkipReason(reason) {
    const normalized = String(reason || "").trim().toLowerCase();
    if (!normalized) return "unknown";
    if (normalized === "missing_iban") return "Missing IBAN";
    if (normalized === "missing_member") return "Missing member";
    if (normalized === "missing_mandate_id") return "Missing mandate ID";
    if (normalized === "no_outstanding_amount") return "No outstanding amount";
    if (normalized.startsWith("status_")) return `Status: ${statusLabel(normalized.replace(/^status_/, ""))}`;
    return normalized.replaceAll("_", " ");
  }

  function passSyncFieldLabel(field) {
    const labels = {
      in_clubee: "In Clubee",
      pass_status: "Pass status",
      expiry_date: "Expiry date",
      license_name: "License",
      medical_status: "Medical status",
      docs_json: "Documents",
      clubee_email: "Clubee email",
      clubee_phone: "Clubee phone",
      note: "Clubee note"
    };
    return labels[String(field || "")] || String(field || "");
  }

  async function updateMemberSensitiveFinance({ memberId, iban, statusByFeeId }) {
    if (profileFinanceModule && typeof profileFinanceModule.updateMemberSensitiveFinance === "function") {
      await profileFinanceModule.updateMemberSensitiveFinance({
        currentAccessRole,
        backendClient,
        memberId,
        iban,
        statusByFeeId,
        fees: state.fees,
        updateFeeRow
      });
      return;
    }
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can change IBAN or quarter payment statuses.");
    }
    const normalizedIban = normalizeIbanText(iban);
    if (backendClient) {
      const memberUpdate = await backendClient
        .from("members")
        .update({ iban: normalizedIban || null })
        .eq("id", String(memberId || ""));
      if (memberUpdate.error && !/column|attribute|unknown|schema/i.test(String(memberUpdate.error?.message || ""))) {
        throw memberUpdate.error;
      }
    }
    const memberFees = state.fees.filter((fee) => String(fee.memberId) === String(memberId));
    const ibanValue = normalizedIban;
    for (const fee of memberFees) {
      await updateFeeRow({
        feeId: fee.id,
        status: statusByFeeId[String(fee.id)] || fee.status,
        amount: Number(fee.amount || 0),
        paidAmount: Number(fee.paidAmount || 0),
        note: "",
        iban: ibanValue
      });
    }
  }

  function computeDashboardStats() {
    return {
      activeMembers: state.members.filter((member) => member.membershipStatus === "active").length,
      players: state.members.filter((member) => member.roles.includes("player")).length,
      passAlerts: state.members.filter((member) => ["expiring", "expired", "missing", "pending"].includes(member.passStatus) || isPassExpiringSoon(member.passExpiry)).length,
      outstandingFees: state.fees.reduce((sum, fee) => sum + Math.max(fee.amount - fee.paidAmount, 0), 0)
    };
  }

  function renderHeroNotice() {
    const heroActions = document.querySelector(".hero-actions");
    if (!heroActions) return;
    const signedInLabel = authState.user ? authDisplayName() || authState.user.email : "Local preview";
    const roleOptions = ["admin", "coach", "finance_admin", "tech_admin", "player", "staff"];
    const isLocalhost = isLocalhostAuthBypassEnabled();
    const dataSourceLabel = authState.user ? "Appwrite live" : "Local preview";
    heroActions.innerHTML = `
      <div class="hero-stack">
        <div class="toolbar-row">
          ${authState.user || isLocalPreviewMode() ? `<div class="role-switcher"><span>${authState.user ? "Signed in" : "Local mode"}</span><strong>${signedInLabel}</strong><div class="meta">${roleLabel(currentAccessRole)}</div></div>` : ""}
          ${isLocalhostAuthBypassEnabled() ? `
            <label class="role-switcher" for="localhost-role-select" style="gap:6px;">
              <span>Preview as</span>
              <select id="localhost-role-select" data-no-toast="true">
                ${roleOptions.map((role) => `<option value="${role}" ${currentAccessRole === role ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          ${isSyncing ? `<div class="syncing-indicator"><span class="sync-dot"></span>Syncing...</div>` : ""}
          ${isLocalhost ? `<div class="data-source-badge">Data source: <strong>${dataSourceLabel}</strong></div>` : ""}
        </div>
      </div>
    `;
  }
  function renderDashboard() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const userMember = signedInMemberRecord();
    const quarterToken = currentQuarterToken();
    const quarterFormatted = quarterToken.replace("_", " ");
    const currentQuarterFee = userMember ? memberFeesByPeriod(userMember.id).get(quarterToken) : null;
    const currentQuarterFeeStatusLabel = currentQuarterFee
      ? statusLabel(currentQuarterFee.status)
      : statusLabel(userMember?.feeStatus || "pending");
    const passValidationDate = userMember?.passExpiry ? formatDate(userMember.passExpiry) : "-";
    const passValidity = (() => {
      if (!userMember) return "-";
      const normalizedPassStatus = String(userMember.passStatus || "").trim().toLowerCase();
      if (normalizedPassStatus === "expired") return "Expired";
      if (normalizedPassStatus === "valid" || normalizedPassStatus === "expiring") return "Valid";
      if (userMember.passExpiry) {
        const expiryDate = new Date(`${userMember.passExpiry}T00:00:00`);
        if (!Number.isNaN(expiryDate.getTime())) {
          return expiryDate.getTime() < Date.now() ? "Expired" : "Valid";
        }
      }
      return "Missing";
    })();
    const athleteStatsHtml = userMember ? `
      <article class="setup-card">
        <p class="eyebrow">Your Profile</p>
        <div style="display:flex; align-items:center; gap: 12px;">
          <img src="${resolveAvatarSrcForMember(userMember)}" onerror="${avatarFallbackOnErrorAttr()}" alt="Profile picture" style="width:56px; height:56px; border-radius:999px; object-fit:cover; border:1px solid var(--line);" />
          <h3 style="margin:0;">${userMember.name}</h3>
        </div>
        <div style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <p class="muted">Jersey Number</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${userMember.jerseyNumber || "—"}</p>
            </div>
            <div>
              <p class="muted">Membership Status</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${userMember.membershipStatus}</p>
            </div>
          </div>
          <div>
            <p class="muted">Membership fee status for ${quarterFormatted}</p>
            <p style="font-size: 1.25rem; font-weight: 600;">${currentQuarterFeeStatusLabel || "No fees"}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <p class="muted">Player pass</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${passValidity}</p>
            </div>
            <div>
              <p class="muted">Valid till</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${passValidationDate}</p>
            </div>
          </div>
          <div class="button-row">
            <button class="primary-button" id="athlete-view-profile-btn" type="button" data-no-toast="true">View Full Profile</button>
          </div>
        </div>
      </article>
    ` : `
      <article class="setup-card">
        <p class="eyebrow">Your Profile</p>
        <h3>No athlete profile linked</h3>
        <p class="muted">Your signed-in account is active, but no player record is connected yet.</p>
      </article>
    `;
    return `
      <div style="max-width: 760px; display: grid; gap: 12px;">
        ${athleteStatsHtml}
      </div>
    `;
  }

  function renderMembers() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const rows = sortedMembers();
    const options = memberFilterOptions();
    const canManageMembers = currentAccessRole === "admin" || currentAccessRole === "coach";
    const canSeeSensitiveMemberColumns = canManageMembers;
    const adminActionsEnabled = currentAccessRole === "admin" && memberMergeMode;
    const mergeControls = currentAccessRole === "admin"
      ? `<button class="ghost-button" id="toggle-member-admin-mode" type="button">${memberMergeMode ? "Disable admin mode" : "Enable admin mode"}</button>`
      : "";
    const mergeHint = currentAccessRole === "admin"
      ? `<p class="muted">${memberMergeMode ? "Admin mode is active. Merge and deleted-member tools are enabled." : "Enable admin mode for critical tools like merge and deleted-member visibility."}</p>`
      : "";
    const showMergeButton = adminActionsEnabled;
    const showMemberIdColumn = showMergeButton;
    const showActionColumn = canManageMembers;
    const showProfileColumn = true;
    const visibleColumnCount =
      (showMemberIdColumn ? 1 : 0) +
      1 +
      1 +
      1 +
      1 +
      1 +
      (showProfileColumn ? 1 : 0) +
      (canSeeSensitiveMemberColumns ? 1 : 0) +
      (canSeeSensitiveMemberColumns ? 1 : 0) +
      (showActionColumn ? 1 : 0);
    return `
      <div class="section-head">
        <div><p class="eyebrow">Roster</p><h3>Members, roles, and positions</h3></div>
        <div class="button-row">
          <details class="export-menu">
            <summary class="ghost-button export-menu-trigger">Export</summary>
            <div class="export-menu-list">
              <button class="ghost-button small-button" id="export-members-csv-option" type="button">CSV</button>
              <button class="ghost-button small-button" id="export-members-excel-option" type="button">Excel</button>
            </div>
          </details>
          ${canManageMembers ? `<button class="primary-button" id="open-member-dialog" type="button">Add member</button>` : ""}
          ${mergeControls}
        </div>
      </div>
      ${mergeHint}
      <article class="card filter-card members-filter-sticky members-filter-card" style="margin-bottom: 14px;">
        <details class="member-filters-dropdown" ${memberFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Positions, roles, membership, pass status</span>
          </summary>
          <div style="margin-top: 10px;">
            <label>Search by name or email
              <input id="member-search-input" type="search" placeholder="e.g. test test" value="${String(memberFilters.search || "").replaceAll('"', '&quot;')}" />
            </label>
          </div>
          <div class="split" style="grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 10px;">
            <fieldset class="status-filter-group">
              <legend>Positions</legend>
              <div class="status-filter-options">
                ${options.positions.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="positions" value="${value}" ${memberFilters.positions.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("") || `<span class="meta">No positions</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Roles</legend>
              <div class="status-filter-options">
                ${options.roles.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="roles" value="${value}" ${memberFilters.roles.includes(value) ? "checked" : ""} />
                    <span>${roleLabel(value)}</span>
                  </label>
                `).join("") || `<span class="meta">No roles</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Membership</legend>
              <div class="status-filter-options">
                ${options.membership.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="membership" value="${value}" ${memberFilters.membership.includes(value) ? "checked" : ""} />
                    <span>${value.replaceAll("_", " ")}</span>
                  </label>
                `).join("") || `<span class="meta">No membership states</span>`}
                ${adminActionsEnabled ? `
                  <label class="status-check">
                    <input type="checkbox" id="show-deleted-members" ${memberFilters.showDeleted ? "checked" : ""} />
                    <span>deleted</span>
                  </label>
                ` : ""}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Pass status</legend>
              <div class="status-filter-options">
                ${options.passStatuses.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="passStatuses" value="${value}" ${memberFilters.passStatuses.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("") || `<span class="meta">No pass statuses</span>`}
              </div>
            </fieldset>
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-member-filters" type="button" class="ghost-button">Clear member filters</button>
          </div>
        </details>
      </article>
      <div class="table-wrap">
        <table>
          <thead><tr>${showProfileColumn ? `<th>Profile</th>` : ""}${showMemberIdColumn ? `<th>${renderSortButton("members", "id", "ID")}</th>` : ""}<th>${renderSortButton("members", "firstName", "First name")}</th><th>${renderSortButton("members", "lastName", "Last name")}</th><th>Positions</th><th>Roles</th><th>${renderSortButton("members", "jerseyNumber", "Jersey")}</th>${canSeeSensitiveMemberColumns ? `<th>Membership</th><th>${renderSortButton("members", "passStatus", "Pass")}</th>` : ""}${showActionColumn ? `<th>Actions</th>` : ""}</tr></thead>
          <tbody>
            ${rows.map((member) => `
              <tr>
                ${showProfileColumn ? `<td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${member.id}" aria-label="Open profile"></button></td>` : ""}
                ${showMemberIdColumn ? `<td><span class="meta">${member.id}</span></td>` : ""}
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input class="member-inline-input member-inline-first-name" data-member-id="${member.id}" value="${member.firstName || ""}" />`
                    : `<strong>${member.firstName || "-"}</strong>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input class="member-inline-input member-inline-last-name" data-member-id="${member.id}" value="${member.lastName || ""}" /><div class="meta"><input class="member-inline-input member-inline-email" data-member-id="${member.id}" value="${member.email || ""}" placeholder="email" /></div>`
                    : `<strong>${member.lastName || "-"}</strong><div class="meta">${(currentAccessRole === "admin" || isOwnProfile(member)) ? (member.email || "") : ""}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<details class="member-inline-multiselect" data-member-id="${member.id}" data-member-multi="positions"><summary>${(member.positions || []).length ? `${(member.positions || []).length} selected` : "Select positions"}</summary><div class="member-inline-multiselect-options">${Array.from(new Set([...memberPositionOptions, ...(member.positions || [])])).map((value) => `<label class="status-check"><input type="checkbox" class="member-inline-option" data-member-id="${member.id}" data-member-multi="positions" value="${value}" ${(member.positions || []).includes(value) ? "checked" : ""} /><span>${value}</span></label>`).join("")}</div></details>`
                    : `<div class="pill-row dense-row">${member.positions.length ? member.positions.map(plainPill).join(" ") : `<span class="meta">-</span>`}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<details class="member-inline-multiselect" data-member-id="${member.id}" data-member-multi="roles"><summary>${(member.roles || []).length ? `${(member.roles || []).length} selected` : "Select roles"}</summary><div class="member-inline-multiselect-options">${Array.from(new Set([...memberRoleOptions, ...(member.roles || [])])).map((value) => `<label class="status-check"><input type="checkbox" class="member-inline-option" data-member-id="${member.id}" data-member-multi="roles" value="${value}" ${(member.roles || []).includes(value) ? "checked" : ""} /><span>${roleLabel(value)}</span></label>`).join("")}</div></details>`
                    : `<div class="pill-row dense-row">${member.roles.length ? member.roles.map(rolePill).join(" ") : `<span class="meta">-</span>`}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input type="number" min="0" class="member-inline-input member-inline-jersey" data-member-id="${member.id}" value="${member.jerseyNumber ?? ""}" />`
                    : (member.jerseyNumber ?? "-")}
                </td>
                ${canSeeSensitiveMemberColumns ? `
                  <td>
                    ${adminActionsEnabled && !member.deletedAt
                      ? `<select class="member-inline-input member-inline-membership" data-member-id="${member.id}"><option value="active" ${member.membershipStatus === "active" ? "selected" : ""}>active</option><option value="pending" ${member.membershipStatus === "pending" ? "selected" : ""}>pending</option><option value="inactive" ${member.membershipStatus === "inactive" ? "selected" : ""}>inactive</option></select>`
                      : (member.deletedAt ? statusPill("deleted", "deleted") : statusPill(member.membershipStatus))}
                  </td>
                  <td>
                    ${adminActionsEnabled && !member.deletedAt
                      ? `<div class="member-pass-stack"><select class="member-inline-input member-inline-pass-status" data-member-id="${member.id}"><option value="valid" ${displayPassStatus(member.passStatus) === "valid" ? "selected" : ""}>valid</option><option value="missing" ${displayPassStatus(member.passStatus) === "missing" ? "selected" : ""}>missing</option><option value="expired" ${displayPassStatus(member.passStatus) === "expired" ? "selected" : ""}>expired</option></select><input type="date" class="member-inline-input member-inline-pass-expiry ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}" data-member-id="${member.id}" value="${member.passExpiry || ""}" /></div>`
                      : `<div class="member-pass-stack"><span>${statusPill(displayPassStatus(member.passStatus))}</span><div class="meta ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? `Until ${formatDate(member.passExpiry)}` : member.licenseName || "No pass data"}</div></div>`}
                  </td>
                ` : ""}
                ${showActionColumn ? `
                  <td>
                    <div class="pill-row dense-row" style="margin-bottom: 6px;">${renderMemberInvitePill(member)}</div>
                    <div class="action-row">
                      ${adminActionsEnabled && !member.deletedAt ? `<button class="ghost-button small-button member-inline-save-button" type="button" data-member-id="${member.id}">Save</button>` : `<button class="ghost-button small-button edit-member-button" type="button" data-member-id="${member.id}">Edit</button>`}
                      ${renderMemberInviteAction(member)}
                      ${showMergeButton ? `<button class="ghost-button small-button merge-member-button" type="button" data-member-id="${member.id}">Merge</button>` : ""}
                      ${adminActionsEnabled && member.deletedAt ? `<button class="ghost-button small-button undelete-member-button" type="button" data-member-id="${member.id}">Undelete</button>` : ""}
                      ${adminActionsEnabled && !member.deletedAt ? `<button class="ghost-button small-button danger-button delete-member-button" type="button" data-member-id="${member.id}">Delete</button>` : ""}
                    </div>
                  </td>
                ` : ""}
              </tr>
            `).join("") || `<tr><td colspan="${visibleColumnCount}" class="meta">No members match the selected filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderUserPage() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const hashMemberId = userPageMemberIdFromHash();
    const hashRoute = String(window.location.hash || "").replace("#", "").trim().toLowerCase();
    const ownRouteActive = hashRoute === "user/me";
    const ownMemberId = signedInMemberRecord()?.id || "";
    const useOwnProfile = ownRouteActive || profileRouteMode === "own";
    const memberId = useOwnProfile
      ? ownMemberId
      : (hashMemberId || ownMemberId || selectedUserMemberId);
    const member = memberById(memberId);

    if (!member) {
      if (profileRouteMode === "own") {
        return emptyState("Your profile is not linked yet", "Your signed-in account is not connected to a member record. Ask an admin to link your account to your member profile.");
      }
      return emptyState("No member selected", "Open a profile from Members or Membership Finance to view and edit details.");
    }

    const canEditProfile = canEditMemberProfile(member);
    const editDisabled = canEditProfile ? "" : "disabled";
    const canViewSensitive = canViewSensitiveProfileFields(member);
    const canEditSensitive = currentAccessRole === "admin";
    const sensitiveDisabled = canEditSensitive ? "" : "disabled";
    const canEditRolePosition = currentAccessRole === "admin";
    const rolePositionDisabled = canEditRolePosition ? "" : "disabled";
    const canEditNotes = currentAccessRole === "admin";
    const notesDisabled = canEditNotes ? "" : "disabled";
    const canViewProfileEmail = currentAccessRole === "admin" || isOwnProfile(member);
    const feeMap = memberFeesByPeriod(member.id);
    const periods = profileQuarterWindowTokens();
    const firstIban = String(member.memberIban || "").trim();
    const firstIbanDisplay = formatIbanDisplay(firstIban);
    const sensitiveSection = canViewSensitive
      ? `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Sensitive finance</p>
          <h3 style="margin-top: 4px;">IBAN and quarter payment statuses</h3>
        </div>
        ${canEditSensitive
          ? `<label>IBAN:<input id="user-sensitive-iban" value="${firstIbanDisplay}" ${sensitiveDisabled} /></label>`
          : `<div><p class="muted" style="margin-bottom: 4px;">IBAN</p><p>${firstIbanDisplay || "No IBAN on file"}</p></div>`}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Quarter</th><th>Status</th></tr></thead>
            <tbody>
              ${periods.map((period) => {
                const fee = feeMap.get(period);
                if (!fee) {
                  return `<tr><td>${formatFeePeriod(period)}</td><td><span class="meta">No record</span></td></tr>`;
                }
                if (canEditSensitive) {
                  return `<tr><td>${formatFeePeriod(period)}</td><td><select class="user-sensitive-fee-status" data-fee-id="${fee.id}" ${sensitiveDisabled}>${FEE_STATUSES.map((status) => `<option value="${status}" ${fee.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select></td></tr>`;
                }
                return `<tr><td>${formatFeePeriod(period)}</td><td>${statusPill(fee.status)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        ${canEditSensitive ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-sensitive" data-member-id="${member.id}">Save finance fields</button></div>` : ""}
      </article>
      `
      : "";
    const rolePositionSection = `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Club profile</p>
          <h3 style="margin-top: 4px;">Role and position</h3>
        </div>
        <div class="pill-row dense-row">
          ${member.roles.length ? member.roles.map(rolePill).join(" ") : `<span class="meta">No role set</span>`}
          ${member.positions.length ? member.positions.map(plainPill).join(" ") : `<span class="meta">No position set</span>`}
        </div>
        ${canEditRolePosition ? `
          <div class="form-grid">
            <div>
              <label>Roles</label>
              <details class="member-inline-multiselect" id="user-role-multiselect">
                <summary>${member.roles.length ? `${member.roles.length} selected` : "Select roles"}</summary>
                <div class="member-inline-multiselect-options">
                  ${Array.from(new Set([...memberRoleOptions, ...(member.roles || [])])).map((role) => `<label class="status-check"><input type="checkbox" class="user-role-option" value="${role}" ${(member.roles || []).includes(role) ? "checked" : ""} ${rolePositionDisabled} /><span>${roleLabel(role)}</span></label>`).join("")}
                </div>
              </details>
            </div>
            <div>
              <label>Positions</label>
              <details class="member-inline-multiselect" id="user-position-multiselect">
                <summary>${member.positions.length ? `${member.positions.length} selected` : "Select positions"}</summary>
                <div class="member-inline-multiselect-options">
                  ${Array.from(new Set([...memberPositionOptions, ...(member.positions || [])])).map((position) => `<label class="status-check"><input type="checkbox" class="user-position-option" value="${position}" ${(member.positions || []).includes(position) ? "checked" : ""} ${rolePositionDisabled} /><span>${position}</span></label>`).join("")}
                </div>
              </details>
            </div>
          </div>
          <div class="button-row"><button type="button" class="primary-button" id="save-user-role-position" data-member-id="${member.id}">Save role and position</button></div>
        ` : ""}
      </article>
    `;
    const notesSection = `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Notes</p>
          <h3 style="margin-top: 4px;">Member notes</h3>
        </div>
        <label>Notes<textarea id="user-notes" rows="3" placeholder="No notes yet" ${notesDisabled}>${member.notes || ""}</textarea></label>
        ${canEditNotes ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-notes" data-member-id="${member.id}">Save notes</button></div>` : ""}
      </article>
    `;
    const canViewPassDetails = currentAccessRole === "admin" || isOwnProfile(member);
    const passSection = canViewPassDetails ? `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Eligibility</p>
          <h3 style="margin-top: 4px;">Player pass</h3>
        </div>
        <div class="pill-row dense-row">
          ${statusPill(displayPassStatus(member.passStatus))}
        </div>
        <p class="meta ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? `Valid till ${formatDate(member.passExpiry)}` : (member.licenseName || "No expiry date")}</p>
      </article>
    ` : "";
    const securitySection = authState.user && isOwnProfile(member) ? `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Security</p>
          <h3 style="margin-top: 4px;">Password</h3>
        </div>
        <p class="muted">Update your password to keep your account secure.</p>
        <div class="button-row"><button type="button" class="primary-button" id="change-password-button">Change password</button></div>
      </article>
    ` : "";

    return `
      <div class="section-head">
        <div><p class="eyebrow">User</p><h3>Member profile</h3></div>
        <div class="button-row"><button type="button" id="back-to-members" class="ghost-button">Back to members</button></div>
      </div>
      <div class="profile-layout">
        <article class="card profile-main-card" style="display:grid; gap: 12px;">
        <div style="display:flex; align-items:center; gap: 14px;">
          <button type="button" id="user-upload-profile-image-trigger" style="padding:0; border:0; background:none; cursor:${isOwnProfile(member) ? "pointer" : "default"};" ${isOwnProfile(member) ? "title=\"Change profile image\"" : "disabled"}>
            <img src="${resolveAvatarSrcForMember(member)}" onerror="${avatarFallbackOnErrorAttr()}" alt="Profile picture" style="width:64px; height:64px; border-radius:999px; object-fit:cover; border:1px solid var(--line);" />
          </button>
          ${isOwnProfile(member) ? `<input id="user-upload-profile-image-input" type="file" accept="image/*" hidden />` : ""}
          <div>
            <h3 style="margin:0;">${member.name}</h3>
            <p class="meta" style="margin:4px 0 0;">${canViewProfileEmail ? (member.email || "") : ""}</p>
            ${isOwnProfile(member) ? `<p class="meta" style="margin:6px 0 0;">Click image to change profile picture</p>` : ""}
          </div>
        </div>
        <div class="form-grid">
          <label>First name<input id="user-first-name" value="${member.firstName || ""}" ${editDisabled} /></label>
          <label>Last name<input id="user-last-name" value="${member.lastName || ""}" ${editDisabled} /></label>
        </div>
        <div class="form-grid">
          <label>Email<input id="user-email" type="email" value="${canViewProfileEmail ? (member.email || "") : ""}" ${editDisabled} /></label>
          <label>Jersey number<input id="user-jersey" type="number" min="0" value="${member.jerseyNumber ?? ""}" ${editDisabled} /></label>
        </div>
        ${canEditProfile ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-profile" data-member-id="${member.id}">Save profile</button></div>` : ""}
        </article>
        <div class="profile-side-column">
          ${rolePositionSection}
          ${passSection}
          ${notesSection}
          ${securitySection}
          ${sensitiveSection}
        </div>
      </div>
    `;
  }

  function renderFees() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (currentAccessRole !== "admin") {
      return lockedState("Membership finance is hidden for this role.", "Only admins should see and manage membership finance data.");
    }

    const periods = getFeePeriods();
    const visibleFees = sortedVisibleFees();
    const statuses = availableFeeStatuses();
    const collectibleRows = visibleFees.filter((fee) => FEE_COLLECTIBLE_STATUSES.includes(fee.status));
    const totalTarget = collectibleRows.reduce((sum, fee) => sum + fee.amount, 0);
    const totalPaid = collectibleRows.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const collectedCount = collectibleRows.filter((fee) => FEE_PAID_STATUSES.includes(fee.status)).length;
    const collectibleCount = collectibleRows.length;
    const missingCount = Math.max(collectibleCount - collectedCount, 0);
    const selectedLabel = currentFeePeriod();
    const currentQuarter = currentQuarterToken();
    const selectedSet = new Set(selectedFeeMemberIds.map(String));
    const visibleMemberIds = Array.from(new Set(visibleFees.map((fee) => String(fee.memberId))));
    const selectedVisibleCount = visibleMemberIds.filter((memberId) => selectedSet.has(memberId)).length;
    const editableStatuses = FEE_STATUSES;
    const sepaExportAvailable = hasSepaExportCapability();
    const sepaIncluded = Array.isArray(sepaExportPreview?.included) ? sepaExportPreview.included : [];
    const sepaSkipped = Array.isArray(sepaExportPreview?.skipped) ? sepaExportPreview.skipped : [];
    const sepaSummaryCard = sepaExportPreview
      ? `
        <article class="card" style="margin-bottom: 14px;">
          <p class="eyebrow">SEPA Preview</p>
          <h3>Last export summary</h3>
          <p class="muted">Included ${sepaIncluded.length} member(s), skipped ${sepaSkipped.length}.</p>
          ${sepaIncluded.length ? `<p class="meta"><strong>Included:</strong> ${sepaIncluded.map((item) => `${item.name} (${formatMoney(Number(item.outstandingAmount || 0))})`).join(", ")}</p>` : `<p class="meta">No included members recorded yet.</p>`}
          ${sepaSkipped.length ? `<div style="margin-top: 10px;">${sepaSkipped.map((item) => `<div class="meta">${item.name || "Unknown"}: ${formatSepaSkipReason(item.reason)}</div>`).join("")}</div>` : ""}
        </article>
      `
      : "";

    return `
      <div class="section-head">
        <div><p class="eyebrow">Finance</p><h3>Membership finance</h3></div>
        <div class="button-row">
          <details class="export-menu">
            <summary class="ghost-button export-menu-trigger">Export</summary>
            <div class="export-menu-list">
              <button id="export-fees-csv-option" class="ghost-button small-button" type="button">CSV</button>
              <button id="export-fees-excel-option" class="ghost-button small-button" type="button">Excel</button>
              <button id="export-fees-sepa-xml-option" class="ghost-button small-button" type="button" ${sepaExportAvailable ? "" : "disabled title=\"Configure a SEPA Appwrite Function or backend endpoint first.\""}>SEPA XML</button>
            </div>
          </details>
          <button id="toggle-fee-edit-mode" class="ghost-button" type="button">${feeEditMode ? "Exit edit mode" : "Enter edit mode"}</button>
        </div>
      </div>
      <div class="grid two-up">
        <article class="card finance-summary-card">
          <p>${formatMoney(totalPaid)} collected of ${formatMoney(totalTarget)} target. <strong>${collectedCount}/${collectibleCount} collected</strong> (${missingCount} missing)</p>
          <label class="filter-label" style="margin-top: 8px;">Choose fee quarter<select id="fee-period-select">${periods.map((period) => `<option value="${period}" ${period === selectedFeePeriod ? "selected" : ""}>${formatFeePeriod(period)}${period === currentQuarter ? " (current)" : ""}</option>`).join("")}</select></label>
        </article>
      </div>
      <article class="card filter-card fees-filter-sticky fees-filter-card" style="margin-bottom: 14px;">
        <details class="fee-filters-dropdown" ${feeFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Status</span>
          </summary>
          <fieldset class="status-filter-group">
            <legend>Fee status</legend>
            <div class="status-filter-options">
              ${statuses.map((status) => `
                <label class="status-check">
                  <input type="checkbox" class="fee-status-checkbox" value="${status}" ${selectedFeeStatuses.includes(status) ? "checked" : ""} />
                  <span>${statusLabel(status)}</span>
                </label>
              `).join("") || `<span class="meta">No statuses for this quarter.</span>`}
            </div>
          </fieldset>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-fee-filters" type="button" class="ghost-button">Reset fee filters</button>
          </div>
        </details>
      </article>
      ${sepaSummaryCard}
      ${feeEditMode ? `
        <article class="card filter-card" style="margin-bottom: 12px;">
          <p class="eyebrow">Bulk edit</p>
          <h3>Update fee status for selected members</h3>
          <div class="button-row">
            <button id="fee-select-visible" class="ghost-button" type="button">Select visible (${visibleMemberIds.length})</button>
            <button id="fee-clear-selection" class="ghost-button" type="button">Clear selection</button>
          </div>
          <div class="inline-form">
            <label>
              New status
              <select id="fee-bulk-status-select">
                ${FEE_STATUSES.map((status) => `<option value="${status}" ${feeBulkStatus === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
              </select>
            </label>
            <button id="apply-fee-bulk-status" class="primary-button" type="button" ${selectedVisibleCount ? "" : "disabled"}>Apply to selected (${selectedVisibleCount})</button>
          </div>
        </article>
      ` : ""}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profile</th>${feeEditMode ? "<th>Select</th>" : ""}<th>${renderSortButton("fees", "firstName", "First name")}</th><th>${renderSortButton("fees", "lastName", "Last name")}</th><th>${renderSortButton("fees", "amount", "Amount")}</th><th>${renderSortButton("fees", "paid", "Paid")}</th><th>${renderSortButton("fees", "status", "Status")}</th></tr></thead>
          <tbody>
            ${visibleFees.map((fee) => `
              <tr>
                <td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${fee.memberId}" aria-label="Open profile"></button></td>
                ${feeEditMode ? `<td><input type="checkbox" class="fee-member-select" data-member-id="${fee.memberId}" ${selectedSet.has(String(fee.memberId)) ? "checked" : ""} /></td>` : ""}
                <td>${memberFirstName(fee.memberId) || "-"}</td>
                <td>${memberLastName(fee.memberId) || "-"}</td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<input type="number" class="fee-row-input fee-row-amount" data-fee-id="${fee.id}" min="0" step="0.01" value="${Number(fee.amount || 0).toFixed(2)}" />`
                    : formatMoney(fee.amount)}
                </td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<input type="number" class="fee-row-input fee-row-paid" data-fee-id="${fee.id}" min="0" step="0.01" value="${Number(fee.paidAmount || 0).toFixed(2)}" ${["paid", "paid_rookie_fee"].includes(fee.status) ? "readonly" : ""} />`
                    : formatMoney(fee.paidAmount)}
                </td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<select class="fee-row-status-select" data-fee-id="${fee.id}">${editableStatuses.map((status) => `<option value="${status}" ${status === fee.status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select><div class="action-row" style="margin-top: 8px;"><button type="button" class="primary-button small-button fee-row-save" data-fee-id="${fee.id}">Save</button><button type="button" class="ghost-button small-button fee-row-cancel">Cancel</button></div>`
                    : `<button type="button" class="status ${fee.status} fee-row-edit-trigger status-button" data-fee-id="${fee.id}" title="Click to edit">${statusLabel(fee.status)}</button>`}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="${feeEditMode ? 7 : 6}" class="meta">No fee rows for this quarter.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPasses() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (!canAccess("playerPasses")) {
      return lockedState("Player pass data is hidden for this role.", "Only admins, coaches, and technical admins should see player pass details.");
    }
    const includeDeleted = currentAccessRole === "admin" && Boolean(passFilters.showDeleted);
    const allPlayerMembers = state.members.filter((member) => (member.roles || []).includes("player") && (includeDeleted || !member.deletedAt));
    const options = passFilterOptions();
    if (!allPlayerMembers.length) return emptyState("No player pass data yet", "Import the roster and Clubee export to populate this area.");

    const rows = sortedPassMembers();

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Eligibility</p>
          <h3>Player passes</h3>
        </div>
        ${currentAccessRole === "admin" ? `<div class="button-row"><button type="button" class="ghost-button" id="open-pass-sync-review">Sync review</button></div>` : ""}
      </div>
      <article class="card filter-card members-filter-sticky members-filter-card" style="margin-bottom: 14px;">
        <details class="pass-filters-dropdown" ${passFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Name, expiry, status, position, membership</span>
          </summary>
          <div style="margin-top: 10px;">
            <label>Search name
              <input id="pass-search-input" type="search" placeholder="e.g. Max Mustermann" value="${String(passFilters.search || "").replaceAll('"', '&quot;')}" />
            </label>
          </div>
          <div class="form-grid" style="margin-top: 10px;">
            <label>Expiry from
              <input id="pass-expiry-from" type="date" value="${String(passFilters.from || "")}" />
            </label>
            <label>Expiry to
              <input id="pass-expiry-to" type="date" value="${String(passFilters.to || "")}" />
            </label>
          </div>
          <div class="split" style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px;">
            <fieldset class="status-filter-group">
              <legend>Status</legend>
              <div class="status-filter-options">
                ${options.statuses.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="statuses" value="${value}" ${passFilters.statuses.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("")}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Position</legend>
              <div class="status-filter-options">
                ${options.positions.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="positions" value="${value}" ${passFilters.positions.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("") || `<span class="meta">No positions</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Membership</legend>
              <div class="status-filter-options">
                ${options.membership.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="membership" value="${value}" ${passFilters.membership.includes(value) ? "checked" : ""} />
                    <span>${value.replaceAll("_", " ")}</span>
                  </label>
                `).join("") || `<span class="meta">No membership states</span>`}
              </div>
            </fieldset>
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-pass-filters" type="button" class="ghost-button">Clear pass filters</button>
            ${currentAccessRole === "admin" ? `<label class="status-check"><input type="checkbox" id="show-deleted-pass-members" ${passFilters.showDeleted ? "checked" : ""} /><span>Show deleted players</span></label>` : ""}
          </div>
        </details>
      </article>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>${renderSortButton("passes", "firstName", "First name")}</th>
              <th>${renderSortButton("passes", "lastName", "Last name")}</th>
              <th>${renderSortButton("passes", "position", "Position")}</th>
              <th>${renderSortButton("passes", "expiry", "Expiry")}</th>
              <th>${renderSortButton("passes", "status", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((member) => `
              <tr>
                <td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${member.id}" aria-label="Open profile"></button></td>
                <td><strong>${member.firstName || "-"}</strong>${member.deletedAt ? ` ${statusPill("deleted", "deleted")}` : ""}</td>
                <td><strong>${member.lastName || "-"}</strong></td>
                <td>${formatList(member.positions, "-")}</td>
                <td class="${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? formatDate(member.passExpiry) : "No expiry date"}</td>
                <td>${statusPill(displayPassStatus(member.passStatus))}</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="meta">No pass rows match the selected filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEquipment() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }

    const rows = sortEquipmentRows(state.equipment || []);
    const activeSheet = resolveEquipmentSheetKey(selectedEquipmentSheet);
    const activeKindFilter = normalizeEquipmentKindFilter(selectedEquipmentKindFilter);
    if (selectedEquipmentSheet !== activeSheet) {
      saveEquipmentSheetKey(activeSheet);
    }
    const visibleRows = equipmentSheetRows(rows, activeSheet);
    const filteredRows = filterEquipmentRowsByKind(visibleRows, activeKindFilter);
    const sortedRows = sortRows(filteredRows, "equipment", (item, key) => {
      if (key === "group") return String(item.group || "");
      if (key === "article") return String(item.article || "");
      if (key === "condition") return String(item.condition || "");
      if (key === "location") return String(item.location || "");
      if (key === "checkedAt") return String(item.checkedAt || "");
      if (key === "notes") return String(item.notes || "");
      if (key === "quantity") {
        const numeric = Number(String(item.quantity || "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(numeric) ? numeric : String(item.quantity || "");
      }
      return String(item.article || "");
    });
    const showGroupColumn = activeSheet === "all";
    const canEdit = currentAccessRole === "admin";
    const visibleColumnCount = canEdit ? (showGroupColumn ? 8 : 7) : (showGroupColumn ? 7 : 6);
    const sheetTabs = equipmentSheetCounts(rows)
      .map((sheet) => `<button type="button" class="sort-button equipment-sheet-tab ${sheet.key === activeSheet ? "is-active" : ""}" data-no-toast="true" data-equipment-sheet="${sheet.key}">${sheet.label} (${sheet.count})</button>`)
      .join("");
    const kindFilterButtons = [
      { key: "all", label: "All" },
      { key: "containers", label: "Containers" },
      { key: "items", label: "Items" }
    ].map((filter) => `<button type="button" class="sort-button equipment-sheet-tab ${filter.key === activeKindFilter ? "is-active" : ""}" data-no-toast="true" data-equipment-kind-filter="${filter.key}">${filter.label}</button>`).join("");
    const canRemoveActiveSheet = canEdit && activeSheet !== "all" && !isBuiltinEquipmentSheetKey(activeSheet);
    const groupOptions = equipmentGroupOptions();
    const createDraft = equipmentCreateDraft
      ? createEquipmentDraft(equipmentCreateDraft, equipmentSheetPromptDefaultGroup(activeSheet))
      : null;

    const renderGroupSelect = (selectedGroup, mode, itemId = "") => `
      <select class="equipment-inline-input" data-mode="${mode}" data-field="group" ${itemId ? `data-equipment-id="${itemId}"` : ""}>
        ${groupOptions.map((groupName) => `<option value="${groupName.replaceAll('"', '&quot;')}" ${String(selectedGroup || "").toLowerCase() === groupName.toLowerCase() ? "selected" : ""}>${groupName}</option>`).join("")}
      </select>
    `;

    const renderEditCell = (itemId, field, value, type = "text", placeholder = "") => `<input class="equipment-inline-input" data-mode="edit" data-equipment-id="${itemId}" data-field="${field}" type="${type}" value="${String(value || "").replaceAll('"', '&quot;')}" placeholder="${placeholder}" />`;
    const renderCreateCell = (field, value, type = "text", placeholder = "") => `<input class="equipment-inline-input" data-mode="create" data-field="${field}" type="${type}" value="${String(value || "").replaceAll('"', '&quot;')}" placeholder="${placeholder}" />`;
    const renderKindSelect = (selectedKind, mode, itemId = "") => `
      <select class="equipment-inline-input" data-mode="${mode}" data-field="itemKind" ${itemId ? `data-equipment-id="${itemId}"` : ""}>
        <option value="item" ${String(selectedKind || "item").toLowerCase() !== "container" ? "selected" : ""}>Item</option>
        <option value="container" ${String(selectedKind || "").toLowerCase() === "container" ? "selected" : ""}>Container</option>
      </select>
    `;
    const renderParentSelect = (selectedParentId, selectedGroup, mode, itemId = "") => {
      const options = equipmentContainerOptions(rows, itemId, selectedGroup);
      return `
        <select class="equipment-inline-input" data-mode="${mode}" data-field="parentItemId" ${itemId ? `data-equipment-id="${itemId}"` : ""}>
          <option value="">No parent</option>
          ${options.map((container) => `<option value="${String(container.id || "").replaceAll('"', '&quot;')}" ${String(selectedParentId || "") === String(container.id || "") ? "selected" : ""}>${String(container.article || "Unnamed container").replaceAll('"', "&quot;")}</option>`).join("")}
        </select>
      `;
    };
    const renderPhotoField = (item, mode, itemId = "") => {
      const photoSrc = resolveEquipmentPhotoSrc(item);
      const inputId = mode === "edit" ? `equipment-photo-input-${itemId}` : "equipment-photo-input-create";
      return `
        <div style="display:grid; gap:8px;">
          ${photoSrc
            ? `<button type="button" class="equipment-photo-thumb-button" data-equipment-photo-src="${photoSrc.replaceAll('"', "&quot;")}" data-equipment-photo-title="${String(item?.article || "Equipment photo").replaceAll('"', "&quot;")}" data-no-toast="true"><img src="${photoSrc}" alt="Equipment photo" style="width:88px; height:88px; object-fit:cover; border-radius:14px; border:1px solid var(--line);" /></button>`
            : `<div class="meta" style="display:flex; align-items:center; justify-content:center; width:88px; height:88px; border-radius:14px; border:1px dashed var(--line); background:rgba(15,23,42,0.03);">No photo</div>`}
          <div class="button-row" style="gap:8px;">
            <button type="button" class="ghost-button small-button equipment-photo-trigger" data-mode="${mode}" ${itemId ? `data-equipment-id="${itemId}"` : ""} data-input-id="${inputId}" data-no-toast="true">Upload photo</button>
            ${photoSrc ? `<button type="button" class="ghost-button small-button danger-button equipment-photo-remove" data-mode="${mode}" ${itemId ? `data-equipment-id="${itemId}"` : ""} data-no-toast="true">Remove</button>` : ""}
          </div>
          <input id="${inputId}" class="equipment-photo-input" data-mode="${mode}" ${itemId ? `data-equipment-id="${itemId}"` : ""} type="file" accept="image/*" hidden />
        </div>
      `;
    };

    const rowsHtml = sortedRows.map((item) => {
      const isEditing = canEdit && String(equipmentInlineEditId || "") === String(item.id || "");
      const draft = isEditing ? createEquipmentDraft(equipmentInlineDraftById[item.id] || item, item.group || equipmentSheetPromptDefaultGroup(activeSheet)) : item;
      const parent = String(item.parentItemId || "").trim()
        ? rows.find((candidate) => String(candidate.id || "") === String(item.parentItemId || ""))
        : null;
      const children = rows.filter((candidate) => String(candidate.parentItemId || "") === String(item.id || ""));
      const childCount = children.length;
      const isExpanded = item.itemKind === "container" && isEquipmentContainerExpanded(item.id);
      const articlePrefix = item.parentItemId ? `<span class="meta" style="margin-right:6px;">↳</span>` : "";
      const typeMeta = item.itemKind === "container"
        ? `<span class="meta">Container${childCount ? ` · ${childCount} item${childCount === 1 ? "" : "s"}` : ""}</span>`
        : (parent ? `<span class="meta">In ${parent.article || "container"}</span>` : `<span class="meta">Item</span>`);
      const photoSrc = resolveEquipmentPhotoSrc(item);
      const toggleContentsButton = item.itemKind === "container"
        ? `<button type="button" class="ghost-button small-button equipment-toggle-contents-button" data-container-id="${item.id}" data-no-toast="true">${isExpanded ? "Hide contents" : "Show contents"}</button>`
        : "";
      const contentsRow = item.itemKind === "container" && isExpanded
        ? `
          <tr class="equipment-container-contents-row">
            <td colspan="${visibleColumnCount}">
              <div class="card" style="margin: 6px 0 0; padding: 14px 16px;">
                <div class="button-row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong>Contents of ${item.article || "container"}</strong>
                  <span class="meta">${childCount} item${childCount === 1 ? "" : "s"}</span>
                </div>
                ${children.length
                  ? `<div style="display:grid; gap:8px;">${children.map((child) => `
                      <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:8px 0; border-top:1px solid rgba(15,23,42,0.08);">
                        <div>
                          <strong>${child.article || "Unnamed item"}</strong>
                          <div class="meta">${child.category || "No category"}${child.quantity ? ` · Qty ${child.quantity}` : ""}${child.location ? ` · ${child.location}` : ""}</div>
                        </div>
                        <div class="meta">${child.condition || "No condition"}</div>
                      </div>
                    `).join("")}</div>`
                  : `<p class="meta" style="margin:0;">This container does not contain any items yet.</p>`}
              </div>
            </td>
          </tr>
        `
        : "";
      if (!isEditing) {
        return `
          <tr>
            ${showGroupColumn ? `<td>${item.group || "-"}</td>` : ""}
            <td><div style="display:flex; gap:12px; align-items:flex-start;">${photoSrc ? `<button type="button" class="equipment-photo-thumb-button" data-equipment-photo-src="${photoSrc.replaceAll('"', "&quot;")}" data-equipment-photo-title="${String(item.article || "Equipment photo").replaceAll('"', "&quot;")}" data-no-toast="true"><img src="${photoSrc}" alt="Equipment photo" style="width:64px; height:64px; object-fit:cover; border-radius:12px; border:1px solid var(--line); flex:0 0 auto;" /></button>` : ""}<div><strong>${articlePrefix}${item.article || "-"}</strong><div>${typeMeta}</div>${toggleContentsButton ? `<div style="margin-top:6px;">${toggleContentsButton}</div>` : ""}</div></div></div></td>
            <td>${item.quantity || "-"}</td>
            <td>${item.condition || "-"}</td>
            <td>${item.location || "-"}</td>
            <td>${formatDate(item.checkedAt)}</td>
            <td>${item.notes || "-"}</td>
            ${canEdit
              ? `<td><div class="action-row"><button type="button" class="ghost-button small-button equipment-edit-button" data-equipment-id="${item.id}" data-no-toast="true">Edit</button>${item.itemKind === "container" ? `<button type="button" class="ghost-button small-button equipment-add-child-button" data-parent-id="${item.id}" data-no-toast="true">Add content</button>` : ""}<button type="button" class="ghost-button small-button danger-button equipment-delete-button" data-equipment-id="${item.id}" data-no-toast="true">Delete</button></div></td>`
              : ""}
          </tr>
          ${contentsRow}
        `;
      }

      return `
        <tr class="equipment-inline-edit-row">
          ${showGroupColumn ? `<td>${renderGroupSelect(draft.group, "edit", item.id)}</td>` : ""}
          <td><div style="display:grid; gap:8px;">${renderEditCell(item.id, "article", draft.article, "text", "Required")}${renderKindSelect(draft.itemKind, "edit", item.id)}${renderParentSelect(draft.parentItemId, draft.group, "edit", item.id)}${renderPhotoField(draft, "edit", item.id)}</div></td>
          <td>${renderEditCell(item.id, "quantity", draft.quantity)}</td>
          <td>${renderEditCell(item.id, "condition", draft.condition)}</td>
          <td>${renderEditCell(item.id, "location", draft.location)}</td>
          <td>${renderEditCell(item.id, "checkedAt", draft.checkedAt, "date")}</td>
          <td>${renderEditCell(item.id, "notes", draft.notes)}</td>
          <td>
            <div class="action-row">
              <button type="button" class="primary-button small-button equipment-save-inline-button" data-equipment-id="${item.id}" data-no-toast="true">Save</button>
              <button type="button" class="ghost-button small-button equipment-cancel-inline-button" data-equipment-id="${item.id}" data-no-toast="true">Cancel</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Inventory</p>
          <h3>Current equipment</h3>
          <p class="meta">Visible for all users${canEdit ? ", editable by admins" : "."}</p>
        </div>
        <div class="button-row">
          ${canEdit ? `<button id="equipment-add-sheet" type="button" class="ghost-button" data-no-toast="true">Add sheet</button>` : ""}
          ${canRemoveActiveSheet ? `<button id="equipment-remove-sheet" type="button" class="ghost-button danger-button" data-no-toast="true" data-sheet-key="${activeSheet}">Remove current sheet</button>` : ""}
          ${canEdit ? `<button id="equipment-add-item" type="button" class="primary-button" data-no-toast="true">${activeSheet === "all" ? "Add item" : `Add item to ${equipmentSheetLabel(activeSheet)}`}</button>` : ""}
        </div>
      </div>
      ${equipmentStatus ? `<article class="card" style="margin-bottom: 12px;"><p class="meta">${equipmentStatus}</p></article>` : ""}
      ${canEdit && createDraft ? `
        <article class="card" style="margin-bottom: 12px;">
          <p class="eyebrow">Add equipment</p>
          <div class="form-grid" style="margin-bottom: 10px;">
            <label>Group ${renderGroupSelect(createDraft.group, "create")}</label>
            <label>Article ${renderCreateCell("article", createDraft.article, "text", "Required")}</label>
            <label>Type ${renderKindSelect(createDraft.itemKind, "create")}</label>
            <label>Parent container ${renderParentSelect(createDraft.parentItemId, createDraft.group, "create")}</label>
            <label>Photo ${renderPhotoField(createDraft, "create")}</label>
            <label>Quantity ${renderCreateCell("quantity", createDraft.quantity)}</label>
            <label>Condition ${renderCreateCell("condition", createDraft.condition)}</label>
            <label>Location ${renderCreateCell("location", createDraft.location)}</label>
            <label>Last checked ${renderCreateCell("checkedAt", createDraft.checkedAt, "date")}</label>
            <label>Notes ${renderCreateCell("notes", createDraft.notes)}</label>
          </div>
          <div class="button-row">
            <button id="equipment-save-create" type="button" class="primary-button" data-no-toast="true">Save item</button>
            <button id="equipment-cancel-create" type="button" class="ghost-button" data-no-toast="true">Cancel</button>
          </div>
        </article>
      ` : ""}
      <div class="card" style="margin-bottom: 12px;">
        <div class="button-row equipment-sheet-tabs" style="margin-bottom: 10px;">
          ${sheetTabs}
        </div>
        <div class="button-row equipment-sheet-tabs" style="margin-bottom: 0;">
          ${kindFilterButtons}
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${showGroupColumn ? `<th>${renderSortButton("equipment", "group", "Group")}</th>` : ""}
              <th>${renderSortButton("equipment", "article", "Article")}</th>
              <th>${renderSortButton("equipment", "quantity", "Quantity")}</th>
              <th>${renderSortButton("equipment", "condition", "Condition")}</th>
              <th>${renderSortButton("equipment", "location", "Location")}</th>
              <th>${renderSortButton("equipment", "checkedAt", "Last checked")}</th>
              <th>${renderSortButton("equipment", "notes", "Notes")}</th>
              ${canEdit ? "<th>Actions</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${visibleColumnCount}" class="meta">No ${activeKindFilter === "containers" ? "containers" : activeKindFilter === "items" ? "items" : "equipment rows"} found for ${equipmentSheetLabel(activeSheet).toLowerCase()}.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPassSyncReview() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (currentAccessRole !== "admin") {
      return lockedState("Pass sync review is admin-only.", "Only admins can preview and approve Clubee updates.");
    }
    const preview = passSyncPreview;
    const changes = Array.isArray(preview?.changes) ? preview.changes : [];
    const selectedSet = new Set(selectedPassSyncMemberIds.map((id) => String(id)));

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Clubee Sync</p>
          <h1 color="red">Under Development do not use!</h1>
          <h3>Review pass updates</h3>
          <p class="meta">Nothing is written until you click apply.</p>
        </div>
        <div class="button-row">
          <button type="button" class="ghost-button" id="preview-pass-sync-button">Preview changes</button>
          <button type="button" class="primary-button" id="apply-pass-sync-button" ${!changes.length || !selectedPassSyncMemberIds.length ? "disabled" : ""}>Apply selected</button>
        </div>
      </div>
      <article class="card" style="margin-bottom: 14px;">
        <div class="form-grid" style="margin-bottom: 10px;">
          <label>Clubee XLSX file
            <input id="pass-sync-file-input" type="file" accept=".xlsx,.xls" />
          </label>
        </div>
        <p class="meta" id="pass-sync-file-label">${passSyncUpload?.fileName ? `Selected file: ${passSyncUpload.fileName}` : "No file selected. If empty, server uses its configured default file path."}</p>
        ${preview ? `
          <div class="pill-row">
            ${plainPill(`Source: ${preview.sourceFilePath || "default"}`)}
            ${plainPill(`Rows read: ${preview.processedRows || 0}`)}
            ${plainPill(`Matched: ${preview.matchedRows || 0}`)}
            ${plainPill(`Changes: ${changes.length}`)}
            ${plainPill(`Unmatched: ${preview.unmatchedRows || 0}`)}
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button type="button" class="ghost-button small-button" id="select-all-pass-sync">Select all changes</button>
            <button type="button" class="ghost-button small-button" id="clear-pass-sync-selection">Clear selection</button>
          </div>
        ` : `<p class="meta">Click <strong>Preview changes</strong> to see exactly what would be updated.</p>`}
      </article>
      ${preview && preview.unmatchedNames?.length ? `<article class="card" style="margin-bottom: 14px;"><h3>Unmatched names</h3><p class="meta">${preview.unmatchedNames.join(", ")}</p></article>` : ""}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Member</th>
              <th>Type</th>
              <th>Field changes</th>
            </tr>
          </thead>
          <tbody>
            ${changes.map((change) => `
              <tr>
                <td><input type="checkbox" class="pass-sync-select" data-member-id="${change.memberId}" ${selectedSet.has(String(change.memberId)) ? "checked" : ""} /></td>
                <td><strong>${change.memberName || "Unknown"}</strong><div class="meta">${change.memberEmail || "No email"}</div></td>
                <td>${statusPill(change.existingPass ? "pending" : "exempt", change.existingPass ? "update" : "create")}</td>
                <td>${(change.fieldChanges || []).map((fieldChange) => `<div class="meta">${passSyncFieldLabel(fieldChange.field)}: ${fieldChange.current || "-"} -> ${fieldChange.next || "-"}</div>`).join("")}</td>
              </tr>
            `).join("") || `<tr><td colspan="4" class="meta">No updates needed based on current Clubee export.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function formatDateTime(dateText) {
    if (!dateText) return "-";
    const date = new Date(String(dateText || "").trim());
    if (Number.isNaN(date.getTime())) return String(dateText || "-");
    return new Intl.DateTimeFormat("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function clubeeGamesViewModel() {
    return CLUBEE_GAMES_SNAPSHOT.map((game) => {
      const homeTeam = game.homeTeam || {};
      const awayTeam = game.awayTeam || {};
      const emperorsHome = String(homeTeam.name || "").trim().toLowerCase() === EMPERORS_TEAM_NAME.toLowerCase();
      const opponent = emperorsHome ? awayTeam : homeTeam;
      const emperorsScore = emperorsHome ? game.homeScore : game.awayScore;
      const opponentScore = emperorsHome ? game.awayScore : game.homeScore;
      const hasScore = Number.isFinite(emperorsScore) && Number.isFinite(opponentScore);
      const venueParts = [game.venueName, game.venueCity].map((value) => String(value || "").trim()).filter(Boolean);
      let resultTone = "pending";
      let resultLabel = "Scheduled";
      if (hasScore) {
        if (emperorsScore > opponentScore) {
          resultTone = "paid";
          resultLabel = "Win";
        } else if (emperorsScore < opponentScore) {
          resultTone = "expired";
          resultLabel = "Loss";
        } else {
          resultTone = "pending";
          resultLabel = "Draw";
        }
      }
      return {
        id: String(game.id || ""),
        startsAt: String(game.startsAt || ""),
        displayDateTime: formatDateTime(game.startsAt),
        phase: String(game.phase || "").trim() || "Game",
        opponentName: String(opponent?.name || "Opponent").trim(),
        opponentLogo: String(opponent?.logo || "").trim(),
        emperorsHome,
        homeTeamName: String(homeTeam.name || "").trim(),
        awayTeamName: String(awayTeam.name || "").trim(),
        homeTeamLogo: String(homeTeam.logo || "").trim(),
        awayTeamLogo: String(awayTeam.logo || "").trim(),
        emperorsScore,
        opponentScore,
        hasScore,
        resultTone,
        resultLabel,
        venue: venueParts.join(" · "),
        info: String(game.info || "").trim(),
        streamLink: String(game.streamLink || "").trim()
      };
    }).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }

  function renderEvents() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const games = clubeeGamesViewModel();
    if (!games.length) {
      return emptyState("No games found", "Once we have game data connected, the season schedule and scores will show up here.");
    }
    const completedGames = games.filter((game) => game.hasScore);
    const upcomingGames = games.filter((game) => !game.hasScore);
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Season Games</p>
          <h3>Uni Wien Emperors</h3>
          <p class="meta">Games snapshot from the Austrian College Sports League season page.</p>
        </div>
        <div class="pill-row" style="margin-top:0;">
          ${plainPill(`${games.length} games shown`)}
          ${plainPill(`${completedGames.length} with score`)}
          ${plainPill(`${upcomingGames.length} upcoming`)}
        </div>
      </div>
      <article class="setup-card" style="margin-bottom: 14px;">
        <p class="meta" style="margin:0;">Source: <a href="${CLUBEE_GAMES_SOURCE_URL}" target="_blank" rel="noreferrer">Clubee ACSL season games</a></p>
      </article>
      <div class="grid">
        ${games.map((game) => `
          <article class="setup-card game-card">
            <div class="game-card-top">
              <div>
                <p class="eyebrow">${game.phase}</p>
                <h3 style="margin-bottom: 4px;">${game.emperorsHome ? "vs" : "at"} ${game.opponentName}</h3>
                <p class="meta" style="margin:0;">${game.displayDateTime}</p>
              </div>
              <div>${statusPill(game.resultTone, game.resultLabel)}</div>
            </div>
            <div class="game-scoreboard">
              <div class="game-team ${game.emperorsHome ? "is-emperors" : ""}">
                ${game.homeTeamLogo ? `<img src="${game.homeTeamLogo}" alt="${game.homeTeamName}" class="game-team-logo" />` : ""}
                <strong>${game.homeTeamName}</strong>
              </div>
              <div class="game-score">
                ${game.hasScore
                  ? `<span>${game.emperorsHome ? game.homeScore : game.opponentScore}</span><span class="meta">:</span><span>${game.emperorsHome ? game.awayScore : game.emperorsScore}</span>`
                  : `<span class="meta">Kickoff</span>`}
              </div>
              <div class="game-team ${!game.emperorsHome ? "is-emperors" : ""}">
                ${game.awayTeamLogo ? `<img src="${game.awayTeamLogo}" alt="${game.awayTeamName}" class="game-team-logo" />` : ""}
                <strong>${game.awayTeamName}</strong>
              </div>
            </div>
            <div class="pill-row">
              ${game.venue ? plainPill(game.venue) : ""}
              ${game.info ? plainPill(`Game day ${game.info}`) : ""}
              ${game.emperorsHome ? plainPill("Home") : plainPill("Away")}
            </div>
            ${game.streamLink ? `<div style="margin-top: 12px;"><a href="${game.streamLink}" target="_blank" rel="noreferrer" class="ghost-button">Open stream</a></div>` : ""}
          </article>
        `).join("")}
      </div>
    `;
  }

  function normalizeGameTeamFilter(values) {
    const allowed = new Set(Object.keys(TEAM_BUCKET_FILE_MAP));
    return (Array.isArray(values) ? values : [])
      .map((entry) => String(entry || "").trim())
      .filter((entry) => allowed.has(entry));
  }

  function saveSelectedGameTeams() {
    saveStoredArray(GAMES_FILTER_STORAGE_KEY, selectedGameTeams);
  }

  function gameFilterTeamOptions() {
    return Object.keys(TEAM_BUCKET_FILE_MAP);
  }

  function buildLeagueGamesViewModel() {
    const activeFilters = new Set(normalizeGameTeamFilter(selectedGameTeams));
    return LEAGUE_GAMES_SNAPSHOT
      .filter((game) => {
        if (!activeFilters.size) return true;
        const homeName = String(game?.homeTeam?.name || "").trim();
        const awayName = String(game?.awayTeam?.name || "").trim();
        if (homeName === "TBA" || awayName === "TBA") return false;
        return activeFilters.has(homeName) || activeFilters.has(awayName);
      })
      .map((game) => {
        const homeTeamName = String(game?.homeTeam?.name || "TBA").trim();
        const awayTeamName = String(game?.awayTeam?.name || "TBA").trim();
        const hasScore = Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore);
        const venueParts = [game.venueName, game.venueCity].map((value) => String(value || "").trim()).filter(Boolean);
        return {
          id: String(game.id || ""),
          stage: String(game.stage || "Games").trim(),
          subtitle: String(game.subtitle || "").trim(),
          startsAt: String(game.startsAt || ""),
          displayDateTime: formatDateTime(game.startsAt),
          homeTeamName,
          awayTeamName,
          homeTeamLogo: teamLogoUrl(homeTeamName),
          awayTeamLogo: teamLogoUrl(awayTeamName),
          homeScore: Number.isFinite(game.homeScore) ? game.homeScore : null,
          awayScore: Number.isFinite(game.awayScore) ? game.awayScore : null,
          hasScore,
          statusTone: hasScore ? "paid" : "pending",
          statusLabel: hasScore ? "Result" : "Scheduled",
          venue: venueParts.join(" · "),
          streamLink: String(game.streamLink || "").trim(),
          isReplay: Boolean(game.isReplay)
        };
      })
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }

  function renderGamesBoard() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const games = buildLeagueGamesViewModel();
    const filterOptions = gameFilterTeamOptions();
    if (!games.length) {
      return emptyState("No games match this filter", "Try clearing the team filter to show the full ACSL schedule.");
    }
    const completedGames = games.filter((game) => game.hasScore);
    const upcomingGames = games.filter((game) => !game.hasScore);
    const stageOrder = [];
    const gamesByStage = new Map();
    games.forEach((game) => {
      if (!gamesByStage.has(game.stage)) {
        stageOrder.push(game.stage);
        gamesByStage.set(game.stage, []);
      }
      gamesByStage.get(game.stage).push(game);
    });
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Austrian College Sports League</p>
          <h3>Games & results</h3>
          <p class="meta">Full season board with team logos from your Appwrite bucket.</p>
        </div>
        <div class="pill-row" style="margin-top:0;">
          ${plainPill(`${games.length} games shown`)}
          ${plainPill(`${completedGames.length} finished`)}
          ${plainPill(`${upcomingGames.length} upcoming`)}
        </div>
      </div>
      <article class="setup-card" style="margin-bottom: 14px;">
        <div class="game-filter-bar">
          <button type="button" class="ghost-button game-filter-chip ${selectedGameTeams.length ? "" : "is-active"}" data-game-team="__all__">All teams</button>
          ${filterOptions.map((teamName) => `
            <button type="button" class="ghost-button game-filter-chip ${selectedGameTeams.includes(teamName) ? "is-active" : ""}" data-game-team="${escapeHtml(teamName)}">${escapeHtml(teamName.replace("UNI-Wien ", "").replace("Med Uni Wien ", ""))}</button>
          `).join("")}
        </div>
        <p class="meta" style="margin:12px 0 0;">Source: <a href="${CLUBEE_GAMES_SOURCE_URL}" target="_blank" rel="noreferrer">Clubee ACSL season games</a></p>
      </article>
      <div class="games-stage-stack">
        ${stageOrder.map((stage) => `
          <section class="setup-card games-stage">
            <div class="games-stage-head">
              <div>
                <p class="eyebrow">${escapeHtml(stage)}</p>
                <h3>${escapeHtml(stage)}</h3>
              </div>
              <div>${plainPill(`${gamesByStage.get(stage).length} fixtures`)}</div>
            </div>
            <div class="games-stage-list">
              ${gamesByStage.get(stage).map((game) => `
                <article class="game-match">
                  <div class="game-match-meta">
                    <div>
                      <strong>${escapeHtml(game.subtitle || game.displayDateTime)}</strong>
                      <p class="meta">${escapeHtml(game.subtitle ? game.displayDateTime : (game.venue || "Venue TBA"))}</p>
                    </div>
                    <div class="game-match-status-row">
                      ${statusPill(game.statusTone, game.statusLabel)}
                      ${game.isReplay ? plainPill("Replay") : ""}
                    </div>
                  </div>
                  <div class="game-match-body">
                    <div class="game-match-team game-match-team-home">
                      ${game.homeTeamLogo ? `<img src="${game.homeTeamLogo}" alt="${escapeHtml(game.homeTeamName)}" class="game-match-logo" />` : `<div class="game-match-logo game-match-logo-fallback">${escapeHtml(game.homeTeamName.slice(0, 1) || "?")}</div>`}
                      <div>
                        <strong>${escapeHtml(game.homeTeamName)}</strong>
                        <p class="meta">${game.homeTeamName === EMPERORS_TEAM_NAME ? "Uni Wien" : "ACSL"}</p>
                      </div>
                    </div>
                    <div class="game-match-center">
                      ${game.hasScore
                        ? `<div class="game-match-score"><span>${game.homeScore}</span><span class="game-match-score-separator">:</span><span>${game.awayScore}</span></div>`
                        : `<div class="game-match-kickoff">${escapeHtml(game.displayDateTime)}</div>`}
                      <p class="meta">${escapeHtml(game.venue || "Venue TBA")}</p>
                      ${game.streamLink ? `<a href="${game.streamLink}" target="_blank" rel="noreferrer" class="ghost-button">Watch replay</a>` : ""}
                    </div>
                    <div class="game-match-team game-match-team-away">
                      <div>
                        <strong>${escapeHtml(game.awayTeamName)}</strong>
                        <p class="meta">${game.awayTeamName === EMPERORS_TEAM_NAME ? "Uni Wien" : "ACSL"}</p>
                      </div>
                      ${game.awayTeamLogo ? `<img src="${game.awayTeamLogo}" alt="${escapeHtml(game.awayTeamName)}" class="game-match-logo" />` : `<div class="game-match-logo game-match-logo-fallback">${escapeHtml(game.awayTeamName.slice(0, 1) || "?")}</div>`}
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function bindGamesActions() {
    document.querySelectorAll("[data-game-team]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = String(button.dataset.gameTeam || "").trim();
        if (value === "__all__") {
          selectedGameTeams = [];
        } else if (value) {
          const next = new Set(normalizeGameTeamFilter(selectedGameTeams));
          if (next.has(value)) {
            next.delete(value);
          } else {
            next.add(value);
          }
          selectedGameTeams = Array.from(next);
        }
        saveSelectedGameTeams();
        mount();
      });
    });
  }

  function renderInvites() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (!state.invites.length) return emptyState("No invite history yet", "Once events are editable, we can add attendance invitation tracking here.");
    return `...`;
  }

  function renderSettings() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const restrictions = bootstrapMeta.permissionsModel?.restrictedAreas || {};
    return `
      <div class="grid two-up">
        ${currentAccessRole === "admin" ? `
        <article class="setup-card">
          <p class="eyebrow">Invitations</p>
          <h3>Invite an admin</h3>
          <p>Send an email invitation so the admin can set a password and sign in.</p>
          <div class="inline-form">
            <label>Email<input id="admin-invite-email" type="email" placeholder="admin@example.com" /></label>
            <label>Role<select id="admin-invite-role">${INVITE_ROLE_OPTIONS.map((role) => `<option value="${role}" ${role === authInviteRole ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}</select></label>
          </div>
          <div class="button-row"><button type="button" class="primary-button" id="send-admin-invite">Send invite</button></div>
        </article>
        ` : ""}
      </div>
    `;
  }

  function organizationTaskList(value) {
    return String(value || "")
      .split(/\s*(?:,|\n)\s*/)
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  function organizationMemberMatch(name) {
    const needle = String(name || "").trim().toLowerCase();
    if (!needle) return null;
    return state.members.find((member) => {
      const fullName = String(member.name || `${member.firstName || ""} ${member.lastName || ""}`).trim().toLowerCase();
      return fullName === needle;
    }) || null;
  }

  function renderOrganizationPerson(label, name) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return "";
    const matchedMember = organizationMemberMatch(normalizedName);
    const personMarkup = matchedMember
      ? `<button type="button" class="organization-person-link open-user-page-button" data-member-id="${matchedMember.id}">${normalizedName}</button>`
      : `<strong>${normalizedName}</strong>`;
    return `
      <div class="organization-person-block">
        <p class="muted" style="margin:0 0 4px;">${label}</p>
        ${personMarkup}
      </div>
    `;
  }

  function renderOrganization() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const rows = sortOrganizationRows(state.organization || []);
    const canEdit = currentAccessRole === "admin";
    const rootEntry = rows.find((entry) => String(entry.headOf || "").trim().toLowerCase() === "emperors") || rows[0] || null;
    const branchRows = rootEntry ? rows.filter((entry) => String(entry.id) !== String(rootEntry.id)) : rows;
    const renderTaskItems = (tasks) => tasks.length
      ? `<div class="organization-task-list">${tasks.map((task) => `<div class="organization-task-item">${task}</div>`).join("")}</div>`
      : `<p class="meta" style="margin:0;">No tasks listed yet.</p>`;
    const renderTaskDetails = (tasks) => tasks.length
      ? `<details class="organization-task-details"><summary class="organization-task-summary">Aufgaben (${tasks.length})</summary>${renderTaskItems(tasks)}</details>`
      : "";
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Club Structure</p>
          <h3>Organization</h3>
          <p class="meta">Visible for everyone. Only admins can change responsibilities.</p>
        </div>
        <div class="button-row">
          ${canEdit ? `<button type="button" class="primary-button" id="organization-add-entry">Add section</button>` : ""}
        </div>
      </div>
      <article class="card" style="margin-bottom: 16px; overflow: visible;">
        <div class="organization-chart">
          ${rootEntry ? `
            <article class="organization-root">
              <div class="organization-root-header">Head of Emperors</div>
              <div class="organization-root-body">
                <div class="organization-people">
                  ${renderOrganizationPerson("Verantwortlicher", rootEntry.verantwortung)}
                  ${renderOrganizationPerson("Co-Verantwortlicher", rootEntry.coVerantwortung)}
                </div>
                ${renderTaskDetails(organizationTaskList(rootEntry.aufgaben))}
                ${canEdit ? `<div class="action-row"><button type="button" class="ghost-button small-button organization-edit-button" data-organization-id="${rootEntry.id}" data-no-toast="true">Edit</button><button type="button" class="ghost-button small-button danger-button organization-delete-button" data-organization-id="${rootEntry.id}" data-no-toast="true">Delete</button></div>` : ""}
              </div>
            </article>
            <div class="organization-root-connector"></div>
          ` : ""}
          <div class="organization-branches">
            ${branchRows.map((entry) => {
              const tasks = organizationTaskList(entry.aufgaben);
              return `
                <article class="organization-branch">
                  <div class="organization-branch-header">${entry.headOf || "Section"}</div>
                  <div class="organization-branch-body">
                    <div class="organization-people">
                      ${renderOrganizationPerson("Verantwortlicher", entry.verantwortung)}
                      ${renderOrganizationPerson("Co-Verantwortlicher", entry.coVerantwortung)}
                    </div>
                    ${renderTaskDetails(tasks)}
                    ${canEdit ? `<div class="action-row" style="margin-top:8px;"><button type="button" class="ghost-button small-button organization-edit-button" data-organization-id="${entry.id}" data-no-toast="true">Edit</button><button type="button" class="ghost-button small-button danger-button organization-delete-button" data-organization-id="${entry.id}" data-no-toast="true">Delete</button></div>` : ""}
                  </div>
                </article>
              `;
            }).join("") || `<article class="organization-branch"><div class="organization-branch-header">No sections</div><div class="organization-branch-body"><p class="meta">Add your first section once the Appwrite table is ready.</p></div></article>`}
          </div>
        </div>
      </article>
    `;
  }

  async function saveOrganizationEntry(entry) {
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can update organization entries.");
    }
    const normalized = normalizeOrganizationEntry({
      id: entry?.id || generateOrganizationId(),
      headOf: entry?.headOf,
      verantwortung: entry?.verantwortung,
      "co-verantwortung": entry?.coVerantwortung,
      aufgaben: entry?.aufgaben
    }, 0);
    const remotePayload = {
      id: normalized.id,
      head_of: normalized.headOf || null,
      verantwortung: normalized.verantwortung || null,
      co_verantwortung: normalized.coVerantwortung || null,
      aufgaben: normalized.aufgaben || null
    };
    if (backendClient && authState.user) {
      const response = await backendClient.from("organization").upsert(remotePayload, { onConflict: "id" });
      if (response.error) {
        const message = String(response.error?.message || "");
        if (/authoriz|permission|not authorized|role missing/i.test(message)) {
          throw new Error("Appwrite denied the write. Please grant create/update/delete permissions on the 'organization' table to authenticated users, then rely on the app's admin-only UI for editing.");
        }
        throw response.error;
      }
    }
    const existingIndex = (state.organization || []).findIndex((row) => String(row.id) === String(normalized.id));
    const nextRows = existingIndex >= 0
      ? state.organization.map((row, index) => (index === existingIndex ? normalized : row))
      : [...(state.organization || []), normalized];
    applyBootstrap({
      source: bootstrapMeta.source,
      permissionsModel: bootstrapMeta.permissionsModel,
      members: state.members,
      fees: state.fees,
      organization: nextRows,
      events: state.events,
      invites: state.invites,
      equipment: state.equipment
    });
  }

  async function deleteOrganizationEntry(organizationId) {
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can update organization entries.");
    }
    const normalizedId = String(organizationId || "").trim();
    if (!normalizedId) return;
    if (backendClient && authState.user) {
      const response = await backendClient.from("organization").delete().eq("id", normalizedId);
      if (response.error) {
        const message = String(response.error?.message || "");
        if (/authoriz|permission|not authorized|role missing/i.test(message)) {
          throw new Error("Appwrite denied the delete. Please grant delete permissions on the 'organization' table to authenticated users.");
        }
        throw response.error;
      }
    }
    const nextRows = (state.organization || []).filter((row) => String(row.id) !== normalizedId);
    applyBootstrap({
      source: bootstrapMeta.source,
      permissionsModel: bootstrapMeta.permissionsModel,
      members: state.members,
      fees: state.fees,
      organization: nextRows,
      events: state.events,
      invites: state.invites,
      equipment: state.equipment
    });
  }

  function openOrganizationDialog(entry) {
    const dialog = document.getElementById("organization-dialog");
    const form = document.getElementById("organization-form");
    const title = document.getElementById("organization-dialog-title");
    const submit = document.getElementById("organization-submit-button");
    if (!dialog || !form) return;
    organizationDialogEditingId = String(entry?.id || "").trim();
    form.reset();
    form.elements.organizationId.value = organizationDialogEditingId;
    form.elements.headOf.value = entry?.headOf || "";
    form.elements.verantwortung.value = entry?.verantwortung || "";
    form.elements.coVerantwortung.value = entry?.coVerantwortung || "";
    form.elements.aufgaben.value = String(entry?.aufgaben || "").replace(/\s*,\s*/g, "\n");
    title.textContent = entry ? `Edit ${entry.headOf || "section"}` : "Add organization section";
    submit.textContent = entry ? "Save changes" : "Save section";
    dialog.showModal();
  }

  function viewsAllowedForRole(role) {
    const normalizedRole = String(role || "").trim().toLowerCase();
    if (normalizedRole === "admin") return ["dashboard", "members", "fees", "user", "passes", "organization", "equipment", "pass-sync", "events", "invites", "settings", "recovery"];
    if (normalizedRole === "finance_admin") return ["dashboard", "members", "fees", "user", "organization", "equipment", "events", "invites", "settings", "recovery"];
    if (normalizedRole === "coach") return ["dashboard", "members", "user", "passes", "organization", "equipment", "events", "invites", "recovery"];
    if (normalizedRole === "tech_admin") return ["dashboard", "members", "user", "passes", "organization", "equipment", "events", "invites", "recovery"];
    return ["dashboard", "members", "user", "organization", "equipment", "events", "recovery"];
  }

  function canAccessView(viewId) {
    return viewsAllowedForRole(currentAccessRole).includes(String(viewId || "").trim());
  }

  function resolveAllowedView(nextViewId) {
    const normalizedView = String(nextViewId || "").trim();
    if (viewIds.includes(normalizedView) && canAccessView(normalizedView)) return normalizedView;
    if (canAccessView("dashboard")) return "dashboard";
    if (canAccessView("user")) return "user";
    return "dashboard";
  }

  function updateNavigationVisibility() {
    const signedIn = Boolean(authState.user) || isLocalPreviewMode();
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      const viewId = String(link.dataset.view || "").trim();
      const visible = signedIn && canAccessView(viewId);
      link.style.display = visible ? "" : "none";
      if (!visible) link.classList.remove("active");
    });

    const navDivider = document.querySelector(".nav hr");
    if (navDivider) {
      navDivider.style.display = signedIn ? "" : "none";
    }

    const profileNavButton = document.getElementById("profile-nav-button");
    const logoutNavButton = document.getElementById("logout-nav-button");
    if (profileNavButton) {
      profileNavButton.textContent = signedIn ? "My Profile" : "Log in";
      profileNavButton.style.display = "block";
      profileNavButton.classList.remove("active");
    }
    if (logoutNavButton) {
      logoutNavButton.style.display = authState.user ? "block" : "none";
      logoutNavButton.classList.remove("active");
    }
  }

  function bindLocalPreviewActions() {
    const roleSelect = document.getElementById("localhost-role-select");
    if (!roleSelect) return;
    roleSelect.onchange = function () {
      const selected = String(roleSelect.value || "").trim().toLowerCase();
      const allowed = new Set(["admin", "coach", "finance_admin", "tech_admin", "player", "staff"]);
      currentAccessRole = allowed.has(selected) ? selected : "player";
      saveStoredValue(ACCESS_KEY, currentAccessRole);
      authState.status = `Local preview role switched to ${roleLabel(currentAccessRole)}.`;
      mount();
      switchView(resolveAllowedView(getRouteView()));
    };
  }

  function bindNavigation() {
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      link.onclick = function () {
        const nextView = link.dataset.view;
        if (!canAccessView(nextView)) {
          switchView(resolveAllowedView(nextView));
          return;
        }
        window.location.hash = nextView;
        switchView(nextView);
      };
    });

    const profileNavButton = document.getElementById("profile-nav-button");
    const logoutNavButton = document.getElementById("logout-nav-button");
    if (profileNavButton) {
      profileNavButton.onclick = function () {
        if (!authState.user) {
          if (isLocalPreviewMode()) {
            profileRouteMode = "member";
            if (!selectedUserMemberId && state.members.length) {
              selectedUserMemberId = String(state.members[0].id || "");
            }
            window.location.hash = "user";
            mount();
            switchView("user");
            return;
          }
          window.location.hash = "dashboard";
          mount();
          switchView("dashboard");
          const emailInput = document.getElementById("auth-email");
          if (emailInput) emailInput.focus();
          return;
        }

        profileRouteMode = "own";
        selectedUserMemberId = "";
        window.location.hash = "user/me";
        mount();
        switchView("user");
      };
    }
    if (logoutNavButton) {
      logoutNavButton.onclick = async function () {
        if (!authState.user) return;
        try {
          await signOut();
          authState.status = "Signed out.";
        } catch (error) {
          authState.status = error.message || "Sign out failed.";
        }
        profileRouteMode = "member";
        selectedUserMemberId = "";
        window.location.hash = "dashboard";
        mount();
        switchView("dashboard");
      };
    }
  }

  function bindMobileMenu() {
    const menuToggle = document.getElementById("menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    if (!menuToggle || !sidebar) return;

    const closeMenu = () => {
      menuToggle.classList.remove("open");
      sidebar.classList.remove("open");
      sidebarOverlay.classList.remove("open");
    };

    const openMenu = () => {
      menuToggle.classList.add("open");
      sidebar.classList.add("open");
      sidebarOverlay.classList.add("open");
    };

    menuToggle.onclick = () => {
      if (sidebar.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    if (sidebarOverlay) {
      sidebarOverlay.onclick = closeMenu;
    }

    // Close menu when a nav link is clicked
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    // Close menu when view changes
    window.addEventListener("hashchange", closeMenu);
  }

  function switchView(nextViewId) {
    const finalView = resolveAllowedView(nextViewId);
    viewIds.forEach((viewId) => {
      const section = document.getElementById(viewId);
      if (section) section.classList.toggle("active", viewId === finalView);
    });
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === finalView);
    });
  }

  function getRouteView() {
    const hash = window.location.hash.replace("#", "").trim();
    if (/^user\//i.test(hash)) return "user";
    if (/^recovery/i.test(hash)) return "recovery";
    
    // Check for recovery token in URL params (both search and hash)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    if ((params.has("type") && params.get("type") === "recovery") || (hashParams.has("type") && hashParams.get("type") === "recovery")) {
      return "recovery";
    }
    if ((params.has("userId") && params.has("secret")) || (hashParams.has("userId") && hashParams.has("secret"))) {
      return "recovery";
    }
    
    return viewIds.includes(hash) ? hash : "dashboard";
  }

  function openMemberDialog(member) {
    const dialog = document.getElementById("member-dialog");
    const form = document.getElementById("member-form");
    const title = document.getElementById("member-dialog-title");
    const submit = document.getElementById("member-submit-button");
    if (!dialog || !form) return;
    form.reset();
    const fallbackParts = splitNameParts(member?.name || "");
    form.elements.memberId.value = member?.id || "";
    form.elements.firstName.value = member?.firstName || fallbackParts.firstName || "";
    form.elements.lastName.value = member?.lastName || fallbackParts.lastName || "";
    form.elements.email.value = member?.email || "";
    const roleSet = new Set(member?.roles || ["player"]);
    form.querySelectorAll('input[name="roles"]').forEach((input) => {
      input.checked = roleSet.has(input.value);
    });
    const positionSet = new Set(member?.positions || []);
    form.querySelectorAll('input[name="positions"]').forEach((input) => {
      input.checked = positionSet.has(input.value);
    });
    form.elements.jerseyNumber.value = member?.jerseyNumber ?? "";
    form.elements.membershipStatus.value = member?.membershipStatus || "active";
    form.elements.passStatus.value = displayPassStatus(member?.passStatus || "valid");
    form.elements.passExpiry.value = member?.passExpiry || (!member ? defaultPassExpiryDate() : "");
    form.elements.notes.value = member?.notes || "";
    title.textContent = member ? `Edit ${member.name}` : "Add a club member";
    submit.textContent = member ? "Save changes" : "Save member";
    dialog.showModal();
  }

  function bindMemberActions() {
    const canManageMembers = currentAccessRole === "admin" || currentAccessRole === "coach";
    const openButton = document.getElementById("open-member-dialog");
    const toggleMergeModeButton = document.getElementById("toggle-member-admin-mode");
    const dialog = document.getElementById("member-dialog");
    const form = document.getElementById("member-form");
    const submitButton = document.getElementById("member-submit-button");
    const closeButton = document.querySelector(".ghost-icon");
    const cancelButton = document.querySelector(".dialog-actions .ghost-button");
    const rolesSelectAll = document.getElementById("roles-select-all");
    const rolesClearAll = document.getElementById("roles-clear-all");
    const positionsSelectAll = document.getElementById("positions-select-all");
    const positionsClearAll = document.getElementById("positions-clear-all");
    const dialogPassStatusInput = form?.elements?.passStatus || null;
    const dialogPassExpiryInput = form?.elements?.passExpiry || null;
    if (openButton) {
      openButton.onclick = function () {
        openMemberDialog(null);
      };
    }
    if (toggleMergeModeButton) {
      toggleMergeModeButton.onclick = function () {
        memberMergeMode = !memberMergeMode;
        mount();
        switchView("members");
      };
    }
    if (closeButton && dialog) {
      closeButton.onclick = function () {
        dialog.close();
      };
    }
    if (cancelButton && dialog) {
      cancelButton.onclick = function () {
        dialog.close();
      };
    }
    if (submitButton && form) {
      submitButton.onclick = function () {
        if (authState.pendingAction === "member-save") return;
        if (typeof form.requestSubmit === "function") {
          try {
            form.requestSubmit();
            return;
          } catch (error) {
            console.warn("requestSubmit failed, using submit event fallback", error);
          }
        }
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      };
    }
    if (rolesSelectAll && form) {
      rolesSelectAll.onclick = function () {
        form.querySelectorAll('input[name="roles"]').forEach((input) => {
          input.checked = true;
        });
      };
    }
    if (rolesClearAll && form) {
      rolesClearAll.onclick = function () {
        form.querySelectorAll('input[name="roles"]').forEach((input) => {
          input.checked = false;
        });
      };
    }
    if (positionsSelectAll && form) {
      positionsSelectAll.onclick = function () {
        form.querySelectorAll('input[name="positions"]').forEach((input) => {
          input.checked = true;
        });
      };
    }
    if (positionsClearAll && form) {
      positionsClearAll.onclick = function () {
        form.querySelectorAll('input[name="positions"]').forEach((input) => {
          input.checked = false;
        });
      };
    }
    if (dialogPassStatusInput && dialogPassExpiryInput) {
      dialogPassStatusInput.onchange = function () {
        const status = String(dialogPassStatusInput.value || "").trim().toLowerCase();
        if (status === "missing") {
          dialogPassExpiryInput.value = "";
          return;
        }
        if (status === "valid" && !String(dialogPassExpiryInput.value || "").trim()) {
          dialogPassExpiryInput.value = defaultPassExpiryDate();
        }
      };
    }
    document.querySelectorAll(".edit-member-button").forEach((button) => {
      button.onclick = function () {
        if (!canManageMembers) return;
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (member) openMemberDialog(member);
      };
    });
    document.querySelectorAll(".member-inline-save-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const memberId = String(member.id);
        const firstNameInput = document.querySelector(`.member-inline-first-name[data-member-id="${memberId}"]`);
        const lastNameInput = document.querySelector(`.member-inline-last-name[data-member-id="${memberId}"]`);
        const emailInput = document.querySelector(`.member-inline-email[data-member-id="${memberId}"]`);
        const jerseyInput = document.querySelector(`.member-inline-jersey[data-member-id="${memberId}"]`);
        const membershipInput = document.querySelector(`.member-inline-membership[data-member-id="${memberId}"]`);
        const passStatusInput = document.querySelector(`.member-inline-pass-status[data-member-id="${memberId}"]`);
        const passExpiryInput = document.querySelector(`.member-inline-pass-expiry[data-member-id="${memberId}"]`);
        if (!firstNameInput || !lastNameInput || !emailInput || !jerseyInput || !membershipInput || !passStatusInput || !passExpiryInput) {
          authState.status = "Could not save this row because required inline fields are missing. Try reopening Members view.";
          mount();
          switchView("members");
          return;
        }
        const selectedPositions = Array.from(document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="positions"]:checked`))
          .map((input) => String(input.value || "").trim().toUpperCase())
          .filter(Boolean);
        const selectedRoles = Array.from(document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="roles"]:checked`))
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);
        const normalizedPassStatus = String(passStatusInput.value || "missing").trim().toLowerCase();
        const normalizedPassExpiry = normalizedPassStatus === "missing"
          ? ""
          : String(passExpiryInput.value || "").trim();
        try {
          await saveMember({
            memberId,
            firstName: String(firstNameInput.value || "").trim(),
            lastName: String(lastNameInput.value || "").trim(),
            email: String(emailInput.value || "").trim(),
            positions: Array.from(new Set(selectedPositions)),
            roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
            jerseyNumber: String(jerseyInput.value || "").trim(),
            membershipStatus: String(membershipInput.value || "active").trim(),
            passStatus: normalizedPassStatus,
            passExpiry: normalizedPassExpiry,
            notes: member.notes || ""
          });
          authState.status = `${member.name} was updated.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".member-inline-option").forEach((input) => {
      input.onchange = function () {
        const memberId = String(input.dataset.memberId || "");
        const kind = String(input.dataset.memberMulti || "");
        if (!memberId || !kind) return;
        const selectedCount = document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="${kind}"]:checked`).length;
        const details = document.querySelector(`.member-inline-multiselect[data-member-id="${memberId}"][data-member-multi="${kind}"]`);
        const summary = details ? details.querySelector("summary") : null;
        if (summary) {
          summary.textContent = selectedCount ? `${selectedCount} selected` : `Select ${kind}`;
        }
      };
    });
    document.querySelectorAll(".member-inline-pass-status").forEach((select) => {
      select.onchange = function () {
        const memberId = String(select.dataset.memberId || "").trim();
        if (!memberId) return;
        const expiryInput = document.querySelector(`.member-inline-pass-expiry[data-member-id="${memberId}"]`);
        if (!expiryInput) return;
        const status = String(select.value || "").trim().toLowerCase();
        if (status === "missing") {
          expiryInput.value = "";
          expiryInput.classList.remove("is-expiring-soon");
          return;
        }
        if (status === "valid" && !String(expiryInput.value || "").trim()) {
          expiryInput.value = defaultPassExpiryDate();
        }
      };
    });
    document.querySelectorAll(".delete-member-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const confirmed = window.confirm(`Mark ${member.name} as deleted? The record will be hidden by default and can still be reviewed in admin mode.`);
        if (!confirmed) return;
        try {
          await removeMember(member.id);
          authState.status = `${member.name} was marked as deleted.`;
          mount();
        } catch (error) {
          authState.status = error.message;
          mount();
        }
      };
    });
    document.querySelectorAll(".undelete-member-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const confirmed = window.confirm(`Restore ${member.name} from deleted state?`);
        if (!confirmed) return;
        try {
          await undeleteMember(member.id);
          authState.status = `${member.name} was restored.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".merge-member-button").forEach((button) => {
      button.onclick = async function () {
        const keepMember = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!keepMember) return;

        const suggestions = state.members
          .filter((entry) => String(entry.id) !== String(keepMember.id))
          .map((entry) => ({
            member: entry,
            score: mergeSuggestionScore(keepMember, entry)
          }))
          .filter((entry) => entry.score >= 10)
          .sort((left, right) => right.score - left.score)
          .slice(0, 8)
          .map((entry) => entry.member);

        const defaultSuggestionId = suggestions.length ? String(suggestions[0].id) : "";

        const suggestionText = suggestions.length
          ? suggestions.map((entry) => `${entry.id}: ${entry.name}${entry.email ? ` (${entry.email})` : ""}`).join("\n")
          : "No close suggestions. You can still enter an ID manually.";

        const rawId = window.prompt(
          `Merge target: ${keepMember.name} (ID ${keepMember.id})\n\nEnter the MEMBER ID you want to merge INTO this record (that record will be removed).\n\nSuggestions:\n${suggestionText}`
          ,
          defaultSuggestionId
        );
        if (!rawId) return;
        const removeId = String(rawId).trim();
        if (!removeId || String(removeId) === String(keepMember.id)) {
          authState.status = "Please enter a valid different member ID to merge.";
          mount();
          switchView("members");
          return;
        }
        const removeMember = state.members.find((entry) => String(entry.id) === String(removeId));
        if (!removeMember) {
          authState.status = `Member ID ${removeId} was not found.`;
          mount();
          switchView("members");
          return;
        }

        const confirmed = window.confirm(`Merge ${removeMember.name} (ID ${removeMember.id}) into ${keepMember.name} (ID ${keepMember.id})? This cannot be undone.`);
        if (!confirmed) return;

        try {
          await mergeMemberRecords({
            keepMemberId: keepMember.id,
            removeMemberId: removeMember.id,
            firstName: keepMember.firstName,
            lastName: keepMember.lastName
          });
          authState.status = `Merged ${removeMember.name} into ${keepMember.name}.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".invite-member-button").forEach((button) => {
      button.onclick = async function (event) {
        event.preventDefault();
        event.stopPropagation();
        const previousScrollY = window.scrollY || 0;
        const previousScrollX = window.scrollX || 0;
        const member = memberById(button.dataset.memberId);
        if (!member || !member.email) return;
        const inviteState = memberInviteState(member);
        if (inviteState === "invited") {
          window.alert("You already invited this person. Wait until they activate their account.");
          return;
        }
        if (inviteState === "activated") {
          window.alert("This person already activated their account. No invite is needed.");
          return;
        }
        const originalButtonHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="auth-spinner"></span> Inviting...`;
        try {
          button.blur();
          await inviteMember(member.id);
          authState.status = `Invite sent to ${member.email}.`;
          showToast(`Invite sent to ${member.email}.`, "success");
          if (shouldUseRemoteData()) {
            await loadBootstrapData();
          } else {
            member.inviteSentAt = new Date().toISOString();
          }
          mount();
          switchView("members");
          requestAnimationFrame(() => {
            window.scrollTo(previousScrollX, previousScrollY);
          });
        } catch (error) {
          const errorMessage = error?.message || "Could not send invite.";
          authState.status = errorMessage;
          showToast(errorMessage, "error");
          mount();
          switchView("members");
          requestAnimationFrame(() => {
            window.scrollTo(previousScrollX, previousScrollY);
          });
        } finally {
          button.disabled = false;
          button.innerHTML = originalButtonHTML;
        }
      };
    });
    if (form) {
      form.onsubmit = async function (event) {
        event.preventDefault();
        if (authState.pendingAction === "member-save") return;

        authState.pendingAction = "member-save";
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Saving...";
        }

        const formData = new FormData(form);
        const selectedRoles = formData
          .getAll("roles")
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        const selectedPositions = formData
          .getAll("positions")
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean);
        const payload = {
          memberId: String(formData.get("memberId") || "").trim(),
          firstName: String(formData.get("firstName") || "").trim(),
          lastName: String(formData.get("lastName") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
          positions: Array.from(new Set(selectedPositions)),
          jerseyNumber: String(formData.get("jerseyNumber") || "").trim(),
          membershipStatus: String(formData.get("membershipStatus") || "active"),
          passStatus: String(formData.get("passStatus") || "missing").trim(),
          passExpiry: String(formData.get("passExpiry") || "").trim(),
          notes: String(formData.get("notes") || "").trim()
        };
        if (!payload.firstName && !payload.lastName) {
          authState.status = "Please enter at least a first name or a last name.";
          authState.pendingAction = "";
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = payload.memberId ? "Save changes" : "Save member";
          }
          mount();
          return;
        }
        try {
          await saveMember(payload);
          const displayName = `${payload.firstName} ${payload.lastName}`.trim();
          authState.status = payload.memberId ? `${displayName} was updated locally.` : `${displayName} was added locally.`;
          dialog.close();
          window.location.hash = "members";
          mount();
          switchView("members");
        } catch (error) {
          const errorMessage = error?.message || String(error);
          authState.status = errorMessage;
          console.error("[Member Save Error]", error);
          showToast(errorMessage, "error");
          mount();
        } finally {
          authState.pendingAction = "";
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = payload.memberId ? "Save changes" : "Save member";
          }
        }
      };
    }
  }

  function bindUserPageActions() {
    document.querySelectorAll(".open-user-page-button").forEach((button) => {
      button.onclick = function () {
        profileRouteMode = "member";
        const memberId = String(button.dataset.memberId || "").trim();
        if (!memberId) return;
        selectedUserMemberId = memberId;
        window.location.hash = `user/${encodeURIComponent(memberId)}`;
        mount();
        switchView("user");
      };
    });

    const backButton = document.getElementById("back-to-members");
    if (backButton) {
      backButton.onclick = function () {
        profileRouteMode = "member";
        window.location.hash = "members";
        switchView("members");
      };
    }

    const uploadProfileImageTrigger = document.getElementById("user-upload-profile-image-trigger");
    const uploadProfileImageInput = document.getElementById("user-upload-profile-image-input");
    if (uploadProfileImageTrigger && uploadProfileImageInput) {
      uploadProfileImageTrigger.onclick = function () {
        uploadProfileImageInput.click();
      };
      uploadProfileImageInput.onchange = async function () {
        const originalFile = uploadProfileImageInput.files && uploadProfileImageInput.files[0];
        if (!originalFile) return;
        if (!String(originalFile.type || "").toLowerCase().startsWith("image/")) {
          showToast("Please select an image file.", "error");
          return;
        }
        try {
          let uploadFile = originalFile;
          if (Number(uploadFile.size || 0) > MAX_AVATAR_UPLOAD_BYTES) {
            showToast("Image is large. Compressing automatically...", "info");
            uploadFile = await compressImageForAvatar(uploadFile);
          }
          if (Number(uploadFile.size || 0) > MAX_AVATAR_UPLOAD_BYTES) {
            showToast("Image is still too large after compression. Please use a smaller image.", "error");
            return;
          }

          const bucketId = String(APPWRITE_CONFIG?.profilePicturesBucketId || "").trim();
          if (bucketId) {
            await uploadProfileAvatarToStorage(uploadFile);
          } else {
            const dataUrl = await readFileAsDataUrl(uploadFile);
            saveProfileAvatar(dataUrl);
          }
          showToast("Profile image updated.", "success");
          mount();
          switchView("user");
        } catch (error) {
          showToast(error?.message || "Could not upload image.", "error");
        }
      };
    }

    const saveButton = document.getElementById("save-user-profile");
    if (saveButton) {
      saveButton.onclick = async function () {
        const member = memberById(saveButton.dataset.memberId);
        if (!member) return;
        if (!canEditMemberProfile(member)) {
          authState.status = "You can only edit your own profile unless you are an admin.";
          mount();
          switchView("user");
          return;
        }
        const firstNameInput = document.getElementById("user-first-name");
        const lastNameInput = document.getElementById("user-last-name");
        const emailInput = document.getElementById("user-email");
        const jerseyInput = document.getElementById("user-jersey");
        if (!firstNameInput || !lastNameInput || !emailInput || !jerseyInput) return;
        try {
          await saveMember({
            memberId: member.id,
            firstName: String(firstNameInput.value || "").trim(),
            lastName: String(lastNameInput.value || "").trim(),
            email: String(emailInput.value || "").trim(),
            positions: member.positions || [],
            roles: member.roles && member.roles.length ? member.roles : ["player"],
            jerseyNumber: String(jerseyInput.value || "").trim(),
            membershipStatus: member.membershipStatus || "active",
            notes: member.notes || ""
          });
          authState.status = "User profile updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveSensitiveButton = document.getElementById("save-user-sensitive");
    if (saveSensitiveButton) {
      saveSensitiveButton.onclick = async function () {
        const member = memberById(saveSensitiveButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update IBAN and quarter payment statuses.";
          mount();
          switchView("user");
          return;
        }
        const ibanInput = document.getElementById("user-sensitive-iban");
        const statusInputs = Array.from(document.querySelectorAll(".user-sensitive-fee-status"));
        const statusByFeeId = {};
        statusInputs.forEach((input) => {
          const feeId = String(input.dataset.feeId || "").trim();
          if (feeId) statusByFeeId[feeId] = input.value;
        });
        try {
          await updateMemberSensitiveFinance({
            memberId: member.id,
            iban: String(ibanInput?.value || "").trim(),
            statusByFeeId
          });
          authState.status = "Sensitive finance fields updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveRolePositionButton = document.getElementById("save-user-role-position");
    if (saveRolePositionButton) {
      saveRolePositionButton.onclick = async function () {
        const member = memberById(saveRolePositionButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update role and position.";
          mount();
          switchView("user");
          return;
        }
        const selectedRoles = Array.from(document.querySelectorAll(".user-role-option:checked"))
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);
        const selectedPositions = Array.from(document.querySelectorAll(".user-position-option:checked"))
          .map((input) => String(input.value || "").trim().toUpperCase())
          .filter(Boolean);
        try {
          await saveMember({
            memberId: member.id,
            firstName: member.firstName || "",
            lastName: member.lastName || "",
            email: member.email || "",
            positions: Array.from(new Set(selectedPositions)),
            roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
            jerseyNumber: member.jerseyNumber ?? "",
            membershipStatus: member.membershipStatus || "active",
            notes: member.notes || ""
          });
          authState.status = "Role and position updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveNotesButton = document.getElementById("save-user-notes");
    if (saveNotesButton) {
      saveNotesButton.onclick = async function () {
        const member = memberById(saveNotesButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update notes.";
          mount();
          switchView("user");
          return;
        }
        const notesInput = document.getElementById("user-notes");
        try {
          await saveMember({
            memberId: member.id,
            firstName: member.firstName || "",
            lastName: member.lastName || "",
            email: member.email || "",
            positions: member.positions || [],
            roles: member.roles && member.roles.length ? member.roles : ["player"],
            jerseyNumber: member.jerseyNumber ?? "",
            membershipStatus: member.membershipStatus || "active",
            notes: String(notesInput?.value || "").trim()
          });
          authState.status = "Notes updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

  }

  function promptEquipmentRow(initial = {}) {
    const defaultGroup = String(initial.group || equipmentSheetLabel(selectedEquipmentSheet) || "General");
    const group = window.prompt("Group (e.g. Training, Gameday, Technik)", defaultGroup);
    if (group === null) return null;
    const category = window.prompt("Category", String(initial.category || ""));
    if (category === null) return null;
    const article = window.prompt("Article", String(initial.article || ""));
    if (article === null) return null;
    const quantity = window.prompt("Quantity", String(initial.quantity || ""));
    if (quantity === null) return null;
    const condition = window.prompt("Condition", String(initial.condition || ""));
    if (condition === null) return null;
    const location = window.prompt("Location", String(initial.location || ""));
    if (location === null) return null;
    const checkedAt = window.prompt("Last checked", String(initial.checkedAt || ""));
    if (checkedAt === null) return null;
    const notes = window.prompt("Notes", String(initial.notes || ""));
    if (notes === null) return null;

    return normalizeEquipmentItem(
      {
        id: initial.id || generateEquipmentId(),
        group,
        category,
        article,
        quantity,
        condition,
        location,
        checkedAt,
        notes
      },
      0
    );
  }

  function handleEquipmentSheetTabClick(event) {
    const equipmentSection = document.getElementById("equipment");
    if (!equipmentSection || !equipmentSection.contains(event.target)) return;

    const sheetButton = event.target.closest("[data-equipment-sheet]");
    if (sheetButton && equipmentSection.contains(sheetButton)) {
      const sheetKey = String(sheetButton.dataset.equipmentSheet || "").trim();
      if (!sheetKey) return;
      equipmentInlineEditId = "";
      saveEquipmentSheetKey(sheetKey);
      mount();
      switchView("equipment");
      return;
    }

    const filterButton = event.target.closest("[data-equipment-kind-filter]");
    if (filterButton && equipmentSection.contains(filterButton)) {
      const kindFilter = String(filterButton.dataset.equipmentKindFilter || "").trim();
      equipmentInlineEditId = "";
      saveEquipmentKindFilter(kindFilter);
      mount();
      switchView("equipment");
    }
  }

  function bindEquipmentActions() {
    // Use event delegation for equipment sheet tabs to avoid losing handlers on re-render
    const equipmentSection = document.getElementById("equipment");
    if (equipmentSection) {
      equipmentSection.removeEventListener("click", handleEquipmentSheetTabClick);
      equipmentSection.addEventListener("click", handleEquipmentSheetTabClick);
    }

    const addButton = document.getElementById("equipment-add-item");
    if (addButton) {
      addButton.onclick = function () {
        if (currentAccessRole !== "admin") return;
        equipmentInlineEditId = "";
        equipmentCreateDraft = createEquipmentDraft({}, equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
        mount();
        switchView("equipment");
      };
    }

    const addSheetButton = document.getElementById("equipment-add-sheet");
    if (addSheetButton) {
      addSheetButton.onclick = function () {
        if (currentAccessRole !== "admin") return;
        const suggested = equipmentSheetPromptDefaultGroup("all");
        const raw = window.prompt("New sheet name", suggested);
        if (raw === null) return;
        try {
          const newKey = addEquipmentSheet(raw);
          equipmentInlineEditId = "";
          equipmentCreateDraft = null;
          showToast("Sheet added.", "success");
          saveEquipmentSheetKey(newKey);
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not add sheet.", "error");
        }
      };
    }

    const removeSheetButton = document.getElementById("equipment-remove-sheet");
    if (removeSheetButton) {
      removeSheetButton.onclick = function () {
        if (currentAccessRole !== "admin") return;
        const sheetKey = String(removeSheetButton.dataset.sheetKey || "").trim();
        if (!sheetKey) return;
        const label = equipmentSheetLabel(sheetKey);
        const confirmed = window.confirm(`Remove sheet \"${label}\"? This only removes the tab, not equipment rows.`);
        if (!confirmed) return;
        try {
          removeEquipmentSheet(sheetKey);
          equipmentInlineEditId = "";
          equipmentCreateDraft = null;
          showToast("Sheet removed.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not remove sheet.", "error");
        }
      };
    }

    const saveCreateButton = document.getElementById("equipment-save-create");
    if (saveCreateButton) {
      saveCreateButton.onclick = async function () {
        if (currentAccessRole !== "admin" || !equipmentCreateDraft) return;
        if (!String(equipmentCreateDraft.article || "").trim()) {
          showToast("Article is required.", "error");
          return;
        }
        try {
          await upsertEquipmentRow(equipmentCreateDraft);
          equipmentCreateDraft = null;
          showToast("Equipment item added.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not add equipment item.", "error");
        }
      };
    }

    const cancelCreateButton = document.getElementById("equipment-cancel-create");
    if (cancelCreateButton) {
      cancelCreateButton.onclick = function () {
        equipmentCreateDraft = null;
        mount();
        switchView("equipment");
      };
    }

    document.querySelectorAll(".equipment-inline-input").forEach((input) => {
      input.oninput = function () {
        const mode = String(input.dataset.mode || "").trim();
        const field = String(input.dataset.field || "").trim();
        const value = String(input.value || "");
        if (!field) return;

        if (mode === "create") {
          equipmentCreateDraft = createEquipmentDraft({ ...(equipmentCreateDraft || {}), [field]: value }, equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
          return;
        }

        if (mode === "edit") {
          const rowId = String(input.dataset.equipmentId || "").trim();
          if (!rowId) return;
          const currentRow = (state.equipment || []).find((item) => String(item.id) === rowId);
          if (!currentRow) return;
          const currentDraft = equipmentInlineDraftById[rowId] || createEquipmentDraft(currentRow, currentRow.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
          equipmentInlineDraftById = {
            ...equipmentInlineDraftById,
            [rowId]: createEquipmentDraft({ ...currentDraft, [field]: value }, currentDraft.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet))
          };
        }
      };
    });

    document.querySelectorAll(".equipment-edit-button").forEach((button) => {
      button.onclick = function () {
        if (currentAccessRole !== "admin") return;
        const rowId = String(button.dataset.equipmentId || "").trim();
        const currentRow = (state.equipment || []).find((item) => String(item.id) === rowId);
        if (!currentRow) return;
        equipmentCreateDraft = null;
        equipmentInlineEditId = rowId;
        equipmentInlineDraftById = {
          ...equipmentInlineDraftById,
          [rowId]: createEquipmentDraft(currentRow, currentRow.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet))
        };
        mount();
        switchView("equipment");
      };
    });

    document.querySelectorAll(".equipment-add-child-button").forEach((button) => {
      button.onclick = function () {
        if (currentAccessRole !== "admin") return;
        const parentId = String(button.dataset.parentId || "").trim();
        const parentRow = (state.equipment || []).find((item) => String(item.id) === parentId);
        if (!parentRow) return;
        equipmentInlineEditId = "";
        equipmentCreateDraft = createEquipmentDraft({
          group: parentRow.group,
          parentItemId: parentId,
          itemKind: "item",
          location: parentRow.location || ""
        }, parentRow.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
        mount();
        switchView("equipment");
      };
    });

    document.querySelectorAll(".equipment-toggle-contents-button").forEach((button) => {
      button.onclick = function () {
        const containerId = String(button.dataset.containerId || "").trim();
        if (!containerId) return;
        setEquipmentContainerExpanded(containerId, !isEquipmentContainerExpanded(containerId));
        mount();
        switchView("equipment");
      };
    });

    document.querySelectorAll(".equipment-save-inline-button").forEach((button) => {
      button.onclick = async function () {
        if (currentAccessRole !== "admin") return;
        const rowId = String(button.dataset.equipmentId || "").trim();
        if (!rowId) return;
        const draft = equipmentInlineDraftById[rowId];
        if (!draft) return;
        if (!String(draft.article || "").trim()) {
          showToast("Article is required.", "error");
          return;
        }
        try {
          await upsertEquipmentRow(draft);
          equipmentInlineEditId = "";
          const { [rowId]: _removed, ...restDrafts } = equipmentInlineDraftById;
          equipmentInlineDraftById = restDrafts;
          showToast("Equipment item updated.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not update equipment item.", "error");
        }
      };
    });

    document.querySelectorAll(".equipment-cancel-inline-button").forEach((button) => {
      button.onclick = function () {
        const rowId = String(button.dataset.equipmentId || "").trim();
        equipmentInlineEditId = "";
        if (rowId) {
          const { [rowId]: _removed, ...restDrafts } = equipmentInlineDraftById;
          equipmentInlineDraftById = restDrafts;
        }
        mount();
        switchView("equipment");
      };
    });

    document.querySelectorAll(".equipment-delete-button").forEach((button) => {
      button.onclick = async function () {
        if (currentAccessRole !== "admin") return;
        const rowId = String(button.dataset.equipmentId || "").trim();
        const currentRow = (state.equipment || []).find((item) => String(item.id) === rowId);
        if (!currentRow) return;
        if (!window.confirm(`Delete equipment item '${currentRow.article || currentRow.id}'?`)) return;
        try {
          await deleteEquipmentRow(rowId);
          if (equipmentInlineEditId === rowId) {
            equipmentInlineEditId = "";
          }
          const { [rowId]: _removed, ...restDrafts } = equipmentInlineDraftById;
          equipmentInlineDraftById = restDrafts;
          showToast("Equipment item deleted.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not delete equipment item.", "error");
        }
      };
    });

    document.querySelectorAll(".equipment-photo-trigger").forEach((button) => {
      button.onclick = function () {
        const inputId = String(button.dataset.inputId || "").trim();
        if (!inputId) return;
        const input = document.getElementById(inputId);
        if (input) input.click();
      };
    });

    document.querySelectorAll(".equipment-photo-input").forEach((input) => {
      input.onchange = async function () {
        if (currentAccessRole !== "admin") return;
        const originalFile = input.files && input.files[0];
        if (!originalFile) return;
        const mode = String(input.dataset.mode || "").trim();
        const rowId = String(input.dataset.equipmentId || "").trim();
        const baseDraft = mode === "edit"
          ? (equipmentInlineDraftById[rowId] || (state.equipment || []).find((item) => String(item.id || "") === rowId))
          : equipmentCreateDraft;
        if (!baseDraft) return;

        try {
          let uploadFile = originalFile;
          if (Number(uploadFile.size || 0) > MAX_EQUIPMENT_PHOTO_UPLOAD_BYTES) {
            uploadFile = await compressImageForAvatar(uploadFile, {
              maxBytes: MAX_EQUIPMENT_PHOTO_UPLOAD_BYTES,
              maxDimension: MAX_EQUIPMENT_PHOTO_DIMENSION
            });
          }
          if (Number(uploadFile.size || 0) > MAX_EQUIPMENT_PHOTO_UPLOAD_BYTES) {
            throw new Error("Photo is still too large after compression. Please choose a smaller image.");
          }

          const uploaded = await uploadEquipmentPhotoToStorage(uploadFile, baseDraft.id);
          equipmentPhotoDraftsById[baseDraft.id] = {
            photoFileId: uploaded.photoFileId || equipmentPhotoFileId(baseDraft.id),
            photoUrl: uploaded.photoUrl || storageEquipmentPhotoUrl(uploaded.photoFileId || equipmentPhotoFileId(baseDraft.id), baseDraft.id)
          };
          const nextDraft = createEquipmentDraft({ ...baseDraft, ...uploaded }, baseDraft.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
          if (mode === "edit" && rowId) {
            equipmentInlineDraftById = {
              ...equipmentInlineDraftById,
              [rowId]: nextDraft
            };
          } else {
            equipmentCreateDraft = nextDraft;
          }
          showToast("Equipment photo uploaded.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not upload equipment photo.", "error");
        } finally {
          input.value = "";
        }
      };
    });

    document.querySelectorAll(".equipment-photo-remove").forEach((button) => {
      button.onclick = async function () {
        if (currentAccessRole !== "admin") return;
        const mode = String(button.dataset.mode || "").trim();
        const rowId = String(button.dataset.equipmentId || "").trim();
        const baseDraft = mode === "edit"
          ? (equipmentInlineDraftById[rowId] || (state.equipment || []).find((item) => String(item.id || "") === rowId))
          : equipmentCreateDraft;
        if (!baseDraft) return;

        try {
          await deleteEquipmentPhotoFromStorage(baseDraft.id, baseDraft.photoFileId);
          delete equipmentPhotoDraftsById[baseDraft.id];
          const nextDraft = createEquipmentDraft({ ...baseDraft, photoFileId: "", photoUrl: "" }, baseDraft.group || equipmentSheetPromptDefaultGroup(selectedEquipmentSheet));
          if (mode === "edit" && rowId) {
            equipmentInlineDraftById = {
              ...equipmentInlineDraftById,
              [rowId]: nextDraft
            };
          } else {
            equipmentCreateDraft = nextDraft;
          }
          showToast("Equipment photo removed.", "success");
          mount();
          switchView("equipment");
        } catch (error) {
          showToast(error?.message || "Could not remove equipment photo.", "error");
        }
      };
    });
  }

  function bindFeeFilters() {
    const filtersDropdown = document.querySelector(".fee-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        feeFiltersExpanded = filtersDropdown.open;
      };
    }
    const select = document.getElementById("fee-period-select");
    if (select) {
      select.onchange = function (event) {
        selectedFeePeriod = event.target.value;
        selectedFeeStatuses = defaultFeeStatuses();
        feeInlineEditId = null;
        saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    }
    document.querySelectorAll(".fee-status-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        selectedFeeStatuses = Array.from(document.querySelectorAll(".fee-status-checkbox:checked")).map((input) => input.value);
        feeInlineEditId = null;
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    });
  }

  function bindTableExports() {
    const exportMembersCsvButton = document.getElementById("export-members-csv-option");
    if (exportMembersCsvButton) {
      exportMembersCsvButton.onclick = function () {
        const columns = [
          { key: "id", label: "ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "email", label: "Email" },
          { key: "positions", label: "Positions" },
          { key: "roles", label: "Roles" },
          { key: "jerseyNumber", label: "Jersey" },
          { key: "membershipStatus", label: "Membership" },
          { key: "passStatus", label: "Pass status" },
          { key: "passExpiry", label: "Pass expiry" },
          { key: "deletedAt", label: "Deleted at" }
        ];
        downloadCsv(columns, memberExportRows(), "members.csv");
      };
    }

    const exportMembersExcelButton = document.getElementById("export-members-excel-option");
    if (exportMembersExcelButton) {
      exportMembersExcelButton.onclick = function () {
        const columns = [
          { key: "id", label: "ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "email", label: "Email" },
          { key: "positions", label: "Positions" },
          { key: "roles", label: "Roles" },
          { key: "jerseyNumber", label: "Jersey" },
          { key: "membershipStatus", label: "Membership" },
          { key: "passStatus", label: "Pass status" },
          { key: "passExpiry", label: "Pass expiry" },
          { key: "deletedAt", label: "Deleted at" }
        ];
        downloadExcel(columns, memberExportRows(), "members.xls");
      };
    }

    const exportFeesCsvButton = document.getElementById("export-fees-csv-option");
    if (exportFeesCsvButton) {
      exportFeesCsvButton.onclick = function () {
        const columns = [
          { key: "memberId", label: "Member ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "feePeriod", label: "Quarter" },
          { key: "amount", label: "Amount" },
          { key: "paidAmount", label: "Paid" },
          { key: "status", label: "Status" },
          { key: "iban", label: "IBAN" }
        ];
        downloadCsv(columns, feeExportRows(), "membership-finance.csv");
      };
    }

    const exportFeesExcelButton = document.getElementById("export-fees-excel-option");
    if (exportFeesExcelButton) {
      exportFeesExcelButton.onclick = function () {
        const columns = [
          { key: "memberId", label: "Member ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "feePeriod", label: "Quarter" },
          { key: "amount", label: "Amount" },
          { key: "paidAmount", label: "Paid" },
          { key: "status", label: "Status" },
          { key: "iban", label: "IBAN" }
        ];
        downloadExcel(columns, feeExportRows(), "membership-finance.xls");
      };
    }

    const exportFeesSepaXmlButton = document.getElementById("export-fees-sepa-xml-option");
    if (exportFeesSepaXmlButton) {
      exportFeesSepaXmlButton.onclick = async function () {
        try {
          const period = currentFeePeriod();
          if (!period) {
            throw new Error("Please select a quarter first.");
          }
          if (String(APPWRITE_CONFIG?.sepaExportFunctionId || "").trim()) {
            await exportSepaXmlViaFunction(period);
          } else {
            await downloadFromApi(apiUrl(`/api/fees/export-sepa-xml?period=${encodeURIComponent(period)}`), `SEPA_Lastschrift_${period}.xml`);
          }
          authState.status = "SEPA XML exported.";
          mount();
          switchView("fees");
        } catch (error) {
          const baseMessage = String(error?.message || "SEPA export failed.");
          const noFunctionConfigured = !String(APPWRITE_CONFIG?.sepaExportFunctionId || "").trim();
          const isGithubPages = /\.github\.io$/i.test(window.location.hostname || "");
          authState.status = noFunctionConfigured && isGithubPages
            ? `${baseMessage} Configure ClubHubAppwriteConfig.sepaExportFunctionId to run SEPA export through Appwrite on GitHub Pages.`
            : baseMessage;
          mount();
          switchView("fees");
        }
      };
    }
  }

  function bindAuthActions() {
    const signInButton = document.getElementById("auth-sign-in");
    if (signInButton) {
      signInButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("auth-email");
        const passwordInput = document.getElementById("auth-password");
        const email = String(emailInput?.value || "").trim();
        const password = String(passwordInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter your email address first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        if (!password) {
          authState.status = "Enter your password first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        try {
          authState.pendingAction = "sign-in";
          authState.status = "Signing you in...";
          mount();
          await signInWithEmailPassword(email, password);
          try {
            await promoteInvitedMemberOnFirstSignIn();
          } catch {
            // Non-blocking: login should still complete even if invite flag cleanup fails.
          }
          await loadBootstrapData();
          authState.status = `Signed in as ${authDisplayName() || authState.user?.email || "user"}.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Sign in failed.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const resetPasswordButton = document.getElementById("auth-reset-password");
    if (resetPasswordButton) {
      resetPasswordButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("auth-email");
        const email = String(emailInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter your email address first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        try {
          authState.pendingAction = "reset-password";
          authState.status = "Sending password reset email...";
          mount();
          await sendResetPasswordEmail(email);
          authState.status = `Password reset email sent to ${email}.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Could not send password reset email.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const signOutButton = document.getElementById("auth-sign-out");
    if (signOutButton) {
      signOutButton.onclick = async function () {
        if (authState.pendingAction) return;
        try {
          authState.pendingAction = "sign-out";
          authState.status = "Signing out...";
          mount();
          await signOut();
          authState.status = "Signed out.";
          showToast(authState.status, "info");
        } catch (error) {
          authState.status = error.message || "Sign out failed.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const adminInviteRoleSelect = document.getElementById("admin-invite-role");
    if (adminInviteRoleSelect) {
      adminInviteRoleSelect.onchange = function (event) {
        authInviteRole = String(event.target.value || "admin");
      };
    }

    const adminInviteButton = document.getElementById("send-admin-invite");
    if (adminInviteButton) {
      adminInviteButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("admin-invite-email");
        const email = String(emailInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter an email address first.";
          mount();
          return;
        }
        try {
          authState.pendingAction = "invite-admin";
          authState.status = `Sending invite to ${email}...`;
          mount();
          await inviteAdmin(email, email.split("@")[0] || email, [authInviteRole]);
          authState.status = `Invite sent to ${email}. They must set their password before signing in.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Could not send invite.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }
  }

  function bindRecoveryActions() {
    const submitButton = document.getElementById("recovery-submit");
    if (submitButton) {
      submitButton.onclick = async function () {
        if (recoveryState.loading) return;
        const passwordInput = document.getElementById("recovery-password");
        const confirmInput = document.getElementById("recovery-password-confirm");
        const password = String(passwordInput?.value || "").trim();
        const confirm = String(confirmInput?.value || "").trim();
        
        if (!password) {
          recoveryState.status = "Password is required.";
          mount();
          return;
        }
        if (password.length < 8) {
          recoveryState.status = "Password must be at least 8 characters.";
          mount();
          return;
        }
        if (password !== confirm) {
          recoveryState.status = "Passwords do not match.";
          mount();
          return;
        }
        
        try {
          await setRecoveryPassword(password);
          mount();
        } catch (error) {
          recoveryState.status = error.message;
          mount();
        }
      };
    }
    
    const cancelButton = document.getElementById("recovery-cancel");
    if (cancelButton) {
      cancelButton.onclick = function () {
        window.location.hash = "#dashboard";
      };
    }

    const backToSignInButton = document.getElementById("recovery-back-to-sign-in");
    if (backToSignInButton) {
      backToSignInButton.onclick = function () {
        window.location.hash = "#dashboard";
      };
    }
  }

  function bindFeeEditModeActions() {
    const toggleButton = document.getElementById("toggle-fee-edit-mode");
    if (toggleButton) {
      toggleButton.onclick = function () {
        feeEditMode = !feeEditMode;
        if (!feeEditMode) {
          selectedFeeMemberIds = [];
        }
        mount();
        switchView("fees");
      };
    }
    const clearButton = document.getElementById("clear-fee-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        selectedFeeStatuses = defaultFeeStatuses();
        feeInlineEditId = null;
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    }

    const bulkStatusSelect = document.getElementById("fee-bulk-status-select");
    if (bulkStatusSelect) {
      bulkStatusSelect.onchange = function (event) {
        feeBulkStatus = event.target.value;
      };
    }

    const visibleRows = sortedVisibleFees();
    const visibleMemberIds = Array.from(new Set(visibleRows.map((fee) => String(fee.memberId))));

    const selectVisibleButton = document.getElementById("fee-select-visible");
    if (selectVisibleButton) {
      selectVisibleButton.onclick = function () {
        selectedFeeMemberIds = visibleMemberIds;
        mount();
        switchView("fees");
      };
    }

    const clearSelectionButton = document.getElementById("fee-clear-selection");
    if (clearSelectionButton) {
      clearSelectionButton.onclick = function () {
        selectedFeeMemberIds = [];
        mount();
        switchView("fees");
      };
    }

    document.querySelectorAll(".fee-member-select").forEach((checkbox) => {
      checkbox.onchange = function () {
        const memberId = String(checkbox.dataset.memberId || "");
        const selectedSet = new Set(selectedFeeMemberIds.map(String));
        if (checkbox.checked) selectedSet.add(memberId);
        else selectedSet.delete(memberId);
        selectedFeeMemberIds = Array.from(selectedSet);
        mount();
        switchView("fees");
      };
    });

    const applyButton = document.getElementById("apply-fee-bulk-status");
    if (applyButton) {
      applyButton.onclick = async function () {
        const memberIds = selectedFeeMemberIds.map((value) => String(value || "").trim()).filter(Boolean);
        if (!memberIds.length) {
          return;
        }
        try {
          await updateFeeStatusesBulk({
            feePeriod: currentFeePeriod(),
            status: feeBulkStatus,
            memberIds
          });
          authState.status = `Updated ${memberIds.length} fee records to ${statusLabel(feeBulkStatus)}.`;
          selectedFeeMemberIds = [];
          mount();
          switchView("fees");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("fees");
        }
      };
    }

    document.querySelectorAll(".fee-row-edit-trigger").forEach((button) => {
      button.onclick = function () {
        feeInlineEditId = String(button.dataset.feeId || "");
        mount();
        switchView("fees");
      };
    });

    document.querySelectorAll(".fee-row-cancel").forEach((button) => {
      button.onclick = function () {
        feeInlineEditId = null;
        mount();
        switchView("fees");
      };
    });

    document.querySelectorAll(".fee-row-status-select").forEach((select) => {
      select.onchange = function () {
        const feeId = String(select.dataset.feeId || "");
        const amountInput = document.querySelector(`.fee-row-amount[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!amountInput || !paidInput) return;
        if (["paid", "paid_rookie_fee"].includes(select.value)) {
          paidInput.value = amountInput.value;
          paidInput.readOnly = true;
        } else {
          paidInput.readOnly = false;
        }
      };
    });

    document.querySelectorAll(".fee-row-amount").forEach((amountInput) => {
      amountInput.onchange = function () {
        const feeId = String(amountInput.dataset.feeId || "");
        const statusSelect = document.querySelector(`.fee-row-status-select[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!statusSelect || !paidInput) return;
        if (statusSelect.value === "paid") {
          paidInput.value = amountInput.value;
        }
      };
    });

    document.querySelectorAll(".fee-row-save").forEach((button) => {
      button.onclick = async function () {
        const feeId = String(button.dataset.feeId || "").trim();
        const statusSelect = document.querySelector(`.fee-row-status-select[data-fee-id="${feeId}"]`);
        const amountInput = document.querySelector(`.fee-row-amount[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!feeId || !statusSelect || !amountInput || !paidInput) return;
        try {
          await updateFeeRow({
            feeId,
            status: statusSelect.value,
            amount: Number(amountInput.value || 0),
            paidAmount: Number(paidInput.value || 0),
            note: ""
          });
          authState.status = `${memberName(sortedVisibleFees().find((fee) => String(fee.id) === feeId)?.memberId)} fee updated.`;
          feeInlineEditId = null;
          mount();
          switchView("fees");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("fees");
        }
      };
    });
  }

  function bindMemberFilters() {
    const filtersDropdown = document.querySelector(".member-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        memberFiltersExpanded = filtersDropdown.open;
      };
    }
    document.querySelectorAll(".member-filter-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        const next = { positions: [], roles: [], membership: [], passStatuses: [], showDeleted: memberFilters.showDeleted, search: memberFilters.search };
        document.querySelectorAll(".member-filter-checkbox:checked").forEach((input) => {
          const target = input.dataset.memberFilter;
          if (target && next[target]) {
            next[target].push(input.value);
          }
        });
        if (!next.membership.length) {
          next.membership = ["active"];
        }
        memberFilters = next;
        saveMemberFilters();
        mount();
        switchView("members");
      };
    });
    const showDeletedToggle = document.getElementById("show-deleted-members");
    if (showDeletedToggle) {
      showDeletedToggle.onchange = function () {
        memberFilters = {
          ...memberFilters,
          showDeleted: Boolean(showDeletedToggle.checked)
        };
        saveMemberFilters();
        mount();
        switchView("members");
      };
    }
    const searchInput = document.getElementById("member-search-input");
    if (searchInput) {
      searchInput.oninput = function () {
        const rawValue = String(searchInput.value || "");
        const cursorStart = Number.isFinite(searchInput.selectionStart) ? searchInput.selectionStart : rawValue.length;
        const cursorEnd = Number.isFinite(searchInput.selectionEnd) ? searchInput.selectionEnd : rawValue.length;
        memberFilters = {
          ...memberFilters,
          search: rawValue
        };
        saveMemberFilters();
        mount();
        switchView("members");
        const nextSearchInput = document.getElementById("member-search-input");
        if (nextSearchInput) {
          nextSearchInput.focus();
          const safeStart = Math.min(cursorStart, nextSearchInput.value.length);
          const safeEnd = Math.min(cursorEnd, nextSearchInput.value.length);
          nextSearchInput.setSelectionRange(safeStart, safeEnd);
        }
      };
    }
    const clearButton = document.getElementById("clear-member-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        memberFilters = { positions: [], roles: [], membership: ["active"], passStatuses: [], showDeleted: false, search: "" };
        saveMemberFilters();
        mount();
        switchView("members");
      };
    }
  }

  function bindPassFilters() {
    const filtersDropdown = document.querySelector(".pass-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        passFiltersExpanded = filtersDropdown.open;
      };
    }

    document.querySelectorAll(".pass-filter-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        const next = { statuses: [], positions: [], membership: [] };
        document.querySelectorAll(".pass-filter-checkbox:checked").forEach((input) => {
          const target = input.dataset.passFilter;
          if (target && next[target]) {
            next[target].push(input.value);
          }
        });
        passFilters = {
          ...passFilters,
          statuses: next.statuses,
          positions: next.positions,
          membership: next.membership
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    });

    const searchInput = document.getElementById("pass-search-input");
    if (searchInput) {
      searchInput.oninput = function () {
        const rawValue = String(searchInput.value || "");
        const cursorStart = Number.isFinite(searchInput.selectionStart) ? searchInput.selectionStart : rawValue.length;
        const cursorEnd = Number.isFinite(searchInput.selectionEnd) ? searchInput.selectionEnd : rawValue.length;
        passFilters = {
          ...passFilters,
          search: rawValue
        };
        savePassFilters();
        mount();
        switchView("passes");
        const nextSearchInput = document.getElementById("pass-search-input");
        if (nextSearchInput) {
          nextSearchInput.focus();
          const safeStart = Math.min(cursorStart, nextSearchInput.value.length);
          const safeEnd = Math.min(cursorEnd, nextSearchInput.value.length);
          nextSearchInput.setSelectionRange(safeStart, safeEnd);
        }
      };
    }

    const fromInput = document.getElementById("pass-expiry-from");
    if (fromInput) {
      fromInput.onchange = function () {
        const rawValue = String(fromInput.value || "").trim();
        const normalizedDate = normalizePassFilterDate(rawValue);
        const isCleared = rawValue === "";
        if (!normalizedDate && !isCleared) {
          return;
        }
        passFilters = {
          ...passFilters,
          from: isCleared ? "" : normalizedDate
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const toInput = document.getElementById("pass-expiry-to");
    if (toInput) {
      toInput.onchange = function () {
        const rawValue = String(toInput.value || "").trim();
        const normalizedDate = normalizePassFilterDate(rawValue);
        const isCleared = rawValue === "";
        if (!normalizedDate && !isCleared) {
          return;
        }
        passFilters = {
          ...passFilters,
          to: isCleared ? "" : normalizedDate
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const showDeletedToggle = document.getElementById("show-deleted-pass-members");
    if (showDeletedToggle) {
      showDeletedToggle.onchange = function () {
        passFilters = {
          ...passFilters,
          showDeleted: Boolean(showDeletedToggle.checked)
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const clearButton = document.getElementById("clear-pass-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        passFilters = {
          search: "",
          from: "",
          to: "",
          statuses: [],
          positions: [],
          membership: ["active"],
          showDeleted: false
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const openSyncReviewButton = document.getElementById("open-pass-sync-review");
    if (openSyncReviewButton) {
      openSyncReviewButton.onclick = function () {
        window.location.hash = "pass-sync";
        switchView("pass-sync");
      };
    }
  }

  function bindPassSyncActions() {
    const fileInput = document.getElementById("pass-sync-file-input");
    if (fileInput) {
      fileInput.onchange = async function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          passSyncUpload = null;
          return;
        }
        try {
          const fileBase64 = await fileToBase64(file);
          passSyncUpload = {
            fileName: String(file.name || "clubee.xlsx"),
            fileBase64
          };
          passSyncPreview = null;
          selectedPassSyncMemberIds = [];
          authState.status = `Loaded sync source file: ${passSyncUpload.fileName}`;
          mount();
          switchView("pass-sync");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("pass-sync");
        }
      };
    }

    const previewButton = document.getElementById("preview-pass-sync-button");
    if (previewButton) {
      previewButton.onclick = async function () {
        if (authState.pendingAction) return;
        try {
          authState.pendingAction = "preview-pass-sync";
          authState.status = "Loading Clubee pass changes...";
          mount();
          passSyncPreview = await previewClubeePassSync();
          selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
            .map((change) => String(change.memberId || "").trim())
            .filter(Boolean);
          authState.status = `Preview ready: ${(passSyncPreview?.changes || []).length} change(s).`;
        } catch (error) {
          authState.status = error.message;
        } finally {
          authState.pendingAction = "";
          mount();
          switchView("pass-sync");
        }
      };
    }

    const applyButton = document.getElementById("apply-pass-sync-button");
    if (applyButton) {
      applyButton.onclick = async function () {
        if (authState.pendingAction) return;
        const memberIds = Array.from(new Set(selectedPassSyncMemberIds.map((id) => String(id || "").trim()).filter(Boolean)));
        if (!memberIds.length) {
          authState.status = "Select at least one change to apply.";
          mount();
          switchView("pass-sync");
          return;
        }
        const confirmed = window.confirm(`Apply ${memberIds.length} selected Clubee pass update(s)?`);
        if (!confirmed) return;
        try {
          authState.pendingAction = "apply-pass-sync";
          authState.status = "Applying selected Clubee pass updates...";
          mount();
          const summary = await applyClubeePassSync(memberIds);
          passSyncPreview = await previewClubeePassSync();
          selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
            .map((change) => String(change.memberId || "").trim())
            .filter(Boolean);
          authState.status = `Applied ${Number(summary?.appliedCount || 0)} update(s).`;
        } catch (error) {
          authState.status = error.message;
        } finally {
          authState.pendingAction = "";
          mount();
          switchView("pass-sync");
        }
      };
    }

    document.querySelectorAll(".pass-sync-select").forEach((checkbox) => {
      checkbox.onchange = function () {
        const memberId = String(checkbox.dataset.memberId || "").trim();
        if (!memberId) return;
        const selected = new Set(selectedPassSyncMemberIds.map((id) => String(id || "").trim()).filter(Boolean));
        if (checkbox.checked) selected.add(memberId);
        else selected.delete(memberId);
        selectedPassSyncMemberIds = Array.from(selected);
      };
    });

    const selectAllButton = document.getElementById("select-all-pass-sync");
    if (selectAllButton) {
      selectAllButton.onclick = function () {
        selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
          .map((change) => String(change.memberId || "").trim())
          .filter(Boolean);
        mount();
        switchView("pass-sync");
      };
    }

    const clearSelectionButton = document.getElementById("clear-pass-sync-selection");
    if (clearSelectionButton) {
      clearSelectionButton.onclick = function () {
        selectedPassSyncMemberIds = [];
        mount();
        switchView("pass-sync");
      };
    }
  }

  function bindTableSorts() {
    document.querySelectorAll(".sort-button[data-sort-table][data-sort-key]").forEach((button) => {
      button.onclick = function () {
        const table = button.dataset.sortTable;
        const key = button.dataset.sortKey;
        if (!table || !key) return;
        const current = tableSort[table] || { key: "", direction: "asc" };
        const direction = current.key === key && current.direction === "asc" ? "desc" : "asc";
        tableSort = {
          ...tableSort,
          [table]: { key, direction }
        };
        saveTableSort();
        mount();
      };
    });
  }

  function setupMembersStickyHeader() {
    if (typeof teardownMembersStickyHeader === "function") {
      teardownMembersStickyHeader();
      teardownMembersStickyHeader = null;
    }

    const membersView = document.getElementById("members");
    if (!membersView || !membersView.classList.contains("active")) return;
    const tableWrap = membersView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "members-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "members-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownMembersStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function setupFeesStickyHeader() {
    if (typeof teardownFeesStickyHeader === "function") {
      teardownFeesStickyHeader();
      teardownFeesStickyHeader = null;
    }

    const feesView = document.getElementById("fees");
    if (!feesView || !feesView.classList.contains("active")) return;
    const tableWrap = feesView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "fees-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "fees-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownFeesStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function setupPassesStickyHeader() {
    if (typeof teardownPassesStickyHeader === "function") {
      teardownPassesStickyHeader();
      teardownPassesStickyHeader = null;
    }

    const passesView = document.getElementById("passes");
    if (!passesView || !passesView.classList.contains("active")) return;
    const tableWrap = passesView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "passes-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "passes-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownPassesStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function bindDashboardActions() {
    const athleteProfileBtn = document.getElementById("athlete-view-profile-btn");
    if (athleteProfileBtn) {
      athleteProfileBtn.onclick = function () {
        profileRouteMode = "own";
        window.location.hash = "user/me";
        switchView("user");
      };
    }
  }

  function openEquipmentPhotoDialog(photoSrc, title) {
    const dialog = document.getElementById("equipment-photo-dialog");
    const image = document.getElementById("equipment-photo-dialog-image");
    const heading = document.getElementById("equipment-photo-dialog-title");
    if (!dialog || !image) return;
    image.src = String(photoSrc || "").trim();
    image.alt = String(title || "Equipment preview").trim() || "Equipment preview";
    if (heading) {
      heading.textContent = String(title || "Equipment preview").trim() || "Equipment preview";
    }
    dialog.showModal();
  }

  function bindOrganizationActions() {
    const addButton = document.getElementById("organization-add-entry");
    const dialog = document.getElementById("organization-dialog");
    const form = document.getElementById("organization-form");
    const submitButton = document.getElementById("organization-submit-button");
    const closeButton = document.getElementById("organization-dialog-close");
    const cancelButton = document.getElementById("organization-dialog-cancel");
    const memberOptions = document.getElementById("organization-member-options");
    if (memberOptions) {
      memberOptions.innerHTML = state.members
        .map((member) => String(member.name || `${member.firstName || ""} ${member.lastName || ""}`).trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
        .map((name) => `<option value="${name.replaceAll('"', "&quot;")}"></option>`)
        .join("");
    }
    if (addButton) {
      addButton.onclick = function () {
        if (currentAccessRole !== "admin") return;
        openOrganizationDialog(null);
      };
    }

    if (closeButton && dialog) {
      closeButton.onclick = function () {
        dialog.close();
      };
    }

    if (cancelButton && dialog) {
      cancelButton.onclick = function () {
        dialog.close();
      };
    }

    if (submitButton && form) {
      submitButton.onclick = function () {
        form.requestSubmit();
      };
    }

    if (form) {
      form.onsubmit = async function (event) {
        event.preventDefault();
        const payload = normalizeOrganizationEntry({
          id: String(form.elements.organizationId.value || organizationDialogEditingId || generateOrganizationId()).trim(),
          headOf: String(form.elements.headOf.value || "").trim(),
          verantwortung: String(form.elements.verantwortung.value || "").trim(),
          "co-verantwortung": String(form.elements.coVerantwortung.value || "").trim(),
          aufgaben: String(form.elements.aufgaben.value || "").trim()
        }, 0);
        if (!payload.headOf) {
          showToast("Section is required.", "error");
          return;
        }
        try {
          await saveOrganizationEntry(payload);
          dialog?.close();
          organizationDialogEditingId = "";
          showToast("Organization section saved.", "success");
          mount();
          switchView("organization");
        } catch (error) {
          showToast(error?.message || "Could not save organization section.", "error");
        }
      };
    }

    document.querySelectorAll(".organization-edit-button").forEach((button) => {
      button.onclick = function () {
        if (currentAccessRole !== "admin") return;
        const organizationId = String(button.dataset.organizationId || "").trim();
        const currentRow = (state.organization || []).find((row) => String(row.id) === organizationId);
        if (!currentRow) return;
        openOrganizationDialog(currentRow);
      };
    });

    document.querySelectorAll(".organization-delete-button").forEach((button) => {
      button.onclick = async function () {
        if (currentAccessRole !== "admin") return;
        const organizationId = String(button.dataset.organizationId || "").trim();
        const currentRow = (state.organization || []).find((row) => String(row.id) === organizationId);
        if (!currentRow) return;
        if (!window.confirm(`Delete organization section '${currentRow.headOf || currentRow.id}'?`)) return;
        try {
          await deleteOrganizationEntry(organizationId);
          showToast("Organization section deleted.", "success");
          mount();
          switchView("organization");
        } catch (error) {
          showToast(error?.message || "Could not delete organization section.", "error");
        }
      };
    });
  }

  function bindEquipmentPhotoDialog() {
    const dialog = document.getElementById("equipment-photo-dialog");
    const closeButton = document.getElementById("equipment-photo-dialog-close");
    const cancelButton = document.getElementById("equipment-photo-dialog-cancel");

    document.querySelectorAll(".equipment-photo-thumb-button").forEach((button) => {
      button.onclick = function () {
        const photoSrc = String(button.dataset.equipmentPhotoSrc || "").trim();
        if (!photoSrc) return;
        const title = String(button.dataset.equipmentPhotoTitle || "Equipment photo").trim();
        openEquipmentPhotoDialog(photoSrc, title);
      };
    });

    if (closeButton && dialog) {
      closeButton.onclick = function () {
        dialog.close();
      };
    }

    if (cancelButton && dialog) {
      cancelButton.onclick = function () {
        dialog.close();
      };
    }

    if (dialog) {
      dialog.onclick = function (event) {
        if (event.target === dialog) {
          dialog.close();
        }
      };
    }
  }

  function mount() {
    try {
      ensureValidFeeFilter();
      reconcileFeeStatusFilter();
      if (feeInlineEditId) {
        const visibleFeeIds = new Set(sortedVisibleFees().map((fee) => String(fee.id)));
        if (!visibleFeeIds.has(String(feeInlineEditId))) {
          feeInlineEditId = null;
        }
      }
      const visibleIds = new Set(sortedVisibleFees().map((fee) => String(fee.memberId)));
      selectedFeeMemberIds = selectedFeeMemberIds.filter((memberId) => visibleIds.has(String(memberId)));
      renderHeroNotice();
      bindLocalPreviewActions();
      document.getElementById("dashboard").innerHTML = renderDashboard();
      bindDashboardActions();
      document.getElementById("members").innerHTML = renderMembers();
      document.getElementById("fees").innerHTML = renderFees();
      document.getElementById("user").innerHTML = renderUserPage();
      document.getElementById("passes").innerHTML = renderPasses();
      document.getElementById("organization").innerHTML = renderOrganization();
      document.getElementById("equipment").innerHTML = renderEquipment();
      document.getElementById("pass-sync").innerHTML = renderPassSyncReview();
      document.getElementById("events").innerHTML = renderGamesBoard();
      document.getElementById("invites").innerHTML = renderInvites();
      document.getElementById("settings").innerHTML = renderSettings();
      document.getElementById("recovery").innerHTML = renderRecoveryGate();
      bindMemberActions();
      bindUserPageActions();
      bindOrganizationActions();
      bindEquipmentActions();
      bindGamesActions();
      bindEquipmentPhotoDialog();
      bindMemberFilters();
      bindFeeFilters();
      bindPassFilters();
      bindPassSyncActions();
      bindFeeEditModeActions();
      bindAuthActions();
      bindRecoveryActions();
      bindChangePasswordAction();
      bindTableExports();
      bindTableSorts();
      updateNavigationVisibility();
      switchView(getRouteView());
      setupMembersStickyHeader();
      setupFeesStickyHeader();
      setupPassesStickyHeader();
    } catch (error) {
      console.error("Emperors bundle mount failed", error);
      const dashboard = document.getElementById("dashboard");
      if (dashboard) dashboard.innerHTML = `<article class="setup-card"><p class="eyebrow">Startup issue</p><h3>App bundle error</h3><p>${error.message}</p></article>`;
      switchView("dashboard");
    }
  }

  function bindChangePasswordAction() {
    const changePasswordButton = document.getElementById("change-password-button");
    if (changePasswordButton) {
      changePasswordButton.onclick = function () {
        window.location.hash = "#recovery";
        setTimeout(() => mount(), 100);
      };
    }
  }

  function unregisterServiceWorkers() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
    }
  }

  bindNavigation();
  bindButtonFeedback();
  bindMobileMenu();
  window.addEventListener("hashchange", function () {
    updateNavigationVisibility();
    switchView(getRouteView());
    setupMembersStickyHeader();
    setupFeesStickyHeader();
    setupPassesStickyHeader();
  });
  if (backendClient) {
    const { data } = await backendClient.auth.getSession();
    syncAuthSession(data?.session || null);
    backendClient.auth.onAuthStateChange(function (_event, session) {
      syncAuthSession(session || null);
      Promise.resolve()
        .then(() => promoteInvitedMemberOnFirstSignIn())
        .then(() => loadBootstrapDataWithCache())
        .then(() => loadEquipmentDataWithCache())
        .then(() => mount())
        .catch((error) => {
          authState.status = error.message;
          mount();
        });
    });
  } else {
    syncAuthSession(null);
  }
  try {
    await loadBootstrapDataWithCache();
    await loadEquipmentDataWithCache();
  } catch (error) {
    authState.status = error?.message || "Startup failed while loading remote data.";
  }
  mount();

  // Background sync for fresh data
  if (backendClient && authState.user) {
    setTimeout(() => backgroundLoadData(), 2000);
  }

  unregisterServiceWorkers();

  // Debug utilities exposed to window for troubleshooting
  window.__EMPERORS_DEBUG__ = {
    checkServerStatus: async function() {
      try {
        const url = apiUrl("/api/status");
        console.log("[DEBUG] Checking server status at:", url);
        const response = await fetch(url);
        const status = await response.json();
        console.table(status);
        return status;
      } catch (error) {
        console.error("[DEBUG] Failed to check server status:", error);
        return { error: error.message };
      }
    },
    checkBackendClient: function() {
      console.log("[DEBUG] Appwrite backend client:", backendClient);
      return backendClient ? "✓ Available" : "✗ Not available";
    },
    checkAppState: function() {
      console.log("[DEBUG] Auth State:", authState);
      console.log("[DEBUG] Bootstrap Meta:", bootstrapMeta);
      console.log("[DEBUG] Data Members:", state.members.length, "total");
      console.log("[DEBUG] Data Fees:", state.fees.length, "total");
    },
    testServerMemberCreate: async function(firstName, lastName) {
      try {
        console.log("[DEBUG] Testing member create via server...");
        const response = await fetch(apiUrl("/api/members"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName || "Debug",
            lastName: lastName || "Test",
            email: `test-${Date.now()}@example.com`,
            roles: ["player"],
            positions: [],
            membershipStatus: "active",
            passStatus: "missing"
          })
        });
        const result = await response.json();
        console.log("[DEBUG] Server response:", { status: response.status, data: result });
        return result;
      } catch (error) {
        console.error("[DEBUG] Test failed:", error);
        return { error: error.message };
      }
    },
    help: function() {
      console.log(`
        Emperors Debug Tools:
        - window.__EMPERORS_DEBUG__.checkServerStatus()     : Check if server backend is configured
        - window.__EMPERORS_DEBUG__.checkBackendClient()     : Check Appwrite client availability
        - window.__EMPERORS_DEBUG__.checkAppState()          : View current app state
        - window.__EMPERORS_DEBUG__.testServerMemberCreate() : Test member creation via server
      `);
    }
  };
  console.log("✓ Emperors debug tools ready. Type: window.__EMPERORS_DEBUG__.help();");
})();
