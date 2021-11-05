namespace FitbitIoT
{
    public class Telemetry
    {
        public string deviceID { get; set;}
        public Sensors[] sensors {get; set;}
    }

    public class Sensors 
    {
        public decimal accelerometer {get; set;}
        public decimal gyroscope {get; set;}
        public decimal heartrate {get; set;}
    }

}