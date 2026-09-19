-----------------------mask.js
//  Web3.js 로드
const web3Script = document.createElement("script");
web3Script.src = "https://cdn.jsdelivr.net/npm/web3@1.10.0/dist/web3.min.js";
document.head.appendChild(web3Script);

// 스타일 정의
const style = document.createElement("style");
style.textContent = `
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f0f4f8;
    color: #143D60;
  }

  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 25px;
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
  }

  .navbar .logo {
    font-weight: bold;
    font-size: 1.2rem;
    color: #111827;
    cursor: pointer;
  }

  .navbar .nav-menu {
    display: flex;
    gap: 20px;
    margin-right: 75px;
  }

  .navbar .nav-menu a {
    text-decoration: none;
    color: #374151;
  }

  .navbar .lang {
    font-size: 0.9rem;
    color: #6b7280;
    cursor: pointer;
  }

  .container {
    max-width: 600px;
    margin: 60px auto;
    background-color: #fff;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
  }

  h1 {
    font-size: 1.6rem;
    margin-bottom: 20px;
  }

  button {
    padding: 10px 18px;
    border: none;
    border-radius: 5px;
    font-size: 1rem;
    font-weight: bold;
    color: white;
    cursor: pointer;
  }

  #connectBtn {
    background-color: #3b82f6;
  }

  #disconnectBtn {
    background-color: #e67e22;
    margin-left: 8px;
  }

  #rewardBtn {
    background-color: #16a34a;
    margin-top: 10px;
  }

  #wallet, #balance, #uploadStatus, #rewardStatus {
    margin-top: 15px;
    font-weight: 600;
    color: #111827;
  }

  .warning-box {
    display: none;
    background-color: #fff4e5;
    border: 1px solid #ffa726;
    border-radius: 6px;
    padding: 15px;
    color: #bf360c;
    margin-top: 20px;
    font-weight: 600;
  }

  .warning-box a {
    color: #d84315;
    text-decoration: underline;
  }

  footer {
    text-align: center;
    padding: 20px;
    font-size: 0.9rem;
    color: #6b7280;
    background-color: #f9fafb;
    margin-top: 40px;
    border-top: 1px solid #e5e7eb;
  }
`;
document.head.appendChild(style);

// HTML 구조를 JS로 생성
document.body.innerHTML = `
<nav class="navbar">
  <div class="logo" onclick="location.href='home.html'">Chain LAB</div>
  <div class="nav-menu">
    <a href="introduce.html">소개</a>
    <a href="data.html">자료</a>
    <a href="develop.html">개발</a>
    <a href="faq.html">Q&A</a>
  </div>
  <div class="lang">언어</div>
</nav>

<div class="container">
  <h1>MetaMask 연결</h1>

  <button id="connectBtn">연결</button>
  <button id="disconnectBtn">해제</button>

  <p id="wallet">지갑: 연결 안 됨</p>
  <p id="balance">현재 잔액: -</p>

  <h3>봉사활동 인증서 업로드</h3>
  <input type="file" id="pdfUpload" accept="application/pdf">
  <p id="uploadStatus"></p>

  <button id="rewardBtn">코인 지급</button>
  <p id="rewardStatus"></p>

  <div id="warningBox" class="warning-box">
    ⚠️ MetaMask가 설치되어 있지 않습니다.<br>
    블록체인 기능을 사용하려면 MetaMask 확장 프로그램을 설치하세요.<br>
    <a href="https://metamask.io/download/" target="_blank">MetaMask 설치하기</a>
  </div>
</div>

<footer>© 2025 Chain LAB</footer>
`;

// MetaMask 기능 로직
let web3, account;

// DOM 요소
const walletDisplay = document.getElementById("wallet");
const warningBox = document.getElementById("warningBox");

function showWarning() {
  warningBox.style.display = "block";
}

function hideWarning() {
  warningBox.style.display = "none";
}

async function showBalance() {
  if (!web3 || !account) return;
  try {
    const balanceWei = await web3.eth.getBalance(account);
    const balanceEth = web3.utils.fromWei(balanceWei, "ether");
    document.getElementById("balance").innerText = `현재 잔액: ${balanceEth} ETH`;
  } catch (error) {
    console.error("잔액 조회 실패:", error);
  }
}

function setupEventListeners() {
  window.ethereum.on("accountsChanged", (accs) => {
    account = accs[0] || null;
    walletDisplay.innerText = account ? "지갑: " + account : "지갑: 연결 안 됨";
    if (account) showBalance();
  });

  window.ethereum.on("chainChanged", () => {
    console.log("네트워크 변경 감지됨");
  });
}

async function connect() {
  if (!window.ethereum) {
    showWarning();
    return;
  }

  hideWarning();

  try {
    web3 = new Web3(window.ethereum);
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    account = accounts[0];
    walletDisplay.innerText = "지갑: " + account;
    await showBalance();

    if (!window.ethereum.listeners("accountsChanged").length) {
      setupEventListeners();
    }
  } catch (error) {
    console.error("MetaMask 연결 오류:", error);
    walletDisplay.innerText = "지갑: 연결 실패";
  }
}

function disconnect() {
  account = null;
  web3 = null;
  walletDisplay.innerText = "지갑: 연결 안 됨";
  document.getElementById("balance").innerText = "현재 잔액: -";
  hideWarning();
  alert("✅ MetaMask 연결 해제됨");
}

// PDF 업로드 이벤트
document.addEventListener("change", (e) => {
  if (e.target.id === "pdfUpload") {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      document.getElementById("uploadStatus").innerText =
        "❌ PDF 파일만 업로드 가능합니다.";
      return;
    }

    document.getElementById("uploadStatus").innerText = `✅ ${file.name} 업로드 완료`;
  }
});

// 코인 지급 (시뮬레이션)
document.addEventListener("click", (e) => {
  if (e.target.id === "rewardBtn") {
    if (!account) {
      alert("⚠️ 먼저 MetaMask를 연결하세요.");
      return;
    }

    const uploaded = document.getElementById("pdfUpload").files.length > 0;
    if (!uploaded) {
      alert("📄 먼저 PDF를 업로드하세요.");
      return;
    }

    document.getElementById("rewardStatus").innerText =
      "✅ PDF 확인 완료, 코인 지급 처리 중...";
    console.log("코인 지급 로직 실행 (시뮬레이션)");
  }

  if (e.target.id === "connectBtn") connect();
  if (e.target.id === "disconnectBtn") disconnect();
});

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  if (window.ethereum) hideWarning();
});
