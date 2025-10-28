import { test, expect } from '@playwright/test';

test('Debug supervisor authentication', async ({ page }) => {
  const consoleLogs = [];
  
  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('[DEBUG CAMERA]') || msg.text().includes('isSupervisorAuthenticated')) {
      consoleLogs.push(msg.text());
    }
  });

  // First, navigate to supervisor page to check if authentication is working
  await page.goto('http://localhost:3000/supervisor');
  await page.waitForTimeout(2000);
  
  // Check localStorage for supervisor authentication after supervisor page
  const supervisorAuthAfterSupervisor = await page.evaluate(() => {
    return localStorage.getItem('supervisorAuth');
  });
  
  console.log('Supervisor Auth after /supervisor page:', supervisorAuthAfterSupervisor);
  
  // Now navigate to member page
  await page.goto('http://localhost:3000/membro');
  await page.waitForTimeout(2000);
  
  // Check localStorage again
  const supervisorAuth = await page.evaluate(() => {
    return localStorage.getItem('supervisorAuth');
  });
  
  console.log('Supervisor Auth in /membro page:', supervisorAuth);
  
  // Test the isSupervisorAuthenticated function directly
  const isSupervisorResult = await page.evaluate(() => {
    // Import the function if available globally or through window
    if (window.isSupervisorAuthenticated) {
      return window.isSupervisorAuthenticated();
    }
    
    // Or test the logic directly
    const supervisorData = localStorage.getItem('supervisorAuth');
    if (!supervisorData) return false;
    
    try {
      const data = JSON.parse(supervisorData);
      return data && data.autenticado === true;
    } catch {
      return false;
    }
  });
  
  console.log('isSupervisorAuthenticated result:', isSupervisorResult);
  console.log('Console logs captured:', consoleLogs.length);
  
  // Print all captured logs
  consoleLogs.forEach(log => console.log('DEBUG LOG:', log));
  
  // Try to click on an operation to trigger the debug logs
  try {
    // Look for operation elements (adjust selector as needed)
    const operationElements = await page.locator('[data-testid*="operacao"], .operacao, .operation').all();
    console.log('Found operation elements:', operationElements.length);
    
    if (operationElements.length > 0) {
      await operationElements[0].click();
      await page.waitForTimeout(1000);
      console.log('Clicked on first operation');
    }
  } catch (error) {
    console.log('Could not click on operation:', error.message);
  }
  
  // Final log count
  console.log('Final console logs captured:', consoleLogs.length);
  consoleLogs.forEach(log => console.log('FINAL DEBUG LOG:', log));
});