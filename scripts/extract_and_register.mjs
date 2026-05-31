import "dotenv/config";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite" });

const itemsData = JSON.parse(fs.readFileSync('assets/items.json', 'utf-8'));
const allItems = [];
for (const [cat, arr] of Object.entries(itemsData.categories)) {
  arr.forEach(i => allItems.push({ ...i, category: cat }));
}
const itemById = {};
allItems.forEach(i => { itemById[i.id] = i; });

const itemListStr = allItems.map(i => `"${i.id}": ${i.description}`).join('\n');

const prompt = `이 이미지는 모바일 게임의 퀘스트 팝업 스크린샷입니다.

아래 아이템 목록을 참고하여 이미지의 '미션' 섹션과 '보상' 섹션에 있는 아이템을 추출하세요.

아이템 목록 (ID: 설명):
${itemListStr}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이, 다른 텍스트 없이):
{"mission":[{"itemId":"ID","count":숫자}],"rewards":[{"itemId":"ID","count":숫자}]}

규칙:
- 미션 섹션의 아이템과 수량을 mission 배열에 넣으세요
- 보상 섹션의 아이템과 수량을 rewards 배열에 넣으세요
- 픽셀아트 아이템을 보고 가장 유사한 아이템 ID를 목록에서 선택하세요
- 이미지에 표시된 수량(예: 0/2, x50)을 count로 사용하고, 없으면 1로 하세요
- 아이템을 식별할 수 없는 경우 itemId를 null로 하세요`;

function mapItems(arr) {
  return (arr || []).map(({ itemId, count }) => {
    const item = itemById[itemId] || null;
    return {
      img:   item?.img || null,
      name:  item?.description || itemId || '?',
      count: Math.max(1, Number(count) || 1),
    };
  });
}

const imgDir = "11층 메인";
const files  = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();

console.log(`${files.length}장 처리 시작...\n`);

const quests = [];
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  console.log(`[${i+1}/${files.length}] ${file}`);

  const imgData = fs.readFileSync(path.join(imgDir, file));
  const base64  = imgData.toString('base64');
  const mimeType = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  try {
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      prompt,
    ]);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 없음');

    const parsed = JSON.parse(jsonMatch[0]);
    const slots   = mapItems(parsed.mission);
    const rewards = mapItems(parsed.rewards);

    console.log(`  미션: ${slots.map(s => `${s.name} x${s.count}`).join(', ')}`);
    console.log(`  보상: ${rewards.map(r => `${r.name} x${r.count}`).join(', ')}\n`);
    quests.push({ slots, rewards });
  } catch (err) {
    console.error(`  실패: ${err.message}\n`);
    quests.push(null);
  }

  // 요청 간격
  if (i < files.length - 1) await new Promise(r => setTimeout(r, 1500));
}

const validQuests = quests.filter(Boolean);
console.log(`\n추출 완료: ${validQuests.length}/${files.length}개 성공`);

if (validQuests.length === 0) { console.error('등록할 퀘스트 없음'); process.exit(1); }

const posts   = JSON.parse(fs.readFileSync('assets/posts.json', 'utf-8'));
const userId  = '110068802813459827221';
const author  = 'eksmdk';
const now     = new Date().toISOString();

posts.forEach(p => {
  if (p.floor === '11' && p.type === '메인') p.isOfficial = false;
});

posts.push({
  id: crypto.randomUUID(),
  author, authorId: userId,
  floor: '11', type: '메인',
  quests: validQuests,
  status: 'review',
  isOfficial: true,
  createdAt: now, updatedAt: now,
});

fs.writeFileSync('assets/posts.json', JSON.stringify(posts, null, 2), 'utf-8');
console.log(`\n✅ 11층 메인 공식 등록 완료 (${validQuests.length}개 퀘스트)`);
