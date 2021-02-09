let input_amount = document.getElementById('amount');
let input_max_amount = document.getElementById('max_amount');
let input_stop_loss = document.getElementById('stop_loss');
let input_stop_loss_dynamically = document.getElementById('stop_loss_dynamically');
let input_practice_account = document.getElementById('practice_account');
let input_allow_increase_amount = document.getElementById('allow_increase_amount');

let btn_start_trading = document.getElementById('btn_start_trading');

setOptions();

btn_start_trading.onclick = function(element) {
	chrome.storage.sync.get('trading_is_running', function(data) {
		//Si trading no está corriendo se intenta iniciar
		if(!data.trading_is_running){
			showLoading();
			chrome.extension.getBackgroundPage().startTrading(() => {
				showView();
			}, () => {
				alert('An error occurred while connecting to the main system, make sure you have no commissions pending payment and have an active license for the product TrSoft / Copy Binary');
				showView();
			});
		}
	});
}

input_amount.onchange = (e) => {
	changeAmount(e);
}

input_amount.onkeyup = (e) => {
	changeAmount(e);
}

input_stop_loss.onchange = (e) => {
	changeStopLoss(e);
}

input_stop_loss.onkeyup = (e) => {
	changeStopLoss(e);
}

input_stop_loss_dynamically.onchange = (e) => {
	chrome.storage.sync.set({stop_loss_dynamically:e.target.checked}, () => setOptions());
}


input_practice_account.onchange = (e) => {
	chrome.storage.sync.set({practice_account:e.target.checked}, () => setOptions());
}

input_allow_increase_amount.onchange = (e) => {
	chrome.storage.sync.set({allow_increase_amount:e.target.checked}, () => setOptions());
}

function changeAmount(e){
	let val = parseFloat(e.target.value);
	if(Number.isNaN(val))val = 1;

	//SI el numero es decimal
	if(!Number.isInteger(val)){
		let decimals = (val - Math.trunc(val)).toString().split('0.')[1];
		//Si tiene más de un decimal
		if(decimals.length > 1){
			if(decimals[1] != 0){
				val = parseFloat(val.toFixed(2));
			}else{
				val = parseFloat(val.toFixed(1));
			}
		}

	}
	
	chrome.storage.sync.get(['user_server'], (data) => {
		if(data.user_server.max_profit_copy_binary < val){
			val = data.user_server.max_profit_copy_binary;
		}

		chrome.storage.sync.set({amount:val?val:1}, () => setOptions());
	})
}

function changeStopLoss(e){
	let val = parseFloat(e.target.value);
	if(Number.isNaN(val))val = 0;

	//SI el numero es decimal
	if(!Number.isInteger(val)){
		let decimals = (val - Math.trunc(val)).toString().split('0.')[1];
		//Si tiene más de un decimal
		if(decimals.length > 1){
			if(decimals[1] != 0){
				val = parseFloat(val.toFixed(2));
			}else{
				val = parseFloat(val.toFixed(1));
			}
		}

	}

	chrome.storage.sync.set({stop_loss:val?val:null}, () => setOptions());
}

function setOptions(){
	//Se consultan los datos de trading
	chrome.storage.sync.get(["user_server", "amount", "stop_loss", "stop_loss_dynamically", "practice_account", "allow_increase_amount"], (data) => {
		//Existe importe en el storage
		if("amount" in data && typeof data.amount == 'number'){
			if(data.user_server){
				if(data.user_server.max_profit_copy_binary < data.amount){
					chrome.storage.sync.set({amount:data.user_server.max_profit_copy_binary});
					data.amount = data.user_server.max_profit_copy_binary;
				}
			}

			input_amount.value = data.amount;
		}else{//No existe importe en el storage
			input_amount.value = data.user_server?data.user_server.max_profit_copy_binary:1;
			chrome.storage.sync.set({amount:input_amount.value});
		}

		//Existe stop_loss en el storage
		if("stop_loss" in data && typeof data.stop_loss == 'number'){
			input_stop_loss.value = data.stop_loss;			
		}else if("stop_loss" in data && data.stop_loss == null){
			input_stop_loss.value = "";			
		}else{//No existe stop loss en el storage
			let stop_loss = input_stop_loss.value;
			//Se almacena el stop loss del input o null si no existe stop loss en el input
			chrome.storage.sync.set({stop_loss:stop_loss?parseFloat(stop_loss):null});
			//Si no existe stop loss en el input se agrega vacio
			if(!stop_loss)
				input_stop_loss.value = "";
		}

		//Existe stop_loss_dynamically en el storage
		if("stop_loss_dynamically" in data && typeof data.stop_loss_dynamically == 'boolean'){
			input_stop_loss_dynamically.checked = data.stop_loss_dynamically;			
		}else{
			//Se almacena el stop_loss_dynamically del input en el storage
			chrome.storage.sync.set({stop_loss_dynamically:input_stop_loss_dynamically.checked});
		}

		//Existe practice_account en el storage
		if("practice_account" in data && typeof data.practice_account == 'boolean'){
			input_practice_account.checked = data.practice_account;			
		}else{
			//Se almacena el practice_account del input en el storage
			chrome.storage.sync.set({practice_account:input_practice_account.checked});
		}

		//Existe allow_increase_amount en el storage
		if("allow_increase_amount" in data && typeof data.allow_increase_amount == 'boolean'){
			input_allow_increase_amount.checked = data.allow_increase_amount;			
		}else{
			//Se almacena el allow_increase_amount del input en el storage
			chrome.storage.sync.set({allow_increase_amount:input_allow_increase_amount.checked});
		}

		input_max_amount.value = (input_amount.value * (input_allow_increase_amount.checked?5:1)).toFixed(2);
	});
}	