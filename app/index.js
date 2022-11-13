import { Accelerometer } from "accelerometer"
import { me } from "appbit"
import { display } from "display"
import document from 'document'
import { inbox, outbox } from 'file-transfer'
import * as fs from "fs"
import {goals} from "user-activity"
import { ACCEL_SCALAR, valuesPerRecord, statusMsg, headerLength } from '../common/common.js'

const frequency = 30                                    // Hz (records per second): watch may go faster as it rounds intervals down to a multiple of 10ms
const simSamplePeriod = 10 * Math.floor(1000 / frequency / 10)  // ms
const batchPeriod = 1                                   // elapsed time between batches (seconds)
const recordsPerBatch = frequency * batchPeriod
const bytesPerRecord = valuesPerRecord * 2              // 2 because values are Int16 (2 bytes) each
const recDurationPerFile = 60                           // seconds of data that will be stored in each file (assuming frequency is accurate) (default: 60)  // TODO 8 set recDurationPerFile = 60
const recordsPerFile = frequency * recDurationPerFile   // 1800 for ~15 second BT transfer time at 8 bytes per record; 100 for a new file every few seconds; file may exceed this by up to recordsPerBatch
const bytesPerBatch = bytesPerRecord * recordsPerBatch
const headerBuffer = new ArrayBuffer(headerLength)   // holds timestamp of first record in file
const headerBufferView = new Uint32Array(headerBuffer)
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
const disableTouch = true             // ignore on-screen buttons while recording (useful for swim)

let fileDescriptor
let simAccelTimer
let simTimestamp
let simAccelReading
let isRecording = false, isTransferring = false
let fileNumberSending
let recordsInFile, recordsRecorded
let startTime
let dateLastBatch   // only used for debug logging
let fileTimestamp   // timestamp of first record in file currently being recorded
let prevTimestamp
let state = {
  fileNumberRecording: undefined
}

me.appTimeoutEnabled = false
//touchEl.onmousedown = onMouseDown
restoreState()
recBtnEl.text = 'START RECORDING'
document.onkeypress = onKeyPress
recBtnEl.addEventListener("click", onRecBtn)
xferBtnEl.addEventListener("click", onXferBtn)
accel.addEventListener("reading", onAccelReading)
inbox.addEventListener("newfile", receiveFilesFromCompanion)
receiveFilesFromCompanion()
if (state.fileNumberRecording && fs.existsSync('1')) {
  xferBtnEl.text = 'TRANSFER TO PHONE'
  xferBtnEl.style.display = 'inline'
}

//*********************************************************************************** User input *****

function onRecBtn() {
  if (isTransferring) return
  if (disableTouch && isRecording) return

  if (isRecording) stopRec()
  else startRec()
}

function onXferBtn() {
  if (isRecording) return

  if (isTransferring) stopTransfer()
  else startTransfer()
}

function onKeyPress(e) {
  //console.log('onKeyPress');
  if (isRecording) {
    stopRec()
    e.preventDefault()
  }
}

//********************************************************************************** Record data *****

function simAccelTick() {  // fake data - used when running in Fitbit Simulator to simulate accel readings
  if (!isRecording) {
    console.error("simAccelTick but not recording")
    return
  }

  // See if we need a new file for this batch:
  const needNewFile = fileDescriptor === undefined || recordsInFile >= recordsPerFile
  if (needNewFile) {
    fileTimestamp = prevTimestamp = simTimestamp
    console.log(`needNewFile: fileTimestamp=${fileTimestamp}`);
  }

  // Put the accel readings into dataBuffer:
  const batchSize = recordsPerBatch
  let bufferIndex = 0, timestamp
  console.log(`Cooking a batch; fileTimestamp=${fileTimestamp}`);
  for (let index = 0; index<batchSize; index++) {
    timestamp = simTimestamp
    simTimestamp += simSamplePeriod
    //console.log(`i=${index} ts=${timestamp}`)
    dataBufferView[bufferIndex++] = timestamp - prevTimestamp
    prevTimestamp = timestamp
    //console.log(`  ${dataBufferView[bufferIndex-1]}`);
    dataBufferView[bufferIndex++] = (simAccelReading++) & 0xFFFF
    dataBufferView[bufferIndex++] = (simAccelReading++) & 0xFFFF
    dataBufferView[bufferIndex++] = (simAccelReading++) & 0xFFFF
  }

  // Open a new file if necessary:
  if (fileDescriptor === undefined) {   // this is the start of this recording session
    openFile()
  } else {  // a file is already open
    if (recordsInFile >= recordsPerFile) {  // file is full
      fs.closeSync(fileDescriptor)
      recordsRecorded += recordsInFile
      state.fileNumberRecording++
      openFile()
    }
  }

  // Write record batch to file:
  try {
    fs.writeSync(fileDescriptor, dataBuffer, 0, batchSize*bytesPerRecord)
    recordsInFile += batchSize
  } catch(e) {
    console.error("Can't write to file")
  }

  /*if ((recordsInFile += batchSize) >= recordsPerFile) { // start another file
    fs.closeSync(fileDescriptor)
    fileDescriptor = fs.openSync(++state.fileNumberRecording, 'a')
    recordsRecorded += recordsInFile
    recordsInFile = 0
    statusEl.text = 'Recording file '+state.fileNumberRecording
    console.log('Started new file')
  }*/

  recTimeEl.text = Math.round((Date.now()-startTime)/1000)
}

function openFile() {   // opens a new file corresponding to state.fileNumberRecording and writes fileTimestamp
  console.log(`Starting new file: ${state.fileNumberRecording}`)
  fileDescriptor = fs.openSync(state.fileNumberRecording, 'a')
  // Write fileTimestamp at start of file:
  headerBufferView[0] = fileTimestamp
  //console.log(`header=${headerBufferView[0]}`)
  fs.writeSync(fileDescriptor, headerBuffer)
  recordsInFile = 0
  statusEl.text = 'Recording file '+state.fileNumberRecording
  display.poke()
}

function onAccelReading() {
  if (!isRecording) {
    console.error("onAccelReading but not recording")
    return
  }

  const dateNow = Date.now()
  if (dateLastBatch) {
    //console.log(`t since last batch: ${dateNow-dateLastBatch} ms`)  // debugging
  }
  dateLastBatch = dateNow

  // See if we need a new file for this batch:
  const needNewFile = fileDescriptor === undefined || recordsInFile >= recordsPerFile
  if (needNewFile) {
    fileTimestamp = prevTimestamp = accel.readings.timestamp[0]
    console.log(`needNewFile: fileTimestamp=${fileTimestamp}`);
  }

  // Put the accel readings into dataBuffer:
  const batchSize = accel.readings.timestamp.length
  let bufferIndex = 0, timestamp
  //console.log(`batchSize=${batchSize}`)
  //console.log(`timestamp[]=${accel.readings.timestamp}`)
  for (let index = 0; index<batchSize; index++) {
    //console.log(`${accel.readings.timestamp[index]} ${accel.readings.x[index]}}`)
    timestamp = accel.readings.timestamp[index]
    dataBufferView[bufferIndex++] = timestamp - prevTimestamp // store differential timestamps so they fit in Int16
    prevTimestamp = timestamp

    dataBufferView[bufferIndex++] = accel.readings.x[index] * ACCEL_SCALAR
    dataBufferView[bufferIndex++] = accel.readings.y[index] * ACCEL_SCALAR
    dataBufferView[bufferIndex++] = accel.readings.z[index] * ACCEL_SCALAR
  }

  // Open a new file if necessary:
  if (fileDescriptor === undefined) {   // this is the start of this recording session
    openFile()
  } else {  // a file is already open
    if (recordsInFile >= recordsPerFile) {  // file is full
      fs.closeSync(fileDescriptor)
      recordsRecorded += recordsInFile
      state.fileNumberRecording++
      openFile()
    }
  }

  // Write record batch to file:
  try {
    fs.writeSync(fileDescriptor, dataBuffer, 0, batchSize*bytesPerRecord)
    recordsInFile += batchSize
  } catch(e) {
    console.error("Can't write to file (out of storage space?)")
  }

  /*if ((recordsInFile += batchSize) >= recordsPerFile) {
    console.log(`Closing file ${state.fileNumberRecording} (${recordsInFile} records)`)
    fs.closeSync(fileDescriptor)
    fileDescriptor = fs.openSync(++state.fileNumberRecording, 'a')
    recordsInFile = 0
    statusEl.text = 'Recording file ' + state.fileNumberRecording
    //console.log('Started new file')
  }*/

  recTimeEl.text = Math.round((Date.now()-startTime)/1000)
}

function startRec() {
  if (isTransferring) return

  deleteFiles()

  dateLastBatch = simAccelReading = recordsInFile = recordsRecorded = 0
  simTimestamp = 4000000000
  recTimeEl.text = '0'
  state.fileNumberRecording = 1
  //fileDescriptor = fs.openSync(state.fileNumberRecording, 'a')
  errorEl.style.fill = '#ff0000'
  errorEl.text = ''
  statusEl.text = 'Recording file ' + state.fileNumberRecording
  accel.start()
  if (simAccelTimer) {clearTimeout(simAccelTimer); simAccelTimer = 0}
  console.log('Started.')
  recBtnEl.text = disableTouch? '← PRESS KEY TO STOP' : 'STOP RECORDING'
  recBtnEl.state = 'disabled'
  recBtnEl.style.display = 'inline'
  xferBtnEl.style.display = 'none'  // xferBtnEl.text = ''
  startTime = Date.now()
  if (isSim) simAccelTimer = setInterval(simAccelTick, batchPeriod*1000)
  isRecording = true
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
  accel.stop()
  if (simAccelTimer) {clearTimeout(simAccelTimer); simAccelTimer = 0}

  fs.closeSync(fileDescriptor)
  fileDescriptor = undefined

  console.log(`stopRec(): fileNumberRecording=${state.fileNumberRecording} recordsInFile=${recordsInFile}`)
  if (!recordsInFile) {   // don't include a zero-length file
    console.error(`Empty file!`)
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
  recBtnEl.style.display = 'inline'
  recBtnEl.state = 'enabled'
  if (state.fileNumberRecording) {
    xferBtnEl.text = 'TRANSFER TO PHONE'
    xferBtnEl.style.display = 'inline'
  }
  isRecording = false
}

//********************************************************************************** Transfer data *****

function startTransfer() {
  if (!state.fileNumberRecording) return

  isTransferring = true
  errorEl.style.fill = '#ff0000'
  errorEl.text = ''
  recTimeEl.text = ''
  recBtnEl.text = ''
  recBtnEl.style.display = 'none'
  xferBtnEl.text = 'ABORT TRANSFER'
  xferBtnEl.style.display = 'inline'
  fileNumberSending = 1
  sendFile()
}

function stopTransfer() {
  statusEl.text = 'Transfer aborted'
  display.poke()
  errorEl.text = ''
  recBtnEl.text = 'START RECORDING'
  recBtnEl.style.display = 'inline'
  xferBtnEl.text = 'TRANSFER TO PHONE'
  xferBtnEl.style.display = 'inline'
  isTransferring = false
}

function sendFile(fileName) {
  // Sends  fileName (if specified) or fileNumberSending
  // File transfer is more reliable than messaging, but has higher overheads.
  // If you want to send data very frequently and/or with less latency,
  // use messaging (and accept the risk of non-delivery).
  // TODO 3.5: If companion doesn't get launched, use timeout to report failure. What is last log line before hanging? What is next log line if not hanging?
  // TODO 3.6: If companion doesn't respond, transfer to a relanching app, restart and resume

  const operation = fileName? 'Res' : 'S'   // plus 'ending...'
  if (!fileName) fileName = fileNumberSending

  outbox
    .enqueueFile("/private/data/"+fileName)
    .then(ft => {
      statusEl.text = operation + 'ending file ' + fileName + ' of ' + state.fileNumberRecording + '...'
      display.poke()
      console.log(`${operation}ending file ${fileName} of ${state.fileNumberRecording}: queued`);
    })
    .catch(err => {
      console.error(`Failed to queue transfer of ${fileName}: ${err}`);
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
    console.log(`watch received response status code ${response.status} (${statusMsg[response.status]}) for file ${response.fileName}`)
    // See /common/common.js for response.status codes.
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
      recBtnEl.style.display = 'inline'
      xferBtnEl.style.display = 'none' // xferBtnEl.text = ''
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
  console.log(`Resending ${response.fileName}`)
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
// TODO 3.9 android-fitbit-fetcher needs a way to reset; currently can receive files from different sessions.