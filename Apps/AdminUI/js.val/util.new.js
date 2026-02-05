console.log("util.js cargado - versión DEBUG");

function DecodeResponse(base64) {
	var binary_string =  window.atob(base64);
	var len = binary_string.length;
	var bytes = new Uint8Array(len);
	for (var i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return new TextDecoder("utf-16").decode(new Uint16Array(pako.inflate(bytes.buffer)));
}

function FillParams(text){
	let params = {};
	let lines = text.replace(/ /g, "").trim().split('\n');
	let token = [];
	for(let i=0;i<lines.length;i++){
		if(lines[i].includes('=') && !lines[i].includes(';')){
			token = lines[i].split('=');
			params[token[0]] = token[1];
		}
	}
	return params;
}

function SetTranslate(text){
	let MSG = {};
	let lines = text.split('\n');
	console.log("Total líneas:", lines.length);
	
	for(var i=0;i<lines.length;i++){
		if(lines[i]=='[HTML]') {
			console.log("Encontrado [HTML] en línea", i);
			break;
		}
		if(lines[i].includes('"')) {
			token = lines[i].substring(lines[i].indexOf('"')+1,lines[i].indexOf('"',lines[i].indexOf('"')+1));
			MSG[i+1] = token;
		}
	}
	
	console.log("Valor de i después del primer bucle:", i);
	console.log("¿Continuará el segundo bucle?", i < lines.length);
	
	let key;
	let pos1,pos2;
	for(;i<lines.length;i++){
		if(lines[i].includes('"')) {
			pos1 = lines[i].indexOf('"',0)+1;
			pos2 = lines[i].indexOf('"',pos1);
			key = lines[i].substring(pos1,pos2);
			pos1 = lines[i].indexOf('"',pos2+1)+1;
			pos2 = lines[i].indexOf('"',pos1);
			token = lines[i].substring(pos1,pos2);
			console.log("Guardando en MSG:", key, "=", token);
			MSG[key] = token;
			if(document.getElementById(key)) {
				document.getElementById(key).innerHTML = token;
			}
		}
	}
	console.log("MSG final antes de return:", MSG);
	return MSG;
}

	function DecodeBase64(str) {return decodeURIComponent(escape(window.atob(str)));}