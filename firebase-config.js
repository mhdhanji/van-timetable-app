const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCYMHp-FO1TH8kGIOE42tfNal3sGXV8l6k",
    authDomain: "map-van-times-1f688.firebaseapp.com",
    projectId: "map-van-times-1f688",
    storageBucket: "map-van-times-1f688.firebasestorage.app",
    messagingSenderId: "169514675608",
    appId: "1:169514675608:web:2ea27cd6dda1a32f47cfed",
    measurementId: "G-HH94TKMPGL"
};

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('Firebase initialized');

console.log('Getting Firestore instance...');
const db = getFirestore(app);
console.log('Firestore instance obtained');

module.exports = { db };