/**
 * This function runs automatically when a user submits the Google Form.
 * It calculates the total registration cost, generates a registration ID,
 * saves it to the "Registration ID" column in Google Sheet, and sends confirmation via SMS and email.
 */
function onFormSubmit(e) {
    try {
        Logger.log('Form submission received');

        // Verify required permissions
        if (!hasFormPermission() || !hasEmailPermission()) {
            Logger.log("Missing required permissions");
            return createTextResponse("Thank you for your registration. Confirmation details will be sent shortly.");
        }

        const form = FormApp.getActiveForm();
        const responses = e.response.getItemResponses();

        if (!responses || responses.length === 0) {
            Logger.log("No form data received.");
            return;
        }

        // Generate a unique registration number starting from 240001
        const uniqueId = generateUniqueId();  // Generate a unique ID for the form submission
        Logger.log('Generated Unique ID: ' + uniqueId);

        if (uniqueId) {
            // Save the unique ID to the "RegNo" column in the same row as the form submission
            saveUniqueIdToSheet(uniqueId);  // Pass the form response for saving
        } else {
            Logger.log("Failed to generate a unique ID.");
        }

        // --- Variables to hold form data ---
        let phoneNumber = null;
        let emailAddress = null;
        let name = "";
        let numAccompanying = 0;
        let registrationFee = 0;
        let status = "";

        // --- Form question titles (update if needed) ---
        const statusQuestionTitle = 'Status';
        const nameQuestionTitle = 'Delegate Name';
        const phoneQuestionTitle = 'Mobile Number';
        const emailQuestionTitle = 'Email Address';
        const accompanyingQuestionTitle = 'How many accompanying persons? (Max 4)';

        // Extract form responses
        responses.forEach(response => {
            const questionTitle = response.getItem().getTitle();
            const answer = response.getResponse();

            if (questionTitle === phoneQuestionTitle) phoneNumber = answer;
            if (questionTitle === emailQuestionTitle) emailAddress = answer;
            if (questionTitle === nameQuestionTitle) name = answer;
            if (questionTitle === accompanyingQuestionTitle) numAccompanying = parseInt(answer, 10) || 0;
            if (questionTitle === statusQuestionTitle) {
                status = answer;
                if (answer.includes('Ophthalmologist (৳4,000)')) registrationFee = 4000;
                if (answer.includes('Resident (৳2,000)')) registrationFee = 2000;
            }
        });



        // --- Calculate total amount ---
        const accompanyingCost = numAccompanying * 2000;
        const totalAmount = registrationFee + accompanyingCost;



        // --- Send SMS confirmation ---
        if (phoneNumber) {
            const smsMessage = `BGS: Thank you ${name} for registering. Your ID: ${uniqueId}. ` +
                `Status: ${status}. ` +
                `Registration: BDT ${registrationFee}, ` +
                `Accompanying: ${numAccompanying} persons (BDT ${accompanyingCost}). ` +
                `Total payable: BDT ${totalAmount}.`;
            sendSms(phoneNumber, smsMessage);
        }

        // --- Send email confirmation ---
        if (emailAddress) {
            try {
                const emailSubject = 'BGS Conference Registration Confirmation';
                const emailBody = `
Dear ${name},

Thank you for registering for the Annual National Conference 2025.

REGISTRATION DETAILS:
- Registration ID: ${uniqueId}
- Status: ${status}
- Registration Fee: BDT ${registrationFee}
- Accompanying Persons: ${numAccompanying} (BDT ${accompanyingCost})
- Total Payable Amount: BDT ${totalAmount}

A confirmation SMS has been sent to ${phoneNumber}.

We look forward to seeing you at the conference!

Best regards,
BGS Conference Team
        `;

                MailApp.sendEmail({
                    to: emailAddress,
                    subject: emailSubject,
                    body: emailBody
                });
                Logger.log(`Confirmation email sent to ${emailAddress}`);
            } catch (error) {
                Logger.log(`Error sending email: ${error.message}`);
            }
        }

        // --- Create form submission response ---
        let responseMessage =
            `Thank you ${name} for registering!\n\n` +
            `Your registration ID: ${uniqueId}\n\n` +
            `Registration details:\n` +
            `Status: ${status}\n` +
            `Registration Fee: BDT ${registrationFee}\n` +
            `Accompanying Persons: ${numAccompanying} (BDT ${accompanyingCost})\n` +
            `Total Payable Amount: BDT ${totalAmount}\n\n` +
            `A confirmation has been sent to your contact details.`;

        // Add edit link if available
        try {
            const editUrl = form.getResponseUrl(e.response.getId());
            if (editUrl) {
                responseMessage += `\n\nSave this link to edit your registration later:\n${editUrl}`;
            }
        } catch (error) {
            Logger.log(`Could not get edit URL: ${error.message}`);
        }

        return createTextResponse(responseMessage);

    } catch (error) {
        Logger.log(`Error in onFormSubmit: ${error.message}`);
        return createTextResponse("Thank you for registering. We encountered an issue but your submission was received.");
    }
}

/**
 * Generates a unique registration ID in format BGSYYYYXXXX
 */
// Function to generate a unique registration number starting from REG-240001
function generateUniqueId() {
    try {
        const prefix = 'BGS';
        const startingNumber = 250000;  // Start from 250002

        // Open the spreadsheet and get the last row index (row number)
        const spreadsheetId = '1klPZoj-plmLENDYFjxq8wZkqzZHACBmhFvUSqAujOdM';  // Replace with your actual spreadsheet ID
        const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Form Responses 1');

        if (!sheet) {
            throw new Error('Unable to find the specified sheet.');
        }

        const lastRow = sheet.getLastRow(); // Get the last row number where new data is added

        // Calculate the registration number starting from 240001 and incrementing for each new row
        const registrationNumber = startingNumber + lastRow; // Add the row number to the starting number
        const uniqueId = `${prefix}${registrationNumber}`;
        Logger.log('Unique ID generated: ' + uniqueId); // Log the unique ID
        return uniqueId;
    } catch (error) {
        Logger.log(`Error generating unique ID: ${error.message}`);
        return null; // Return null if there's an error
    }
}

// Function to save the unique registration number to the "RegNo" column in the spreadsheet
function saveUniqueIdToSheet(uniqueId) {
    try {
        if (!uniqueId) {
            throw new Error('Unique ID is undefined or null.');
        }

        const spreadsheetId = '1klPZoj-plmLENDYFjxq8wZkqzZHACBmhFvUSqAujOdM';  // Replace with your actual spreadsheet ID
        const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Form Responses 1');  // Specify the sheet by name

        if (!sheet) {
            throw new Error('Unable to find the specified sheet.');
        }

        // Get the last row number where the form data was submitted
        const lastRow = sheet.getLastRow();

        // Get the column index for "RegNo"
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        const headers = headerRange.getValues()[0];
        const regNoColumnIndex = headers.indexOf('RegNo') + 1; // Get the index of the RegNo column (1-based)

        if (regNoColumnIndex === 0) {
            throw new Error('RegNo column not found in the sheet.');
        }

        // Update the RegNo column in the corresponding row with the unique ID
        sheet.getRange(lastRow, regNoColumnIndex).setValue(uniqueId); // Save unique ID to the "RegNo" column
        Logger.log(`Unique ID saved: ${uniqueId} in column 'RegNo'`);

    } catch (error) {
        Logger.log(`Error saving unique ID to sheet: ${error.message}`);
    }
}


// [Rest of your helper functions remain unchanged]
// createTextResponse(), hasFormPermission(), hasEmailPermission(), sendSms()

// --- Helper Functions (unchanged from your original) ---

function createTextResponse(message) {
    return ContentService.createTextOutput(message);
}

function hasFormPermission() {
    try {
        FormApp.getActiveForm();
        return true;
    } catch (e) {
        return false;
    }
}

function hasEmailPermission() {
    try {
        MailApp.getRemainingDailyQuota();
        return true;
    } catch (e) {
        return false;
    }
}

function sendSms(phoneNumber, message) {
    const sender = encodeURIComponent('BGS');
    const apikey = 'dd9930189d8670a7';
    const secretKey = 'ef81573e';
    const textmessage = encodeURIComponent(message);

    const url = `http://103.177.125.106:7788/sendtext?apikey=${apikey}&secretkey=${secretKey}&callerID=${sender}&toUser=${phoneNumber}&messageContent=${textmessage}`;

    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'get',
            muteHttpExceptions: true
        });
        Logger.log(`SMS sent to ${phoneNumber}: ${response.getContentText()}`);
    } catch (error) {
        Logger.log(`Error sending SMS: ${error.message}`);
    }
}
