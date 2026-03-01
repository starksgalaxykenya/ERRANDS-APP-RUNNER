// Global Variables
let currentUser = null;
let runnerData = {};
let selectedTaskId = null;
let selectedJobId = null;
let unsubscribers = []; // Store real-time listeners

// DOM Elements
const loginPage = document.getElementById('loginPage');
const appContainer = document.getElementById('appContainer');
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const toast = document.getElementById('toast');
const loadingSpinner = document.getElementById('loadingSpinner');
const signUpLink = document.getElementById('signUpLink');

// Initialize the App
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    
    if (!auth) {
        showLoginError('Firebase not initialized. Please refresh the page.');
        return;
    }
    
    // Check authentication state
    auth.onAuthStateChanged(user => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        
        // Clean up previous listeners
        unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        unsubscribers = [];
        
        if (user) {
            currentUser = user;
            loadRunnerData();
            showApp();
        } else {
            showLogin();
        }
    });
});

// Event Listeners
function initEventListeners() {
    // Login buttons
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const emailLoginBtn = document.getElementById('emailLoginBtn');
    
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', signInWithGoogle);
    if (emailLoginBtn) emailLoginBtn.addEventListener('click', signInWithEmail);
    if (signUpLink) signUpLink.addEventListener('click', showSignUp);
    
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            if (this.id === 'logoutBtn') {
                logout();
            } else {
                showPage(page);
                
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
    
    // Buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const viewTasksBtn = document.getElementById('viewTasksBtn');
    const withdrawEarningsBtn = document.getElementById('withdrawEarningsBtn');
    const supportBtn = document.getElementById('supportBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const requestWithdrawalBtn = document.getElementById('requestWithdrawalBtn');
    const submitBidBtn = document.getElementById('submitBidBtn');
    const confirmWithdrawalBtn = document.getElementById('confirmWithdrawalBtn');
    const availabilityToggle = document.getElementById('availabilityToggle');
    const withdrawalMethod = document.getElementById('withdrawalMethod');
    const confirmCompleteBtn = document.getElementById('confirmCompleteBtn');
    
    if (refreshBtn) refreshBtn.addEventListener('click', refreshDashboard);
    if (viewTasksBtn) viewTasksBtn.addEventListener('click', () => showPage('availableTasks'));
    if (withdrawEarningsBtn) withdrawEarningsBtn.addEventListener('click', () => showModal('withdrawalModal'));
    if (supportBtn) supportBtn.addEventListener('click', showRunnerSupport);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);
    if (changePhotoBtn) changePhotoBtn.addEventListener('click', changeProfilePhoto);
    if (requestWithdrawalBtn) requestWithdrawalBtn.addEventListener('click', () => showModal('withdrawalModal'));
    if (submitBidBtn) submitBidBtn.addEventListener('click', submitBid);
    if (confirmWithdrawalBtn) confirmWithdrawalBtn.addEventListener('click', processWithdrawal);
    if (availabilityToggle) availabilityToggle.addEventListener('change', toggleAvailability);
    if (withdrawalMethod) withdrawalMethod.addEventListener('change', showWithdrawalFields);
    if (confirmCompleteBtn) confirmCompleteBtn.addEventListener('click', requestCompletion);
    
    // Filter buttons
    document.querySelectorAll('.filter-buttons .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = getCurrentPage();
            const filter = this.getAttribute('data-filter') || this.getAttribute('data-bid-filter');
            
            document.querySelectorAll('.filter-buttons .filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (page === 'availableTasks') {
                filterTasks(filter);
            } else if (page === 'myBids') {
                filterBids(filter);
            }
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// Authentication Functions
function showSignUp(e) {
    e.preventDefault();
    const loginCard = document.querySelector('.login-card');
    const currentTitle = loginCard.querySelector('h1');
    const currentBtn = document.getElementById('emailLoginBtn');
    
    if (currentTitle.textContent === 'Runner Login') {
        currentTitle.textContent = 'Create Account';
        currentBtn.textContent = 'Sign Up';
        signUpLink.textContent = 'Sign In';
    } else {
        currentTitle.textContent = 'Runner Login';
        currentBtn.textContent = 'Sign In';
        signUpLink.textContent = 'Sign Up';
    }
}

async function signInWithGoogle() {
    showLoading();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        showToast('Successfully signed in with Google!', 'success');
    } catch (error) {
        console.error('Google sign in error:', error);
        showLoginError('Error signing in with Google: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function signInWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('emailLoginBtn');
    const isSignUp = loginBtn.textContent === 'Sign Up';
    
    if (!email || !password) {
        showLoginError('Please enter email and password');
        return;
    }
    
    showLoading();
    try {
        if (isSignUp) {
            // Create new account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Create runner document in Firestore
            await db.collection('runners').doc(userCredential.user.uid).set({
                email: email,
                name: email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userType: 'runner',
                walletBalance: 0,
                rating: 5.0,
                totalJobs: 0,
                totalEarnings: 0,
                profileComplete: false,
                isAvailable: false
            });
            
            showToast('Account created successfully! Please complete your profile.', 'success');
        } else {
            // Sign in existing account
            await auth.signInWithEmailAndPassword(email, password);
            showToast('Successfully signed in!', 'success');
        }
    } catch (error) {
        console.error('Email auth error:', error);
        showLoginError(error.message);
    } finally {
        hideLoading();
    }
}

async function logout() {
    try {
        await auth.signOut();
        showToast('Successfully logged out!', 'success');
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out: ' + error.message, 'error');
    }
}

function showLoginError(message) {
    const loginStatus = document.getElementById('loginStatus');
    if (loginStatus) {
        loginStatus.textContent = message;
        loginStatus.style.display = 'block';
    }
}

// Runner Data Functions
async function loadRunnerData() {
    if (!currentUser) return;
    
    showLoading();
    try {
        const runnerDoc = await db.collection('runners').doc(currentUser.uid).get();
        
        if (runnerDoc.exists) {
            runnerData = runnerDoc.data();
            
            // Update UI with runner data
            updateRunnerUI();
            
            // Show profile prompt if profile is incomplete
            checkProfileCompletion();
            
            // Set up real-time listeners
            setupRealTimeListeners();
            
            showToast('Welcome back, ' + (runnerData.name || 'Runner') + '!', 'success');
        } else {
            // Create runner document if it doesn't exist
            await db.collection('runners').doc(currentUser.uid).set({
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userType: 'runner',
                walletBalance: 0,
                rating: 5.0,
                totalJobs: 0,
                totalEarnings: 0,
                profileComplete: false,
                isAvailable: false
            });
            
            runnerData = {
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                walletBalance: 0,
                rating: 5.0,
                isAvailable: false,
                profileComplete: false
            };
            
            updateRunnerUI();
            checkProfileCompletion();
            setupRealTimeListeners();
            
            showToast('Welcome to ERRANDS Runner! Please complete your profile.', 'success');
        }
    } catch (error) {
        console.error('Error loading runner data:', error);
        showToast('Error loading runner data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function setupRealTimeListeners() {
    if (!currentUser) return;
    
    // Listen for available tasks count
    const availableTasksUnsub = db.collection('errands')
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            document.getElementById('availableTasksCount').textContent = snapshot.size;
            document.getElementById('taskCountBadge').textContent = snapshot.size;
            
            // Update recent tasks if on dashboard
            if (document.getElementById('dashboardPage').classList.contains('active')) {
                loadRecentTasks();
            }
            
            // Update available tasks if on that page
            if (document.getElementById('availableTasksPage').classList.contains('active')) {
                loadAvailableTasks();
            }
        }, error => {
            console.error('Available tasks listener error:', error);
        });
    unsubscribers.push(availableTasksUnsub);
    
    // Listen for active jobs (where runner is assigned and status is active or in_progress)
    const activeJobsUnsub = db.collection('errands')
        .where('assignedRunnerId', '==', currentUser.uid)
        .where('status', 'in', ['active', 'in_progress', 'pending_client_approval'])
        .onSnapshot(snapshot => {
            document.getElementById('activeJobsCount').textContent = snapshot.size;
            
            if (document.getElementById('activeJobsPage').classList.contains('active')) {
                loadActiveJobs();
            }
            
            // Update dashboard stats
            if (document.getElementById('dashboardPage').classList.contains('active')) {
                loadDashboardData();
            }
        }, error => {
            console.error('Active jobs listener error:', error);
        });
    unsubscribers.push(activeJobsUnsub);
    
    // Listen for completed jobs (for earnings)
    const completedJobsUnsub = db.collection('errands')
        .where('assignedRunnerId', '==', currentUser.uid)
        .where('status', '==', 'completed')
        .onSnapshot(() => {
            if (document.getElementById('earningsPage').classList.contains('active')) {
                loadEarningsData();
            }
            
            // Update dashboard earnings
            if (document.getElementById('dashboardPage').classList.contains('active')) {
                loadDashboardData();
            }
        }, error => {
            console.error('Completed jobs listener error:', error);
        });
    unsubscribers.push(completedJobsUnsub);
    
    // Listen for runner document changes
    const runnerUnsub = db.collection('runners').doc(currentUser.uid)
        .onSnapshot(doc => {
            if (doc.exists) {
                runnerData = doc.data();
                updateRunnerUI();
                checkProfileCompletion();
            }
        }, error => {
            console.error('Runner listener error:', error);
        });
    unsubscribers.push(runnerUnsub);
}

function updateRunnerUI() {
    document.getElementById('runnerName').textContent = runnerData.name || 'Runner';
    document.getElementById('runnerEmail').textContent = runnerData.email || currentUser.email;
    document.getElementById('welcomeMessage').textContent = `HELLO ${runnerData.name || 'Runner'}`;
    
    // Update profile form
    document.getElementById('profileName').value = runnerData.name || '';
    document.getElementById('profileEmail').value = runnerData.email || currentUser.email;
    document.getElementById('profilePhone').value = runnerData.phone || '';
    document.getElementById('profileId').value = runnerData.idNumber || '';
    document.getElementById('profileTown').value = runnerData.town || '';
    document.getElementById('profileCounty').value = runnerData.county || '';
    
    // Update availability toggle
    const toggle = document.getElementById('availabilityToggle');
    if (toggle) {
        toggle.checked = runnerData.isAvailable || false;
    }
    
    if (runnerData.photoURL) {
        document.getElementById('runnerAvatar').src = runnerData.photoURL;
        document.getElementById('profilePhoto').src = runnerData.photoURL;
    }
}

function checkProfileCompletion() {
    const profilePrompt = document.getElementById('profilePrompt');
    if (!profilePrompt) return;
    
    const requiredFields = ['name', 'phone', 'town', 'county'];
    const isComplete = requiredFields.every(field => runnerData[field]);
    
    if (!isComplete && runnerData.profileComplete !== true) {
        profilePrompt.style.display = 'flex';
    } else {
        profilePrompt.style.display = 'none';
        
        // Update profileComplete flag if needed
        if (!runnerData.profileComplete) {
            db.collection('runners').doc(currentUser.uid).update({
                profileComplete: true
            });
        }
    }
}

async function saveProfile() {
    showLoading();
    try {
        const updates = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            idNumber: document.getElementById('profileId').value,
            town: document.getElementById('profileTown').value,
            county: document.getElementById('profileCounty').value,
            profileComplete: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('runners').doc(currentUser.uid).update(updates);
        
        // Update local runnerData
        Object.assign(runnerData, updates);
        
        // Update UI
        updateRunnerUI();
        checkProfileCompletion();
        
        showToast('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function changeProfilePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading();
        try {
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            
            const storageRef = storage.ref();
            const photoRef = storageRef.child(`profile_photos/${currentUser.uid}/${safeFileName}`);
            await photoRef.put(file);
            const photoURL = await photoRef.getDownloadURL();
            
            await db.collection('runners').doc(currentUser.uid).update({
                photoURL: photoURL
            });
            
            document.getElementById('runnerAvatar').src = photoURL;
            document.getElementById('profilePhoto').src = photoURL;
            runnerData.photoURL = photoURL;
            
            showToast('Profile photo updated!', 'success');
        } catch (error) {
            console.error('Photo upload error:', error);
            showToast('Error uploading photo: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };
    
    input.click();
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        // Load today's earnings from completed jobs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const jobsSnapshot = await db.collection('errands')
            .where('assignedRunnerId', '==', currentUser.uid)
            .where('status', '==', 'completed')
            .where('completedAt', '>=', today)
            .get();
        
        let todayEarnings = 0;
        jobsSnapshot.forEach(doc => {
            todayEarnings += doc.data().runnerAmount || 0;
        });
        
        document.getElementById('todayEarnings').textContent = `KSH ${todayEarnings.toFixed(2)}`;
        document.getElementById('runnerRating').textContent = runnerData.rating?.toFixed(1) || '5.0';
        
        // Load recent tasks
        loadRecentTasks();
        
        // Load earnings progress
        updateEarningsProgress();
        
    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}

async function loadRecentTasks() {
    try {
        const snapshot = await db.collection('errands')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();
        
        const recentTasks = document.getElementById('recentTasks');
        recentTasks.innerHTML = '';
        
        if (snapshot.empty) {
            recentTasks.innerHTML = `
                <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                    <i class="fas fa-tasks" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No tasks available</h3>
                    <p>Check back later for new errands</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const task = doc.data();
            const taskCard = createTaskCard(task, doc.id, 'dashboard');
            recentTasks.appendChild(taskCard);
        });
    } catch (error) {
        console.error('Load recent tasks error:', error);
    }
}

// Task Functions
async function loadAvailableTasks() {
    try {
        const snapshot = await db.collection('errands')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        
        const tasksList = document.getElementById('availableTasksList');
        tasksList.innerHTML = '';
        
        if (snapshot.empty) {
            tasksList.innerHTML = `
                <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                    <i class="fas fa-tasks" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No tasks available right now</h3>
                    <p>Check back later for new errands</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const task = doc.data();
            // Check if runner has already bid
            const hasBid = task.bids && task.bids.some(bid => bid.runnerId === currentUser.uid);
            if (!hasBid) {
                const taskCard = createTaskCard(task, doc.id, 'available');
                tasksList.appendChild(taskCard);
            }
        });
    } catch (error) {
        console.error('Load available tasks error:', error);
        showToast('Error loading tasks: ' + error.message, 'error');
    }
}

function createTaskCard(task, id, context) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = id;
    card.dataset.type = (task.errandType || '').toLowerCase();
    card.dataset.budget = task.budget || 0;
    
    const date = task.createdAt ? task.createdAt.toDate().toLocaleDateString() : 'Recent';
    
    let actions = '';
    
    if (context === 'available' || context === 'dashboard') {
        actions = `
            <button class="btn btn-primary btn-sm" onclick="openBidModal('${id}')">
                <i class="fas fa-gavel"></i> Place Bid
            </button>
        `;
    } else if (context === 'active') {
        if (task.status === 'active') {
            actions = `
                <button class="btn btn-primary btn-sm" onclick="startJob('${id}')">
                    <i class="fas fa-play"></i> Start Run
                </button>
                <button class="btn btn-outline btn-sm" onclick="viewJobDetails('${id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            `;
        } else if (task.status === 'in_progress') {
            actions = `
                <button class="btn btn-success btn-sm" onclick="openCompleteModal('${id}')">
                    <i class="fas fa-check"></i> Finish Errand
                </button>
                <button class="btn btn-outline btn-sm" onclick="viewJobDetails('${id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            `;
        } else if (task.status === 'pending_client_approval') {
            actions = `
                <button class="btn btn-outline btn-sm" onclick="viewJobDetails('${id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                <span class="task-status status-pending">Awaiting Approval</span>
            `;
        }
    }
    
    let statusClass = `status-${task.status}`;
    let statusText = task.status === 'pending' ? 'AVAILABLE' : 
                    task.status === 'active' ? 'ACCEPTED' :
                    task.status === 'in_progress' ? 'IN PROGRESS' :
                    task.status === 'pending_client_approval' ? 'AWAITING APPROVAL' :
                    task.status.toUpperCase();
    
    card.innerHTML = `
        <div class="task-header">
            <span class="task-type">${task.errandType || 'Errand'}</span>
            <span class="task-budget">KSH ${(task.budget || 0).toFixed(2)}</span>
        </div>
        <div class="task-body">
            <h3 class="task-title">${(task.description || '').substring(0, 60)}${task.description && task.description.length > 60 ? '...' : ''}</h3>
            <p class="task-desc">${task.description || ''}</p>
            <div class="task-details">
                <div class="task-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${task.town || ''}, ${task.area || ''}</span>
                </div>
                ${task.travelRequired ? `
                <div class="task-detail">
                    <i class="fas fa-route"></i>
                    <span>Travel Required</span>
                </div>
                ` : ''}
                ${task.runnerNeeds ? `
                <div class="task-detail">
                    <i class="fas fa-tools"></i>
                    <span>${task.runnerNeeds}</span>
                </div>
                ` : ''}
                <div class="task-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${date}</span>
                </div>
            </div>
        </div>
        <div class="task-footer">
            <span class="task-status ${statusClass}">${statusText}</span>
            <div class="task-actions">
                ${actions}
            </div>
        </div>
    `;
    
    return card;
}

function filterTasks(filter) {
    const cards = document.querySelectorAll('#availableTasksList .task-card');
    cards.forEach(card => {
        let show = false;
        
        const taskType = card.dataset.type || '';
        const taskBudget = parseFloat(card.dataset.budget) || 0;
        
        switch(filter) {
            case 'all':
                show = true;
                break;
            case 'delivery':
                show = taskType.includes('delivery');
                break;
            case 'shopping':
                show = taskType.includes('shopping');
                break;
            case 'repair':
                show = taskType.includes('repair') || taskType.includes('handy');
                break;
            case 'high-budget':
                show = taskBudget > 5000;
                break;
            default:
                show = true;
        }
        
        card.style.display = show ? 'block' : 'none';
    });
}

// Bid Functions
async function openBidModal(taskId) {
    selectedTaskId = taskId;
    showModal('bidModal');
    
    try {
        const taskDoc = await db.collection('errands').doc(taskId).get();
        const task = taskDoc.data();
        
        document.getElementById('bidTaskDescription').textContent = task.description;
        document.getElementById('taskBudget').textContent = (task.budget || 0).toFixed(2);
        
        // Set default bid amount (80% of budget)
        const defaultBid = task.budget * 0.8;
        document.getElementById('bidAmount').value = defaultBid.toFixed(2);
        
    } catch (error) {
        console.error('Error loading task details:', error);
        showToast('Error loading task details', 'error');
    }
}

async function submitBid() {
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);
    const bidTime = document.getElementById('bidTime').value;
    const bidMessage = document.getElementById('bidMessage').value;
    const bidTerms = document.getElementById('bidTerms').checked;
    
    if (!bidAmount || bidAmount < 1) {
        showToast('Minimum bid amount is KSH 1', 'error');
        return;
    }
    
    if (!bidTerms) {
        showToast('Please agree to the terms and conditions', 'error');
        return;
    }
    
    showLoading();
    try {
        const taskDoc = await db.collection('errands').doc(selectedTaskId).get();
        const task = taskDoc.data();
        
        // Check if runner has already bid on this task
        const existingBid = task.bids && task.bids.find(bid => bid.runnerId === currentUser.uid);
        if (existingBid) {
            showToast('You have already placed a bid on this task', 'error');
            hideLoading();
            closeModal('bidModal');
            return;
        }
        
        // Create bid object matching client's expected structure
        const bid = {
            runnerId: currentUser.uid,
            runnerName: runnerData.name || currentUser.email.split('@')[0],
            runnerPhoto: runnerData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(runnerData.name || 'Runner')}&background=ff7f00&color=fff`,
            runnerRating: runnerData.rating || 5.0,
            amount: bidAmount,
            completionTime: parseInt(bidTime),
            message: bidMessage,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Add bid to task using arrayUnion
        await db.collection('errands').doc(selectedTaskId).update({
            bids: firebase.firestore.FieldValue.arrayUnion(bid)
        });
        
        showToast('Bid submitted successfully!', 'success');
        closeModal('bidModal');
        
    } catch (error) {
        console.error('Submit bid error:', error);
        showToast('Error submitting bid: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadMyBids() {
    if (!currentUser) return;
    
    showLoading();
    try {
        const snapshot = await db.collection('errands')
            .where('bids', 'array-contains', { runnerId: currentUser.uid })
            .orderBy('createdAt', 'desc')
            .get();
        
        const bidsList = document.getElementById('myBidsList');
        bidsList.innerHTML = '';
        
        if (snapshot.empty) {
            bidsList.innerHTML = `
                <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                    <i class="fas fa-gavel" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No bids yet</h3>
                    <p>Start bidding on available tasks to earn money</p>
                    <button class="btn btn-primary" onclick="showPage('availableTasks')" style="margin-top: 20px;">
                        <i class="fas fa-search"></i> Browse Tasks
                    </button>
                </div>
            `;
            hideLoading();
            return;
        }
        
        snapshot.forEach(doc => {
            const errand = doc.data();
            const runnerBid = errand.bids.find(bid => bid.runnerId === currentUser.uid);
            if (runnerBid) {
                const bidCard = createBidCard(errand, runnerBid, doc.id);
                bidsList.appendChild(bidCard);
            }
        });
    } catch (error) {
        console.error('Load bids error:', error);
        showToast('Error loading bids: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function createBidCard(errand, bid, errandId) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = errandId;
    card.dataset.status = bid.status;
    
    const statusClass = `status-${bid.status}`;
    const date = bid.createdAt ? new Date(bid.createdAt).toLocaleDateString() : 'Recent';
    
    let statusText = bid.status === 'pending' ? 'WAITING FOR CLIENT' :
                    bid.status === 'accepted' ? 'BID ACCEPTED' :
                    bid.status === 'rejected' ? 'BID REJECTED' : 
                    bid.status.toUpperCase();
    
    let actions = '';
    if (bid.status === 'accepted' && errand.status === 'pending') {
        actions = `
            <button class="btn btn-success btn-sm" onclick="startJob('${errandId}')">
                <i class="fas fa-play"></i> Start Run
            </button>
        `;
    }
    
    card.innerHTML = `
        <div class="task-header">
            <span class="task-type">BID</span>
            <span class="task-budget">KSH ${(bid.amount || 0).toFixed(2)}</span>
        </div>
        <div class="task-body">
            <h3 class="task-title">${(errand.description || '').substring(0, 60)}${errand.description && errand.description.length > 60 ? '...' : ''}</h3>
            <p class="task-desc">${errand.description || ''}</p>
            <div class="task-details">
                <div class="task-detail">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>Task Budget: KSH ${(errand.budget || 0).toFixed(2)}</span>
                </div>
                <div class="task-detail">
                    <i class="fas fa-clock"></i>
                    <span>Completion Time: ${bid.completionTime || 2} hours</span>
                </div>
                ${bid.message ? `
                <div class="task-detail">
                    <i class="fas fa-comment"></i>
                    <span>Your Message: ${bid.message}</span>
                </div>
                ` : ''}
                <div class="task-detail">
                    <i class="fas fa-calendar"></i>
                    <span>Submitted: ${date}</span>
                </div>
            </div>
        </div>
        <div class="task-footer">
            <span class="task-status ${statusClass}">${statusText}</span>
            <div>
                ${actions}
            </div>
        </div>
    `;
    
    return card;
}

function filterBids(filter) {
    const cards = document.querySelectorAll('#myBidsList .task-card');
    cards.forEach(card => {
        if (filter === 'all' || (card.dataset.status && card.dataset.status === filter)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Job Functions
async function loadActiveJobs() {
    if (!currentUser) return;
    
    showLoading();
    try {
        const snapshot = await db.collection('errands')
            .where('assignedRunnerId', '==', currentUser.uid)
            .where('status', 'in', ['active', 'in_progress', 'pending_client_approval'])
            .orderBy('createdAt', 'desc')
            .get();
        
        const jobsList = document.getElementById('activeJobsList');
        jobsList.innerHTML = '';
        
        if (snapshot.empty) {
            jobsList.innerHTML = `
                <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                    <i class="fas fa-briefcase" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No active jobs</h3>
                    <p>Your active jobs will appear here</p>
                    <button class="btn btn-primary" onclick="showPage('availableTasks')" style="margin-top: 20px;">
                        <i class="fas fa-search"></i> Find Tasks
                    </button>
                </div>
            `;
            hideLoading();
            return;
        }
        
        snapshot.forEach(doc => {
            const job = doc.data();
            const jobCard = createTaskCard(job, doc.id, 'active');
            jobsList.appendChild(jobCard);
        });
    } catch (error) {
        console.error('Load active jobs error:', error);
        showToast('Error loading jobs: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function viewJobDetails(jobId) {
    selectedJobId = jobId;
    showModal('jobDetailsModal');
    
    try {
        const jobDoc = await db.collection('errands').doc(jobId).get();
        const job = jobDoc.data();
        
        const date = job.createdAt ? job.createdAt.toDate().toLocaleString() : 'N/A';
        const deadline = job.deadline ? new Date(job.deadline).toLocaleString() : 'Not set';
        
        let details = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">${job.errandType || 'Errand'}</h3>
                <p style="color: #666;">${job.description || ''}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div>
                    <strong>Budget:</strong>
                    <div>KSH ${(job.budget || 0).toFixed(2)}</div>
                </div>
                <div>
                    <strong>Your Earnings:</strong>
                    <div style="color: var(--dark-green); font-weight: 600;">KSH ${(job.runnerAmount || 0).toFixed(2)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <strong>Location:</strong>
                <div>${job.town || ''}, ${job.area || ''}</div>
            </div>
        `;
        
        if (job.travelRequired) {
            details += `
                <div style="margin-bottom: 20px;">
                    <strong>Travel Details:</strong>
                    <div>From: ${job.travelFrom || ''}</div>
                    <div>To: ${job.travelTo || ''}</div>
                </div>
            `;
        }
        
        if (job.runnerNeeds) {
            details += `
                <div style="margin-bottom: 20px;">
                    <strong>Requirements:</strong>
                    <div>${job.runnerNeeds}</div>
                </div>
            `;
        }
        
        if (job.meetRequired) {
            details += `
                <div style="margin-bottom: 20px;">
                    <strong>Client Meeting Required:</strong>
                    <div>Yes</div>
                </div>
            `;
        }
        
        const statusText = job.status === 'active' ? 'Accepted - Ready to Start' :
                          job.status === 'in_progress' ? 'In Progress' :
                          job.status === 'pending_client_approval' ? 'Awaiting Client Approval' :
                          job.status;
        
        details += `
            <div style="margin-bottom: 20px;">
                <strong>Status:</strong>
                <div>${statusText}</div>
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Posted:</strong>
                <div>${date}</div>
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Deadline:</strong>
                <div>${deadline}</div>
            </div>
        `;
        
        if (job.startedAt) {
            const startedDate = job.startedAt.toDate().toLocaleString();
            details += `
                <div style="margin-bottom: 20px;">
                    <strong>Started:</strong>
                    <div>${startedDate}</div>
                </div>
            `;
        }
        
        document.getElementById('jobDetailsContent').innerHTML = details;
        
        // Show appropriate buttons
        const startBtn = document.getElementById('startJobBtn');
        const finishBtn = document.getElementById('finishJobModalBtn');
        
        startBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        
        if (job.status === 'active') {
            startBtn.style.display = 'inline-flex';
            startBtn.onclick = () => startJob(jobId);
        } else if (job.status === 'in_progress') {
            finishBtn.style.display = 'inline-flex';
            finishBtn.onclick = () => openCompleteModal(jobId);
        }
        
    } catch (error) {
        console.error('Error loading job details:', error);
        showToast('Error loading job details', 'error');
    }
}

async function startJob(jobId) {
    if (!confirm('Start this run? The job status will be updated to "In Progress".')) return;
    
    showLoading();
    try {
        await db.collection('errands').doc(jobId).update({
            status: 'in_progress',
            startedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Job started successfully!', 'success');
        closeModal('jobDetailsModal');
        
        // Navigate to active jobs page
        showPage('activeJobs');
        
    } catch (error) {
        console.error('Start job error:', error);
        showToast('Error starting job: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function openCompleteModal(jobId) {
    selectedJobId = jobId;
    showModal('completeJobModal');
}

async function requestCompletion() {
    const notes = document.getElementById('completionNotes').value;
    
    showLoading();
    try {
        await db.collection('errands').doc(selectedJobId).update({
            status: 'pending_client_approval',
            completionRequestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completionNotes: notes
        });
        
        showToast('Completion request sent to client. Waiting for approval.', 'success');
        closeModal('completeJobModal');
        closeModal('jobDetailsModal');
        
        // Refresh active jobs
        loadActiveJobs();
        
    } catch (error) {
        console.error('Request completion error:', error);
        showToast('Error requesting completion: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Listen for client approval/rejection of completion
function listenForJobUpdates(jobId) {
    const unsub = db.collection('errands').doc(jobId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const job = doc.data();
                
                if (job.status === 'completed' && job.completedAt) {
                    showToast('Client approved completion! Payment has been released.', 'success');
                    
                    // Update runner stats and wallet
                    updateRunnerAfterCompletion(job.runnerAmount);
                    
                    // Update earnings
                    if (document.getElementById('earningsPage').classList.contains('active')) {
                        loadEarningsData();
                    }
                    
                    // Refresh active jobs
                    if (document.getElementById('activeJobsPage').classList.contains('active')) {
                        loadActiveJobs();
                    }
                    
                    // Refresh dashboard
                    if (document.getElementById('dashboardPage').classList.contains('active')) {
                        loadDashboardData();
                    }
                }
            }
        });
    
    unsubscribers.push(unsub);
}

async function updateRunnerAfterCompletion(amount) {
    try {
        await db.collection('runners').doc(currentUser.uid).update({
            walletBalance: firebase.firestore.FieldValue.increment(amount || 0),
            totalJobs: firebase.firestore.FieldValue.increment(1),
            totalEarnings: firebase.firestore.FieldValue.increment(amount || 0)
        });
    } catch (error) {
        console.error('Error updating runner stats:', error);
    }
}

// Earnings Functions
async function loadEarningsData() {
    try {
        // Get completed errands for this runner
        const snapshot = await db.collection('errands')
            .where('assignedRunnerId', '==', currentUser.uid)
            .where('status', '==', 'completed')
            .orderBy('completedAt', 'desc')
            .get();
        
        let totalEarnings = 0;
        let weeklyEarnings = 0;
        let monthlyEarnings = 0;
        
        const now = new Date();
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Build earnings history HTML
        let earningsHistoryHtml = '<div style="display: grid; gap: 15px;">';
        
        snapshot.forEach(doc => {
            const job = doc.data();
            const amount = job.finalRunnerAmount || job.acceptedBidRunnerAmount || (job.acceptedBid ? job.acceptedBid * 0.8 : 0);
            const completedAt = job.completedAt ? job.completedAt.toDate() : null;
            
            totalEarnings += amount;
            
            if (completedAt && completedAt >= weekStart) {
                weeklyEarnings += amount;
            }
            
            if (completedAt && completedAt >= monthStart) {
                monthlyEarnings += amount;
            }
            
            // Format date
            const dateStr = completedAt ? completedAt.toLocaleDateString() + ' ' + completedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recent';
            
            // Create earnings history item
            earningsHistoryHtml += `
                <div style="background: white; border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); border-left: 5px solid var(--lime-green);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 5px;">${job.errandType || 'Errand'}</h3>
                            <p style="color: #666; font-size: 14px;">${job.description ? job.description.substring(0, 60) + (job.description.length > 60 ? '...' : '') : ''}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: var(--dark-green);">KSH ${amount.toFixed(2)}</div>
                            <div style="font-size: 12px; color: #999;">${dateStr}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 20px; flex-wrap: wrap; border-top: 1px solid var(--medium-gray); padding-top: 15px;">
                        <div style="flex: 1;">
                            <div style="font-size: 12px; color: #666;">Client</div>
                            <div style="font-weight: 500;">${job.clientName || 'Unknown'}</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 12px; color: #666;">Location</div>
                            <div style="font-weight: 500;">${job.town || ''}, ${job.area || ''}</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 12px; color: #666;">Accepted Bid</div>
                            <div style="font-weight: 500;">KSH ${(job.acceptedBid || 0).toFixed(2)}</div>
                        </div>
                        ${job.completionNotes ? `
                        <div style="flex: 1 1 100%; margin-top: 10px;">
                            <div style="font-size: 12px; color: #666;">Completion Notes</div>
                            <div style="font-style: italic; color: #666;">"${job.completionNotes}"</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        earningsHistoryHtml += '</div>';
        
        // Update UI
        document.getElementById('totalEarnings').textContent = `KSH ${(runnerData.walletBalance || 0).toFixed(2)}`;
        document.getElementById('weeklyTotal').textContent = weeklyEarnings.toFixed(2);
        document.getElementById('monthlyTotal').textContent = monthlyEarnings.toFixed(2);
        document.getElementById('allTimeTotal').textContent = totalEarnings.toFixed(2);
        document.getElementById('availableBalance').textContent = `KSH ${(runnerData.walletBalance || 0).toFixed(2)}`;
        
        // Update earnings history
        const earningsHistory = document.getElementById('earningsHistory');
        if (snapshot.empty) {
            earningsHistory.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666; background: white; border-radius: var(--radius);">
                    <i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 20px; color: var(--medium-gray);"></i>
                    <h3>No earnings yet</h3>
                    <p>Your completed errand payments will appear here</p>
                </div>
            `;
        } else {
            earningsHistory.innerHTML = earningsHistoryHtml;
        }
        
        // Update dashboard weekly earnings
        document.getElementById('weeklyEarnings').textContent = `KSH ${weeklyEarnings.toFixed(2)}`;
        updateEarningsProgress();
        
        // Load withdrawal history
        loadWithdrawalHistory();
        
    } catch (error) {
        console.error('Load earnings error:', error);
    }
}

// New function to load withdrawal history
async function loadWithdrawalHistory() {
    try {
        const snapshot = await db.collection('withdrawals')
            .where('runnerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const withdrawalHistory = document.getElementById('withdrawalHistory');
        
        if (snapshot.empty) {
            withdrawalHistory.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-history" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <h3>No withdrawals yet</h3>
                    <p>Your withdrawal history will appear here</p>
                </div>
            `;
            return;
        }
        
        let withdrawalsHtml = '<div style="display: grid; gap: 15px;">';
        
        snapshot.forEach(doc => {
            const withdrawal = doc.data();
            const date = withdrawal.createdAt ? withdrawal.createdAt.toDate().toLocaleDateString() : 'Recent';
            
            let statusClass = '';
            let statusText = withdrawal.status.toUpperCase();
            
            if (withdrawal.status === 'completed') {
                statusClass = 'status-completed';
            } else if (withdrawal.status === 'pending') {
                statusClass = 'status-pending';
            } else if (withdrawal.status === 'rejected') {
                statusClass = 'status-cancelled';
            }
            
            let methodDetails = '';
            if (withdrawal.method === 'mpesa') {
                methodDetails = `<div style="font-size: 13px;">To: ${withdrawal.mpesaNumber}</div>`;
            } else if (withdrawal.method === 'bank') {
                methodDetails = `<div style="font-size: 13px;">Bank Transfer</div>`;
            }
            
            withdrawalsHtml += `
                <div style="background: white; border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 18px; font-weight: 600; color: var(--dark-green);">KSH ${withdrawal.amount.toFixed(2)}</div>
                            <div style="font-size: 13px; color: #666;">${date}</div>
                        </div>
                        <span class="task-status ${statusClass}">${statusText}</span>
                    </div>
                    <div style="border-top: 1px solid var(--medium-gray); padding-top: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 14px; font-weight: 500;">${withdrawal.method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}</div>
                                ${methodDetails}
                            </div>
                            ${withdrawal.processedAt ? `
                            <div style="font-size: 12px; color: #666;">
                                Processed: ${withdrawal.processedAt.toDate().toLocaleDateString()}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        withdrawalsHtml += '</div>';
        withdrawalHistory.innerHTML = withdrawalsHtml;
        
    } catch (error) {
        console.error('Error loading withdrawal history:', error);
    }
}

function updateEarningsProgress() {
    const weeklyGoal = 10000;
    const weeklyTotal = parseFloat(document.getElementById('weeklyTotal').textContent) || 0;
    const progress = Math.min((weeklyTotal / weeklyGoal) * 100, 100);
    
    document.getElementById('earningsProgress').style.width = `${progress}%`;
}

function showWithdrawalFields() {
    const method = document.getElementById('withdrawalMethod').value;
    
    document.getElementById('mpesaLabel').style.display = method === 'mpesa' ? 'block' : 'none';
    document.getElementById('mpesaNumber').style.display = method === 'mpesa' ? 'block' : 'none';
    document.getElementById('bankLabel').style.display = method === 'bank' ? 'block' : 'none';
    document.getElementById('bankDetails').style.display = method === 'bank' ? 'block' : 'none';
}

async function processWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawalAmount').value);
    const method = document.getElementById('withdrawalMethod').value;
    const mpesaNumber = document.getElementById('mpesaNumber').value;
    const bankDetails = document.getElementById('bankDetails').value;
    
    if (!amount || amount < 500) {
        showToast('Minimum withdrawal amount is KSH 500', 'error');
        return;
    }
    
    if (amount > (runnerData.walletBalance || 0)) {
        showToast('Insufficient balance for withdrawal', 'error');
        return;
    }
    
    if (method === 'mpesa' && (!mpesaNumber || mpesaNumber.length < 10)) {
        showToast('Please enter a valid M-Pesa number', 'error');
        return;
    }
    
    if (method === 'bank' && !bankDetails) {
        showToast('Please enter bank account details', 'error');
        return;
    }
    
    showLoading();
    try {
        // Create withdrawal request
        const withdrawalData = {
            runnerId: currentUser.uid,
            runnerName: runnerData.name || currentUser.email,
            amount: amount,
            method: method,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (method === 'mpesa') {
            withdrawalData.mpesaNumber = mpesaNumber;
        } else if (method === 'bank') {
            withdrawalData.bankDetails = bankDetails;
        }
        
        await db.collection('withdrawals').add(withdrawalData);
        
        // Deduct from wallet
        await db.collection('runners').doc(currentUser.uid).update({
            walletBalance: firebase.firestore.FieldValue.increment(-amount)
        });
        
        // Update local data
        runnerData.walletBalance -= amount;
        
        showToast(`Withdrawal request of KSH ${amount.toFixed(2)} submitted successfully!`, 'success');
        closeModal('withdrawalModal');
        
        // Refresh earnings data
        loadEarningsData();
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast('Error processing withdrawal: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Utility Functions
async function toggleAvailability() {
    const isAvailable = document.getElementById('availabilityToggle').checked;
    
    try {
        await db.collection('runners').doc(currentUser.uid).update({
            isAvailable: isAvailable,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        runnerData.isAvailable = isAvailable;
        
        showToast(`You are now ${isAvailable ? 'available' : 'unavailable'} for new tasks`, 'success');
    } catch (error) {
        console.error('Toggle availability error:', error);
        showToast('Error updating availability', 'error');
    }
}

function showRunnerSupport() {
    const phoneNumber = '+254793312993';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=Hello%20ERRANDS%20Runner%20Support,%20I%20need%20assistance%20with:`;
    
    if (confirm('Contact Runner Support?\n\nCall: ' + phoneNumber + '\n\nOr open WhatsApp?')) {
        window.open(whatsappUrl, '_blank');
    }
}

// UI Helper Functions
function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    const pageElement = document.getElementById(`${pageId}Page`);
    if (pageElement) {
        pageElement.classList.add('active');
        
        // Update nav links
        navLinks.forEach(link => {
            const linkPage = link.getAttribute('data-page');
            if (linkPage === pageId) {
                link.classList.add('active');
            } else if (link.id !== 'logoutBtn') {
                link.classList.remove('active');
            }
        });
        
        // Load data for specific pages
        if (pageId === 'availableTasks') {
            loadAvailableTasks();
        } else if (pageId === 'myBids') {
            loadMyBids();
        } else if (pageId === 'activeJobs') {
            loadActiveJobs();
        } else if (pageId === 'earnings') {
            loadEarningsData();
        } else if (pageId === 'dashboard') {
            loadDashboardData();
        }
    }
}

function getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        return activePage.id.replace('Page', '');
    }
    return 'dashboard';
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    toast.className = `toast ${type}`;
    document.getElementById('toastMessage').textContent = message;
    
    const icon = document.getElementById('toastIcon');
    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle';
    } else {
        icon.className = 'fas fa-info-circle';
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showApp() {
    loginPage.style.display = 'none';
    appContainer.style.display = 'flex';
}

function showLogin() {
    loginPage.style.display = 'flex';
    appContainer.style.display = 'none';
    currentUser = null;
    runnerData = {};
}

function refreshDashboard() {
    showToast('Dashboard refreshed!', 'success');
}

// Make functions globally available
window.showPage = showPage;
window.closeModal = closeModal;
window.openBidModal = openBidModal;
window.startJob = startJob;
window.openCompleteModal = openCompleteModal;
window.viewJobDetails = viewJobDetails;
window.filterTasks = filterTasks;
window.filterBids = filterBids;
