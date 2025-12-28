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
                        this.options.port = iport
                        this.options.speed = ispeed
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
        if(this.logger){
            this.logger.info(res)
        }
        return res
    }

    printCheck(body){
        let res={}
        if(this.logger){
            this.logger.info(body)
        }
        /*
        Алгоритм пробивки чека
        1. выставляем СНО
        2. пробиваем товары
        3. печатаем текст чека
        4. закрываем чек
        после каждой операции проверяем this.FR.ResultCode, если не 0 - выход с занесением ошибок в результат
         */
        console.log("1. Выставляем СНО")
        this.FR.Password=30;
        this.FR.TableNumber=18;
        this.FR.RowNumber=1;
        this.FR.FieldNumber=5;

        this.FR.ValueOfFieldInteger=(Number)(body.sno)
        this.FR.ValueOfFieldString=(String)(body.sno)
        this.FR.WriteTable();

        console.log("2. пробиваем товары")
        let goods=body.goods;
        for (let i=0;i<goods.length;i++){
            let x=goods[i]
            this.FR.Quantity =  x.count
            this.FR.Price = x.price
            this.FR.Department = body.department
            this.FR.StringForPrinting = x.name
            if(body.mode==='sale'){
                this.FR.Sale()
            }else{
                this.FR.ReturnSale()
            }
            if(!this._waitPrinting()){
                this.FR.CancelCheck()
                res = {
                    ...res, ...this._getProps(), ...{
                        ResultCode: this.FR.ResultCode,
                        ResultCodeDescription: this.FR.ResultCodeDescription
                    }
                }
                if(this.logger){
                    this.logger.info(res)
                }
                return res
            }
        }
        console.log("3. печатаем текст чека")
        let text=body.text
        for (let i=0;i<text.length;i++) {
            let x = text[i]
            this.FR.StringForPrinting = x.text
            if(x.font==1){
                this.FR.PrintWideString();
            }else{
                this.FR.PrintString();
            }
            if(!this._waitPrinting()){
                this.FR.CancelCheck()
                res = {
                    ...res, ...this._getProps(), ...{
                        ResultCode: this.FR.ResultCode,
                        ResultCodeDescription: this.FR.ResultCodeDescription
                    }
                }
                if(this.logger){
                    this.logger.info(res)
                }
                return res
            }
            if(this.FR.ResultCode!==0){
                this.FR.CancelCheck()
                res = {
                    ...res, ...this._getProps(), ...{
                        ResultCode: this.FR.ResultCode,
                        ResultCodeDescription: this.FR.ResultCodeDescription
                    }
                }
                if(this.logger){
                    this.logger.info(res)
                }
                return res
            }
        }

        console.log("4. Закрываем чек")
        this.FR.Summ1 = body.summ1
        this.FR.Summ2 = body.summ2
        this.FR.Summ3 = body.summ3
        this.FR.Summ4 = body.summ4
        this.FR.DiscountOnCheck = 0
        this.FR.StringForPrinting="Спасибо за покупку!"
        this.FR.CloseCheck()
        if(this.FR.ResultCode==0){
            if(!this._waitPrinting()){
                this.FR.CancelCheck()
                res = {
                    ...res, ...this._getProps(), ...{
                        ResultCode: this.FR.ResultCode,
                        ResultCodeDescription: this.FR.ResultCodeDescription
                    }
                }
                if(this.logger){
                    this.logger.info(res)
                }
                return res
            }
            res = {
                ...res, ...this._getProps(), ...{
                    ResultCode: this.FR.ResultCode,
                    ResultCodeDescription: this.FR.ResultCodeDescription
                }
            }
            if(this.logger){
                this.logger.info(res)
            }
            return res
        }else{
            res = {
                ...res, ...this._getProps(), ...{
                    ResultCode: this.FR.ResultCode,
                    ResultCodeDescription: this.FR.ResultCodeDescription
                }
            }
            this.FR.CancelCheck()
            if(this.logger){
                this.logger.info(res)
            }
            return res

        }

    }

    _waitPrinting(){
        while(true){
            this.FR.GetShortECRStatus()
            let m = this.FR.ECRAdvancedMode
            if(m==0){
                return true
            }
            if(m==1 || m==2){
                return false
            }
            if(m==3){
                this.FR.ContinuePrint()
            }
        }
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
//            ReceiptRibbonIsPresent: this.FR.ReceiptRibbonIsPresent,
//            JournalRibbonIsPresent: this.FR.JournalRibbonIsPresent,
//            SlipDocumentIsPresent: this.FR.SlipDocumentIsPresent,
//            SlipDocumentIsMoving: this.FR.SlipDocumentIsMoving,
            PointPosition: this.FR.PointPosition,
            EKLZIsPresent: this.FR.EKLZIsPresent,
//            JournalRibbonOpticalSensor: this.FR.JournalRibbonOpticalSensor,
//            ReceiptRibbonOpticalSensor: this.FR.ReceiptRibbonOpticalSensor,
//            JournalRibbonLever: this.FR.JournalRibbonLever,
//            ReceiptRibbonLever: this.FR.ReceiptRibbonLever,
//            LidPositionSensor: this.FR.LidPositionSensor,
//            IsPrinterLeftSensorFailure: this.FR.IsPrinterLeftSensorFailure,
//            IsPrinterRightSensorFailure: this.FR.IsPrinterRightSensorFailure,
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
//            FMSoftVersion: this.FR.FMSoftVersion,
//            FMBuild: this.FR.FMBuild,
//            FMSoftDate: this.FR.FMSoftDate,
            Date: this.FR.Date,
            Time: this.FR.Time,
            TimeStr: this.FR.TimeStr,
//            LicenseIsPresent: this.FR.LicenseIsPresent,
            FMOverflow: this.FR.FMOverflow,
            IsBatteryLow: this.FR.IsBatteryLow,
            IsLastFMRecordCorrupted: this.FR.IsLastFMRecordCorrupted,
            IsFMSessionOpen: this.FR.IsFMSessionOpen,
            IsFM24HoursOver: this.FR.IsFM24HoursOver,
            SerialNumber: this.FR.SerialNumber,
            SessionNumber: this.FR.SessionNumber,
            FreeRecordInFM: this.FR.FreeRecordInFM,
            RegistrationNumber: this.FR.RegistrationNumber,
//            FreeRegistration: this.FR.FreeRegistration,
            INN: this.FR.INN,
        }
    }

}


module.exports = Kkm;
