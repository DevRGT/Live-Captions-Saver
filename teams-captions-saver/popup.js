document.addEventListener('DOMContentLoaded', function () {
    console.log('popup.js loaded!');

    // Load saved preference from Chrome local storage
    chrome.storage.local.get(['saveOption'], function (result) {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving saved preference:", chrome.runtime.lastError);
        } else {
            if (result.saveOption) {
                console.log("Loaded saveOption:", result.saveOption);
                document.getElementById('saveOption').value = result.saveOption;
            } else {
                console.log("No saveOption found, setting default to 'auto'");
                document.getElementById('saveOption').value = 'auto';
            }
        }
    });

    // Save the selected preference when user changes the dropdown value
    document.getElementById('saveOption').addEventListener('change', function () {
        const saveOption = document.getElementById('saveOption').value;
        chrome.storage.local.set({ saveOption: saveOption }, function () {
            if (chrome.runtime.lastError) {
                console.error("Error saving saveOption:", chrome.runtime.lastError);
            } else {
                console.log('Save option set to:', saveOption);
            }
        });
    });

    // Add event listener for saving captions manually
    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');
        chrome.runtime.sendMessage({
            message: "save_captions"
        });
    });
});
