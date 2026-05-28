export async function returnData() {
  try {
    const res = await fetch('/data');
    const data = JSON.parse(await res.text());
    return data.categories;
  } catch (err) {
    console.error('Error fetching data:', err);
    return null;
  }
}

export function renderCategories(categories, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  for (const [categoryName, items] of Object.entries(categories)) {
    const details = document.createElement("details");
    details.className = "category";
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = categoryName;
    details.appendChild(summary);

    const ul = document.createElement("ul");
    ul.className = "item-grid";

    items.forEach(item => {
      const li = document.createElement("li");
      li.className = "item-card";
      li.dataset.img = item.img;
      li.dataset.name = item.description;
      li.dataset.category = categoryName;

      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.description;
      img.className = "item-image";
      img.title = item.description;

      li.appendChild(img);

      if (item.quickQty) {
        li.classList.add("quick-qty-card");
        const btnRow = document.createElement("div");
        btnRow.className = "reward-qty-btns";
        [5, 10, 15, 30].forEach(qty => {
          const btn = document.createElement("button");
          btn.className = "reward-qty-btn";
          btn.textContent = qty;
          btn.dataset.img = item.img;
          btn.dataset.name = item.description;
          btn.dataset.count = qty;
          btnRow.appendChild(btn);
        });
        li.appendChild(btnRow);
      }

      ul.appendChild(li);
    });

    details.appendChild(ul);
    container.appendChild(details);
  }
}

export function returnPlusReward() {
  const div = document.createElement("div");
  div.className = "plus-reward";
  div.textContent = "+";
  return div;
}

export function returnRewardItem(img, name, count = 1) {
  const wrap = document.createElement("div");
  wrap.className = "reward-filled";
  wrap.dataset.img = img;

  const thumb = document.createElement("div");
  thumb.className = "reward-thumb";

  const imgEl = document.createElement("img");
  imgEl.src = img;
  imgEl.alt = name;
  imgEl.title = name;

  const badge = document.createElement("input");
  badge.type = "number";
  badge.className = "badge";
  badge.value = count;
  badge.min = 1;
  badge.max = 99;
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && badge.value === "1") {
      e.preventDefault();
      const parent = wrap.parentElement;
      wrap.remove();
      if (parent && !parent.querySelector(".plus-reward")) {
        parent.appendChild(returnPlusReward());
      }
    }
  });
  badge.addEventListener("input", () => {
    if (parseInt(badge.value, 10) > 99) badge.value = 99;
  });
  badge.addEventListener("blur", () => {
    const v = parseInt(badge.value, 10);
    if (!badge.value || isNaN(v) || v < 1) badge.value = 1;
  });

  thumb.appendChild(imgEl);
  thumb.appendChild(badge);

  const controls = document.createElement("div");
  controls.className = "controls";

  const minus = document.createElement("button");
  minus.textContent = "-";
  minus.addEventListener("click", () => {
    const v = parseInt(badge.value, 10);
    if (v > 1) badge.value = v - 1;
    else {
      const parent = wrap.parentElement;
      wrap.remove();
      if (parent && !parent.querySelector(".plus-reward")) {
        parent.appendChild(returnPlusReward());
      }
    }
  });

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.addEventListener("click", () => {
    const v = parseInt(badge.value, 10);
    if (v < 99) badge.value = v + 1;
  });

  controls.appendChild(minus);
  controls.appendChild(plus);
  wrap.appendChild(thumb);
  wrap.appendChild(controls);
  return wrap;
}

export function returnPlusItem() {
  const plusItem = document.createElement("div");
  plusItem.className = "plus-item";
  plusItem.textContent = "+";
  return plusItem;
}


export function returnQuest() {
  const li = document.createElement("li");
  li.className = "quest-item";
  li.draggable = true;

  // 상단 행: 핸들 + 슬롯 2개 + 삭제
  const top = document.createElement("div");
  top.className = "quest-top";

  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.setAttribute("aria-hidden", "true");

  const delBtn = document.createElement("button");
  delBtn.className = "quest-delete";
  delBtn.textContent = "🗑";

  top.appendChild(handle);
  top.appendChild(returnPlusItem());
  top.appendChild(returnPlusItem());
  top.appendChild(delBtn);

  // 하단 행: 보상 슬롯
  const rewards = document.createElement("div");
  rewards.className = "quest-rewards";
  rewards.appendChild(returnPlusReward());

  li.appendChild(top);
  li.appendChild(rewards);

  return li;
}

export function returnItem(itemPath, itemName, count = 1) {
  const item = document.createElement("div");
  item.className = "item";
  item.dataset.img = itemPath;

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.src = itemPath;
  img.alt = itemName;
  img.title = itemName;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = count;

  thumb.appendChild(img);
  thumb.appendChild(badge);

  const controls = document.createElement("div");
  controls.className = "controls";

  const minus = document.createElement("button");
  minus.className = "minus";
  minus.textContent = "-";
  minus.addEventListener("click", () => {
    let v = parseInt(badge.textContent, 10);
    if (v > 1) badge.textContent = v - 1;
    else item.replaceWith(returnPlusItem());
  });

  const plus = document.createElement("button");
  plus.className = "plus";
  plus.textContent = "+";
  plus.addEventListener("click", () => {
    let v = parseInt(badge.textContent, 10);
    if (v < 99) badge.textContent = v + 1;
  });

  controls.appendChild(minus);
  controls.appendChild(plus);
  item.appendChild(thumb);
  item.appendChild(controls);

  return item;
}

export function returnPlusQuest() {
  const plusQuest = document.createElement("li");
  plusQuest.className = "plus-quest";
  plusQuest.textContent = "+";
  return plusQuest;
}

export function changeToItem(selectedPlusItem, newItem) {
  if (selectedPlusItem) selectedPlusItem.replaceWith(newItem);
}
