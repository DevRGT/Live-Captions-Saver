// Service worker is a script that your browser runs in the background, separate from a web page, opening the door to features that don't need a web page
// or user interaction.
// Service worker script will be forcefully terminated after about 30 seconds of inactivity, and restarted when it's next needed.
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269
import { Buffer } from 'buffer';

// This code is not used. But without it, the extension does not work
let isTranscribing = false;
let transcriptArray = [];

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

function saveTranscripts(meetingTitle, transcriptArray, meetingDate, meetingDetails) {
    const yaml = `Meeting Title: ${meetingTitle}\n` + `Initial Meeting Schedule: ${meetingDetails}\n` + `Real Captions Date: ${meetingDate}\n\n\n` + jsonToYaml(transcriptArray); // Add meeting date to the top
    console.log(yaml);

    console.log("Meeting Date Value:", meetingDate);

    let formattedDate = "unknownDate"; // Fallback value in case meetingDate is invalid

    // Extract day, month, and year from the meetingDate
    const datePattern = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/;
    const match = meetingDate.match(datePattern);

    if (match) {
        const day = match[1];
        const month = match[2];
        const year = match[3];

        // Construct the formatted date as "YYYYMMDD"
        formattedDate = `${year}${month}${day}`;
    } else {
        console.error("Meeting date is not in the expected DD/MM/YYYY format.");
    }

    // Sanitize the meeting title to make it suitable for a filename
    let sanitizedMeetingTitle = meetingTitle.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_').trim();
    if (sanitizedMeetingTitle.length === 0) {
        sanitizedMeetingTitle = "Meeting";
    }

    // Generate the final filename with the date prefix
    const filename = `${formattedDate} - ${sanitizedMeetingTitle}.txt`;

    console.log("Generated Filename:", filename);

    // Retrieve the user's save option from Chrome storage to decide whether to prompt Save As or save automatically
    chrome.storage.local.get(['saveOption'], function (result) {
        let saveAsOption = false; // Default to Auto Save

        if (result.saveOption === 'ask') {
            saveAsOption = true; // If user chose "Choose Location", set saveAs to true
            console.log('User preference: Choose Location (Save As)');
        } else {
            console.log('User preference: Auto Save');
        }

        // Use chrome.downloads API to save the file
        chrome.storage.local.get(['directory'], function (result) {
            let directory = result.directory;
            let fullFilename = filename;

            if (directory) {
                fullFilename = `${directory}/${filename}`;
            }

            chrome.downloads.download({
                url: 'data:text/plain,' + encodeURIComponent(yaml),
                filename: fullFilename,
                saveAs: saveAsOption // Use the retrieved user preference
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("Error downloading file:", chrome.runtime.lastError.message);
                } else {
                    console.log("Download started with ID:", downloadId);
                }
            });
        });
    });
}


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message);
    switch (message.message) {
        case 'download_captions': // message from Content script
            console.log('download_captions triggered!', message);
            saveTranscripts(message.meetingTitle, message.transcriptArray, message.meetingDate, message.meetingDetails);
            break;
        case 'manual_save_captions': // Updated to handle manual Save Button click
            console.log('manual_save_captions triggered!');
            try {
                const [tab] = await chrome.tabs.query({
                    active: true,
                    lastFocusedWindow: true
                });
                console.log("Tabs query result:", tab);
                if (tab && tab.id) {
                    console.log("sending message return_transcript");
                    chrome.tabs.sendMessage(tab.id, {
                        message: "return_transcript"
                    });
                    console.log("message start_capture sent!");
                } else {
                    console.error("Active tab not found or tab ID missing.");
                }
            } catch (err) {
                console.error("Error querying active tab:", err);
            }
            break;
        case 'leave_button_save_captions': // New message for Leave button click
            console.log('leave_button_save_captions triggered! Checking user preference...');
			try {
				const [tab] = await chrome.tabs.query({
					active: true,
					lastFocusedWindow: true
				});
				console.log("Tabs query result:", tab);
				if (tab && tab.id) {
					console.log("Sending message to return transcript");
					chrome.tabs.sendMessage(tab.id, {
						message: "return_transcript"
					});
				} else {
					console.error("Active tab not found or tab ID missing.");
				}
			} catch (err) {
				console.error("Error querying active tab for leave button save:", err);
			}
            break;
        default:
            break;
        case 'audio_data':
            console.log('audio_data triggered!');
            saveAudio(message.audio, message.meetingTitle, message.meetingDate);
            break;
    }
});

async function saveAudio(audioData, meetingTitle, meetingDate) {
    try {
        const buffer = Buffer.from(audioData.split(',')[1], 'base64');

        let formattedDate = "unknownDate"; // Fallback value in case meetingDate is invalid

        // Extract day, month, and year from the meetingDate
        const datePattern = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/;
        const match = meetingDate.match(datePattern);

        if (match) {
            const day = match[1];
            const month = match[2];
            const year = match[3];

            // Construct the formatted date as "YYYYMMDD"
            formattedDate = `${year}${month}${day}`;
        } else {
            console.error("Meeting date is not in the expected DD/MM/YYYY format.");
        }

        // Sanitize the meeting title to make it suitable for a filename
        let sanitizedMeetingTitle = meetingTitle.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_').trim();
        if (sanitizedMeetingTitle.length === 0) {
            sanitizedMeetingTitle = "Meeting";
        }

        const filename = `${formattedDate} - ${sanitizedMeetingTitle}.mp3`;

        chrome.downloads.download({
            url: 'data:audio/mp3;base64,' + buffer.toString('base64'),
            filename: filename,
            saveAs: false // Auto Save
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Error downloading file:", chrome.runtime.lastError.message);
            } else {
                console.log("Audio Download started with ID:", downloadId);
            }
        });

    } catch (error) {
        console.error("Error saving audio:", error);
    }
}
