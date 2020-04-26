# kkm3
Cервер ККМ Штрих-М, обслуживающий http запросы

Данное приложение предназначено для предоставления возможности управлять ККМ Штрих-М и совместимыми с ними
с помощью REST запросов.

#### Ограничения

* работа только под Windows
* необходимо наличие установленного стандартного драйвера от Штрих-М
* для доработки исходного кода и сборки своей версии используется только 32-хбитный Node.JS
* для сборки с помощью `npm run build` необходим глобально установленный `electron-builder`
* после установки при первом запуске приложение прописывает себя в автозагрузку. Деинсталляция приложения
 не удалять из реестра запись об автозапуске, поэтому необходимо эту операцию провести вручную, например, 
 с помощью `msconfig`
 * несмотря на то, что сервер может принимать запросы с любого хоста, в данной версии не рекомендуется 
 пытаться делать многопользовательское использование в случае если для пробития одного чека необходимо
 использовать несколько запросов, например, для получения промежуточных данных. Возможно, 
 в следующих версиях добавлю понятие транзакций.
 
 #### Использование
 
 При запуске приложение сворачивается в трей и запускает web сервер, прослушивающий порт 5432.
 Сервер обслуживает только POST запросы. Маршруты:
 * `/connect`
 * `/exec`
 * `/disconnect`

Каждый метод возвращает JSON следующего вида 
```json
{
  "OperatorNumber": 30,
  "ECRSoftVersion": "A.4",
  "ECRBuild": 24896,
  "ECRSoftDate": "2005-12-21T00:00:00.000Z",
  "LogicalNumber": 1,
  "OpenDocumentNumber": 6074,
  "ECRFlags": 33456,
  "PointPosition": true,
  "EKLZIsPresent": true,
  "IsDrawerOpen": false,
  "IsEKLZOverflow": false,
  "QuantityPointPosition": true,
  "ECRMode": 4,
  "ECRModeDescription": "Закрытая смена",
  "ECRMode8Status": 0,
  "ECRModeStatus": 0,
  "ECRAdvancedMode": 0,
  "ECRAdvancedModeDescription": "Бумага присутствует",
  "PortNumber": 0,
  "Date": "2020-04-25T00:00:00.000Z",
  "Time": "1899-12-30T12:25:17.000Z",
  "TimeStr": "12:25:17",
  "FMOverflow": false,
  "IsBatteryLow": false,
  "IsLastFMRecordCorrupted": false,
  "IsFMSessionOpen": false,
  "IsFM24HoursOver": false,
  "SerialNumber": "00037073",
  "SessionNumber": 0,
  "FreeRecordInFM": 2100,
  "RegistrationNumber": 0,
  "ResultCode": 0,
  "ResultCodeDescription": "Ошибок нет",
  "success": true
}
```

 
 #### `/connect`
 
тело запроса может быть любым, в том числе пустым. Метод выполняет поиск ККМ перебором портов с 1 по 40 и скоростей с 2400 по 115200.
При нахождении ККМ на каком-либо порту запоминает порт и скорость на время до следующего запуска.
Оставляет ККМ в подключенном состоянии, для обеспечения скорости последующих команд. Конечно, ничего не 
мешает вызывать connect в методе exec, но в таком случае не будет автопоиска ККМ. 

#### `/disconnect`

Выполняет команду Disconnect для ранее подключенного ККМ

#### `/exec`

В теле запроса ожидает JSON следующего формата

```json
[
  { "action": "setproperty", "name": "RegisterNumber", "value": "152" },
  { "action": "command", "name": "GetOperationReg" },
  { "action": "getproperty", "name": "ContentsOfOperationRegister" }
]
```

Драйвер Штрих-М спроектирован таким образом, что любой метод вызывается без аргументов. 
Все необходимые данные для вызываемых методов предварительно записываются в свойства.
Поэтому для нормального общения с ККМ достаточно трех команд - установка свойства, 
вызов метода и чтение свойства. Благодаря такой архитектуре оказалось возможным сделать 
простую структуру для управления ККМ и однима запросом выполнять достаточно сложные последовательности
команд.
Приведенный выше пример запроса производит чтение операционного регистра, в котором хранится номер
последнего чека.
Запрашиваемое значение свойства возвращается в JSON ответа, в данном случае будет возвращени стандартный 
JSON, содержащий в себе еще и `"ContentsOfOperationRegister" : 6074,`

Возможно чтение нескольких свойств за один вызов ресурса, все они будут включены в вовращаемый JSON

#### Еще примеры

* запись в таблицу системы налогообложения, по которой будем в последующем пробивать чек. 
В данном случае прописываем ЕНВД. Для УСН вместо 8 запишем 2, для патентной системы - 32  
```json
[
  { "action": "setproperty", "name": "Password", "value": "30" },
  { "action": "setproperty", "name": "TableNumber", "value": "18" },
  { "action": "setproperty", "name": "RowNumber", "value": "1" },
  { "action": "setproperty", "name": "FieldNumber", "value": "5" },
  { "action": "setproperty", "name": "ValueOfFieldInteger", "value": "8" },
  { "action": "setproperty", "name": "ValueOfFieldString", "value": "8" },
  { "action": "command", "name": "WriteTable" }
]
```

* регистрация продажи
```json
[
  { "action": "setproperty", "name": "Quantity", "value": "1" },
  { "action": "setproperty", "name": "Price", "value": "121" },
  { "action": "setproperty", "name": "Department", "value": "5" },
  { "action": "setproperty", "name": "StringForPrinting", "value": "В кармане пачка сигарет" },
  { "action": "command", "name": "Sale" }
]
```

* закрытие чека 

```json
[
  { "action": "setproperty", "name": "Summ1", "value": "121" },
  { "action": "setproperty", "name": "Summ2", "value": "0" },
  { "action": "setproperty", "name": "Summ3", "value": "0" },
  { "action": "setproperty", "name": "Summ4", "value": "0" },
  { "action": "setproperty", "name": "DiscountOnCheck", "value": "0" },
  { "action": "setproperty", "name": "StringForPrinting", "value": "Спасибо за покупку!" },
  { "action": "command", "name": "CloseCheck" }
]
```