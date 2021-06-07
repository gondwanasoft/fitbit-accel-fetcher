import { me as companion } from "companion"
import { inbox } from "file-transfer"
import { settingsStorage } from "settings"

const httpURL = 'http://127.0.0.1:3000'

let serverRequestsSent = 0, okCount = 0, errorCount = 0, catchCount = 0

;(function() {
  settingsStorage.setItem('sentCount', '0')
  settingsStorage.setItem('okCount', '0')
  settingsStorage.setItem('errorCount', '0')
  settingsStorage.setItem('catchCount', '0')

  companion.wakeInterval = 300000

  inbox.addEventListener("newfile", receiveFilesFromWatch)
  receiveFilesFromWatch()
})()

async function receiveFilesFromWatch() {
  let file
  while ((file = await inbox.pop())) {
    const data = await file.text()
    //console.log(`file contents: ${data}`)
    sendToServerViaFetch(data)
  }
}

function sendToServerViaFetch(data) {
  let fetchInit = {method: 'POST', body: data}
  fetch(httpURL, fetchInit)
  .then(function(response) {
    // Process server response; eg, to check for errors reported by server:
    if (response.ok) {
      response.text().then(text => serverResponseOk(text))
    } else {
      response.text().then(text => serverResponseError(text))
    }
  })
  .catch(function(err) {
    //console.log(`sendToServerViaFetch(): fetch error: ${err}. Ensure server is running.`)
    settingsStorage.setItem('catchCount', (++catchCount).toString())
  });

  ++serverRequestsSent
  //console.log(`sendToServerViaFetch() sent ${serverRequestsSent}`)
  settingsStorage.setItem('sentCount', serverRequestsSent)

  settingsStorage.setItem('okCount', okCount.toString())        // should be done in fetch().then, but doesn't seem to work asynchronously
  settingsStorage.setItem('errorCount', errorCount.toString())  // should be done in fetch().then, but doesn't seem to work asynchronously
}

function serverResponseOk(text) {
  //console.log(`serverResponseOk(): text=${text}`)
  ++okCount
}

function serverResponseError(text) {
 //console.log(`serverResponseError(): text=${text}`)
 ++errorCount
}