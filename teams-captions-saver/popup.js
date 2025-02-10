document.addEventListener('DOMContentLoaded', function () {
    // This code runs once the popup has loaded
    console.log('popup.js loaded!');

    // Save Captions Button Event Listener
    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');

        // Send a message to the background/service worker to save the captions
        chrome.runtime.sendMessage({
            message: "manual_save_captions"
        });
    });

    // Initialize elements related to toggle switches
    const saveToggle = document.getElementById('saveToggle');
    const autoSaveOption = document.getElementById('autoSaveOption');
    const askSaveOption = document.getElementById('askSaveOption');
    const toggleSlider = document.getElementById('toggleSlider');

    const leaveTriggerToggle = document.getElementById('leaveTriggerToggle');

    // Just to check if we have access to storage for our settings values
	if (!chrome.storage || !chrome.storage.local) {
		console.error('chrome.storage API is not available. Check if permissions are correctly set in manifest.json.');
		return; // Exit early since the API is not available
	}

    // Load saved settings when the popup is opened
    chrome.storage.local.get(['saveOption', 'leaveTrigger'], function (result) {
        // Handle Save Option Toggle
        if (result.saveOption === undefined) {
            console.log('Warning: saveOption not found in local storage. Using default value "auto".');
        }
        const saveOption = result.saveOption ? result.saveOption : 'auto'; // Default to 'auto' if not found
        if (saveOption === 'ask') {
            toggleSlider.style.transform = 'translateX(145px)'; // Move slider to the "Choose Location" side
            autoSaveOption.classList.remove('selected');
            askSaveOption.classList.add('selected');
            console.log('Loaded save option: Choose Location');
        } else {
            toggleSlider.style.transform = 'translateX(0px)'; // Keep slider on the "Auto Save" side
            autoSaveOption.classList.add('selected');
            askSaveOption.classList.remove('selected');
            console.log('Loaded save option: Auto Save (default if not found)');
        }

        // Handle Leave Button Trigger Toggle
        if (result.leaveTrigger === undefined) {
            console.log('Warning: leaveTrigger not found in local storage. Using default value "false".');
        }
        const leaveTrigger = result.leaveTrigger !== undefined ? result.leaveTrigger : false; // Default to false if not found
        leaveTriggerToggle.checked = leaveTrigger;
        console.log(`Loaded leave trigger setting: ${leaveTrigger}`);
    });

    // Event listener for toggling between Auto Save and Choose Location
    saveToggle.addEventListener('click', function () {
        if (autoSaveOption.classList.contains('selected')) {
            // Switch to "Choose Location"
            toggleSlider.style.transform = 'translateX(145px)'; // Visually move the slider
            autoSaveOption.classList.remove('selected');
            askSaveOption.classList.add('selected');

            // Save the choice in Chrome's local storage
            chrome.storage.local.set({ saveOption: 'ask' }, function () {
                console.log('Save option updated to: Choose Location');
            });
        } else {
            // Switch to "Auto Save"
            toggleSlider.style.transform = 'translateX(0px)'; // Move the slider back to "Auto Save"
            askSaveOption.classList.remove('selected');
            autoSaveOption.classList.add('selected');

            // Save the choice in Chrome's local storage
            chrome.storage.local.set({ saveOption: 'auto' }, function () {
                console.log('Save option updated to: Auto Save');
            });
        }
    });

	// Event listener for toggling the "Save captions when clicking 'Leave' button" option
	leaveTriggerToggle.addEventListener('change', function () {
		const isChecked = leaveTriggerToggle.checked;
		console.log(`Leave trigger toggled. New value: ${isChecked}`);

		// Save the updated value of leave trigger in Chrome's local storage
		chrome.storage.local.set({ leaveTrigger: isChecked }, function () {
			if (chrome.runtime.lastError) {
				console.error('Error saving leave trigger:', chrome.runtime.lastError.message);
			} else {
				console.log(`Leave trigger updated to: ${isChecked}`);
			}
		});
	});

		  // Directory Input and Button
		  const directoryInput = document.getElementById('directoryInput');
		  const chooseDirectoryButton = document.getElementById('chooseDirectoryButton');
		  const directoryStatus = document.getElementById('directoryStatus');

		  // Load saved directory when the popup is opened
		  chrome.storage.local.get(['directory'], function (result) {
		      if (result.directory) {
		          directoryInput.value = result.directory;
		          directoryStatus.textContent = `Current directory: ${result.directory}`;
		      } else {
		          directoryStatus.textContent = 'No directory chosen.';
		      }
		  });

		  // Event listener for the "Choose Directory" button
		  chooseDirectoryButton.addEventListener('click', async function () {
		      const directory = await chrome.fileSystem.chooseEntry({ type: 'openDirectory' });
		      if (directory) {
		          const directoryPath = directory.id;
		          directoryInput.value = directoryPath;

		          // Save the directory to Chrome's local storage
		          chrome.storage.local.set({ directory: directoryPath }, function () {
		              directoryStatus.textContent = `Directory saved: ${directoryPath}`;
		              console.log('Directory saved: ' + directoryPath);
		          });
		      } else {
		          directoryStatus.textContent = 'No directory chosen.';
		      }
		  });
});
