const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Board, Sensor, Led, Button } = require("johnny-five");

// Create an Express application
const app = express();
// Create an HTTP server using the Express app
const server = http.createServer(app);
// Initialize Socket.IO with the HTTP server
const io = socketIo(server);

// Enable JSON parsing for incoming requests
app.use(express.json());
// Serve static files from the "public" directory
app.use(express.static("public"));

// Global variables for state management
global.sensorData = { value: 'N/A', ledState: 'N/A' };
global.alarmActive = false;
global.alarmMessage = 'Inactif';
global.systemStatus = 'Système en mode normal';
global.operationMode = 'simple'; // Default mode
global.alarmMode = false;
global.detectionActive = false;
global.buttonPressSequence = [];
global.correctCode = [2, 1, 2, 1]; // Button 2, Button 1, Button 2, Button 1
global.LIGHT_THRESHOLD = 300; // Define a consistent threshold value

// Define API endpoints for async requests
app.get('/sensor-data', (req, res) => {
  res.json(global.sensorData);
});

app.get('/alarm-status', (req, res) => {
  res.json({
    alarmActive: global.alarmActive || false,
    message: global.alarmMessage || 'Inactif',
    status: global.systemStatus || 'Système en mode normal'
  });
});

app.post('/update-mode', (req, res) => {
  const { mode } = req.body;
  if (mode && (mode === 'simple' || mode === 'alarm')) {
    console.log(`Changing mode from ${global.operationMode} to ${mode}`);
    
    // If switching to simple mode and alarm is active, stop the alarm
    if (mode === 'simple' && (global.alarmActive || global.alarmMode || global.detectionActive)) {
      if (typeof stopAlarmMode === 'function') {
        stopAlarmMode();
      } else {
        // Fallback if function not available yet
        global.alarmActive = false;
        global.alarmMessage = 'Inactif';
        global.systemStatus = 'Système en mode normal';
        
        // Clear any intervals that might be running
        if (typeof alarmBlinkInterval !== 'undefined' && alarmBlinkInterval) {
          clearInterval(alarmBlinkInterval);
          alarmBlinkInterval = null;
        }
        
        if (typeof detectionBlinkInterval !== 'undefined' && detectionBlinkInterval) {
          clearInterval(detectionBlinkInterval);
          detectionBlinkInterval = null;
        }
      }
    } else {
      // Just update the mode
      global.operationMode = mode;
      
      // If switching to simple mode, update LED based on current sensor value
      if (mode === 'simple' && global.sensorData && global.sensorData.value !== 'N/A') {
        // Clear any intervals that might be running
        if (typeof alarmBlinkInterval !== 'undefined' && alarmBlinkInterval) {
          clearInterval(alarmBlinkInterval);
          alarmBlinkInterval = null;
        }
        
        if (typeof detectionBlinkInterval !== 'undefined' && detectionBlinkInterval) {
          clearInterval(detectionBlinkInterval);
          detectionBlinkInterval = null;
        }
        
        const currentSensorValue = global.sensorData.value;
        if (currentSensorValue < global.LIGHT_THRESHOLD) {
          if (typeof led !== 'undefined') {
            led.on();
          }
        } else {
          if (typeof led !== 'undefined') {
            led.off();
          }
        }
      }
    }
    
    res.json({ success: true, mode });
    
    // Notify all clients about the mode change
    io.emit("modeChange", { mode });
  } else {
    res.status(400).json({ success: false, error: 'Invalid mode' });
  }
});

// Start the web server on port 3000 first, before trying to connect to Arduino
server.listen(3000, () => {
  console.log("Server listening on port 3000");
});

// Initialize the Arduino board on COM6 with a timeout
let boardConnected = false;
const board = new Board({ 
  port: "COM6",
  repl: false,  // Disable REPL to prevent closing
  timeout: 10000 // 10 second timeout for connection
});

// Handle board errors
board.on("error", (error) => {
  console.error("Board error:", error);
  io.emit("boardStatus", { connected: false, error: error.message });
});

// Handle board connection
board.on("ready", () => {
  console.log("Arduino board ready on COM6");
  boardConnected = true;
  io.emit("boardStatus", { connected: true });

  // Set up the sensor on A3 with a 200ms read frequency.
  const sensor = new Sensor({
    pin: "A3",
    freq: 200
  });

  // Set up the LED on digital pin 8.
  const led = new Led(8);
  led.off(); // Ensure LED is off at startup

  // Set up a second LED for alarm indicator on pin 9
  const alarmLed = new Led(9);
  alarmLed.off();

  // Set up two buttons: one on pin 2 and one on pin 3.
  const buttonPin2 = new Button({
    pin: 2
    // , isPullup: true // Uncomment if needed.
  });
  const buttonPin1 = new Button({
    pin: 3
    // , isPullup: true // Uncomment if needed.
  });

  // Variables for system logic:
  let sensorBelowStartTime = null; // Time when sensor first went below threshold.
  let alarmCountdown = null;       // Timer for alarm countdown
  let alarmBlinkInterval = null;   // Interval for alarm LED blinking
  let detectionBlinkInterval = null; // Interval for detection LED blinking

  // Function to toggle the LED for blinking
  function blinkLed() {
    led.toggle();
  }

  // Function to toggle the alarm LED for blinking
  function blinkAlarmLed() {
    alarmLed.toggle();
  }

  // Function to start alarm mode
  function startAlarmMode() {
    global.alarmMode = true;
    global.alarmActive = true;
    global.alarmMessage = 'ALARME ACTIVE!';
    global.systemStatus = 'Système en mode alarme!';
    
    // Turn on yellow LED
    led.on();
    
    // Start alarm LED blinking
    alarmBlinkInterval = setInterval(blinkAlarmLed, 500);
    
    console.log("ALARM MODE ACTIVATED!");
    
    // Emit alarm status to clients
    io.emit("alarmStatus", { 
      alarmActive: true, 
      message: 'ALARME ACTIVE!',
      status: 'Système en mode alarme!'
    });
  }

  // Function to stop alarm mode and return to normal
  function stopAlarmMode() {
    console.log("Stopping alarm mode and returning to simple mode");
    
    // Reset all global states
    global.alarmMode = false;
    global.detectionActive = false;
    global.alarmActive = false;
    global.alarmMessage = 'Inactif';
    global.systemStatus = 'Système en mode normal';
    global.operationMode = 'simple'; // Reset to simple mode
    global.buttonPressSequence = [];
    
    // Clear any intervals and timeouts
    if (alarmBlinkInterval) {
      clearInterval(alarmBlinkInterval);
      alarmBlinkInterval = null;
    }
    
    if (detectionBlinkInterval) {
      clearInterval(detectionBlinkInterval);
      detectionBlinkInterval = null;
    }
    
    if (alarmCountdown) {
      clearTimeout(alarmCountdown);
      alarmCountdown = null;
    }
    
    // Turn off alarm LED
    alarmLed.off();
    
    // In simple mode, LED should follow sensor value
    const currentSensorValue = global.sensorData.value;
    if (currentSensorValue < global.LIGHT_THRESHOLD) {
      led.on();
    } else {
      led.off();
    }
    
    // Emit alarm status to clients
    io.emit("alarmStatus", { 
      alarmActive: false, 
      message: 'Inactif',
      status: 'Système en mode normal'
    });
    
    // Emit mode change to clients
    io.emit("modeChange", { mode: 'simple' });
  }

  // Function to start detection countdown
  function startDetectionCountdown() {
    global.detectionActive = true;
    global.alarmActive = true;
    global.alarmMessage = 'Présence détectée! Entrez le code dans 30 secondes';
    global.systemStatus = 'Système en attente du code de sécurité';
    
    // Reset button sequence
    global.buttonPressSequence = [];
    
    // Start LED blinking
    if (detectionBlinkInterval) {
      clearInterval(detectionBlinkInterval);
    }
    detectionBlinkInterval = setInterval(blinkLed, 300);
    
    console.log("Presence detected! Enter security code within 30 seconds");
    
    // Emit alarm status to clients
    io.emit("alarmStatus", { 
      alarmActive: true, 
      message: 'Présence détectée! Entrez le code dans 30 secondes',
      status: 'Système en attente du code de sécurité'
    });
    
    // Set 30-second countdown
    alarmCountdown = setTimeout(() => {
      clearInterval(detectionBlinkInterval);
      
      // If code wasn't entered correctly, activate alarm
      if (global.detectionActive) {
        startAlarmMode();
      }
    }, 30000);
  }

  // Function to check if entered code is correct
  function checkSecurityCode() {
    // Check if entered sequence matches correct code
    if (global.buttonPressSequence.length === global.correctCode.length) {
      let isCorrect = true;
      
      for (let i = 0; i < global.correctCode.length; i++) {
        if (global.buttonPressSequence[i] !== global.correctCode[i]) {
          isCorrect = false;
          break;
        }
      }
      
      if (isCorrect) {
        // Code is correct, deactivate detection
        console.log("Correct security code entered!");
        global.systemStatus = 'Code correct! Désactivation de l\'alarme';
        io.emit("alarmStatus", { 
          alarmActive: true, 
          message: 'Code correct! Désactivation de l\'alarme',
          status: 'Code correct! Désactivation de l\'alarme'
        });
        
        // Clear countdown and return to normal
        if (alarmCountdown) {
          clearTimeout(alarmCountdown);
          alarmCountdown = null;
        }
        
        global.detectionActive = false;
        setTimeout(stopAlarmMode, 2000); // Short delay before returning to normal
      } else {
        // Code is incorrect, activate alarm
        console.log("Incorrect security code entered!");
        global.systemStatus = 'Code incorrect! Activation de l\'alarme';
        io.emit("alarmStatus", { 
          alarmActive: true, 
          message: 'Code incorrect! Activation de l\'alarme',
          status: 'Code incorrect! Activation de l\'alarme'
        });
        
        // Clear countdown and activate alarm
        if (alarmCountdown) {
          clearTimeout(alarmCountdown);
          alarmCountdown = null;
        }
        
        startAlarmMode();
      }
    }
  }

  // Sensor data handler: update LED based on sensor and system mode
  sensor.on("data", function() {
    const sensorValue = this.value;
    console.log("Luminosity:", sensorValue, "Mode:", global.operationMode);
    
    // Update global sensor data
    global.sensorData = { 
      value: sensorValue, 
      ledState: led.isOn ? "ON" : "OFF",
      mode: global.operationMode
    };

    // Handle sensor based on current operation mode
    if (global.operationMode === 'simple') {
      // In simple mode, LED should be ON when sensor value is below threshold
      // and OFF when sensor value is above threshold
      if (sensorValue < global.LIGHT_THRESHOLD) {
        led.on();
      } else {
        led.off();
      }
    } else if (global.operationMode === 'alarm' && !global.alarmMode && !global.detectionActive) {
      // Alarm mode (standby): sensor acts as presence detector
      if (sensorValue < global.LIGHT_THRESHOLD) {
        // Presence detected, start countdown
        startDetectionCountdown();
      }
    }
    // Note: If in alarm mode with alarmMode or detectionActive true,
    // we don't change LED state here as it's handled by the alarm functions

    // Emit sensor data to connected clients
    io.emit("sensorData", global.sensorData);
  });

  // Button handler for the button on pin 2
  buttonPin2.on("press", () => {
    console.log("Button on pin 2 pressed");
    
    if (global.detectionActive) {
      // Add button 2 press to sequence
      global.buttonPressSequence.push(2);
      console.log("Button sequence:", global.buttonPressSequence);
      
      // Check if code is complete
      checkSecurityCode();
    }
  });

  // Button handler for the button on pin 1
  buttonPin1.on("press", () => {
    console.log("Button on pin 3 pressed");
    
    if (global.detectionActive) {
      // Add button 1 press to sequence
      global.buttonPressSequence.push(1);
      console.log("Button sequence:", global.buttonPressSequence);
      
      // Check if code is complete
      checkSecurityCode();
    }
  });
  
  // Handle board closing
  board.on("exit", () => {
    console.log("Board connection closed, but server will continue running");
    boardConnected = false;
    io.emit("boardStatus", { connected: false });
  });
});

// Simulate sensor data if board is not connected (for testing)
setInterval(() => {
  if (!boardConnected) {
    console.log("Board not connected, simulating sensor data");
    global.sensorData = { 
      value: Math.floor(Math.random() * 1000), 
      ledState: "SIMULATION"
    };
    io.emit("sensorData", global.sensorData);
  }
}, 5000);
