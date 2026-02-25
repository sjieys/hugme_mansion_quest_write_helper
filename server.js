// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// 라우트
app.get("/", (req, res) => {
  res.send("서버 잘 돌아간다!");
});

// JSON 불러오기
const data = require("./assets/items.json");
app.get('/data', (req, res) => {
  const data = require("./assets/items.json");
  // console.log(`===========server코드========`);
  // console.log(data.categories);
  res.json(data);
});

// const quest = require("./assets/quest.json");
// app.get("/quest", (req, res) => {
//   res.json(quest);
// });

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 http://localhost:${PORT}`);
});
