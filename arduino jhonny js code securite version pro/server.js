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
    global.operationMode = mode;
    res.json({ success: true, mode });
    console.log(`Mode changed to: ${mode}`);
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
  led.off();

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
  let detectionActive = false;     // Indicates if presence detection is active
  let alarmCountdown = null;       // Timer for alarm countdown
  let alarmMode = false;           // Indicates if alarm mode is active
  let buttonPressSequence = [];    // Sequence of button presses for code entry
  let correctCode = [2, 1, 2, 1];  // Correct code sequence (button 2, button 1, button 2, button 1)
  let alarmBlinkInterval = null;   // Interval for alarm LED blinking

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
    alarmMode = true;
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
    alarmMode = false;
    global.alarmActive = false;
    global.alarmMessage = 'Inactif';
    global.systemStatus = 'Système en mode normal';
    
    // Clear any intervals
    if (alarmBlinkInterval) {
      clearInterval(alarmBlinkInterval);
      alarmBlinkInterval = null;
    }
    
    // Turn off LEDs
    led.off();
    alarmLed.off();
    
    // Reset button sequence
    buttonPressSequence = [];
    
    console.log("Alarm deactivated, returning to normal mode");
    
    // Emit alarm status to clients
    io.emit("alarmStatus", { 
      alarmActive: false, 
      message: 'Inactif',
      status: 'Système en mode normal'
    });
  }

  // Function to start detection countdown
  function startDetectionCountdown() {
    detectionActive = true;
    global.alarmActive = true;
    global.alarmMessage = 'Présence détectée! Entrez le code dans 30 secondes';
    global.systemStatus = 'Système en attente du code de sécurité';
    
    // Reset button sequence
    buttonPressSequence = [];
    
    // Start LED blinking
    const blinkInterval = setInterval(blinkLed, 300);
    
    console.log("Presence detected! Enter security code within 30 seconds");
    
    // Emit alarm status to clients
    io.emit("alarmStatus", { 
      alarmActive: true, 
      message: 'Présence détectée! Entrez le code dans 30 secondes',
      status: 'Système en attente du code de sécurité'
    });
    
    // Set 30-second countdown
    alarmCountdown = setTimeout(() => {
      clearInterval(blinkInterval);
      
      // If code wasn't entered correctly, activate alarm
      if (detectionActive) {
        startAlarmMode();
      }
    }, 30000);
  }

  // Function to check if entered code is correct
  function checkSecurityCode() {
    // Check if entered sequence matches correct code
    if (buttonPressSequence.length === correctCode.length) {
      let isCorrect = true;
      
      for (let i = 0; i < correctCode.length; i++) {
        if (buttonPressSequence[i] !== correctCode[i]) {
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
        
        detectionActive = false;
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
    console.log("Luminosity:", sensorValue);
    
    // Update global sensor data
    global.sensorData = { 
      value: sensorValue, 
      ledState: led.isOn ? "ON" : "OFF"
    };

    // Handle sensor based on current operation mode
    if (global.operationMode === 'simple') {
      // Simple mode: LED follows sensor
      if (alarmMode) {
        // If we were in alarm mode, return to normal
        stopAlarmMode();
      }
      
      if (sensorValue < 300) {
        led.on();
      } else {
        led.off();
      }
    } else if (global.operationMode === 'alarm') {
      // Alarm mode: sensor acts as presence detector
      if (!detectionActive && !alarmMode && sensorValue < 300) {
        // Presence detected, start countdown
        startDetectionCountdown();
      }
    }

    // Emit sensor data to connected clients
    io.emit("sensorData", global.sensorData);
  });

  // Button handler for the button on pin 2
  buttonPin2.on("press", () => {
    console.log("Button on pin 2 pressed");
    
    if (detectionActive) {
      // Add button 2 press to sequence
      buttonPressSequence.push(2);
      console.log("Button sequence:", buttonPressSequence);
      
      // Check if code is complete
      checkSecurityCode();
    }
  });

  // Button handler for the button on pin 1
  buttonPin1.on("press", () => {
    console.log("Button on pin 3 pressed");
    
    if (detectionActive) {
      // Add button 1 press to sequence
      buttonPressSequence.push(1);
      console.log("Button sequence:", buttonPressSequence);
      
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
