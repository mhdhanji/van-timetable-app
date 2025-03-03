const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCYMHp-FO1TH8kGIOE42tfNal3sGXV8l6k",
  authDomain: "map-van-times-1f688.firebaseapp.com",
  projectId: "map-van-times-1f688",
  storageBucket: "map-van-times-1f688.firebasestorage.app",
  messagingSenderId: "169514675608",
  appId: "1:169514675608:web:e17a3e687efc62d347cfed",
  measurementId: "G-9SFHTDWRNX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Initializing Firebase...');
console.log('Firebase initialized');

console.log('Getting Firestore instance...');
console.log('Firestore instance obtained');

module.exports = { db };