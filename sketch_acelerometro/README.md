## ⚙️ Configuração do ESP32

O ESP32 é configurado para ler os dados do sensor **MPU6050** via I2C e enviar os valores de aceleração (`Ax, Ay, Az`) para o aplicativo via **Bluetooth Low Energy (BLE)**.  

### 🔌 Conexões de Hardware

| Componente | Pino ESP32 |
|------------|------------|
| SDA do MPU6050 | GPIO 21 |
| SCL do MPU6050 | GPIO 22 |
| VCC do MPU6050 | 3.3V |
| GND do MPU6050 | GND |

> O ESP32 é o mestre I2C e o MPU6050 é o escravo com endereço `0x68`.

---

### 🧰 Bibliotecas Utilizadas

- `Wire.h` → comunicação I2C com o MPU6050  
- `BLEDevice.h`, `BLEServer.h`, `BLEUtils.h`, `BLE2902.h` → configuração do BLE  
- `Arduino.h` (implícito no .ino)  

---

### 🟢 Configuração BLE

- **Nome do dispositivo:** `ESP32-MPU6050`  
- **Serviço BLE:** `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`  
- **Característica de notificação (TX):** `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`  
  - Envia os dados do acelerômetro para o app  
- **Característica de escrita (RX):** `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`  
  - Permite o envio de comandos do app para o ESP32 (não utilizado neste código, mas disponível)  

---

### ⚙️ Inicialização

1. Inicializa o serial (`Serial.begin(115200)`) para depuração.  
2. Configura o I2C nos pinos 21 (SDA) e 22 (SCL).  
3. Inicializa o MPU6050 escrevendo 0 no registrador `0x6B` (wake-up).  
4. Inicializa o BLE com o nome `ESP32-MPU6050`.  
5. Cria um **servidor BLE** e um **serviço BLE** com as características TX e RX.  
6. Começa a **propaganda BLE**, aguardando conexão do app.

---

### 🔄 Loop Principal

1. Verifica se algum dispositivo está conectado (`deviceConnected`).  
2. A cada ~10ms (~100Hz):
   - Lê os registros do acelerômetro via I2C (`AcX`, `AcY`, `AcZ`).  
   - Converte para valores de aceleração em `g` (`Ax, Ay, Az`).  
   - Concatena os valores em uma string separada por vírgula: `"Ax,Ay,Az"`.  
   - Envia os dados via BLE (`pCharacteristic->setValue` + `notify`).  
   - Imprime os dados no Serial para depuração.  

---

### 💡 Observações

- A frequência de atualização é ~100Hz (intervalo de 10ms).  
- Quando o dispositivo BLE se desconecta, o servidor reinicia a propaganda automaticamente para aguardar nova conexão.  
- O app React Native lê os valores enviados e processa a visualização em tempo real.  

---

> Essa configuração garante que qualquer pessoa consiga **conectar o ESP32 ao MPU6050 e receber os dados via BLE** para uso no app.

