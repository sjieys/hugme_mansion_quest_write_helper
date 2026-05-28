import { initNav, requireAuth } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('official.html');

const listEl = document.getElementById('official-list');
let allPosts = [];
let currentType = '';

async function load() {
  const res = await fetch('/api/official');
  allPosts = await res.json();
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
    a.href = `post.html?id=${post.id}`;
    a.className = 'official-card card';

    const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ') || '(제목 없음)';

    const preview = (post.quests || [])
      .flatMap(q => (q.slots || []).filter(Boolean).map(s => `${s.name} ${s.count}개`))
      .slice(0, 4)
      .join(', ');

    a.innerHTML = `
      <div class="official-main">
        <span class="official-title">${title}</span>
        ${preview ? `<span class="official-preview">${preview}${(post.quests || []).length > 4 ? ' …' : ''}</span>` : ''}
      </div>
      <div class="official-meta">
        <span class="tag tag-official">공식</span>
        ${post.type ? `<span class="tag ${post.type === '메인' ? 'tag-main' : 'tag-side'}">${post.type}</span>` : ''}
        <span style="font-size:13px;color:var(--text-muted)">${post.author || '익명'}</span>
      </div>
    `;
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
