// Copy and paste this into the browser console at http://localhost:8080
// Or save as bookmarklet: javascript:(function(){const cli=document.getElementById('cli');if(!cli){alert('CLI not found');return;}cli.value='testRangeUtil registerTicks';const inputEvent=new Event('input',{bubbles:true});cli.dispatchEvent(inputEvent);setTimeout(()=>{const enterDown=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true});const enterUp=new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true});cli.dispatchEvent(enterDown);cli.dispatchEvent(enterUp);},100);console.log('Executed: testRangeUtil registerTicks');})();

(function() {
  const cli = document.getElementById('cli');
  if (!cli) {
    console.error('CLI textarea not found. Make sure the page is loaded.');
    return;
  }
  
  // Set the command
  cli.value = 'testRangeUtil registerTicks';
  
  // Trigger input event
  const inputEvent = new Event('input', { bubbles: true });
  cli.dispatchEvent(inputEvent);
  
  // Wait a moment then simulate Enter key
  setTimeout(() => {
    const enterDown = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    
    const enterUp = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    
    cli.dispatchEvent(enterDown);
    cli.dispatchEvent(enterUp);
    
    console.log('✓ Command executed: testRangeUtil registerTicks');
    console.log('Check the test results container (top-right) for results');
  }, 100);
})();


