import express from "express";
import multer from "multer";
import cors from "cors";
import Web3 from "web3";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// === Web3 연결 ===
const web3 = new Web3("HTTP://127.0.0.1:7545"); // Ganache RPC 주소
const contractAddress = "0xC7EB61122d38449dAE998A6E9ACacaacb7006D7a";
const contractABI = [/* TimeCoin ABI 복사 */];
const timeCoin = new web3.eth.Contract(contractABI, contractAddress);
const admin = "0x관리자_계정주소"; // Ganache 계정 중 하나

// === PDF 업로드 ===
app.post("/upload", upload.single("file"), (req, res) => {
  console.log("📄 업로드됨:", req.file.filename);
  res.json({ success: true, file: req.file.filename });
});

// === 관리자 승인 후 코인 지급 ===
app.post("/approve", async (req, res) => {
  const { userAddress } = req.body;
  try {
    await timeCoin.methods.mint(userAddress, 1).send({ from: admin });
    console.log(`✅ ${userAddress}에게 1 TMC 지급 완료`);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
