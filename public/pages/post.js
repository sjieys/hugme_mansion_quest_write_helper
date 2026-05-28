import { initNav, requireAuth, getGoogleUser, isAdmin } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
initNav('board.html');

const params  = new URLSearchParams(location.search);
const postId  = params.get('id');
if (!postId) location.href = 'board.html';

const me       = getGoogleUser();
const username = me?.name || '';
const admin    = isAdmin();

const loadingEl  = document.getElementById('loading');
const wrapEl     = document.getElementById('post-wrap');
const titleEl    = document.getElementById('post-title');
const statusEl   = document.getElementById('post-status');
const authorEl   = document.getElementById('post-author');
const dateEl     = document.getElementById('post-date');
const actionBar  = document.getElementById('action-bar');
const questsEl   = document.getElementById('post-quests');

const STATUS_LABEL = { draft: '작성중', review: '검토요청', reject: '반려', official: '공식' };
const STATUS_TAG   = { draft: 'tag-draft', review: 'tag-review', reject: 'tag-reject', official: 'tag-official' };

let post;

async function load() {
  const res = await fetch(`/api/posts/${postId}`);
  if (!res.ok) { location.href = 'board.html'; return; }
  post = await res.json();
  render();
}

function render() {
  loadingEl.style.display = 'none';
  wrapEl.style.display = '';

  const statusKey = post.isOfficial ? 'official' : (post.status || 'draft');
  const title = [post.floor ? post.floor + '층' : '', post.type || ''].filter(Boolean).join(' ') || '(제목 없음)';

  titleEl.textContent = title;
  statusEl.className  = `tag ${STATUS_TAG[statusKey] || 'tag-draft'}`;
  statusEl.textContent = post.isOfficial ? '공식' : (STATUS_LABEL[statusKey] || statusKey);
  authorEl.textContent = post.author || '익명';
  dateEl.textContent   = new Date(post.createdAt).toLocaleDateString('ko-KR');

  // Quests
  questsEl.innerHTML = '';
  (post.quests || []).forEach((quest, i) => {
    const items = (quest.slots || []).filter(Boolean);
    if (items.length === 0) return;

    const card = document.createElement('div');
    card.className = 'quest-read-card card';

    const header = document.createElement('div');
    header.className = 'quest-read-header';
    header.textContent = `퀘스트 ${i + 1}`;

    const itemRow = document.createElement('div');
    itemRow.className = 'quest-read-items';
    items.forEach(slot => {
      itemRow.innerHTML += `
        <div class="quest-read-item">
          <div class="read-thumb">
            <img src="${slot.img}" alt="${slot.name}" title="${slot.name}">
            <span class="badge">${slot.count}</span>
          </div>
          <span class="read-name">${slot.name}</span>
        </div>`;
    });

    card.appendChild(header);
    card.appendChild(itemRow);

    const rewards = Array.isArray(quest.rewards) ? quest.rewards : [];
    if (rewards.length) {
      const rewardRow = document.createElement('div');
      rewardRow.className = 'quest-read-rewards';
      rewards.forEach(r => {
        rewardRow.innerHTML += `
          <div class="quest-read-item">
            <div class="read-thumb">
              <img src="${r.img}" alt="${r.name}" title="${r.name}">
              <span class="badge">${r.count}</span>
            </div>
            <span class="read-name">${r.name}</span>
          </div>`;
      });
      card.appendChild(rewardRow);
    }

    questsEl.appendChild(card);
  });

  // Actions
  actionBar.innerHTML = '';
  const isAuthor = (me?.id && post.authorId === me.id) || (post.author && post.author === username);

  const backBtn = document.createElement('a');
  backBtn.href = 'board.html';
  backBtn.className = 'btn';
  backBtn.textContent = '← 목록';
  actionBar.appendChild(backBtn);

  if (isAuthor || admin) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', () => {
      sessionStorage.setItem('edit_post', JSON.stringify(post));
      location.href = `view.html?edit=${post.id}`;
    });
    actionBar.appendChild(editBtn);
  }

  if ((isAuthor || admin) && !post.isOfficial) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', async () => {
      if (!confirm('게시글을 삭제할까요?')) return;
      await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      location.href = 'board.html';
    });
    actionBar.appendChild(delBtn);
  }

  if (admin) {
    const sep = document.createElement('div');
    sep.style.cssText = 'flex:1';
    actionBar.appendChild(sep);

    if (!post.isOfficial) {
      const statusWrap = document.createElement('div');
      statusWrap.className = 'status-select-wrap';
      const lbl = document.createElement('label');
      lbl.textContent = '상태:';
      const sel = document.createElement('select');
      sel.className = 'input';
      [['draft', '작성중'], ['review', '검토요청'], ['reject', '반려']].forEach(([val, txt]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = txt;
        if ((post.status || 'draft') === val) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', async () => {
        await fetch(`/api/posts/${post.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: sel.value }),
        });
        load();
      });
      statusWrap.appendChild(lbl);
      statusWrap.appendChild(sel);
      actionBar.appendChild(statusWrap);

      const officialBtn = document.createElement('button');
      officialBtn.className = 'btn btn-primary';
      officialBtn.textContent = '⭐ 공식 퀘스트 지정';
      officialBtn.addEventListener('click', async () => {
        const r = await fetch(`/api/posts/${post.id}/official`, { method: 'POST' });
        const d = await r.json();
        if (d.replaced) alert('기존 공식 퀘스트가 이 퀘스트로 교체되었습니다.');
        load();
      });
      actionBar.appendChild(officialBtn);
    } else {
      const unBtn = document.createElement('button');
      unBtn.className = 'btn btn-danger';
      unBtn.textContent = '공식 지정 해제';
      unBtn.addEventListener('click', async () => {
        if (!confirm('공식 지정을 해제할까요?')) return;
        await fetch(`/api/posts/${post.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isOfficial: false }),
        });
        load();
      });
      actionBar.appendChild(unBtn);
    }
  }
}

load();
