// ✅ 필요한 모듈 불러오기
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 📂 [1] 업로드 설정
// ==========================
const upload = multer({ dest: "uploads/" });
const DATA_FILE = "uploads/data.json";
const PURCHASE_FILE = "uploads/purchases.json";

// 업로드 폴더 없으면 자동 생성
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// 공통 헬퍼 함수
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ==========================
// 📄 [2] 사용자 PDF 업로드 (자동 보상 모델)
// ==========================
// 주소 + 봉사시간(hours) + 지급코인(amount) + txHash까지 JSON에 저장
app.post("/upload", upload.single("file"), (req, res) => {
  const { address, hours, amount, txHash } = req.body;

  if (!req.file || !address) {
    return res.json({ success: false, error: "파일 또는 주소 누락" });
  }

  // ✅ 한글 파일명 깨짐 방지 (latin1 → utf8)
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

  // ✅ 파일 확장자 추출
  const ext = path.extname(originalName);
  const safeBaseName = path.basename(originalName, ext);

  // ✅ 저장될 안전한 파일명
  const safeFileName = `${safeBaseName}_${Date.now()}${ext}`;

  // ✅ 업로드된 임시 파일을 새 이름으로 변경
  const newPath = path.join("uploads", safeFileName);
  fs.renameSync(req.file.path, newPath);

  const record = {
    address,
    filename: safeFileName,
    filepath: `uploads/${safeFileName}`,
    uploadTime: new Date().toLocaleString(),
    hours: hours ? Number(hours) : undefined,
    amount: amount ? Number(amount) : undefined,
    txHash: txHash || null,   // 온체인 트랜잭션 해시
    status: "auto_paid",      // 자동 보상 완료
    approved: true
  };

  const data = readJSON(DATA_FILE, []);
  data.push(record);
  writeJSON(DATA_FILE, data);

  console.log(
    `📄 [UPLOAD] ${address} → ${safeFileName} (${record.hours}h / ${record.amount}TMC)`
  );
  res.json({ success: true, item: record });
});

// ==========================
// 🛒 [3] 상점 구매 기능 + 환불 관련
// ==========================

// ✅ 상점 구매 기록 저장
app.post("/buy", (req, res) => {
  const { address, item, price, quantity } = req.body;
  if (!address || !item) return res.json({ success: false, error: "누락된 정보" });

  const id = Date.now(); // 간단한 고유 ID (ms 단위 타임스탬프)

  const record = {
    id,
    address,
    item,
    price,
    quantity: quantity ? Number(quantity) : 1,
    time: new Date().toLocaleString(),
    status: "completed"  // completed → refund_requested → refunded
  };

  const purchases = readJSON(PURCHASE_FILE, []);
  purchases.push(record);
  writeJSON(PURCHASE_FILE, purchases);

  console.log(`🛍️ [BUY] ${address} → ${item} (${record.price} TMC, qty=${record.quantity}, id=${id})`);
  res.json({ success: true, id });
});

// ✅ (사용자용) 내 구매 내역 불러오기
app.get("/history", (req, res) => {
  const { address } = req.query;
  const data = readJSON(PURCHASE_FILE, []);
  const userHistory = address ? data.filter(r => r.address === address) : [];
  res.set("Cache-Control", "no-store");
  res.json(userHistory);
});

// ✅ (사용자용) 전체 구매내역 삭제 (옵션)
app.post("/clearHistory", (req, res) => {
  const { address } = req.body;
  if (!address) return res.json({ success: false, error: "주소 누락" });

  let data = readJSON(PURCHASE_FILE, []);
  const beforeCount = data.length;
  data = data.filter(r => r.address !== address);
  writeJSON(PURCHASE_FILE, data);

  console.log(`🗑️ [CLEAR HISTORY] ${address} (${beforeCount - data.length}건 삭제)`);
  res.json({ success: true });
});

// ✅ (사용자용) 환불 요청 생성
app.post("/refundRequest", (req, res) => {
  const { address, id } = req.body;
  if (!address || !id) {
    return res.json({ success: false, error: "주소 또는 구매 ID 누락" });
  }

  const data = readJSON(PURCHASE_FILE, []);
  const idx = data.findIndex(r => r.address === address && r.id === id);

  if (idx === -1) {
    return res.json({ success: false, error: "해당 구매 내역을 찾을 수 없음" });
  }

  if (data[idx].status === "refunded") {
    return res.json({ success: false, error: "이미 환불 완료된 내역입니다." });
  }
  if (data[idx].status === "refund_requested") {
    return res.json({ success: false, error: "이미 환불 요청된 내역입니다." });
  }

  data[idx].status = "refund_requested";
  data[idx].refundRequestedAt = new Date().toISOString();
  writeJSON(PURCHASE_FILE, data);

  console.log(`📨 [REFUND REQUEST] id=${id}, address=${address}, item=${data[idx].item}`);
  res.json({ success: true });
});

// ✅ (관리자용) 환불 요청 목록 조회
app.get("/refundRequests", (req, res) => {
  const data = readJSON(PURCHASE_FILE, []);
  const pending = data.filter(r => r.status === "refund_requested");
  res.set("Cache-Control", "no-store");
  res.json(pending);
});

// ✅ (관리자용) 환불 처리 완료 마킹
app.post("/refundDone", (req, res) => {
  const { id, address } = req.body;
  if (!id || !address) {
    return res.json({ success: false, error: "id 또는 address 누락" });
  }

  const data = readJSON(PURCHASE_FILE, []);
  const idx = data.findIndex(r => r.id === id && r.address === address);

  if (idx === -1) {
    return res.json({ success: false, error: "해당 환불 요청을 찾을 수 없음" });
  }

  data[idx].status = "refunded";
  data[idx].refundedAt = new Date().toISOString();
  writeJSON(PURCHASE_FILE, data);

  console.log(`✅ [REFUND DONE] id=${id}, address=${address}, item=${data[idx].item}`);
  res.json({ success: true });
});

// ==========================
// 🧾 [4] 봉사활동 관리자용 기능 (/files 그대로 유지)
// ==========================
app.get("/files", (req, res) => {
  const data = readJSON(DATA_FILE, []);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json(data);
});

// (옵션) 승인/거절 API는 혹시 몰라서 그대로 둠
app.post("/approve", (req, res) => {
  const { filename } = req.body;
  console.log("📩 승인 요청:", filename);

  const data = readJSON(DATA_FILE, []);
  const idx = data.findIndex(f => f.filename === filename);

  if (idx === -1) {
    console.log("❌ 승인 실패: 파일 없음");
    return res.json({ success: false, error: "파일 없음" });
  }

  data[idx].status = "approved";
  data[idx].approved = true;
  data[idx].approvedAt = new Date().toISOString();

  writeJSON(DATA_FILE, data);
  console.log(`✅ [APPROVE] ${filename} 승인됨`);
  res.json({ success: true });
});

app.post("/reject", (req, res) => {
  const { filename } = req.body;
  console.log("📩 거절 요청:", filename);

  let data = readJSON(DATA_FILE, []);
  const beforeLen = data.length;

  data = data.filter(f => f.filename !== filename);

  if (data.length === beforeLen) {
    console.log("❌ 거절 실패: 파일 없음");
    return res.json({ success: false, error: "파일 없음" });
  }

  writeJSON(DATA_FILE, data);
  console.log(`🗑️ [REJECT & DELETE] ${filename} 삭제됨`);
  res.json({ success: true });
});

// ==========================
// 🌐 [5] 정적 파일 제공 (PDF 바로 보기)
// ==========================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      res.set("Cache-Control", "no-store");
      if (path.extname(filePath).toLowerCase() === ".pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
      }
    },
  })
);

// ==========================
// 🚀 [6] 서버 실행
// ==========================
app.listen(3000, () => {
  console.log("✅ Chain LAB 서버 실행 중: http://localhost:3000");
  console.log("📂 업로드 폴더:", path.resolve("uploads"));
});
