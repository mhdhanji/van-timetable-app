const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyBkkSet1OXBhkJhdcdphWG_3yFUJFWrujI",
    authDomain: "map-van-times.firebaseapp.com",
    projectId: "map-van-times",
    storageBucket: "map-van-times.firebasestorage.app",
    messagingSenderId: "967630671909",
    appId: "1:967630671909:web:8985ce0e4f1018f7d7efcc",
    measurementId: "G-JBS29H6ZZ5"
};

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('Firebase initialized');

console.log('Getting Firestore instance...');
const db = getFirestore(app);
console.log('Firestore instance obtained');

module.exports = { db };