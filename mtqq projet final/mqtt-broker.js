const aedes = require('aedes')();
const { createServer } = require('net');

const port = 1883;
const server = createServer(aedes.handle);

server.listen(port, function () {
  console.log(`MQTT Broker running on port: ${port}`);
});

// Handle client connections
aedes.on('client', function (client) {
  console.log(`Client connected: ${client.id}`);
});

// Handle client disconnections
aedes.on('clientDisconnect', function (client) {
  console.log(`Client disconnected: ${client.id}`);
});

// Handle published messages
aedes.on('publish', function (packet, client) {
  if (client) {
    console.log(`Message published by ${client.id} on ${packet.topic}`);
  }
});

// Handle subscriptions
aedes.on('subscribe', function (subscriptions, client) {
  console.log(`${client.id} subscribed to ${subscriptions.map(s => s.topic).join(', ')}`);
});

// Handle errors
aedes.on('error', function (error) {
  console.error('Aedes error:', error);
});

// Handle graceful shutdown
process.on('SIGINT', function() {
  console.log('Closing MQTT broker...');
  server.close(function() {
    console.log('MQTT broker closed');
    process.exit(0);
  });
});
