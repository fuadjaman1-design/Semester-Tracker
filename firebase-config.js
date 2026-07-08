// =========================================
// FIREBASE CONFIGURATION
// =========================================

// Your new Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyCuGJMajKaM0fRF_lqZV8d5j2rw9yIYxLc",
    authDomain: "semester-tracker-1-2-d2d32.firebaseapp.com",
    projectId: "semester-tracker-1-2-d2d32",
    storageBucket: "semester-tracker-1-2-d2d32.firebasestorage.app",
    messagingSenderId: "943073742129",
    appId: "1:943073742129:web:b5c26a954178110aa37410"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Authentication
const auth = firebase.auth();

// Initialize Firestore
const db = firebase.firestore();