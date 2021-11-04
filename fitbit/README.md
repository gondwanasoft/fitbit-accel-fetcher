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

Caveats
-

This app is not intended to be used as is. Its purpose is to demonstrate some techniques that could be applied in other applications.

This has not been tested using any server other than [android-fitbit-fetcher](https://github.com/gondwanasoft/android-fitbit-fetcher).

No support is provided.