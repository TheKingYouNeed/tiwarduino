@echo off
echo Starting all services using Node.js...
node start-all.js

echo.
echo If the services don't start automatically, you can start them manually:
echo.
echo 1. Start MQTT broker: node mqtt-broker.js
echo 2. Start security server: node server.js
echo 3. Start Arduino servient: node servient.js
echo.
echo Access the web interface at http://localhost:3000
