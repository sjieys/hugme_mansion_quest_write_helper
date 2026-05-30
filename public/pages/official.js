import { initNav, requireAuth, getGoogleUser } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('official.html');

const me = getGoogleUser();
const username = me?.email || me?.name || '';

const listEl = document.getElementById('official-list');
let allPosts = [];
let userProgress = {};
let currentType = '';

function parseLevel(name) {
  const m = name && name.match(/(\d+)레벨/);
  return m ? parseInt(m[1], 10) : 1;
}

function questWeight(quest) {
  return (quest.slots || []).filter(Boolean).reduce((sum, s) => {
    return sum + Math.pow(2, parseLevel(s.name) - 1) * (s.count || 1);
  }, 0);
}

function progressKey(postId, idx) {
  return `${postId}:${idx}`;
}

async function load() {
  const [postsRes, progressRes] = await Promise.all([
    fetch('/api/official'),
    username
      ? fetch(`/api/progress/${encodeURIComponent(username)}`)
      : Promise.resolve({ json: () => ({}) }),
  ]);
  allPosts = await postsRes.json();
  userProgress = username ? (await progressRes.json()) : {};
  render();
}

function render() {
  const list = currentType ? allPosts.filter(p => p.type === currentType) : allPosts;

  if (list.length === 0) {
    listEl.innerHTML = '<div class="empty-state">공식 퀘스트가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = '';
  list.forEach(post => {
    const a = document.createElement('a');
    a.href = `progress.html?open=${post.id}`;
    a.className = 'official-card card';

    const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ') || '(제목 없음)';
    const quests = (post.quests || []).filter(q => (q.slots || []).some(Boolean));

    // 가중치 기반 진척도
    let totalWeight = 0;
    let doneWeight  = 0;
    let nextQuest   = null;

    quests.forEach((quest, i) => {
      const w = questWeight(quest);
      totalWeight += w;
      if (userProgress[progressKey(post.id, i)]) {
        doneWeight += w;
      } else if (!nextQuest) {
        nextQuest = quest;
      }
    });

    const pct = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0;

    // ── 카드 조립 ──
    const mainEl = document.createElement('div');
    mainEl.className = 'official-main';

    const titleEl = document.createElement('span');
    titleEl.className = 'official-title';
    titleEl.textContent = title;
    mainEl.appendChild(titleEl);

    // 진척도 바
    const barWrap = document.createElement('div');
    barWrap.className = 'official-progress-wrap';
    const fill = document.createElement('div');
    fill.className = 'official-progress-fill';
    fill.style.width = pct + '%';
    const bar = document.createElement('div');
    bar.className = 'official-progress-bar';
    bar.appendChild(fill);
    const pctText = document.createElement('span');
    pctText.className = 'official-progress-text';
    pctText.textContent = pct + '%';
    barWrap.appendChild(bar);
    barWrap.appendChild(pctText);
    mainEl.appendChild(barWrap);

    // 다음 퀘스트 아이템
    if (nextQuest) {
      const nextEl = document.createElement('div');
      nextEl.className = 'official-next-items';
      const label = document.createElement('span');
      label.className = 'official-next-label';
      label.textContent = '다음 퀘스트';
      nextEl.appendChild(label);
      (nextQuest.slots || []).filter(Boolean).forEach(s => {
        const thumb = document.createElement('div');
        thumb.className = 'official-next-thumb';
        thumb.innerHTML = `
          <img src="${s.img}" alt="${s.name}" title="${s.name}">
          <span class="next-badge">${s.count}</span>
        `;
        nextEl.appendChild(thumb);
      });
      mainEl.appendChild(nextEl);
    } else if (quests.length > 0) {
      const doneEl = document.createElement('div');
      doneEl.className = 'official-next-done';
      doneEl.textContent = '✓ 모든 퀘스트 완료';
      mainEl.appendChild(doneEl);
    }

    // 메타
    const metaEl = document.createElement('div');
    metaEl.className = 'official-meta';
    metaEl.innerHTML = `
      <span class="tag tag-official">공식</span>
      ${post.type ? `<span class="tag ${post.type === '메인' ? 'tag-main' : 'tag-side'}">${post.type}</span>` : ''}
      <span style="font-size:13px;color:var(--text-muted)">${post.author || '익명'}</span>
    `;

    a.appendChild(mainEl);
    a.appendChild(metaEl);
    listEl.appendChild(a);
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    render();
  });
});

load();
