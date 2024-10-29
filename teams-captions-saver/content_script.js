const transcriptArray = [];
let capturing = false;
let observer = null;
let meetingDate = new Date().toLocaleDateString(); // Adding the date to use in captions

function checkCaptions() {
    // Teams v2 
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']")
    if (!closedCaptionsContainer) {
        // "Please, click 'More' > 'Language and speech' > 'Turn on live captions'"
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
                console.log({
                    Name,
                    Text,
                    Time,
                    ID
                });
                // Add new transcript
                transcriptArray.push({
                    Name,
                    Text,
                    Time,
                    ID
                });
            }

        }

    });
}

// run startTranscription every 5 seconds
// cancel the interval if capturing is true
function startTranscription() {
    const meetingDurationElement = document.getElementById("call-duration-custom");
    if (meetingDurationElement) {

    } else {
        setTimeout(startTranscription, 5000);
        return false;
    }

    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']")
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

startTranscription();

// Attach listener to the "Leave" button to save captions when the meeting ends
function addLeaveButtonListener() {
    const leaveButton = document.querySelector("button[data-tid='hangup-main-btn']");  // Updated selector for Leave button
    if (leaveButton) {
        leaveButton.addEventListener('click', () => {
            console.log("Leave button clicked, saving captions...");
            chrome.runtime.sendMessage({
                message: "return_transcript"
            });
        });
    } else {
        // Retry finding the button every 2 seconds if not found immediately
        setTimeout(addLeaveButtonListener, 2000);
    }
}

// Save captions on tab close
window.addEventListener("beforeunload", (event) => {
    if (capturing) {
        console.log("Tab is being closed, saving captions...");
        chrome.runtime.sendMessage({
            message: "return_transcript"
        });
        event.returnValue = "Captions are being saved. Please do not close until the save is complete.";
    }
});

// Listen for messages from the service_worker.js script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.message) {  // message from service_worker.js      
        case 'return_transcript':
            console.log("response:", transcriptArray);
            if (!capturing) {
                alert("Oops! No captions were captured. Please, try again.");
                return;
            }

            let meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: transcriptArray,
                meetingTitle: meetingTitle,
                meetingDate: meetingDate  // Include meeting date in message
            });
            break;

        default:
            break;
    }
});

// Call function to attach the listener to the leave button when script runs
addLeaveButtonListener();

console.log("content_script.js is running");
