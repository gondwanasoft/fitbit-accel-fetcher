# fitbit-iothub
This is a Fitbit OS demo for transferring watch accelerometer, gyroscope, and presence data via companion to Azure IoT Hub.   The architecture is store and forward where sensor readings are stored on the device and periodically sent to the Fitbit companion.  The companion sends this telemetry to an Azure Function via HTTPS and identifies the appropriate IoT Hub device ID along with the telemetry.   The function then sends this data to IoT Hub, which is the generic ingestion point.   


The reasoning behind this architecture is that Fitbit only allows HTTP/S communication externally from the companion.  There are other devices such as Android WearOS devices that can use the Azure IoT SDK and send telemetry directly to IoT Hub via MQTT or AMQP.  IoT Hub represents the ingestion point for all devices.  Analytics are then performed by sending data from IoT Hub to Azure Stream Analytics which then provides multiple outputs for downstream processing such as Azure Data Lake Gen 2, Event Grid and Power BI for visualization.

The FitBit device and companion app are based on the wonderful sample created by [gondwansoft] and this repository is forked from [android-fitbit-fetcher].   That sample has been expanded and moved under the fitbit directory.

The Azure function that interacts with IoT Hub is found under the azure directory.

Features
-
Data is stored on the watch and transmitted to the companion in binary. This improves storage capacity and data transfer rate by about a factor of four.

Data is saved and transferred using multiple small files, to provide greater feedback during transfers and to allow faster error recovery.

Failed transfers are automatically retried.

The companion converts the binary data into plain text in JSON format, so it can be sent to IoT Hub in accordance with its device template that identifies properties and telemetry.

The settings screen displays the companion's status.

