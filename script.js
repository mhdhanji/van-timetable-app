// Initialize speech synthesis
const speechSynthesis = window.speechSynthesis;

// Global variables
let lastDepartureCheck = null;
let lastFiveMinuteCheck = null;
let fiveMinuteWarningActive = false;
let lastDepartureNotificationTime = null;
let lastFiveMinuteNotificationTime = null;
let speechVolume = 1.0;
let useWeekendTimes = false;
let speechQueue = [];
let isSpeaking = false;

// Toggle state functions
function saveToggleState(isWeekend) {
    try {
        sessionStorage.setItem('useWeekendTimes', isWeekend ? 'true' : 'false');
    } catch (err) {
        console.error('Error saving toggle state:', err);
    }
}

function getToggleState() {
    try {
        const savedState = sessionStorage.getItem('useWeekendTimes');
        return savedState === 'true';
    } catch (err) {
        console.error('Error getting toggle state:', err);
        return false;
    }
}

// Create a replacement for the Firebase API using our data manager
window.firebaseApi = {
    getMaskewData: async () => {
        await dataManager.initialize();
        return dataManager.getMaskewData();
    },
    getMarketData: async () => {
        await dataManager.initialize();
        return dataManager.getMarketData();
    },
    getFengateData: async () => {
        await dataManager.initialize();
        return dataManager.getFengateData();
    },
    getIBTData: async () => {
        await dataManager.initialize();
        return dataManager.getIBTData();
    }
};

// Local storage functions
function saveLastViewedTable(tableName) {
    try {
        localStorage.setItem('lastViewedTable', tableName);
    } catch (err) {
        console.error('Error saving last viewed table:', err);
    }
}

function getLastViewedTable() {
    try {
        return localStorage.getItem('lastViewedTable') || 'maskew';
    } catch (err) {
        console.error('Error getting last viewed table:', err);
        return 'maskew';
    }
}

// Utility Functions
function showLoading(show) {
    const loader = document.querySelector('.loading-overlay');
    if (show) {
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('active');
    } else {
        errorDiv.classList.remove('active');
    }
}

function setAnnouncementVolume(newVolume) {
    // Ensure volume stays between 0 and 1
    speechVolume = Math.max(0, Math.min(1, newVolume));
    
    // Show volume indicator
    showVolumeIndicator();
}

function showVolumeIndicator() {
    let volumeIndicator = document.getElementById('volume-indicator');
    
    // Create volume indicator if it doesn't exist
    if (!volumeIndicator) {
        volumeIndicator = document.createElement('div');
        volumeIndicator.id = 'volume-indicator';
        volumeIndicator.style.position = 'fixed';
        volumeIndicator.style.top = '10px';
        volumeIndicator.style.right = '10px';
        volumeIndicator.style.background = 'rgba(0, 0, 0, 0.8)';
        volumeIndicator.style.color = 'white';
        volumeIndicator.style.padding = '5px 10px';
        volumeIndicator.style.borderRadius = '5px';
        volumeIndicator.style.zIndex = '1000';
        document.body.appendChild(volumeIndicator);
    }
    
    // Update and show volume indicator
    const volumePercent = Math.round(speechVolume * 100);
    volumeIndicator.textContent = `Volume: ${volumePercent}%`;
    volumeIndicator.style.display = 'block';
    
    // Hide after 2 seconds
    setTimeout(() => {
        volumeIndicator.style.display = 'none';
    }, 2000);
}

function formatLocationForSpeech(location) {
    if (!location) return '';
    
    // Create a copy of the location string to modify
    let formattedLocation = location;
    
    // Replace ST with Saint when it's a standalone word
    formattedLocation = formattedLocation.replace(/\bST\b/g, 'Saint');
    
    // Replace & with "and"
    formattedLocation = formattedLocation.replace(/&/g, 'and');
    
    // Replace / with "and" if present
    formattedLocation = formattedLocation.replace(/\//g, 'and');
    
    // Convert to Title Case (capitalize first letter of each word)
    formattedLocation = formattedLocation.split(' ').map(word => {
        if (word.length > 0) {
            return word[0].toUpperCase() + word.slice(1).toLowerCase();
        }
        return word;
    }).join(' ');
    
    return formattedLocation;
}

// Notification functions
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support desktop notifications');
        return false;
    }
    
    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
}

function showDesktopNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    try {
        // Force wake up before showing notification
        if (window.electron) {
            window.electron.wakeUp();
        }

        // Close any existing notifications first
        if (window.activeNotification) {
            window.activeNotification.close();
        }

        // Small delay to ensure system is ready
        setTimeout(() => {
            const notification = new Notification(title, {
                body: body,
                icon: 'icon.png',
                silent: false,
                requireInteraction: false,
                tag: 'van-notification'
            });

            window.activeNotification = notification;

            setTimeout(() => {
                if (notification) {
                    notification.close();
                    window.activeNotification = null;
                }
            }, 30000);
        }, 100);

    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// Speech functions
function speakDepartureMessage(message) {
    console.log('Queueing departure message:', message);
    
    // Clean up the message
    message = message.trim();
    
    // Add to queue and process
    addToSpeechQueue({
        text: message,
        type: 'departure',
        repeat: true  // Departure messages repeat once
    });
}

function speakWarningMessage(message) {
    console.log('Queueing warning message:', message);
    
    // Clean up the message
    message = message.trim();
    
    // Add to queue and process
    addToSpeechQueue({
        text: message,
        type: 'warning',
        repeat: false
    });
}

// New function to manage speech queue
function addToSpeechQueue(speechItem) {
    // Clear the queue if it's a new announcement (don't stack announcements)
    if (speechQueue.length > 0) {
        console.log('Clearing previous speech queue for new announcement');
        speechQueue = [];
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        isSpeaking = false;
    }
    
    // Add the new item to the queue
    speechQueue.push(speechItem);
    
    // Start processing the queue if not already speaking
    if (!isSpeaking) {
        processSpeechQueue();
    }
}

// New function to process the speech queue
function processSpeechQueue() {
    if (speechQueue.length === 0) {
        isSpeaking = false;
        return;
    }
    
    isSpeaking = true;
    const item = speechQueue[0];
    
    console.log('Speaking from queue:', item.text);
    
    // Create and configure the utterance
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = speechVolume;
    
    if (window.defaultVoice) {
        utterance.voice = window.defaultVoice;
    }
    
    // Set up event handlers
    utterance.onstart = () => console.log(`${item.type} speech started`);
    
    utterance.onend = () => {
        console.log(`${item.type} speech ended`);
        
        // If this is a departure message that needs to repeat
        if (item.type === 'departure' && item.repeat) {
            // Add a modified version back to the queue that won't repeat again
            speechQueue.push({
                text: item.text,
                type: item.type,
                repeat: false
            });
        }
        
        // Remove the current item from the queue
        speechQueue.shift();
        
        // Add a small delay before processing the next item
        setTimeout(() => {
            processSpeechQueue();
        }, 500);
    };
    
    utterance.onerror = (event) => {
        console.error(`Speech error (${event.error}):`, event);
        
        // Handle the error by moving to the next item
        speechQueue.shift();
        
        // Add a small delay before processing the next item
        setTimeout(() => {
            processSpeechQueue();
        }, 500);
    };
    
    // Speak with a small initial delay to ensure system is ready
    setTimeout(() => {
        try {
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error speaking:', error);
            
            // Move to the next item on error
            speechQueue.shift();
            processSpeechQueue();
        }
    }, 100);
}

function updateTimeBasedStyling() {
    const allTables = document.querySelectorAll('.timetable-section table');
    
    allTables.forEach(table => {
        const cells = table.querySelectorAll('td');
        cells.forEach(cell => {
            if (cell.textContent) {
                // Remove all time-related classes
                cell.classList.remove('past', 'time-five', 'time-fifteen', 'time-thirty', 'announced');
                
                // Add new time status class if applicable
                const timeStatus = getTimeStatus(cell.textContent);
                if (timeStatus) {
                    cell.classList.add(timeStatus);
                }
            }
        });
    });
}

function showTable() {
    // Check if there's an active table first
    const activeTableElement = document.querySelector('.timetable-section.active');
    const previousTable = activeTableElement ? activeTableElement.id : null;
    
    const select = document.getElementById('table-select');
    const maskewSection = document.getElementById('maskew-section');
    const marketSection = document.getElementById('market-section');
    const fengateSection = document.getElementById('fengate-section');

    // Remove active class from all sections
    maskewSection.classList.remove('active');
    marketSection.classList.remove('active');
    fengateSection.classList.remove('active');

    // Add active class to selected section
    if (select.value === 'maskew') {
        maskewSection.classList.add('active');
        saveLastViewedTable('maskew');
    } else if (select.value === 'market') {
        marketSection.classList.add('active');
        saveLastViewedTable('market');
    } else if (select.value === 'fengate') {
        fengateSection.classList.add('active');
        saveLastViewedTable('fengate');
    }

    // Reset all checks to force rechecking
    lastDepartureCheck = null;
    lastFiveMinuteCheck = null;
    fiveMinuteWarningActive = false;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;
    
    // Clear existing messages and reset announced state
    const departureMessage = document.getElementById('departure-message');
    departureMessage.classList.remove('active');
    
    // Only reset the announced class for cells in the previous table
    if (previousTable) {
        document.querySelectorAll(`#${previousTable} td`).forEach(cell => {
            cell.classList.remove('announced');
        });
    }
    
    // Check both types of messages immediately after switching tables
    checkDepartures();
    checkUpcomingDepartures();
}

function updateTimestamp() {
    const timestamps = document.querySelectorAll('.timestamp');
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const formattedTimestamp = `Last updated: ${dateString} at ${timeString}`;
    
    // Update all timestamp elements
    timestamps.forEach(timestamp => {
        timestamp.textContent = formattedTimestamp;
    });

    // Fallback for specific IDs if needed
    const maskewTimestamp = document.querySelector('#maskew-section .timestamp');
    const marketTimestamp = document.querySelector('#market-section .timestamp');
    const fengateTimestamp = document.querySelector('#fengate-section .timestamp');
    
    if (maskewTimestamp) maskewTimestamp.textContent = formattedTimestamp;
    if (marketTimestamp) marketTimestamp.textContent = formattedTimestamp;
    if (fengateTimestamp) fengateTimestamp.textContent = formattedTimestamp;
}

function getTimeStatus(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return '';
    
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const timeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    const diffMinutes = (timeToday - now) / (1000 * 60);

    if (diffMinutes < 0) {
        return 'past';
    } else if (diffMinutes <= 5) {
        return 'time-five';
    } else if (diffMinutes <= 15) {
        return 'time-fifteen';
    } else if (diffMinutes <= 30) {
        return 'time-thirty';
    }
    return '';
}

function createEmptyTimeGrid(locations) {
    const grid = {};
    locations.forEach(location => {
        grid[location] = {};
    });
    return grid;
}

// Function to normalize time format for comparisons
function normalizeTimeFormat(timeStr) {
    if (!timeStr) return '';
    
    // Check if this is a time format with a colon
    if (!timeStr.includes(':')) {
        return timeStr; // Return special text as-is
    }
    
    // Extract hours and minutes for regular time format
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Return standardized format with leading zeros
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Function to get active departures based on actual day
async function getActualDayDepartures(currentTime) {
    const now = new Date();
    const isActuallyWeekend = now.getDay() === 6; // 6 is Saturday
    const normalizedCurrentTime = normalizeTimeFormat(currentTime);
    
    console.log(`Checking actual day departures for time: ${normalizedCurrentTime}, is weekend: ${isActuallyWeekend}`);
    
    try {
        // Get appropriate data
        const maskewData = await window.firebaseApi.getMaskewData();
        const marketData = await window.firebaseApi.getMarketData();
        const fengateData = await window.firebaseApi.getFengateData();
        const ibtData = await window.firebaseApi.getIBTData();
        
        let allDepartedVans = [];
        
        // Process Maskew Avenue
        const tableName = 'Maskew Avenue';
        maskewData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const normalizedTime = normalizeTimeFormat(time);
                        if (normalizedTime === normalizedCurrentTime) {
                            allDepartedVans.push({
                                location: location,
                                suffix: '',
                                depot: tableName,
                                tableId: 'maskew-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process Market Deeping
        const marketTableName = 'Market Deeping';
        marketData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const normalizedTime = normalizeTimeFormat(time);
                        if (normalizedTime === normalizedCurrentTime) {
                            allDepartedVans.push({
                                location: location,
                                suffix: '',
                                depot: marketTableName,
                                tableId: 'market-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process Fengate
        const fengateTableName = 'Fengate';
        fengateData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const normalizedTime = normalizeTimeFormat(time);
                        if (normalizedTime === normalizedCurrentTime) {
                            allDepartedVans.push({
                                location: location,
                                suffix: '',
                                depot: fengateTableName,
                                tableId: 'fengate-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process IBT times
        const maskewIBTTimes = isActuallyWeekend ? 
            ibtData.maskew_avenue_saturday_times : 
            ibtData.maskew_avenue_weekday_times;
            
        for (let i = 0; i < Object.keys(maskewIBTTimes).length; i++) {
            const time = maskewIBTTimes[i];
            const normalizedTime = normalizeTimeFormat(time);
            if (normalizedTime === normalizedCurrentTime) {
                allDepartedVans.push({
                    location: 'IBT',
                    suffix: 'HD',
                    depot: 'Maskew Avenue',
                    tableId: 'maskew-section'
                });
            }
        }
        
        const marketIBTTimes = isActuallyWeekend ? 
            ibtData.market_deeping_saturday_times : 
            ibtData.market_deeping_weekday_times;
            
        for (let i = 0; i < Object.keys(marketIBTTimes).length; i++) {
            const time = marketIBTTimes[i];
            const normalizedTime = normalizeTimeFormat(time);
            if (normalizedTime === normalizedCurrentTime) {
                allDepartedVans.push({
                    location: 'IBT',
                    suffix: 'MD',
                    depot: 'Market Deeping',
                    tableId: 'market-section'
                });
            }
        }
        
        if (allDepartedVans.length > 0) {
            console.log('Found actual day departures:', allDepartedVans.map(v => `${v.depot}-${v.location} at ${normalizedCurrentTime}`));
        }
        
        return allDepartedVans;
    } catch (error) {
        console.error('Error getting actual day departures:', error);
        return [];
    }
}

// Function to get upcoming departures based on actual day
async function getActualDayUpcomingDepartures() {
    const now = new Date();
    const isActuallyWeekend = now.getDay() === 6; // 6 is Saturday
    const currentTime = now.getTime();
    
    try {
        // Get appropriate data
        const maskewData = await window.firebaseApi.getMaskewData();
        const marketData = await window.firebaseApi.getMarketData();
        const fengateData = await window.firebaseApi.getFengateData();
        const ibtData = await window.firebaseApi.getIBTData();
        
        let allUpcomingDepartures = [];
        
        // Process Maskew Avenue
        const tableName = 'Maskew Avenue';
        maskewData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const [hours, minutes] = normalizeTimeFormat(time).split(':').map(Number);
                        const departureTime = new Date(now);
                        departureTime.setHours(hours, minutes, 0, 0);
                        
                        const timeDiff = departureTime - currentTime;
                        const diffMinutes = timeDiff / (1000 * 60);
                        
                        // Widened time window for more reliable detection
                        if (diffMinutes >= 4.95 && diffMinutes <= 5.05) {
                            allUpcomingDepartures.push({
                                location: location,
                                time: time,
                                depot: tableName,
                                tableId: 'maskew-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process Market Deeping
        const marketTableName = 'Market Deeping';
        marketData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const [hours, minutes] = normalizeTimeFormat(time).split(':').map(Number);
                        const departureTime = new Date(now);
                        departureTime.setHours(hours, minutes, 0, 0);
                        
                        const timeDiff = departureTime - currentTime;
                        const diffMinutes = timeDiff / (1000 * 60);
                        
                        // Widened time window for more reliable detection
                        if (diffMinutes >= 4.95 && diffMinutes <= 5.05) {
                            allUpcomingDepartures.push({
                                location: location,
                                time: time,
                                depot: marketTableName,
                                tableId: 'market-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process Fengate
        const fengateTableName = 'Fengate';
        fengateData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isActuallyWeekend ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        if (!time.includes(':')) return;
                        const [hours, minutes] = normalizeTimeFormat(time).split(':').map(Number);
                        const departureTime = new Date(now);
                        departureTime.setHours(hours, minutes, 0, 0);
                        
                        const timeDiff = departureTime - currentTime;
                        const diffMinutes = timeDiff / (1000 * 60);
                        
                        // Widened time window for more reliable detection
                        if (diffMinutes >= 4.95 && diffMinutes <= 5.05) {
                            allUpcomingDepartures.push({
                                location: location,
                                time: time,
                                depot: fengateTableName,
                                tableId: 'fengate-section'
                            });
                        }
                    });
                }
            }
        });
        
        // Process IBT times
        const maskewIBTTimes = isActuallyWeekend ? 
            ibtData.maskew_avenue_saturday_times : 
            ibtData.maskew_avenue_weekday_times;
            
        for (let i = 0; i < Object.keys(maskewIBTTimes).length; i++) {
            const time = maskewIBTTimes[i];
            if (time) {
                const [hours, minutes] = normalizeTimeFormat(time).split(':').map(Number);
                const departureTime = new Date(now);
                departureTime.setHours(hours, minutes, 0, 0);
                
                const timeDiff = departureTime - currentTime;
                const diffMinutes = timeDiff / (1000 * 60);
                
                // Widened time window for more reliable detection
                if (diffMinutes >= 4.95 && diffMinutes <= 5.05) {
                    allUpcomingDepartures.push({
                        location: 'IBT',
                        time: time,
                        suffix: 'HD',
                        depot: 'Maskew Avenue',
                        tableId: 'maskew-section'
                    });
                }
            }
        }
        
        const marketIBTTimes = isActuallyWeekend ? 
            ibtData.market_deeping_saturday_times : 
            ibtData.market_deeping_weekday_times;
            
        for (let i = 0; i < Object.keys(marketIBTTimes).length; i++) {
            const time = marketIBTTimes[i];
            if (time) {
                const [hours, minutes] = normalizeTimeFormat(time).split(':').map(Number);
                const departureTime = new Date(now);
                departureTime.setHours(hours, minutes, 0, 0);
                
                const timeDiff = departureTime - currentTime;
                const diffMinutes = timeDiff / (1000 * 60);
                
                // Widened time window for more reliable detection
                if (diffMinutes >= 4.95 && diffMinutes <= 5.05) {
                    allUpcomingDepartures.push({
                        location: 'IBT',
                        time: time,
                        suffix: 'MD',
                        depot: 'Market Deeping',
                        tableId: 'market-section'
                    });
                }
            }
        }
        
        if (allUpcomingDepartures.length > 0) {
            console.log('Found upcoming departures:', allUpcomingDepartures.map(d => `${d.depot}-${d.location} at ${d.time}`));
        }
        
        return allUpcomingDepartures;
    } catch (error) {
        console.error('Error getting actual day upcoming departures:', error);
        return [];
    }
}

function checkDepartures() {
    if (window.electron) {
        window.electron.wakeUp();
    }
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    
    const currentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
    const timeKey = `${currentHours}:${currentMinutes}`;
    
    if (currentSeconds > 2 && timeKey === lastDepartureCheck) return;

    // Now check for actual day departures for notifications
    getActualDayDepartures(currentTime).then(actualDepartedVans => {
        // Send desktop notification for actual day departures
        if (actualDepartedVans.length > 0) {
            const departureKey = `${currentHours}:${currentMinutes}`;
            if (departureKey !== lastDepartureNotificationTime) {
                if (window.electron) {
                    window.electron.wakeUp();
                }

                // Force a small delay to ensure system is awake
                setTimeout(() => {
                    const notificationTitle = actualDepartedVans.length > 1 ? 
                        'MULTIPLE VANS DEPARTED' : 
                        'VAN DEPARTED';
                    
                    const notificationBody = actualDepartedVans.map(van => 
                        `${van.depot} - ${van.location}${van.suffix ? ` (${van.suffix})` : ''}`
                    ).join(', ');

                    showDesktopNotification(notificationTitle, notificationBody);
                    lastDepartureNotificationTime = departureKey;
                }, 100);
            }
        }

        // Handle on-screen message and announcement for actual day departures
        const activeTable = document.querySelector('.timetable-section.active');
        
        if (!activeTable) return;
        
        // Filter for active table departures from actual schedule
        let activeActualDepartures = actualDepartedVans.filter(van => 
            van.tableId === activeTable.id && van.location !== 'IBT'
        );

        if (activeActualDepartures.length > 0 && timeKey !== lastDepartureCheck) {
            const departureMessage = document.getElementById('departure-message');
            const mainMessage = departureMessage.querySelector('.main-message');
            const detailMessage = departureMessage.querySelector('.detail-message');
            
            let spokenMessage;
            if (activeActualDepartures.length === 1) {
                const van = activeActualDepartures[0];
                const spokenTime = formatTimeForSpeech(currentTime);
                const spokenLocation = formatLocationForSpeech(van.location);
                spokenMessage = `Your attention please. The van to ${spokenLocation} has now departed at ${spokenTime}`;
            } else {
                const locations = activeActualDepartures.map(van => formatLocationForSpeech(van.location)).join(' and ');
                const spokenTime = formatTimeForSpeech(currentTime);
                spokenMessage = `Your attention please. Multiple vans have now departed at ${spokenTime}. Vans to ${locations} have left`;
            }
            
            // Ensure message is properly trimmed
            spokenMessage = spokenMessage.trim();
            
            speakDepartureMessage(spokenMessage);
                
            // On-screen message
            mainMessage.textContent = activeActualDepartures.length > 1 ? 
                'MULTIPLE VANS DEPARTED' : 
                'VAN DEPARTED';
                    
            const details = activeActualDepartures.map(van => 
                `${van.location}${van.suffix ? ` (${van.suffix})` : ''}`
            ).join(', ');
            detailMessage.textContent = details;
                
            departureMessage.classList.add('active');
                
            setTimeout(() => {
                departureMessage.classList.remove('active');
            }, 60000);

            lastDepartureCheck = timeKey;
        }
    });
}

function checkUpcomingDepartures() {
    if (window.electron) {
        window.electron.wakeUp();
    }
    const now = new Date();
    const currentTime = now.getTime();
    const currentMinute = `${now.getHours()}:${now.getMinutes()}`;
    
    if (fiveMinuteWarningActive && currentMinute === lastFiveMinuteCheck) return;

    // Get active table first as we'll need it for checks
    const activeTable = document.querySelector('.timetable-section.active');
    if (!activeTable) return;

    // Now check for actual day upcoming departures for notifications
    getActualDayUpcomingDepartures().then(actualUpcomingDepartures => {
        // Send desktop notifications for ALL upcoming departures from actual schedule
        if (actualUpcomingDepartures.length > 0) {
            const currentKey = `${now.getHours()}:${now.getMinutes()}`;
            if (currentKey !== lastFiveMinuteNotificationTime) {
                if (window.electron) {
                    window.electron.wakeUp();
                }
                
                // Force a small delay to ensure system is awake
                setTimeout(() => {
                    const notificationTitle = '5 MINUTES TO DEPARTURE' + 
                        (actualUpcomingDepartures.length > 1 ? 'S' : '');
                    const notificationBody = actualUpcomingDepartures
                        .map(dep => `${dep.depot} - ${dep.location} at ${dep.time}`)
                        .join(', ');

                    showDesktopNotification(notificationTitle, notificationBody);
                    lastFiveMinuteNotificationTime = currentKey;
                }, 100);
            }
        }
        
        // Filter for non-IBT departures from active table only in actual schedule
        let activeActualUpcomingDepartures = actualUpcomingDepartures.filter(dep => {
            return dep.tableId === activeTable.id && dep.location !== 'IBT';
        });

        // Handle on-screen message and announcement for actual schedule
        if (activeActualUpcomingDepartures.length > 0) {
            const departureMessage = document.getElementById('departure-message');
            const mainMessage = departureMessage.querySelector('.main-message');
            const detailMessage = departureMessage.querySelector('.detail-message');

            let spokenMessage;
            if (activeActualUpcomingDepartures.length === 1) {
                const spokenTime = formatTimeForSpeech(activeActualUpcomingDepartures[0].time);
                const spokenLocation = formatLocationForSpeech(activeActualUpcomingDepartures[0].location);
                
                // Remove leading spaces and ensure clean formatting
                spokenMessage = `Your attention please. The van to ${spokenLocation} will be departing in 5 minutes at ${spokenTime}`;
            } else {
                const locationList = activeActualUpcomingDepartures
                    .map(dep => formatLocationForSpeech(dep.location))
                    .join(' and ');
                const spokenTime = formatTimeForSpeech(activeActualUpcomingDepartures[0].time);
                
                // Remove leading spaces and ensure clean formatting
                spokenMessage = `Your attention please. Multiple vans will be departing in 5 minutes. Vans to ${locationList} will depart at ${spokenTime}`;
            }       
            
            // Ensure message is properly trimmed
            spokenMessage = spokenMessage.trim();
            
            speakWarningMessage(spokenMessage);
            
            fiveMinuteWarningActive = true;
            lastFiveMinuteCheck = currentMinute;
            
            departureMessage.classList.add('active');
            
            // Mark cells in visible table as announced
            activeTable.querySelectorAll('td').forEach(cell => {
                activeActualUpcomingDepartures.forEach(dep => {
                    if (normalizeTimeFormat(cell.textContent) === normalizeTimeFormat(dep.time)) {
                        const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
                        const header = activeTable.querySelector(`th:nth-child(${cellIndex + 1})`);
                        if (header && header.textContent === dep.location) {
                            cell.classList.add('announced');
                        }
                    }
                });
            });
            
            setTimeout(() => {
                departureMessage.classList.remove('active');
                fiveMinuteWarningActive = false;
            }, 60000);
        }
    });
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    document.getElementById('clock').textContent = timeString;
    
    // Check if day has changed and update toggle accordingly
    const isSaturday = now.getDay() === 6;
    const dayToggle = document.getElementById('day-toggle');

    // Get the last time the toggle was manually changed
    const lastToggleTime = parseInt(sessionStorage.getItem('lastToggleTime') || '0');
    const currentTime = now.getTime();
    const fiveMinutesAgo = currentTime - (5 * 60 * 1000); // 5 minutes in milliseconds

    // Only auto-switch if the user hasn't manually toggled in the last 5 minutes
    if (lastToggleTime < fiveMinutesAgo) {
        if (isSaturday && !useWeekendTimes) {
            // Switch to weekend mode on Saturday
            useWeekendTimes = true;
            dayToggle.checked = true;
            saveToggleState(true);
            loadTimetableData(); // Reload with weekend times
            console.log('Automatically switched to weekend mode');
        } else if (!isSaturday && useWeekendTimes) {
            // Switch back to weekday mode on other days
            useWeekendTimes = false;
            dayToggle.checked = false;
            saveToggleState(false);
            loadTimetableData(); // Reload with weekday times
            console.log('Automatically switched to weekday mode');
        }
    }
    
    // Check for departures and upcoming departures
    checkDepartures();
    checkUpcomingDepartures();

    // Reset time-based styling at midnight
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        // Reload timetable data to reset for the new day
        loadTimetableData();
    }

    // Update time-based styling every minute
    if (now.getSeconds() === 0) {
        updateTimeBasedStyling();
    }
}

async function loadTimetableData() {
    showError('');
    showLoading(true);
    
    try {
        // Use the exposed Firebase API (now using local data)
        const maskewData = await window.firebaseApi.getMaskewData();
        const marketData = await window.firebaseApi.getMarketData();
        const fengateData = await window.firebaseApi.getFengateData();
        const ibtData = await window.firebaseApi.getIBTData();

        // Use the toggle state instead of checking actual day
        const isSaturday = useWeekendTimes;

        const maskewLocations = [
            'ST IVES',
            'HUNTINGDON',
            'WHITTLESEY & TURVES',
            'CHATTERIS',
            'RAMSEY',
            'SAWTRY',
            'OUNDLE & NASSINGTON',
            'IBT'
        ];

        const marketLocations = [
            'BOURNE',
            'BOURNE NORTH',
            'HOLBEACH',
            'SPALDING & PINCHBECK',
            'BOSTON',
            'OAKHAM',
            'UPPINGHAM',
            'MARCH WISBECH',
            'IBT'
        ];

        const fengateLocations = [
            'OXNEY ROAD',
            'BOONGATE',
            'FENGATE ROAD'
        ];

        // Process Maskew Avenue data
        const maskewGrid = createEmptyTimeGrid(maskewLocations);
        const allMaskewTimes = new Set();

        // Add IBT times for Maskew
        const maskewIBTTimes = isSaturday ? 
            ibtData.maskew_avenue_saturday_times : 
            ibtData.maskew_avenue_weekday_times;

        // Process IBT times for Maskew
        for (let i = 0; i < Object.keys(maskewIBTTimes).length; i++) {
            const time = maskewIBTTimes[i];
            if (time) {
                allMaskewTimes.add(normalizeTimeFormat(time));
                if (!maskewGrid['IBT']) maskewGrid['IBT'] = {};
                maskewGrid['IBT'][normalizeTimeFormat(time)] = { time: normalizeTimeFormat(time), suffix: 'HD' };
            }
        }

        // Process regular stop times for Maskew
        maskewData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isSaturday ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        const normalizedTime = normalizeTimeFormat(time);
                        allMaskewTimes.add(normalizedTime);
                        if (!maskewGrid[location]) maskewGrid[location] = {};
                        maskewGrid[location][normalizedTime] = { time: normalizedTime };
                    });
                }
            }
        });

        // Process Market Deeping data
        const marketGrid = createEmptyTimeGrid(marketLocations);
        const allMarketTimes = new Set();

        // Add IBT times for Market
        const marketIBTTimes = isSaturday ? 
            ibtData.market_deeping_saturday_times : 
            ibtData.market_deeping_weekday_times;

        // Process IBT times for Market
        for (let i = 0; i < Object.keys(marketIBTTimes).length; i++) {
            const time = marketIBTTimes[i];
            if (time) {
                const normalizedTime = normalizeTimeFormat(time);
                allMarketTimes.add(normalizedTime);
                if (!marketGrid['IBT']) marketGrid['IBT'] = {};
                marketGrid['IBT'][normalizedTime] = { time: normalizedTime, suffix: 'MD' };
            }
        }

        // Process regular stop times for Market
        marketData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isSaturday ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        const normalizedTime = normalizeTimeFormat(time);
                        allMarketTimes.add(normalizedTime);
                        if (!marketGrid[location]) marketGrid[location] = {};
                        marketGrid[location][normalizedTime] = { time: normalizedTime };
                    });
                }
            }
        });

        // Process Fengate data
        const fengateGrid = createEmptyTimeGrid(fengateLocations);
        const allFengateTimes = new Set();

        // Process regular stop times for Fengate
        fengateData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isSaturday ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        const normalizedTime = normalizeTimeFormat(time);
                        allFengateTimes.add(normalizedTime);
                        if (!fengateGrid[location]) fengateGrid[location] = {};
                        fengateGrid[location][normalizedTime] = { time: normalizedTime };
                    });
                }
            }
        });

        // Render all tables
        function renderTable(bodyId, times, locations, grid) {
            const tableBody = document.getElementById(bodyId);
            tableBody.innerHTML = '';

            Array.from(times).sort((a, b) => {
                const timeA = new Date(`1970/01/01 ${a}`);
                const timeB = new Date(`1970/01/01 ${b}`);
                return timeA - timeB;
            }).forEach(time => {
                const row = document.createElement('tr');
                locations.forEach(location => {
                    const cell = document.createElement('td');
                    const value = grid[location][time];
                    const timeStatus = getTimeStatus(time);
                    
                    cell.className = timeStatus;
                    if (value) {
                        cell.textContent = value.time;
                        if (value.suffix) {
                            cell.dataset.suffix = value.suffix;
                        }
                    }
                    row.appendChild(cell);
                });
                tableBody.appendChild(row);
            });
        }

        // Render all tables
        renderTable('maskew-body', allMaskewTimes, maskewLocations, maskewGrid);
        renderTable('market-body', allMarketTimes, marketLocations, marketGrid);
        renderTable('fengate-body', allFengateTimes, fengateLocations, fengateGrid);

        // Update subtitles
        const maskewSubtitle = document.querySelector('#maskew-section .subtitle');
        const marketSubtitle = document.querySelector('#market-section .subtitle');
        const fengateSubtitle = document.querySelector('#fengate-section .subtitle');
        
        if (isSaturday) {
            maskewSubtitle.textContent = 'SATURDAY RUNS';
            marketSubtitle.textContent = 'SATURDAY RUNS';
            fengateSubtitle.textContent = 'SATURDAY RUNS';
        } else {
            maskewSubtitle.textContent = 'OUT OF TOWN RUNS FOR MONDAY - FRIDAY';
            marketSubtitle.textContent = 'RUNS FOR MONDAY - FRIDAY';
            fengateSubtitle.textContent = 'RUNS FOR MONDAY - FRIDAY';
        }

        // Reset cell classes
        const allCells = document.querySelectorAll('td');
        allCells.forEach(cell => {
            cell.classList.remove('past', 'time-five', 'time-fifteen', 'time-thirty', 'announced');
        });

        updateTimestamp();
        updateTimeBasedStyling();

    } catch (error) {
        console.error("Error loading data:", error);
        showError("Failed to load timetable data. Please try again.");
    } finally {
        showLoading(false);
    }
}

// Add this utility function to format time for speech
function formatTimeForSpeech(timeStr) {
    if (!timeStr) return '';
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Convert to 12-hour format
    let hour = hours % 12;
    if (hour === 0) hour = 12; // Convert 0 to 12 for 12 AM/PM
    
    // Format minutes
    let minuteStr = '';
    if (minutes > 0) {
      minuteStr = ` ${minutes}`;
      if (minutes < 10) {
        // For single digit minutes, we want "oh five" not "five"
        minuteStr = ` oh ${minutes}`;
      }
    }
    
    // Add AM/PM
    const period = hours >= 12 ? 'PM' : 'AM';
    
    return `${hour}${minuteStr} ${period}`;
  }

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Add this inside your DOMContentLoaded event listener
    if (window.electron) {
        window.electron.onDarkModeToggle((isDark) => {
            if (isDark) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            console.log('Dark mode toggled:', isDark);
        });
    }

    await requestNotificationPermission();
    document.getElementById('table-select').addEventListener('change', showTable);
    document.getElementById('refresh-button').addEventListener('click', async () => {
        // Show loading indicator
        showLoading(true);
        
        try {
            // Check for remote updates with auto-download disabled (we'll handle it manually)
            const updateAvailable = await dataManager.checkForRemoteUpdates(false);
            
            if (updateAvailable) {
                // Automatically download the update without confirmation
                const updated = await dataManager.downloadLatestData();
                if (updated) {
                    // Reload the timetable with new data
                    loadTimetableData();
                    
                    // The dataManager.downloadLatestData() function already shows a notification
                    // in the corner via showUpdateCompletedNotification()
                }
            } else {
                // Show a small notification that data is already up to date
                const notification = document.createElement('div');
                notification.style.position = 'fixed';
                notification.style.bottom = '20px';
                notification.style.right = '20px';
                notification.style.backgroundColor = '#4CAF50';
                notification.style.color = 'white';
                notification.style.padding = '10px 20px';
                notification.style.borderRadius = '5px';
                notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                notification.style.zIndex = '1000';
                notification.textContent = 'Schedule data is already up to date';
                
                document.body.appendChild(notification);
                
                // Remove after 3 seconds
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 3000);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            
            // Show error notification
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.backgroundColor = '#f44336';
            notification.style.color = 'white';
            notification.style.padding = '10px 20px';
            notification.style.borderRadius = '5px';
            notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            notification.style.zIndex = '1000';
            notification.textContent = 'Error refreshing data. Please try again.';
            
            document.body.appendChild(notification);
            
            // Remove after 3 seconds
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 3000);
        } finally {
            // Hide loading indicator
            showLoading(false);
        }
    });
    // Initialize the toggle based on current day
    const dayToggle = document.getElementById('day-toggle');


    // Set toggle based on saved state or current day
    const today = new Date();
    const isSaturday = today.getDay() === 6;
    useWeekendTimes = getToggleState() || isSaturday;
    dayToggle.checked = useWeekendTimes;

    // Add event listener for toggle
    dayToggle.addEventListener('change', function() {
        useWeekendTimes = this.checked;
        saveToggleState(useWeekendTimes);
    
        // Save the time of manual toggle
        sessionStorage.setItem('lastToggleTime', new Date().getTime().toString());
    
        loadTimetableData(); // Reload the timetable with new setting
    });
    
    // Volume control keyboard events
    document.addEventListener('keydown', (event) => {
        // Plus key (+) to increase volume
        if (event.key === '+' || event.key === '=') {
            setAnnouncementVolume(speechVolume + 0.1);
        }
        // Minus key (-) to decrease volume
        if (event.key === '-' || event.key === '_') {
            setAnnouncementVolume(speechVolume - 0.1);
        }
    });

    // Initialize speech synthesis and load voices
    window.speechSynthesis.getVoices();
    
    // Handle voice loading
    window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
        
        // Try to set default British voice
        const britishVoice = voices.find(voice => voice.lang === 'en-GB');
        if (britishVoice) {
            console.log('Found British voice:', britishVoice.name);
            window.defaultVoice = britishVoice;
        }
    };
    
    // Test speech synthesis
    setTimeout(() => {
        addToSpeechQueue({
            text: 'Speech system initialized',
            type: 'system',
            repeat: false
        });
    }, 2000);
    
    // Initialize the data manager and then load the timetable
    await dataManager.initialize();
    console.log(`Using data version: ${dataManager.getDataVersion()}`);
    dataManager.startPeriodicUpdates(); // Start checking for updates every hour
    // Start the intervals
    setInterval(updateClock, 1000);
    setInterval(updateTimeBasedStyling, 10000);
    setInterval(checkDepartures, 1000);
    setInterval(checkUpcomingDepartures, 1000);
    
    updateClock();

    // Initial load with table selection handling
    loadTimetableData().then(() => {
        // Get the selected table value from last session or default to maskew
        const lastTable = getLastViewedTable();
        const tableSelect = document.getElementById('table-select');
        tableSelect.value = lastTable;
        
        // Show the appropriate table
        const maskewSection = document.getElementById('maskew-section');
        const marketSection = document.getElementById('market-section');
        const fengateSection = document.getElementById('fengate-section');
        
        maskewSection.classList.remove('active');
        marketSection.classList.remove('active');
        fengateSection.classList.remove('active');
        
        if (lastTable === 'maskew') {
            maskewSection.classList.add('active');
        } else if (lastTable === 'market') {
            marketSection.classList.add('active');
        } else if (lastTable === 'fengate') {
            fengateSection.classList.add('active');
        }
        
        showTable();
        
        // Run initial checks to make sure we catch any departures
        setTimeout(() => {
            console.log("Running initial departure checks...");
            checkDepartures();
            checkUpcomingDepartures();
        }, 3000);
    }).catch(error => {
        console.error('Error in initial load:', error);
        showError("Failed to load initial data. Please refresh the page.");
    });
});