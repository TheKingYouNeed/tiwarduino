const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const mqtt = require('mqtt');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MQTT client setup
const MQTT_BROKER = 'mqtt://localhost:1883'; // Change this if your broker is elsewhere
const mqttClient = mqtt.connect(MQTT_BROKER);

// Global variables for state management
global.sensorData = { value: 'N/A', ledState: 'N/A' };
global.alarmActive = false;
global.alarmMessage = 'Inactif';
global.systemStatus = 'Système en mode normal';
global.operationMode = 'simple'; // Default mode
global.doorState = 'closed';
global.detectedPerson = null;
global.boardConnected = false;

// MQTT connection handler
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Subscribe to topics
  mqttClient.subscribe('servient/events');
  mqttClient.subscribe('servient/state');
});

// MQTT message handler
mqttClient.on('message', (topic, message) => {
  try {
    const messageObj = JSON.parse(message.toString());
    console.log(`Received message on topic ${topic}:`, messageObj);
    
    // Handle different event types
    if (topic === 'servient/events') {
      const { event, data } = messageObj;
      
      // Broadcast the event to all connected clients
      io.emit(event, data);
      
      // Handle specific events
      switch (event) {
        case 'boardStatus':
          global.boardConnected = data.connected;
          io.emit("boardStatus", { connected: global.boardConnected });
          break;
          
        case 'sensorData':
          global.sensorData = { 
            value: data.value, 
            ledState: data.ledState,
            mode: data.mode
          };
          io.emit("sensorData", global.sensorData);
          break;
          
        case 'detection':
          global.alarmActive = true;
          global.alarmMessage = 'Présence détectée!';
          global.systemStatus = 'Entrez le code de sécurité dans 10 secondes';
          io.emit("alarmStatus", { 
            alarmActive: true, 
            message: global.alarmMessage,
            status: global.systemStatus
          });
          break;
          
        case 'codeEntry':
          // Handle code entry event
          console.log('Code entry:', data);
          
          // Update UI with code entry result
          if (data.success) {
            global.alarmActive = false;
            global.alarmMessage = 'Code valide';
            global.systemStatus = 'Système désactivé';
            global.detectedPerson = data.person;
            
            io.emit("alarmStatus", { 
              alarmActive: false, 
              message: global.alarmMessage,
              status: global.systemStatus,
              detectedPerson: data.person,
              isIntruder: false
            });
            
            // Also emit the codeEntry event for the UI
            io.emit("codeEntry", data);
          } else {
            // Just emit the codeEntry event for the UI
            io.emit("codeEntry", data);
          }
          break;
          
        case 'doorAction':
          io.emit("doorAction", data);
          break;
          
        case 'intruderAlert':
          global.alarmActive = true;
          global.alarmMessage = 'INTRUSION DÉTECTÉE!';
          global.systemStatus = 'Entrez le code de sécurité immédiatement!';
          io.emit("alarmStatus", { 
            alarmActive: true, 
            message: global.alarmMessage,
            status: global.systemStatus,
            isIntruder: true
          });
          break;
          
        case 'personDetected':
          // Handle person detected event
          console.log('Person detected:', data);
          
          // Forward to UI
          io.emit("personDetected", data);
          break;
          
        case 'doorControl':
          // Handle door control event
          console.log('Door control:', data);
          
          // Update door state
          global.doorState = data.state;
          
          // Forward to UI
          io.emit("doorControl", data);
          break;
          
        case 'error':
          console.error("Error from servient:", data.message);
          break;
          
        default:
          // For other events, just log them
          console.log(`Unhandled event type: ${event}`);
      }
    } else if (topic === 'servient/state') {
      // Update global state
      global.doorState = messageObj.doorState;
      global.detectedPerson = messageObj.detectedPerson;
      
      if (messageObj.alarmState === 'inactive') {
        global.alarmActive = false;
        global.alarmMessage = 'Inactif';
        global.systemStatus = 'Système en mode normal';
      } else if (messageObj.alarmState === 'detection') {
        global.alarmActive = true;
        global.alarmMessage = 'Présence détectée! Entrez le code dans 30 secondes';
        global.systemStatus = 'Système en attente du code de sécurité';
      } else if (messageObj.alarmState === 'active') {
        global.alarmActive = true;
        global.alarmMessage = 'ALARME ACTIVE!';
        global.systemStatus = 'Système en mode alarme!';
      }
      
      // Emit updated state to all connected clients
      io.emit("alarmStatus", { 
        alarmActive: global.alarmActive, 
        message: global.alarmMessage,
        status: global.systemStatus,
        doorState: global.doorState,
        detectedPerson: global.detectedPerson
      });
    }
  } catch (error) {
    console.error("Error processing MQTT message:", error);
  }
});

// Define API endpoints for async requests
app.get('/sensor-data', (req, res) => {
  res.json(global.sensorData);
});

app.get('/alarm-status', (req, res) => {
  res.json({
    alarmActive: global.alarmActive || false,
    message: global.alarmMessage || 'Inactif',
    status: global.systemStatus || 'Système en mode normal',
    doorState: global.doorState,
    detectedPerson: global.detectedPerson
  });
});

app.post('/update-mode', (req, res) => {
  const { mode } = req.body;
  if (mode && (mode === 'simple' || mode === 'alarm')) {
    console.log(`Changing mode from ${global.operationMode} to ${mode}`);
    
    // Update the mode locally
    global.operationMode = mode;
    
    // Send mode change command to servient via MQTT
    mqttClient.publish('servient/commands/mode', JSON.stringify({ mode }));
    
    res.json({ success: true, mode });
    
    // Notify all clients about the mode change
    io.emit("modeChange", { mode });
  } else {
    res.status(400).json({ success: false, error: 'Invalid mode' });
  }
});

// New endpoint to control the door
app.post('/door-control', (req, res) => {
  const { action } = req.body;
  if (action && (action === 'open' || action === 'close')) {
    // Send door control command to servient via MQTT
    mqttClient.publish('servient/commands/door', JSON.stringify({ action }));
    res.json({ success: true, action });
  } else {
    res.status(400).json({ success: false, error: 'Invalid action' });
  }
});

// New endpoint to stop the alarm
app.post('/stop-alarm', (req, res) => {
  // Send stop alarm command to servient via MQTT
  mqttClient.publish('servient/commands/alarm', JSON.stringify({ action: 'stop' }));
  res.json({ success: true });
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("New client connected");
  
  // Send initial state to the client
  socket.emit("boardStatus", { connected: global.boardConnected });
  socket.emit("alarmStatus", { 
    alarmActive: global.alarmActive, 
    message: global.alarmMessage,
    status: global.systemStatus,
    doorState: global.doorState,
    detectedPerson: global.detectedPerson
  });
  socket.emit("modeChange", { mode: global.operationMode });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  if (mqttClient) {
    console.log('Closing MQTT connection');
    mqttClient.end();
  }
  process.exit();
});
