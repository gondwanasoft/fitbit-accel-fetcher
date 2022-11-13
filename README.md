# fitbit-accel-fetcher
This is a Fitbit OS demo for transferring watch accelerometer data via companion to an external web server.

Features
-
Data is stored on the watch and transmitted to the companion in binary. This improves storage capacity and data transfer rate by about a factor of four.

Data is saved and transferred using multiple small files, to provide greater feedback during transfers and to allow faster error recovery.

Failed transfers are automatically retried.

The companion converts the binary data into plain text in CSV format, so it can be read in a text editor or imported into a spreadsheet.

The settings screen displays the companion's status.

By default, this app uses [android-fitbit-fetcher](https://github.com/gondwanasoft/android-fitbit-fetcher) as the server that receives the data. However, you could adapt it to use any other suitable server available to you.

The approach demonstrated in these repositories could be adapted to transfer other sensor data (such as heart rate).

More information is available in the [server's readme](https://github.com/gondwanasoft/android-fitbit-fetcher/blob/master/README.md).

Usage (assuming use of [android-fitbit-fetcher](https://github.com/gondwanasoft/android-fitbit-fetcher))
-
Build and install this repo to your watch and companion device (*eg*, phone).

Build and install the server on your companion device (*eg*, phone).

Start the server app.

Start the watch app ('Accel Fetcher').

Record some accelerometer data on your watch.

Transfer accelerometer data from watch to phone.

Await transfer to finish (see watch app).

Select `GET DATA` on server app, and select a file into which the data will be copied.

Use a file manager on your phone to verify that the data has been received.

Change Log
-
Nov 2022:

* Changed method of reconstructing filestamps from 16-bit values. The new method should be robust against files being received out of sequence, or being received more than once.
* Caught errors that seem to correspond to incompletely received files on the server (which resulted in NULs). Such files are now resent.

Caveats
-

The companion component will sometimes be unloaded even while the device component is still running. Receiving a file should wake it, but sometimes it doesn't. If the watch doesn't progress after about a minute, close the app and restart it. This should restart the companion. If it doesn't, display the Fitbit mobile app on your phone and try again. You'll need to redisplay the server app after the companion starts. Connecting the companion device (phone) to power seems to reduce the likelihood of unwanted unloading.

Fitbit OS sometimes stops processsing file transfers from watch to companion. To fix this, close the app on the watch and restart it. Any previously-recorded data on the watch will still be there, so pressing `TRANSFER TO PHONE` should restart the process. (Previously-recorded files are only deleted when `START RECORDING` is pressed.)

Timestamp values will not increase at exactly the amount requested, for two reasons: the Fitbit API seems to round to the nearest 10 ms, and there can be a few ms variations due (presumably) to irregular sampling.

Very occasionally, you may see timestamps that jump ahead or behind by unexpected amounts. This seems to originate from the accelerometer batch readings themselves. Often, such errors seem to occur in pairs or groups, with the sum of the errors adding to about 0. Adding or subtracting a correction factor to the errant timestamps in the group should fix the problem. This needs to be done in whatever app is used to process the received data; it is not done in this app or the server.

This app is not intended to be used as is. Its purpose is to demonstrate some techniques that could be applied in other applications.

This has not been tested using any server other than [android-fitbit-fetcher](https://github.com/gondwanasoft/android-fitbit-fetcher).

No support is provided.