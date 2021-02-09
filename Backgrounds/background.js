let port = null;

chrome.runtime.onConnect.addListener(function(port_) {
    port = port_;
    port.onMessage.addListener(function(msg) {
        //console.log(msg);
    });
});

chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({trading_is_running: false});

    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {hostEquals: 'iqoption.com'},
        })
        ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
      }]);
    });
});

function getSSID(callback){
	return chrome.cookies.get({
        url: "https://iqoption.com",
        name: "ssid"
    }, callback)
}

function stopTrading(callback){
	chrome.storage.sync.set({trading_is_running: false, current_earnings:0, open_options:0, max_earnings:0, data_options:[], current_operations:[]}, function() {
        closeServerConnection();
      	closeBrokerConnection();

        chrome.storage.sync.get(["c_trading_authenticated"], function(data) {
            if(data.c_trading_authenticated){
                fetch(domain_server+"/api/stop-trading", {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
            }
        });

        if(typeof callback == 'function')
            callback();
    });			
}

/**
 * Inicia trading en el sistema
 */
function startTrading(callbackSuccess, callbackFail){

	chrome.storage.sync.get(["trading_is_running"], (data) => {
        //Si aun no está corriendo trading
        if(!data.trading_is_running){
            //Se establece la conexion con el broker
            openBrokerConnection(() => {
                    //Si la conexion se establece se procede a conectarse al servidor
                    openServerConnection(null, 
                        (err) => {
                            //La conexion websocket falla
                            //Se cierra la conexión al broker
                            closeBrokerConnection();
                            if(typeof callbackFail == 'function')
                                    callbackFail(err);
                        }, () => {
                            //Si se suscribe con éxito al canal del websocket
                            //se establece trading_is_running en true para indicar que trading esta corriendo
                            //y se establece current_earnings, max_earnings y open_options en 0 para iniciar los conteos requeridos
                            chrome.storage.sync.set({trading_is_running:true, current_earnings:0, open_options:0, max_earnings:0, data_options:[], current_operations:[]}, () => {
                                if(typeof callbackSuccess == 'function')
                                    callbackSuccess();
                            })
                        }, () => {
                            //Si falla la suscripción al canal del websocket
                            closeBrokerConnection();
                            if(typeof callbackFail == 'function')
                                callbackFail();
                        }
                    );

                }, (e) => {
                    //Error al esablecer la conexión con el broker
                    if(typeof callbackFail == 'function')
                        callbackFail(e);
                }
            );
        }
    });
}