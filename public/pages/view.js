import {
  returnData, returnPlusItem, returnQuest,
  returnItem, renderCategories, changeToItem,
  returnPlusReward, returnRewardItem,
} from '../components/utils.js';
import { requireAuth, getGoogleUser, getUsername, logout, isAdmin } from '../hooks/nav.js';

if (!requireAuth()) throw new Error();
const me = getGoogleUser();

function showConfirm(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = message;
    modal.style.display = 'flex';
    const yes = document.getElementById('confirm-yes');
    const no  = document.getElementById('confirm-no');
    const cleanup = (result) => {
      modal.style.display = 'none';
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      resolve(result);
    };
    const onYes = () => cleanup(true);
    const onNo  = () => cleanup(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

document.getElementById('btn-logout')?.addEventListener('click', logout);

const questList    = document.getElementById("quest-item-list");
const catalog      = document.getElementById("catalog");
const copyBtn      = document.getElementById("btn-copy");
const saveBtn      = document.getElementById("btn-save");
const loadsBtn     = document.getElementById("btn-loads");
const registerBtn  = document.getElementById("btn-register");
const statusSelect = document.getElementById("status-select");
const searchInput  = document.getElementById("search-input");
const floorInput   = document.getElementById("floor-input");
const typeSelect   = document.getElementById("type-select");
const saveModal    = document.getElementById("save-modal");
const saveList     = document.getElementById("save-list");
const modalClose   = document.getElementById("modal-close");

let selectedPlusItem   = null;
let selectedPlusReward = null;
let selectedRewardItem = null;
let selectedItem       = null;

if (!isAdmin()) {
  statusSelect.style.display = 'none';
}

// ── 초기화 ──────────────────────────────────────────────
const data = await returnData();
renderCategories(data, catalog.id);
questList.appendChild(returnQuest());
updateLoadsBtn();

// ── 수정 모드 복원 ───────────────────────────────────────
const editId = new URLSearchParams(location.search).get('edit');
if (editId) {
  const raw = sessionStorage.getItem('edit_post');
  if (raw) {
    const post = JSON.parse(raw);
    restoreState(post);
    statusSelect.value = post.status || 'draft';
    sessionStorage.removeItem('edit_post');
  }
}

// ── 맨 밑 빈 퀘스트 보장 ────────────────────────────────
function ensureEmptyQuestAtEnd() {
  const quests = [...questList.querySelectorAll(".quest-item")];
  if (quests.length === 0) {
    questList.appendChild(returnQuest());
    return;
  }
  const last = quests[quests.length - 1];
  if (last.querySelector(".quest-top .item")) {
    questList.appendChild(returnQuest());
  }
}

// ── 퀘스트 목록 클릭 (위임) ─────────────────────────────
questList.addEventListener("click", (event) => {
  const delBtn = event.target.closest(".quest-delete");
  if (delBtn) {
    delBtn.closest(".quest-item").remove();
    ensureEmptyQuestAtEnd();
    return;
  }

  const plusItem = event.target.closest(".plus-item");
  if (plusItem) {
    if (selectedPlusReward) { selectedPlusReward.classList.remove("selected"); selectedPlusReward = null; }
    if (selectedRewardItem) { selectedRewardItem.classList.remove("selected"); selectedRewardItem = null; }
    if (selectedItem)       { selectedItem.classList.remove("selected");       selectedItem = null; }
    if (selectedPlusItem) selectedPlusItem.classList.remove("selected");
    selectedPlusItem = (selectedPlusItem === plusItem) ? null : plusItem;
    if (selectedPlusItem) selectedPlusItem.classList.add("selected");
    return;
  }

  // 배치된 아이템 선택 (클릭으로 재선택 → 카탈로그 재클릭 시 +1)
  const itemEl = event.target.closest(".quest-top .item");
  if (itemEl && !event.target.closest(".controls")) {
    if (selectedPlusItem)   { selectedPlusItem.classList.remove("selected");   selectedPlusItem = null; }
    if (selectedPlusReward) { selectedPlusReward.classList.remove("selected"); selectedPlusReward = null; }
    if (selectedRewardItem) { selectedRewardItem.classList.remove("selected"); selectedRewardItem = null; }
    if (selectedItem) selectedItem.classList.remove("selected");
    selectedItem = (selectedItem === itemEl) ? null : itemEl;
    if (selectedItem) selectedItem.classList.add("selected");
    return;
  }

  const plusReward = event.target.closest(".plus-reward");
  if (plusReward) {
    if (selectedPlusItem)   { selectedPlusItem.classList.remove("selected");   selectedPlusItem = null; }
    if (selectedRewardItem) { selectedRewardItem.classList.remove("selected"); selectedRewardItem = null; }
    if (selectedItem)       { selectedItem.classList.remove("selected");       selectedItem = null; }
    if (selectedPlusReward) selectedPlusReward.classList.remove("selected");
    selectedPlusReward = (selectedPlusReward === plusReward) ? null : plusReward;
    if (selectedPlusReward) selectedPlusReward.classList.add("selected");
    return;
  }

  const rewardFilled = event.target.closest(".reward-filled");
  if (rewardFilled && !event.target.closest(".controls")) {
    if (selectedPlusItem)   { selectedPlusItem.classList.remove("selected");   selectedPlusItem = null; }
    if (selectedPlusReward) { selectedPlusReward.classList.remove("selected"); selectedPlusReward = null; }
    if (selectedItem)       { selectedItem.classList.remove("selected");       selectedItem = null; }
    if (selectedRewardItem) selectedRewardItem.classList.remove("selected");
    selectedRewardItem = (selectedRewardItem === rewardFilled) ? null : rewardFilled;
    if (selectedRewardItem) selectedRewardItem.classList.add("selected");
    return;
  }
});

// ── 드래그 앤 드롭 ──────────────────────────────────────
let draggedQuest = null;

function clearDropIndicators() {
  questList.querySelectorAll(".drop-before, .drop-after").forEach(el => {
    el.classList.remove("drop-before", "drop-after");
  });
}

questList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".quest-item");
  if (!item) return;
  draggedQuest = item;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

questList.addEventListener("dragend", () => {
  if (draggedQuest) draggedQuest.classList.remove("dragging");
  draggedQuest = null;
  clearDropIndicators();
});

questList.addEventListener("dragover", (event) => {
  event.preventDefault();
  const item = event.target.closest(".quest-item");
  if (!item || item === draggedQuest) return;
  clearDropIndicators();
  const { top, height } = item.getBoundingClientRect();
  item.classList.add(event.clientY < top + height / 2 ? "drop-before" : "drop-after");
});

questList.addEventListener("dragleave", (event) => {
  if (!questList.contains(event.relatedTarget)) clearDropIndicators();
});

questList.addEventListener("drop", (event) => {
  event.preventDefault();
  const item = event.target.closest(".quest-item");
  if (!item || !draggedQuest || item === draggedQuest) return;
  const { top, height } = item.getBoundingClientRect();
  questList.insertBefore(draggedQuest,
    event.clientY < top + height / 2 ? item : item.nextSibling);
  clearDropIndicators();
});

// ── 카탈로그 클릭 ───────────────────────────────────────
catalog.addEventListener("click", (event) => {
  const rewardQtyBtn = event.target.closest(".reward-qty-btn");
  if (rewardQtyBtn) {
    const qty = parseInt(rewardQtyBtn.dataset.count);
    if (selectedPlusReward) {
      const newReward = returnRewardItem(rewardQtyBtn.dataset.img, rewardQtyBtn.dataset.name, qty);
      selectedPlusReward.replaceWith(newReward);
      const rewardsEl = newReward.parentElement;
      if (rewardsEl && !rewardsEl.querySelector(".plus-reward")) {
        rewardsEl.appendChild(returnPlusReward());
      }
      selectedPlusReward.classList.remove("selected");
      selectedPlusReward = null;
      selectedRewardItem = newReward;
      newReward.classList.add("selected");
    } else if (selectedRewardItem) {
      const badge = selectedRewardItem.querySelector(".badge");
      badge.value = Math.min(999, (parseInt(badge.value) || 0) + qty);
    }
    return;
  }

  const card = event.target.closest(".item-card");
  if (!card || card.classList.contains("quick-qty-card")) return;

  if (card.dataset.category === "보상" && selectedPlusReward) {
    const newReward = returnRewardItem(card.dataset.img, card.dataset.name);
    selectedPlusReward.replaceWith(newReward);
    const rewardsEl = newReward.parentElement;
    if (rewardsEl && !rewardsEl.querySelector(".plus-reward")) {
      rewardsEl.appendChild(returnPlusReward());
    }
    selectedPlusReward = null;
  } else if (card.dataset.category !== "보상" && selectedPlusItem) {
    // 빈 슬롯에 아이템 배치 → 배치 후 자동 선택 + 빈 퀘스트 보장
    const newItem = returnItem(card.dataset.img, card.dataset.name);
    changeToItem(selectedPlusItem, newItem);
    selectedPlusItem = null;
    if (selectedItem) selectedItem.classList.remove("selected");
    selectedItem = newItem;
    newItem.classList.add("selected");
    ensureEmptyQuestAtEnd();
  } else if (card.dataset.category !== "보상" && selectedItem) {
    // 이미 배치된 아이템 선택 상태 → 같은 아이템 클릭 시 +1, 다른 아이템 클릭 시 교체
    if (selectedItem.dataset.img === card.dataset.img) {
      const badge = selectedItem.querySelector(".badge");
      const v = parseInt(badge.textContent, 10);
      if (v < 99) badge.textContent = v + 1;
    } else {
      const newItem = returnItem(card.dataset.img, card.dataset.name, 1);
      selectedItem.classList.remove("selected");
      selectedItem.replaceWith(newItem);
      selectedItem = newItem;
      newItem.classList.add("selected");
    }
  }
});

// ── 검색 ────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  catalog.querySelectorAll("details.category").forEach(cat => {
    let any = false;
    cat.querySelectorAll(".item-card").forEach(card => {
      const match = !q || card.dataset.name.toLowerCase().includes(q);
      card.style.display = match ? "" : "none";
      if (match) any = true;
    });
    cat.style.display = any ? "" : "none";
    if (q && any) cat.open = true;
  });
});

// ── copy ────────────────────────────────────────────────
copyBtn.addEventListener("click", () => {
  const floor = floorInput.value;
  const type  = typeSelect.value;
  const header = (floor || type) ? `${floor ? floor + "층" : ""} ${type}`.trim() : "";

  const quests = [...questList.querySelectorAll(".quest-item")];
  const lines = quests.map((quest, i) => {
    const items = [...quest.querySelectorAll(".quest-top .item")];
    if (items.length === 0) return null;

    const itemText = items.map(item => {
      const name  = item.querySelector("img").alt;
      const count = item.querySelector(".badge").textContent;
      return `${name} ${count}개`;
    }).join(", ");

    const rewardText = [...quest.querySelectorAll(".quest-rewards .reward-filled")]
      .map(r => `${r.querySelector("img").alt} ${r.querySelector(".badge").value}개`)
      .join(" ");

    return `${i + 1}. ${itemText}${rewardText ? " / " + rewardText : ""}`;
  }).filter(Boolean);

  if (lines.length === 0) { alert("복사할 퀘스트가 없습니다."); return; }

  const text = (header ? header + "\n" : "") + lines.join("\n");

  const onSuccess = () => {
    const orig = copyBtn.textContent;
    copyBtn.textContent = "복사됨 ✓";
    setTimeout(() => { copyBtn.textContent = orig; }, 1500);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
  } else {
    fallbackCopy(text, onSuccess);
  }
});

function fallbackCopy(text, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  onSuccess();
}

// ── 임시저장 ────────────────────────────────────────────
const SAVE_KEY = "quest_helper_saves";

function getSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); }
  catch { return []; }
}

function setSaves(saves) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

function getCurrentState() {
  const quests = [...questList.querySelectorAll(".quest-item")].map(quest => {
    const slots = [...quest.querySelectorAll(".quest-top > .item, .quest-top > .plus-item")].map(slot => {
      if (slot.classList.contains("plus-item")) return null;
      return {
        img:   slot.dataset.img,
        name:  slot.querySelector("img").alt,
        count: parseInt(slot.querySelector(".badge").textContent) || 1,
      };
    });
    const rewards = [...quest.querySelectorAll(".quest-rewards .reward-filled")].map(r => ({
      img:   r.dataset.img,
      name:  r.querySelector("img").alt,
      count: parseInt(r.querySelector(".badge").value) || 1,
    }));
    return { slots, rewards };
  }).filter(quest => quest.slots.some(Boolean)); // 빈 퀘스트 제외

  return {
    floor:  floorInput.value,
    type:   typeSelect.value,
    quests,
    savedAt: Date.now(),
  };
}

function restoreState(state) {
  floorInput.value = state.floor || "";
  typeSelect.value = state.type  || "";
  questList.innerHTML = "";

  (state.quests || []).forEach(qData => {
    const questEl = returnQuest();
    const slots = [...questEl.querySelectorAll(".quest-top > .plus-item")];
    (qData.slots || []).forEach((slotData, i) => {
      if (slotData && slots[i]) {
        slots[i].replaceWith(returnItem(slotData.img, slotData.name, slotData.count));
      }
    });
    const rewardsEl = questEl.querySelector(".quest-rewards");
    rewardsEl.innerHTML = "";
    (Array.isArray(qData.rewards) ? qData.rewards : []).forEach(r => {
      if (r?.img) rewardsEl.appendChild(returnRewardItem(r.img, r.name, r.count));
    });
    rewardsEl.appendChild(returnPlusReward());
    questList.appendChild(questEl);
  });

  questList.appendChild(returnQuest()); // 빈 퀘스트 자동 추가
}

function updateLoadsBtn() {
  const n = getSaves().length;
  loadsBtn.textContent = `임시 ${n}`;
  loadsBtn.style.display = n > 0 ? "" : "none";
}

saveBtn.addEventListener("click", () => {
  const state = getCurrentState();
  if (state.quests.length === 0) { alert("저장할 퀘스트가 없습니다."); return; }

  const title = [
    state.floor ? state.floor + "층" : "",
    state.type  || "",
    new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
  ].filter(Boolean).join(" ");

  const saves = getSaves();
  saves.push({ ...state, title });
  setSaves(saves);
  updateLoadsBtn();

  const orig = saveBtn.textContent;
  saveBtn.textContent = "저장됨 ✓";
  setTimeout(() => { saveBtn.textContent = orig; }, 1500);
});

loadsBtn.addEventListener("click", () => {
  renderSaveList();
  saveModal.style.display = "flex";
});

modalClose.addEventListener("click", () => { saveModal.style.display = "none"; });
saveModal.addEventListener("click", (e) => {
  if (e.target === saveModal) saveModal.style.display = "none";
});

// ── 등록 ─────────────────────────────────────────────────
registerBtn.addEventListener('click', async () => {
  const state = getCurrentState();
  if (state.quests.length === 0) { alert('등록할 퀘스트가 없습니다.'); return; }

  const author = getUsername() || me?.email || '익명';

  let status = statusSelect.value;
  if (!isAdmin()) {
    const hasMore = await showConfirm('모든 퀘스트 작성을 완료했나요?\n\n예 → 검토 요청\n아니오 → 작성 중');
    status = hasMore ? 'review' : 'draft';
  }

  const payload = {
    author,
    authorId: me?.id,
    floor:  state.floor,
    type:   state.type,
    quests: state.quests,
    status,
  };

  if (editId) {
    await fetch(`/api/posts/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  location.href = 'board.html';
});

function renderSaveList() {
  const saves = getSaves();
  saveList.innerHTML = "";
  if (saves.length === 0) {
    saveList.innerHTML = "<li class='save-empty'>저장된 항목이 없습니다.</li>";
    return;
  }
  saves.forEach((save, i) => {
    const li = document.createElement("li");
    li.className = "save-entry";

    const title = document.createElement("span");
    title.className = "save-title";
    title.textContent = save.title || "저장 " + (i + 1);

    const loadBtn = document.createElement("button");
    loadBtn.className = "save-load";
    loadBtn.textContent = "불러오기";
    loadBtn.addEventListener("click", () => {
      restoreState(save);
      saveModal.style.display = "none";
    });

    const delBtn = document.createElement("button");
    delBtn.className = "save-del";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      const arr = getSaves();
      arr.splice(i, 1);
      setSaves(arr);
      updateLoadsBtn();
      renderSaveList();
    });

    li.appendChild(title);
    li.appendChild(loadBtn);
    li.appendChild(delBtn);
    saveList.appendChild(li);
  });
}
