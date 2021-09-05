import { encode } from 'cbor'
import { me as companion } from "companion"
import { inbox, outbox } from "file-transfer"
import { localStorage } from "local-storage"
import { settingsStorage } from "settings"
import { ACCEL_SCALAR, statusMsg, valuesPerRecord } from '../common/common.js'

const httpURL = 'http://127.0.0.1:3000'

let responseTimeoutTimer
let timestampPrev = -1, timestampMSB = 0

async function receiveFilesFromWatch() {
  console.log('receiveFilesFromWatch()')
  let file
  while ((file = await inbox.pop())) {
    console.log(`Received file ${file.name}`)

    if (file.name === 'obj.cbor') receiveStatusFromWatch(file)
    else receiveDataFromWatch(file)
  }
}

async function receiveDataFromWatch(file) {
  if (file.name === '1') { // start of new sequence of files; reset timestamp variables
    timestampPrev = -1
    timestampMSB = 0
  }

  //const data = await file.text()
  const data = await file.arrayBuffer()
  // It would be nice to be able to keep the data in memory in case we need to retry sending it,
  // but the companion may be unloaded before we discover the need for this.
  // We could try to save the data using the Storage API.

  // Unpack the binary data here, so we don't have to deal with binary data in the request on the server
  const dataBufferView = new Int16Array(data)
  const recordCount = dataBufferView.length / valuesPerRecord   // four values per record: time, x, y, z
  console.log(`Got file ${file.name}; contents: ${data.byteLength} bytes = ${dataBufferView.length} elements = ${recordCount} records;  timestampPrev=${timestampPrev} timestampMSB=${timestampMSB}`)
  settingsStorage.setItem('fileNbr', file.name)
  let elementIndex = 0
  let record
  let content = ''  // the body (content) to be sent in the HTTP request
  let timestamp
  for (let recordIndex = 0; recordIndex < recordCount; recordIndex++) {
    //console.log(`${recordIndex} ${dataBufferView[elementIndex]}`)
    timestamp = dataBufferView[elementIndex++] + timestampMSB
    if (timestamp < timestampPrev) { // timestamp rolled around; there can be duplicates because precision seems to be 64 msec
      timestamp += 0x8000
      timestampMSB += 0x8000
      //console.log(`  ts rolled: ts=${timestamp} timestampMSB=${timestampMSB}`)
    }
    timestampPrev = timestamp

    record = `${timestamp},${dataBufferView[elementIndex++]/ACCEL_SCALAR},${dataBufferView[elementIndex++]/ACCEL_SCALAR},${dataBufferView[elementIndex++]/ACCEL_SCALAR}\r\n`
    content += record
  }
  //console.log(`content=${content}`)

  sendToServer(content, file.name)

  // Save local variables in case companion is unloaded before next file is received:
  localStorage.setItem('timestampPrev', timestampPrev)
  localStorage.setItem('timestampMSB', timestampMSB)
}

async function receiveStatusFromWatch(file) {
  const status = await file.cbor()
  console.log(`status=${status} (${typeof status})`)
  const statusText = status.status
  console.log(`receiveStatusFromWatch() status=${statusText}`)
  settingsStorage.setItem('fileNbr', `Watch: ${statusText}`)
  sendToServer(JSON.stringify(status), null, true)
}

;(function() {
  // Extract persistent global variables from localStorage:
  timestampPrev = localStorage.getItem('timestampPrev')
  if (timestampPrev == null) timestampPrev = -1; else timestampPrev = Number(timestampPrev)
  timestampMSB = localStorage.getItem('timestampMSB')
  if (timestampMSB == null) timestampMSB = 0; else timestampMSB = Number(timestampMSB)
  //console.log(`timestampPrev=${timestampPrev} ${timestampMSB}`)

  companion.wakeInterval = 300000

  inbox.addEventListener("newfile", receiveFilesFromWatch)
  receiveFilesFromWatch()
})()

function sendToServer(data, fileName, asJSON) {
  console.log(`sendToServer() fileName=${fileName} asJSON=${asJSON}`)
  const headers = {}
  if (fileName) headers.FileName = fileName
  if (asJSON) headers["Content-Type"] = "application/json"
  //let fetchInit = {method:'POST', headers:{"FileName":fileName}, body:data}
  let fetchInit = {method:'POST', headers:headers, body:data}
  // To send binary data, use {method:'POST', headers:{"Content-type": "application/octet-stream"}, body:data}

  // timeout in case of no exception or timely response
  responseTimeoutTimer = setTimeout(() => {
    responseTimeoutTimer = 0
    console.log(`onResponseTimeout()`)
    const status = 1
    settingsStorage.setItem('status', statusMsg[status])
    sendToWatch(fileName, status)   // server response timeout
  }, 5000);

  fetch(httpURL, fetchInit)
  .then(function(response) {
    if (responseTimeoutTimer) {clearTimeout(responseTimeoutTimer); responseTimeoutTimer = 0}
    sendToWatch(fileName, response.status)
    if (response.ok) {
      response.text().then(text => serverResponseOk(fileName, text))
    } else {
      response.text().then(text => serverResponseError(response.status, text))
    }
  })
  .catch(function(err) {
    if (responseTimeoutTimer) {clearTimeout(responseTimeoutTimer); responseTimeoutTimer = 0}
    console.log(`sendToServer(): fileName=${fileName} fetch error: ${err}. Ensure server is running.`)
    const status = 2
    settingsStorage.setItem('status', statusMsg[status])
    sendToWatch(fileName, status)
  });

  console.log(`sendToServer() sent ${fileName}`)
}

function serverResponseOk(fileName, text) {
  console.log(`serverResponseOk(): text=${text}`)
  const statusText = fileName? 'OK' : 'Server: done'
  settingsStorage.setItem('status', statusText)
}

function serverResponseError(status, text) {
 console.log(`serverResponseError(): status=${status} text=${text}`)
 settingsStorage.setItem('status', statusMsg[status])
}

function sendToWatch(fileName, status) {
  outbox.enqueue('response-'+Date.now(), encode({fileName:fileName, status:status}))
  .then((ft) => {
    console.log(`Transfer of ${ft.name} successfully queued.`);
  })
  .catch((error) => {
    console.error(`Failed to queue response for ${fileName}: ${error}`);
    settingsStorage.setItem('status', "Can't send to watch")
  })
}