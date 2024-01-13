/*!
* Start Bootstrap - Business Frontpage v5.0.9 (https://startbootstrap.com/template/business-frontpage)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-business-frontpage/blob/master/LICENSE)
*/
// This file is intentionally blank
// Use this file to add JavaScript to your project
// script.js
const showContactFormButton = document.getElementById('showContactFormButton');
const contactPopupContainer = document.getElementById('contactPopupContainer');


showContactFormButton.addEventListener('click', () => {
    console.log('Button clicked'); // Check if this message appears in the console
    contactPopupContainer.style.display = 'block'; // Show the contact form popup
   
});



contactPopupContainer.addEventListener('click', (event) => {
    if (event.target === contactPopupContainer) {
        console.log('Button clicked'); // Check if this message appears in the console
        contactPopupContainer.style.display = 'none'; // Hide the contact form popup if clicked outside
    }
});

const showContactFormButton2 = document.getElementById('showContactFormButton2');

showContactFormButton2.addEventListener('click', () => {
    console.log('Button clicked'); // Check if this message appears in the console
    contactPopupContainer.style.display = 'block'; // Show the contact form popup
   
});