import { initNav, requireAuth, getGoogleUser } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('progress.html');

const me       = getGoogleUser();
const username = me?.email || me?.name || '';
const contentEl = document.getElementById('progress-content');
const overallText = document.getElementById('overall-text');
const overallBar  = document.getElementById('overall-bar');

const REWARD_LABEL = { clover: '🍀', box: '📦', scissors: '✂️', energy: '⚡' };

let userProgress = {};

async function load() {
  const [postsRes, progressRes] = await Promise.all([
    fetch('/api/official'),
    username ? fetch(`/api/progress/${encodeURIComponent(username)}`) : Promise.resolve({ json: () => ({}) }),
  ]);
  const posts = await postsRes.json();
  userProgress = username ? (await progressRes.json()) : {};

  if (posts.length === 0) {
    contentEl.innerHTML = '<div class="empty-state">공식 퀘스트가 없습니다.</div>';
    return;
  }

  render(posts);
}

function progressKey(postId, questIdx) {
  return `${postId}:${questIdx}`;
}

function render(posts) {
  const byType = { 메인: [], 외전: [] };
  posts.forEach(p => {
    const bucket = byType[p.type] || (byType[p.type] = []);
    bucket.push(p);
  });

  let totalQuests = 0;
  const allQuestKeys = [];

  contentEl.innerHTML = '';

  for (const [typeName, typePosts] of Object.entries(byType)) {
    if (typePosts.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'progress-section';

    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'progress-section-title';
    sectionTitle.innerHTML = `<span class="tag ${typeName === '메인' ? 'tag-main' : 'tag-side'}">${typeName}</span>`;
    section.appendChild(sectionTitle);

    typePosts.forEach(post => {
      const quests = (post.quests || []).filter(q => (q.slots || []).some(Boolean));
      if (quests.length === 0) return;

      const postDone = quests.filter((_, i) => userProgress[progressKey(post.id, i)]).length;
      totalQuests += quests.length;
      quests.forEach((_, i) => allQuestKeys.push(progressKey(post.id, i)));

      const card = document.createElement('div');
      card.className = 'progress-card card';

      const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ');

      const barFill = document.createElement('div');
      barFill.className = 'progress-bar-fill';
      barFill.style.width = quests.length ? `${(postDone / quests.length) * 100}%` : '0%';
      const barWrap = document.createElement('div');
      barWrap.className = 'progress-bar-wrap';
      barWrap.style.cssText = 'flex:1;min-width:60px';
      barWrap.appendChild(barFill);

      const fractionEl = document.createElement('span');
      fractionEl.className = 'progress-fraction';
      fractionEl.textContent = `${postDone} / ${quests.length}`;

      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'toggle-icon';
      toggleIcon.textContent = '▶';

      const hdr = document.createElement('div');
      hdr.className = 'progress-card-header';
      hdr.appendChild(document.createElement('span')).className = 'progress-card-title';
      hdr.querySelector('.progress-card-title').textContent = title;
      hdr.appendChild(fractionEl);
      hdr.appendChild(barWrap);
      hdr.appendChild(toggleIcon);

      hdr.addEventListener('click', () => card.classList.toggle('open'));

      const checks = document.createElement('div');
      checks.className = 'quest-checks';

      quests.forEach((quest, i) => {
        const key  = progressKey(post.id, i);
        const done = !!userProgress[key];

        const row = document.createElement('label');
        row.className = `quest-check${done ? ' done' : ''}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = done;
        cb.addEventListener('change', async () => {
          userProgress[key] = cb.checked;
          row.classList.toggle('done', cb.checked);
          await saveProgress();
          const newDone = quests.filter((_, j) => userProgress[progressKey(post.id, j)]).length;
          fractionEl.textContent = `${newDone} / ${quests.length}`;
          barFill.style.width = quests.length ? `${(newDone / quests.length) * 100}%` : '0%';
          updateOverall();
        });

        const lbl = document.createElement('div');
        lbl.className = 'quest-check-label';

        const itemsRow = document.createElement('div');
        itemsRow.className = 'quest-check-items';
        (quest.slots || []).filter(Boolean).forEach(s => {
          const thumb = document.createElement('div');
          thumb.className = 'check-thumb';
          thumb.innerHTML = `<img src="${s.img}" alt="${s.name}" title="${s.name} ${s.count}개"><span class="badge">${s.count}</span>`;
          itemsRow.appendChild(thumb);
        });
        lbl.appendChild(itemsRow);

        const rewards = Array.isArray(quest.rewards) ? quest.rewards : [];
        if (rewards.length > 0) {
          const rewardRow = document.createElement('div');
          rewardRow.className = 'check-reward-row';
          rewards.forEach(r => {
            const thumb = document.createElement('div');
            thumb.className = 'check-thumb';
            thumb.innerHTML = `<img src="${r.img}" alt="${r.name}" title="${r.name} ${r.count}개"><span class="badge">${r.count}</span>`;
            rewardRow.appendChild(thumb);
          });
          lbl.appendChild(rewardRow);
        }

        row.appendChild(cb);
        row.appendChild(lbl);
        checks.appendChild(row);
      });

      card.appendChild(hdr);
      card.appendChild(checks);
      section.appendChild(card);
    });

    contentEl.appendChild(section);
  }

  function updateOverall() {
    const done = allQuestKeys.filter(k => userProgress[k]).length;
    const pct  = totalQuests ? Math.round((done / totalQuests) * 100) : 0;
    overallText.textContent = `${done} / ${totalQuests} 완료`;
    overallBar.style.width = pct + '%';
  }
  updateOverall();
}

async function saveProgress() {
  if (!username) return;
  await fetch(`/api/progress/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userProgress),
  });
}

load();
