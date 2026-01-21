/**
 * Wedding Moments - Google Apps Script Backend
 * 
 * This script handles:
 * 1. Storing moment data in Google Sheets
 * 2. Uploading images to Google Drive
 * 3. Fetching all moments
 * 
 * Setup Instructions:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1UxmyFgvxJjeUawZaPWJjz5No-qAO6cBiU_Oho0QevWQ/edit
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Update FOLDER_ID below with your Drive folder ID
 * 5. Click "Deploy" > "New deployment" > "Web app"
 * 6. Set "Execute as" to "Me"
 * 7. Set "Who has access" to "Anyone"
 * 8. Click "Deploy" and copy the Web App URL
 */

// ==================== CONFIGURATION ====================
const FOLDER_ID = '12z14guI2x6yEasZAC2mSm4ZhfpqZiXSC'; // Your Google Drive folder ID
const SHEET_NAME = 'master'; // Name of the sheet tab

// ==================== MAIN HANDLER ====================
function doPost(e) {
  try {
    const action = e.parameter.action;

    if (action === 'addMoment') {
      return addMoment(e);
    } else if (action === 'uploadImage') {
      return uploadImage(e);
    }

    return createResponse(false, 'Invalid action');
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getMoments') {
      return getMoments();
    }

    return createResponse(false, 'Invalid action');
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

// ==================== ADD MOMENT ====================
function addMoment(e) {
  try {
    const name = e.parameter.name;
    const message = e.parameter.message;
    const imageUrl = e.parameter.imageUrl;
    const rotation = e.parameter.rotation || 0;

    // Validate inputs
    if (!name || !message || !imageUrl) {
      return createResponse(false, 'Missing required fields');
    }

    // Get the active spreadsheet
    const ss = SpreadsheetApp.openById('1UxmyFgvxJjeUawZaPWJjz5No-qAO6cBiU_Oho0QevWQ');
    let sheet = ss.getSheetByName(SHEET_NAME);

    // If sheet doesn't exist, create it with headers
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Name', 'Message', 'Image URL', 'Rotation', 'Timestamp']);
      Logger.log('Created new sheet: ' + SHEET_NAME);
    }

    // Generate ID and timestamp
    const id = new Date().getTime();
    const timestamp = new Date().toISOString();

    // Append the new row
    sheet.appendRow([id, name, message, imageUrl, rotation, timestamp]);

    return createResponse(true, 'Moment added successfully', {
      id: id,
      name: name,
      message: message,
      image: imageUrl,
      rotation: parseFloat(rotation),
      timestamp: timestamp
    });

  } catch (error) {
    Logger.log('Error in addMoment: ' + error.toString());
    return createResponse(false, 'Error adding moment: ' + error.toString());
  }
}

// ==================== UPLOAD IMAGE ====================
function uploadImage(e) {
  try {
    const imageData = e.parameter.imageData;
    const fileName = e.parameter.fileName || 'moment_' + new Date().getTime() + '.jpg';

    if (!imageData) {
      return createResponse(false, 'No image data provided');
    }

    // Remove the data URL prefix if present
    const base64Data = imageData.split(',')[1] || imageData;

    // Decode base64 to blob
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      'image/jpeg',
      fileName
    );

    // Get the folder
    const folder = DriveApp.getFolderById(FOLDER_ID);

    // Create file in Drive (MIME type already set in blob)
    const file = folder.createFile(blob);

    // Make file publicly accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();

    // Use Google Drive Thumbnail API with strict size parameter
    // This is the most reliable way to get a direct image link without CORS issues
    const imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

    return createResponse(true, 'Image uploaded successfully', {
      imageUrl: imageUrl,
      fileId: fileId
    });

  } catch (error) {
    Logger.log('Error in uploadImage: ' + error.toString());
    return createResponse(false, 'Error uploading image: ' + error.toString());
  }
}

// ==================== GET MOMENTS ====================
function getMoments() {
  try {
    const ss = SpreadsheetApp.openById('1UxmyFgvxJjeUawZaPWJjz5No-qAO6cBiU_Oho0QevWQ');
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return createResponse(true, 'No moments yet', { moments: [] });
    }

    const data = sheet.getDataRange().getValues();

    // Skip header row
    if (data.length <= 1) {
      return createResponse(true, 'No moments yet', { moments: [] });
    }

    const moments = [];

    // Start from index 1 to skip headers
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      moments.push({
        id: row[0],
        name: row[1],
        message: row[2],
        image: row[3],
        rotation: parseFloat(row[4]) || 0
      });
    }

    // Return moments in reverse order (newest first)
    return createResponse(true, 'Moments retrieved successfully', {
      moments: moments.reverse()
    });

  } catch (error) {
    Logger.log('Error in getMoments: ' + error.toString());
    return createResponse(false, 'Error fetching moments: ' + error.toString());
  }
}

// ==================== HELPER FUNCTIONS ====================
function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    ...data
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== TEST FUNCTIONS ====================
// Run this to test if the script can access your sheet
function testSheetAccess() {
  try {
    const ss = SpreadsheetApp.openById('1UxmyFgvxJjeUawZaPWJjz5No-qAO6cBiU_Oho0QevWQ');
    Logger.log('✅ Sheet access successful: ' + ss.getName());

    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log('⚠️ Sheet "' + SHEET_NAME + '" not found. Creating...');
      const newSheet = ss.insertSheet(SHEET_NAME);
      newSheet.appendRow(['ID', 'Name', 'Message', 'Image URL', 'Rotation', 'Timestamp']);
      Logger.log('✅ Sheet created with headers');
    } else {
      Logger.log('✅ Sheet "' + SHEET_NAME + '" found');
    }
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
  }
}

// Run this to test if the script can access your Drive folder
function testDriveAccess() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    Logger.log('✅ Drive folder access successful: ' + folder.getName());
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
  }
}
