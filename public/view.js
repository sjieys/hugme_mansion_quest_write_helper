import {
  returnData, returnPlusItem, returnQuest,
  returnItem, renderCategories, returnPlusQuest} from './utils.js';

// 상단 작업바
const mainBtn = document.getElementById("btn-main");
const editBtn = document.getElementById("btn-edit");
const copyBtn = document.getElementById("btn-copy");

// selectedPlusItem
let selectedPlusItem = null;

// json 불러오기
const data = await returnData();

// 이미지 렌더링
const catalog = document.getElementById("catalog");
renderCategories(data, catalog.id);

// testQuest로 +- 버튼 test
const testQuest = returnQuest();
document.getElementById("quest-item-list").appendChild(testQuest);
document.getElementById("quest-item-list").appendChild(returnQuest());
const plusQuest = returnPlusQuest();
document.getElementById("quest-item-list").appendChild(plusQuest);

// TODO: 사이드바 폭 때문에 휴지통이 밑으로 내려감
//  사이드바 폭도 늘리고, plusItem, 휴지통의 폭을 40,40,20으로 해야할 듯



// TODO: plusItem에서 클릭 이벤트 발생 시,
// selectedPlusItem 변수에 저장
// selctedPlusItem의 css바꾸기(좀 더 진하게 칠해지기) 되나?
// document.querySelectorAll(".plus-item").forEach(plusItem => {
//   plusItem.addEventListener("click", () => {
//     selectedPlusItem = plusItem;
//     // document.querySelectorAll(".plus-item").forEach(item => {
//     //   item.style.backgroundColor = "#f0f0f0";
//     // });
//     alert("이제 이미지 목록에서 아이템을 선택하세요!");
//   });
// });
document.getElementById("quest-item-list").addEventListener("click", (event) => {
  if (event.target.classList.contains("plus-item")) {
    selectedPlusItem = event.target;
    alert("이제 이미지 목록에서 아이템을 선택하세요!");
  }
});

// TODO: 이미지쪽에서 클릭 이벤트 발생 시,
// newItem이라는 객체를 만들어서 changeToItem 함수에 넘겨줘야 함
document.getElementById("categories").addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if(!card) return; // item-card가 아닌 곳 클릭 시 무시
  alert(`item: ${card}`);
});

// document.getElementById("categories").addEventListener("click", (event) => {
//   alert("클릭은 됨");
// });

const questList = document.getElementById("quest-item-list");

questList.addEventListener("click", (event) => {
  if (event.target.classList.contains("plus-quest")) {
    questList.appendChild(returnPlusQuest());
  }
});
