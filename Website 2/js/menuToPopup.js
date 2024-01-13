document.addEventListener("DOMContentLoaded", function () {
    // Get references to the link and button
    var contactLink = document.getElementById("contactLink");
    var showContactFormButton = document.getElementById("showContactFormButton");

    // Add an event listener to the link
    contactLink.addEventListener("click", function (event) {
        // Prevent the default link behavior (e.g., scrolling to #contact)
        event.preventDefault();
        
        // Trigger a click event on the button
        showContactFormButton.click();
    });
});