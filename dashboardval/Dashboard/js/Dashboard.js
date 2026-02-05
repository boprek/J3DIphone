var ip_server;
var paramsDas = {};
var EAStatus = 7n; //Status del sistema actual
var socketDash;

import {CreateAdminUI} from '../Apps/AdminUI/js/AdminUI.js';
import {CreateUIEditor} from '../Apps/UIEditor/js/UIEditor.js';


//--------Init Dash---------//
var AdminUI; 
var Reports;
var UIEditor;
var IsTactil = false;
	
window.addEventListener('touchstart', function setHasTouch () {
	IsTactil = true;
	window.removeEventListener('touchstart', setHasTouch);
}, false);

async function ChargeDash(){
	await readConfigFromDashCfg();
	connectWSDas();
	GetStatus();
}
ChargeDash();

async function readConfigFromDashCfg() {												
	try {
	const response = await fetch('../Dashboard/Dash.cfg');							 
	  const configText = await response.text();
	  const match = configText.match(/ip_server\s*=\s*(.+)/);							
	  
	  if (match) {																		
		ip_server = match[1];	
		console.log('Dirección IP del servidor leída desde Dash.cfg:', ip_server);
	  } else {
		console.error('No se encontró la configuración de ip_server en Dash.cfg');
	  }
	} catch (error) {
	  console.error('Error al leer la configuración desde Dash.cfg:', error);
	}
  }
  
//--------Websocket---------//
var idDash = BigInt(Math.floor(Math.random() * 10000)); //Id del Dashboard

function SendRequestDas(request){
	var json = {"id":(idDash).toString()};
	json = {...json, ...JSON.parse(request)};
	json = JSON.stringify(json);
	idDash = (idDash+1n) & 0xFFFFFFFFn;
	if(!(socketDash.readyState == WebSocket.OPEN)) return -1;
	socketDash.send(json);
	return 0;
}

function ProcessMSGDas(msg) {
	var response = JSON.parse(msg);
	var data = JSON.parse(DecodeResponse(response["data"]));
	let res;
	switch(data["info"]){
		case "ResultadoReadFile":
			switch(data["type"]){
				case "cfg":
					paramsDas = FillParams(DecodeBase64(data["content"]));
					document.getElementById("dashversion").innerHTML = paramsDas["version"];
				break;
			}
			break;
		case "ResultadoGetStatus":
			res = data["status"];
			EAStatus = BigInt(res);
			ActualizaStatus();
		break;
	}
}

const Keyboard = {
	elements: {
		main: null,
		keysContainer: null,
		keys: []
	},

	eventHandlers: {
		oninput: null,
		onclose: null
	},

	properties: {
		value: "",
		capsLock: false
	},

	init() {
		// Create main elements
		this.elements.keysContainer = document.createElement("div");

		// Setup main elements
		this.elements.main = document.getElementById("DshKeyboard");
		this.elements.keysContainer.classList.add("keyboard__keys");
		this.elements.keysContainer.appendChild(this._createKeys());

		this.elements.keys = this.elements.keysContainer.querySelectorAll(".keyboard__key");

		// Add to DOM
		this.elements.main.appendChild(this.elements.keysContainer);
		
		// Automatically use keyboard for elements with .use-keyboard-input
		
		document.querySelectorAll("input").forEach(element => {
			if(element.type == "text"){
				element.addEventListener("focus", () => {
					this.open(element.value, currentValue => {
						element.value = currentValue;
					});
				});
			}
		});
	},

	_createKeys() {
		const fragment = document.createDocumentFragment();
		const keyLayout = [
			"1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "backspace",
			"q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
			"caps", "a", "s", "d", "f", "g", "h", "j", "k", "l", "enter",
			"done", "z", "x", "c", "v", "b", "n", "m", ",", ".", "?",
			"space"
		];

		// Creates HTML for an icon
		const createIconHTML = (icon_name) => {
			return `<i class="material-icons">${icon_name}</i>`;
		};

		keyLayout.forEach(key => {
			const keyElement = document.createElement("button");
			const insertLineBreak = ["backspace", "p", "enter", "?"].indexOf(key) !== -1;

			// Add attributes/classes
			keyElement.setAttribute("type", "button");
			keyElement.classList.add("keyboard__key");

			switch (key) {
				case "backspace":
					keyElement.classList.add("keyboard__key--wide");
					keyElement.innerHTML = createIconHTML("backspace");

					keyElement.addEventListener("click", () => {
						this.properties.value = this.properties.value.substring(0, this.properties.value.length - 1);
						this._triggerEvent("oninput");
					});

					break;

				case "caps":
					keyElement.classList.add("keyboard__key--wide", "keyboard__key--activatable");
					keyElement.innerHTML = createIconHTML("keyboard_capslock");

					keyElement.addEventListener("click", () => {
						this._toggleCapsLock();
						keyElement.classList.toggle("keyboard__key--active", this.properties.capsLock);
					});

					break;

				case "enter":
					keyElement.classList.add("keyboard__key--wide");
					keyElement.innerHTML = createIconHTML("keyboard_return");

					keyElement.addEventListener("click", () => {
						this.properties.value += "\n";
						this._triggerEvent("oninput");
					});

					break;

				case "space":
					keyElement.classList.add("keyboard__key--extra-wide");
					keyElement.innerHTML = createIconHTML("space_bar");

					keyElement.addEventListener("click", () => {
						this.properties.value += " ";
						this._triggerEvent("oninput");
					});

					break;

				case "done":
					keyElement.classList.add("keyboard__key--wide", "keyboard__key--dark");
					keyElement.innerHTML = createIconHTML("check_circle");

					keyElement.addEventListener("click", () => {
						this.close();
						this._triggerEvent("onclose");
					});

					break;

				default:
					keyElement.textContent = key.toLowerCase();

					keyElement.addEventListener("click", () => {
						this.properties.value += this.properties.capsLock ? key.toUpperCase() : key.toLowerCase();
						this._triggerEvent("oninput");
					});

					break;
			}

			fragment.appendChild(keyElement);

			if (insertLineBreak) {
				fragment.appendChild(document.createElement("br"));
			}
		});

		return fragment;
	},

	_triggerEvent(handlerName) {
		if (typeof this.eventHandlers[handlerName] == "function") {
			this.eventHandlers[handlerName](this.properties.value);
		}
	},

	_toggleCapsLock() {
		this.properties.capsLock = !this.properties.capsLock;

		for (const key of this.elements.keys) {
			if (key.childElementCount === 0) {
				key.textContent = this.properties.capsLock ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
			}
		}
	},

	open(initialValue, oninput, onclose) {
		if(IsTactil){
			this.properties.value = initialValue || "";
			this.eventHandlers.oninput = oninput;
			this.eventHandlers.onclose = onclose;
			this.elements.main.classList.remove("keyboard--hidden");
		}
	},

	close() {
		this.properties.value = "";
		this.eventHandlers.oninput = oninput;
		this.eventHandlers.onclose = onclose;
		this.elements.main.classList.add("keyboard--hidden");
	}
};

async function OpenDashboard(event){
	SendRequestDas('{"info":"Name", "Name": "Dashboard"}');
	await new Promise(r => setTimeout(r, 100));
	SendRequestDas('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Dash.cfg", "type":"cfg"}');
	await new Promise(r => setTimeout(r, 100));
	SendRequestDas('{"info":"GetStatus"}');
	if(paramsDas["uieditor"] == "1") document.getElementById("pUIEditor").style.display = "";

	AdminUI = CreateAdminUI(ip_server); 
	window.AdminUI = AdminUI;

	Reports = CreateReports(ip_server);
	window.Reports = Reports;

	UIEditor = CreateUIEditor(ip_server);
	window.UIEditor = UIEditor;

	while(!UIEditor.isInit() || !Reports.isInit() || !AdminUI.isInit()){
		await new Promise(r => setTimeout(r, 500));
	}
	Keyboard.init();
}

async function connectWSDas(){
	socketDash = new WebSocket('ws://' + ip_server);
	
	// Connection opened
	socketDash.addEventListener('open', async function(event) {OpenDashboard(event.data)});
	
	socketDash.addEventListener('close', async function(event) {
		/*setTimeout(function() {
			connectWSDas(event.data);
		}, 1000);*/
	});
	
	// Listen for messages
	socketDash.addEventListener('message', async function(event){
		ProcessMSGDas(event.data);
	});
}

//--------Change App--------//
var Body_style = {}; //Almacena el estilo del body de una App en el momento en el que su pestaña pasada de visible a none
function changeApp(div){
	if(document.getElementById(div.id.substring(1)).style.display == 'block') return -1;
	var id = div.id.substring(1);
	var apps = document.getElementById("AppOptions").children;
	for(let i=0;i<apps.length;i++){
		apps[i].src = "images/"+apps[i].id.substring(1)+".png"
		apps[i].onmouseover = () => { apps[i].src = "images/"+apps[i].id.substring(1)+"H.png"; }
		apps[i].onmouseout = () => { apps[i].src ="images/"+apps[i].id.substring(1)+".png"; }
		if(document.getElementById(apps[i].id.substring(1)).style.display == 'block') {Body_style[apps[i].id] = document.body.style.cssText;}
		document.getElementById(apps[i].id.substring(1)).style.display = 'none';
	}
	document.getElementById(id).style.display = 'block';
	document.getElementById(div.id).src = "images/"+id+"H.png";
	document.getElementById(div.id).onmouseover = "";
	document.getElementById(div.id).onmouseout = "";
	if(Body_style[div.id]) document.body.style = Body_style[div.id]; //Se pone el estilo del body en el momento que se ocultó la pestaña

	//Orientación impresión. AdminUI-Vertical, Reports-Horizontal
	if((id=='Reports')) {
		document.getElementById("styleDash").innerHTML = "@page{size: landscape;"
		document.getElementById("boton_ChangeDefects").setAttribute('onclick', "Reports.ChangeDefects()");
	}
	else if((id=='AdminUI')){
		document.getElementById("styleDash").innerHTML = "@page{size: portrait;"
		document.getElementById("boton_ChangeDefects").setAttribute('onclick', "AdminUI.ChangeDefects()");
	}
}


//---------STATUS----------//
function ActualizaStatus(){
	(EAStatus & 0b100n) ? document.getElementById("StatusPLC").src = "images/PLCOK.png" : document.getElementById("StatusPLC").src = "images/PLCnOK.png";
	(EAStatus & 0b010n) ? document.getElementById("StatusLED").src = "images/LEDOK.png" : document.getElementById("StatusLED").src = "images/LEDnOK.png";
	(EAStatus & 0b001n) ? document.getElementById("StatusSYS").src = "images/SYSOK.png" : document.getElementById("StatusSYS").src = "images/SYSnOK.png";
}

async function GetStatus(){
	while(true){
		await new Promise(r => setTimeout(r, 30000));
		SendRequestDas('{"info":"GetStatus"}');
	}
}



window.changeApp = changeApp;