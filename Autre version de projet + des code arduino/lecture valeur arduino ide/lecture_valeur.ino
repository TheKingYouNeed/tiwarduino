/*
  Blink et lecture du capteur de luminosité

  Lit la valeur analogique du capteur de luminosité connecté à A0
  et l'affiche sur le moniteur série.
*/

void setup() {
  // Initialise la broche 8 comme sortie pour la LED
  pinMode(8, OUTPUT);
  
  // Démarre la communication série à 9600 bauds
  Serial.begin(9600);
}

void loop() {
  // Lit la valeur analogique sur A0 (valeur entre 0 et 1023)
  int luminosite = analogRead(A0);
  
  // Affiche la valeur lue sur le moniteur série
  Serial.print("Luminosite: ");
  Serial.println(luminosite);
  
  // Fait clignoter la LED sur la broche 8
  digitalWrite(8, HIGH);   // Allume la LED
  delay(500);              // Attend 500 millisecondes
  digitalWrite(8, LOW);    // Éteint la LED
  delay(500);              // Attend 500 millisecondes
}
