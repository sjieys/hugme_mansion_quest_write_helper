import {
  returnData, returnPlusItem, returnQuest,
  returnItem, renderCategories, returnPlusQuest, changeToItem
} from './utils.js';

const questList = document.getElementById("quest-item-list");
const catalog = document.getElementById("catalog");
const copyBtn = document.getElementById("btn-copy");

let selectedPlusItem = null;

// json 불러오기 & 카탈로그 렌더링
const data = await returnData();
renderCategories(data, catalog.id);

// 퀘스트 목록 초기화: + 버튼 하나만
const plusQuestBtn = returnPlusQuest();
questList.appendChild(plusQuestBtn);

// 퀘스트 목록 클릭 (위임)
questList.addEventListener("click", (event) => {
  // + 퀘스트 버튼 클릭 → 새 퀘스트 카드로 교체 후 새 + 버튼 추가
  const plusQuest = event.target.closest(".plus-quest");
  if (plusQuest) {
    const newQuest = returnQuest();
    questList.replaceChild(newQuest, plusQuest);
    questList.appendChild(returnPlusQuest());
    return;
  }

  // 삭제 버튼
  const delBtn = event.target.closest(".quest-delete");
  if (delBtn) {
    delBtn.closest(".quest-item").remove();
    return;
  }

  // + 아이템 슬롯 클릭 → 선택/해제 토글
  const plusItem = event.target.closest(".plus-item");
  if (plusItem) {
    if (selectedPlusItem) selectedPlusItem.classList.remove("selected");
    if (selectedPlusItem === plusItem) {
      selectedPlusItem = null;
    } else {
      selectedPlusItem = plusItem;
      selectedPlusItem.classList.add("selected");
    }
    return;
  }
});

// 드래그 앤 드롭 순서 변경
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
  if (event.clientY < top + height / 2) {
    item.classList.add("drop-before");
  } else {
    item.classList.add("drop-after");
  }
});

questList.addEventListener("dragleave", (event) => {
  if (!questList.contains(event.relatedTarget)) clearDropIndicators();
});

questList.addEventListener("drop", (event) => {
  event.preventDefault();
  const item = event.target.closest(".quest-item");
  if (!item || !draggedQuest || item === draggedQuest) return;
  const { top, height } = item.getBoundingClientRect();
  if (event.clientY < top + height / 2) {
    questList.insertBefore(draggedQuest, item);
  } else {
    questList.insertBefore(draggedQuest, item.nextSibling);
  }
  clearDropIndicators();
});

// copy 버튼: 퀘스트 목록을 텍스트로 클립보드에 복사
copyBtn.addEventListener("click", () => {
  const quests = [...questList.querySelectorAll(".quest-item")];
  const lines = quests.map((quest, i) => {
    const items = [...quest.querySelectorAll(".item")];
    if (items.length === 0) return null;
    const parts = items.map(item => {
      const name = item.querySelector("img").alt;
      const count = item.querySelector(".badge").textContent;
      return `${name} ${count}개`;
    });
    return `${i + 1}. ${parts.join(", ")}`;
  }).filter(Boolean);

  if (lines.length === 0) {
    alert("복사할 퀘스트가 없습니다.");
    return;
  }

  const text = lines.join("\n");

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

// 카탈로그 클릭: 선택된 슬롯이 있으면 아이템으로 채우기
catalog.addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;

  if (selectedPlusItem) {
    const newItem = returnItem(
      card.dataset.img,
      card.dataset.name
    );
    changeToItem(selectedPlusItem, newItem);
    selectedPlusItem = null;
  }
});
