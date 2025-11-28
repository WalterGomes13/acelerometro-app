#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

const int MPU = 0x68;
int16_t AcX, AcY, AcZ;

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

#define SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

// Variáveis para o controle de tempo não-bloqueante
unsigned long previousMillis = 0;
const long interval = 10; // Intervalo de 10ms para atingir ~100Hz

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Dispositivo conectado!");
      // Envia uma mensagem inicial para "acordar" a conexão
      pCharacteristic->setValue("Conectado!");
      pCharacteristic->notify();
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Dispositivo desconectado!");
      pServer->getAdvertising()->start();
      Serial.println("Aguardando conexão...");
    }
};

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU);
  Wire.write(0x1C);
  Wire.write(0x10);
  Wire.endTransmission(true);

  BLEDevice::init("ESP32-MPU6050");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID_TX,
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  
  pService->start();
  //delay(200);
  pServer->getAdvertising()->start();
  Serial.println("Aguardando conexão BLE...");
}

void loop() {
  if (deviceConnected) {
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= interval) {
      previousMillis = currentMillis;

      Wire.beginTransmission(MPU);
      Wire.write(0x3B);
      Wire.endTransmission(false);
      Wire.requestFrom(MPU, 6, true);
      AcX = (Wire.read() << 8) | Wire.read();
      AcY = (Wire.read() << 8) | Wire.read();
      AcZ = (Wire.read() << 8) | Wire.read();
      float Ax = AcX / 4096.0;
      float Ay = AcY / 4096.0;
      float Az = AcZ / 4096.0;
      String data = String(Ax, 2) + "," + String(Ay, 2) + "," + String(Az, 2);
      pCharacteristic->setValue(data.c_str());
      pCharacteristic->notify();
      Serial.println(data);
    }
  }
}