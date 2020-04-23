let winax = require('winax');
let Datastore = require('nedb-promises'), db = {};
db.config = Datastore.create('./config.db');
db.checks = Datastore.create('./checks.db');
db.config.loadDatabase();
db.checks.loadDatabase();

loadConfig();

let config = {
	ns:'KKM2',
	port: 1,
	speed: 6,
	timeout: 250
}
let FR = new winax.Object('AddIn.DrvFR');
let Port = 1;
let Speed = 1;
let printWidth = 32; // ширина чековой ленты в символах
let checkText = [];
let params = {};
let lastid;

function getVersion(){
	return '0.1.1';
}

function  shutdown(){
	if(FR.Connected) FR.Disconnect();
	winax.release(FR);
}

function loadConfig(){
	db.config.find({ns:'KKM2'}).then((d)=>{
		if(d.length!=0){
			config=Object.assign(config, d[0]);
		}
	})
	.catch(e=>console.log('loadConfig',e));
}

function saveConfig(){
	if(config["_id"]){
		db.config.update({ _id: config["_id"] },{ $set: config })
		.then(d=>{
			db.config.persistence.compactDatafile();
		})
		.catch(e=>{console.log(e)});
	}else{
		db.config.insert(config)
		.then((d)=>{
			db.config.persistence.compactDatafile();
		})
		.catch(e=>console.log('saveConfig',e,config));
	}
}



async function saveCheck(check){
	return db.checks.insert(check)
		.then((d)=>{
//			console.log('db.checks.insert d',d)
			lastid=d._id;
			db.checks.persistence.compactDatafile();
			return d._id;
		})
		.catch(e=>{console.log(e);lastid=''});
}

async function updateDoc(id){
	let upd = { "Пробит": params["Пробит"], "Комментарий": params["Комментарий"], "НомерДокумента": params["НомерДокумента"] };
	return db.checks.update({ _id: id },{ $set: upd })
		.then(d=>{
			db.checks.persistence.compactDatafile();
			return d;
		})
		.catch(e=>{console.log(e)});
}

async function getChecks(filter){
	//console.log(filter)
	return db.checks.find(filter)
		.then((d)=>{
			return d
		})
		.catch(e=>{console.log(e)});
}

async function setChecksAsLoaded(list){
	return db.checks.update({ $or: list },{ $set: {"Загружен":1} },{ multi: true })
		.then(d=>{
			db.checks.persistence.compactDatafile();
			return d;
		})
		.catch(e=>{console.log(e)});
}

function getConfig(){
	return config;
}

function setConfigParams(paramobj){
	config = Object.assign(config, paramobj)
	saveConfig();
	return config;
}

function connect(aport,aspeed,atimeout=250,apassword=30,autoseek=1){
	FR.Password = apassword;
	FR.ComNumber = aport;
	FR.BaudRate = aspeed;
	FR.Timeout = atimeout;
	FR.Connect();
	let res = {code:FR.ResultCode,description:FR.ResultCodeDescription};
	if(res.code!=0 && autoseek==1){
		for (let iport = 19; iport >= 0; iport--) {
			for (let ispeed = 6; ispeed >= 0; ispeed--) {
				res = connect(iport,ispeed,atimeout,apassword,0);
				if(res.code==0){
					res.newPort = iport;
					res.newSpeed = ispeed;
					Port = iport;
					Speed = ispeed;
					break;
				}
			}
			if(res.code==0){
				break;
			}
		}
	}
	return res;
}

function checkConnect(){
	if(!FR.Connected){
		let r = connect(config.port,config.speed,config.timeout);
		if(r.newPort){
			config.port=r.newPort;
			config.speed=r.newSpeed;
			saveConfig();
		}
	}
	return FR.Connected;
}

function prepareString(str_start,str_end,str_delim='.',wide=0){
	let width;
	wide==0?width=printWidth:width=Math.floor(printWidth/2);
	if(!str_end) str_end=' ';
	if(!str_delim) str_delim=' ';
	let middle='';
	let res=str_start+middle+str_end;
	while(res.length<width){
		middle=middle+str_delim;
		res=str_start+middle+str_end;
	}
	res={str:res,wide:wide}
	return res;
}

function tabTotal(tab,field){
	let sum = 0;
	for (var i = tab.length - 1; i >= 0; i--) {
		sum = sum + Number(tab[i][field]);
	}
	return sum;
}

function dolgInOut(){
	return params['КодДолжника'] && params['РежимДолжника'] && params['РежимДолжника']!="Расчет";
}

function totalWithoutDiscount(){
	if(dolgInOut()){
		return 0;
	}
	let tab = params["Товары"];
	return tabTotal(tab,"Сумма");
}

function totalWithDiscount(){
	if(dolgInOut()){
		return 0;
	}
	return totalWithoutDiscount()-totalDiscount();
}

function totalDiscount(){
	if(dolgInOut()){
		return 0;
	}
	let sum = 0;
	let tab = params["Товары"];
	return tabTotal(tab,"Скидка");
}

function prepareCheckText(){
	checkText=[];
	let str='';
	let tab = params["Товары"];
	let onesum = Number(params["ОднойСуммой"]);
	let vozvrat = Number(params["Возвратный"]);
	let discount = Number(params["ПроцентСкидки"]);
	let nal = Number(params["Наличные"]);
	let bycard = Number(params["ПоКарте"]);
	let koddolg = Number(params["КодДолжника"]);
	for (var i = 0; i<tab.length; i++) {
		if(onesum==0){
			let str=tab[i]["Наименование"];
			let kod=tab[i]["КодШК"].replace(/\s/g,'')
			checkText.push(prepareString(str.substr(0,printWidth-1),'',''));
			str='['+kod+']'+' '+String(tab[i]["Количество"])+'x'+Number(tab[i]["Цена"]).format(2);
			checkText.push(prepareString(str,Number(tab[i]["Сумма"]).format(2)));
		}
	}
	if(onesum==0){
		checkText.push(prepareString("*","*","*"));
		checkText.push(prepareString("Итого",totalWithoutDiscount().format(2)))
		let sumdiscount = totalDiscount();
		if(sumdiscount!=0) {
			checkText.push(prepareString("Скидка",sumdiscount.format(2)))
			checkText.push(prepareString("Предоставлена скидка",String(discount)+"%",' '));
		}
	}
	if(params["Сертификаты"]){
		if(params["Сертификаты"]["Режим"] == "Оплата"){
			checkText.push(prepareString("Оплата сертификатами",'',''));
			tab = params["Сертификаты"]["Список"];
			for( let i=0; i<tab.length;i++){
				checkText.push(prepareString(tab[i]["Код"],tab[i]["КОплате"]));
			}
		}
	}
	if(koddolg!=0){
		str=prepareString('В ДОЛГ',tabTotal(params["Товары"],"Сумма").format(2),' ',1);
		if(params['РежимДолжника']=="Расчет"){
			str=prepareString('РАСЧЕТ',tabTotal(params["Товары"],"Сумма").format(2),' ',1);
		}
		if(vozvrat==1){
			str=prepareString('ВОЗВРАТ',tabTotal(params["Товары"],"Сумма").format(2),' ',1);
		}
		checkText.push(str);
		checkText.push(prepareString(params["НаименованиеДолжника"],' ',' '));
	}else{
		checkText.push(prepareString("Наличными",nal.format(2)))
		checkText.push(prepareString("По карте",bycard.format(2)))
	}
	if(params["ШКДисконтнойКарты"]){
		checkText.push(prepareString("Номер карты",params["ШКДисконтнойКарты"]));
	}
}

function printCheckText(){
	let res = {code:0,desc:"Ошибок нет"}
	for (var i = 0; i<checkText.length; i++) {
		printString(checkText[i].str,checkText[i].wide);
		if(FR.ResultCode!=0){
			res.code=FR.ResultCode;
			res.desc = FR.ResultCodeDescription;
			break;
		}
	}
	return res;
}

function printString(str,wide=0){
	FR.StringForPrinting = str;
	if(wide==0){
		FR.PrintString();
	}else{
		FR.PrintWideString();
	}
	FR.StringForPrinting = '';
}

function sumCloseCheck(){
	if(params["Сертификаты"]["Режим"]=="Оплата"){
		return totalWithDiscount()-Number(params["Сертификатами"])
	}
	return totalWithDiscount();
}

function getLastDocNumber(){
	FR.RegisterNumber=152; 
	FR.GetOperationReg(); 	

	params["НомерДокумента"] = FR.ContentsOfOperationRegister+1;
	params["ДатаДокумента"] = new Date().mysqldatetime();
}
function closeCheck(){
	let res = {code:0,desc:"Ошибок нет"}
	if(dolgInOut()){
		FR.Summ1=0; 
		FR.Summ2=0;
		FR.Summ3=0;
		FR.Summ4=0;
	}else{
		FR.Summ1=Number(params["Наличные"]);
		FR.Summ2=0;
		FR.Summ3=0;
		FR.Summ4=Number(params["ПоКарте"]);
	}
	FR.DiscountOnCheck=0;        
	FR.CloseCheck();
	if(FR.ResultCode!=0){
		res.code = FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "close check";
		FR.CancelCheck();
	}else{
		params["Пробит"]=1;
	}
	getLastDocNumber();
	return res;
}

function printWait(){
	let res = {code:0,desc:"Ошибок нет"}
	while(true){
		FR.GetShortECRStatus();
		let m = FR.ECRAdvancedMode;
		//console.log(m)
		if(m==0) break;
		if(m==1 || m==2){
			res.code = -50;
			res.desc = FR.ECRAdvancedModeDescription;
			res.stage = "print wait"
			break;
		}
		if(m==3){
			FR.ContinuePrint();
			if(FR.ResultCode!=0){
				res.code=FR.ResultCode;
				res.desc = FR.ResultCodeDescription;
				res.stage = "print wait"
				break;
			}
		}
	}
	return res;
}
/*
printCheck
печать чека по переданным параметрам
*/

async function printCheck(){
	let res = {code:0,desc:"Ошибок нет"}
	// готовим текст для печати
	prepareCheckText();
	// устанавливаем дополнительные поля
	params["Комментарий"] = "";
	params["Загружен"] = 0;
	params["Пробит"] = 0;
	params["НомерДокумента"] = 1;
	params["ДатаДокумента"] = new Date().mysqldatetime();
	// записываем чек в базу, чтобы в случае сбоя он там уже был
	res.lastid = await saveCheck(params);

	FR.Password=30;
	FR.TableNumber=18;
	FR.RowNumber=1;
	FR.FieldNumber=5;  
	if(params["СНО"]){ // записываем систему налогообложения
		FR.ValueOfFieldInteger=Number(params["СНО"]);
		FR.ValueOfFieldString=String(params["СНО"]);
		FR.WriteTable();	
	}
	// пробиваем продажу или возврат
	FR.Quantity=1;
	FR.Price=sumCloseCheck();
	FR.Department=params["Отдел"];
	FR.StringForPrinting="Автозапчасти";
	if(params["Возвратный"]==1){
		FR.ReturnSale();
	}else{
		FR.Sale();
	}
	if(FR.ResultCode!=0){
		res.code=FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "sale or return sale"
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
		return res;
	}
	// ждем окончания печати предыдущей команды
	res = Object.assign(res, printWait()); // обновляем res, чтобы сохранить lastid и обновить code, desc && stage
	if(res.code!=0){
		FR.CancelCheck();
		return res;	
	}
	// выводим текст чека
	res = Object.assign(res, printCheckText());
	if(res.code!=0){
		res.stage='print check text';
		res.params = params
		return res;
	}
	// делаем закрытие чека
	res = Object.assign(res, closeCheck());
	if(res.code!=0){
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
	}
	// обновляем данные в чеке
	await updateDoc(res.lastid);

	return res;	
}

async function printInCash(){
	let res = {code:0,desc:"Ошибок нет"}
	checkConnect();
	params["Комментарий"]="";
	params["Загружен"]=0;
	params["Пробит"]=0;
	getLastDocNumber();
	res.lastid = await saveCheck(params);

	FR.Password=30;
	FR.Summ1=params["СуммаВнесения"];
	FR.CashIncome();
	if(FR.ResultCode!=0){
		res.code=FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "cashincome"
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
	}else{
		params["Пробит"] = 1;
	}
	getLastDocNumber();
	await updateDoc(res.lastid);
	return res;
}

async function printOutCash(){
	let res = {code:0,desc:"Ошибок нет"}
	checkConnect();
	params["Комментарий"]="";
	params["Загружен"]=0;
	params["Пробит"]=0;
	getLastDocNumber();
	res.lastid = await saveCheck(params);
	FR.Password=30;
	FR.Summ1=params["СуммаВыплаты"];
	FR.CashOutcome();
	if(FR.ResultCode!=0){
		res.code=FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "cashoutcome"
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
	}else{
		params["Пробит"] = 1;
	}
	getLastDocNumber();
	await updateDoc(res.lastid);
	return res;
}

async function printByParams(prms){
	// напечатать чек по переданным параметрам
	let res = {code:0,desc:"Ошибок нет"}
	params = prms;
	checkConnect();
	if(params['Операция']=="Чек"){
		res = await printCheck();
	}
	if(params["Операция"]=="Внесение"){
		res = await printInCash();
	}
	if(params["Операция"]=="Выплата"){
		res = await printOutCash();
	}
	if(params["Операция"]=="Отчет"){
		if(params["Режим"]=="БезГашения"){
			FR.PrintReportWithoutCleaning();
			if(FR.ResultCode!=0){
				res.code=FR.ResultCode;
				res.desc = FR.ResultCodeDescription;
				res.stage = "report without cleaning"
				params["Комментарий"]="["+String(res.code)+"] "+res.desc;
			}else{
				res = printWait();
				if(res.code==0){
					FR.PrintDepartmentReport();
					if(FR.ResultCode!=0){
						res.code=FR.ResultCode;
						res.desc = FR.ResultCodeDescription;
						res.stage = "department report "
						params["Комментарий"]="["+String(res.code)+"] "+res.desc;
					}
				}
			}

		}
		if(params["Режим"]=="СГашением"){
			FR.PrintReportWithCleaning();
			if(FR.ResultCode!=0){
				res.code=FR.ResultCode;
				res.desc = FR.ResultCodeDescription;
				res.stage = "report without cleaning"
				params["Комментарий"]="["+String(res.code)+"] "+res.desc;
			}
		}
	}

	return res;
}

async function getUnloadedChecks(prms){
	let res = {code:0,desc:"Ошибок нет"}
	params = prms;
	res.checks = await getChecks({"Загружен":0,"Раздел":params["Раздел"]});
	return res;
}

async function markChecksAsLoaded(list){
	let res = {code:0,desc:"Ошибок нет"}

	res.checks = await setChecksAsLoaded(list.map((a)=>{return {_id:a}}));
	return res;
}

async function makeBeep(){
	let res = {code:0,desc:"Ошибок нет"}
	checkConnect();
	FR.Beep();
	if(FR.ResultCode!=0){
		res.code=FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "make beep"
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
	}
	return res;
}

async function continuePrint(){
	let res = {code:0,desc:"Ошибок нет"}
	checkConnect();
	FR.ContinuePrint();
	if(FR.ResultCode!=0){
		res.code=FR.ResultCode;
		res.desc = FR.ResultCodeDescription;
		res.stage = "continue print"
		params["Комментарий"]="["+String(res.code)+"] "+res.desc;
	}
	return res;

}

async function getStatus(){
	let res = {code:0,desc:"Ошибок нет"}
	checkConnect();
	FR.GetECRStatus();
	res.ECRMode = FR.ECRMode;
	res.ECRModeDescription = FR.ECRModeDescription
	res.ECRMode8Status = FR.ECRMode8Status;
	res.ECRModeDescription = FR.ECRModeDescription;
	res.ECRAdvancedMode = FR.ECRAdvancedMode;
	res.ECRAdvancedModeDescription = FR.ECRAdvancedModeDescription;
	res.ResultCode = FR.ResultCode;
	res.ResultCodeDescription = FR.ResultCodeDescription;
	return res;
}

module.exports = {
	FR: FR,
	Port: Port,
	Speed: Speed,
	connect: connect,
	getConfig: getConfig,
	setConfigParams: setConfigParams,
	printByParams: printByParams,
	getUnloadedChecks: getUnloadedChecks,
	markChecksAsLoaded: markChecksAsLoaded,
	getVersion: getVersion,
	shutdown: shutdown,
	makeBeep: makeBeep,
	getStatus: getStatus,
	continuePrint: continuePrint,
}