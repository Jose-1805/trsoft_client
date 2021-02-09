//Websocket de conección a broker
let ws = null;
//Dominio de conección a broker
const domain = "iqoption.com";

let ssid = null;

let id_interval = null;

function openBrokerConnection(callbackSuccess, callbackFail) {
    (ws = new WebSocket("wss://" + domain + "/echo/websocket")).onopen = function() {

        ws.send('{"name":"ssid","msg":"'+ssid+'"}');
        if(typeof callbackSuccess == 'function')
        	callbackSuccess()

        let current_second = new Date().getSeconds();
        let seconds_to_start = 40;
    	let seconds_to_minute = 60 - current_second;
    	let start_in = 5;

    	if(seconds_to_minute < (60 - seconds_to_start))start_in = (seconds_to_minute + seconds_to_start)
    	else start_in = (seconds_to_minute - (60 - seconds_to_start));

    	start_in = (start_in >= 5)?start_in:(start_in + 60);

    	if(id_interval){
    		clearInterval(id_interval);
    	}

        setTimeout(() => {
        	id_interval = setInterval(() => {
        		if(ws){
	        		requestSyncDataBroker();
	        	}
        	}, 15000);
    	}, start_in * 1000);
    }
    
    ws.onclose = function(e) {
    	chrome.storage.sync.set({trading_is_running:false}, () => {
    		ws = null;
            closeServerConnection();
        })

    }
    
    ws.onmessage = function(e) {
    	if(e.data){
            let data = JSON.parse(e.data);
            //Se reciben datos de los activos
            if(data.name == 'api_option_init_all_result'){
                if(data.msg.isSuccessful){
                    //console.log('api_option_init_all_result', data.msg);
                    let actives = {};
                    //Se recorren todos los activos turbo
                    for(var i in data.msg.result.turbo.actives){
                        //Si el activo esta habilitado
                        if(data.msg.result.turbo.actives[i].enabled){
                            //Se agrega el activo
                            actives[data.msg.result.turbo.actives[i].id] = {
                                id: data.msg.result.turbo.actives[i].id,
                                image: data.msg.result.turbo.actives[i].image,
                                description: data.msg.result.turbo.actives[i].description,
                                enabled: data.msg.result.turbo.actives[i].enabled,
                                option:{
                                    profit:data.msg.result.turbo.actives[i].option.profit
                                    //bet_close_time:data.msg.result.turbo.actives[i].option.bet_close_time,
                                }
                            }
                        }
                    }

                    chrome.storage.sync.set({actives:actives});
                }
            }else if(data.name == "profile"){//Se obtienen datos del usuario desde el broker
                chrome.storage.sync.set({user_broker:data.msg});
            }else if(data.name == "socket-option-opened"){//Una operación se inició
                //Se esperan unos segundos para procesar la información
                //Esto para tener seguridad de que los datos del storage están actualizados
                setTimeout(() => {
                    chrome.storage.sync.get(null, (data_) => {
                        //Si existen operaciones registradas en el storage
                        if(data_.data_options){

                            let data_server = null;
                            let index_data = null;
                            let data_operation = null;

                            //Se recorren todas las operaciones registradas en el storage
                            for(var i = 0; i < data_.data_options.length; i++){
                                //Si la operación del indice actual corresponde
                                //a la operación de los datos de evento enviados
                                if(
                                    //Mismo activo
                                    data_.data_options[i].active_id == data.msg.active_id
                                    //Misma fecha de expiración
                                    && data_.data_options[i].expiration_time == data.msg.expired
                                    //Misma dirección
                                    && (
                                        (
                                            data_.data_options[i].direction == 1
                                            && data.msg.dir == 'call'
                                        )
                                        || (
                                            data_.data_options[i].direction == -1
                                            && data.msg.dir == 'put'
                                        )
                                    )
                                ){
                                    data_server = data_.data_options[i];
                                    data_operation = {
                                        amount: data_.data_options[i].amount,
                                        profit_percentage: data_.data_options[i].profit_percentage,
                                    };
                                    index_data = i;
                                    break;
                                }
                            }

                            //Si se encontró la operación en el registro del storage
                            if(data_server){
                                data_server.option_broker_id = data.msg.id;
                                data_operation.option_broker_id = data.msg.id;
                                data_server.expiration_time = data_server.expiration_time_utc;

                                //Se envían los datos al servidor
                                fetch(domain_server+"/api/option-client", {
                                    method: 'POST',
                                    body: JSON.stringify(data_server),
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json'
                                    },
                                })

                                //La nueva operación se agrega a la lista de operaciones actuales
                                let new_current_operations = [];
                                if(data.current_operations){
                                    new_current_operations = data.current_operations;
                                }

                                new_current_operations.push(data_operation);

                                let open_options = data_.open_options?(data_.open_options + 1):1;

                                //Se borra del storage el registro de la operación
                                let data_options = data_.data_options;
                                data_options.splice(index_data,1);
                                chrome.storage.sync.set({
                                    data_options,//Opciones actualizadas
                                    open_options,//Cantidad de Operaciones abiertas
                                    current_operations: new_current_operations,//Información de operaciones abiertas
                                    //Se disminuye el valor de la entrada a las ganancias actuales
                                    current_earnings: ('current_earnings' in data_)?(data_.current_earnings - data_operation.amount):(data_operation.amount * -1)
                                }, () => {
                                        port.postMessage({name:'set_info_options'})
                                    });
                            }
                        } 
                    });
                }, 3000);
            }else if(data.name == "socket-option-closed"){//Una operación ha cerrado
                chrome.storage.sync.get(null, (data_) => {
                    //Datos para enviar al servidor
                    let params_server = {
                        option_broker_id: data.msg.id,
                        result: data.msg.win == 'loose'?-1:(data.msg.win == 'win'?1:0),
                        is_demo:data.msg.is_demo?1:-1
                    }

                    //Se envían los datos al servidor
                    fetch(domain_server+"/api/update-option-client", {
                        method: 'POST',
                        body: JSON.stringify(params_server),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                    });   

                    //Se buscan la operación en las operaciones actuales
                    if(data_.current_operations){
                        //Se recorren todas las operaciones actuales
                        for(var i = 0; i < data_.current_operations.length; i++){

                            //Si la operación del indice actual corresponde
                            //a la operación de los datos de evento enviados
                            if(data_.current_operations[i].option_broker_id == data.msg.id){
                                let earnings = 0;
                                let current_operations = data_.current_operations;

                                let current_earnings = 'current_earnings' in data_?data_.current_earnings:0;
                                let max_earnings = 'max_earnings' in data_?data_.max_earnings:0;
                                let open_options = data_.open_options?(data_.open_options - 1):0;

                                //Si la opéración se ganó
                                if(data.msg.win == 'win'){
                                    //Se calculan las ganancias
                                    earnings = data_.current_operations[i].amount + (data_.current_operations[i].amount * (data_.current_operations[i].profit_percentage/100));

                                    //Se borra el registro de las operaciones actuales
                                    current_operations.splice(i,1);

                                    chrome.storage.sync.set({
                                        open_options,//Cantidad de Operaciones abiertas
                                        current_operations,//Información de operaciones abiertas
                                        //Se disminuye el valor de la entrada a las ganancias actuales
                                        current_earnings: current_earnings + earnings,
                                        max_earnings: (current_earnings + earnings  > max_earnings)?(current_earnings + earnings):max_earnings,
                                    }, () => {
                                        port.postMessage({name:'set_info_options'})
                                    });
                                }else{//Si la opercion se empato o perdió
                                    //Si hay stop loss
                                    if(data_.stop_loss){
                                        //Se calcula el valor donde las perdidas deben parar
                                        let stop_loss_value = data_.stop_loss * -1;

                                        if(data_.stop_loss_dynamically)
                                            stop_loss_value = max_earnings - data_.stop_loss;

                                        //Si las ganancias actuales son inferiores al stop_loss + entrda mínima, el stop loss ha sido alcanzado
                                        let stop_loss_reached = current_earnings < (stop_loss_value + data_.amount);

                                        if(stop_loss_reached){
                                            stopTrading();
                                            alert('Stop loss reached');
                                        }else{
                                            current_operations.splice(i,1);

                                            chrome.storage.sync.set({
                                                open_options,//Cantidad de Operaciones abiertas
                                                current_operations,//Información de operaciones abiertas
                                            }, () => {
                                                port.postMessage({name:'set_info_options'})
                                            });
                                        }
                                    }else{
                                        //Se borra el registro de las operaciones actuales
                                        current_operations.splice(i,1);

                                        chrome.storage.sync.set({
                                            open_options,//Cantidad de Operaciones abiertas
                                            current_operations,//Información de operaciones abiertas
                                        }, () => {
                                            port.postMessage({name:'set_info_options'})
                                        });
                                    }
                                }                                
                                break;
                            }
                        }
                    }  
                });           
            }else if(data.name = "option-rejected" && data.msg.reason == "no_money"){
                stopTrading(() => alert('Session closed due to insufficient balance in your account'));
            }else if(data.name != "timeSync" && data.name != "heartbeat"){
                //console.log(data.name, data);
            }
        }
    }
    
    ws.onerror = function(e) {
        console.log("ERROR EN WEBSOCKET: ", e)
    	if(typeof callbackFail == 'function')
        	callbackFail(e)
    }
}

function closeBrokerConnection(){
	if(ws)
		ws.close();
}

function requestSyncDataBroker(){
    if(ws){
        ws.send('{"msg":"","name":"api_option_init_all"}');
    }
}

function setUserBroker(callback){
    return fetch("https://"+domain+"/api/register/getregdata", {
        method: 'GET'
    }).then(function (res){
        //Usuario ya inició sesion en el broker
        if(res.status == 200){
            res.json().then((data) => {
                chrome.storage.sync.set({user_broker:data.result.profile}, () => {
	                chrome.extension.getBackgroundPage().getSSID(function(e){
				    	ssid = e.value;
	                    if(typeof callback == "function")
	                        callback(res);
				    });
                });
            })
        }else{
            if(typeof callback == "function")
                callback(res);
        }
    });
}

/*function getNextExpirationTime(){
    var date = new Date();
    var add_minutes = 2;
    if(date.getSeconds() < 30){
        add_minutes = 1;
    }

    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + add_minutes);

    return date.getTime().toString().substr(0,10);
}*/
ssid = '5cd5ea082480fbcbe3516f1fde367f31';
(ws = new WebSocket("wss://iqoption.com/echo/websocket")).onopen = function() {

        ws.send('{"name":"ssid","msg":"'+ssid+'"}');

        setTimeout(function(){
            ws.send('{"msg":"","name":"api_option_init_all"}');
        },6000);
    }
    
    ws.onmessage = function(e) {
        console.log('MSG', e);
    }

var url = 'https://auth.iqoption.com/api/v2/login';
var data = {
    identifier:'ordonezjulymariana@gmail.com',
    password:'jl10617589531805hg'
};

fetch(url, {
  method: 'POST', // or 'PUT'
  body: JSON.stringify(data), // data can be `string` or {object}!
}).then(res => res.json())
.catch(error => console.error('Error:', error))
.then(response => console.log('Success:', response));