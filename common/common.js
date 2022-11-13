export const ACCEL_SCALAR = 500   // up to 6.5g; resolution 0.002 m/s/s
export const valuesPerRecord = 4  // x, y, z, time
export const statusMsg = {        // codes<100 are only used from companion to watch; codes>550 are custom HTTP codes sent from android-fitbit-fetcher
  1:"Server didn't respond",
  2:"Server comm error",
  3:"Server comm reject",
  4:"Server response bad",
  200:"OK",
  500:'Server error',
  501:'Not implemented',
  555:'Invalid data',
  556:'Invalid length'
}
export const headerLength = Uint32Array.BYTES_PER_ELEMENT // one Unit32 for fileTimestamp