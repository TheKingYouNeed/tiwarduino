const { Board, Led, Button, Sensor, Servo } = require("johnny-five");
const mqtt = require('mqtt');

// Global variables
let operationMode = 'simple'; // 'simple' or 'alarm'
let alarmState = 'inactive'; // 'inactive', 'detection', or 'active'
let doorState = 'closed'; // 'open' or 'closed'
let detectedPerson = null; // Name of the detected person

// Variables for alarm functionality
let buttonPressSequence = []; // Store button press sequence
let alarmCountdown = null; // Timeout for alarm countdown
let alarmBlinkInterval = null; // Interval for alarm blinking
let detectionBlinkInterval = null; // Interval for detection phase blinking
let doorCloseTimeout = null; // Timeout for auto-closing the door

// Variables for hardware components
let led = null;
let doorServo = null;
let buttonPin1 = null;
let buttonPin2 = null;

// Constants
const LIGHT_THRESHOLD = 300; // Threshold for light sensor
const DOOR_OPEN_ANGLE = 90; // Angle for open door
const DOOR_CLOSED_ANGLE = 0; // Angle for closed door

// Security codes for different people
const PERSON_CODES = {
  '1212': 'John',
  '2121': 'Alice',
  '1122': 'Bob',
  '2211': 'Emma'
};

// Connect to MQTT broker
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Subscribe to command topics
  client.subscribe('servient/commands/mode');
  client.subscribe('servient/commands/door');
  client.subscribe('servient/commands/alarm');
  
  // Publish initial state
  publishState();
  console.log('Initial state published');
});

// Handle incoming MQTT messages
client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log('Received message on topic:', topic, 'payload:', payload);
    
    if (topic === 'servient/commands/mode') {
      if (payload.mode === 'simple') {
        // Switch to simple mode
        operationMode = 'simple';
        
        // If in alarm state, stop it
        if (alarmState !== 'inactive') {
          stopAlarm();
        } else {
          // Update LED based on current sensor value
          const currentSensorValue = sensor.value;
          if (currentSensorValue < LIGHT_THRESHOLD) {
            led.on();
          } else {
            led.off();
          }
        }
        
        // Publish state change
        publishState();
        publishEvent('modeChange', { mode: 'simple' });
        console.log('Switched to simple mode');
      } else if (payload.mode === 'alarm') {
        // Switch to alarm mode
        operationMode = 'alarm';
        
        // Reset alarm state to inactive
        alarmState = 'inactive';
        detectedPerson = null;
        buttonPressSequence = [];
        
        // Make sure LED is off initially in alarm mode
        if (led) {
          led.off();
        }
        
        // Publish state change
        publishState();
        publishEvent('modeChange', { mode: 'alarm' });
        console.log('Switched to alarm mode');
      }
    } else if (topic === 'servient/commands/door') {
      if (payload.action === 'open') {
        openDoor();
      } else if (payload.action === 'close') {
        closeDoor();
      }
    } else if (topic === 'servient/commands/alarm') {
      if (payload.action === 'stop') {
        stopAlarm();
      }
    }
  } catch (error) {
    console.error('Error processing MQTT message:', error);
    publishEvent('error', { message: error.message });
  }
});

// Function to publish state to MQTT
function publishState() {
  client.publish('servient/state', JSON.stringify({
    doorState: doorState,
    alarmState: alarmState,
    detectedPerson: detectedPerson,
    operationMode: operationMode,
    timestamp: new Date().toISOString()
  }));
}

// Function to publish events to MQTT
function publishEvent(eventType, data) {
  client.publish('servient/events', JSON.stringify({
    event: eventType,
    data: data,
    timestamp: new Date().toISOString()
  }));
}

// Set up Johnny-Five with Arduino
const board = new Board({
  port: "COM6",
  repl: false
});

// Handle board errors
board.on("error", function(err) {
  console.error("Board error:", err);
  publishEvent('error', { message: err.message });
});

// When board is ready, set up components
board.on("ready", () => {
  console.log("Board connected and ready!");
  publishEvent('boardStatus', { connected: true });
  
  // Set up LED on pin 8 (for alarm indicator)
  led = new Led(8);
  led.off();
  
  // Set up door servo on pin 7
  doorServo = new Servo({
    pin: 7,
    range: [0, 90],  // Set the range to 0-90 degrees
    startAt: 0       // Start at closed position (0 degrees)
  });
  
  // Set up buttons for code entry
  buttonPin2 = new Button({
    pin: 2
  });
  buttonPin1 = new Button({
    pin: 3
  });
  
  // Set up light sensor on analog pin A3 with a 200ms read frequency
  const sensor = new Sensor({
    pin: "A3",
    freq: 200
  });
  
  // Function to toggle the alarm LED for blinking
  function blinkAlarmLed() {
    if (led) led.toggle();
  }
  
  // Function to open the door
  function openDoor() {
    console.log("Opening door...");
    
    // Set door state to open
    doorState = 'open';
    
    // Control the servo to open the door
    if (doorServo) {
      doorServo.to(90);
    }
    
    // Publish door state change
    publishEvent('doorControl', { action: 'open', state: doorState });
    
    // Automatically close the door after 5 seconds
    if (doorCloseTimeout) {
      clearTimeout(doorCloseTimeout);
    }
    
    doorCloseTimeout = setTimeout(() => {
      closeDoor();
    }, 5000);
  }
  
  // Function to close the door
  function closeDoor() {
    console.log("Closing door...");
    
    // Set door state to closed
    doorState = 'closed';
    
    // Control the servo to close the door
    if (doorServo) {
      doorServo.to(0);
    }
    
    // Publish door state change
    publishEvent('doorControl', { action: 'close', state: doorState });
  }
  
  // Function to start alarm mode
  function startAlarm() {
    console.log("ALARM ACTIVATED!");
    
    alarmState = 'active';
    
    // Turn on yellow LED
    if (led) led.on();
    
    // Start alarm LED blinking
    if (alarmBlinkInterval) {
      clearInterval(alarmBlinkInterval);
    }
    alarmBlinkInterval = setInterval(blinkAlarmLed, 500);
    
    // Publish state change
    publishState();
    publishEvent('alarmChange', { state: 'active' });
  }
  
  // Function to stop alarm mode
  function stopAlarm() {
    console.log("Stopping alarm...");
    
    // Reset alarm state
    alarmState = 'inactive';
    
    // Turn off LED
    if (led) led.off();
    
    // Clear alarm blink interval
    if (alarmBlinkInterval) {
      clearInterval(alarmBlinkInterval);
      alarmBlinkInterval = null;
    }
    
    // Clear detection blink interval
    if (detectionBlinkInterval) {
      clearInterval(detectionBlinkInterval);
      detectionBlinkInterval = null;
    }
    
    // Clear alarm countdown
    if (alarmCountdown) {
      clearTimeout(alarmCountdown);
      alarmCountdown = null;
    }
    
    // Publish state change
    publishState();
    publishEvent('alarmChange', { state: 'inactive' });
    
    console.log("Alarm stopped");
  }
  
  // Function to start detection countdown
  function startDetectionCountdown() {
    // Only start detection if not already in detection or active state
    if (alarmState !== 'inactive') {
      console.log("Already in detection or alarm mode, ignoring new detection");
      return;
    }
    
    console.log("Starting detection countdown...");
    
    // Change state to detection
    alarmState = 'detection';
    
    // Force LED on and keep it on during detection phase
    if (led) led.on();
    
    // Clear any existing timeouts/intervals
    if (alarmCountdown) {
      clearTimeout(alarmCountdown);
    }
    if (detectionBlinkInterval) {
      clearInterval(detectionBlinkInterval);
      detectionBlinkInterval = null;
    }
    
    // Publish state change
    publishState();
    publishEvent('detection', { 
      message: 'Présence détectée ! Entrez un code à 4 chiffres à tout moment en utilisant le Bouton 1 (pour le chiffre 1) et le Bouton 2 (pour le chiffre 2)',
      codeInfo: 'Utilisez le Bouton 1 pour le chiffre 1 et le Bouton 2 pour le chiffre 2. Entrez un code à 4 chiffres.'
    });
    
    console.log("Présence détectée ! Entrez un code à 4 chiffres à tout moment en utilisant le Bouton 1 (pour le chiffre 1) et le Bouton 2 (pour le chiffre 2)");
    console.log("Codes disponibles : 1212 (John), 2121 (Alice), 1122 (Bob), 2211 (Emma)");
    
    // First phase: 30 seconds with light on
    alarmCountdown = setTimeout(() => {
      // If code wasn't entered correctly within 30 seconds, start blinking and notify intruder
      if (alarmState === 'detection') {
        console.log("No code entered within 30 seconds, starting blink phase...");
        
        // Start LED blinking after 30 seconds
        detectionBlinkInterval = setInterval(() => {
          if (led) led.toggle();
        }, 300);
        
        // Send intruder notification
        publishEvent('intruderAlert', { message: 'Intrus détecté ! Aucun code valide n\'a été entré.' });
        
        // Set another 20-second countdown before full alarm
        setTimeout(() => {
          if (alarmState === 'detection') {
            console.log("Aucun code entré dans les 50 secondes au total, activation de l'alarme complète...");
            
            // Clear blink interval before starting alarm
            if (detectionBlinkInterval) {
              clearInterval(detectionBlinkInterval);
              detectionBlinkInterval = null;
            }
            
            // Activate full alarm
            startAlarm();
          }
        }, 20000);
      }
    }, 30000);
  }
  
  // Function to check security code
  function checkSecurityCode() {
    const codeString = buttonPressSequence.join('');
    
    console.log(`Current code sequence: ${codeString}`);
    
    // Only process 4-digit codes
    if (codeString.length === 4) {
      console.log(`Checking 4-digit code: ${codeString}`);
      
      // Check if code matches any person
      const person = PERSON_CODES[codeString];
      
      if (person) {
        console.log(`Valid code entered by ${person}`);
        
        // If in alarm mode and alarm is active or in detection, stop the alarm
        if (operationMode === 'alarm' && (alarmState === 'active' || alarmState === 'detection')) {
          stopAlarm();
        }
        
        // Open the door for the person
        openDoor();
        
        // Set detected person
        detectedPerson = person;
        
        // Publish event with person's name
        publishEvent('codeEntry', { 
          success: true, 
          person: person,
          message: `Bienvenue, ${person} !`,
          code: codeString
        });
        
        // Also publish a person detected event
        publishEvent('personDetected', {
          name: person,
          message: `Bienvenue, ${person} !`
        });
        
        // Reset button sequence after processing
        buttonPressSequence = [];
        
        // Publish empty button sequence to clear the display
        publishEvent('buttonPress', { 
          button: 0, 
          currentSequence: '' 
        });
      } else {
        console.log(`Invalid code entered: ${codeString}`);
        
        // Publish event for invalid code
        publishEvent('codeEntry', { 
          success: false, 
          message: "Code de sécurité invalide !",
          code: codeString
        });
        
        // Reset button sequence after processing
        buttonPressSequence = [];
        
        // Publish empty button sequence to clear the display
        publishEvent('buttonPress', { 
          button: 0, 
          currentSequence: '' 
        });
      }
    }
  }
  
  // Sensor data handler
  sensor.on("data", function() {
    const sensorValue = this.value;
    
    // Log sensor data with current state
    console.log(`Luminosity: ${sensorValue}, Mode: ${operationMode}, Alarm State: ${alarmState}, LED: ${led && led.isOn ? "ON" : "OFF"}`);
    
    // Publish sensor data
    publishEvent('sensorData', { 
      value: sensorValue,
      ledState: led && led.isOn ? "ON" : "OFF",
      mode: operationMode,
      alarmState: alarmState
    });
    
    // Handle sensor based on current operation mode
    if (operationMode === 'simple') {
      // In simple mode, LED follows sensor value
      if (sensorValue < LIGHT_THRESHOLD) {
        if (led) led.on();
      } else {
        if (led) led.off();
      }
    } else if (operationMode === 'alarm') {
      // In alarm mode, behavior depends on the alarm state
      
      // Only check for presence detection when alarm is inactive
      if (alarmState === 'inactive') {
        if (sensorValue < LIGHT_THRESHOLD) {
          // Presence detected, start countdown
          console.log("Presence detected in alarm mode! Starting detection countdown...");
          startDetectionCountdown();
        } else {
          // No presence detected, LED should be off
          if (led) led.off();
        }
      }
      // If alarm state is 'detection' or 'active', don't change LED state here
      // as it's handled by the alarm functions
    }
  });
  
  // Button handlers
  buttonPin2.on("press", () => {
    console.log("Button 2 pressed");
    
    // Add button 2 press to sequence
    buttonPressSequence.push(2);
    console.log(`Code sequence: ${buttonPressSequence.join('')}`);
    
    // Publish button press with current sequence
    publishEvent('buttonPress', { 
      button: 2, 
      currentSequence: buttonPressSequence.join('') 
    });
    
    // Check if code is complete
    checkSecurityCode();
  });
  
  buttonPin1.on("press", () => {
    console.log("Button 1 pressed");
    
    // Add button 1 press to sequence
    buttonPressSequence.push(1);
    console.log(`Code sequence: ${buttonPressSequence.join('')}`);
    
    // Publish button press with current sequence
    publishEvent('buttonPress', { 
      button: 1, 
      currentSequence: buttonPressSequence.join('') 
    });
    
    // Check if code is complete
    checkSecurityCode();
  });
  
  // Make functions available globally
  global.openDoor = openDoor;
  global.closeDoor = closeDoor;
  global.stopAlarm = stopAlarm;
});

// Handle process termination
process.on('SIGINT', () => {
  if (client) {
    console.log('Closing MQTT connection');
    client.end();
  }
  process.exit();
});
