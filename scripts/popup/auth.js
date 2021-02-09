let btn_submit_login = document.getElementById('btn_submit_login');
let btn_logout = document.getElementById('btn_logout');
let btn_loading = document.getElementById('btn_loading');
let email_field = document.getElementById('email');
let password_field = document.getElementById('password');

let email = "";
let password = "";

email_field.onchange = function(e){
	email = e.target.value;
}

password_field.onchange = function(e){
	password = e.target.value;
}

//Intento de autenticación en CTrading
btn_submit_login.onclick = function(e){
	if(email && password){
		btn_submit_login.classList.add('d-none');
		btn_loading.classList.remove('d-none');

		chrome.extension.getBackgroundPage().auth(email, password, () => {
			showView();
			btn_submit_login.classList.remove('d-none');
			btn_loading.classList.add('d-none');	
		}, (data) => {
			switch (data.error) {
				case "server_error":
					alert('Authentication failed, verify your data.');
					break;
				case "invalid_credentials":
					alert('Authentication failed, verify your data.');
					break;
				case "invalid_user":
					alert('User not allowed.');
					break;
				case "invalid_broker":
					alert('The current broker account is not related to your user.');
					break;
				case "user_broker_exist":
					alert('The current broker account is related to another user.');
					break;
				case "user_inactive":
					alert('Your user account is inactive.');
					break;
				default:
					// statements_def
					break;

			}
			window.close();
		});
	}else{
		alert('Please complete the authentication form.');
	}
}

btn_logout.onclick = (e) => {
	chrome.extension.getBackgroundPage().logout(() => window.close());
}