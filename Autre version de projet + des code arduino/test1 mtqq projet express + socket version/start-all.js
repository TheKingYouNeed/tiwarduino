const { spawn } = require('child_process');
const path = require('path');

// Function to start a process
function startProcess(scriptName, processName) {
  console.log(`Starting ${processName}...`);
  
  const process = spawn('node', [scriptName], {
    stdio: 'pipe',
    shell: true
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${processName}] ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${processName} ERROR] ${data.toString().trim()}`);
  });
  
  process.on('close', (code) => {
    console.log(`${processName} process exited with code ${code}`);
  });
  
  return process;
}

// Start MQTT broker first
const brokerProcess = startProcess('mqtt-broker.js', 'MQTT Broker');

// Wait for broker to start before starting other processes
setTimeout(() => {
  // Start server
  const serverProcess = startProcess('server.js', 'Security Server');
  
  // Start servient
  const servientProcess = startProcess('servient.js', 'Arduino Servient');
  
  console.log('All services started! Access the web interface at http://localhost:3000');
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down all services...');
    
    // Kill all child processes
    brokerProcess.kill();
    serverProcess.kill();
    servientProcess.kill();
    
    console.log('All services stopped');
    process.exit(0);
  });
}, 2000); // Wait 2 seconds for broker to start
