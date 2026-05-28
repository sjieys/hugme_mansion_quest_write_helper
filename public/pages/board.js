import { initNav, requireAuth, getGoogleUser, isAdmin } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('board.html');
const me = getGoogleUser();

if (!isAdmin()) document.getElementById('btn-new-quest')?.remove();

const postListEl = document.getElementById('post-list');
let allPosts = [];
let currentFilter = '';

const STATUS_LABEL = { draft: '작성중', review: '검토요청', reject: '반려', official: '공식' };
const STATUS_TAG   = { draft: 'tag-draft', review: 'tag-review', reject: 'tag-reject', official: 'tag-official' };

async function loadPosts() {
  const res = await fetch('/api/posts');
  allPosts = await res.json();
  renderPosts();
}

function renderPosts() {
  let list = allPosts;
  if (currentFilter === 'official') {
    list = allPosts.filter(p => p.isOfficial);
  } else if (currentFilter) {
    list = allPosts.filter(p => p.status === currentFilter && !p.isOfficial);
  }

  if (list.length === 0) {
    postListEl.innerHTML = '<div class="empty-state">게시글이 없습니다.</div>';
    return;
  }

  postListEl.innerHTML = '';
  list.forEach(post => {
    const a = document.createElement('a');
    a.href = `post.html?id=${post.id}`;
    a.className = 'post-card card';

    const statusKey = post.isOfficial ? 'official' : (post.status || 'draft');
    const label = STATUS_LABEL[statusKey] || statusKey;
    const tagClass = STATUS_TAG[statusKey] || 'tag-draft';
    const questCount = (post.quests || []).length;
    const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ') || '(제목 없음)';

    a.innerHTML = `
      <div class="post-main">
        <span class="post-title">${title}</span>
        <span class="post-count">${questCount}개 퀘스트</span>
      </div>
      <div class="post-meta">
        <span class="tag ${tagClass}">${label}</span>
        ${post.type ? `<span class="tag ${post.type === '메인' ? 'tag-main' : 'tag-side'}">${post.type}</span>` : ''}
        <span class="post-author">${post.author || '익명'}</span>
        <time>${new Date(post.createdAt).toLocaleDateString('ko-KR')}</time>
      </div>
    `;
    postListEl.appendChild(a);
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    renderPosts();
  });
});

loadPosts();
