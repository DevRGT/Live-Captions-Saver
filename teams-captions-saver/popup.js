document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');

    // Load saved preference from Chrome local storage
    chrome.storage.local.get(['saveOption'], function (result) {
        if (result.saveOption) {
            document.getElementById('saveOption').value = result.saveOption;
        } else {
            // Set default value to 'auto' if nothing is saved
            document.getElementById('saveOption').value = 'auto';
        }
    });

    // Save the selected preference when user changes the dropdown value
    document.getElementById('saveOption').addEventListener('change', function () {
        const saveOption = document.getElementById('saveOption').value;
        chrome.storage.local.set({ saveOption: saveOption }, function () {
            console.log('Save option set to:', saveOption);
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
