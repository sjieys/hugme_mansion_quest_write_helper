

export async function returnData() {
  try {
    const url = 'http://localhost:3000/data';
    const res = await fetch(url);
    const raw = await res.text();
    // console.log("raw:", raw);

    const data = JSON.parse(raw);
    // console.log("json:", data);

    return data.categories;
  } catch (err) {
    console.error('Error fetching data:', err);
    return null;
  }
}


export function renderCategories(categories, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // 초기화
  container.className = "categories";

  for (const [categoryName, items] of Object.entries(categories)) {
    const details = document.createElement("details");
    details.className = "category";

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

      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.name;
      img.className = "item-image";
      img.title = item.description;

      li.appendChild(img);
      ul.appendChild(li);
    });

    details.appendChild(ul);
    container.appendChild(details);
  }
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

  const handle = document.createElement("div");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.setAttribute("aria-hidden", "true");

  const delBtn = document.createElement("button");
  delBtn.className = "quest-delete";
  delBtn.textContent = "🗑";

  li.appendChild(handle);
  li.appendChild(returnPlusItem());
  li.appendChild(returnPlusItem());
  li.appendChild(delBtn);

  return li;
}


// 일반 아이템 카드
export function returnItem(itemPath, itemName, count = 1) {
  const item = document.createElement("div");
  item.className = "item";

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

  // 컨트롤 버튼
  const controls = document.createElement("div");
  controls.className = "controls";

  const minus = document.createElement("button");
  minus.className = "minus";
  minus.textContent = "-";
  minus.addEventListener("click", () => {
    let value = parseInt(badge.textContent, 10);
    if(value > 1) {badge.textContent = value - 1;}
    else { const plusItem = returnPlusItem(); item.replaceWith(plusItem); }
  });

  const plus = document.createElement("button");
  plus.className = "plus";
  plus.textContent = "+";
  plus.addEventListener("click", () => {
    let value = parseInt(badge.textContent, 10);
    if(value < 20){ badge.textContent = value + 1;}
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


// TODO: 이미지쪽에서 클릭 이벤트 발생 시,
// newItem이라는 객체를 만들어줘야 함
// plus-item 에서 item으로 바꿔주는 함수
export function changeToItem(selectedPlusItem, newItem) {
  if(selectedPlusItem) {
    selectedPlusItem.replaceWith(newItem);
  }
}

export function changeToPlusItem(selectedItem) {
  if(selectedItem) {
    const plusItem = returnPlusItem();
    selectedItem.replaceWith(plusItem);
  }
}
