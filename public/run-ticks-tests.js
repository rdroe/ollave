// Run this in the browser console to automatically execute the ticks tests
(function() {
  const cliElement = document.getElementById('cli');
  if (!cliElement) {
    console.error('CLI element not found');
    return;
  }
  
  // Set the command
  cliElement.value = 'testRangeUtil registerTicks';
  
  // Trigger the input event and then simulate Enter key
  cliElement.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Wait a bit then trigger Enter
  setTimeout(() => {
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    cliElement.dispatchEvent(enterEvent);
    
    // Also try keyup
    setTimeout(() => {
      const enterEventUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      cliElement.dispatchEvent(enterEventUp);
    }, 10);
  }, 100);
  
  console.log('Test command submitted: testRangeUtil registerTicks');
  console.log('Check the test results container (top-right) for results');
})();



