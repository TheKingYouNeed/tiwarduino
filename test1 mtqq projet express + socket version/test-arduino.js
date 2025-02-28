const { Board, Led, Sensor, Button } = require("johnny-five");

console.log("Attempting to connect to Arduino...");

// Initialize the board
const board = new Board({
  port: "COM6", // Change this if your Arduino is on a different port
  repl: false
});

// Handle board errors
board.on("error", function(err) {
  console.error("Board error:", err);
  console.log("Check if your Arduino is properly connected to COM6");
});

// When the board is ready
board.on("ready", function() {
  console.log("Board connected and ready!");
  
  // Test the main components
  console.log("Testing components...");
  
  // Create an LED on pin 8 (main LED)
  const led = new Led(8);
  console.log("Testing LED on pin 8...");
  led.blink(500);
  
  // Create an LED on pin 9 (alarm LED)
  const alarmLed = new Led(9);
  console.log("Testing alarm LED on pin 9...");
  alarmLed.blink(300);
  
  // Set up the sensor on A3
  const sensor = new Sensor({
    pin: "A3",
    freq: 500
  });
  
  // Listen for sensor data
  sensor.on("data", function() {
    console.log("Sensor value on A3:", this.value);
  });
  
  // Set up buttons on pins 2 and 3
  const button2 = new Button(2);
  const button3 = new Button(3);
  
  button2.on("press", function() {
    console.log("Button on pin 2 pressed!");
  });
  
  button3.on("press", function() {
    console.log("Button on pin 3 pressed!");
  });
  
  // Exit after 10 seconds
  setTimeout(function() {
    led.stop().off();
    alarmLed.stop().off();
    console.log("Test completed successfully!");
    process.exit(0);
  }, 10000);
});

// Set a timeout in case the board doesn't connect
setTimeout(function() {
  if (!board.isReady) {
    console.error("Timed out waiting for Arduino to connect");
    console.log("Check your connections and try again");
    process.exit(1);
  }
}, 10000);
