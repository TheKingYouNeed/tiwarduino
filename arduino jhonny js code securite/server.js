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

// Serve static files from the "public" directory
app.use(express.static("public"));

// Initialize the Arduino board on COM6
const board = new Board({ port: "COM6" });

board.on("ready", () => {
  console.log("Arduino board ready on COM6");

  // Set up the sensor on A0 with a 200ms read frequency.
  const sensor = new Sensor({
    pin: "A3",
    freq: 200
  });

  // Set up the LED on digital pin 8.
  const led = new Led(8);
  led.off();

  // Set up two buttons: one on pin 2 and one on pin 1.
  const buttonPin2 = new Button({
    pin: 2
    // , isPullup: true // Uncomment if needed.
  });
  const buttonPin1 = new Button({
    pin: 3    // , isPullup: true // Uncomment if needed.
  });

  // Variables for lock logic:
  let sensorBelowStartTime = null; // Time when sensor first went below threshold.
  let lockActive = false;          // Indicates if lock mode is active.
  let buttonPressCountPin2 = 0;    // Count presses on button at pin 2.
  let buttonPressCountPin1 = 0;    // Count presses on button at pin 1.

  // Sensor data handler: update LED based on sensor and lock logic.
  sensor.on("data", function() {
    const sensorValue = this.value;
    console.log("Luminosity:", sensorValue);

    // Only update LED based on sensor if lock is not active.
    if (!lockActive) {
      if (sensorValue < 300) {
        // Start timer when sensor first goes below threshold.
        if (sensorBelowStartTime === null) {
          sensorBelowStartTime = Date.now();
        } else {
          // If sensor has been below threshold for 5 seconds, activate lock.
          if (Date.now() - sensorBelowStartTime >= 5000) {
            lockActive = true;
            led.on();
            console.log("Lock activated: LED locked on.");
          } else {
            // Otherwise, LED follows sensor.
            led.on();
          }
        }
      } else {
        // Sensor reading 300 or above: reset timer and turn LED off.
        sensorBelowStartTime = null;
        led.off();
      }
    }
    // If lockActive is true, ignore sensor changes (LED remains on).

    // Emit sensor data, LED state, and lock status to connected clients.
    io.emit("sensorData", { 
      value: sensorValue, 
      ledState: led.isOn ? "ON" : "OFF",
      lockActive: lockActive 
    });
  });

  // Function to check if both buttons have been pressed twice.
  function checkUnlock() {
    if (buttonPressCountPin2 >= 2 && buttonPressCountPin1 >= 2) {
      // Release the lock.
      lockActive = false;
      // Reset counters and sensor timer.
      buttonPressCountPin2 = 0;
      buttonPressCountPin1 = 0;
      sensorBelowStartTime = null;
      console.log("Lock released after both buttons pressed twice.");
    }
  }

  // Button handler for the button on pin 2.
  buttonPin2.on("press", () => {
    if (lockActive) {
      buttonPressCountPin2++;
      console.log("Button on pin 2 pressed. Count:", buttonPressCountPin2);
      checkUnlock();
    } else {
      console.log("Button on pin 2 pressed, but no lock is active.");
    }
  });

  // Button handler for the button on pin 1.
  buttonPin1.on("press", () => {
    if (lockActive) {
      buttonPressCountPin1++;
      console.log("Button on pin 1 pressed. Count:", buttonPressCountPin1);
      checkUnlock();
    } else {
      console.log("Button on pin 1 pressed, but no lock is active.");
    }
  });
});

// Start the web server on port 3000.
server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
