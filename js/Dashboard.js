var ip_server = "10.3.29.30:8192";
var paramsDas = {};
var EAStatus = 7n; //Status del sistema actual
var socketDash;

import {CreateAdminUI} from '../Apps/AdminUI/js/AdminUI.js';
import {CreateUIEditor} from '../Apps/UIEditor/js/UIEditor.js';


//--------Init Dash---------//
var AdminUI; 
var Reports;
var UIEditor;

async function ChargeDash(){
	connectWSDas();
	GetStatus();
}
ChargeDash();

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
}

async function connectWSDas(){
	socketDash = new WebSocket('ws://' + ip_server);
	
	// Connection opened
	socketDash.addEventListener('open', async function(event) {OpenDashboard(event.data)});
	
	socketDash.addEventListener('close', async function(event) {
		setTimeout(function() {
			connectWSDas();
		}, 1000);
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