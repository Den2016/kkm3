let { app, BrowserWindow, Tray, Menu } = require('electron')
let path = require('path')
let url = require('url')
let iconpath = path.join(__dirname, 'ico1.png') // path of y
let win
let winax = require('winax');
let express = require('express');
let cors = require('cors');
let KKM  = require('./kkm.js')

app.express = express();

Number.prototype.format = function(n, x, s, c) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\D' : '$') + ')',
        num = this.toFixed(Math.max(0, ~~n));
    return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), '$&' + (s || ','));
};	
Number.prototype.pad = function(size) {
	var s = String(this);
	while (s.length < (size || 2)) {s = "0" + s;}
	return s;
};
Date.prototype.mysqldate = function(){
	let dt=this;
	return dt.getFullYear().pad(4)+'-'+(dt.getMonth()+1).pad(2)+'-'+dt.getDate().pad(2);
}		
Date.prototype.mysqldatetime = function(){
	let dt=this;
	return dt.getFullYear().pad(4)+'-'+(dt.getMonth()+1).pad(2)+'-'+dt.getDate().pad(2)+' '+dt.getHours().pad(2)+':'+dt.getMinutes().pad(2)+':'+dt.getSeconds().pad(2);
}		

function obj2json(obj){
	let cache = [];
	let s = JSON.stringify(obj, function(key, value) {
	    if (typeof value === 'object' && value !== null) {
	        if (cache.indexOf(value) !== -1) {
	            // Duplicate reference found
	            try {
	                // If this value does not reference a parent it can be deduped
	                return JSON.parse(JSON.stringify(value));
	            } catch (error) {
	                // discard key if value cannot be deduped
	                return;
	            }
	        }
	        // Store value in our collection
	        cache.push(value);
	    }
	    return value;
	}, 4);
	cache = null; // Enable garbage collection
	return s;
}


function createWindow() {
    win = new BrowserWindow({ width: 600, height: 600, icon: iconpath })

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
    }))
    win.hide();

    let appIcon = new Tray(iconpath)

    let contextMenu = Menu.buildFromTemplate([
        { label: 'Показать', click: ()=> win.show() },
        // { label: 'Перезагрузить kkm.js', click: ()=> {
        // 	KKM.shutdown();
        // 	KKM = undefined;
        // 	KKM = require('./kkm.js')
        // 	console.log(KKM.getVersion());
        // } },
        { label: 'Выход', click: ()=>{app.isQuiting = true; app.quit();} }
    ])

    appIcon.setContextMenu(contextMenu)
    appIcon.on('double-click',(e)=>{
    	win.show();
    })

    win.on('close', function (event) {
	    if(!app.isQuiting){
	        event.preventDefault();
	        win.hide();
	    }
    })

    win.on('minimize', function (event) {
        event.preventDefault()
        win.hide()
    })

    win.on('show', function () {
        appIcon.setHighlightMode('always')
    })
    win.on('crashed', function(){
    	app.isQuiting = true;
    	app.quit();
    })
}

app.on('ready', createWindow)

app.express.use(express.json());

app.express.get('/',(req,res)=>{
	res.send('OK');
})

//let whitelist = KKM.getConfig().whitelist || [];

let whitelist = ['http://lada-nf.ru', 'http://test.lada-nf.ru']

let corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
    	console.log('Not allowed by cors for ',origin)
      callback(null, false);//new Error('Not allowed by CORS'))
    }
  },
  optionsSuccessStatus: 200	
}
app.express.use(cors(corsOptions));

app.express.post('/api',  (req,res)=>{
	try{
		let body=req.body
		let r={code:-1,description:'Нет связи'};
		//console.log(req);
		//console.log(body);
		if(body.action=='connect'){
			r = KKM.connect(body.port,body.speed);
			res.send({result:'OK',params:r})
			return;
		}
		if(body.action=='printbyparams'){
			KKM.printByParams(body.params).then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		if(body.action=='getunloadedchecks'){
			KKM.getUnloadedChecks(body.params).then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		if(body.action=='markchecksasloaded'){
			KKM.markChecksAsLoaded(body.params).then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		if(body.action=='makebeep'){
			KKM.makeBeep(body.params).then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		if(body.action=='continueprint'){
			KKM.continuePrint(body.params).then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		if(body.action=='getstatus'){
			KKM.getStatus().then(r=>{res.send({result:'OK',params:r})});
			return;
		}
		res.send({result:'error',params:{code:404,desc:'Unknown API method '+body.action,arr:['123',11,true,{a:1}]}})

	}catch(e){
		res.send({result:'error',params:{code:500,desc:e.message,stack:e.stack}})
	}
})
//console.log(KKM.getVersion());

app.express.listen(3000,function(){
	console.log('kkm2 listening on port 3000')
})