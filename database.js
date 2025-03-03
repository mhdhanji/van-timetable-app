const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCYMHp-FO1TH8kGIOE42tfNal3sGXV8l6k",
    authDomain: "map-van-times-1f688.firebaseapp.com",
    projectId: "map-van-times-1f688",
    storageBucket: "map-van-times-1f688.firebasestorage.app",
    messagingSenderId: "169514675608",
    appId: "1:169514675608:web:2ea27cd6dda1a32f47cfed",
    measurementId: "G-HH94TKMPGL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function formatTime(timeStr) {
    if (!timeStr) return '';
    
    // If time is already in proper format, return it
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    
    // Remove any non-digit or colon characters
    timeStr = timeStr.replace(/[^\d:]/g, '');
    
    // Split into hours and minutes
    let [hours, minutes] = timeStr.split(':').map(Number);
    
    // Pad with zeros
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

async function getIBTData() {
    try {
        const querySnapshot = await getDocs(collection(db, 'ibt_times'));
        if (querySnapshot.empty) {
            throw new Error('No IBT data found');
        }
        
        const ibtData = querySnapshot.docs.map(doc => doc.data())[0];
        
        // Just format the times without changing the structure
        const formattedData = {
            market_deeping_saturday_times: ibtData.market_deeping_saturday_times || {},
            market_deeping_weekday_times: ibtData.market_deeping_weekday_times || {},
            maskew_avenue_saturday_times: ibtData.maskew_avenue_saturday_times || {},
            maskew_avenue_weekday_times: ibtData.maskew_avenue_weekday_times || {},
            fengate_saturday_times: ibtData.fengate_saturday_times || {},
            fengate_weekday_times: ibtData.fengate_weekday_times || {}
        };

        console.log("Formatted IBT Data:", formattedData);
        return formattedData;
    } catch (error) {
        console.error('Error fetching IBT data:', error);
        throw error;
    }
}

async function getMaskewData() {
    try {
        const querySnapshot = await getDocs(collection(db, 'maskew_avenue'));
        if (querySnapshot.empty) {
            throw new Error('No Maskew Avenue data found');
        }
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Format times
            if (data.times) {
                Object.keys(data.times).forEach(key => {
                    data.times[key] = formatTime(data.times[key]);
                });
            }
            if (data.saturday_times) {
                Object.keys(data.saturday_times).forEach(key => {
                    data.saturday_times[key] = formatTime(data.saturday_times[key]);
                });
            }
            return data;
        });
    } catch (error) {
        console.error('Error fetching Maskew data:', error);
        throw error;
    }
}

async function getMarketData() {
    try {
        const querySnapshot = await getDocs(collection(db, 'market_deeping'));
        if (querySnapshot.empty) {
            throw new Error('No Market Deeping data found');
        }
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Format times
            if (data.times) {
                Object.keys(data.times).forEach(key => {
                    data.times[key] = formatTime(data.times[key]);
                });
            }
            if (data.saturday_times) {
                Object.keys(data.saturday_times).forEach(key => {
                    data.saturday_times[key] = formatTime(data.saturday_times[key]);
                });
            }
            return data;
        });
    } catch (error) {
        console.error('Error fetching Market data:', error);
        throw error;
    }
}

async function getFengateData() {
    try {
        const querySnapshot = await getDocs(collection(db, 'fengate'));
        if (querySnapshot.empty) {
            throw new Error('No Fengate data found');
        }
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Format times
            if (data.times) {
                Object.keys(data.times).forEach(key => {
                    data.times[key] = formatTime(data.times[key]);
                });
            }
            if (data.saturday_times) {
                Object.keys(data.saturday_times).forEach(key => {
                    data.saturday_times[key] = formatTime(data.saturday_times[key]);
                });
            }
            return data;
        });
    } catch (error) {
        console.error('Error fetching Fengate data:', error);
        throw error;
    }
}

module.exports = {
    getMaskewData,
    getMarketData,
    getFengateData,
    getIBTData
};