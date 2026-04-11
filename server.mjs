import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bulkUpdateFeeStatus,
  closeDatabase,
  createMember,
  deleteMember,
  ensureImported,
  getBootstrapData,
  initializeDatabase,
  mergeMembers,
  undeleteMember,
  updateFeeRecord,
  updateMember
} from "./src/server/db-v2.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 4173;

await initializeDatabase(path.join(__dirname, "data", "emperors.db"));
await ensureImported({
  clubeeXlsxPath: path.join(__dirname, "assets", "uni-wien-emperors_dfcbbd998dee66426d1889d1fd42cc61.xlsx"),
  feesCsvPath: path.join(__dirname, "membership-fees.csv"),
  playerCsvPath: path.join(__dirname, "player-list.csv")
});

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/bootstrap", async (_req, res) => {
  try {
    const data = await getBootstrapData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
  }
});

app.post("/api/members", async (req, res) => {
  try {
    await createMember(req.body || {});
    res.status(201).json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member create error"
    });
  }
});

app.put("/api/members/:memberId", async (req, res) => {
  try {
    await updateMember(Number(req.params.memberId), req.body || {});
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member update error"
    });
  }
});

app.delete("/api/members/:memberId", async (req, res) => {
  try {
    await deleteMember(Number(req.params.memberId));
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member delete error"
    });
  }
});

app.post("/api/members/:memberId/undelete", async (req, res) => {
  try {
    await undeleteMember(Number(req.params.memberId));
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member undelete error"
    });
  }
});

app.post("/api/members/merge", async (req, res) => {
  try {
    await mergeMembers(req.body || {});
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member merge error"
    });
  }
});

app.post("/api/fees/bulk-status", async (req, res) => {
  try {
    await bulkUpdateFeeStatus(req.body || {});
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown fee update error"
    });
  }
});

app.put("/api/fees/:feeId", async (req, res) => {
  try {
    await updateFeeRecord(Number(req.params.feeId), req.body || {});
    res.json(await getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown fee row update error"
    });
  }
});

app.listen(port, () => {
  console.log(`Emperors local server running at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});
