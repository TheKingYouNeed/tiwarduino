const http = require("http");
const socketIo = require("socket.io");
const mqtt = require('mqtt');

// Initialize HTTP server and Socket.IO
const server = http.createServer((req, res) => {
  // Simple static file server for the public directory
  const fs = require('fs');
  const path = require('path');
  
  // Get the file path
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    
    // Get file extension
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    // Set content type based on file extension
    switch (extname) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
        contentType = 'image/jpg';
        break;
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    });
  });
});

const io = socketIo(server);

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
    
    // Émettre l'événement pour le moniteur MQTT
    io.emit('mqtt:message', {
      topic: topic,
      payload: message.toString(),
      timestamp: new Date().toISOString(),
      direction: 'incoming'
    });
    
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
          global.systemStatus = 'Entrez le code de sécurité dans 30 secondes';
          
          // Send alarm status update
          io.emit("alarmStatus", { 
            alarmActive: true, 
            message: global.alarmMessage,
            status: global.systemStatus
          });
          
          // Also send a dedicated presence detection notification
          io.emit("notification", {
            type: "warning",
            message: "Une présence a été détectée ! Entrez le code de sécurité immédiatement.",
            isPresenceDetection: true
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

// Fonction pour publier un message MQTT et le transmettre au moniteur
function publishMQTT(topic, message) {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  
  // Publier le message MQTT
  mqttClient.publish(topic, messageStr);
  
  // Émettre l'événement pour le moniteur MQTT
  io.emit('mqtt:message', {
    topic: topic,
    payload: messageStr,
    timestamp: new Date().toISOString(),
    direction: 'outgoing'
  });
}

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
  socket.emit("sensorData", global.sensorData);
  
  // Handle REST API replacements with Socket.IO events
  
  // Replace /sensor-data GET endpoint
  socket.on("getSensorData", () => {
    socket.emit("sensorData", global.sensorData);
  });
  
  // Replace /alarm-status GET endpoint
  socket.on("getAlarmStatus", () => {
    socket.emit("alarmStatus", {
      alarmActive: global.alarmActive || false,
      message: global.alarmMessage || 'Inactif',
      status: global.systemStatus || 'Système en mode normal',
      doorState: global.doorState,
      detectedPerson: global.detectedPerson
    });
  });
  
  // Listen for mode update events
  socket.on("updateMode", (data) => {
    const { mode } = data;
    if (mode && (mode === 'simple' || mode === 'alarm')) {
      console.log(`Changing mode from ${global.operationMode} to ${mode}`);
      global.operationMode = mode;
      
      // Publish mode change command to MQTT
      publishMQTT('servient/commands/mode', JSON.stringify({ mode }));
      
      // Broadcast mode change to all clients
      io.emit("modeChange", { mode });
      
      // Send success response
      socket.emit("modeUpdateResponse", { success: true, mode });
    } else {
      socket.emit("modeUpdateResponse", { success: false, error: 'Invalid mode' });
    }
  });
  
  // Listen for door control events
  socket.on("doorControl", (data) => {
    const { action } = data;
    if (action && (action === 'open' || action === 'close')) {
      // Publish door control command to MQTT
      publishMQTT('servient/commands/door', JSON.stringify({ action }));
      
      socket.emit("doorControlResponse", { success: true, action });
    } else {
      socket.emit("doorControlResponse", { success: false, error: 'Invalid action' });
    }
  });
  
  // Listen for stop alarm events
  socket.on("stopAlarm", () => {
    // Publish stop alarm command to MQTT
    publishMQTT('servient/commands/alarm', JSON.stringify({ action: 'stop' }));
    
    global.alarmActive = false;
    global.alarmMessage = 'Inactif';
    global.systemStatus = 'Système en mode normal';
    
    io.emit("alarmStatus", { 
      alarmActive: global.alarmActive, 
      message: global.alarmMessage,
      status: global.systemStatus,
      doorState: global.doorState,
      detectedPerson: global.detectedPerson
    });
    
    socket.emit("stopAlarmResponse", { success: true });
  });
  
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
