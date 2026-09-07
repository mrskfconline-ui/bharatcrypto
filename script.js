// =============================================
// BharatCrypto - Investment Platform Engine
// =============================================

// ---------- DATA STORE (localStorage) ----------
const DB_KEY = 'bharatcrypto_db';

function getDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
    return {
        users: {},       // email -> { name, email, password, balance, bonus, investments, profitTotal, joined }
        tradingLogs: [],
        payouts: [],
        tradeCount: 0
    };
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ---------- SESSION ----------
let currentUser = null; // email of logged-in user

function getCurrentUserData() {
    if (!currentUser) return null;
    const db = getDB();
    return db.users[currentUser] || null;
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    populateTicker();
    populatePlans();
    generatePayouts();
    startTradingSimulation();
    checkSession();
    updateHeroCounters();

    // Live preview on amount input
    const amountInput = document.getElementById('investAmount');
    if (amountInput) {
        amountInput.addEventListener('input', updateProfitPreview);
    }

    // Enter key for login
    document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') login();
    });
    document.getElementById('signupConfirm')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') signup();
    });
});

// ---------- SESSION CHECK ----------
function checkSession() {
    const saved = localStorage.getItem('bharatcrypto_session');
    if (saved) {
        const db = getDB();
        if (db.users[saved]) {
            currentUser = saved;
            updateUIForLoggedIn();
        } else {
            localStorage.removeItem('bharatcrypto_session');
        }
    }
}

function updateUIForLoggedIn() {
    const user = getCurrentUserData();
    if (!user) return;

    document.getElementById('navAuthBtn').innerHTML = '<i class="fas fa-user-circle"></i> ' + user.name.split(' ')[0];
    document.getElementById('navAuthBtn').onclick = showDashboardMenu;

    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('totalBalance').textContent = '$' + formatMoney(user.balance);
    document.getElementById('totalProfit').textContent = '$' + formatMoney(user.profitTotal || 0);
    document.getElementById('bonusBalance').textContent = '$' + formatMoney(user.bonus || 0);
    document.getElementById('activeInvestment').textContent = '$' + formatMoney(user.investments.reduce((s, i) => s + i.amount, 0));

    document.getElementById('investBtn').textContent = 'Invest Now';
    document.getElementById('investBtn').disabled = false;
}

function updateUIForLoggedOut() {
    document.getElementById('navAuthBtn').innerHTML = 'Sign In';
    document.getElementById('navAuthBtn').onclick = showAuthModal;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('totalBalance').textContent = '$0.00';
    document.getElementById('totalProfit').textContent = '$0.00';
    document.getElementById('bonusBalance').textContent = '$0.00';
    document.getElementById('activeInvestment').textContent = '$0.00';
}

// ---------- AUTH ----------
function showAuthModal() {
    document.getElementById('authModal').classList.add('active');
    switchTab('login');
    clearErrors();
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    clearErrors();
}

function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        loginTab.style.display = 'block';
        signupTab.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginTab.style.display = 'none';
        signupTab.style.display = 'block';
        tabs[1].classList.add('active');
    }
    clearErrors();
}

function clearErrors() {
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
    document.getElementById('transferError').textContent = '';
}

function signup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const errEl = document.getElementById('signupError');

    // Validation
    if (!name || !email || !password || !confirm) {
        errEl.textContent = 'Please fill all fields.';
        return;
    }
    if (name.length < 3) {
        errEl.textContent = 'Name must be at least 3 characters.';
        return;
    }
    if (!isValidEmail(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        return;
    }
    if (password.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (password !== confirm) {
        errEl.textContent = 'Passwords do not match!';
        return;
    }

    const db = getDB();

    // Check if user already exists
    if (db.users[email]) {
        errEl.textContent = 'An account with this email already exists. Please sign in.';
        return;
    }

    // Create user with $100 signup bonus
    db.users[email] = {
        name: name,
        email: email,
        password: password,
        balance: 100,         // $100 free bonus
        bonus: 100,
        investments: [],
        profitTotal: 0,
        joined: new Date().toISOString(),
        totalDeposited: 0,
        bonusClaimed: true
    };

    saveDB(db);

    // Auto login
    currentUser = email;
    localStorage.setItem('bharatcrypto_session', email);

    showToast('success', '🎉 Account created! $100 bonus credited to your account.');
    closeAuthModal();
    updateUIForLoggedIn();

    // Add signup payout record
    addPayout(name, 100, 'Signup Bonus');
}

function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');

    if (!email || !password) {
        errEl.textContent = 'Please enter email and password.';
        return;
    }

    const db = getDB();
    const user = db.users[email];

    // Must exist AND password must match exactly
    if (!user) {
        errEl.textContent = 'No account found with this email. Please sign up first.';
        return;
    }

    if (user.password !== password) {
        errEl.textContent = 'Incorrect password. Please try again.';
        return;
    }

    // Successful login
    currentUser = email;
    localStorage.setItem('bharatcrypto_session', email);

    showToast('success', '✅ Welcome back, ' + user.name.split(' ')[0] + '!');
    closeAuthModal();
    updateUIForLoggedIn();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('bharatcrypto_session');
    updateUIForLoggedOut();
    showToast('info', '👋 You have been logged out.');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- INVESTMENT ----------
function setAmount(amount) {
    document.getElementById('investAmount').value = amount;
    updateProfitPreview();
    // Highlight active preset
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function updateProfitPreview() {
    const amount = parseFloat(document.getElementById('investAmount').value) || 0;
    const dailyProfit = amount * 0.10;
    document.getElementById('dailyProfit').textContent = '$' + formatMoney(dailyProfit);
    document.getElementById('weeklyProfit').textContent = '$' + formatMoney(dailyProfit * 7);
    document.getElementById('monthlyProfit').textContent = '$' + formatMoney(dailyProfit * 30);
}

function makeInvestment() {
    if (!currentUser) {
        showToast('error', 'Please sign in first to invest.');
        showAuthModal();
        return;
    }

    const amount = parseFloat(document.getElementById('investAmount').value);

    if (isNaN(amount) || amount < 1000) {
        showToast('error', 'Minimum investment is $1,000 USD.');
        return;
    }
    if (amount > 25000) {
        showToast('error', 'Maximum investment is $25,000 USD.');
        return;
    }

    const db = getDB();
    const user = db.users[currentUser];

    // Check if user has enough balance
    if (user.balance < amount) {
        showToast('error', 'Insufficient balance! You have $' + formatMoney(user.balance) + '. Please add funds.');
        return;
    }

    // Deduct balance and create investment
    user.balance -= amount;
    const investment = {
        id: 'INV-' + Date.now(),
        amount: amount,
        dailyProfit: amount * 0.10,
        startDate: new Date().toISOString(),
        totalEarned: 0,
        lastPayout: new Date().toISOString(),
        active: true
    };
    user.investments.push(investment);
    user.totalDeposited = (user.totalDeposited || 0) + amount;

    saveDB(db);

    showToast('success', '🚀 Investment of $' + formatMoney(amount) + ' activated! Earning 10% daily profit.');
    addTradingLog('BUY', 'BTC/USDT', amount, 'Investment Activated');
    addPayout(user.name, amount, 'Investment');
    updateUIForLoggedIn();
    document.getElementById('investAmount').value = '';
    updateProfitPreview();
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

// ---------- TRANSFER ----------
function showTransferModal() {
    if (!currentUser) {
        showToast('error', 'Please sign in first.');
        showAuthModal();
        return;
    }
    document.getElementById('transferModal').classList.add('active');
}

function closeTransferModal() {
    document.getElementById('transferModal').classList.remove('active');
    document.getElementById('transferError').textContent = '';
}

function transferFunds() {
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const wallet = document.getElementById('transferWallet').value.trim();
    const errEl = document.getElementById('transferError');

    if (isNaN(amount) || amount < 500) {
        errEl.textContent = 'Minimum transfer amount is $500 USD.';
        return;
    }

    if (!wallet || wallet.length < 10) {
       