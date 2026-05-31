import fs from 'fs';
import crypto from 'crypto';

const items = JSON.parse(fs.readFileSync('assets/items.json', 'utf-8'));
const posts = JSON.parse(fs.readFileSync('assets/posts.json', 'utf-8'));

const byId = {};
for (const arr of Object.values(items.categories)) arr.forEach(i => { byId[i.id] = i; });

function it(id, count) {
  const i = byId[id];
  if (!i) throw new Error(`아이템 없음: ${id}`);
  return { img: i.img, name: i.description, count };
}
const clover  = n  => it('reward_clover04', n);
const redBox  = () => it('reward_box_red', 1);
const blueBox = () => it('reward_box_blue', 1);

// ── 5층 외전 ──────────────────────────────────────────────
const q5 = [
  { slots:[it('cleaning06',1)],                                 rewards:[clover(30)] },
  { slots:[it('cleaning_detergent05',1)],                       rewards:[clover(30)] },
  { slots:[it('water_06',2)],                                   rewards:[clover(50), it('energy05',1)] },
  { slots:[it('tool07',1)],                                     rewards:[clover(30)] },
  { slots:[it('seed_bag_03',3), it('cleaning05',1)],            rewards:[clover(30)] },
  { slots:[it('tool_paint05',2)],                               rewards:[clover(50)] },
  { slots:[it('stationery_06',2)],                              rewards:[clover(30)] },
  { slots:[it('cleaning06',1)],                                 rewards:[clover(30)] },
  { slots:[it('cleaning_detergent06',1), it('water_05',1)],     rewards:[clover(50)] },
  { slots:[it('stationery_toy_05',1)],                          rewards:[clover(30)] },
  { slots:[it('Household_02',3)],                               rewards:[clover(30)] },
  { slots:[it('vaccine_06',2)],                                 rewards:[clover(30)] },
  { slots:[it('tool12',1)],                                     rewards:[clover(50), redBox()] },
  { slots:[it('wood09',1)],                                     rewards:[clover(30)] },
  { slots:[it('water_06',1)],                                   rewards:[clover(30)] },
  { slots:[it('bread_08',2), it('coffee_05',2)],                rewards:[clover(30)] },
  { slots:[it('plant_08',1)],                                   rewards:[clover(30)] },
  { slots:[it('tool04',3), it('tool_screw05',2)],               rewards:[clover(30)] },
  { slots:[it('cleaning_detergent05',1), it('cleaning02',3)],   rewards:[clover(30)] },
  { slots:[it('Pipe_03',1), it('Pipe_02',1)],                   rewards:[clover(30)] },
  { slots:[it('tool_screw06',2)],                               rewards:[clover(30)] },
  { slots:[it('Pipe_08',1)],                                    rewards:[clover(50), blueBox()] },
  { slots:[it('cleaning_detergent08',1)],                       rewards:[clover(30)] },
  { slots:[it('cleaning11',1)],                                 rewards:[clover(30)] },
  { slots:[it('construction11',1)],                             rewards:[clover(30)] },
  { slots:[it('tool_paint05',3)],                               rewards:[clover(30)] },
  { slots:[it('plant_07',1), it('water_04',1)],                 rewards:[clover(50)] },
  { slots:[it('Household_11',1)],                               rewards:[clover(30)] },
  { slots:[it('construction_light_05',2)],                      rewards:[clover(30), it('ruby04',50)] },
];

// ── 10층 외전 ─────────────────────────────────────────────
const q10 = [
  { slots:[it('wood02',3)],                                          rewards:[clover(1)] },
  { slots:[it('vIrus_03',3), it('stationery_08',1)],                 rewards:[clover(1)] },
  { slots:[it('vaccine_07',1), it('stationery_toy_07',1)],           rewards:[clover(1)] },
  { slots:[it('cleaning_detergent08',1), it('water_05',1)],          rewards:[clover(1)] },
  { slots:[it('stationery_toy_02',2), it('cleaning07',1)],           rewards:[clover(1)] },
  { slots:[it('Household_Electronic08',1), it('coffee_07',1)],       rewards:[clover(1)] },
  { slots:[it('bread_07',2), it('Household_07',1)],                  rewards:[clover(1)] },
  { slots:[it('cleaning04',2), it('water_06',2)],                    rewards:[clover(1)] },
  { slots:[it('cleaning06',1), it('construction_light_04',1)],       rewards:[clover(1)] },
  { slots:[it('Pipe_02',2), it('tool_screw04',1)],                   rewards:[clover(1)] },
  { slots:[it('tool08',1), it('tool_paint04',1)],                    rewards:[clover(1)] },
  { slots:[it('vIrus_05',1), it('cleaning_detergent07',1)],          rewards:[clover(1)] },
  { slots:[it('tool10',1)],                                          rewards:[clover(1)] },
  { slots:[it('vaccine_06',1), it('tool_paint05',1)],                rewards:[clover(1)] },
  { slots:[it('Household_08',1)],                                    rewards:[redBox(), clover(1)] },
  { slots:[it('construction_light_04',1), it('coffee_04',1)],        rewards:[clover(1)] },
  { slots:[it('construction11',1)],                                  rewards:[clover(1)] },
  { slots:[it('stationery_06',2)],                                   rewards:[clover(1)] },
  { slots:[it('Pipe_01',1), it('cleaning10',1)],                     rewards:[clover(1)] },
  { slots:[it('construction06',3), it('cleaning07',1)],              rewards:[clover(1)] },
  { slots:[it('Pipe_08',1)],                                         rewards:[clover(1)] },
  { slots:[it('stationery_09',1), it('tool05',1)],                   rewards:[clover(1)] },
  { slots:[it('coffee_04',1)],                                       rewards:[clover(1)] },
  { slots:[it('vIrus_06',1), it('construction_light_05',1)],         rewards:[clover(1)] },
  { slots:[it('wood05',1), it('cleaning_detergent08',1)],            rewards:[clover(1)] },
  { slots:[it('cleaning12',1)],                                      rewards:[clover(1)] },
  { slots:[it('tool_paint05',2), it('tool09',1)],                    rewards:[clover(1)] },
  { slots:[it('bread_09',1)],                                        rewards:[clover(1)] },
  { slots:[it('wood10',1)],                                          rewards:[clover(1)] },
  { slots:[it('water_05',2)],                                        rewards:[clover(1)] },
];

const userId = '110068802813459827221';
const author = 'eksmdk';
const now = new Date().toISOString();

// 기존 동일 층/타입 공식 해제
posts.forEach(p => {
  if ((p.floor === '5' && p.type === '외전') || (p.floor === '10' && p.type === '외전'))
    p.isOfficial = false;
});

posts.push({ id: crypto.randomUUID(), author, authorId: userId, floor: '5',  type: '외전', quests: q5,  status: 'review', isOfficial: true, createdAt: now, updatedAt: now });
posts.push({ id: crypto.randomUUID(), author, authorId: userId, floor: '10', type: '외전', quests: q10, status: 'review', isOfficial: true, createdAt: now, updatedAt: now });

fs.writeFileSync('assets/posts.json', JSON.stringify(posts, null, 2), 'utf-8');
console.log(`5층 외전 공식 등록: ${q5.length}개 퀘스트`);
console.log(`10층 외전 공식 등록: ${q10.length}개 퀘스트`);
