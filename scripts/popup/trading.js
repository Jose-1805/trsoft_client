let btn_stop_trading = document.getElementById('btn_stop_trading');

let info_amount = document.getElementById('info_amount');
let info_max_amount = document.getElementById('info_max_amount');
let info_stop_loss = document.getElementById('info_stop_loss');
let info_stop_loss_icon = document.getElementById('info_stop_loss_icon');
let open_options = document.getElementById('open_options');
let open_options_icon = document.getElementById('open_options_icon');
let current_earnings = document.getElementById('current_earnings');

var port = chrome.runtime.connect();

//port.postMessage({joke: "Knock knock"});
port.onMessage.addListener(function(msg) {
	switch (msg.name) {
		case "set_info_options":
			setInfoOptions();
		break;
		default:
		break;
	}
});

btn_stop_trading.onclick = () => {
	chrome.storage.sync.get(["trading_is_running"], (data) => {
		if(data.trading_is_running){
			chrome.extension.getBackgroundPage().stopTrading(() => {
				showView();
			})
		}
	})
}

function setInfoOptions() {
	chrome.storage.sync.get(["current_earnings", "max_earnings", "amount", "stop_loss", "stop_loss_dynamically", "allow_increase_amount", "open_options"], (data) => {

		info_amount.innerHTML = "$ "+data.amount;

		//Valor máximp de una operación
		let max_amount_value = data.allow_increase_amount?parseFloat((data.amount * 5).toFixed(2)):data.amount;

		//SI el numero es decimal
		if(!Number.isInteger(max_amount_value)){
			let decimals = (max_amount_value - Math.trunc(max_amount_value)).toString().split('0.')[1];
			//Si tiene más de un decimal
			if(decimals.length > 1){
				if(decimals[1] != 0){
					max_amount_value = parseFloat(max_amount_value.toFixed(2));
				}else{
					max_amount_value = parseFloat(max_amount_value.toFixed(1));
				}
			}
		}

		info_max_amount.innerHTML = "$ "+max_amount_value;

		//La ganancia máxima obtenida
		max_earnings_value = data.max_earnings?data.max_earnings:0;

		//Si el stop_loss es dinamico se muesra el valor en que se detiene
		if(data.stop_loss_dynamically){
			stop_loss_value = data.stop_loss?("$ "+(max_earnings_value - data.stop_loss)):'...';
		}else{
			stop_loss_value = data.stop_loss?("$ "+(data.stop_loss * -1)):'...';
		}

		info_stop_loss.innerHTML = stop_loss_value;

		//SI el stop loss es negativo o no existe
		//Se pone en color rojo los datos de stop los
		if(stop_loss_value == "..." || stop_loss_value.split("$ -").length > 1){
			info_stop_loss.classList.remove("badge-success");
			info_stop_loss.classList.add("badge-danger");
			info_stop_loss_icon.classList.remove("text-success");
			info_stop_loss_icon.classList.add("text-danger");
		}else{//Si el stop loss es positivo los colores son verdes
			info_stop_loss.classList.remove("badge-danger");
			info_stop_loss.classList.add("badge-success");
			info_stop_loss_icon.classList.remove("text-danger");
			info_stop_loss_icon.classList.add("text-success");
		}

		current_earnings_value = data.current_earnings?data.current_earnings:0;

		current_earnings.innerHTML = "$ "+current_earnings_value.toFixed(2);

		if(current_earnings_value == 0){
			current_earnings.classList.remove("text-success");
			current_earnings.classList.remove("text-danger");
		}else if(current_earnings_value > 0){
			current_earnings.classList.remove("text-danger");
			current_earnings.classList.add("text-success");
		}else if(current_earnings_value < 0){
			current_earnings.classList.remove("text-success");
			current_earnings.classList.add("text-danger");
		}

		if(!"current_earnings" in data){
			chrome.storage.sync.set({current_earnings:current_earnings_value});
		}

		if(!"max_earnings" in data){
			chrome.storage.sync.set({max_earnings:max_earnings_value});
		}

		if(!"open_options" in data){
			chrome.storage.sync.set({open_options:0});
		}

		open_options_value = data.open_options?data.open_options:0;
		open_options.innerHTML = open_options_value;

		//Si existen opciones abiertas se pone azul la información de conteo de entradas
		if(open_options_value > 0){
			open_options.classList.remove('badge-secondary');
			open_options.classList.add('badge-info');

			open_options_icon.classList.remove('text-secondary');
			open_options_icon.classList.add('text-info');
		}else{
			open_options.classList.remove('badge-info');
			open_options.classList.add('badge-secondary');

			open_options_icon.classList.remove('text-info');
			open_options_icon.classList.add('text-secondary');
		}
	})

}