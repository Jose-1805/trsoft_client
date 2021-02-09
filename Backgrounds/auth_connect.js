//const wsHost = "localhost";
const wsHost = "www.app.trsoft-company.com";
//const wsHost = "192.168.43.190";
//Dominio de coneccion a servidor
//const domain_server = "http://"+wsHost+":8000";
const domain_server = "https://"+wsHost;

const wsPort = 6001;
//Websocket de conección a servidor
let echo = null;

function auth(username, password, callbackSuccess, callbackFail){
    return fetch(domain_server+"/api/login", {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
            username:username,
            userpassword:password,
            remember:true
        })
    }).then(function (res){
        if(res.status == 200){
            res.json().then((data) => {
                //El  inicio de fue exitoso
                if(data.login == 'success'){
                    chrome.storage.sync.set({"user_server":data.user}, () => {
                        if(data.user.is_client){
                            if(!data.user.is_active){
                                //El usuario no está activo
                                logout(() => {
                                    if(typeof callbackFail == 'function')
                                        callbackFail({error:"user_inactive"});
                                });
                            }else{
                                //Si no se ha asignado el identificador de usuario del broker
                                if(!data.user.broker_user_id){
                                    //Se confirma si el identificador de usuario no existe en el sistema
                                    brokerUserIdExist((resp) => {
                                        resp.json().then((data) => {
                                            //Ya hay una cuenta relacioada con el usuario de broker actual
                                            if(data.exist){
                                                logout(() => {
                                                    if(typeof callbackFail == 'function')
                                                        callbackFail({error:"user_broker_exist"});
                                                });
                                            }else{
                                                //Se asigna el identificador de usuario de broker
                                                setBrokerUserId(() => {
                                                    setUserServer();
                                                    if(typeof callbackSuccess == 'function'){
                                                        chrome.storage.sync.set({c_trading_authenticated:true}, () => {
                                                            callbackSuccess();
                                                        });
                                                    }
                                                })
                                            }
                                        });
                                    });
                                }else{
                                    //Si ya se ha asignado el identificador de usuario del broker
                                    //seidentifica si coincide con el del usuario de broker actual
                                    validUserIds((result) => {
                                        if(result){
                                            if(typeof callbackSuccess == 'function'){
                                                chrome.storage.sync.set({c_trading_authenticated:true}, () => {
                                                    callbackSuccess();
                                                });
                                            }
                                        }else{
                                            //El usuario no esta relacionado con la cuenta de broker actual
                                            logout(() => {
                                                if(typeof callbackFail == 'function')
                                                    callbackFail({error:"invalid_broker"});
                                            });
                                        }
                                    })
                                }
                            }
                        }else{
                            //El usuario no es un trader
                            logout(() => {
                                if(typeof callbackFail == 'function')
                                    callbackFail({error:"invalid_user"});
                            });
                        }
                    })
                }else{
                    logout(() => {
                        if(typeof callbackFail == 'function')
                            callbackFail({error:"invalid_credentials"});
                    });
                }
            })    
        }else{
            logout(() => {
                if(typeof callbackFail == 'function')
                    callbackFail({error:"server_error"});
            });
        }
        
        //return res.json();
    });
}

function setUserServer(callback = null){
    return fetch(domain_server+"/api/user", {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
    }).then(function (res){
        //Si se optienen los datos del usuario
        if(res.status == 200){
            res.json().then((data) => {
                chrome.storage.sync.set({user_server:data}, () => {
                    if(typeof callback == "function")
                        callback(res);
                });
            })
        }else{
            if(typeof callback == "function")
                callback(res);
        }
    });  
}

function validUserIds(callback = null){
    chrome.storage.sync.get(["user_server", "user_broker"], (data) => {
        if(data.user_broker && data.user_server){
            let user_broker = data.user_broker;
            let user_server = data.user_server;
            if(typeof callback == "function")
                callback(user_server.is_client && user_server.is_active && user_broker.user_id == user_server.broker_user_id);
        }else{
            if(typeof callback == "function")
                callback(false);
        }
    })
}

function setBrokerUserId(callback = null){
    chrome.storage.sync.get(['user_broker'], (data) => {
        if(data.user_broker){

            let user_broker = data.user_broker;

            return fetch(domain_server+"/api/set-broker-user-id", {
                method: 'POST',
                body: JSON.stringify({
                    user_id:user_broker.user_id
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            }).then(function (res){
                if(typeof callback == "function")
                    callback(res);
            });  
        }else{
            if(typeof callback == "function")
                callback({});
        }
    })
}

function brokerUserIdExist(callback = null){
    chrome.storage.sync.get(['user_broker'], (data) => {
        if(data.user_broker){

            let user_broker = data.user_broker;

            return fetch(domain_server+"/api/broker-user-id-exists", {
                method: 'POST',
                body: JSON.stringify({
                    user_id:user_broker.user_id
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            }).then(function (res){
                if(typeof callback == "function")
                    callback(res);
            });  
        }else{
            if(typeof callback == "function")
                callback({});
        }
    })
}

function logout(callback = null){
    echo = null;
    chrome.storage.sync.set({c_trading_authenticated:false, user_broker:null, user_server: null, trading_is_running: false, actives: null}, () => {
        fetch(domain_server+"/api/logout", {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            }).then(() => {
                if(typeof callback == 'function')
                    callback();
            });
    });
}

/**
* Conexión a websocket de servidor
*/
function openServerConnection(callbackSuccess, callbackFail, callbackSubscriptionSuccess, callbackSubscriptionFail){
    chrome.storage.sync.get(['c_trading_authenticated', 'user_server'], (data) => {
        if(data.c_trading_authenticated){
            //console.log('START CONECTION');
            echo = new window.Echo({
                broadcaster: 'pusher',
                key: '6a8a1ffa04842c0d4e84117c26fa5ffc',
                //cluster: process.env.MIX_PUSHER_APP_CLUSTER,

                wsHost: wsHost,
                wsPort: wsPort,
                wssHost: wsHost,
                wssPort: wsPort,

                disableStats: true,
                enabledTransports: ['ws', 'wss'],
                encrypted: true,

                authEndpoint:domain_server+'/broadcasting/auth'
            });

            //console.log(echo);

            echo.private('binary-copy').subscription.bind('pusher:subscription_succeeded', () => {
                //console.log('SUBSCRIBE TO BINARY COPY');
                if(typeof callbackSubscriptionSuccess == 'function')
                    callbackSubscriptionSuccess();
            });

            echo.private('binary-copy').subscription.bind('pusher:subscription_error', (status) => {
                //console.log('ERRRO SUBSCRIBE TO BINARY COPY');
                if(typeof callbackSubscriptionFail == 'function')
                    callbackSubscriptionFail();
            });

            echo.connector.pusher.connection.bind('state_change', function(states) {
                //console.log("STATE CHANGE::", states);
            })

            echo.connector.pusher.connection.bind('error', function(err) {
                //console.log('ERROR CONNECTING', err);
                if(typeof callbackFail == "function")
                    callbackFail(err);
            })

            echo.connector.pusher.connection.bind('connected', function() {
                //console.log('CONNECTED');
                if(typeof callbackSuccess == "function")
                    callbackSuccess();
            })

            echo.connector.pusher.connection.bind('disconnected', function() {
                //console.log('DISCONNECTED');
                chrome.storage.sync.set({trading_is_running:false}, () => {
                    closeBrokerConnection();
                })
            })  

            echo.private('binary-copy')
            .listenForWhisper('startOption', (data_) => {
                chrome.storage.sync.get(null, (data) => {
                    if(data_.direction && data_.active_id && data.amount && data.actives && data_.increase && data.user_broker && data_.expiration && data_.expiration_utc && data.traders_token && data_.token && data_.key && data_.iv && data_.salt && data_.trader){
                        if(verifyToken(data.traders_token, data_)){
                            let active = data.actives[data_.active_id];
                            //Existe el activo seleccionadotrader
                            if(active && active.enabled && ws){
                                let profit_percent = 100 - active.option.profit.commission;
                                let amount_send = parseFloat(data.amount);
                                //Si permite el inncremento del importe
                                if(data.allow_increase_amount){
                                    amount_send *= parseFloat(data_.increase);
                                }

                                let send_operation = true;

                                //Si hay stop_loss, se valida si el valor de la entrada no supera el stop loss
                                if(data.stop_loss){
                                    //Se calcula el valor donde las perdidas deben parar
                                    let stop_loss_value = data.stop_loss * -1;

                                    if(data.stop_loss_dynamically)
                                        stop_loss_value = (data.max_earnings?data.max_earnings:0) - data.stop_loss;

                                    //Si las ganancias actuales menos el valor de la entrada actual alcanzan el stop loss
                                    let stop_loss_reached = (('current_earnings' in data)?data.current_earnings:0) - amount_send < stop_loss_value;

                                    //Se intenta realizar la entrada con el valor mínimo
                                    if(stop_loss_reached && data_.increase > 1){
                                        amount_send = parseFloat(data.amount);
                                        stop_loss_reached = (('current_earnings' in data)?data.current_earnings:0) - amount_send < stop_loss_value;
                                    }

                                    if(stop_loss_reached)
                                        send_operation = false;
                                }

                                if(send_operation){
                                    ws.send('{"name":"sendMessage","msg":{"name":"binary-options.open-option","version":"1.0","body":{"user_balance_id":'+data.user_broker.balances[data.practice_account?1:0].id+',"active_id":'+active.id+',"option_type_id":3,"direction":"'+data_.direction+'","expired":'+data_.expiration+',"refund_value":0,"price":'+amount_send+',"value":0,"profit_percent":'+profit_percent+'}}}');

                                    let params_server = {
                                        active_id: active.id,
                                        active_name: active.description.split('.')[1],
                                        active_image: "https://static.cdnpub.info/files"+active.image,
                                        expiration_time: data_.expiration,
                                        expiration_time_utc: data_.expiration_utc,
                                        direction:data_.direction == 'call'?1:-1,
                                        amount:amount_send,
                                        profit_percentage:profit_percent,
                                        trader:data_.trader
                                    }

                                    let new_data_options = [];
                                    if(data.data_options){
                                        new_data_options = data.data_options;
                                    }

                                    new_data_options.push(params_server);

                                    chrome.storage.sync.set({data_options:new_data_options});
                                }
                            }
                        }
                    }
                })
            })
            .listen('TradersToken', (data) => {
                chrome.storage.sync.set({traders_token:data.tokens});
            })
            .listen('EventsCopyBinary', (data) => {
                if(data.event == 'session-ended'){
                    stopTrading(() => alert('This trading session has ended.'));
                }
            });

            echo.private('client.'+data.user_server.id)
            .listen('Client', (data) => {
                if(data.data.event == 'commission_generated'){
                    stopTrading(() => alert('A commission has been generated, go to the main TrSoft system and make the payment to continue using this product.'));
                }
            });
        }
    });
}

/**
 * Verificación de token de entradas
 * @param  {[type]} traders_token [description]
 * @param  {[type]} data          [description]
 * @return {[type]}               [description]
 */
function verifyToken(traders_token, data){
    //Si el token del trader existe
    if(data.trader && traders_token[data.trader]){
        const data_decrypt = {
            ciphertext:traders_token[data.trader],            
            salt:data.salt,
            iv:data.iv,
        }

        const text_decrypt = CryptoJS.aesDecrypt(data.key, data_decrypt);
        //Datos correctos
        if(text_decrypt == data.token){
            traders_token[data.trader] = null;
            chrome.storage.sync.set({traders_token});
            return true;
        }
    }
    return false;
}

function closeServerConnection(){
    if(echo)
        echo.disconnect();
}
