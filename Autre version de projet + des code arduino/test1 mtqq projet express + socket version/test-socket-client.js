const { io } = require("socket.io-client");

// Connect to the server
const socket = io("http://localhost:3000");

// Event listeners
socket.on("connect", () => {
  console.log("Connected to server");
  
  // Test getting sensor data
  socket.emit("getSensorData");
  
  // Test getting alarm status
  socket.emit("getAlarmStatus");
  
  // Test updating mode
  setTimeout(() => {
    console.log("Testing mode update...");
    socket.emit("updateMode", { mode: "alarm" });
  }, 1000);
  
  // Test door control
  setTimeout(() => {
    console.log("Testing door control...");
    socket.emit("doorControl", { action: "open" });
  }, 2000);
  
  // Test stop alarm
  setTimeout(() => {
    console.log("Testing stop alarm...");
    socket.emit("stopAlarm");
  }, 3000);
});

// Listen for responses
socket.on("sensorData", (data) => {
  console.log("Received sensor data:", data);
});

socket.on("alarmStatus", (data) => {
  console.log("Received alarm status:", data);
});

socket.on("modeChange", (data) => {
  console.log("Received mode change:", data);
});

socket.on("modeUpdateResponse", (data) => {
  console.log("Received mode update response:", data);
});

socket.on("doorControlResponse", (data) => {
  console.log("Received door control response:", data);
});

socket.on("stopAlarmResponse", (data) => {
  console.log("Received stop alarm response:", data);
});

// Disconnect after 5 seconds
setTimeout(() => {
  console.log("Disconnecting...");
  socket.disconnect();
}, 5000);
