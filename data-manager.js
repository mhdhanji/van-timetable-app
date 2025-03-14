// data-manager.js
class DataManager {
  constructor() {
    this.data = {
      maskew: null,
      market: null,
      fengate: null,
      ibt: null,
      version: null,
      lastUpdated: null
    };
    this.initialized = false;
    this.githubUser = "mhdhanji";
    this.githubRepo = "van-timetable-app";
    this.dataBranch = "data"; // We'll use a separate branch for data
  }

  // Initialize data
  async initialize() {
    if (this.initialized) return true;
    
    console.log('Initializing data manager...');
    
    // Try to load from localStorage first
    if (this.loadFromLocalStorage()) {
      this.initialized = true;
      console.log('Data loaded from localStorage.');
      
      // Check for updates in the background after a short delay
      setTimeout(() => {
        this.checkForRemoteUpdates();
      }, 3000);
      
      return true;
    }
    
    // If localStorage fails, load from local JSON files
    return this.loadFromFiles();
  }

  // Load data from localStorage
  loadFromLocalStorage() {
    try {
      const maskew = localStorage.getItem('maskew_data');
      const market = localStorage.getItem('market_data');
      const fengate = localStorage.getItem('fengate_data');
      const ibt = localStorage.getItem('ibt_data');
      const version = localStorage.getItem('data_version');
      const lastUpdated = localStorage.getItem('data_last_updated');
      
      if (maskew && market && fengate && ibt) {
        this.data.maskew = JSON.parse(maskew);
        this.data.market = JSON.parse(market);
        this.data.fengate = JSON.parse(fengate);
        this.data.ibt = JSON.parse(ibt);
        this.data.version = version;
        this.data.lastUpdated = lastUpdated;
        
        console.log(`Loaded data from localStorage (version: ${version})`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return false;
    }
  }

  // Load data from local JSON files
  async loadFromFiles() {
    try {
      console.log('Loading data from JSON files...');
      
      // Fetch all data files
      const [maskewResponse, marketResponse, fengateResponse, ibtResponse, versionResponse] = await Promise.all([
        fetch('data/maskew_data.json'),
        fetch('data/market_data.json'),
        fetch('data/fengate_data.json'),
        fetch('data/ibt_data.json'),
        fetch('version.json')
      ]);
      
      // Parse JSON responses
      const maskew = await maskewResponse.json();
      const market = await marketResponse.json();
      const fengate = await fengateResponse.json();
      const ibt = await ibtResponse.json();
      const versionInfo = await versionResponse.json();
      
      // Store in memory
      this.data.maskew = maskew;
      this.data.market = market;
      this.data.fengate = fengate;
      this.data.ibt = ibt;
      this.data.version = versionInfo.version;
      this.data.lastUpdated = new Date().toISOString();
      
      // Save to localStorage
      this.saveToLocalStorage();
      
      console.log(`Data loaded from files (version: ${versionInfo.version})`);
      this.initialized = true;
      
      // Start periodic update checks
      this.startPeriodicUpdates();
      
      return true;
    } catch (error) {
      console.error('Error loading data from files:', error);
      return false;
    }
  }

  // Save current data to localStorage
  saveToLocalStorage() {
    try {
      localStorage.setItem('maskew_data', JSON.stringify(this.data.maskew));
      localStorage.setItem('market_data', JSON.stringify(this.data.market));
      localStorage.setItem('fengate_data', JSON.stringify(this.data.fengate));
      localStorage.setItem('ibt_data', JSON.stringify(this.data.ibt));
      localStorage.setItem('data_version', this.data.version);
      localStorage.setItem('data_last_updated', this.data.lastUpdated);
      
      console.log('Data saved to localStorage');
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  // Clear all data from localStorage
  clearLocalStorage() {
    try {
      localStorage.removeItem('maskew_data');
      localStorage.removeItem('market_data');
      localStorage.removeItem('fengate_data');
      localStorage.removeItem('ibt_data');
      localStorage.removeItem('data_version');
      localStorage.removeItem('data_last_updated');
      
      console.log('Data cleared from localStorage');
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  // Reload data from files (useful for forcing a refresh)
  async reloadData() {
    this.clearLocalStorage();
    this.initialized = false;
    return this.loadFromFiles();
  }

  // Check for updates from GitHub
  async checkForRemoteUpdates() {
    try {
      console.log('Checking for remote updates...');
      
      // Add cache-busting parameter
      const timestamp = new Date().getTime();
      const url = `https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/version.json?t=${timestamp}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Failed to fetch remote version info:', response.status);
        return false;
      }
      
      const remoteVersion = await response.json();
      const localVersion = this.data.version;
      
      console.log(`Current data version: ${localVersion}, Remote version: ${remoteVersion.version}`);
      
      if (!localVersion || remoteVersion.version !== localVersion) {
        console.log(`Data update available: ${localVersion || 'none'} → ${remoteVersion.version}`);
        
        // Show update notification
        this.showUpdateAvailableNotification();
        
        return true; // Update is available
      } else {
        console.log('Data is up to date');
        return false; // No update available
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      return false;
    }
  }

  // Download latest data from GitHub
  async downloadLatestData() {
    try {
      console.log('Downloading latest data...');
      
      // Add cache-busting parameter
      const timestamp = new Date().getTime();
      
      // Fetch all data files in parallel
      const [maskewResponse, marketResponse, fengateResponse, ibtResponse, versionResponse] = await Promise.all([
        fetch(`https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/data/maskew_data.json?t=${timestamp}`),
        fetch(`https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/data/market_data.json?t=${timestamp}`),
        fetch(`https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/data/fengate_data.json?t=${timestamp}`),
        fetch(`https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/data/ibt_data.json?t=${timestamp}`),
        fetch(`https://raw.githubusercontent.com/${this.githubUser}/${this.githubRepo}/${this.dataBranch}/version.json?t=${timestamp}`)
      ]);
      
      // Check if all responses are OK
      if (!maskewResponse.ok || !marketResponse.ok || !fengateResponse.ok || !ibtResponse.ok || !versionResponse.ok) {
        console.error('Failed to fetch one or more data files');
        return false;
      }
      
      // Parse JSON responses
      const maskew = await maskewResponse.json();
      const market = await marketResponse.json();
      const fengate = await fengateResponse.json();
      const ibt = await ibtResponse.json();
      const versionInfo = await versionResponse.json();
      
      // Store in memory
      this.data.maskew = maskew;
      this.data.market = market;
      this.data.fengate = fengate;
      this.data.ibt = ibt;
      this.data.version = versionInfo.version;
      this.data.lastUpdated = new Date().toISOString();
      
      // Save to localStorage
      this.saveToLocalStorage();
      
      console.log(`Data updated to version ${versionInfo.version}`);
      
      // Show update notification
      this.showUpdateCompletedNotification();
      
      return true;
    } catch (error) {
      console.error('Error downloading data:', error);
      return false;
    }
  }

  // Start periodic update checks
  startPeriodicUpdates() {
    // Check for updates every hour
    setInterval(() => {
      this.checkForRemoteUpdates();
    }, 3600000); // 1 hour in milliseconds
    
    console.log('Periodic update checks started');
  }

  // Show a notification when update is available
  showUpdateAvailableNotification() {
    // Create or get the notification element
    let notification = document.getElementById('update-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'update-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#2196F3';
      notification.style.color = 'white';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '5px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.zIndex = '1000';
      notification.style.display = 'none';
      notification.style.cursor = 'pointer';
      
      // Add click event to download the update
      notification.addEventListener('click', () => {
        this.downloadLatestData().then(success => {
          if (success) {
            // Reload the timetable with new data
            if (window.loadTimetableData) {
              window.loadTimetableData();
            }
          }
        });
        notification.style.display = 'none';
      });
      
      document.body.appendChild(notification);
    }
    
    // Show the notification
    notification.textContent = 'New schedule data available. Click to update.';
    notification.style.display = 'block';
    
    // Hide after 30 seconds if not clicked
    setTimeout(() => {
      if (notification.style.display !== 'none') {
        notification.style.display = 'none';
      }
    }, 30000);
  }

  // Show a notification when update is completed
  showUpdateCompletedNotification() {
    // Create or get the notification element
    let notification = document.getElementById('update-completed-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'update-completed-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '5px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.zIndex = '1000';
      notification.style.display = 'none';
      
      document.body.appendChild(notification);
    }
    
    // Show the notification
    notification.textContent = `Schedule data updated to version ${this.data.version}`;
    notification.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }

  // Getter methods for data
  getMaskewData() {
    return this.data.maskew || [];
  }
  
  getMarketData() {
    return this.data.market || [];
  }
  
  getFengateData() {
    return this.data.fengate || [];
  }
  
  getIBTData() {
    return this.data.ibt || {};
  }
  
  getDataVersion() {
    return this.data.version;
  }
  
  getLastUpdated() {
    return this.data.lastUpdated;
  }
}

// Create a singleton instance
const dataManager = new DataManager();

// Export for use in other files
window.dataManager = dataManager;