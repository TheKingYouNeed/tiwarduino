# Arduino Security System with MQTT

This project implements a security system using Arduino, Johnny-Five, Express, and MQTT for communication between components.

## System Architecture

The system is split into two main components:

1. **Server**: Handles the web interface and user interactions
2. **Servient**: Controls the Arduino hardware and communicates with the server via MQTT

### Properties

- Door state: open/closed
- Alarm state: inactive/detection/active
- Person detection: identifies people by their security code

### Events

- Detection: When presence is detected by the sensor
- Code entry: When a security code is entered
- Alarm: When the alarm is triggered

### Actions

- Open/close door
- Stop alarm

## Hardware Setup

- Arduino board connected to COM6
- Light sensor on analog pin A0
- LED for status indication on pin 8
- Alarm LED on pin 9
- Door servo on pin 7
- Buttons for code entry on pins 2 and 3

## Security Codes

Each person has their own security code:
- Person1: 2121
- Person2: 1212
- Person3: 2112
- Person4: 1221

## Installation

1. Install Node.js and npm
2. Run `npm install` to install dependencies
3. Connect your Arduino board to COM6
4. Run `start.bat` or `node start-all.js` to start all components

## Components

The system consists of three main components:
1. **MQTT Broker** (mqtt-broker.js): A lightweight MQTT broker built with Aedes
2. **Server** (server.js): The web server and user interface
3. **Servient** (servient.js): The Arduino controller that interfaces with hardware

All components run locally and communicate via MQTT over localhost:1883.

## Dependencies

- express: Web server framework
- socket.io: Real-time communication
- johnny-five: Arduino interface
- mqtt: MQTT client
- body-parser: Request body parsing
- aedes: Lightweight MQTT broker

## Usage

1. Access the web interface at http://localhost:3000
2. Choose between Simple mode (LED follows sensor) and Alarm mode (security system)
3. In Alarm mode, when presence is detected, enter the correct code within 30 seconds
4. Control the door from the web interface
