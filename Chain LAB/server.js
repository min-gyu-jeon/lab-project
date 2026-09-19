// server.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const upload = multer({ dest: "uploads/" });

// 간단한 DB 역할
const DB_FILE = "db.json";
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

// ✅ PDF 업로드
app.post("/upload", upload.single("file"), (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  const { address } = req.body;

  const record = {
    filename: req.file.filename + ".pdf",
    originalName: req.file.originalname,
    address,
    approved: false
  };

  fs.renameSync(req.file.path, "uploads/" + record.filename);
  db.push(record);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

  res.json({ success: true });
});

// ✅ 관리자용 파일 목록
app.get("/files", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  res.json(db);
});

// ✅ 승인 처리
app.post("/approve", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  const file = db.find(f => f.filename === req.body.filename);
  if (file) file.approved = true;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  res.json({ success: true });
});

// ✅ 거절 처리
app.post("/reject", (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE));
  const index = db.findIndex(f => f.filename === req.body.filename);
  if (index > -1) db.splice(index, 1);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  res.json({ success: true });
});

app.listen(3000, () => console.log("🚀 서버 실행 중: http://localhost:3000"));
