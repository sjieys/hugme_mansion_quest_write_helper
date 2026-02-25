

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

      const img = document.createElement("img");
      img.src = item.img;
      console.log(item.img);
      img.alt = item.name;
      img.className = "item-image";
      img.title = item.description; // 마우스 오버 시 설명 표시

      const spanName = document.createElement("span");
      spanName.className = "name";
      // spanName.textContent = item.name;

      const spanDesc = document.createElement("span");
      spanDesc.className = "desc";
      // spanDesc.textContent = item.description;

      li.appendChild(img);
      li.appendChild(spanName);
      li.appendChild(spanDesc);
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

  // TODO: 이 부분은 나중에 .plus-item 한테 클릭 되면 let 변수에
  // 저장해서 이미지 클릭을 받게 되면 해당 이미지로 채워지게 할 예정
  plusItem.addEventListener("click", () => {
    // 클릭 시 실제 아이템으로 교체
    const newItem = returnItem("../assets/images/null.gif", "샘플아이템");
    plusItem.replaceWith(newItem);
  });

  return plusItem;
}

export function returnQuest() {
  const li = document.createElement("li");
  li.className = "quest-item";
  // NOTE: 이거 굳이 필요한가? 
  // 아이템 컨테이너 
  // const items = document.createElement("div");
  // items.className = "items";

  
  // 휴지통 버튼
  const delBtn = document.createElement("button");
  delBtn.className = "quest-delete";
  delBtn.textContent = "🗑";
  delBtn.addEventListener("click", () => {
    li.remove();
  });
  
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

  plusQuest.addEventListener("click", () => {
    // 클릭 시 plus-item 2개로 교체
    plusQuest.replaceWith(returnQuest());
  });

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
