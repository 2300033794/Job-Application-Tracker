import cors from "cors";
import express from "express";
import { readFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

app.use(cors());
app.use(express.json());

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(
      dbPath,
      JSON.stringify({ user: null, jobs: [] }, null, 2),
      "utf8"
    );
  }
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(dbPath, "utf8");
  return JSON.parse(raw);
}

async function writeDb(data) {
  await ensureDb();
  await writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/user", async (_req, res) => {
  const db = await readDb();
  res.json(sanitizeUser(db.user));
});

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const db = await readDb();
  db.user = { name, email, password };
  await writeDb(db);

  return res.status(201).json(sanitizeUser(db.user));
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const db = await readDb();

  if (!db.user) {
    return res.status(404).json({ message: "No account found. Please sign up first." });
  }

  if (db.user.email !== email || db.user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  return res.json(sanitizeUser(db.user));
});

app.put("/api/user", async (req, res) => {
  const db = await readDb();

  if (!db.user) {
    return res.status(404).json({ message: "No user found." });
  }

  db.user = {
    ...db.user,
    ...req.body,
    password: req.body?.password ?? db.user.password,
  };

  await writeDb(db);
  return res.json(sanitizeUser(db.user));
});

app.get("/api/jobs", async (_req, res) => {
  const db = await readDb();
  res.json(db.jobs);
});

app.put("/api/jobs", async (req, res) => {
  const jobs = Array.isArray(req.body) ? req.body : [];
  const db = await readDb();
  db.jobs = jobs;
  await writeDb(db);
  res.json(db.jobs);
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});