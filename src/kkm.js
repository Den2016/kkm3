let winax = require('winax');

class Kkm {
    constructor(options, logger) {
        this.FR = new winax.Object('AddIn.DrvFR');
        this.options = options
        this.logger = logger
    }


    connect(aport = null, aspeed = null, atimeout = null, apassword = null, autoseek = 1) {
        this.FR.Password = apassword === null ? 30 : apassword;
        this.FR.ComNumber = aport === null ? this.options.port : aport;
        this.FR.BaudRate = aspeed === null ? this.options.speed : aspeed;
        this.FR.Timeout = atimeout === null ? this.options.timeout : atimeout;
        this.FR.Connect();
        let res = {
            ...this._getProps(), ...{
                ResultCode: this.FR.ResultCode,
                ResultCodeDescription: this.FR.ResultCodeDescription
            }
        }
        if (res.ResultCode !== 0 && autoseek === 1) {
            for (let iport = 39; iport >= 0; iport--) {
                for (let ispeed = 6; ispeed >= 0; ispeed--) {
                    res = this.connect(iport, ispeed, null, null, 0);
                    if (res.ResultCode == 0) {
                        res.newPort = iport;
                        res.newSpeed = ispeed;
                        res.ResultCode = this.FR.ResultCode
                        res.ResultCodeDescription = this.FR.ResultCodeDescription
                        res = {...this._getProps(), ...res}
                        break;
                    }
                }
                if (res.ResultCode === 0) {
                    break;
                }
            }
        }
        return res;

    }

    disconnect() {
        this.FR.Disconnect()
        return {
            ...this._getProps(), ...{
                ResultCode: this.FR.ResultCode,
                ResultCodeDescription: this.FR.ResultCodeDescription
            }
        }
    }

    execCommands(body) {
        let res={}
        if(this.logger){
            this.logger.info(body)
        }
        body.map(x => {
            switch (x.action) {
                case "setproperty":
                    this.FR[x.name] = x.value
                    break;
                case "command":
                    this.FR[x.name]()
                    break;
                case "getproperty":
                    res[x.name]=this.FR[x.name]
                    break;
            }
        })
        res = {
            ...res, ...this._getProps(), ...{
                ResultCode: this.FR.ResultCode,
                ResultCodeDescription: this.FR.ResultCodeDescription
            }
        }
        return res
    }

    _getProps() {
        return {
            OperatorNumber: this.FR.OperatorNumber,
            ECRSoftVersion: this.FR.ECRSoftVersion,
            ECRBuild: this.FR.ECRBuild,
            ECRSoftDate: this.FR.ECRSoftDate,
            LogicalNumber: this.FR.LogicalNumber,
            OpenDocumentNumber: this.FR.OpenDocumentNumber,
            ECRFlags: this.FR.ECRFlags,
            ReceiptRibbonIsPresent: this.FR.ReceiptRibbonIsPresent,
            JournalRibbonIsPresent: this.FR.JournalRibbonIsPresent,
            SlipDocumentIsPresent: this.FR.SlipDocumentIsPresent,
            SlipDocumentIsMoving: this.FR.SlipDocumentIsMoving,
            PointPosition: this.FR.PointPosition,
            EKLZIsPresent: this.FR.EKLZIsPresent,
            JournalRibbonOpticalSensor: this.FR.JournalRibbonOpticalSensor,
            ReceiptRibbonOpticalSensor: this.FR.ReceiptRibbonOpticalSensor,
            JournalRibbonLever: this.FR.JournalRibbonLever,
            ReceiptRibbonLever: this.FR.ReceiptRibbonLever,
            LidPositionSensor: this.FR.LidPositionSensor,
            IsPrinterLeftSensorFailure: this.FR.IsPrinterLeftSensorFailure,
            IsPrinterRightSensorFailure: this.FR.IsPrinterRightSensorFailure,
            IsDrawerOpen: this.FR.IsDrawerOpen,
            IsEKLZOverflow: this.FR.IsEKLZOverflow,
            QuantityPointPosition: this.FR.QuantityPointPosition,
            ECRMode: this.FR.ECRMode,
            ECRModeDescription: this.FR.ECRModeDescription,
            ECRMode8Status: this.FR.ECRMode8Status,
            ECRModeStatus: this.FR.ECRModeStatus,
            ECRAdvancedMode: this.FR.ECRAdvancedMode,
            ECRAdvancedModeDescription: this.FR.ECRAdvancedModeDescription,
            PortNumber: this.FR.PortNumber,
            FMSoftVersion: this.FR.FMSoftVersion,
            FMBuild: this.FR.FMBuild,
            FMSoftDate: this.FR.FMSoftDate,
            Date: this.FR.Date,
            Time: this.FR.Time,
            TimeStr: this.FR.TimeStr,
            LicenseIsPresent: this.FR.LicenseIsPresent,
            FMOverflow: this.FR.FMOverflow,
            IsBatteryLow: this.FR.IsBatteryLow,
            IsLastFMRecordCorrupted: this.FR.IsLastFMRecordCorrupted,
            IsFMSessionOpen: this.FR.IsFMSessionOpen,
            IsFM24HoursOver: this.FR.IsFM24HoursOver,
            SerialNumber: this.FR.SerialNumber,
            SessionNumber: this.FR.SessionNumber,
            FreeRecordInFM: this.FR.FreeRecordInFM,
            RegistrationNumber: this.FR.RegistrationNumber,
            FreeRegistration: this.FR.FreeRegistration,
            INN: this.FR.INN,
        }
    }

}


module.exports = Kkm;