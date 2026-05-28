import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ── 데이터 파일 헬퍼 ──────────────────────────────────────
function readJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return fallback; }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

const ITEMS_FILE    = path.join(__dirname, "assets/items.json");
const POSTS_FILE    = path.join(__dirname, "assets/posts.json");
const PROGRESS_FILE = path.join(__dirname, "assets/progress.json");
const USERS_FILE    = path.join(__dirname, "assets/users.json");

// 데이터 파일 초기화
if (!fs.existsSync(POSTS_FILE))    writeJSON(POSTS_FILE, []);
if (!fs.existsSync(PROGRESS_FILE)) writeJSON(PROGRESS_FILE, {});
if (!fs.existsSync(USERS_FILE))    writeJSON(USERS_FILE, {});

// ── 앱 설정 (클라이언트 ID 노출) ─────────────────────────
app.get("/api/config", (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
});

// ── Google 로그인 검증 ────────────────────────────────────
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "No credential" });
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map(e => e.trim()).filter(Boolean);
    res.json({
      id:      payload.sub,
      name:    payload.name,
      email:   payload.email,
      picture: payload.picture,
      isAdmin: adminEmails.includes(payload.email),
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ── 아이템 데이터 ─────────────────────────────────────────
app.get("/data", (req, res) => {
  res.json(readJSON(ITEMS_FILE, {}));
});

// ── 선발대 게시판 API ──────────────────────────────────────
app.get("/api/posts", (req, res) => {
  const posts = readJSON(POSTS_FILE, []);
  res.json(posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post("/api/posts", (req, res) => {
  const posts = readJSON(POSTS_FILE, []);
  const post = {
    id: crypto.randomUUID(),
    ...req.body,
    isOfficial: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  posts.push(post);
  writeJSON(POSTS_FILE, posts);
  res.status(201).json(post);
});

app.get("/api/posts/:id", (req, res) => {
  const post = readJSON(POSTS_FILE, []).find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json(post);
});

app.put("/api/posts/:id", (req, res) => {
  const posts = readJSON(POSTS_FILE, []);
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  posts[idx] = { ...posts[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(POSTS_FILE, posts);
  res.json(posts[idx]);
});

app.delete("/api/posts/:id", (req, res) => {
  let posts = readJSON(POSTS_FILE, []);
  posts = posts.filter(p => p.id !== req.params.id);
  writeJSON(POSTS_FILE, posts);
  res.json({ ok: true });
});

// 공식 퀘스트 지정
app.post("/api/posts/:id/official", (req, res) => {
  const posts = readJSON(POSTS_FILE, []);
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const target = posts[idx];
  const key = `${target.floor}-${target.type}`;
  const existing = posts.find(p => p.isOfficial && `${p.floor}-${p.type}` === key && p.id !== target.id);

  posts.forEach(p => { if (`${p.floor}-${p.type}` === key) p.isOfficial = false; });
  posts[idx].isOfficial = true;
  posts[idx].updatedAt = new Date().toISOString();
  writeJSON(POSTS_FILE, posts);
  res.json({ ok: true, replaced: !!existing });
});

// 공식 게시글 목록
app.get("/api/official", (req, res) => {
  const posts = readJSON(POSTS_FILE, []).filter(p => p.isOfficial);
  posts.sort((a, b) => {
    if (a.type !== b.type) return a.type === "메인" ? -1 : 1;
    return a.floor - b.floor;
  });
  res.json(posts);
});

// ── 유저 프로필 API ───────────────────────────────────────
app.get("/api/users/:id", (req, res) => {
  const users = readJSON(USERS_FILE, {});
  res.json(users[req.params.id] || {});
});

app.put("/api/users/:id", (req, res) => {
  const users = readJSON(USERS_FILE, {});
  users[req.params.id] = { ...(users[req.params.id] || {}), ...req.body };
  writeJSON(USERS_FILE, users);

  if (req.body.nickname) {
    const posts = readJSON(POSTS_FILE, []);
    const updated = posts.map(p =>
      p.authorId === req.params.id ? { ...p, author: req.body.nickname } : p
    );
    writeJSON(POSTS_FILE, updated);
  }

  res.json(users[req.params.id]);
});

// 기존 게시글에 authorId 소급 연결 (닉네임 변경 전 게시글 대상)
app.post("/api/users/migrate-posts", (req, res) => {
  const { authorId, oldAuthor } = req.body;
  if (!authorId || !oldAuthor) return res.status(400).json({ error: "missing params" });
  const posts = readJSON(POSTS_FILE, []);
  let count = 0;
  const updated = posts.map(p => {
    if (!p.authorId && p.author === oldAuthor) { count++; return { ...p, authorId }; }
    return p;
  });
  if (count > 0) writeJSON(POSTS_FILE, updated);
  res.json({ migrated: count });
});

// ── 진척도 API ────────────────────────────────────────────
app.get("/api/progress/:user", (req, res) => {
  const all = readJSON(PROGRESS_FILE, {});
  res.json(all[req.params.user] || {});
});

app.post("/api/progress/:user", (req, res) => {
  const all = readJSON(PROGRESS_FILE, {});
  all[req.params.user] = { ...(all[req.params.user] || {}), ...req.body };
  writeJSON(PROGRESS_FILE, all);
  res.json({ ok: true });
});

// ── 시작 ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 http://localhost:${PORT}`);
});
