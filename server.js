import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";
import { GoogleGenerativeAI } from "@google/generative-ai";

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public/pages")));
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
const USAGE_FILE    = path.join(__dirname, "assets/gemini_usage.json");

// 데이터 파일 초기화
if (!fs.existsSync(POSTS_FILE))    writeJSON(POSTS_FILE, []);
if (!fs.existsSync(PROGRESS_FILE)) writeJSON(PROGRESS_FILE, {});
if (!fs.existsSync(USERS_FILE))    writeJSON(USERS_FILE, {});

// ── Gemini 일일 사용량 추적 ───────────────────────────────
const DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT || "200", 10);

function getUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = readJSON(USAGE_FILE, { date: "", count: 0 });
  if (stored.date !== today) return { date: today, count: 0 };
  return stored;
}

function incrementUsage() {
  const usage = getUsage();
  usage.count += 1;
  writeJSON(USAGE_FILE, usage);
  return usage.count;
}

// 사용량 조회 API
app.get("/api/gemini-usage", (req, res) => {
  const usage = getUsage();
  res.json({ count: usage.count, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - usage.count) });
});

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

// ── Gemini 퀘스트 자동 추출 ───────────────────────────────
app.post("/api/extract-quests", async (req, res) => {
  if (!genAI) return res.status(503).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" });

  const usage = getUsage();
  if (usage.count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `일일 한도 초과 (${DAILY_LIMIT}회/일). 내일 다시 시도하거나 .env의 GEMINI_DAILY_LIMIT을 늘려주세요.`,
      limitExceeded: true,
    });
  }

  const { image } = req.body;
  if (!image?.data || !image?.mimeType) {
    return res.status(400).json({ error: "이미지 데이터가 필요합니다" });
  }

  const itemsData = readJSON(ITEMS_FILE, {});
  const allItems = [];
  for (const [category, items] of Object.entries(itemsData.categories || {})) {
    for (const item of items) {
      allItems.push({ id: item.id, img: item.img, description: item.description, category });
    }
  }

  const itemListStr = allItems.map(i => `"${i.id}": ${i.description}`).join("\n");

  const prompt = `이 이미지는 모바일 게임의 퀘스트 팝업 스크린샷입니다.

아래 아이템 목록을 참고하여 이미지의 '미션' 섹션과 '보상' 섹션에 있는 아이템을 추출하세요.

아이템 목록 (ID: 설명):
${itemListStr}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이, 다른 텍스트 없이):
{"mission":[{"itemId":"ID","count":숫자}],"rewards":[{"itemId":"ID","count":숫자}]}

규칙:
- 미션 섹션(아이템 요구)의 아이템과 수량을 mission 배열에 넣으세요
- 보상 섹션의 아이템과 수량을 rewards 배열에 넣으세요
- 픽셀아트 아이템을 보고 가장 유사한 아이템 ID를 목록에서 선택하세요
- 이미지에 표시된 수량(예: 1/1, x50)을 count로 사용하고, 없으면 1로 하세요
- 아이템을 식별할 수 없는 경우 itemId를 null로 하세요`;

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    });
    const result = await model.generateContent([
      { inlineData: { data: image.data, mimeType: image.mimeType } },
      prompt,
    ]);

    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("응답에서 JSON을 찾을 수 없습니다");

    const parsed = JSON.parse(jsonMatch[0]);

    const itemById = {};
    allItems.forEach(i => { itemById[i.id] = i; });

    const mapItems = (arr) => (arr || []).map(({ itemId, count }) => {
      const item = itemById[itemId] || null;
      return {
        img:     item?.img || null,
        name:    item?.description || itemId || "?",
        count:   Math.max(1, Number(count) || 1),
        itemId:  itemId || null,
        matched: !!item,
      };
    });

    const used = incrementUsage();
    res.json({
      success:   true,
      slots:     mapItems(parsed.mission),
      rewards:   mapItems(parsed.rewards),
      usageToday: used,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 시작 ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 http://localhost:${PORT}`);
});
