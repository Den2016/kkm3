let {app, BrowserWindow, Tray, Menu} = require('electron')
let path = require('path')
let url = require('url')
let iconpath = path.join(__dirname, 'ico1.png') // path of y
let win = '', appIcon = null
let options = require('./config/config')
let Fastify = require('fastify')
let Kkm = require('./src/kkm')
let Logger = require('./src/logger')
const log = require('electron-log');
const myLogger = new Logger()

//log.transports.console.format = '{h}:{i}:{s} {text}';
//log.transports.file.getFile();

Object.assign(console, log.functions);

function createWindow() {
    win = new BrowserWindow({width: 600, height: 600, icon: iconpath})

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
    }))
    win.hide();

    appIcon = new Tray(iconpath)

    let contextMenu = Menu.buildFromTemplate([
        {label: 'Показать', click: () => win.show()},
        {
            label: 'Выход', click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ])

    appIcon.setContextMenu(contextMenu)
    appIcon.on('double-click', (e) => {
        win.show();
    })

    win.on('close', function (event) {
        if (!app.isQuiting) {
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
    win.on('crashed', function () {
        app.isQuiting = true;
        app.quit();
    })
}

app.on('ready', createWindow)
app.allowRendererProcessReuse = true

app.fastify = Fastify({
    logger: myLogger,
})
app.fastify.kkm = new Kkm(options.kkm, myLogger)

app.fastify.after(() => {
    // Declare a route
    app.fastify.get('/', function (request, reply) {
        let res = {}
        res.success = true
        res.statusCode = 200;
        reply
            .code(200)
            .header('Content-Type', 'application/json; charset=utf-8')
            .send(res)
    })

    /**
     * обработка маршрута /service
     * описание параметров запроса см. в service.js
     */
    app.fastify.post('/connect', function (request, reply) {
        console.log(request.body)
        try {
            let res = app.fastify.kkm.connect()
            res.success = true
            res.statusCode = 200;
            reply
                .code(200)
                .header('Content-Type', 'application/json; charset=utf-8')
                .send(res)
        } catch (e) {
            console.error(e)
            reply.send({success: false, statusCode: 500})
        }
    })
    app.fastify.post('/disconnect', function (request, reply) {
        //console.log(request)
        try {
            let res = app.fastify.kkm.disconnect()
            res.success = true
            res.statusCode = 200;
            reply
                .code(200)
                .header('Content-Type', 'application/json; charset=utf-8')
                .send(res)
        } catch (e) {
            console.error(e)
            reply.send({success: false, statusCode: 500})
        }
    })
    app.fastify.post('/exec', function (request, reply) {
        //console.log(request)
        try {
            let res = app.fastify.kkm.execCommands(request.body)
            res.success = true
            res.statusCode = 200;
            //console.log(res)
            reply
                .code(200)
                .header('Content-Type', 'application/json; charset=utf-8')
                .send(res)
        } catch (e) {
            console.error(e)
            reply.send({success: false, statusCode: 500 })
        }
    })
})

app.fastify.listen(options.servicePort, '0.0.0.0', function (err, address) {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.log(`server listening on ${address}`)
})