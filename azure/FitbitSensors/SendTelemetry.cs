using System.Collections.Generic;
using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text;
using System.IO;
using Microsoft.Azure.Devices.Client;
using System;
using System.Threading.Tasks;

namespace FitbitIoT
{
    public static class SendTelemetry
    {
        [Function("SendTelemetry")]
        public static HttpResponseData Run([HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequestData req,
            FunctionContext executionContext)
        {
            var logger = executionContext.GetLogger("SendTelemetry");
            logger.LogInformation("C# HTTP trigger function processed a request.");


            string requestBody = new StreamReader(req.Body).ReadToEnd();
            Telemetry data = JsonSerializer.Deserialize<Telemetry>(requestBody);

            string deviceID = data?.deviceID;

            int readingCount = Task.Run(() => SendToIoTHubAsync(data)).Result;

            string responseMessage = string.IsNullOrEmpty(deviceID)
                ? "This HTTP triggered function executed successfully. Pass the deviceID in the body."
                : $"{readingCount} readings(s) sent to IoT Hub for device {deviceID}.";

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "text/plain; charset=utf-8");
            response.WriteString(responseMessage);

            return response;
        }

        private static async Task<int> SendToIoTHubAsync(Telemetry telemetry) 
        {

            // Create JSON message
            string messageBody = JsonSerializer.Serialize<Telemetry>(telemetry);

            using var message = new Message(Encoding.ASCII.GetBytes(messageBody))
            {
                ContentType = "application/json",
                ContentEncoding = "utf-8",
            };

            TransportType transportType = TransportType.Mqtt;
            string connectionString = Environment.GetEnvironmentVariable("IoTHubConnection");
            DeviceClient deviceClient;

            deviceClient = DeviceClient.CreateFromConnectionString(connectionString, transportType);

            // Add a custom application property to the message.
            // An IoT hub can filter on these properties without access to the message body.
            message.Properties.Add("eventtype", "Telemetry");

            // Send the telemetry message
            await deviceClient.SendEventAsync(message);

            await deviceClient.DisposeAsync();  

            return telemetry.sensors.GetLength(0);

        }
    
    }
}
