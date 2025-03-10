// Initialize speech synthesis
const speechSynthesis = window.speechSynthesis;

// Global variables
let lastDepartureCheck = null;
let lastFiveMinuteCheck = null;
let fiveMinuteWarningActive = false;
let lastDepartureNotificationTime = null;
let lastFiveMinuteNotificationTime = null;
let speechVolume = 1.0;
let useWeekendTimes = false; // ADD THIS LINE

// Dark mode initialization
if (window.electron) {
    window.electron.onDarkModeToggle((isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });

    // Check for saved preference
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
    }
}

// Add these functions near the top of script.js
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
// Add these two new functions here
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

// Add the new notification functions here
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
    console.log('Speaking departure message:', message);
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Function to create and speak an utterance
    function speak() {
        const utterance = new SpeechSynthesisUtterance(message);
        
        // Set voice preferences
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = speechVolume;
        
        if (window.defaultVoice) {
            utterance.voice = window.defaultVoice;
        }
        
        utterance.onstart = () => console.log('Departure speech started:', message);
        utterance.onend = () => console.log('Departure speech ended:', message);
        utterance.onerror = (event) => console.error('Departure speech error:', event);
        
        window.speechSynthesis.speak(utterance);
    }
    
    // Speak first time
    setTimeout(() => {
        speak();
        
        // Speak second time after 20 seconds
        setTimeout(() => {
            speak();
        }, 20000);
    }, 100);
}

function speakWarningMessage(message) {
    console.log('Speaking warning message:', message);
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(message);
    
    // Set voice preferences
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = speechVolume;
    
    if (window.defaultVoice) {
        utterance.voice = window.defaultVoice;
    }
    
    utterance.onstart = () => console.log('Warning speech started:', message);
    utterance.onend = () => console.log('Warning speech ended:', message);
    utterance.onerror = (event) => console.error('Warning speech error:', event);
    
    // Speak once with small initial delay
    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
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
    speechSynthesis.cancel();
    
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
    if (!timeStr) return '';
    
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const timeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    const diffMinutes = (timeToday - now) / (1000 * 60);

    // Debug logging
    console.log(`Time: ${timeStr}, Diff Minutes: ${diffMinutes}`);

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

    // Check ALL tables for desktop notifications
    const tables = document.querySelectorAll('.timetable-section');
    let allDepartedVans = [];
    
    tables.forEach(table => {
        const tableName = table.id === 'maskew-section' ? 'Maskew Avenue' : 
                         table.id === 'market-section' ? 'Market Deeping' : 
                         'Fengate';
        const allRows = table.querySelectorAll('tr');
        
        allRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (cell.textContent === currentTime) {
                    const header = table.querySelector('th:nth-child(' + (index + 1) + ')');
                    const location = header.textContent;
                    const suffix = cell.dataset.suffix || '';
                    
                    allDepartedVans.push({
                        location: location,
                        suffix: suffix,
                        depot: tableName,
                        tableId: table.id
                    });
                }
            });
        });
    });

    // Send desktop notification for ALL departures including IBT
    if (allDepartedVans.length > 0) {
        const departureKey = `${currentHours}:${currentMinutes}`;
        if (departureKey !== lastDepartureNotificationTime) {
            if (window.electron) {
                window.electron.wakeUp();
            }

            // Force a small delay to ensure system is awake
            setTimeout(() => {
                const notificationTitle = allDepartedVans.length > 1 ? 
                    'MULTIPLE VANS DEPARTED' : 
                    'VAN DEPARTED';
                
                const notificationBody = allDepartedVans.map(van => 
                    `${van.depot} - ${van.location}${van.suffix ? ` (${van.suffix})` : ''}`
                ).join(', ');

                showDesktopNotification(notificationTitle, notificationBody);
                lastDepartureNotificationTime = departureKey;
            }, 100);
        }
    }

    // Check ACTIVE table for on-screen message and announcement
    const activeTable = document.querySelector('.timetable-section.active');
    if (!activeTable) return;
    
    // Filter for active table departures
    let activeDepartedVans = allDepartedVans.filter(van => 
        van.tableId === activeTable.id && van.location !== 'IBT'
    );

    let hasNonIBTDeparture = activeDepartedVans.length > 0;

    const departureMessage = document.getElementById('departure-message');
    const mainMessage = departureMessage.querySelector('.main-message');
    const detailMessage = departureMessage.querySelector('.detail-message');
    
    // Only show on-screen message and play announcement if there are non-IBT departures
    if (hasNonIBTDeparture && timeKey !== lastDepartureCheck) {
        let spokenMessage;
        if (activeDepartedVans.length === 1) {
            const van = activeDepartedVans[0];
            spokenMessage = `  Your attention please. The van to ${van.location} has now departed at ${currentTime}`;
        } else {
            const locations = activeDepartedVans.map(van => van.location).join(' and ');
            spokenMessage = `  Your attention please. Multiple vans have now departed at ${currentTime}. Vans to ${locations} have left`;
        }
        
        speakDepartureMessage(spokenMessage);
        
        // On-screen message for active table only
        mainMessage.textContent = activeDepartedVans.length > 1 ? 
            'MULTIPLE VANS DEPARTED' : 
            'VAN DEPARTED';
            
        const details = activeDepartedVans.map(van => 
            `${van.location}${van.suffix ? ` (${van.suffix})` : ''}`
        ).join(', ');
        detailMessage.textContent = details;
        
        departureMessage.classList.add('active');
        
        setTimeout(() => {
            departureMessage.classList.remove('active');
        }, 60000);

        lastDepartureCheck = timeKey;
    }
}

function checkUpcomingDepartures() {
    if (window.electron) {
        window.electron.wakeUp();
    }
    const now = new Date();
    const currentTime = now.getTime();
    const currentMinute = `${now.getHours()}:${now.getMinutes()}`;
    
    // Get active table first as we'll need it for checks
    const activeTable = document.querySelector('.timetable-section.active');
    if (!activeTable) return;
    
    if (fiveMinuteWarningActive && currentMinute === lastFiveMinuteCheck) return;
    
    // Check ALL tables for desktop notifications
    const tables = document.querySelectorAll('.timetable-section');
    let allUpcomingDepartures = [];
    
    tables.forEach(table => {
        const tableName = table.id === 'maskew-section' ? 'Maskew Avenue' : 
                         table.id === 'market-section' ? 'Market Deeping' : 
                         'Fengate';
        const allRows = table.querySelectorAll('tr');
        
        allRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                // Only check announced state for cells in the active table
                const isActiveTable = table.id === activeTable.id;
                if (cell.textContent && (!isActiveTable || !cell.classList.contains('announced'))) {
                    const header = table.querySelector('th:nth-child(' + (index + 1) + ')');
                    const location = header.textContent;
                    
                    const [hours, minutes] = cell.textContent.split(':').map(Number);
                    const departureTime = new Date(now);
                    departureTime.setHours(hours, minutes, 0, 0);
                    
                    const timeDiff = departureTime - currentTime;
                    const diffMinutes = timeDiff / (1000 * 60);
                    
                    if (diffMinutes >= 5 && diffMinutes <= 5.033) {
                        allUpcomingDepartures.push({
                            location: location,
                            time: cell.textContent,
                            cell: cell,
                            depot: tableName,
                            tableId: table.id
                        });
                    }
                }
            });
        });
    });

    // Send desktop notifications for ALL upcoming departures including IBT
    if (allUpcomingDepartures.length > 0) {
        const currentKey = `${now.getHours()}:${now.getMinutes()}`;
        if (currentKey !== lastFiveMinuteNotificationTime) {
            if (window.electron) {
                window.electron.wakeUp();
            }
            
            // Force a small delay to ensure system is awake
            setTimeout(() => {
                const notificationTitle = '5 MINUTES TO DEPARTURE' + 
                    (allUpcomingDepartures.length > 1 ? 'S' : '');
                const notificationBody = allUpcomingDepartures
                    .map(dep => `${dep.depot} - ${dep.location} at ${dep.time}`)
                    .join(', ');

                showDesktopNotification(notificationTitle, notificationBody);
                lastFiveMinuteNotificationTime = currentKey;
            }, 100);
        }
    }
    
    // Filter for non-IBT departures from active table only
    let activeUpcomingDepartures = allUpcomingDepartures.filter(dep => {
        return dep.tableId === activeTable.id && dep.location !== 'IBT';
    });

    if (activeUpcomingDepartures.length > 0) {
        const departureMessage = document.getElementById('departure-message');
        const mainMessage = departureMessage.querySelector('.main-message');
        const detailMessage = departureMessage.querySelector('.detail-message');

        let spokenMessage;
        if (activeUpcomingDepartures.length === 1) {
            mainMessage.textContent = '5 MINUTES TO DEPARTURE';
            detailMessage.textContent = `${activeUpcomingDepartures[0].location} departing at ${activeUpcomingDepartures[0].time}`;
            
            spokenMessage = `  Your attention please. The van to ${activeUpcomingDepartures[0].location} will be departing in 5 minutes at ${activeUpcomingDepartures[0].time}`;
        } else {
            mainMessage.textContent = '5 MINUTES TO MULTIPLE DEPARTURES';
            detailMessage.textContent = activeUpcomingDepartures
                .map(dep => `${dep.location} at ${dep.time}`)
                .join(', ');
            
            const locationList = activeUpcomingDepartures
                .map(dep => dep.location)
                .join(' and ');
            
            spokenMessage = `  Your attention please. Multiple vans will be departing in 5 minutes. Vans to ${locationList} will depart at ${activeUpcomingDepartures[0].time}`;
        }
        
        speakWarningMessage(spokenMessage);
        
        fiveMinuteWarningActive = true;
        lastFiveMinuteCheck = currentMinute;
        
        departureMessage.classList.add('active');
        
        activeUpcomingDepartures.forEach(dep => {
            dep.cell.classList.add('announced');
        });
        
        setTimeout(() => {
            departureMessage.classList.remove('active');
            fiveMinuteWarningActive = false;
        }, 60000);
    }
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    document.getElementById('clock').textContent = timeString;
    
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
        // Use the exposed Firebase API
        const maskewData = await window.firebaseApi.getMaskewData();
        const marketData = await window.firebaseApi.getMarketData();
        const fengateData = await window.firebaseApi.getFengateData(); // Add Fengate data
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
            'SPALDING/PINCHBECK',
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
                allMaskewTimes.add(time);
                if (!maskewGrid['IBT']) maskewGrid['IBT'] = {};
                maskewGrid['IBT'][time] = { time: time, suffix: 'HD' };
            }
        }

        // Process regular stop times for Maskew
        maskewData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isSaturday ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        allMaskewTimes.add(time);
                        if (!maskewGrid[location]) maskewGrid[location] = {};
                        maskewGrid[location][time] = { time: time };
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
                allMarketTimes.add(time);
                if (!marketGrid['IBT']) marketGrid['IBT'] = {};
                marketGrid['IBT'][time] = { time: time, suffix: 'MD' };
            }
        }

        // Process regular stop times for Market
        marketData.forEach(doc => {
            const location = doc.stop_name.toUpperCase();
            if (location !== 'IBT') {
                const times = isSaturday ? doc.saturday_times : doc.times;
                if (times) {
                    Object.values(times).forEach(time => {
                        allMarketTimes.add(time);
                        if (!marketGrid[location]) marketGrid[location] = {};
                        marketGrid[location][time] = { time: time };
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
                        allFengateTimes.add(time);
                        if (!fengateGrid[location]) fengateGrid[location] = {};
                        fengateGrid[location][time] = { time: time };
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await requestNotificationPermission();
    document.getElementById('table-select').addEventListener('change', showTable);
    document.getElementById('refresh-button').addEventListener('click', loadTimetableData);
    
    // Initialize the toggle based on current day
    const dayToggle = document.getElementById('day-toggle');

    // Save toggle state to sessionStorage (clears when app closes)
    function saveToggleState(isWeekend) {
        try {
            sessionStorage.setItem('useWeekendTimes', isWeekend ? 'true' : 'false');
        } catch (err) {
            console.error('Error saving toggle state:', err);
        }
    }

    // Get saved toggle state from sessionStorage
    function getToggleState() {
        try {
            const savedState = sessionStorage.getItem('useWeekendTimes');
            return savedState === 'true';
        } catch (err) {
            console.error('Error getting toggle state:', err);
            return false;
        }
    }

    // Set toggle based on saved state or current day
    const today = new Date();
    const isSaturday = today.getDay() === 6;
    useWeekendTimes = getToggleState() || isSaturday;
    dayToggle.checked = useWeekendTimes;

    // Add event listener for toggle
    dayToggle.addEventListener('change', function() {
        useWeekendTimes = this.checked;
        saveToggleState(useWeekendTimes);
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
        const testUtterance = new SpeechSynthesisUtterance('Speech system initialized');
        if (window.defaultVoice) {
            testUtterance.voice = window.defaultVoice;
        }
        window.speechSynthesis.speak(testUtterance);
    }, 2000);
    
    // Start the intervals
    setInterval(updateClock, 1000);
    setInterval(updateTimeBasedStyling, 10000);
    setInterval(checkDepartures, 1000);
    setInterval(checkUpcomingDepartures, 1000);
    
    updateClock();

    // Initial load with table selection handling
    loadTimetableData().then(() => {
        // Get the selected table value
        const tableSelect = document.getElementById('table-select');
        const selectedTable = tableSelect.value;
        
        // Show the appropriate table
        const maskewSection = document.getElementById('maskew-section');
        const marketSection = document.getElementById('market-section');
        const fengateSection = document.getElementById('fengate-section');
        
        maskewSection.classList.remove('active');
        marketSection.classList.remove('active');
        fengateSection.classList.remove('active');
        
        if (selectedTable === 'maskew') {
            maskewSection.classList.add('active');
        } else if (selectedTable === 'market') {
            marketSection.classList.add('active');
        } else if (selectedTable === 'fengate') {
            fengateSection.classList.add('active');
        }
        
        showTable();
    }).catch(error => {
        console.error('Error in initial load:', error);
        showError("Failed to load initial data. Please refresh the page.");
    });

    // Set up 7 PM refresh
    function scheduleNextRefresh() {
        const now = new Date();
        const next7PM = new Date(now);
        next7PM.setHours(19, 0, 0, 0);

        if (now > next7PM) {
            next7PM.setDate(next7PM.getDate() + 1);
        }

        const delay = next7PM - now;

        setTimeout(() => {
            loadTimetableData();
            scheduleNextRefresh();
        }, delay);
    }

    scheduleNextRefresh();
});