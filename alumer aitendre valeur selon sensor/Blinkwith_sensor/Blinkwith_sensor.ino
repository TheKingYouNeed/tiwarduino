const int ledPin = 8;         // LED connected to digital pin 8
const int sensorPin = A0;     // Luminosity sensor connected to A0

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  // Turn the LED on by default
  digitalWrite(ledPin, HIGH);
}

void loop() {
  // Read the analog value from the sensor (0 to 1023)
  int sensorValue = analogRead(sensorPin);
  
  // Print the live luminosity value to the Serial Monitor
  Serial.print("Luminosity: ");
  Serial.println(sensorValue);
  
  // If the sensor reading drops below 1023, turn off the LED.
  if (sensorValue > 300) {
    digitalWrite(ledPin, LOW);
  } else {
    digitalWrite(ledPin, HIGH);
  }
  
  delay(200);  // Short delay for stability
}
