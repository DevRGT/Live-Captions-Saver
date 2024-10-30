// Define a constant for the "Leave" button selector
const LEAVE_BUTTON_SELECTOR = "button[data-tid='hangup-main-btn']";

const transcriptArray = [];
let capturing = false;
let observer = null;
let meetingDate = new Date().toLocaleDateString(); // Adding the date to use in captions

let leaveButtonListener = null; // Store reference to the leave button event listener
let leaveButton = null; // Store the reference to the current "Leave" button
let lastMeetingTitle = ""; // To track the last meeting title
let meetingDetails = ""; // To store meeting details (like date, time, etc.)

function checkCaptions() {
    // Teams v2 
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    if (!closedCaptionsContainer) {
        return;
    }
    const transcripts = closedCaptionsContainer.querySelectorAll('.ui-chat__item');

    transcripts.forEach(transcript => {
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;
        if (transcript.querySelector('.ui-chat__message__author') != null) {
            const Name = transcript.querySelector('.ui-chat__message__author').innerText;
            const Text = transcript.querySelector('.fui-StyledText').innerText;
            const Time = new Date().toLocaleTimeString();

            const index = transcriptArray.findIndex(t => t.ID === ID);

            if (index > -1) {
                if (transcriptArray[index].Text !== Text) {
                    // Update the transcript if text changed
                    transcriptArray[index] = {
                        Name,
                        Text,
                        Time,
                        ID
                    };
                }
            } else {
                console.log({ Name, Text, Time, ID });
                // Add new transcript
                transcriptArray.push({ Name, Text, Time, ID });
            }
        }
    });
}

// Run startTranscription every 5 seconds
// Cancel the interval if capturing is true
function startTranscription() {
    const meetingDurationElement = document.getElementById("call-duration-custom");
    if (!meetingDurationElement) {
        setTimeout(startTranscription, 5000);
        return false;
    }

    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    if (!closedCaptionsContainer) {
        console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        setTimeout(startTranscription, 5000);
        return false;
    }

    capturing = true;
    observer = new MutationObserver(checkCaptions);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    return true;
}

// Attach or remove listener to/from the "Leave" button based on leaveTrigger
function handleLeaveButtonListener(newLeaveButton) {
    // Remove the event listener from the previous button if it exists
    if (leaveButton && leaveButtonListener) {
        console.log("Removing event listener from the previous Leave button...");
        leaveButton.removeEventListener('click', leaveButtonListener);
    }

    // Set the current meeting title when we find the Leave button
    let currentMeetingTitle = document.title
        .replace(/\(\d+\)\s*/, '')   // Remove the number in brackets and the space after it
        .replace("Microsoft Teams", '') // Remove "Microsoft Teams" part
        .trim(); // Trim leading/trailing whitespace

    console.log("Current Meeting Title Detected:", currentMeetingTitle);

    // Detect if this is a new meeting by comparing meeting titles
    if (currentMeetingTitle !== lastMeetingTitle) {
        console.log("New meeting detected. Clearing previous transcript...");
        transcriptArray.length = 0; // Clear the transcriptArray for a new meeting
        lastMeetingTitle = currentMeetingTitle; // Update the lastMeetingTitle to the new one

        // Retrieve meeting details as part of new meeting start
        const meetingDetails = getMeetingDetails();
        if (meetingDetails) {
            console.log("Retrieved Meeting Details:", meetingDetails);
        }
    }

    // Attach or detach the event listener based on the value of leaveTrigger
    chrome.storage.local.get(['leaveTrigger'], function (result) {
        const leaveTrigger = result.leaveTrigger || false; // Default to false if undefined

        if (leaveTrigger) {
            console.log("leaveTrigger is enabled, adding event listener to Leave button.");
            if (!leaveButtonListener) {
                leaveButtonListener = () => {
                    console.log("Leave button clicked, saving captions...");
                    chrome.runtime.sendMessage({
                        message: "leave_button_save_captions"
                    });
                };
            }
            // Update the reference to the current leave button and add the listener
            newLeaveButton.addEventListener('click', leaveButtonListener);
        } else {
            console.log("leaveTrigger is disabled, removing event listener from Leave button if it exists.");
            if (leaveButtonListener) {
                newLeaveButton.removeEventListener('click', leaveButtonListener);
                leaveButtonListener = null;
            }
        }
    });

    // Update the leaveButton reference
    leaveButton = newLeaveButton;
}

// Function to handle dynamic elements, such as the leave button and meeting details container
function observeDynamicElements() {
    const observerConfig = {
        childList: true,
        subtree: true,
    };

    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Search for the "Leave" button each time there is a change
                const newLeaveButton = document.querySelector(LEAVE_BUTTON_SELECTOR);
                if (newLeaveButton && newLeaveButton !== leaveButton) {
                    console.log("New Leave button found. Updating listener...");
                    handleLeaveButtonListener(newLeaveButton);
                }

                // Observe for meeting details container dynamically added
                const meetingDetailsContainer = document.querySelector('div[data-tid="meeting-details-container"]');
                if (meetingDetailsContainer) {
                    console.log("Meeting details container found.");
                    const meetingDetails = getMeetingDetails();
                    if (meetingDetails) {
                        console.log("Meeting Details:", meetingDetails);
                    }
                }
            }
        });
    });

    mutationObserver.observe(document.body, observerConfig);
}

// Listen for changes in the leaveTrigger value
chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local' && changes.leaveTrigger) {
        console.log("leaveTrigger setting has changed. Updating leave button listener...");
        handleLeaveButtonListener(leaveButton); // Re-run the logic to update the listener
    }
});

function getMeetingDetails() {
    // Step 1: Find the container using data-tid attribute
    const meetingDetailsContainer = document.querySelector('div[data-tid="meeting-details-container"]');
    
    if (meetingDetailsContainer) {
        // Step 2: Select all span elements within this container
        const spans = meetingDetailsContainer.querySelectorAll('span');

        // Step 3: Extract text from each span and concatenate it
        let details = "";
        spans.forEach((span, index) => {
            details += span.textContent.trim();
            if (index < spans.length - 1) {
                details += " "; // Add space separator except for the last element
            }
        });

        // Store the meeting details in the global variable
        meetingDetails = details;

        // Log or return the result as needed
        console.log("Meeting Details:", meetingDetails);
        return meetingDetails;
    } else {
        console.warn("Meeting details container not found.");
        return null;
    }
}

// Listen for messages from the service_worker.js script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.message) {
        case 'return_transcript':
            console.log("response:", transcriptArray);
            if (!capturing) {
                alert("Oops! No captions were captured. Please, try again.");
                return;
            }

            // Use cleaned up meeting title
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: transcriptArray,
                meetingTitle: lastMeetingTitle, // Use lastMeetingTitle instead of recalculating
                meetingDate: meetingDate,  // Include meeting date in message
                meetingDetails: meetingDetails  // Include meeting details in message
            });
            break;

        default:
            break;
    }
});

// Initialize dynamic elements observer
window.onload = () => {
    console.log("Window loaded. Running content script...");
    startTranscription();
    observeDynamicElements(); // Start observing dynamic elements like the leave button and meeting details
};

console.log("content_script.js is running");
