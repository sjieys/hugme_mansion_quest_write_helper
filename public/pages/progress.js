import { initNav, requireAuth, getGoogleUser } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('progress.html');

const me       = getGoogleUser();
const username = me?.email || me?.name || '';
const contentEl   = document.getElementById('progress-content');
const overallText = document.getElementById('overall-text');
const overallBar  = document.getElementById('overall-bar');

let userProgress = {};

function parseLevel(name) {
  const m = name && name.match(/(\d+)레벨/);
  return m ? parseInt(m[1], 10) : 1;
}

function questWeight(quest) {
  return (quest.slots || []).filter(Boolean).reduce((sum, s) => {
    return sum + Math.pow(2, parseLevel(s.name) - 1) * (s.count || 1);
  }, 0);
}

function fmt(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

function pctHtml(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<span class="pct-main">${pct}%</span><span class="pct-sub">(${fmt(done)} / ${fmt(total)})</span>`;
}

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

  // 퀘스트 게시판에서 넘어온 경우 해당 카드 자동 오픈
  const openId = new URLSearchParams(location.search).get('open');
  if (openId) {
    const targetCard = contentEl.querySelector(`[data-post-id="${openId}"]`);
    if (targetCard) {
      targetCard.classList.add('open');
      requestAnimationFrame(() => {
        const firstIncomplete = targetCard.querySelector('.quest-check:not(.done)');
        const scrollTarget = firstIncomplete || targetCard;
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }
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

  let totalWeight = 0;
  const allQuestWeights = {};

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

      // 가중치 계산
      let postTotalWeight = 0;
      let postDoneWeight  = 0;

      quests.forEach((quest, i) => {
        const w   = questWeight(quest);
        const key = progressKey(post.id, i);
        postTotalWeight += w;
        totalWeight     += w;
        allQuestWeights[key] = w;
        if (userProgress[key]) postDoneWeight += w;
      });

      const card = document.createElement('div');
      card.className = 'progress-card card';
      card.dataset.postId = post.id;

      const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ');

      const barFill = document.createElement('div');
      barFill.className = 'progress-bar-fill';
      barFill.style.width = postTotalWeight ? `${(postDoneWeight / postTotalWeight) * 100}%` : '0%';
      const barWrap = document.createElement('div');
      barWrap.className = 'progress-bar-wrap';
      barWrap.style.cssText = 'flex:1;min-width:60px';
      barWrap.appendChild(barFill);

      const fractionEl = document.createElement('span');
      fractionEl.className = 'progress-fraction';
      fractionEl.innerHTML = pctHtml(postDoneWeight, postTotalWeight);

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

      hdr.addEventListener('click', () => {
        const wasOpen = card.classList.contains('open');
        card.classList.toggle('open');
        if (!wasOpen) {
          // 열릴 때 첫 번째 미완료 퀘스트로 스크롤
          requestAnimationFrame(() => {
            const firstIncomplete = checks.querySelector('.quest-check:not(.done)');
            if (firstIncomplete) {
              firstIncomplete.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          });
        }
      });

      const checks = document.createElement('div');
      checks.className = 'quest-checks';

      quests.forEach((quest, i) => {
        const key  = progressKey(post.id, i);
        const done = !!userProgress[key];

        const row = document.createElement('label');
        row.className = `quest-check${done ? ' done' : ''}`;
        row.dataset.key = key;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = done;
        cb.addEventListener('change', async () => {
          userProgress[key] = cb.checked;
          row.classList.toggle('done', cb.checked);
          await saveProgress();

          const newDoneWeight = quests.reduce((sum, q, j) => {
            return sum + (userProgress[progressKey(post.id, j)] ? questWeight(q) : 0);
          }, 0);
          fractionEl.innerHTML = pctHtml(newDoneWeight, postTotalWeight);
          barFill.style.width = postTotalWeight ? `${(newDoneWeight / postTotalWeight) * 100}%` : '0%';
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
    const doneWeight = Object.entries(allQuestWeights)
      .filter(([k]) => userProgress[k])
      .reduce((sum, [, w]) => sum + w, 0);
    const pct = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0;
    overallText.innerHTML = `<span class="pct-main">${pct}%</span><span class="pct-sub">(${fmt(doneWeight)} / ${fmt(totalWeight)})</span>`;
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

// ── 드래그 다중 선택 (PC: mouse / 폰: touch) ─────────────
let dragActive = false;
let dragCheckValue = false;
const draggedRows = new Set();
let blockNextClick = false;
let suppressMouseClick = false;
let curX = 0, curY = 0;
let scrollRaf = null;

const SCROLL_ZONE = 80;  // 엣지에서 이 범위 안에 들어오면 스크롤 시작
const SCROLL_MAX  = 12;  // 최대 스크롤 속도 (px/frame)

function autoScroll() {
  if (!dragActive) return;
  const vh = window.innerHeight;
  let speed = 0;
  if (curY < SCROLL_ZONE) {
    speed = -SCROLL_MAX * (1 - curY / SCROLL_ZONE);
  } else if (curY > vh - SCROLL_ZONE) {
    speed = SCROLL_MAX * (1 - (vh - curY) / SCROLL_ZONE);
  }
  if (speed !== 0) {
    window.scrollBy(0, speed);
    applyDragRow(document.elementFromPoint(curX, curY));
  }
  scrollRaf = requestAnimationFrame(autoScroll);
}

function startDrag(cb, row) {
  dragActive = true;
  dragCheckValue = !cb.checked;
  draggedRows.clear();
  applyDragRow(row);
  scrollRaf = requestAnimationFrame(autoScroll);
}

function endDrag() {
  dragActive = false;
  draggedRows.clear();
  cancelAnimationFrame(scrollRaf);
}

function applyDragRow(el) {
  const row = el?.closest?.('.quest-check[data-key]');
  if (!row || draggedRows.has(row)) return;
  draggedRows.add(row);
  const cb = row.querySelector('input[type="checkbox"]');
  if (!cb || cb.checked === dragCheckValue) return;
  cb.checked = dragCheckValue;
  cb.dispatchEvent(new Event('change'));
}

// ── 마우스 ──
document.addEventListener('mousedown', e => {
  const row = e.target.closest('.quest-check[data-key]');
  if (!row) return;
  e.preventDefault();
  const cb = row.querySelector('input[type="checkbox"]');
  if (!cb) return;
  curX = e.clientX; curY = e.clientY;
  suppressMouseClick = true;
  startDrag(cb, row);
}, true);

// mousedown에서 직접 토글했으므로 label의 click 기본 동작 차단
document.addEventListener('click', e => {
  if (suppressMouseClick && e.target.closest('.quest-check[data-key]')) {
    e.preventDefault();
    suppressMouseClick = false;
  }
}, true);

document.addEventListener('mousemove', e => {
  if (!dragActive) return;
  curX = e.clientX; curY = e.clientY;
  applyDragRow(document.elementFromPoint(curX, curY));
});

document.addEventListener('mouseup', () => { endDrag(); });

// ── 터치 ──
document.addEventListener('touchstart', e => {
  const row = e.target.closest('.quest-check[data-key]');
  if (!row) return;
  const cb = row.querySelector('input[type="checkbox"]');
  if (!cb) return;
  const t = e.touches[0];
  curX = t.clientX; curY = t.clientY;
  startDrag(cb, row);
  blockNextClick = true;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!dragActive) return;
  if (e.cancelable) e.preventDefault();
  const t = e.touches[0];
  curX = t.clientX; curY = t.clientY;
  applyDragRow(document.elementFromPoint(curX, curY));
}, { passive: false });

document.addEventListener('touchend', () => {
  endDrag();
  setTimeout(() => { blockNextClick = false; }, 300);
});

// 터치 후 ghost click 차단
document.addEventListener('click', e => {
  if (blockNextClick && e.target.closest('.quest-check')) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
