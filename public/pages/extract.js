import { requireAuth, getGoogleUser, isAdmin, initNav } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
const me = getGoogleUser();
initNav('extract.html');

// ── 요소 참조 ──────────────────────────────────────────────
const floorInput      = document.getElementById('floor-input');
const typeSelect      = document.getElementById('type-select');
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const processBtn      = document.getElementById('btn-process');
const clearBtn        = document.getElementById('btn-clear');
const submitBtn       = document.getElementById('btn-submit');
const editBtn         = document.getElementById('btn-edit');
const actionBtns      = document.getElementById('action-btns');
const progressSec     = document.getElementById('progress-section');
const progressBar     = document.getElementById('progress-bar');
const progressText    = document.getElementById('progress-text');
const resultsSec      = document.getElementById('results-section');
const resultsList     = document.getElementById('results-list');
const resultCount     = document.getElementById('result-count');
const imgModal        = document.getElementById('img-modal');
const imgModalImg     = document.getElementById('img-modal-img');
const dropZoneCount   = document.getElementById('drop-zone-count');
const statusModal     = document.getElementById('status-modal');
const statusModalDesc = document.getElementById('status-modal-desc');
const modalReview     = document.getElementById('modal-review');
const modalDraft      = document.getElementById('modal-draft');
const modalCancel     = document.getElementById('modal-cancel');
const usageBadge      = document.getElementById('usage-badge');
const usageText       = document.getElementById('usage-text');
const usageBar        = document.getElementById('usage-bar');

let pendingFiles = [];
let results      = [];
let isProcessing = false;

// ── 아이템 카탈로그 로드 ─────────────────────────────────
let allItemsFlat = [];
fetch('/data').then(r => r.json()).then(data => {
  for (const [cat, items] of Object.entries(data.categories || {})) {
    items.forEach(item => allItemsFlat.push({ ...item, category: cat }));
  }
});

// ── 사용량 표시 ──────────────────────────────────────────
async function refreshUsage() {
  try {
    const d = await fetch('/api/gemini-usage').then(r => r.json());
    updateUsageBadge(d.count, d.limit);
  } catch { /* 무시 */ }
}
function updateUsageBadge(count, limit) {
  const pct = Math.min(100, Math.round((count / limit) * 100));
  usageText.textContent = `오늘 ${count} / ${limit}`;
  usageBar.style.width  = pct + '%';
  usageBar.className    = 'usage-bar-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
  usageBadge.style.display = '';
}
refreshUsage();

// ── 파일 선택 처리 ───────────────────────────────────────
function handleFiles(files) {
  const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
  pendingFiles = [...pendingFiles, ...imgs];
  updateDropZone();
}
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
function updateDropZone() {
  const n = pendingFiles.length;
  dropZoneCount.textContent = n > 0 ? `${n}장 선택됨 (더 추가 가능)` : '';
  processBtn.disabled = n === 0 || isProcessing;
}

// ── 초기화 ────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  if (isProcessing) return;
  pendingFiles = [];
  results = [];
  fileInput.value = '';
  updateDropZone();
  progressSec.style.display = 'none';
  resultsSec.style.display  = 'none';
  actionBtns.style.display  = 'none';
  resultsList.innerHTML = '';
});

// ── 추출 실행 ─────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  const floor = floorInput.value.trim();
  const type  = typeSelect.value;
  if (!floor)               { alert('층수를 입력하세요.'); return; }
  if (!type)                { alert('구분을 선택하세요.'); return; }
  if (!pendingFiles.length) { alert('이미지를 추가하세요.'); return; }

  isProcessing = true;
  processBtn.disabled = true;
  clearBtn.disabled   = true;
  progressSec.style.display = 'block';
  resultsSec.style.display  = 'none';
  actionBtns.style.display  = 'none';
  results = [];

  for (let i = 0; i < pendingFiles.length; i++) {
    progressBar.style.width  = Math.round((i / pendingFiles.length) * 100) + '%';
    progressText.textContent = `처리 중... ${i + 1} / ${pendingFiles.length}`;
    const file = pendingFiles[i];
    try {
      const base64 = await toBase64(file);
      const resp   = await fetch('/api/extract-quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { data: base64, mimeType: file.type } }),
      });
      const data = await resp.json();
      if (data.usageToday != null) updateUsageBadge(data.usageToday, data.dailyLimit);
      results.push({ file, url: URL.createObjectURL(file), ...data, include: data.success });
    } catch (err) {
      results.push({ file, url: URL.createObjectURL(file), success: false, error: err.message, include: false });
    }
  }

  progressBar.style.width  = '100%';
  const ok = results.filter(r => r.success).length;
  progressText.textContent = `완료 — ${ok}/${pendingFiles.length}장 추출 성공`;

  isProcessing = false;
  processBtn.disabled = false;
  clearBtn.disabled   = false;
  renderResults();
  resultsSec.style.display = 'block';
  actionBtns.style.display = 'flex';
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 에러 메시지 정리 ─────────────────────────────────────
function parseError(msg) {
  const m = (msg || '').match(/\[(\d{3})[^\]]*\]/);
  if (!m) return { code: null, desc: (msg || '').slice(0, 80) };
  const code = m[1];
  const descs = { '429': '요청 한도 초과', '404': '모델을 찾을 수 없음', '400': '잘못된 요청', '403': '권한 없음', '500': '서버 내부 오류', '503': 'API 서비스 불가' };
  return { code, desc: descs[code] || '알 수 없는 오류' };
}

// ── 결과 렌더링 ──────────────────────────────────────────
function renderResults() {
  resultsList.innerHTML = '';
  updateCountLabel();

  results.forEach((r, idx) => {
    const hasUnmatched = r.success && (
      (r.slots   || []).some(s => !s.matched) ||
      (r.rewards || []).some(s => !s.matched)
    );

    const wrapper = document.createElement('div');
    wrapper.className = 'result-wrapper';

    // ─ 결과 행 ─
    const row = document.createElement('div');
    row.className = 'result-row' + (!r.success ? ' error' : hasUnmatched ? ' unmatched' : '');
    row.dataset.idx = idx;

    if (r.success) {
      const slotsHtml   = (r.slots   || []).map(miniItem).join('') || '<span class="no-item">없음</span>';
      const rewardsHtml = (r.rewards || []).map(miniItem).join('') || '<span class="no-item">없음</span>';
      row.innerHTML = `
        <label class="result-checkbox" title="등록 포함 여부">
          <input type="checkbox" ${r.include ? 'checked' : ''} data-idx="${idx}">
        </label>
        <span class="result-num">${idx + 1}</span>
        <img class="result-thumb" src="${r.url}" alt="퀘스트 이미지" data-src="${r.url}">
        <div class="result-content">
          <div class="result-section">
            <div class="result-section-label">미션</div>
            <div class="result-items-row">${slotsHtml}</div>
          </div>
          <div class="result-arrow">→</div>
          <div class="result-section">
            <div class="result-section-label">보상</div>
            <div class="result-items-row">${rewardsHtml}</div>
          </div>
        </div>
        <div class="result-status">
          ${hasUnmatched ? '<span class="badge badge-warn">일부 미매칭</span>' : '<span class="badge badge-ok">완료</span>'}
        </div>
        <button class="edit-btn-toggle" data-idx="${idx}">수정</button>`;
    } else {
      const { code, desc } = parseError(r.error || '');
      row.innerHTML = `
        <label class="result-checkbox"><input type="checkbox" disabled></label>
        <span class="result-num">${idx + 1}</span>
        <img class="result-thumb" src="${r.url}" alt="" data-src="${r.url}">
        <div class="result-content">
          <div>
            ${code ? `<span class="error-code">${code}</span>` : ''}
            <p class="error-msg">${desc}</p>
          </div>
        </div>
        <div class="result-status"><span class="badge badge-err">실패</span></div>`;
    }

    wrapper.appendChild(row);

    // ─ 수정 패널 (성공 행만) ─
    if (r.success) {
      const panel = document.createElement('div');
      panel.className = 'edit-panel';
      panel.id = `edit-panel-${idx}`;
      panel.innerHTML = `
        <div class="edit-layout">
          <div class="edit-img-col">
            <img src="${r.url}" alt="원본 이미지" data-src="${r.url}">
          </div>
          <div class="edit-form-col">
            <div class="edit-section">
              <div class="edit-section-header">
                <span>미션 아이템</span>
                <button class="edit-add-btn" data-type="mission" data-idx="${idx}">+ 아이템 추가</button>
              </div>
              <div class="edit-chips" id="edit-mission-${idx}"></div>
            </div>
            <div class="edit-section">
              <div class="edit-section-header">
                <span>보상 아이템</span>
                <button class="edit-add-btn" data-type="reward" data-idx="${idx}">+ 보상 추가</button>
              </div>
              <div class="edit-chips" id="edit-reward-${idx}"></div>
            </div>
            <div class="edit-picker-wrap" id="edit-picker-${idx}" style="display:none">
              <div class="picker-target-label" id="picker-label-${idx}"></div>
              <input type="text" class="picker-search" id="picker-search-${idx}" placeholder="아이템 검색...">
              <div class="picker-grid" id="picker-grid-${idx}"></div>
            </div>
            <div class="edit-actions">
              <button class="btn btn-primary edit-save-btn" data-idx="${idx}">저장</button>
              <button class="btn btn-secondary edit-cancel-btn" data-idx="${idx}">취소</button>
            </div>
          </div>
        </div>`;
      wrapper.appendChild(panel);

      // 이미지 확대 (edit panel 내)
      panel.querySelector('.edit-img-col img').addEventListener('click', () => openImgModal(r.url));

      // 저장 / 취소
      panel.querySelector('.edit-save-btn').addEventListener('click', () => saveEdit(idx));
      panel.querySelector('.edit-cancel-btn').addEventListener('click', () => closeEdit(idx));

      // 수정 토글 버튼
      row.querySelector('.edit-btn-toggle').addEventListener('click', () => {
        if (panel.classList.contains('open')) closeEdit(idx);
        else openEdit(idx);
      });
    }

    // 체크박스
    row.querySelector('input[type=checkbox]:not(:disabled)')?.addEventListener('change', e => {
      results[parseInt(e.target.dataset.idx)].include = e.target.checked;
      updateCountLabel();
    });

    // 썸네일 확대 (result 행)
    row.querySelector('.result-thumb')?.addEventListener('click', () => openImgModal(r.url));

    resultsList.appendChild(wrapper);
  });
}

function miniItem(item) {
  const cls   = item.matched ? 'mini-item' : 'mini-item not-matched';
  const imgEl = item.img ? `<img src="${item.img}" alt="${item.name}" onerror="this.style.display='none'">` : '';
  return `<div class="${cls}" title="${item.name}">${imgEl}<span class="item-name">${item.name}</span><span class="item-count">×${item.count}</span></div>`;
}

function updateCountLabel() {
  const sel = results.filter(r => r.include).length;
  resultCount.textContent = `${sel} / ${results.length}장 선택됨`;
  submitBtn.textContent   = `${sel}개 등록하기`;
}

// ── 이미지 확대 ──────────────────────────────────────────
function openImgModal(src) { imgModalImg.src = src; imgModal.classList.add('open'); }
imgModal.addEventListener('click', () => imgModal.classList.remove('open'));

// ── 인라인 수정 ──────────────────────────────────────────
const editStates = {};

function openEdit(idx) {
  const r = results[idx];
  editStates[idx] = {
    slots:        JSON.parse(JSON.stringify(r.slots   || [])),
    rewards:      JSON.parse(JSON.stringify(r.rewards || [])),
    pickerTarget: null,
  };
  const panel = document.getElementById(`edit-panel-${idx}`);
  const row   = resultsList.querySelector(`.result-row[data-idx="${idx}"]`);
  panel?.classList.add('open');
  row?.classList.add('edit-open');
  row?.querySelector('.edit-btn-toggle')?.classList.add('active');
  renderEditChips(idx);
}

function closeEdit(idx) {
  const panel = document.getElementById(`edit-panel-${idx}`);
  const row   = resultsList.querySelector(`.result-row[data-idx="${idx}"]`);
  panel?.classList.remove('open');
  row?.classList.remove('edit-open');
  row?.querySelector('.edit-btn-toggle')?.classList.remove('active');
  delete editStates[idx];
}

function saveEdit(idx) {
  const state = editStates[idx];
  results[idx].slots   = state.slots.map(s => ({ ...s, matched: !!s.itemId }));
  results[idx].rewards = state.rewards.map(r => ({ ...r, matched: !!r.itemId }));
  results[idx].success = true;
  results[idx].include = true;
  closeEdit(idx);
  renderResults();
  // 저장한 행까지 스크롤
  setTimeout(() => {
    resultsList.querySelectorAll('.result-wrapper')[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function renderEditChips(idx) {
  const state = editStates[idx];
  if (!state) return;
  const missionEl = document.getElementById(`edit-mission-${idx}`);
  const rewardEl  = document.getElementById(`edit-reward-${idx}`);
  if (!missionEl || !rewardEl) return;

  missionEl.innerHTML = renderChips(idx, 'mission', state.slots);
  rewardEl.innerHTML  = renderChips(idx, 'reward',  state.rewards);
  bindChipEvents(idx);

  // + 추가 버튼
  document.querySelectorAll(`#edit-panel-${idx} .edit-add-btn`).forEach(btn => {
    btn.addEventListener('click', () => openPicker(idx, btn.dataset.type));
  });
}

function renderChips(idx, type, items) {
  if (!items.length) return '<span style="font-size:12px;color:var(--text-muted)">없음 (+ 추가로 입력)</span>';
  return items.map((item, si) => `
    <div class="edit-chip ${item.matched || item.itemId ? '' : 'not-matched'}">
      ${item.img ? `<img src="${item.img}" alt="${item.name}" onerror="this.style.display='none'">` : ''}
      <span class="chip-name" title="${item.name}">${item.name}</span>
      <div class="chip-controls">
        <button class="chip-count-btn" data-type="${type}" data-si="${si}" data-delta="-1">−</button>
        <span class="chip-count">${item.count || 1}</span>
        <button class="chip-count-btn" data-type="${type}" data-si="${si}" data-delta="1">+</button>
        <button class="chip-remove" data-type="${type}" data-si="${si}">×</button>
      </div>
    </div>`).join('');
}

function bindChipEvents(idx) {
  const state = editStates[idx];
  const panel = document.getElementById(`edit-panel-${idx}`);
  if (!state || !panel) return;

  panel.querySelectorAll('.chip-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const si    = parseInt(btn.dataset.si);
      const delta = parseInt(btn.dataset.delta);
      const arr   = btn.dataset.type === 'mission' ? state.slots : state.rewards;
      if (arr[si]) arr[si].count = Math.max(1, (arr[si].count || 1) + delta);
      renderEditChips(idx);
    });
  });

  panel.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const si  = parseInt(btn.dataset.si);
      const arr = btn.dataset.type === 'mission' ? state.slots : state.rewards;
      arr.splice(si, 1);
      renderEditChips(idx);
    });
  });
}

// ── 아이템 선택기 ─────────────────────────────────────────
let pickerCache = [];

function openPicker(idx, type) {
  const state = editStates[idx];
  if (!state) return;
  state.pickerTarget = type;

  const wrap   = document.getElementById(`edit-picker-${idx}`);
  const label  = document.getElementById(`picker-label-${idx}`);
  const search = document.getElementById(`picker-search-${idx}`);
  if (!wrap || !label || !search) return;

  label.textContent  = type === 'mission' ? '미션 아이템 선택' : '보상 아이템 선택';
  wrap.style.display = 'block';
  search.value = '';

  // 기존 리스너 제거 후 재등록
  const newSearch = search.cloneNode(true);
  search.replaceWith(newSearch);
  newSearch.addEventListener('input', () => renderPickerGrid(idx, newSearch.value.trim()));
  newSearch.focus();

  renderPickerGrid(idx, '');
}

function renderPickerGrid(idx, query) {
  const state  = editStates[idx];
  const gridEl = document.getElementById(`picker-grid-${idx}`);
  if (!state || !gridEl) return;

  let items = allItemsFlat;
  if (state.pickerTarget === 'mission') items = items.filter(i => i.category !== '보상');
  const q = query.toLowerCase();
  if (q) items = items.filter(i => i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));

  pickerCache = items.slice(0, 80);
  gridEl.innerHTML = pickerCache.map((item, i) => `
    <div class="picker-item" data-i="${i}" title="${item.description}">
      <img src="${item.img}" alt="" onerror="this.style.display='none'">
      <span>${item.description}</span>
    </div>`).join('');

  gridEl.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', () => {
      const item    = pickerCache[parseInt(el.dataset.i)];
      if (!item) return;
      const newItem = { img: item.img, name: item.description, count: 1, itemId: item.id, matched: true };
      if (state.pickerTarget === 'mission') state.slots.push(newItem);
      else state.rewards.push(newItem);
      document.getElementById(`edit-picker-${idx}`).style.display = 'none';
      renderEditChips(idx);
    });
  });
}

// ── 상태 선택 모달 ───────────────────────────────────────
function askStatus(count) {
  return new Promise(resolve => {
    statusModalDesc.textContent = `선택된 퀘스트 ${count}개를 등록합니다.`;
    statusModal.classList.add('open');
    const cleanup = v => {
      statusModal.classList.remove('open');
      modalReview.removeEventListener('click', onReview);
      modalDraft.removeEventListener('click', onDraft);
      modalCancel.removeEventListener('click', onCancel);
      resolve(v);
    };
    const onReview = () => cleanup('review');
    const onDraft  = () => cleanup('draft');
    const onCancel = () => cleanup(null);
    modalReview.addEventListener('click', onReview);
    modalDraft.addEventListener('click', onDraft);
    modalCancel.addEventListener('click', onCancel);
  });
}

// ── 목록 수정하기 ─────────────────────────────────────────
editBtn.addEventListener('click', () => {
  const floor    = floorInput.value.trim();
  const type     = typeSelect.value;
  const selected = results.filter(r => r.include && r.success);
  if (!floor || !type)  { alert('층수와 구분을 입력하세요.'); return; }
  if (!selected.length) { alert('선택된 퀘스트가 없습니다.'); return; }
  const state = {
    floor, type,
    quests: selected.map(r => ({
      slots:   (r.slots   || []).map(({ img, name, count }) => ({ img, name, count })),
      rewards: (r.rewards || []).map(({ img, name, count }) => ({ img, name, count })),
    })),
  };
  sessionStorage.setItem('preload_extract', JSON.stringify(state));
  location.href = 'view.html?from=extract';
});

// ── 등록하기 ─────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const floor    = floorInput.value.trim();
  const type     = typeSelect.value;
  const selected = results.filter(r => r.include && r.success);
  if (!floor || !type)  { alert('층수와 구분을 입력하세요.'); return; }
  if (!selected.length) { alert('선택된 퀘스트가 없습니다.'); return; }

  const status = await askStatus(selected.length);
  if (!status) return;

  const quests = selected.map(r => ({
    slots:   (r.slots   || []).map(({ img, name, count }) => ({ img, name, count })),
    rewards: (r.rewards || []).map(({ img, name, count }) => ({ img, name, count })),
  }));

  submitBtn.disabled    = true;
  submitBtn.textContent = '등록 중...';
  try {
    const resp = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: me?.nickname || me?.name || '', authorId: me?.id || '', floor, type, quests, status }),
    });
    if (!resp.ok) throw new Error(`서버 오류 ${resp.status}`);
    alert(`${selected.length}개 퀘스트 등록 완료!`);
    location.href = 'board.html';
  } catch (err) {
    alert('등록 실패: ' + err.message);
    submitBtn.disabled = false;
    updateCountLabel();
  }
});
