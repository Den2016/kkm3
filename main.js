let { app, BrowserWindow, Tray, Menu } = require('electron')
let path = require('path')
let url = require('url')
let iconpath = path.join(__dirname, 'ico1.png') // path of y
let win


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
        //appIcon.setHighlightMode('always')
    })
    win.on('crashed', function(){
        app.isQuiting = true;
        app.quit();
    })
}
app.on('ready', createWindow)
app.allowRendererProcessReuse = true

