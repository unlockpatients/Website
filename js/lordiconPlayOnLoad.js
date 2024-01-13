document.addEventListener("DOMContentLoaded", function () {
    // Find the lord-icon elements by their IDs
    var lordicon1 = document.getElementById("lordicon1");
  
  
    // Create a new MouseEvent for "mouseenter"
    var hoverEvent = new MouseEvent("mouseenter", {
      bubbles: true,
      cancelable: true,
    });
  
    // Dispatch the "mouseenter" event to simulate hover for each element
    lordicon1.dispatchEvent(hoverEvent);
  });
  