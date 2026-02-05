const CreateUIEditor = (ip_server) => {
	var APPSCALE = 0.5;
	var ZONA;var MODEL;var RLINE;var UI;var PAINTING = false; var adminMode=false;
	var SCREEN = { "offsetTop" : 205, "offsetLeft" : 480,"offsetHeight" : 540,"offsetWidth" : 960 };
	var abrevPlanta;
	var params = {};
	var MSG = {};
	var UITMPLS = {};
	var EditorMode = 0; // 0 - Pantallas, 1 - Symbolos
	var MODELS = [];
	var MODELSJ3D = [];
	let pathimgs = "C:/J3D/UI/images/"
	var DEFPOS = [  {"top" : 900 , "left" : 0    , "scale" : 0.167, "angle" : 0},
					{"top" : 900 , "left" : 320  , "scale" : 0.167, "angle" : 0},
					{"top" : 900 , "left" : 640  , "scale" : 0.167, "angle" : 0},
					{"top" : 900 , "left" : 960  , "scale" : 0.167, "angle" : 0},
					{"top" : 900 , "left" : 1280 , "scale" : 0.167, "angle" : 0},
					{"top" : 900 , "left" : 1600 , "scale" : 0.167, "angle" : 0}];
	var UIcpy = {}; // UI copiada
	var IMGSMZ = {};
	var UIS = {};
	var newUIS = [];
	var IMGS = {};
	var INFOUIS = {};
	var CFGS = [];
	var INFODUMMY = {
		"id_inspeccion_0": "123456","fecha_0": "2023-05-11" ,"relai_0": "1234" ,"badge_0": "123456","vis_0": "12345678",
		"vuelta_0": "0","linea_origen_0": "1","modelo_0": "cambiar","codigo_modelo_0": "cambiar","color1_0": "",
		"codigo_color1_0": "","color_web1_0": "","color2_0": "","codigo_color2_0": "","color_web2_0": "" ,"variante_0": "0" ,
		"id_inspeccion_1": "789012","fecha_1": "2023-05-11" ,"relai_1": "7890" ,"badge_1": "789012","vis_1": "78901234",
		"vuelta_1": "0","linea_origen_1": "1","modelo_1": "cambiar","codigo_modelo_1": "cambiar","color1_1": ""
		,"codigo_color1_1": "","color_web1_1": "","color2_1": "","codigo_color2_1": "" ,"color_web2_1": "" ,"variante_1": "0" ,
		"display_cars_0": "inline","n_cars_0": "100","cars_limit_0": "100","display_hours_0": "none","hours_limit_0": "0",
		"display_all_colors_0": "inline","colorR_0": " ","color_webR_0": "0","display_color_webR_0": "none"
	};
	let MOD2CODE = {}; // (Modelo, codigo de modelo)
	var UIONFLY = {}; // UI que se está modificando
	var init = false; 	//Variable que determina si los reports se ha inicializado ya
	var socket; 	//Socket de los reportes
	var requests = {};	//Peticiones del admin
	var idreq = BigInt(Math.floor(Math.random() * 10000)); //Id del Admin
	var Timeout = 10000 //Ms de timeout de las requests que manda
	var InfoPlanta = {}; // Información de la planta
	
	//------------WEBSOCKET---------------//
	function SendRequest(request){
		var json = {"id":(idreq).toString()};
		json = {...json, ...JSON.parse(request)};
		json = JSON.stringify(json);
		requests[idreq] = {date:new Date(), request: json};
		idreq = (idreq+1n) & 0xFFFFFFFFn;
		if(!(socket.readyState == WebSocket.OPEN)) return -1;
		socket.send(json);
		return 0;
	}

	function ProcessTimeOut(data){delete requests[data["id"]];}

	async function CheckRequest(){
		while(true){
			for(const id in requests){
				if((new Date() - requests[id].date) > Timeout){
					ProcessTimeOut(JSON.parse(requests[id].request));
				}
			}
			await new Promise(r => setTimeout(r, 1000));
		}
	}
	
	function FillTemplate(UI, tmpl, SVG0 = 0){
		let vars = [];
		let aux_vars = tmpl.split("%%");
		for (let i = 1; i<aux_vars.length; i = i + 2){
			vars.push(aux_vars[i]);
		}
		for(let i=0;i<vars.length;i++){
			if(vars[i] == "svg_0"){
				if(SVG0 == 0) {tmpl = tmpl.replace("%%" + vars[i] + "%%", "");}
				else {tmpl = tmpl.replace("%%" + vars[i] + "%%", getSVGFromUI(UI, 0));}
			}else if(vars[i] == "svg_1"){
				tmpl = tmpl.replace("%%" + vars[i] + "%%", getSVGFromUI(UI, 0));
			}else if(vars[i] == "svgR_0"){
				if(UI != 'R') {tmpl = tmpl.replace("%%" + vars[i] + "%%",  getSVGFromUI(IMGS[MODEL][0]['R'], 0));}
				else {tmpl = tmpl.replace("%%" + vars[i] + "%%", getSVGFromUI({}, 0));}
			}else{
				if(INFODUMMY[vars[i]]) {tmpl = tmpl.replace("%%" + vars[i] + "%%", INFODUMMY[vars[i]]);}
				else {tmpl = tmpl.replace("%%" + vars[i] + "%%", "--");}
			}
		}
		tmpl += "<style>*{cursor: auto !important;}</style>";
		return tmpl;
	}

	function ProcessMSG(msg) {
		var response = JSON.parse(msg);
		var data = JSON.parse(DecodeResponse(response["data"]));

		delete requests[response["id"]];
		let res;
		
		switch(data["info"]){
			case "ResultadoReadFile":
				switch(data["type"]){
					case "html":
						document.getElementById("UIEditor").innerHTML = DecodeBase64(data["content"]);
						SendRequest('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/UIEditor/version","type":"version"}');
					break;
					case "version":
						document.getElementById("uieditorversion").innerHTML = DecodeBase64(data["content"]);
						SendRequest('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/UIEditor/UIEditor.cfg","type":"cfg"}');
					break;
					case "cfg":
						params = FillParams(DecodeBase64(data["content"]));
						SendRequest('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/UIEditor/translation/'+ params['Language'] +'.lang", "type":"translation"}');
					break;
					case "translation":
						MSG = SetTranslate(DecodeBase64(data["content"]));
						Init();
					break;
				}
			break;
			case "ResultadoInfoPlanta":
				InfoPlanta = data;
				SendRequest('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/UIEditor/UIEditor.html","type":"html"}');
			break;
			case "UIEditor":
				switch(data["action"]){
					case "0":
						UITMPLS["0"] = DecodeBase64(data["tmpls"]["0"]).replaceAll('"', "'");
						UITMPLS["1"] = DecodeBase64(data["tmpls"]["1"]).replaceAll('"', "'");
						UITMPLS["2"] = DecodeBase64(data["tmpls"]["2"]).replaceAll('"', "'");
						UITMPLS["3"] = DecodeBase64(data["tmpls"]["3"]).replaceAll('"', "'");
						CFGS = data["cfgs"];
						ChargeCFGs();
						onChangeCFG();
						break;
					case "1":						
						// Se reciben la información del uicfg actual y se rellena la información necesaria
						ChargeUIcfg(data["uicfg"], data["uis"]);
					break;
					case "2":
						if(data["err"] == 0){
							CFGS.push(data["name"]);
							ChargeCFGs();
							document.getElementById("p_cfgs").value = decodeURIComponent(escape(data["name"]));
							document.getElementById("SUcfgselec").value = decodeURIComponent(escape(data["name"]));
							ChargeUIcfg(data["uicfg"], data["uis"]);
							showError(MSG[1], true);
						} else showError(MSG[2], false);
					break;
					case "3":
						if(data["err"] == 0){
							showError(MSG[3], true);
							ShowCfgLine();
						} else showError(MSG[4], false);
					break;
					case "4":
						if(data["err"] == 0){
							showError(MSG[5], true);
						} else showError(MSG[6], false);
					break;
					case "5":	
						if(data["ok"]){
							var index = CFGS.indexOf(data["name"]);
							if (index !== -1) {CFGS.splice(index, 1);}
							ChargeCFGs();
							showError(MSG[7], true);
						} else showError(MSG[8], false);
					break;
					case "6":	
						InitSymbolEditor(data);
					break;
					case "7":	
						let svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="'+ SCREEN.offsetWidth + '" height="'+ SCREEN.offsetHeight + '">';
						svg += '<g transform="translate(0,0)  rotate(0,0,0) scale('  + SCREEN.offsetWidth / 1920 + ')">';
						svg +=  DecodeBase64(data["svg"]) + "</g><svg>";
						document.getElementById('symbolscreen').innerHTML = svg;
					break;
					case "8":	
						showError(MSG[9], true);
					break;
				}
			break;
		}
	}

	async function OpenUIEditor(event){
		SendRequest('{"info":"Name", "Name": "UIEditor"}');
		await new Promise(r => setTimeout(r, 100));
		if(!init) {SendRequest('{"info":"InfoPlanta"}');}
	}

	async function connectWS(){
		socket = new WebSocket('ws://' + ip_server);
		
		// Connection opened
		socket.addEventListener('open', async function(event) {OpenUIEditor(event.data)});
		
		socket.addEventListener('close', async function(event) {
			setTimeout(function() {
				connectWS();
			}, 1000);
		});
		
		// Listen for messages
		socket.addEventListener('message', async function(event){
			ProcessMSG(event.data);
		});
	}
	
	async function ChargeUIEditor() {
		CheckRequest();
		connectWS();
	}

	//------------INICIALIZACION---------------//
	function Init(){
		abrevPlanta = InfoPlanta.planta.substring(0,3);
		abrevPlanta = abrevPlanta[0].toUpperCase() + abrevPlanta.slice(1);
		
		// Añado los eventos de las imágenes
		let children = document.getElementById('zonas').childNodes;
		document.addEventListener("keydown",(event) => {OnKeyDown(event)},false);
		addEventListener("wheel", (event) => {OnWheel(event);});
		document.getElementById("appuieditor").addEventListener('mousedown', mouseDown, false);


		document.getElementById('UIEactive').addEventListener('mousedown', (event) => {
			ActiveUIEditor(event.altKey && event.ctrlKey && event.shiftKey || adminMode);
		}, false);

		// Inicialización de objetos globales
		InfoPlanta.Modelos.map(m => MOD2CODE[m.modelo] = m.codigo_modelo);
		let imagenes = InfoPlanta["Imagenes"];
		var p_models = document.getElementById("p_models");
		var SUmodelselec = document.getElementById("SUmodelselec");
		for (let i=0; i<imagenes.length; i++) {
			let model = imagenes[i].modelo;
			if(MOD2CODE[model] >= 999) {MODELSJ3D.push(model);}
			else{
				if(MODELS.includes(model)) continue;
				var elem = document.createElement("option");
				var elem2 = document.createElement("option");
				elem.value = model;
				elem.innerHTML = model;
				elem2.value = model;
				elem2.innerHTML = model;
				p_models.appendChild(elem);
				SUmodelselec.appendChild(elem2);
				MODELS.push(model);
				IMGSMZ[model] ={};
			}
		}
		
		for (let i=0; i<InfoPlanta.Colores.length; i++) {
			let color = InfoPlanta.Colores[i];
			if((INFODUMMY["color1_0"].length == 0) && (color.flags & 0x02)){
				INFODUMMY["color1_0"] = INFODUMMY["color1_1"] = color.color;
				INFODUMMY["codigo_color1_0"] = INFODUMMY["codigo_color1_1"] = color.codigo_color;
				INFODUMMY["color_web1_0"] = INFODUMMY["color_web1_1"] = color.color_web;
			}
			
			if((INFODUMMY["color2_0"].length == 0) && (color.flags & 0x04) && (color.color != INFODUMMY["color1_0"])){
				INFODUMMY["color2_0"] = INFODUMMY["color2_1"] = color.color;
				INFODUMMY["codigo_color2_0"] = INFODUMMY["codigo_color2_1"] = color.codigo_color;
				INFODUMMY["color_web2_0"] = INFODUMMY["color_web2_1"] = color.color_web;
			}
		}

		// Relleno estructuras imagenes
		for (let i=0; i<imagenes.length; i++) {
			let img = imagenes[i];
			if(img.id_img[1] != '1') continue;
			let zona = img.id_img[0];
			if(IMGSMZ[img.modelo] == undefined) continue; // Es un modelo J3D
			if(IMGSMZ[img.modelo][zona] == undefined) IMGSMZ[img.modelo][zona] = [];
			if(!IMGSMZ[img.modelo][zona].includes(img.id_img)) IMGSMZ[img.modelo][zona].push(img.id_img);
		}

		// Se consultan las configuraciones que hay ahora mismo
		SendRequest('{"info":"UIEditor", "action":"0"}');
		init = true;
	}

	//------------PAINTING---------------//
	function ActZona(img, zona){
		let div = document.getElementById('szona'+ (zona));
		if(Object.keys(img).length){
			div.src = pathimgs + abrevPlanta + '.' + MODEL + '.' + img["idimg"] + ".png";
			div.style.visibility = 'visible';
			if(OnScreen(zona)) {img["onscreen"] = 1;}
			else {img["onscreen"] = 0;}

			let transform = img["transform"];
			if(!PAINTING && !img["onscreen"]){transform = JSON.parse(JSON.stringify(DEFPOS[zona-1]));img["transform"] = transform;}

			div.style.transform = "translate(" + transform["left"] +"px,"+ transform["top"] +
	"px) rotate("+transform["angle"]+"deg) scale("+transform["scale"] +")";
				
			let ptop = document.getElementById('p_top');
			let pleft = document.getElementById('p_left');
			let pscale = document.getElementById('p_scale');
			let pangle = document.getElementById('p_angle');

			if(img["onscreen"] == "1"){
				let transReal = transToReal(img["transform"], (UI == "R" || UIS[RLINE][UI].type == "2"));
				ptop.value   = Math.round(transReal.top);
				pleft.value  = Math.round(transReal.left);
				pscale.value = transReal.scale.toFixed(2);
				pangle.value = Math.round(transReal.angle) % 360;

				ptop.disabled = false;
				pleft.disabled = false;
				pscale.disabled = false;
				pangle.disabled = false;
			}
			else{
				ptop.value   = "";
				pleft.value  = "";
				pscale.value = "";
				pangle.value = "";
				ptop.disabled = true;
				pleft.disabled = true;
				pscale.disabled = true;
				pangle.disabled = true;
			}
		} else div.style.visibility = 'hidden';
	}
	
	function ActUIType(){
		let type = document.getElementById('p_uitype').value;
		switch(type){
			case "0": // Simple
				document.getElementById("tmplscreen").srcdoc = FillTemplate(UIONFLY, UITMPLS[type]);
				document.getElementById('uidouble').style.display = 'none';
			break;
			case "1": // Doble 1
				document.getElementById("tmplscreen").srcdoc = FillTemplate(UIONFLY, UITMPLS[type]);
				document.getElementById('uidouble').style.left = '960px';
				document.getElementById('uidouble').style.display = 'block';
			break;
			case "2": // Doble 2
				document.getElementById("tmplscreen").srcdoc = FillTemplate(UIONFLY, UITMPLS[type]);
				document.getElementById('uidouble').style.left = '480px';
				document.getElementById('uidouble').style.display = 'block';
			break;
			case "3": 
				document.getElementById("tmplscreen").srcdoc = FillTemplate(UIONFLY, UITMPLS[type]);
				if(UI != 'R'){ // Resumen
					document.getElementById('uidouble').style.left = '960px';
					document.getElementById('uidouble').style.display = 'block';
				} else {        // R
					document.getElementById('uidouble').style.left = '480px';
					document.getElementById('uidouble').style.display = 'block';
				}
			break;
		}
	}

	function ActUIONFLY(){
		// Cambiar scale y type
		INFODUMMY["modelo_0"] = INFODUMMY["modelo_1"] = MODEL;
		INFODUMMY["codigo_modelo_0"] = INFODUMMY["codigo_modelo_1"] = MOD2CODE[MODEL];
		let divuitype = document.getElementById('p_uitype');
		if(UIONFLY.infoui.nui == "R"){
			divuitype.value = 3;
			divuitype.disabled = true;
		}
		else{
			divuitype.disabled = false;
			divuitype.value = UIONFLY.infoui.type;
		}
		
		ActUIType();
		for(let zona = 1; zona<=6;zona++){
			ActZona(UIONFLY.imgs[zona - 1], zona);
		}
	}

	function divMove(e){
		var div = document.getElementById("szona" + ZONA);
		div.style.position = 'absolute';
		let transform = UIONFLY.imgs[ZONA-1]["transform"];
		let A = GetACenter(transform);
		let dleft = e.clientX - A.x;
		let dtop  = e.clientY - A.y;
		transform["left"] = dleft;
		transform["top"] = dtop;
		ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
	}

	function drawImage(ctx, img, x, y, angle = 0, scale = 1){
		ctx.save();
		var sin = Math.sin(angle);   
		var cos = Math.cos(angle);   
		ctx.transform(cos, sin, -sin, cos, x, y);
		ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
		ctx.restore();
	}

	function getZoneClick(x, y){
		let zona = 0;
		let canvas = document.createElement('canvas');
		canvas.width = 1920;
		canvas.height = 1080;
		let ctx = canvas.getContext('2d', { willReadFrequently: true });
		document.getElementById('canvashidden').innerHTML = "";
		for(let i = 6; i > 0; i--) {
			let img = document.getElementById("szona" + i);
			let transform = UIONFLY.imgs[i - 1]["transform"];
			if(transform == undefined) continue;
			drawImage(ctx, img, transform.left,transform.top,transform.angle*(Math.PI/180), transform.scale);
			document.getElementById('canvashidden').append(canvas);
			let opaque = ctx.getImageData(x, y, 1, 1).data[3] != 0;
			if(opaque){
				zona = i;
				break;
			}
		}
		return zona;
	}

	function mouseDown(e) {
		if(!PAINTING){
			let zona = getZoneClick(e.clientX, e.clientY);
			if(zona > 0){
				ZONA = zona;
				var p_imagen = document.getElementById("p_imagen");
				p_imagen.innerHTML = "";
				let imgsmz = IMGSMZ[MODEL][ZONA];
				for(let i = 0;i<imgsmz.length;i++){
					var elem = document.createElement("option");
					elem.value = imgsmz[i];
					elem.innerHTML = imgsmz[i];
					p_imagen.appendChild(elem);
				}
				document.getElementById("p_imagen").value = UIONFLY.imgs[ZONA - 1]["idimg"];
	
				window.addEventListener('mousemove', divMove, true);
				document.getElementById('p_zona').innerHTML = ZONA;

				PAINTING = true;
			}
		}else{
			window.removeEventListener('mousemove', divMove, true);
			PAINTING = false;
			ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
			if(UIONFLY.infoui.type == 1 || UIONFLY.infoui.type == 2) {ActUIType();} // Si es doble se actualiza la pantalla
		}
	}

	function ActiveUIEditor(OK){
		if(document.getElementById("appuieditor").style.display == "none" && OK){
			document.getElementById("appuieditor").style.display = "block";
			document.getElementById("uisorganization").style.display = "none";
			
			adminMode=true;
		} else {document.getElementById("appuieditor").style.display = "none";
		document.getElementById("uisorganization").style.display = "block";}
	}

	function OnKeyDown(event){
		if(PAINTING){
			const keyName = event.key;
			let transform = UIONFLY.imgs[ZONA-1]["transform"];
			let paso = 5;
			switch(keyName){
				case "ArrowUp":
					transform["top"] -= paso;
				break;
				case "ArrowDown":
					transform["top"] += paso;
				break;
				case "ArrowRight":
					transform["left"] += paso;
				break;
				case "ArrowLeft":
					transform["left"] -= paso;
				break;
			}
			ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
		}
	}

	function OnWheel(event){
		if(PAINTING){
			let transform = UIONFLY.imgs[ZONA-1]["transform"];
			if(event.altKey){
				let av = document.getElementById('p_angle').value;
				if(event.deltaY > 0) {av = parseInt(av) + 10;}
				else{av = parseInt(av) - 10;}
				document.getElementById('p_angle').value = (av % 360);
			}else{
				let sv = document.getElementById('p_scale').value;
				if(event.deltaY > 0) {sv = parseFloat(sv) + 0.05;}
				else{sv = parseFloat(sv) - 0.05;}
				if(sv < 0.1){sv = 0.1;}
				document.getElementById('p_scale').value = sv;
			}
			onChangeValue();
			ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
		}
	}

	//------------BOTONES---------------//
	function copyUIconf(){
		UIcpy = JSON.parse(JSON.stringify(IMGS[MODEL][RLINE][UI].imgs));
		Object.keys(UIcpy).forEach(img => {
			if(UIcpy[img].onscreen == "1"){
				UIcpy[img].transform = transToReal(UIcpy[img].transform, (UI == "R" || UIS[RLINE][UI].type == "2")); 
			}
		});
		showError("Configuraci\u00f3n copiada correctamente", true);
	}

	function pasteUIconf(){
		let ok = confirm(MSG[10]);
		if(ok){
			IMGS[MODEL][RLINE][UI].imgs = JSON.parse(JSON.stringify(UIcpy));
			Object.keys(IMGS[MODEL][RLINE][UI].imgs).forEach(img => {
				if(IMGS[MODEL][RLINE][UI].imgs[img].onscreen == "1"){
					IMGS[MODEL][RLINE][UI].imgs[img].transform = transToApp(IMGS[MODEL][RLINE][UI].imgs[img].transform, (UI == "R" || UIS[RLINE][UI].type == "2")); 
				}
			});
			UIONFLY.imgs = IMGS[MODEL][RLINE][UI].imgs;
			showError(MSG[11], true);
			ActUIONFLY();
		}
	}

	function copyAllRLines(){
		let ok = confirm(MSG[12]);
		if(ok){
			let rimgs = JSON.parse(JSON.stringify(IMGS[MODEL][RLINE]));
			Object.keys(UIS).forEach(rline => {
				for(let i = 0;i<UIS[rline].length;i++){
					let ui = UIS[rline][i].nui;
					for(let nimg = 0;nimg < rimgs[ui].imgs.length;nimg++){
						let img = IMGS[MODEL][rline][ui].imgs[nimg];
						if((img["transform"] != undefined) && (rimgs[ui].imgs[nimg]["transform"] != undefined)){
							img["transform"] = JSON.parse(JSON.stringify(rimgs[ui].imgs[nimg]["transform"]));
							img["idimg"] = rimgs[ui].imgs[nimg]["idimg"];
							img["onscreen"] = rimgs[ui].imgs[nimg]["onscreen"];
						}
					}
					IMGS[MODEL][rline][ui].scale = ui.scale;
					IMGS[MODEL][rline][ui].type = ui.type;
				}
			});
			Object.keys(UIS).forEach(rline => {
				for(let i = 0; i<UIS[RLINE].length && i < UIS[rline].length; i++){
					if(UIS[rline][i].nui == UIS[RLINE][i].nui){
						UIS[rline][i] = JSON.parse(JSON.stringify(UIS[RLINE][i]));
					}
				}
			});
		}
		return 0;
	}

	function copyAllModels(){
		let ok = confirm(MSG[13]);
		if(ok){
			let mimgs = JSON.parse(JSON.stringify(IMGS[MODEL]));
			for (let m=0; m<MODELS.length; m++) {
				let model = MODELS[m];
				Object.keys(UIS).forEach(rline => {
					for(let i = 0;i<UIS[rline].length;i++){
						let ui = UIS[rline][i].nui;
						for(let nimg = 0;nimg <mimgs[rline][ui].imgs.length;nimg++){
							let img = IMGS[model][rline][ui].imgs[nimg];
							let newimg = mimgs[rline][ui].imgs[nimg];
							if((img["transform"] != undefined) && (newimg["transform"] != undefined)){
								if(newimg["onscreen"] == "0") {img["onscreen"] = "0";}
								else{
									img["onscreen"] = "1";
									let zona = img.idimg[0];
									if(IMGSMZ[model][zona].includes(newimg.idimg)) {img.idimg = newimg.idimg;}
									else {img.idimg = ParseInt(newimg.idimg[0] + newimg.idimg[1] + "0");}
								}
								img["transform"] = JSON.parse(JSON.stringify(newimg["transform"]));
							}
						}
						IMGS[MODEL][rline][ui].scale = ui.scale;
						IMGS[MODEL][rline][ui].type = ui.type;
					}
				});
			}
		}
	}

	function ActUICFG(){
		let ok = confirm(MSG[14]);
		if(ok){
			let cfg = document.getElementById("p_cfgs").value;
			let imgs = "";
			Object.keys(IMGS).forEach(model => {
				Object.keys(UIS).forEach(rline => {
					for(let i = 0;i<UIS[rline].length;i++){
						let ui = UIS[rline][i].nui;
						Object.keys(IMGS[model][rline][ui].imgs).forEach(nimg =>{
							let img = IMGS[model][rline][ui].imgs[nimg];
							if((img["onscreen"] != undefined) && (img["onscreen"] == "1")){
								let t = transToReal(img.transform, (UIS[rline][i].type == "2" || ui == 'R'));
								t.top  = Math.round(t.top);
								t.left  = Math.round(t.left);
								t.angle = Math.round(t.angle);
								let str = model+','+rline+','+ui+','+img.idimg[0]+','+img.idimg[2]+','+t.top+','+t.left+','+t.scale.toFixed(2)+','+t.angle;
								if(imgs == "") imgs = str;
								else imgs += ';' + str;
							}
						});
					}
				});
			});
			
			let infouis = "";
			Object.keys(UIS).forEach(rline => {
				for(let i = 0; i<UIS[rline].length; i++){
					infouis += (rline+','+UIS[rline][i].nui+','+UIS[rline][i].type + ',' + UIS[rline][i].scale + ';');
				}
			});
			SendRequest('{"info":"UIEditor", "action":"3", "name" : "' + cfg + '", "imgs" : "' + imgs + '", "infouis" : "' + infouis + '"}');
		}

		return 0;
	}

	function ActivarUICFG(){
		let ok = confirm(MSG[15]);
		if(ok){
			let cfg = document.getElementById("p_cfgs").value;
			SendRequest('{"info":"UIEditor", "action":"4", "name" : "' + cfg + '"}');
			console.log("cfg");
			console.log(cfg);
		}
	}

	//------------EVENTOS DE CAMBIO EN INTERFAZ---------------//

	function onChangeValue(){
		let left  = parseInt(document.getElementById('p_left').value);
		let top	  = parseInt(document.getElementById('p_top').value);
		let scale = parseFloat(document.getElementById('p_scale').value);
		if(scale < 0.1){scale = 0.1;}
		let angle = parseInt(document.getElementById('p_angle').value);
		let newtransform = {"top" : top , "left" : left , "scale" : scale, "angle" : angle};
		
		newtransform = transToApp(newtransform, (UI == "R" || UIS[RLINE][UI].type == "2" ));
		let transform = UIONFLY.imgs[ZONA-1]["transform"];

		let A1 = GetACenter(transform);
		let A2 = GetACenter(newtransform);

		if(transform["scale"] != newtransform.scale || transform["angle"] !=  newtransform.angle){
			newtransform.top = newtransform.top - (A2.y - A1.y);
			newtransform.left = newtransform.left - (A2.x - A1.x);
		}

		UIONFLY.imgs[ZONA-1]["transform"] = JSON.parse(JSON.stringify(newtransform));
		ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
	}
	
	function OnChangeImg(){
		UIONFLY.imgs[ZONA - 1]["idimg"] = document.getElementById("p_imagen").value;
		ActZona(UIONFLY.imgs[ZONA - 1],ZONA);
	}
	

	function onChangeModel(){
		MODEL = document.getElementById('p_models').value;
		UIONFLY.imgs = IMGS[MODEL][RLINE][UI].imgs;
		UIONFLY.infoui = UIS[RLINE][UI];
		ActUIONFLY();
	}
	function onChangeRline(){
		RLINE = document.getElementById('p_rlines').value;
		ActSelecUIs();
		UIONFLY.imgs = IMGS[MODEL][RLINE][UI].imgs;
		UIONFLY.infoui = UIS[RLINE][UI];
		ActUIONFLY();
	}
	function onChangeUI(){
		UI = document.getElementById('p_uis').value;
		UIONFLY.imgs = IMGS[MODEL][RLINE][UI].imgs;
		if(UI == 'R') {UIONFLY.infoui = UIS[RLINE][UIS[RLINE].length - 1];}
		else {UIONFLY.infoui = UIS[RLINE][UI];};
		ActUIONFLY();
	}
	function onChangeUItype(){
		let newtype = document.getElementById('p_uitype').value;
		if((UIONFLY.infoui.type == 1 || UIONFLY.infoui.type == 3) && newtype == 2){
			for(let zona = 1; zona<=6;zona++){
				let img = UIONFLY.imgs[zona - 1];
				if(Object.keys(img).length){
					img.transform.left += (960 * APPSCALE);
				}
			}
		}
		if(UIONFLY.infoui.type == 2 && (newtype == 1 || newtype == 3)){
			for(let zona = 1; zona<=6;zona++){
				let img = UIONFLY.imgs[zona - 1];
				if(Object.keys(img).length){img.transform.left -= (960 * APPSCALE);}
			}
		}
		UIONFLY.infoui.type = newtype;
		
		ActUIONFLY();
	}
	
	function onChangeCFG(){
		let cfg = document.getElementById("p_cfgs").value;
		document.getElementById("SUcfgselec").value = cfg;
		if(cfg.length){
			SendRequest('{"info":"UIEditor", "action":"1", "cfg" : "'+cfg+'", "name" : "' + cfg + '"}');
		}
	}

	function SUonChangeCFG(){
		let cfg = document.getElementById("SUcfgselec").value;
		document.getElementById("p_cfgs").value = cfg;
		if(cfg.length){
			SendRequest('{"info":"UIEditor", "action":"1", "cfg" : "'+cfg+'", "name" : "' + cfg + '"}');
		}
	}

	function onChangeHeader(){
		var hwidth = document.getElementById("hwidth");
		var htop = document.getElementById("htop");

		let wvalue = (hwidth.value * APPSCALE);
		let uiheader = document.getElementById("uiheader");
		uiheader.style.height = wvalue + "px";

		let vmaxe = document.getElementById("vmaxe");
		let tvmaxe = 0;
		if(htop.checked){
			uiheader.style.top = (SCREEN.offsetTop) + "px";
			tvmaxe = (SCREEN.offsetHeight + wvalue) / 2;
		}
		else {
			uiheader.style.top = (SCREEN.offsetTop  + SCREEN.offsetHeight - wvalue) + "px";
			tvmaxe = (SCREEN.offsetHeight - wvalue) / 2 ;
		}
		vmaxe.style.top = tvmaxe + "px";
	}

	//------------CREAR NUEVA CONFIGURACIÓN---------------//
	function createNewCFG(){
		let divcfg = document.getElementById("p_cfgs");
		let cfg = document.getElementById("p_newnamecfg").value;
		if(!CFGS.includes(cfg) && newUIS.length){
			SendRequest('{"info":"UIEditor", "action":"2", "name" : "' + cfg + '", "uis" : "' + newUIS + '"}');
			newUIS = [];
			ActUInewList();
		}
	}
	
	function deleteCFG(){
		let cfg = document.getElementById("p_cfgs").value;
		if(cfg.length){
			let ok = confirm(MSG[16]);
			if(ok){ SendRequest('{"info":"UIEditor", "action":"5", "name" : "' + cfg + '"}');}
		}
	}

	function ActUInewList(){
		let l_newuis = document.getElementById("l_newuis").getElementsByTagName('tbody')[0];
		l_newuis.innerHTML = "";
		for(let i = 0; i<newUIS.length;i++){
			var newRow = l_newuis.insertRow();
			if(!(i%2)) {newRow.style.backgroundColor  = '#FFFFFF';}
			else {newRow.style.backgroundColor = '#777777';}
			var repcell = newRow.insertCell();
			repcell.appendChild(document.createTextNode(i));
			var uicell = newRow.insertCell();
			uicell.appendChild(document.createTextNode(newUIS[i]));
		}
	}

	function addNewLine(){
		let nuis = document.getElementById("p_nuis").value;
		if(nuis && !isNaN(nuis) && (newUIS.length < 8)){
			newUIS.push(nuis);
		}
		ActUInewList();
	}

	function delNewLine(){
		newUIS.pop();
		ActUInewList();
	}

	//------------CARGA DE UICFG Y CONFIGURACIONES---------------//
	function ChargeCFGs(){
		let divcfgs = document.getElementById("p_cfgs");
		divcfgs.innerHTML = "";
		for(let i = 0;i<CFGS.length;i++){
			var elem = document.createElement("option");
			elem.value = decodeURIComponent(escape(CFGS[i]));
			elem.innerHTML = decodeURIComponent(escape(CFGS[i]))
			divcfgs.appendChild(elem);
		}
		let SUdivcfgs = document.getElementById("SUcfgselec");
		SUdivcfgs.innerHTML = "";
		for(let i = 0;i<CFGS.length;i++){
			var elem = document.createElement("option");
			elem.value = decodeURIComponent(escape(CFGS[i]));
			elem.innerHTML = decodeURIComponent(escape(CFGS[i]))
			SUdivcfgs.appendChild(elem);
		}
		ActUIType();
	}


	
	function ChargeUIcfg(UICFG, uis){
		IMGS = UICFG;
		UIS = uis;

		for(let m = 0; m<MODELS.length;m++){
			let model = MODELS[m];
			if(IMGS[model] == undefined) IMGS[model] = {};
			Object.keys(UIS).forEach(rline => {
				if(IMGS[model][rline] == undefined) IMGS[model][rline] = {};
				for(let i = 0;i<UIS[rline].length;i++){
					let ui = UIS[rline][i].nui;
					if(IMGS[model][rline][ui] == undefined) IMGS[model][rline][ui] = {"scale" : "1.0", "type" : "0", "imgs" : {}};
					let uiimgs = JSON.parse(JSON.stringify(IMGS[model][rline][ui].imgs));
					let newuiimgs = [{},{},{},{},{},{}];
					Object.keys(IMGSMZ[model]).forEach(zona => {
						newuiimgs[zona-1] = {"idimg" : IMGSMZ[model][zona][0],"onscreen": "0" ,"transform":  JSON.parse(JSON.stringify(DEFPOS[zona-1]))};
					});
					Object.keys(IMGS[model][rline][ui].imgs).forEach(nimg =>{
						let img = IMGS[model][rline][ui].imgs[nimg];
						let zona = img.idimg[0];
						img.idimg = img.idimg[0] + '1' + img.idimg[2]; // Se coge siempre la primera variante
						// Se transforma el left y en sistema de referencia App
						img["transform"] = transToApp(img["transform"], (UIS[rline][i].type == "2") || (ui == 'R'));
						newuiimgs[zona-1] = img;
					});
					IMGS[model][rline][ui].imgs = JSON.parse(JSON.stringify(newuiimgs));
				}
			});
		}

		var p_rlines = document.getElementById("p_rlines");
		p_rlines.innerHTML = "";
		Object.keys(UIS).forEach(rline => {
			var elem = document.createElement("option");
			elem.value = rline;
			elem.innerHTML = rline;
			p_rlines.appendChild(elem);
		});

		// Se añade posición dummy para los modelos J3D
		for(let m = 0; m<MODELSJ3D.length;m++){
			let model = MODELSJ3D[m];
			if(IMGS[model] == undefined) IMGS[model] = {};
			Object.keys(UIS).forEach(rline => {
				if(IMGS[model][rline] == undefined) IMGS[model][rline] = {};
				for(let i = 0;i<UIS[rline].length;i++){
					let ui = UIS[rline][i].nui;
					if(IMGS[model][rline][ui] == undefined) IMGS[model][rline][ui] = {};
					let imgs = IMGS[model][rline][ui].imgs;
					if(IMGS[model][rline][ui].imgs == undefined) IMGS[model][rline][ui].imgs = {};
					if(ui != 'R'){
						IMGS[model][rline][ui].imgs[0] = {"idimg" : "110","onscreen": "1" ,"transform": transToApp({"top":0,"left" : 0,"scale" : 1.0, "angle" : 0})};
					}else{
						IMGS[model][rline][ui].imgs[0] = {"idimg" : "110","onscreen": "1" ,"transform": transToApp({"top":270,"left" : 0,"scale" : 0.5, "angle" : 0})};
					}
				}
			});
		}
		
		MODEL = document.getElementById('p_models').value;
		RLINE = document.getElementById('p_rlines').value;
		ActSelecUIs();


		if(MODEL){
			UIONFLY.imgs = IMGS[MODEL][RLINE][UI].imgs;
			UIONFLY.infoui = UIS[RLINE][UI];
			ActUIONFLY();
		}

		SUChargeUI();
	}

	//-----------EDITOR DE SYMBOLOS---------//
	function InitSymbolEditor(data){
		let bs = document.getElementById("se_symbol");
		bs.innerHTML = "";
		for(let i = 0;i<data.symbols.length;i++){
			var elem = document.createElement("option");
			let n = data.symbols[i].slice(0, -5);
			elem.value = n;
			elem.innerHTML = n;
			bs.appendChild(elem);
		}
		SYMBOLS = data.symbolsUI;

		let bt = document.getElementById("se_types");
		bt.innerHTML = "";
		Object.keys(data.symbolsUI).forEach(type => {
			var elem = document.createElement("option");
			elem.value = type;
			elem.innerHTML = type;
			bt.appendChild(elem);
		});

		let type = document.getElementById("se_types").value;
		symbol = SYMBOLS[type];
		SINFO = data.sinfo;
		ActSymbolInfo();
	}
	
	var SYMBOLS = {};
	var SINFO = {};
	var symbol  = {};
	function ActSymbols(){
		let strsvalues = null;
		Object.keys(SYMBOLS).forEach(symbol =>{
			if (strsvalues != null) strsvalues += ';' + getstrsymbol(SYMBOLS[symbol]);
			else strsvalues = getstrsymbol(SYMBOLS[symbol]);
		});
		if(strsvalues == null) strsvalues = "";
		SendRequest('{"info":"UIEditor", "action":"8", "type" : "' + symbol.type + '", "svalues" : "'+strsvalues+'", "sinfo":"'+getstrsinfo()+'"}');
	}

	function ActSymbolInfo(){
		document.getElementById('se_symbol').value = symbol.symbol.slice(0, -5);
		document.getElementById('se_scale').value = symbol.scale;
		document.getElementById('se_color').value = symbol.color.indexOf('#') >= 0 ? symbol.color : colourNameToHex(symbol.color);
		document.getElementById('se_wcolor').value = symbol.wcolor.indexOf('#') >= 0 ? symbol.wcolor : colourNameToHex(symbol.wcolor);
		document.getElementById('se_scolor').value = symbol.scolor.indexOf('#') >= 0 ? symbol.scolor : colourNameToHex(symbol.scolor);
		document.getElementById('se_bordercolor').value = symbol.bordercolor.indexOf('#') >= 0 ? symbol.bordercolor : colourNameToHex(symbol.bordercolor);
		document.getElementById('se_borderwidth').value = symbol.borderwidth;

		document.getElementById('se_gscale').value = SINFO.gscale;
		document.getElementById('se_fontsize').value = SINFO.fontsize;
		document.getElementById('se_textmargin').value = SINFO.textmargin;

		let strsymbol = getstrsymbol(symbol);
		SendRequest('{"info":"UIEditor", "action":"7", "type" : "' + symbol.type + '", "svalues" : "'+strsymbol+'", "sinfo":"'+getstrsinfo()+'"}');
		return;
	}

	function getstrsymbol(symbol){
		return symbol.type + ',' + symbol.symbol + ',' + symbol.scale + ',' + symbol.color + ',' + symbol.wcolor + ',' + symbol.scolor + ',' + symbol.bordercolor + ',' + symbol.borderwidth;
	}

	function getstrsinfo(){
		return SINFO.gscale + ',' + SINFO.fontsize + ',' + SINFO.textmargin;
	}

	function onChangeSymbolType(){
		let type = document.getElementById("se_types").value;
		symbol = SYMBOLS[type];
		ActSymbolInfo();
	}

	function onChangeSymbolValue(){
		symbol.symbol 	   = document.getElementById('se_symbol').value + '.tsvg';
		symbol.scale 	   = document.getElementById('se_scale').value;
		symbol.color 	   = document.getElementById('se_color').value;
		symbol.wcolor 	   = document.getElementById('se_wcolor').value;
		symbol.scolor 	   = document.getElementById('se_scolor').value;
		symbol.bordercolor = document.getElementById('se_bordercolor').value;
		symbol.borderwidth = document.getElementById('se_borderwidth').value;
		SINFO.gscale = document.getElementById('se_gscale').value;
		SINFO.fontsize = document.getElementById('se_fontsize').value;
		SINFO.textmargin = document.getElementById('se_textmargin').value;

		ActSymbolInfo();
	}

	//------------CAMBIO DE EDITOR----------//
	function ChangeEditor(){
		let bchangeeditor = document.getElementById("bchangeeditor");

		let seditor = document.getElementById('screeneditor');
		if(EditorMode == 0){
			if(Object.keys(SYMBOLS).length === 0){
				SendRequest('{"info":"UIEditor", "action":"6"}');
			}
			seditor.style.display = 'none';
			document.getElementById('symboleditor').style.display = 'block';
			bchangeeditor.src = "images/SymbolEditor.png";
			bchangeeditor.onmouseover = () => { bchangeeditor.src = "images/SymbolEditorH.png"; };
			bchangeeditor.onmouseout = () => { bchangeeditor.src = "images/SymbolEditor.png"; };
			EditorMode = 1;
		}else{
			seditor.style.display = 'block';
			document.getElementById('symboleditor').style.display = 'none';
			bchangeeditor.src = "images/ScreenEditor.png";
			bchangeeditor.onmouseover = () => { bchangeeditor.src = "images/ScreenEditorH.png"; };
			bchangeeditor.onmouseout = () => { bchangeeditor.src = "images/ScreenEditor.png"; };
			EditorMode = 0;
		}
	}


	//---------CAMBIAR ENTRE PANTALLAS---------//
	var SULINE = 0;

    function ShowCfgLine() {
		var nPantallas=0;
		console.log("cfgShow");
		console.log(Object.keys(IMGS[MODEL][SULINE]));
		MODEL = document.getElementById('SUmodelselec').value;
		var SUpantallas = document.getElementById("SUpantallas");
		SUpantallas.innerHTML = "";
		var SUcartelLinea = document.getElementById("SUcartelLinea");
		SUcartelLinea.textContent = MSG[17] + " " + SULINE;
		if(SULINE == 0){nPantallas=(Object.keys(IMGS[MODEL][SULINE]).length)-1;}
		else{nPantallas=(Object.keys(IMGS[MODEL][SULINE]).length);}

		for(let i = 1;i < nPantallas; i++){
			let SUui = {};
			SUui["imgs"]=IMGS[MODEL][SULINE][i].imgs;
			SUui["infoui"]=UIS[SULINE][i];
			let ui = i + 1;
			var div = document.createElement("div");//Aquí creo las pantallas
			div.id = "SUscreen"+ ui;
			div.className = "SUscreen";
			div.style = "position:absolute; top:"+(50+((Math.floor((i-1)/3))*370))+"px;left:"+(30+(((i-1)%3)*550))+"px;display:block";
			SUpantallas.appendChild(div);			
			
			// Crea el texto que indica el numero de pantalla
			var SUnumeroUI = document.createElement("div");
			SUnumeroUI.id = "SUscreenTexto"+ (ui-1);
			SUnumeroUI.className = "SUscreenTexto";
			SUnumeroUI.textContent = "UI " + (ui-1);
			SUnumeroUI.style = "position:absolute; top:"+(12 + ((Math.floor((i-1)/3))*370))+"px;left:"+(225+(((i-1)%3)*550))+"px;display:block";
			SUpantallas.appendChild(SUnumeroUI);			

			// Crea el elemento iframe
			var iframe = document.createElement("iframe");
			iframe.id = "SUiframe"+ ui;
			iframe.width = "1920";
			iframe.height = "1080";
			iframe.title = "UI_"+ui;
			iframe.frameborder = "0";
			iframe.scrolling = "no";
			iframe.style = "position:absolute;left:0px;top:0px;transform:scale(0.27);transform-origin:0 0;z-index:3;";
			div.appendChild(iframe);			// Agrega el iframe al div
			document.getElementById("SUiframe"+ ui).srcdoc = FillTemplate(SUui, UITMPLS[SUui["infoui"].type], 1);

			if(i==nPantallas-1){				//Es para que haya hueco al final (no se porque con el margin-bot no funciona)				
				var espacioUltimaFila = document.createElement("div");
				espacioUltimaFila.id="margen";
				espacioUltimaFila.style = "position:absolute; top:"+(300+50+((Math.floor((i-1)/3))*400))+"px;left:"+(30+(((i-1)%3)*580))+"px;display:block;height:20px;width:20px;";
				SUpantallas.appendChild(espacioUltimaFila);
			}

		}

    }

	function previousCfgLine(){
		SULINE--;
		if(SULINE<0){SULINE = (Object.keys(UIS).length) - 1;}
		ShowCfgLine();		
	}

	function nextCfgLine(){
		SULINE++;
		if(SULINE>=Object.keys(UIS).length){SULINE = 0;}
		ShowCfgLine();		
	}

	
	function SUChargeUI(){
		SULINE=0;
		if(Object.keys(UIS).length > 1){document.getElementById("SUbotones").style.display = "block";}
		else {document.getElementById("SUbotones").style.display = "none";}
		ShowCfgLine();
	}

	//------------AUXILIARES---------------//
	function GetACenter(transform){
		let dx = 1920 * (transform["scale"]) / 2;
		let dy = 1080 * (transform["scale"]) / 2;
		let a = transform["angle"] * Math.PI / 180;
		let x = (dx * Math.cos(a) - dy * Math.sin(a));
		let y = (dx * Math.sin(a) + dy * Math.cos(a));
		return {x, y};
	}

	function transToApp(transform, der){
		var transApp = JSON.parse(JSON.stringify(transform));
		transApp.left = transform.left * APPSCALE + SCREEN.offsetLeft;
		if(der) { transApp.left += (960 * APPSCALE);}
		transApp.top = transform.top * APPSCALE + SCREEN.offsetTop;
		transApp.scale = transform.scale * APPSCALE;
		return transApp;
	}

	function transToReal(transform, der){
		var transReal = JSON.parse(JSON.stringify(transform));
		transReal.left = (transform.left - SCREEN.offsetLeft) / APPSCALE;
		if(der) { transReal.left -= 960;}
		transReal.top = (transform.top - SCREEN.offsetTop) / APPSCALE;
		transReal.scale = transform.scale / APPSCALE;
		return transReal;
	}

	function OnScreen(zona){
		let onscreen = true; 
		let margin   = 50;
		let transform = UIONFLY.imgs[zona-1]["transform"];
		let A = GetACenter(transform);
		let ontop    = (transform["top"]  + A.y) > (SCREEN.offsetTop  - margin);
		let onleft   = (transform["left"] + A.x) > (SCREEN.offsetLeft - margin);
		let onright  = (transform["top"]  + A.y) < (SCREEN.offsetTop  + SCREEN.offsetHeight + margin);
		let onbottom = (transform["left"] + A.x) < (SCREEN.offsetLeft + SCREEN.offsetWidth  + margin);
		if (!ontop || !onleft || !onright || !onbottom){onscreen = false;}
		return onscreen;
	}

	function ActSelecUIs(){
		var p_uis = document.getElementById("p_uis");
		p_uis.innerHTML = "";
		for(let i = 0;i<UIS[RLINE].length;i++){
			if(UIS[RLINE][i].nui == "0") { continue;}
			var elem = document.createElement("option");
			elem.value = UIS[RLINE][i].nui;
			elem.innerHTML = UIS[RLINE][i].nui;
			p_uis.appendChild(elem);
		}
		UI = document.getElementById('p_uis').value;
	}

	function showError(msg, ok){
		let cartel = document.getElementById("CshowError");
		cartel.style.visibility = "visible";
		cartel.innerHTML = msg;
		let seconds = 1500;
		if(ok){
			cartel.style.background = "#4fdb7c";
			cartel.style.color = "black";
		}else{
			cartel.style.background = "#e92d3a";
			cartel.style.color = "white";
			seconds = 4000;
		}

		setTimeout(function(){
			document.getElementById("CshowError").style.visibility = "hidden";
		}, seconds)
	}

	function getSVGFromUI(UI, randomcuadros){
		let svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" ' + 
		'width="1920" height="1080" style="background-color: black">' +
		'<style>.level1 { fill:#FAC1B9; fill-opacity: .7}.level2 { fill:#F58B7B; fill-opacity: .7}' +
		'.level3 { fill:#F2644F; fill-opacity: .7}.level4 { fill:#A21B08; fill-opacity: .7}.level5 { fill:#510E04; fill-opacity: .7}	                                                                                                              ' +
		'.level6 { fill:#A907FF; fill-opacity: .7}</style>';
		if(Object.keys(UI).length){
			for(let zona = 1; zona<=6;zona++){
				let img = UI.imgs[zona - 1];
				if(Object.keys(img).length && img["onscreen"] == 1){
					// Si UI.infoui es undefined significa que es la pantalla R
					let transform = transToReal(img["transform"], (UI.infoui == undefined) || (UI.infoui.type == 2));
					let nimg = abrevPlanta + '.' + MODEL + '.' + img["idimg"] + ".png";
					let pathimg = pathimgs + nimg;
					let stransform = "translate(" + transform["left"]+","+ transform["top"] +
					") rotate("+transform["angle"]+", 0, 0) scale("+transform["scale"] +")";
					svg += '<g class="zone0'+zona+'" transform="'+stransform+'"><g>' +
								'<image width="1920" height="1080" xlink:href="'+pathimg+'"></image><g mask="url(#'+nimg+')"> +                                                                                                                                                     ' +
								'<mask id="'+nimg+'"><image width="1920" height="1080" href="'+pathimg+'"></image></mask> ';
					for(let i = 0; i<randomcuadros;i++){
						let level = Math.floor(Math.random() * 6) + 1;
						let x = Math.floor(Math.random() * 32) * 60;
						let y = Math.floor(Math.random() * 18) * 60;
						svg += '<rect id="hm01_168" class="level'+level+'" x="'+x+'" y="'+y+'" width="60" height="60"></rect>';
					}
					svg += '</g></g></g>';
				}
			}
		}
		return svg + '</svg>';
	}

	function colourNameToHex(colour)
	{
		var colours = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
		"beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
		"cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
		"darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
		"darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
		"darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
		"firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
		"gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
		"honeydew":"#f0fff0","hotpink":"#ff69b4",
		"indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
		"lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
		"lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
		"lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
		"magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
		"mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
		"navajowhite":"#ffdead","navy":"#000080",
		"oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
		"palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
		"rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
		"saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
		"tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
		"violet":"#ee82ee",
		"wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
		"yellow":"#ffff00","yellowgreen":"#9acd32"};

		if (typeof colours[colour.toLowerCase()] != 'undefined')
			return colours[colour.toLowerCase()];
		return false;
	}


	ChargeUIEditor();
	return{
		onChangeValue,
		OnChangeImg,
		onChangeRline,
		onChangeUI,
		onChangeModel,
		onChangeHeader,
		onChangeCFG,
		addNewLine,
		delNewLine,
		deleteCFG,
		createNewCFG,
		ActUICFG,
		copyAllRLines,
		copyAllModels,
		ActivarUICFG,
		copyUIconf,
		pasteUIconf,
		ChangeEditor,
		onChangeSymbolValue,
		onChangeSymbolType,
		ActSymbols,
		onChangeUItype,
		ShowCfgLine,
		nextCfgLine,
		previousCfgLine,
		SUonChangeCFG,
		SUChargeUI
	}
};

export { CreateUIEditor };