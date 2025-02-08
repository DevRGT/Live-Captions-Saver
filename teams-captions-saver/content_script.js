// Define a constant for the "Leave" button selector
//const LEAVE_BUTTON_SELECTOR = "button[data-tid='hangup-main-btn']"; // The button was not always the same depend of who is the owner of the meeting. So I changed for another identifier.
const LEAVE_BUTTON_SELECTOR = "div#hangup-button button";


const transcriptArray = [];
let capturing = false;
let observer = null;
let meetingDate = new Date().toLocaleDateString(); // Adding the date to use in captions

let leaveButtonListener = null; // Store reference to the leave button event listener
let leaveButton = null; // Store the reference to the current "Leave" button
let lastMeetingTitle = ""; // To track the last meeting title
let meetingDetails = ""; // To store meeting details (like date, time, etc.)
let startTranscriptionTime = null; // To store a unique Timestamp each time we start a new transcription

/*
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
*/


/**
 * Function: getTimestampBasedOnInterval
 * -------------------------------------
 * This function generates a timestamp that changes every 30 seconds. The purpose is
 * to provide a unique identifier that updates periodically within a minute, ensuring
 * we have only two possible timestamps per minute:
 * 
 * - One timestamp at the start of the minute (00 seconds)
 * - Another timestamp 30 seconds into the minute (30 seconds)
 * 
 * This is particularly useful for scenarios where a unique ID is needed at regular intervals,
 * such as assigning a unique identifier to a message in Microsoft Teams' transcription,
 * where the first message does not have a proper unique ID. By using this timestamp,
 * we can minimize the risk of ID collisions, especially when relaunching captions in the
 * same meeting, since the ID will differ based on the 30-second intervals.
 */
function getTimestampBasedOnInterval() {
  // Get the current date and time
  const now = new Date();
  
  // Create a new date object representing the start of the current minute
  // This ensures that the timestamp will be at 00 seconds of the current minute
  const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

  // Calculate the timestamp for the beginning of the minute
  // This timestamp represents the start of the first 30-second interval
  const firstIntervalStart = currentMinute.getTime();

  // Calculate the timestamp for 30 seconds into the minute
  // This timestamp represents the start of the second 30-second interval
  const secondIntervalStart = firstIntervalStart + 30000; // 30,000 milliseconds = 30 seconds

  // We want to return the timestamp of the start of the first interval
  // if the current time is within the first 30 seconds of the minute.
  // Otherwise, return the timestamp for the start of the second interval.
  if (now.getTime() < secondIntervalStart) {
    // Current time is in the first 30-second interval
    return firstIntervalStart; // Return the timestamp for the start of the minute
  } else {
    // Current time is in the second 30-second interval
    return secondIntervalStart; // Return the timestamp for 30 seconds into the minute
  }
}



// Function to check and process the closed captions being displayed in a Teams meeting.
// Captions are dynamically updated in Microsoft Teams, and this function helps to capture and track them.
// The function extracts each individual caption item, identifies if it's new or modified, and updates the transcript array accordingly.
function checkCaptions() {
    // Locate the closed captions container in Teams (v2) using its data attribute.
    // This container holds all the captions being displayed during a meeting.
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    
    // If no closed captions container is present, return early as there's nothing to process.
    // This can happen if captions haven't started yet or aren't enabled.
    if (!closedCaptionsContainer) {
        return;
    }

    // Get all transcript items inside the closed captions container.
    // Each individual caption item is represented as a 'ui-chat__item', which may contain the speaker's name, text, etc.
    const transcripts = closedCaptionsContainer.querySelectorAll('.ui-chat__item');

	// Get the number of elements in the transcripts NodeList
	// I want to use it to handle the issue of first message having no ID
	// I take as assumption that if we have at least 3 block of messages, the first of this block, if he still include the initial message of the meeting, we can be sure that the last version of the message will not evoluate again (because we have 2 more.
	// So we will not search to update it again
	const size = transcripts.length;
	console.log(size); // This will print the number of elements


    // Iterate over each transcript item found in the container.
    transcripts.forEach(transcript => {
        // Extract the unique ID for each caption message to uniquely identify each caption.
        // This ID is used to differentiate new captions from existing ones.
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;

		// Microsoft Teams does not provide a unique ID for the first message in the transcription.
		// As a result, the ID is an empty string ("") for the first message. This creates a problem
		// when captions are "restarted" in the same meeting, causing the first message to be overwritten. (In fact they are not restarted, except if we close the tab and open it again. Only the meeting can be restarted.

		// Check if the ID is an empty string and we have already at least 3 blocks of message, so the initial message wil not chnage for sure
		// In this case, I will change the ID and replace by the Timespamp of the start of this Meeting
		// It also solve the issue regarding reconnection to a same meeting. Because we not reintialize the transcriptArray, we were cotinuing to fill it, but reconnection to a meeting was having again a first message without ID and the message of the initial one was replace by this new one.
		// With this modification, each time we reconnect, the first message will get a new unique ID, this will solve our issue.
		// Only issue will be if we disconnect before 3 messages and reconnect. But I chose 3 because I noticed that sometimes Teams start to write a second block of message but notice that the previous one was not finalized and update the previous one before writing again the second one.
		// But when we have 3 messages the first one is in his final version
		// Check if the ID is an empty string and we have already at least 3 blocks of messages
		if (ID === '' && size > 2) {
			// I'm searching if in the Transcription table we still have first message block without ID value
			const index = transcriptArray.findIndex(t => t.ID === ID);

			if (index > -1) {
				// Update the ID with the meeting's start timestamp
				transcriptArray[index].ID = startTranscriptionTime;
			} else {
				// The initial message ID was already updated with TimeStamp in the transcriptArray
				console.log("The initial message ID was already updated with TimeStamp in the transcriptArray");
			}

			// Use `return` to skip to the next item in the forEach loop
			return;
		}

        // Check if the transcript has an author (speaker) associated with it.
        // Sometimes a transcript may be incomplete or may not contain an author, so we need to handle that scenario.
        if (transcript.querySelector('.ui-chat__message__author') != null) {
            // Extract the name of the speaker.
            const Name = transcript.querySelector('.ui-chat__message__author').innerText;
            
            // Extract the actual text of the caption.
            const Text = transcript.querySelector('.fui-StyledText').innerText;
            
            // Capture the current timestamp as the time when the caption was processed.
            // This helps in tracking when each caption was seen or updated.
            const Time = new Date().toLocaleTimeString();

            // Check if the transcript with the given ID already exists in the transcript array.
            // If it exists, this means it's an updated version of a previously seen caption.
            const index = transcriptArray.findIndex(t => t.ID === ID);

            if (index > -1) {
                // If a transcript with the given ID already exists, update it only if the text has changed.
                // This avoids adding duplicate entries and ensures that only modifications are tracked.
                if (transcriptArray[index].Text !== Text) {
                    transcriptArray[index] = {
                        Name,
                        Text,
                        Time,
                        ID
                    };
                }
            } else {
                // If the transcript with the given ID is not already in the array, it means it's a new caption.
                // Log the new caption to the console for debugging purposes.
                console.log({ Name, Text, Time, ID });
                
                // Add the new transcript to the transcript array.
                transcriptArray.push({ Name, Text, Time, ID });
            }
        }
    });
}

	
	
/*
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
*/

// Function to initiate the transcription process by observing the meeting for captions.
// This function runs in an interval, attempting to find the meeting elements required for transcription.
// Once elements are found, it attaches an observer to capture real-time changes in closed captions.
function startTranscription() {
    // First, locate the meeting duration element by its ID.
    // This element is used to determine if we are in an active meeting and if transcription can be initiated.
    const meetingDurationElement = document.getElementById("call-duration-custom");
    
    // If the meeting duration element is not found, it means we are not in an active meeting.
    // We set a timeout to re-run `startTranscription` after 5 seconds to keep trying until we enter a meeting.
    if (!meetingDurationElement) {
        setTimeout(startTranscription, 5000);  // Retry in 5 seconds
        return false;
    }

    // Locate the closed captions container in the meeting interface.
    // If captions aren't enabled yet, we prompt the user to enable them.
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    
    // If the captions container isn't found, it means live captions are not enabled.
    // Display a console message to instruct the user to enable captions.
    // Set a timeout to retry `startTranscription` in 5 seconds.
    if (!closedCaptionsContainer) {
        console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        setTimeout(startTranscription, 5000);  // Retry in 5 seconds
        return false;
    }

    // If both meeting duration and captions are available, set `capturing` to true.
    // This flag is used to indicate that we are now actively capturing meeting captions.
    capturing = true;

    // Set up a MutationObserver to listen for any changes in the meeting document body.
    // The observer will trigger `checkCaptions` each time new captions are added or updated.
    observer = new MutationObserver(checkCaptions);

    // Start observing changes in the document body. This allows us to track all dynamic elements.
    // We use `childList: true` and `subtree: true` to monitor changes in all nested elements,
    // which ensures that we capture new captions as they are added dynamically.
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Return true to indicate that the transcription has successfully started.
    return true;
}


// Handle new detection or change of Leave button in the DOM.
// This function is called when a new Leave button is detected for the first time
// or when the DOM is updated and a new Leave button appears that is different from the previous one.
// The goal is to ensure that the correct Leave button has an event listener based on the current settings.

function handleLeaveButtonDetection(newLeaveButton) {
    try {
        // Remove the event listener from the previous Leave button if it exists.
        // This is necessary when the Leave button in the DOM changes, as we need to ensure that 
        // the listener is only attached to the correct (current) button.
        if (leaveButton && leaveButtonListener) {
            console.log("Removing event listener from the previous Leave button...");
            leaveButton.removeEventListener('click', leaveButtonListener);
            leaveButtonListener = null; // Set leaveButtonListener to null to accurately reflect that no listener is attached.
        }

        // Set the current meeting title by parsing the document title.
        // This step helps us detect if we're in a new meeting, which could require a reset of the transcript data.
        let currentMeetingTitle = document.title
            .replace(/\(\d+\)\s*/, '')   // Remove the number in brackets and the space after it (e.g., browser notifications).
            .replace("Microsoft Teams", '') // Remove "Microsoft Teams" branding from the title.
            .trim(); // Trim leading and trailing whitespace to get a clean meeting title.

        console.log("Current Meeting Title Detected:", currentMeetingTitle);

        // If the meeting title has changed, it's an indication that we're in a new meeting.
        // In such a case, we clear any previous transcript data to start fresh.
        if (currentMeetingTitle !== lastMeetingTitle) {
            console.log("New meeting detected. Clearing previous transcript...");
            transcriptArray.length = 0; // Clear the transcript array to remove any old meeting data.
            lastMeetingTitle = currentMeetingTitle; // Update the last meeting title to the current one for future comparisons.
        }

        // Update the reference to the new Leave button.
        // This is critical for keeping track of which button should have the event listener.
        leaveButton = newLeaveButton;

        // Apply the current 'leaveTrigger' setting to determine if an event listener should be attached to the new button.
        // We use handleLeaveTriggerSettingChange to decide if the Leave button should be equipped with an event listener
        // based on whether the user wants to save captions when the Leave button is clicked.
        handleLeaveTriggerSettingChange();

    } catch (error) {
        // Log any errors that occur during the process, which can help in debugging issues such as missing elements or unexpected DOM states.
        console.error("Error handling leave button detection:", error);
    }
}




// Handle changes in the 'leaveTrigger' setting to update the Leave button listener as necessary.
// This function is specifically for responding to changes in the 'leaveTrigger' setting,
// which enables or disables saving meeting captions when the 'Leave' button is clicked.

function handleLeaveTriggerSettingChange() {
    // Early return if no Leave button is available.
    // This prevents unnecessary logic execution if the Leave button hasn't been detected yet.
    if (!leaveButton) {
        console.log("No Leave button detected yet. Nothing to update.");
        return;
    }

    // Fetch the current value of 'leaveTrigger' from Chrome's local storage.
    // The 'leaveTrigger' setting indicates whether the Leave button listener should be active.
    chrome.storage.local.get(['leaveTrigger'], function (result) {
        const leaveTrigger = result.leaveTrigger || false; // Default to false if undefined (to avoid any unexpected behavior).

        if (leaveTrigger) {
            // If 'leaveTrigger' is enabled, add an event listener to the Leave button.
            // Adding the listener allows us to capture when the Leave button is clicked, and trigger specific actions.
            console.log("leaveTrigger is enabled, adding event listener to Leave button.");

            // Ensure the listener is added only once.
            // Adding the listener conditionally prevents redundant listeners from being attached,
            // which could lead to multiple, unintended function calls when the button is clicked.
            if (!leaveButtonListener) {
                leaveButtonListener = () => {
                    // The event listener's job is to trigger caption saving when the Leave button is clicked.
                    console.log("Leave button clicked, saving captions...");
                    chrome.runtime.sendMessage({
                        message: "leave_button_save_captions" // Send a message to the background script to handle saving captions.
                    });
                };
                leaveButton.addEventListener('click', leaveButtonListener);
            } else {
                // Log if the listener is already attached to make debugging easier.
                console.log("Leave button listener is already attached.");
            }
        } else {
            // If 'leaveTrigger' is disabled, we need to remove the listener if it exists.
            // This is essential to avoid unwanted actions if the Leave button is clicked while leaveTrigger is off.
            console.log("leaveTrigger is disabled, removing event listener from Leave button if it exists.");
            
            // Check if the listener exists before attempting to remove it.
            if (leaveButtonListener) {
                leaveButton.removeEventListener('click', leaveButtonListener);
                leaveButtonListener = null; // Set to null to indicate no listener is currently attached.
            }
        }
    });
}




// Function to observe changes in the DOM, specifically for dynamic elements like the "Leave" button and meeting details container.
// This function is crucial for a Single Page Application (SPA) like Microsoft Teams, which dynamically renders and modifies its interface.
// Elements like the "Join now" button, "Leave" button, and meeting details container can appear or change as the user navigates through different meeting phases.

function observeDynamicElements() {
    // Configuration for the MutationObserver to watch changes in the DOM.
    // 'childList: true' to observe when children are added or removed, and 'subtree: true' to monitor all descendant nodes.
    // The goal is to catch any important UI elements that are dynamically added or updated.
    const observerConfig = {
        childList: true,
        subtree: true,
    };

    // Create a new MutationObserver instance to handle changes in the DOM.
    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Every time there is a change in the child elements (addition/removal), check if critical elements are present.

                // Look for the "Leave" button.
                // The "Leave" button might be dynamically added when the user joins the meeting or re-joins after disconnection.
                // It's important to handle the button dynamically to ensure event listeners are correctly attached or removed.
                const newLeaveButton = document.querySelector(LEAVE_BUTTON_SELECTOR);
                if (newLeaveButton && newLeaveButton !== leaveButton) {
                    console.log("New Leave button found. Updating listener...");
 
					// We store a unique ID of this new Session Meeting Transcription. We will use it later to solve the issue linked to the missing identifier of the first message
					const now = new Date();
					startTranscriptionTime = now.getTime();

 
					handleLeaveButtonDetection(newLeaveButton);
                }

                // Observe for the "meeting-details-container", which provides information about the meeting such as the title, date, time and participants.
                // These meeting details are displayed before the user officially joins the meeting. However, they may take some time to be fully populated.
                // Users can click the "Join now" button before all details have appeared, leading to scenarios where `getMeetingDetails()`
                // initially returns incomplete data ("Unknown").
                const meetingDetailsContainer = document.querySelector('div[data-tid="meeting-details-container"]');
                if (meetingDetailsContainer) {
                    console.log("Meeting details container found.");

                    // Repeatedly try to get the meeting details until they are fully loaded.
                    // Meeting details might not be fully available if the user clicks "Join now" before the entire container is populated.
                    meetingDetails = getMeetingDetails();
                    if (meetingDetails) {
                        if (meetingDetails === "Unknown") {
                            console.log("Meeting details are still loading. Observing further changes...");
                        } else {
                            console.log("Meeting Details:", meetingDetails);
                        }
                    } else {
                        console.log("We should never get here.");
                    }
                }
            }
        });
    });

    // Start observing changes in the entire body of the document.
    // The Teams UI is highly dynamic, with important elements appearing across different parts of the DOM.
    // Observing the entire body ensures that changes to all key elements, whether at a high level or deep in the structure, are detected.
    mutationObserver.observe(document.body, observerConfig);
}


// Listen for changes in the leaveTrigger value
chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local' && changes.leaveTrigger) {
        console.log("leaveTrigger setting has changed. Updating leave button listener...");
        handleLeaveTriggerSettingChange(); // Re-run the logic to update the listener
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

        // Log the result as needed
        console.log("Meeting Details:", meetingDetails);
    } else {
        console.log("Meeting details container not found.");
    }
	return meetingDetails;
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



/*
<div class="fui-SplitButton ___eevlif0 ftuwxu6 fsxf2b5 f10pi13n fmrv4ls f14uur2j fye5tvs f1e8brtx fxp12j1 fr7y8no f1hvqvul fbw67pg fn44ryq f1xppm0p fampcj8">
    <div id="hangup-button" class="fui-Primitive ___sf65sf0 f22iagw f1l02sjl f122n59 f3rmtva f4d9j23 f1mk8lai f3bhgqh" aria-describedby="tooltip-rpf">
        <button type="button" 
                class="fui-Button r1alrhcs ___1ctvdvf f1sw78cg f1tyq0we f11qmguv fwdb8un f10pi1ik f1yrrgfj feotopo f1a3p1vp fz5stix flvyvdh f1cmbuwj f10ostut f1krrbdw fqlojj1 fdl5y0r f1p3nwhy f1q5o8ev f1pdflbu fonrgv7 f1mkjtbg f1dagfxt f1vxb9gr fqfqhgf fs6yre7 fug8a2c fqwlww5 f1bbhs8t f1i3by9 fbb8suj f1doosug f1sa10l8 f5zu2yh" 
                aria-label="Leave (Ctrl+Shift+H)" 
                	 
                data-track-action-scenario-type="callOrMeetup" 
                data-track-action-gesture="click" 
                data-track-module-name="stopMeetingButton" 
                data-track-action-outcome="submit" 
                data-track-action-scenario="callStopMeeting" 
                data-tabster='{"observed":{"names":["calling-hangup-main-button"]}}'>
            <span class="fui-Button__icon rywnvv2 ___1sc5b1h f1nizpg2 fkyq1ak f1cga7ed f1x0m3f5">
                <svg class="fui-Icon-filled ___12fm75w f1w7gpdv fez10in fg4l7m0" 
                     fill="currentColor" 
                     aria-hidden="true" 
                     width="1em" 
                     height="1em" 
                     viewBox="0 0 20 20" 
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="m17.96 10.94-.16.83c-.15.78-.87 1.3-1.7 1.22l-1.63-.16c-.72-.07-1.25-.59-1.47-1.33-.3-1-.5-1.75-.5-1.75a6.63 6.63 0 0 0-5 0s-.2.75-.5 1.75c-.2.67-.5 1.26-1.2 1.33l-1.63.16c-.81.08-1.6-.43-1.82-1.2l-.25-.84c-.25-.82-.03-1.7.58-2.28C4.1 7.3 6.67 6.51 9.99 6.5c3.33 0 5.6.78 7.16 2.16.66.58.97 1.46.8 2.28Z" 
                          fill="currentColor"></path>
                </svg>
                <svg class="fui-Icon-regular ___1vjqft9 fjseox fez10in fg4l7m0" 
                     fill="currentColor" 
                     aria-hidden="true" 
                     width="1em" 
                     height="1em" 
                     viewBox="0 0 20 20" 
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 6c3.33 0 5.59 1.28 7.15 2.66.66.58.97 1.46.8 2.28l-.15.83c-.15.78-.87 1.3-1.7 1.22l-1.63-.16c-.72-.07-1.25-.59-1.47-1.33-.3-1-.5-1.75-.5-1.75a6.63 6.63 0 0 0-5 0s-.2.75-.5 1.75c-.2.67-.5 1.26-1.2 1.33l-1.63.16c-.81.08-1.6-.43-1.82-1.2l-.25-.84c-.25-.82-.03-1.7.58-2.28C4.1 7.3 6.68 6 10 6Zm3.48 3.53.02.1a46.1 46.1 0 0 0 .46 1.58c.13.45.39.6.6.62l1.64.16c.35.04.57-.17.62-.4l.16-.84c.09-.46-.08-.98-.49-1.34A9.37 9.37 0 0 0 10 7C6.93 7 4.6 8.2 3.37 9.39c-.33.32-.46.8-.31 1.28l.24.83c.1.3.43.53.77.5l1.63-.17.05-.01.05-.05c.07-.09.15-.26.24-.55a115.65 115.65 0 0 0 .46-1.6l.03-.1c.1-.37.45-.62.62-.7a7.62 7.62 0 0 1 5.73 0c.15.07.48.29.59.68v.03Z" 
                          fill="currentColor"></path>
                </svg>
            </span>
            Leave
        </button>
    </div>
    <span hidden=""></span>
    <button type="button" 
            aria-haspopup="menu" 
            aria-expanded="false" 
            id="hangup-button-more-options" 
            data-tabster='{"restorer":{"type":1}}' 
            data-tid="hangup-toggle-more-options-btn" 
            data-inp="hangup-button-more-options" 
            data-track-databag-id="3145f80c-b3b4-45c0-8e6a-da8faa703dfd" 
            data-track-action-gesture="click" 
            data-track-action-outcome="show" 
            data-track-action-scenario="callStopMeetingOptions" 
            data-track-action-scenario-type="callOrMeetup" 
            aria-label="More options" 
            class="fui-Button r1alrhcs fui-MenuButton fui-SplitButton__menuButton ___1rck849 fdl5y0r f1p3nwhy f11589ue f1q5o8ev f1pdflbu fonrgv7 fjxutwb f1s2uweq fr80ssc f1ukrpxl fecsdlb f139oj5f ft1hn21 fuxngvv f1i3by9 f1h0usnq fs4ktlq f16h9ulv fx2bmrt fbb8suj f1dfjoow f1j98vj9 f1tme0vf f4xjyn1 f18onu3q f9ddjv3 f12clzc2 fhoyzc9 ft85np5 fod5ikn fl43uef faaz57k f6pwzcr f1um7c6d f1b6alqh f10jubyq frrbwxo f1sw78cg f14z66ap f1tyq0we fj5z7pm f1mkjtbg f1cqwcg4 fhz96rm fug8a2c f1dagfxt f1vxb9gr fqfqhgf fs6yre7 fqwlww5 f1bbhs8t">
        <span class="fui-MenuButton__menuIcon ___1i49vwa faaz57k fjdnzsz ffseune f14z66ap">
            <svg fill="currentColor" 
                 class="___12fm75w f1w7gpdv fez10in fg4l7m0" 
                 aria-hidden="true" 
                 width="1em" 
                 height="1em" 
                 viewBox="0 0 20 20" 
                 xmlns="http://www.w3.org/2000/svg">
                <path d="M15.85 7.65c.2.2.2.5 0 .7l-5.46 5.49a.55.55 
*/

/*
	
<div id="hangup-button" class="fui-Primitive ___sf65sf0 f22iagw f1l02sjl f122n59 f3rmtva f4d9j23 f1mk8lai f3bhgqh" aria-describedby="tooltip-r9q">
    <button type="button" class="fui-Button r1alrhcs ___1sie96b f1sw78cg fwdb8un foxeeg6 f1a3p1vp fz5stix flvyvdh f1cmbuwj fqlojj1 fkln46t f18kcpxa f1mwjdbk fdl5y0r f1p3nwhy f11589ue f1q5o8ev f1pdflbu fonrgv7 f1mkjtbg f1dagfxt f1vxb9gr fqfqhgf fs6yre7 fug8a2c fqwlww5 f1bbhs8t f1i3by9 fbb8suj"
            aria-label="Leave (Ctrl+Shift+H)" data-tid="" data-track-action-scenario-type="callOrMeetup"
            data-track-action-gesture="click" data-track-module-name="stopMeetingButton"
            data-track-action-outcome="submit" data-track-action-scenario="callStopMeeting"
            data-tabster="{&quot;observed&quot;:{&quot;names&quot;:[&quot;calling-hangup-main-button&quot;]}}">
        <span class="fui-Button__icon rywnvv2 ___1sc5b1h f1nizpg2 fkyq1ak f1cga7ed f1x0m3f5">
            <svg class="fui-Icon-filled ___12fm75w f1w7gpdv fez10in fg4l7m0" fill="currentColor" aria-hidden="true"
                 width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="m17.96 10.94-.16.83c-.15.78-.87 1.3-1.7 1.22l-1.63-.16c-.72-.07-1.25-.59-1.47-1.33-.3-1-.5-1.75-.5-1.75a6.63 6.63 0 0 0-5 0s-.2.75-.5 1.75c-.2.67-.5 1.26-1.2 1.33l-1.63.16c-.81.08-1.6-.43-1.82-1.2l-.25-.84c-.25-.82-.03-1.7.58-2.28C4.1 7.3 6.67 6.51 9.99 6.5c3.33 0 5.6.78 7.16 2.16.66.58.97 1.46.8 2.28Z"
                      fill="currentColor"></path>
            </svg>
            <svg class="fui-Icon-regular ___1vjqft9 fjseox fez10in fg4l7m0" fill="currentColor" aria-hidden="true"
                 width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6c3.33 0 5.59 1.28 7.15 2.66.66.58.97 1.46.8 2.28l-.15.83c-.15.78-.87 1.3-1.7 1.22l-1.63-.16c-.72-.07-1.25-.59-1.47-1.33-.3-1-.5-1.75-.5-1.75a6.63 6.63 0 0 0-5 0s-.2.75-.5 1.75c-.2.67-.5 1.26-1.2 1.33l-1.63.16c-.81.08-1.6-.43-1.82-1.2l-.25-.84c-.25-.82-.03-1.7.58-2.28C4.1 7.3 6.68 6 10 6Zm3.48 3.53.02.1a46.1 46.1 0 0 0 .46 1.58c.13.45.39.6.6.62l1.64.16c.35.04.57-.17.62-.4l.16-.84c.09-.46-.08-.98-.49-1.34A9.37 9.37 0 0 0 10 7C6.93 7 4.6 8.2 3.37 9.39c-.33.32-.46.8-.31 1.28l.24.83c.1.3.43.53.77.5l1.63-.17.05-.01.05-.05c.07-.09.15-.26.24-.55a115.65 115.65 0 0 0 .46-1.6l.03-.1c.1-.37.45-.62.62-.7a7.62 7.62 0 0 1 5.73 0c.15.07.48.29.59.68v.03Z"
                      fill="currentColor"></path>
            </svg>
        </span>Leave
    </button>
</div>

*/
