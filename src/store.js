const STORAGE_KEY = "clubhub-demo-store-v2";
const { demoData } = window.ClubHubData;

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value : structuredClone(fallback);
}

function normalizeState(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return structuredClone(demoData);
  }

  return {
    members: normalizeArray(candidate.members, demoData.members),
    fees: normalizeArray(candidate.fees, demoData.fees),
    events: normalizeArray(candidate.events, demoData.events),
    invites: normalizeArray(candidate.invites, demoData.invites)
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(demoData);
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(demoData);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  const fresh = structuredClone(demoData);
  saveState(fresh);
  return fresh;
}

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "clubhub-demo-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

window.ClubHubStore = {
  exportState,
  loadState,
  resetState,
  saveState
};
