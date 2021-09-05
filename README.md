# fitbit-accel-fetcher
This is a Fitbit OS demo for transferring watch accelerometer data via companion to an external web server.

Features:
* Data is transmitted from watch to companion in binary. This improves the data transfer rate by about a factor of four.
* Data is saved and transferred using multiple small files, to provide greater feedback during transfers and to allow faster error recovery.
* Failed transfers are automatically retried.

By default, this app uses [android-fitbit-fetcher](https://github.com/gondwanasoft/android-fitbit-fetcher) as the server that receives the data. However, you could adapt it to use any other suitable server available to you.

The approach demonstrated in these repositories could be adapted to transfer other sensor data (such as heart rate).

This app is not intended to be used as is. Its purpose is to demonstrate some techniques that could be applied in other applications.

No support is provided.