import { me } from "appbit"
import document from 'document'
import { outbox } from 'file-transfer'
import * as fs from "fs"
import { HeartRateSensor } from "heart-rate"

const heartEl = document.getElementById('heart')
const heartSensor = new HeartRateSensor()

me.appTimeoutEnabled = false
heartSensor.start()

heartSensor.onreading = onHeartReading

function onHeartReading() {
  heartEl.text = heartSensor.heartRate
  heartSensor.timestamp
  sendFile(`${heartSensor.timestamp},${heartSensor.heartRate}\r\n`)
}

function sendFile(data) {
  // File transfer is more reliable than messaging, but has higher overheads.
  // If you want to send data very frequently and/or with less latency,
  // use messaging (and accept the risk of non-delivery).

  fs.writeFileSync("data.txt", data, "utf-8");

  outbox
    .enqueueFile("/private/data/data.txt")
    .then(ft => {
      //console.log(`Transfer queued.`);
    })
    .catch(err => {
      //console.log(`Failed to schedule transfer: ${err}`);
    })
}