// // formValidationAndSubmission.js
function validateFormAndSubmit() {
    // Perform form validation
    // Perform form validation
    var isValid = validateForm();

    var form = document.getElementById("contactForm1");

    if (isValid) {
        console.log("is valid")
        submitted=true;
    }

    if (submitted) {
        console.log("is submitted to google")
        form.action = "https://docs.google.com/forms/d/e/1FAIpQLSexhf1_jbD3spbAD5kc850Aufh2yY60huPlnn5Lc2XrI503ag/formResponse";
    }

    // Now submit the form with the updated action
    form.submit();

    // If the form is not valid, prevent the submission
    return false;
}

function validateForm() {
    // Implement your form validation logic here
    // Return true if the form is valid, otherwise return false

    var firstName = document.getElementById('firstName').value;
    var lastName = document.getElementById('lastName').value;
    var email = document.getElementById('email').value;
    var phone = document.getElementById('phone').value;

    // Example validation: Check if fields are not empty
    if (firstName.trim() === '' || lastName.trim() === '') {
        // Display an error message or update the UI as needed
        alert('Please fill in all required fields.');
        return false;
    }

    // Email validation using a regular expression
    var emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!email.match(emailPattern)) {
        // Display an error message or update the UI as needed for invalid email
        alert('Please enter a valid email address.');
        return false;
    }

    // Phone number validation using a regular expression (assuming US phone number format)
    var phonePattern = /^\d{10}$/;
    if (!phone.match(phonePattern)) {
        // Display an error message or update the UI as needed for invalid phone number
        alert('Please enter a valid 10-digit phone number (e.g., 1234567890).');
        return false;
    }

    // Add more validation checks as needed

    // If all checks pass, return true
    return true;
}

//Use the 2 at the end of everything for the 2nd form
// formValidationAndSubmission.js
function validateFormAndSubmit2() {
    // Perform form validation
    var isValid2 = validateForm2();

    var form = document.getElementById("contactForm");

    if (isValid2) {
        submitted=true;
    }

    if (submitted) {
        form.action = "https://docs.google.com/forms/d/e/1FAIpQLSexhf1_jbD3spbAD5kc850Aufh2yY60huPlnn5Lc2XrI503ag/formResponse";
    }


    // Now submit the form with the updated action
    form.submit();
    // If the form is not valid, prevent the submission
    return false;
}

function validateForm2() {
    // Implement your form validation logic here
    // Return true if the form is valid, otherwise return false

    var firstName2 = document.getElementById('firstName2').value;
    var lastName2 = document.getElementById('lastName2').value;
    var email2 = document.getElementById('email2').value;
    var phone2 = document.getElementById('phone2').value;

    // Example validation: Check if fields are not empty
    if (firstName2.trim() === '' || lastName2.trim() === '') {
        // Display an error message or update the UI as needed
        alert('Please fill in all required fields.');
        return false;
    }

    // Email validation using a regular expression
    var emailPattern2 = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!email2.match(emailPattern2)) {
        // Display an error message or update the UI as needed for invalid email
        alert('Please enter a valid email address.');
        return false;
    }

    // Phone number validation using a regular expression (assuming US phone number format)
    var phonePattern2 = /^\d{10}$/;
    if (!phone2.match(phonePattern2)) {
        // Display an error message or update the UI as needed for invalid phone number
        alert('Please enter a valid 10-digit phone number (e.g., 1234567890).');
        return false;
    }

    // Add more validation checks as needed

    // If all checks pass, return true
    return true;
}
