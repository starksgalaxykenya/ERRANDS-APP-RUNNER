// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB-cyGvUm_XZBvP62OpCLoELYK5b8jABig",
    authDomain: "finance-report-246b1.firebaseapp.com",
    projectId: "finance-report-246b1",
    storageBucket: "finance-report-246b1.firebasestorage.app",
    messagingSenderId: "506353861080",
    appId: "1:506353861080:web:b5b2526f2828f380d9b2ad"
};

// Initialize Firebase
let auth, db, storage;

try {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded. Check your internet connection.');
    }
    
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    showLoginError('Firebase initialization failed: ' + error.message);
}
