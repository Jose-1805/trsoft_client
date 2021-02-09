let div_login = document.getElementById('form_login');
let div_trading = document.getElementById('trading');
let div_options = document.getElementById('options');
let div_user_logout = document.getElementById('div_user_logout');
let div_loading = document.getElementById('div_loading');

if(!chrome.extension.getBackgroundPage()){
	alert('There is an error in the extension, update or reinstall it.');
	window.close();
}else{
	validUserBroker();
}

/**
 * Determina el estado de la aplicación dependiendo de los 
 * datos del usuario en relacion al brokers
 */
function validUserBroker(){
	//Si el usuario ha iniciado sesión en el broker
	//se almacenan los datos de usuario
	chrome.extension.getBackgroundPage().setUserBroker((data) => {
		//Usuario no ha iniciado sesión
		if(data.status == 401){
			div_user_logout.classList.remove('d-none');
			div_loading.classList.add('d-none');
			chrome.extension.getBackgroundPage().logout();
		//La sesion del broker está iniciada
		}else if(data.status == 200){//Los datos del usuario han sido guardados en storage
			chrome.storage.sync.get(['c_trading_authenticated'], (data) => {
				//Si el usuario ya se autenticó en CTrading
				if(data.c_trading_authenticated){
					chrome.extension.getBackgroundPage().setUserServer((res) => {
						if(res.status == 200){
							//Si los identificadores de usuario son correctos
							chrome.extension.getBackgroundPage().validUserIds((result) => {
								if(result){
									showView();
								}else{
									chrome.extension.getBackgroundPage().logout(() => {
										alert('An error occurred validating your information, login again.')
										window.close()
									});
								}
							});
						}else{
							//Error de al solicitar datos de usuario
							chrome.extension.getBackgroundPage().logout(() => {
								alert('An error occurred connecting to the server, try again.')
								window.close()
							});
						}
					});
				}else{
					showView();
				}
			})
		}
	});
}

//Determina que mostrar en el Popup de acuerdo a la autenticación del usuario
function showView(){
	chrome.storage.sync.get(['c_trading_authenticated', 'trading_is_running'], function(data) {
		//Si el usuario ya está autenticado con CTrading
		if(data.c_trading_authenticated){
			//Trading activo
			if(data.trading_is_running){

				showTrading();
			}else{
				//Si no esta trading activo se muestra la vista de opciones
				showOptions();
			}
		}else{
			showLogin();
		}
	});
}

/**
* Muestra la vista de opciones y oculta lo demás
*/
function showOptions(){
	div_options.classList.remove('d-none');
	div_login.classList.add('d-none');
	div_loading.classList.add('d-none');
	div_trading.classList.add('d-none');
}

/**
* Muestra el formulario de autenticación y oculta lo demás
*/
function showLogin(){
	div_login.classList.remove('d-none');
	div_options.classList.add('d-none');
	div_loading.classList.add('d-none');
	div_trading.classList.add('d-none');
}

/**
* Muestra la vista de trading 
*/
function showTrading(){
	setInfoOptions();
	div_trading.classList.remove('d-none');
	div_login.classList.add('d-none');
	div_options.classList.add('d-none');
	div_loading.classList.add('d-none');
}

/**
* Muestra la vista de carga
*/
function showLoading(){
	div_loading.classList.remove('d-none');
	div_trading.classList.add('d-none');
	div_login.classList.add('d-none');
	div_options.classList.add('d-none');
}