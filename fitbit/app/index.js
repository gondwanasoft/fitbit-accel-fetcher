import { Accelerometer } from "accelerometer"
import { me } from "appbit"
import { display } from "display"
import document from 'document'
import { inbox, outbox } from 'file-transfer'
import * as fs from "fs"
import {goals} from "user-activity"
import { ACCEL_SCALAR, valuesPerRecord, statusMsg } from '../common/common.js'

const frequency = 30                                    // Hz (records per second): watch may go faster as it rounds intervals down to a multiple of 10ms
const batchPeriod = 1                                   // elapsed time between batches (seconds)
const recordsPerBatch = frequency * batchPeriod
const bytesPerRecord = valuesPerRecord * 2              // 2 because values are Int16 (2 bytes) each
const recDurationPerFile = 60                           // seconds of data that will be stored in each file (assuming frequency is accurate)
const recordsPerFile = frequency * recDurationPerFile   // 1800 for ~15 second BT transfer time at 8 bytes per record; 100 for a new file every few seconds; file may exceed this by up to recordsPerBatch
const bytesPerBatch = bytesPerRecord * recordsPerBatch
const dataBuffer = new ArrayBuffer(bytesPerBatch)
const dataBufferView = new Int16Array(dataBuffer)
const accel = new Accelerometer({ frequency: frequency, batch: recordsPerBatch })
//const touchEl = document.getElementById('touch')
const recTimeEl = document.getElementById('recTime')
const statusEl = document.getElementById('status')
const errorEl = document.getElementById('error')
const recBtnEl = document.getElementById('recBtn')
const xferBtnEl = document.getElementById('xferBtn')
const isSim = goals.calories === 360  // !!

let fileDescriptor
let simAccelTimer
let simTimestamp
let isRecording = false, isTransferring = false
let fileNumberSending
let recordsInFile, recordsRecorded
let startTime
let dateLastBatch
let state = {
  fileNumberRecording: undefined
}

me.appTimeoutEnabled = false
//touchEl.onmousedown = onMouseDown
restoreState()
recBtnEl.addEventListener("click", onRecBtn)
xferBtnEl.addEventListener("click", onXferBtn)
accel.addEventListener("reading", onAccelReading)
inbox.addEventListener("newfile", receiveFilesFromCompanion)
receiveFilesFromCompanion()
if (state.fileNumberRecording && fs.existsSync('1')) {
  xferBtnEl.text = 'TRANSFER TO PHONE'
}

//*********************************************************************************** User input *****

function onRecBtn() {
  if (isTransferring) return

  if (isRecording) stopRec()
  else startRec()

  isRecording = !isRecording
}

function onXferBtn() {
  if (isRecording) return

  if (isTransferring) stopTransfer()
  else startTransfer()
}

//********************************************************************************** Record data *****

function simAccelTick() {  // fake data
  const batchSize = recordsPerBatch
  let bufferIndex = 0, timestamp
  for (let index = 0; index<batchSize; index++) {
    timestamp = (simTimestamp+=3)  & 0x7FFF //0x7FFF
    //console.log(`i=${index} ts=${timestamp}`)
    dataBufferView[bufferIndex++] = timestamp
    dataBufferView[bufferIndex++] = index * ACCEL_SCALAR
    dataBufferView[bufferIndex++] = index * ACCEL_SCALAR + 1
    dataBufferView[bufferIndex++] = index * ACCEL_SCALAR + 2
  }
  if (isRecording)
    try {
      fs.writeSync(fileDescriptor, dataBuffer, 0, batchSize*bytesPerRecord)
    } catch(e) {
      console.error("Can't write to file")
    }
  if ((recordsInFile += batchSize) >= recordsPerFile) { // start another file
    fs.closeSync(fileDescriptor)
    fileDescriptor = fs.openSync(++state.fileNumberRecording, 'a')
    recordsRecorded += recordsInFile
    recordsInFile = 0
    statusEl.text = 'Recording file '+state.fileNumberRecording
    //console.log('Started new file')
  }
  recTimeEl.text = Math.round((Date.now()-startTime)/1000)
}

function onAccelReading() {
  const dateNow = Date.now()
  if (dateLastBatch) {
    console.log(`t since last batch: ${dateNow-dateLastBatch} ms`)
  }
  dateLastBatch = dateNow

  const batchSize = accel.readings.timestamp.length
  let bufferIndex = 0
  console.log(`batchSize=${batchSize} timestamp[]=${accel.readings.timestamp}`)
  for (let index = 0; index<batchSize; index++) {
    //console.log(`${accel.readings.timestamp[index]} ${accel.readings.x[index]}}`)
    dataBufferView[bufferIndex++] = accel.readings.timestamp[index] & 0x7FFF
    dataBufferView[bufferIndex++] = accel.readings.x[index] * ACCEL_SCALAR
    dataBufferView[bufferIndex++] = accel.readings.y[index] * ACCEL_SCALAR
    dataBufferView[bufferIndex++] = accel.readings.z[index] * ACCEL_SCALAR
  }
  if (isRecording)
    try {
      fs.writeSync(fileDescriptor, dataBuffer, 0, batchSize*bytesPerRecord)
    } catch(e) {
      console.error("Can't write to file (out of storage space?)")
    }
  if ((recordsInFile += batchSize) >= recordsPerFile) {
    console.log(`Closing file ${state.fileNumberRecording} (${recordsInFile} records)`)
    fs.closeSync(fileDescriptor)
    fileDescriptor = fs.openSync(++state.fileNumberRecording, 'a')
    recordsInFile = 0
    statusEl.text = 'Recording file ' + state.fileNumberRecording
    //console.log('Started new file')
  }
  recTimeEl.text = Math.round((Date.now()-startTime)/1000)
}

function startRec() {
  if (isTransferring) return

  deleteFiles()

  dateLastBatch = simTimestamp = recordsInFile = recordsRecorded = 0
  recTimeEl.text = '0'
  state.fileNumberRecording = 1
  fileDescriptor = fs.openSync(state.fileNumberRecording, 'a')
  errorEl.style.fill = '#ff0000'
  errorEl.text = ''
  statusEl.text = 'Recording file ' + state.fileNumberRecording
  accel.start()
  if (simAccelTimer) {clearTimeout(simAccelTimer); simAccelTimer = 0}
  console.log('Started.')
  recBtnEl.text = 'STOP RECORDING'
  xferBtnEl.text = ''
  startTime = Date.now()
  if (isSim) simAccelTimer = setInterval(simAccelTick, batchPeriod*1000)
}

function deleteFiles() {
  const fileIter = fs.listDirSync('/private/data')
  let nextFile = fileIter.next()
  while (!nextFile.done) {
    fs.unlinkSync(nextFile.value)
    nextFile = fileIter.next()
  }
}

function stopRec() {
  fs.closeSync(fileDescriptor)
  accel.stop()
  if (simAccelTimer) {clearTimeout(simAccelTimer); simAccelTimer = 0}
  console.log(`stopRec(): fileNumberRecording=${state.fileNumberRecording} recordsInFile=${recordsInFile}`)
  if (!recordsInFile) {   // don't include a zero-length file
    console.log(`deleting zero-length file`)
    fs.unlinkSync(state.fileNumberRecording)
    state.fileNumberRecording--
  }
  recordsRecorded += recordsInFile
  console.log('Stopped.')
  statusEl.text = `Recorded ${state.fileNumberRecording} file(s)`
  const size = recordsRecorded * bytesPerRecord / 1024
  errorEl.style.fill = '#0080ff'
  errorEl.text = `(${recordsRecorded} readings; ${Math.round(size)} kB)`
  display.poke()
  recBtnEl.text = 'START RECORDING'
  if (state.fileNumberRecording) xferBtnEl.text = 'TRANSFER TO PHONE'
}

//********************************************************************************** Transfer data *****

function startTransfer() {
  if (!state.fileNumberRecording) return

  isTransferring = true
  errorEl.style.fill = '#ff0000'
  errorEl.text = ''
  recTimeEl.text = ''
  recBtnEl.text = ''
  xferBtnEl.text = 'ABORT TRANSFER'
  fileNumberSending = 1
  sendFile()
}

function stopTransfer() {
  statusEl.text = 'Transfer aborted'
  display.poke()
  errorEl.text = ''
  recBtnEl.text = 'START RECORDING'
  xferBtnEl.text = 'TRANSFER TO PHONE'
  isTransferring = false
}

function sendFile(fileName) {
  // Sends  fileName (if specified) or fileNumberSending
  // File transfer is more reliable than messaging, but has higher overheads.
  // If you want to send data very frequently and/or with less latency,
  // use messaging (and accept the risk of non-delivery).

  const operation = fileName? 'Res' : 'S'   // plus 'ending...'
  if (!fileName) fileName = fileNumberSending

  outbox
    .enqueueFile("/private/data/"+fileName)
  .then(ft => {
    statusEl.text = operation + 'ending file ' + fileName + ' of ' + state.fileNumberRecording + '...'
    display.poke()
    console.log(`Transfer queued.`);
  })
  .catch(err => {
    console.error(`Failed to schedule transfer of ${fileName}: ${err}`);
    errorEl.text = "Can't send " + fileName + " to companion"
    display.poke()
  })
}

function sendObject(obj) {
  // File transfer is more reliable than messaging, but has higher overheads.
  // If you want to send data very frequently and/or with less latency,
  // use messaging (and accept the risk of non-delivery).
  fs.writeFileSync("obj.cbor", obj, "cbor")

  outbox
    .enqueueFile("/private/data/obj.cbor")
    .then(ft => {
      console.log(`obj.cbor transfer queued.`);
    })
    .catch(err => {
      console.log(`Failed to schedule transfer of obj.cbor: ${err}`);
      errorEl.text = "Can't send status to companion"
      display.poke()
    })
}

function sendData(data) {
  // File transfer is more reliable than messaging, but has higher overheads.
  // If you want to send data very frequently and/or with less latency,
  // use messaging (and accept the risk of non-delivery).

  fs.writeFileSync("data.txt", data, "utf-8")

  outbox
    .enqueueFile("/private/data/data.txt")
    .then(ft => {
      //console.log(`Transfer queued.`);
    })
    .catch(err => {
      //console.log(`Failed to schedule transfer: ${err}`);
    })
}

function receiveFilesFromCompanion() {
  let fileName
  while (fileName = inbox.nextFile()) {
    console.log(`receiveFilesFromCompanion(): received ${fileName}`)
    const response = fs.readFileSync(fileName, 'cbor')
    console.log(`watch received response status code ${response.status} for file ${response.fileName}`)
    // status 1: server didn't respond to fetch() request
    // status 2: fetch() couldn't send request to server
    if (response.fileName) {
      if (isTransferring) {
        if (response.status === 200) sendNextFile()
        else resendFile(response)
      }
    } else {  // no fileName; must have been a control object
      // should check response.status
      statusEl.text = 'Finished — see phone'
      display.poke()
      recBtnEl.text = 'START RECORDING'
      xferBtnEl.text = ''
      isTransferring = false
    }

    fs.unlinkSync(fileName)
  }
}

function sendNextFile() {
  errorEl.text = ''
  if (++fileNumberSending > state.fileNumberRecording) {
    console.log('All files sent okay; waiting for server to acknowledge')
    statusEl.text = 'All data sent; wait...'
    display.poke()
    sendObject({status:'done'})
    return
  }

  sendFile()
}

function resendFile(response) {
  errorEl.text = `${statusMsg[response.status]} on ${response.fileName}`
  display.poke()
  console.warn(`Resending ${response.fileName}`)
  sendFile(response.fileName)
}

me.onunload = () => {
  saveState()
}

function saveState() {
  fs.writeFileSync("state.cbor", state, "cbor")
}

function restoreState() {
  // Returns true if state restored.
  let newState;
  try {
    newState = fs.readFileSync("state.cbor", "cbor");
    state = newState;
    return true
  } catch(err) {   // leave state as is
  }
}