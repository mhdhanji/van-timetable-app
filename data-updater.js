// data-updater.js
// This script can be run locally to update the data files in your repository
// before pushing to GitHub

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Get current version from the version.json file
const versionPath = path.join(__dirname, 'version.json');
let versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

// Increment the version number
const versionParts = versionInfo.version.split('.');
versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
versionInfo.version = versionParts.join('.');
versionInfo.releaseDate = new Date().toISOString().split('T')[0];  // Today's date in YYYY-MM-DD format
versionInfo.notes = `Data update on ${new Date().toLocaleString()}`;

// Write the updated version back to the file
fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));

console.log(`Updated version to ${versionInfo.version}`);

// If you have data in localStorage that needs to be exported to files,
// you would implement that logic here.
// For example, you could run a headless browser to extract data from localStorage
// and save it to your data files.

// For manual updates, update the data files directly:
// Example: Update one of your data files
// const maskewDataPath = path.join(__dirname, 'data', 'maskew_data.json');
// let maskewData = JSON.parse(fs.readFileSync(maskewDataPath, 'utf8'));
// ... Make your changes to maskewData ...
// fs.writeFileSync(maskewDataPath, JSON.stringify(maskewData, null, 2));

// Optional: Commit and push the changes automatically
function commitAndPush() {
  exec('git add data/ version.json', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error staging files: ${error}`);
      return;
    }
    
    exec(`git commit -m "Update data to version ${versionInfo.version}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error committing changes: ${error}`);
        return;
      }
      
      console.log(`Changes committed successfully`);
      console.log(`Now you can push to the repository with: git push origin main`);
      
      // Uncomment to push automatically:
      // exec('git push origin main', (error, stdout, stderr) => {
      //   if (error) {
      //     console.error(`Error pushing changes: ${error}`);
      //     return;
      //   }
      //   console.log(`Changes pushed successfully`);
      // });
    });
  });
}

// Uncomment to commit and push automatically:
// commitAndPush();

console.log("Data files updated. Review changes and commit/push manually.");