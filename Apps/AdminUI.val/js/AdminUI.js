/*
	Para crear un AdminUI es necesario tener un div con un id = AdminUI
*/

import * as THREE from './module3d.js'

const CreateAdminUI = (ip_server) => {

	//-------VARIABLES GLOBALES---------//
	var FLAG_SCREENBLOB = 0x1n;
	var FLAG_WEIGHTDEFECTS  = 0x2n;
	var FLAG_BLOBRAWDEFECTS  = 0x8n;
	var FLAG_FILTERRAWDEFECTS  = 0x10n;
	var FLAG_SHOWDISCARDEDRAWDEFECTS  = 0x20n;
	var UITEXT_WEIGHT   = 0x1n;
	var UITEXT_SIZE     = 0x2n;
	var mode = FLAG_SCREENBLOB; // Por defecto se muestran los defectos de FLAG_SCREENBLOB (Si se quieren los defectos del blob añadir el flag FLAG_SCREENBLOB)
	var UImode = UITEXT_SIZE | UITEXT_WEIGHT; // Flags librería de UIs, cuando se muestra defectos de peso se muestra solo peso, y en tamaño se muestra peso y tamaño

	var InfoPlanta = {}; // Información de la planta
	var paramsAdm = {}; //Parámetros del AdminUI que salen del archivo de configuracion
	var MSGAdm = {};
	var AdmTemplates = {};  //Templates del Admin, se cargan al iniciar la App
	var coche_zoom; //Es el coche que está abierto en el zoom
	var coche_3d; //Es el coche que está abierto en el 3d
	var coche_guardado; //Se almacena la información del coche que se ha mandado a guardar
	var zona_zoom = 0; //Almacena la zona del coche que se muestra en el zoom
	var n_pagina_coches = 0; //Variable que sirve para controlar que coches se estan mostrando en cada pagina de resultados
	var coches_por_pagina = 5; //Numero de coches que hay en la pagina de busqueda
	var coches_encontrados = []; //Array de los ids de inspeccion que hay en la búsqueda que se ha hecho
	var info_coches = {};	//Guarda un mapa con toda la información necesaria para que se muestren los coches en pantalla
	var colores1 = []; 	//Colores 1
	var colores2 = []; 	//Colores 2
	var MapModels = {}; // (modelo, (variante, codigo_variante)))
	var gflagsModel = {}; // (modelo, (mascaras, flags para esta máscara))
	var RepLines = []; // Lineas de reparación
	var REPARACION = 1 // 0-Inspeccion; 1- Reparacion (Variable global para controlar los coches que aparecen en la principal)
	var ultimas_inspecciones = [] //Se almencenan las inspecciones que estan actualmente en la pantalla principal
	var ultimas_inspeccionesREP = []; //Inspecciones REPARACION
	var ultimas_inspeccionesINSP = []; //Inspecciones INSPECCION
	var IDIMG = {};					   // Id de las imágenes por modelo y variante
	var ChangeBoton = false; // Sirve para saber para forzar que cuando se cambie de Modo, no aparezca el coche como si acabara de llegar
							// Esto no esta del todo bien hecho, pero no quiero complicar todo
	var PRINTING = false;
	var abrevPlanta;
	var init = false; //Variable que determina si el Admin se ha inicializado ya
	var socketAdmin; //Socket del Admin
	var requestsAdmin = {};	//Peticiones del admin
	var idAdm = BigInt(Math.floor(Math.random() * 10000)); //Id del Admin
	var TimeoutAdmin = 15000 //Ms de timeout de las requests que manda
	var AutoPrint = false;
	

	//------------WEBSOCKET---------------//
	function SendRequestAdm(request){
		var json = {"id":(idAdm).toString()};
		json = {...json, ...JSON.parse(request)};
		json = JSON.stringify(json);
		requestsAdmin[idAdm] = {date:new Date(), request: json};
		idAdm = (idAdm+1n) & 0xFFFFFFFFn;
		if(!(socketAdmin.readyState == WebSocket.OPEN)) return -1;
		socketAdmin.send(json);
		return 0;
	}

	function ProcessTimeOutAdm(data){
		switch(data["info"]){
			case "ActualizaAdmin":
			case "ActualizaPaginaResultados":
			case "Busqueda":
				document.getElementById('imagen_cargando').style.visibility = "hidden";
				CerrarResultados();
			break;
			case "SaveCar":
				Do_guardar(0);
			break;
			case "InfoPlanta":
			break;
			case "GetLastCars":
			break;
			case "Name":
			break;
			case "GetTemplatesAdminUI":
			break;
			case "Get3dDefects":
				closeview3d();
			break;
		}
		delete requestsAdmin[data["id"]];
	}

	async function CheckRequestAdm(){
		while(true){
			for(const id in requestsAdmin){
				if((new Date() - requestsAdmin[id].date) > TimeoutAdmin){
					ProcessTimeOutAdm(JSON.parse(requestsAdmin[id].request));
				}
			}
			await new Promise(r => setTimeout(r, 1000));
		}
	}

	function ProcessMSGAdmin(msg) {
		var response = JSON.parse(msg);
		var data = JSON.parse(DecodeResponse(response["data"]));
		delete requestsAdmin[response["id"]];
		let res;
		switch(data["info"]){
			case "ResultadoReadFile":
				switch(data["type"]){
					case "html":
						document.getElementById("AdminUI").innerHTML = DecodeBase64(data["content"]);
						SendRequestAdm('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/AdminUI/version","type":"version"}');
					break;
					case "version":
						document.getElementById("adminversion").innerHTML = DecodeBase64(data["content"]);
						abrevPlanta = InfoPlanta.planta.substring(0,3);
						abrevPlanta = abrevPlanta[0].toUpperCase() + abrevPlanta.slice(1);
						SendRequestAdm('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/AdminUI/'+ abrevPlanta +'.AdminUI.cfg","type":"cfg"}');
					break;
					case "cfg":
						paramsAdm = FillParams(DecodeBase64(data["content"]));
						SendRequestAdm('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/AdminUI/translation/'+ paramsAdm['Language'] +'.lang", "type":"translation"}');
					break;
					case "translation":
						MSGAdm = SetTranslate(DecodeBase64(data["content"]));
						Inicilizar(); //Inicializar Admin
						init = true;
					break;
				}
			break;
			case "ResultadoInfoPlanta":
				InfoPlanta = data;
				SendRequestAdm('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/AdminUI/AdminUI.html","type":"html"}');
			break;
			case "ResultadoGetTemplatesAdminUI":
				for(const key in data){
					if(key != "info") {
						AdmTemplates[key.substring(0,key.indexOf('.'))] = DecodeBase64(data[key]);
					}
				}
			break;
			case "ResultadoBusqueda":
				coches_encontrados = data["data"];
				GetInfoPaginaResultados();
			break;
			case "ResultadoActualizaPaginaResultados":
				res = data["infoCars"];
				for(let i=0;i<res.length;i++) {info_coches[res[i].id_inspeccion] = res[i];}
				if(!res[0] || coches_encontrados[n_pagina_coches * coches_por_pagina] == res[0].id_inspeccion){
					ActulizaPaginaResultados();
					MuestraResultados();
				}else{
					document.getElementById('imagen_cargando').style.visibility = "visible";
					document.getElementById("Busquedas").style.display = 'none';
				}
			break;
			case "ResultadoGetLastCars":
				for(let i=0;i<data["infoCars"].length;i++) {info_coches[data["infoCars"][i].id_inspeccion] = data["infoCars"][i];}
				ProcessLastCars(ChangeBoton, data["infoCars"].reverse());
			break;
			case "ResultadoActualizaAdmin":
				for(let i=0;i<data["LastCars"].length;i++) {info_coches[data["LastCars"][i].id_inspeccion] = data["LastCars"][i];}
				for(let i=0;i<data["CarsRes"].length;i++) {info_coches[data["CarsRes"][i].id_inspeccion] = data["CarsRes"][i];}
				ProcessLastCars(true, data["LastCars"].reverse());
				ActulizaPaginaResultados();
				if(coche_zoom){ //Actualizamos tambien el coche que esta en zoom
					coche_zoom = info_coches[coche_zoom.id_inspeccion];
					ActualizaZoom(0);
				}
				if(coche_3d){
					cleanScene();
					Get3dDefects(coche_3d);
				}
			break;
			case "ResultadoImprimir":
				Do_imprimir(data["infoCar"]);
			break;
			case "ResultadoSaveCar":
				Do_guardar(data);
			break;
			case "RGet3dDefects":
				show3d(data.idInsp, data.defects);
			break;
		}
	}

	async function OpenAdmin(event){
		SendRequestAdm('{"info":"Name", "Name": "Admin"}');
		await new Promise(r => setTimeout(r, 100));
		SendRequestAdm('{"info":"GetTemplatesAdminUI"}');
		await new Promise(r => setTimeout(r, 100));
		if(!init) {SendRequestAdm('{"info":"InfoPlanta"}');}
	}

	async function connectWSAdm(){
		let connectionCounter =  0;
		socketAdmin = new WebSocket('ws://' + ip_server);
		
		// Connection opened
		socketAdmin.addEventListener('open', async function(event) {
			OpenAdmin(event.data);
			connectionCounter++;
			
			});
		
		socketAdmin.addEventListener('close', async function(event) {
			connectionCounter--;
			if(connectionCounter == 0)
			{
				setTimeout(function() {
				connectWSAdm();
			}, 1000);
			}
		});
		
		// Listen for messages
		socketAdmin.addEventListener('message', async function(event){
			ProcessMSGAdmin(event.data);
		});
	}
	async function ChargeAdm(){
		CheckRequestAdm();
		connectWSAdm();
	}
	

	//-------FUNCIONES AUXILIARES---------//
	function Exit() {var x = confirm(MSGAdm[1]); if(x) window.close();}//FUNCIÓN PARA SALIR
	function ocultar(){
		if (document.getElementById("BoxCFG").style.visibility =='visible') ShowBoxCFG();
		else if(document.getElementById("View3d").style.visibility =='visible') closeview3d();
		else if(document.getElementById("Zoom_Inspecciones").style.visibility =='visible') cerrarZoom();
		else MuestraBuscador();
	}
	
	//-------FILL TEMPLATES-------//
	function FillTemplate(car, tmpl){
		let vars = [];
		let aux_vars = tmpl.split("%%");
		for (let i = 1; i<aux_vars.length; i = i + 2){
			vars.push(aux_vars[i]);
		}
		for(let i=0;i<vars.length;i++){
			if(vars[i] == "svg_zona"){
				tmpl = tmpl.replace("%%" + vars[i] + "%%", DecodeBase64(car.svgs[zona_zoom-1]));
			}else if(vars[i].substring(0,8) == "svg_impr"){
				let zona = parseInt(vars[i].substring(8,9));
				tmpl = tmpl.replace("%%" + vars[i] + "%%", DecodeBase64(car.svgs[zona-1]));
			}else if(vars[i].substring(0,3) == "svg"){
				let zona = parseInt(vars[i].substring(3,4));
				tmpl = tmpl.replace("%%" + vars[i] + "%%", DecodeBase64(car.svgs[zona-1]));
			}else{
				if(car[vars[i]]) {tmpl = tmpl.replace("%%" + vars[i] + "%%", car[vars[i]]);}
				else {tmpl = tmpl.replace("%%" + vars[i] + "%%", "--");}
			}
		}
		return tmpl;
	}

	//FUNCION SELECCIONAR/DESELECCIONAR COLORES y MODELOS
	function SeleccionarColores(){
		if(document.getElementById("TodosColores").checked == false){
			for (i=0; i<colores1.length; i++) {
				document.getElementById("col" + colores1[i].codigo_color).checked = false;
			}
		}else{
			for (i=0; i<colores1.length; i++) {
				document.getElementById("col" + colores1[i].codigo_color).checked = true;
			}
		}
	}
	function SeleccionarColores2(){
		if(document.getElementById("TodosColores2").checked == false){
			for (i=0; i<colores2.length; i++) {
				document.getElementById("2col" + colores2[i].codigo_color).checked = false;
			}
		}else{
			for (i=0; i<colores2.length; i++) {
				document.getElementById("2col" + colores2[i].codigo_color).checked = true;
			}
		}
	}
	function SeleccionarModelos(){
		if(document.getElementById("TodosModelos").checked == false){
			Object.keys(gflagsModel).forEach((model, mi) => {
				document.getElementById("mod" + model).checked = false;
					Object.keys(gflagsModel[model]).forEach((msk, mski) => {
						if(gflagsModel[model][msk].size != 1){
							document.getElementById("msk" + model + msk).style.display = 'none';
							Object.keys(gflagsModel[model][msk]).forEach((msk, mski) => {
								document.getElementById("flag" + model + flag.id_flag).checked = false;
								document.getElementById("flag" + model + flag.id_flag).style.display = 'none';
							});
						}
					});
			});
		}else{
			Object.keys(gflagsModel).forEach((model, mi) => {
				document.getElementById("mod" + model).checked = true;
					Object.keys(gflagsModel[model]).forEach((msk, mski) => {
						if(gflagsModel[model][msk].size != 1){
							document.getElementById("msk" + model + msk).style.display = 'block';
							Object.keys(gflagsModel[model][msk]).forEach((msk, mski) => {
								document.getElementById("flag" + model + flag.id_flag).checked = true;
								document.getElementById("flag" + model + flag.id_flag).style.display = 'inline';
							});
						}
					});
			});
		}
	}
	function SeleccionarTodasVariantesModelo(div){
		let model = div.getAttribute('modelo');
		if(!div.checked) {
			Object.keys(gflagsModel[model]).forEach((msk, mski) => {
				if(gflagsModel[model][msk].size != 1){
					document.getElementById("msk" + model + msk).style.display = 'none';
					Object.keys(gflagsModel[model][msk]).forEach((msk, mski) => {
						document.getElementById("flag" + model + flag.id_flag).checked = false;
						document.getElementById("flag" + model + flag.id_flag).style.display = 'none';
					});
				}
			});
		} else{
			Object.keys(gflagsModel[model]).forEach((msk, mski) => {
				if(gflagsModel[model][msk].size != 1){
					document.getElementById("msk" + model + msk).style.display = 'block';
					Object.keys(gflagsModel[model][msk]).forEach((msk, mski) => {
						document.getElementById("flag" + model + flag.id_flag).checked = true;
						document.getElementById("flag" + model + flag.id_flag).style.display = 'inline';
					});
				}
			});
		}
		return;
	}
	function SeleccionarFlag(div){

		let model = div.getAttribute('modelo');
		let msk = div.getAttribute('msk');
		let id_flag = div.getAttribute('flag');
		let selecs = [];
		gflagsModel[model][msk].forEach((flag) => {
			let fdiv = document.getElementById("flag" + model + flag.id_flag);
			fdiv.disabled = false;
			if(fdiv.checked){selecs.push(fdiv);}
		});
		if(selecs.length == 1){selecs[0].disabled = true;}
	}

	//-------TEMPLATES---------//
	function Inicilizar(){
		initView3d();

		// Modo del boton de defectos
		switch(paramsAdm['Size']){
			case "0":
				ChangeWeightDefects();
				document.getElementById("boton_ChangeDefects").style.display = 'none';
				break;
			case "1":
				ChangeSizeDefects();
				document.getElementById("boton_ChangeDefects").style.display = 'none';
				break;
			case "2":
				ChangeSizeDefects();
				break;
		}

		// El mensaje de defectos inicial
		document.getElementById("msgdefects").innerHTML = MSGAdm["lscreens"];
		console.log(msgdefects);
		//Se actualiza el boton RepInsp
		var RepInsp = parseInt(paramsAdm['RepInsp']);
		var tzoffset = (new Date()).getTimezoneOffset() * 60000;
		var current_date = new Date(Date.now() - tzoffset);
		var init_date = new Date(current_date.getTime() - 5*60000);
		var boton_ChangeModo = document.getElementById("boton_ChangeModo");
		if(RepInsp == 1){
			REPARACION = 1;
			boton_ChangeModo.src = "images/Repairbutton.png"
			boton_ChangeModo.onmouseover = () => { boton_ChangeModo.src = "images/RepairbuttonH.png"; }
			boton_ChangeModo.onmouseout = () => { boton_ChangeModo.src = "images/Repairbutton.png"; }
		}else if (RepInsp == 2){
			REPARACION = 0;
			boton_ChangeModo.src = "images/Inspectionbutton.png"
			boton_ChangeModo.onmouseover = () => { boton_ChangeModo.src = "images/InspectionbuttonH.png"; }
			boton_ChangeModo.onmouseout = () => { boton_ChangeModo.src = "images/Inspectionbutton.png"; }
		}else{
			REPARACION = 0;
			boton_ChangeModo.style.display = "none";
		}

		// Se rellena las opciones de búsqueda con el template
		document.getElementById("searchoptions").innerHTML = AdmTemplates["Busqueda"];

		//Variables
		let planta = InfoPlanta.planta;
		planta = planta.charAt(0).toUpperCase() + planta.slice(1);

		//LEER MODELOS Y COLORES QUE HAY EN LA BASE DE DATOS
		let colores = InfoPlanta.Colores;
		var selec_colores = document.getElementById("selec_colores");
		var selec_colores2 = document.getElementById("selec_colores2");
		for (let i=0; i<colores.length; i++) {
			if(BigInt(colores[i].flags) & 0x02n) {colores1.push(colores[i])}
			if(BigInt(colores[i].flags) & 0x04n) {colores2.push(colores[i])}
		}

		if(colores1.length>1){
			var elem = document.createElement("input");
			elem.type = "checkbox";
			elem.id = "TodosColores";
			elem.checked = true;
			elem.style.cursor = 'pointer';
			elem.style.marginLeft = "10px";
			elem.setAttribute('onclick', 'AdminUI.SeleccionarColores()');
			selec_colores.appendChild(elem);
			let label = document.createElement("label");
			label.style.cursor = 'pointer';
			label.innerHTML = MSGAdm[5];
			label.style.color = 'black';
			selec_colores.appendChild(label);
			selec_colores.appendChild(document.createElement("br"));
		}

		for (let i=0; i<colores1.length; i++) {
			var elem = document.createElement("input");
			elem.type = "checkbox";
			elem.id = "col" + colores1[i].codigo_color;
			elem.checked = true;
			elem.style.cursor = 'pointer';
			elem.style.marginLeft = "10px";
			selec_colores.appendChild(elem);
			let label = document.createElement("label");
			label.style.cursor = 'pointer';
			label.htmlFor = colores1[i].abrev;
			label.innerHTML = " " + colores1[i].color;
			label.style.color = 'black';
			selec_colores.appendChild(label);
			selec_colores.appendChild(document.createElement("br"));
		}

		if(colores2.length>1){
			var elem = document.createElement("input");
			elem.type = "checkbox";
			elem.id = "TodosColores2";
			elem.checked = true;
			elem.style.cursor = 'pointer';
			elem.style.marginLeft = "10px";
			elem.setAttribute('onclick', 'AdminUI.SeleccionarColores2()');
			selec_colores2.appendChild(elem);
			let label = document.createElement("label");
			label.style.cursor = 'pointer';
			label.innerHTML = MSGAdm[5];
			label.style.color = 'black';
			selec_colores2.appendChild(label);
			selec_colores2.appendChild(document.createElement("br"));
		}
		else {document.getElementById("divColor2").style.display = "none";}

		for (let i=0; i<colores2.length; i++) {
			var elem = document.createElement("input");
			elem.type = "checkbox";
			elem.id = "2col" + colores2[i].codigo_color;
			elem.checked = true;
			elem.style.cursor = 'pointer';
			elem.style.marginLeft = "10px";
			selec_colores2.appendChild(elem);
			let label = document.createElement("label");
			label.style.cursor = 'pointer';
			label.htmlFor = colores2[i].abrev;
			label.innerHTML = " " + colores2[i].color;
			label.style.color = 'black';
			selec_colores2.appendChild(label);
			selec_colores2.appendChild(document.createElement("br"));
		}
		selec_colores.appendChild(document.createElement("br"));

		let gflags = {};
		let modelos = InfoPlanta.Modelos;
		let flags = InfoPlanta.Flags;
		for (let j=0; j<flags.length; j++) {
			if (gflags[flags[j].mask] == undefined) gflags[flags[j].mask] = new Set();
			gflags[flags[j].mask].add(flags[j]);
		}

		for (let i=0; i<modelos.length; i++){
			if(modelos[i].codigo_modelo >= 999) continue;
			if(MapModels[modelos[i].modelo] == undefined) {
				MapModels[modelos[i].modelo] = {};
				MapModels[modelos[i].modelo][0] = [];
			}
			MapModels[modelos[i].modelo][0].push(modelos[i].variante);
			if (gflagsModel[modelos[i].modelo] == undefined) gflagsModel[modelos[i].modelo] = {};

			for (let j=0; j<flags.length; j++) {
				if ((modelos[i].variante & flags[j].mask) == flags[j].flags){
					if(gflagsModel[modelos[i].modelo][flags[j].mask] == undefined) {gflagsModel[modelos[i].modelo][flags[j].mask] = new Set()}
					gflagsModel[modelos[i].modelo][flags[j].mask].add(flags[j]);
					if(MapModels[modelos[i].modelo][flags[j].id_flag] == undefined) {MapModels[modelos[i].modelo][flags[j].id_flag] = [];}
					MapModels[modelos[i].modelo][flags[j].id_flag].push(modelos[i].variante);
				}
			}
		}

		var selec_modelos = document.getElementById("selec_modelos");
		if((Object.keys(gflagsModel).length)>1){
			var elem = document.createElement("input");
			elem.type = "checkbox";
			elem.id = "TodosModelos";
			elem.checked = true;
			elem.style.cursor = 'pointer';
			elem.style.marginLeft = "10px";
			elem.setAttribute('onclick', 'AdminUI.SeleccionarModelos()');
			selec_modelos.appendChild(elem);
			let label = document.createElement("label");
			label.style.cursor = 'pointer';
			label.innerHTML = MSGAdm[6];
			label.style.color = 'black';
			selec_modelos.appendChild(label);
			selec_modelos.appendChild(document.createElement("br"));
		}

		Object.keys(gflagsModel).forEach((model, mi) => {
				let div = document.createElement("div");
				let cmodel = document.createElement("input");
				cmodel.type = "checkbox";
				cmodel.id = "mod" + model;
				cmodel.checked = true;
				cmodel.setAttribute('modelo', model);
				cmodel.style.cursor = 'pointer';
				cmodel.setAttribute('onclick', 'AdminUI.SeleccionarTodasVariantesModelo(this)');
				cmodel.style.marginLeft = "10px";
				div.appendChild(cmodel);
				let lmodel = document.createElement("label");
				lmodel.style.cursor = 'pointer';
				lmodel.id = "l" + model;
				lmodel.innerHTML = " " + model;
				lmodel.style.color = 'black';
				lmodel.appendChild(document.createElement("br"));
				div.appendChild(lmodel);

				Object.keys(gflagsModel[model]).forEach((msk, mski) => {
						var divmsk = document.createElement("div");
						divmsk.id = "msk" + model + msk;
						divmsk.style.marginTop = "2px";
						divmsk.style.marginBottom = "5px";

						let flags = gflagsModel[model][msk];
						flags.forEach((idflag, flag, set) => {
							let cflag = document.createElement("input");
							cflag.type = "checkbox";
							cflag.id = "flag" + model + flag.id_flag;
							cflag.checked = true;
							cflag.setAttribute('modelo', model);
							cflag.setAttribute('msk', msk);
							cflag.setAttribute('onclick', 'AdminUI.SeleccionarFlag(this)');
							cflag.setAttribute('flag', flag.id_flag);
							cflag.style.cursor = 'pointer';
							cflag.style.marginLeft = "20px";
							divmsk.appendChild(cflag);
							let lflag = document.createElement("label");
							lflag.style.cursor = 'pointer';
							lflag.id = "l" + model + flag.id_flag;
							lflag.innerHTML = " " + flag.name;
							lflag.style.color = 'black';
							lflag.appendChild(document.createElement("br"));
							divmsk.appendChild(lflag);

						});
						if(flags.size == 1){divmsk.style.display = 'none';}
						div.appendChild(divmsk);
					}
				);
				selec_modelos.appendChild(div);
			}
		);

		let paises = InfoPlanta.Paises;
		var options_paises = document.getElementById("p_pais");
		var elem = document.createElement("option");
		elem.value = 999;
		elem.innerHTML = "-----";
		options_paises.appendChild(elem);

		for (let i=0; i<paises.length; i++) {
			var elem = document.createElement("option");
			elem.value = paises[i].codigo;
			elem.innerHTML = "(" + paises[i].codigo + ")" + " " + paises[i].nombre;
			options_paises.appendChild(elem);
		}

		if(!paramsAdm['RepLines'] || paramsAdm['RepLines'] == 0) { document.getElementById("BChangeRepLine").style.display = 'none';}
		else {
			RepLines = paramsAdm['RepLines'].split(',');
			var options_replines = document.getElementById("BChangeRepLine");
			var elem = document.createElement("option");
			elem.value = 0;
			elem.innerHTML = "-----";
			options_replines.appendChild(elem);
			for (let i=0; i<RepLines.length; i++) {
				var elem = document.createElement("option");
				elem.value = RepLines[i];
				elem.innerHTML = " " + RepLines[i];
				options_replines.appendChild(elem);
			}
		}

		// Imágenes para saber que zonas tengo que poner en el 3d
		let imagenes = InfoPlanta["Imagenes"];
		for (let i=0; i<imagenes.length; i++) {
			if(imagenes[i].id_img[2] != '0') continue;
			let model = imagenes[i].modelo;
			let variante = imagenes[i].variante;
			if(IDIMG[model]== undefined) IDIMG[model] = {};
			if(IDIMG[model][variante]== undefined) IDIMG[model][variante] = [];
			IDIMG[model][variante].push(imagenes[i].id_img);
		}
		// Lanzo las funciones asincronas
		GetLastCars();

	}

	//-------ZOOM---------//
	function abreZoom(zona, id_inspeccion, enable){
		//if(enable == 'none') return;
		coche_zoom = info_coches[id_inspeccion];
		if(!coche_zoom.svgs[zona-1]) return;
		var Zoom_Inspecciones = document.getElementById("Zoom_Inspecciones");
		Zoom_Inspecciones.style.visibility='visible';
		document.getElementById("borroso").style.display = 'block';
		document.getElementById("borroso").style.zIndex = "3";
		zona_zoom = zona;
		ActualizaZoom(0);
	}
	function cerrarZoom(){
		document.getElementById("Zoom_Inspecciones").style.visibility = 'hidden';
		document.getElementById("Zoom_Inspecciones").children[1].innerHTML = "";
		if(document.getElementById('resultados').style.display == 'none') document.getElementById("borroso").style.display = 'none';
		document.getElementById("borroso").style.zIndex = "1";
	}
	function ActualizaZoom(incremento){
		let zona = zona_zoom;
		if(!coche_zoom) return;
		//Actualizamos la zona que se muestra
		zona = zona + incremento;
		if(zona < 1){
			zona = zona_zoom = coche_zoom.svgs.length;
		}else if(zona > coche_zoom.svgs.length){
			zona = zona_zoom = 1;
		}
		if(!coche_zoom.svgs[zona-1].length){
			zona_zoom = zona;
			ActualizaZoom(incremento)
			return;
		}
		zona_zoom = zona; //Se guarda la zona que se muestra en una variable global
		//Se crea el SVG con el coche almacenado en la variable global coche_zoom
		var Zoom_Inspecciones = document.getElementById("Zoom_Inspecciones");
		Zoom_Inspecciones.innerHTML = FillTemplate(coche_zoom, AdmTemplates["ZoomInspeccion"]);
	}

	//-------INSPECCIONES---------//
	function DibujaUltimasInspecciones(new_car){
		for(let i=0; i<ultimas_inspecciones.length;i++){
			let car = ultimas_inspecciones[i];
			if(!document.getElementById(car.id_inspeccion)){ //Si no estaba la inspeccion se crea una
				let div = document.createElement("div");
				div.innerHTML = FillTemplate(car, AdmTemplates["Principal"]);
				document.getElementById("Inspecciones").prepend(div.firstChild);
			}else{
				//Si la inspeccion no se habia terminado de inspeccionar se actualizar
				//o si han fallado todas (para actualizar mascara gris a roja)
				//if(BigInt(car.CamsFailed) == BigInt(car.idCams) || (document.getElementById(car.id_inspeccion).getAttribute('camsfailed') != BigInt(car.CamsFailed))){
				if(car.reparado == 0){
					let div = document.createElement("div");
					div.innerHTML = FillTemplate(car, AdmTemplates["Principal"]);
					document.getElementById(car.id_inspeccion).innerHTML = div.firstChild.innerHTML;
					document.getElementById(car.id_inspeccion).style.backgroundColor = div.firstChild.style.backgroundColor;
					document.getElementById(car.id_inspeccion).setAttribute('camsfailed', car.CamsFailed);
				}
			}
		}

		//La ultima inspeccion se pone a naranja y luego en siete segundos se vuelve a poner normal
		if(new_car && (ultimas_inspecciones.length>0)){
			var id_insp = ultimas_inspecciones[ultimas_inspecciones.length-1].id_inspeccion;
			var b = document.getElementById(id_insp).style.backgroundColor;
			var cb = document.getElementById(id_insp).children[0].style.backgroundColor;
			document.getElementById(id_insp).style.backgroundColor = "#ffc6a5";
			document.getElementById(id_insp).children[0].style.backgroundColor = "white";
			setTimeout(function(){
				document.getElementById(id_insp).style.backgroundColor = b;
				document.getElementById(id_insp).children[0].style.backgroundColor = cb;
			}, 7000);
		}

		//Eliminar los nodos con inspecciones que no estan incluidas en el array
		var div_insp = document.getElementById("Inspecciones").childNodes;
		while(div_insp.length > 10){
			div_insp[div_insp.length-1].remove();
		}
	}

	async function ProcessLastCars(force, ultimas_inspecciones_){
		let last_car_ = ultimas_inspecciones_[ultimas_inspecciones_.length-1]
		let last_car = ultimas_inspecciones[ultimas_inspecciones.length-1]
		var new_car = false;
		if(force || (new_car=(ultimas_inspecciones.length==0)) || (new_car=!last_car_) || (new_car=(last_car_.id_inspeccion != last_car.id_inspeccion)) || (BigInt(last_car.idCams) == BigInt(last_car.CamsFailed))){
			ultimas_inspecciones = ultimas_inspecciones_;
			DibujaUltimasInspecciones(new_car);
		}
	}

	async function GetLastCars(){
		while(true){
			let seconds = 10000;
			if(AutoPrint) {seconds = 1000;}
			let replines = ((REPARACION && (document.getElementById("BChangeRepLine").value != 0)) ? document.getElementById("BChangeRepLine").value : "");
			SendRequestAdm('{"info":"GetLastCars", "Rep":"'+ REPARACION +'","replines":"'+ replines +'","mode":"'+mode+'","UImode":"'+UImode+'"}');
			ChangeBoton = false;
			// AUTO-PRINT, si el id de inspeccion es UINT32MAX, se imprime el ultimo coche de reparación si no se ha impreso ya
			// La gestión la hace toda el ServerUI ya que es el único que sabe en todo momento los coches que estan pasando por las pantallas
			if (AutoPrint) {
				SendRequestAdm('{"info":"Imprimir","idInsp":"'+ 0xFFFFFFFF +'","mode":"'+mode+'","UImode":"'+UImode+'"}');
				console.log('{"info":"Imprimir","idInsp":"'+ 0xFFFFFFFF +'","mode":"'+mode+'","UImode":"'+UImode+'"}');
			}
			await new Promise(r => setTimeout(r, seconds));
		}
	}

	//-------BUSCADOR---------//
	//BOTON DE OCULTAR BUSCADOR Y RESULTADOS
	async function MuestraBuscador() {
		const buscador = document.getElementById('buscador');
		if(buscador.style.visibility == 'hidden'){
			buscador.style.visibility = 'visible';
			document.getElementById('borroso').style.display = 'block';
			document.getElementById("borroso").style.zIndex = "1";
			document.getElementById('resultados').style.display = "none";
			document.getElementById("Zoom_Inspecciones").style.visibility = 'hidden';
			closeview3d();
			if(document.getElementById("BoxCFG").style.visibility !='visible') document.getElementById("borroso").style.zIndex = "1";
		}else{
			buscador.style.visibility = 'hidden';
			document.getElementById('borroso').style.display = 'none';
		}
	}

	function CerrarResultados(){document.getElementById('resultados').style.display = "none";document.getElementById('buscador').style.visibility = "visible";}
	// Oculta las cosas para luego pedir los resultados
	function BuscaResultados(){
		var resultados = document.getElementById('resultados');
		document.getElementById('imagen_cargando').style.visibility = "visible";
		document.getElementById("Busquedas").style.display = 'none';
		document.getElementById('botones').style.display = 'none' ;
		document.getElementById('info_icon').style.visibility = 'hidden' ;
		resultados.style.display = "block";
		document.getElementById('NumRes').style.visibility = 'hidden'

		document.getElementById('buscador').style.visibility = "hidden";
		setTimeout(function() {
			PideResultados();
		}, 250);
	}

	//Muestra los resultados
	function MuestraResultados() {
		//Se activa la barra que muestra el numero de resultados
		const num_res = document.getElementById('NumRes');
		num_res.style.visibility = 'visible';

		var resultados = document.getElementById("resultados");
		var botones = document.getElementById("botones");
		if(coches_encontrados.length > 0 ){
			//ACTIVA LA PÁGINA 1 Y ACTUALIZA EL VALOR DE NÚMERO DE RESULTADOS
			botones.children[0].style.visibility = 'visible';
			botones.children[0].value = 1;
			num_res.innerHTML = MSGAdm[3];
		}else{
			botones.children[0].style.visibility = 'hidden';
			num_res.innerHTML = MSGAdm[4];
		}

		//Desactiva el gif de loading
		document.getElementById('imagen_cargando').style.visibility = "hidden";
		document.getElementById("Busquedas").style.display = 'block';
		document.getElementById('botones').style.display = 'block' ;
		document.getElementById('info_icon').style.visibility = 'visible' ;
	}

	// Pide los resultados según los datos puestos por el usuario
	function PideResultados() {
		n_pagina_coches = 0;
		//Carga colores
		let colors_sql1 = null;
		for (i=0; i<colores1.length; i++) {
			if(document.getElementById('col' + colores1[i].codigo_color).checked){
				if (colors_sql1 != null) colors_sql1 = colors_sql1 + "," + colores1[i].codigo_color;
				else colors_sql1 = colores1[i].codigo_color;
			}
		}

		let colors_sql2 = null;
		for (i=0; i<colores2.length; i++) {
			if(document.getElementById('2col' + colores2[i].codigo_color).checked){
				if (colors_sql2 != null) colors_sql2 = colors_sql2 + "," + colores2[i].codigo_color;
				else colors_sql2 = colores2[i].codigo_color;
			}
		}

		colors_sql2 = colors_sql2 + ',' + colors_sql1;

		//Carga modelos
		let codigoModelos = new Set();
		Object.keys(gflagsModel).forEach((model, mi) => {
				if(document.getElementById("mod" + model).checked) {
					// Si el modelo esta checkeado
					let variantes = MapModels[model][0]; // Todas las variantes
					Object.keys(gflagsModel[model]).forEach((msk, mski) => {
						(gflagsModel[model][msk]).forEach((flag, mski) => {
							if(!document.getElementById("flag" + model + flag.id_flag).checked){
								// Si este flag no está incluido se quitan esas impresiones
								variantes = variantes.filter( ( el ) => !MapModels[model][flag.id_flag].includes( el ) );
							}
						});
					});
					variantes.forEach(variante => codigoModelos.add(model + '.' + variante));
				}
			}
		);

		let modelos_sql = null;
		codigoModelos.forEach(halfmodel => {
			if (modelos_sql != null) modelos_sql = modelos_sql + "," + halfmodel;
			else modelos_sql = halfmodel;
		});

		//Manda el json al J3D ServerUI y le devuelve los ids de inspeccion de la busqueda
		let json = '{"info":"Busqueda",';

		if(modelos_sql != "") json +='"m-halfmodel":"'+modelos_sql+'",';
		if(colors_sql1 != "") json +='"m-codigo_color1":"'+colors_sql1+'",';
		if(colors_sql2 != "") json +='"m-codigo_color2":"'+colors_sql2+'",';
		if(document.getElementById('p_pais').value != 999) json +='"s-codigo_pais":"'+document.getElementById('p_pais').value+'",';
		if(document.getElementById('p_relai').value != "") json +='"s-relai":"'+document.getElementById('p_relai').value+'",'; 

		let searchoptions = document.getElementById('searchoptions').childNodes;
		for(let i = 0; i< searchoptions.length;i++){
			if(searchoptions[i].id && searchoptions[i].id.includes('val')){
				if(document.getElementById(searchoptions[i].id).value != "") json +='"'+ searchoptions[i].name + '":"'+document.getElementById(searchoptions[i].id).value+'",';
			}
		}

		json = json.substring(0, json.length - 1);
		json += '}';

		/*
		//Verifico si se está buscando por relai
		var buscandoPorRelai = document.getElementById('p_relai').value !== "";
    	//Si es así, que la variable coches_por_pagina sea 1, sino que sea 5
   		coches_por_pagina = buscandoPorRelai ? 1 : 5;

		*/		

		SendRequestAdm(json);
	}

	function ValSearchUI(){
	}

	//FUNCIONES PAGINA DE RESULTADOS
	function retrasa(n){if((n_pagina_coches-n) >= 0){n_pagina_coches -= n; GetInfoPaginaResultados();}}
	function adelanta(n){if((n_pagina_coches+n) * coches_por_pagina <coches_encontrados.length){n_pagina_coches += n; GetInfoPaginaResultados();}}
	function pagina_inicio(){n_pagina_coches = 0; GetInfoPaginaResultados();}
	function pagina_final(){n_pagina_coches = Math.ceil(coches_encontrados.length/coches_por_pagina) - 1; GetInfoPaginaResultados();}

	//ACTULIZA PAGINA DE RESULTADOS
	function GetInfoPaginaResultados(){
		let exist = false;
		//Se manda el JSON
		let json = '{"info":"ActualizaPaginaResultados","mode":"'+mode+'","UImode":"'+UImode+'","idsInsp":"';
		for(var seccion=0;seccion<coches_por_pagina;seccion++){
			if(coches_encontrados && coches_encontrados[seccion + n_pagina_coches * coches_por_pagina]) {
				json += coches_encontrados[seccion + n_pagina_coches * coches_por_pagina] + ',';
				exist = true;
			}
		}
		if(exist) json = json.substring(0, json.length - 1);
		json += '"}';
		SendRequestAdm(json);
	}

	function Actulizabotones(){
		//ACTUALIZACIÓN BOTONES
		var botones = document.getElementById("botones");
		botones.children[1].style.visibility = 'hidden' ;
		botones.children[2].style.visibility = 'hidden' ;
		botones.children[3].style.visibility = 'hidden' ;
		botones.children[4].style.visibility = 'hidden' ;
		botones.children[5].style.visibility = 'hidden' ;
		botones.children[6].style.visibility = 'hidden' ;
		botones.children[7].style.visibility = 'hidden' ;
		botones.children[8].style.visibility = 'hidden' ;
		botones.children[9].style.visibility = 'hidden' ;
		botones.children[10].style.visibility = 'hidden' ;
		botones.children[11].style.visibility = 'hidden' ;
		botones.children[12].style.visibility = 'hidden' ;

		//ACTUALIZA VALORES BOTONES Y FUNCIONES
		if(Math.ceil(coches_encontrados.length/coches_por_pagina) > 13){
			for(var boton = 1; boton < 13; boton++){
				botones.children[boton].style.visibility = 'visible' ;
			}
			if(((n_pagina_coches+1)>7) && ((n_pagina_coches+1)<(coches_encontrados.length/coches_por_pagina - 6))){

				botones.children[1].style.visibility = 'hidden' ;
				botones.children[11].style.visibility = 'hidden' ;
				for(var boton = 0; boton < 13; boton++){
					botones.children[boton].style.backgroundColor = "white";
					if((0<boton) && (boton<6)){
						botones.children[boton].setAttribute( "onClick", "AdminUI.retrasa("+(6-boton)+");" );
						botones.children[boton].value = ((n_pagina_coches+1) - (6-boton));
					}else if(boton == 6){
						botones.children[boton].setAttribute( "onClick", "" );
						botones.children[boton].style.backgroundColor = "#CF9CEF";
						botones.children[boton].value = (n_pagina_coches + 1);
					}else if(boton == 0){
						botones.children[boton].setAttribute( "onClick", "AdminUI.pagina_inicio();" );
						botones.children[boton].style.backgroundColor = "#EAAF8A";
						botones.children[boton].value = 1;

					}else if(boton == 12){
						botones.children[boton].setAttribute( "onClick", "AdminUI.pagina_final();" );
						botones.children[boton].style.backgroundColor = "#EAAF8A";
						botones.children[boton].value = Math.ceil(coches_encontrados.length/coches_por_pagina);
					}else if((6<boton) && (boton<12)){
						botones.children[boton].setAttribute( "onClick", "AdminUI.adelanta(" + (boton - 6) + ");" );
						botones.children[boton].value = (n_pagina_coches + (boton - 5));
					}
				}
			}else if(!((n_pagina_coches+1)>7) && ((n_pagina_coches+1)<(coches_encontrados.length/coches_por_pagina - 6))){
				botones.children[1].style.visibility = 'visible' ;
				botones.children[11].style.visibility = 'hidden' ;
				for(var boton = 0; boton < 13; boton++){
					botones.children[boton].style.backgroundColor = "white";
					if((boton<n_pagina_coches)){
						botones.children[boton].setAttribute( "onClick", "AdminUI.retrasa("+(n_pagina_coches-boton)+");" );
						botones.children[boton].value = boton+1;
					}else if(boton == n_pagina_coches){
						botones.children[boton].setAttribute( "onClick", "" );
						botones.children[boton].style.backgroundColor = "#CF9CEF";
						botones.children[boton].value = (n_pagina_coches + 1);
					}else if(boton == 12){
						botones.children[boton].setAttribute( "onClick", "AdminUI.pagina_final();" );
						botones.children[boton].style.backgroundColor = "#EAAF8A";
						botones.children[boton].value = Math.ceil(coches_encontrados.length/coches_por_pagina);
					}else if((n_pagina_coches<boton) && (boton<12)){
						botones.children[boton].setAttribute( "onClick", "AdminUI.adelanta(" + (boton - n_pagina_coches) + ");" );
						botones.children[boton].value = (n_pagina_coches + (boton - n_pagina_coches + 1));
					}
				}
			}else if(((n_pagina_coches+1)>7) && !((n_pagina_coches+1)<(coches_encontrados.length/coches_por_pagina - 6))){
				botones.children[1].style.visibility = 'hidden' ;
				botones.children[11].style.visibility = 'visible' ;
				for(var boton = 0; boton < 13; boton++){
					botones.children[boton].style.backgroundColor = "white";
					if((boton<((12 + n_pagina_coches + 1)- Math.ceil(coches_encontrados.length/coches_por_pagina))) && (boton != 0)){
						botones.children[boton].setAttribute( "onClick", "AdminUI.retrasa("+(((12 + n_pagina_coches + 1)- Math.ceil(coches_encontrados.length/coches_por_pagina)) - boton)+");" );
						botones.children[boton].value = Math.ceil(coches_encontrados.length/coches_por_pagina) - (12 - boton);
					}else if(boton == ((12 + n_pagina_coches + 1)- Math.ceil(coches_encontrados.length/coches_por_pagina))){
						botones.children[boton].setAttribute( "onClick", "" );
						botones.children[boton].style.backgroundColor = "#CF9CEF";
						botones.children[boton].value = (n_pagina_coches + 1);
					}else if(boton == 0){
						botones.children[boton].setAttribute( "onClick", "AdminUI.pagina_inicio();" );
						botones.children[boton].style.backgroundColor = "#EAAF8A";
						botones.children[boton].value = 1;
					}else if(boton>((12 + n_pagina_coches + 1)- Math.ceil(coches_encontrados.length/coches_por_pagina))){
						botones.children[boton].setAttribute( "onClick", "AdminUI.adelanta(" + ((Math.ceil(coches_encontrados.length/coches_por_pagina) - (n_pagina_coches)) - (13 - boton)) + ");" );
						botones.children[boton].value = Math.ceil(coches_encontrados.length/coches_por_pagina) - (12 - boton);
					}
				}
			}
		}else{
			for(var boton = 0; boton < 13; boton++){
				botones.children[boton].style.backgroundColor = "white";
				if(boton < Math.ceil(coches_encontrados.length/coches_por_pagina)){
					botones.children[boton].style.visibility = 'visible' ;
					botones.children[boton].value = boton + 1 ;
					if(boton<n_pagina_coches){
						botones.children[boton].setAttribute( "onClick", "AdminUI.retrasa("+(n_pagina_coches - boton)+");" );
					}else if(boton>n_pagina_coches){
						botones.children[boton].setAttribute( "onClick", "AdminUI.adelanta("+(boton - n_pagina_coches)+");" );
					}
				}
			}
			botones.children[n_pagina_coches].style.backgroundColor = "#CF9CEF";
		}
	}
	function ActulizaPaginaResultados(){
		Actulizabotones();
		//ACTUALIZACIÓN SECCIONES
		var resultados = document.getElementById("resultados");
		document.getElementById("Busquedas").innerHTML = "";
		for(var seccion=0;seccion<coches_por_pagina;seccion++){
			if((seccion + n_pagina_coches * coches_por_pagina)<coches_encontrados.length){
				let coche_aux = info_coches[coches_encontrados[seccion + n_pagina_coches * coches_por_pagina]]
				let scan = document.createElement("scan");
				scan.innerHTML = FillTemplate(coche_aux, AdmTemplates["Resultados"]);
				document.getElementById("Busquedas").append(scan.firstChild);
			}
		}
		//ACTIVAR LAS COSAS DESPUES DE BUSCAR
		resultados.children[0].style.visibility = 'visible' ;
		resultados.children[3].style.visibility = 'visible' ;
	}

	//-------IMPRIMIR---------//
	function imprimir(id_inspeccion){SendRequestAdm('{"info":"Imprimir","idInsp":"'+id_inspeccion+'","mode":"'+mode+'","UImode":"'+UImode+'"}');}
	function Do_imprimir(coche){
		document.getElementById("tmplimpresion").innerHTML = FillTemplate(coche, AdmTemplates["Impresion"]);
		document.getElementById("NombrePlantaImpr").innerHTML = InfoPlanta.planta;
		document.getElementById("impresion").style.display = "block";
		document.getElementById("impresion").visibility = "visible";
		console.log(document.getElementById("impresion").innerHTML);
		setTimeout(function(){
				window.print();
				document.getElementById("impresion").style.display = "none";
				document.getElementById("impresion").visibility = "hidden";
		}, 500);
	}

	//-------GUARDADO--------//
	function guardar(id_inspeccion){SendRequestAdm('{"info":"SaveCar","idInsp":"'+id_inspeccion+'"}');}
	function Do_guardar(data){
		document.getElementById("cartel_save").style.visibility = "visible";
		let seconds = 1500;
		let msg = "<br><br>";
		if(info_coches[data["idInsp"]]) {msg += MSGAdm[2] + ": " + info_coches[data["idInsp"]].vis;}
		else {msg += "ERROR";}

		if(data["Guardado"]){
			document.getElementById("cartel_save").innerHTML = MSGAdm[7] + msg;
			document.getElementById("cartel_save").style.background = "#4fdb7c";
			document.getElementById("cartel_save").style.color = "black";
		}else{
			document.getElementById("cartel_save").innerHTML = MSGAdm[8] + msg;
			document.getElementById("cartel_save").style.background = "#e92d3a";
			document.getElementById("cartel_save").style.color = "white";
			seconds = 4000;
		}
		setTimeout(function(){
			document.getElementById("cartel_save").style.visibility = "hidden";
		}, seconds)
	}


	//MOSTRAR PANTALLA PARA REPARAR DEFECTOS
	
	async function showUI(){
		
	}

	
	async function ocultarIframe(){
		document.getElementById('boton_salir2').style.visibility = 'hidden';
		document.getElementById('seleccionDefectos').style.display = 'none';
		document.getElementById('DashBar').style.display = 'block';
		document.getElementById('MuestraBuscador').style.display = 'block';
	}

	//-----CAMBIA INSPECCION/REPARACIÓN----//
	function ChangePlace(){
		document.getElementById("Inspecciones").innerHTML = "";
		let ultimas_inspecciones_ = [];
		var boton_ChangeModo = document.getElementById("boton_ChangeModo");
		if(REPARACION == 1){
			REPARACION = 0;
			boton_ChangeModo.src = "images/Inspectionbutton.png";
			boton_ChangeModo.onmouseover = () => { boton_ChangeModo.src = "images/InspectionbuttonH.png"; }
			boton_ChangeModo.onmouseout = () => { boton_ChangeModo.src = "images/Inspectionbutton.png"; }
		}else{
			REPARACION = 1;
			boton_ChangeModo.src = "images/Repairbutton.png"
			boton_ChangeModo.onmouseover = () => { boton_ChangeModo.src = "images/RepairbuttonH.png"; }
			boton_ChangeModo.onmouseout = () => { boton_ChangeModo.src = "images/Repairbutton.png"; }
		}

		if(!REPARACION || !RepLines.length) {document.getElementById("BChangeRepLine").style.display = 'none';}
		else {document.getElementById("BChangeRepLine").style.display = '';}

		let replines = ((REPARACION && (document.getElementById("BChangeRepLine").value != 0)) ? document.getElementById("BChangeRepLine").value : "");
		SendRequestAdm('{"info":"GetLastCars", "Rep":"'+ REPARACION +'","replines":"'+ replines +'","mode":"'+mode+'","UImode":"'+UImode+'"}');
		ChangeBoton = true;
	}

	//-----CAMBIA DEFECTOS-----//+
	function ActualizeAdmin(){
		let exist = false;
		let replines = ((REPARACION && (document.getElementById("BChangeRepLine").value != 0)) ? document.getElementById("BChangeRepLine").value : "");
		let json = '{"info":"ActualizaAdmin", "Rep":"'+REPARACION+'","replines":"'+ replines +'","mode":"'+mode+'","UImode":"'+UImode+'","idsInsp":"';
		for(var seccion=0;seccion<coches_por_pagina;seccion++){
			if(coches_encontrados && coches_encontrados[seccion + n_pagina_coches * coches_por_pagina]) {
				json += coches_encontrados[seccion + n_pagina_coches * coches_por_pagina] + ',';
				exist = true;
			}
		}
		if(exist) json = json.substring(0, json.length - 1);
		json += '"}';
		SendRequestAdm(json);
	}

	function ShowBoxCFG(){
		let bcfg = document.getElementById("BoxCFG");
		let borroso = document.getElementById("borroso");
		if (bcfg.style.visibility == "visible")  {
			bcfg.style.visibility = "hidden";
			if(document.getElementById("buscador").style.visibility =='visible') borroso.style.zIndex = "1";
			else if (document.getElementById("Zoom_Inspecciones").style.visibility =='visible') borroso.style.zIndex = "4";
			else if (document.getElementById("View3d").style.visibility =='visible') borroso.style.zIndex = "4";
			else if (document.getElementById("resultados").style.display =='block') borroso.style.zIndex = "2";
			else borroso.style.display = "none";
		}
		else {
			bcfg.style.visibility = "visible";
			borroso.style.display = 'block';
			borroso.style.zIndex = "7";
		}
	}

	function ShowBoxIP(){
		let bip = document.getElementById("BoxIP");
		let borroso = document.getElementById("borroso");
		if(bip.style.visibility == "visible") {
		   bip.style.visibility = "hidden";
		   if(document.getElementById("buscador").style.visibility == 'visible')borroso.style.zIndex = "1";
		   else if (document.getElementById("Zoom_Inspecciones").style.visibility == 'visible') borroso.style.zIndex = "4";
		   else if (document.getElementById("View3d").style.visibility == 'visible') borroso.style.zIndex = "4";
		   else if (document.getElementById("resultados").style.display == 'block') borroso.style.zIndex = "2";
		}
		else {
			bip.style.visibility = "visible";
			borroso.style.display = 'block';
			borroso.style.zIndex = "7";
		}
	}

	function ChangeModeSizeDefects(elm){
		document.getElementById("Inspecciones").innerHTML = "";
		let mts = document.getElementsByName("mt");
		for (var i = 0; i < mts.length; i++) {mts[i].checked = false;}
		document.getElementById(elm).checked = true;
		
		
		if(document.getElementById("dscreens").checked) {
			mode = FLAG_SCREENBLOB;
			document.getElementById("msgdefects").innerHTML = MSGAdm["lscreens"];
			console.log(msgdefects);
		}
		else if(document.getElementById("drawdiscarded").checked) {
			mode = FLAG_BLOBRAWDEFECTS | FLAG_SHOWDISCARDEDRAWDEFECTS;
			document.getElementById("msgdefects").innerHTML = MSGAdm["ldrawdiscarded"];
			console.log(msgdefects);
		}
		else if(document.getElementById("drawndiscarded").checked) {
			mode = FLAG_BLOBRAWDEFECTS;
			document.getElementById("msgdefects").innerHTML = MSGAdm["ldrawndiscarded"];
			console.log(msgdefects);
		}
		else if(document.getElementById("dactualfilter").checked) {
			mode = FLAG_BLOBRAWDEFECTS | FLAG_FILTERRAWDEFECTS;
			document.getElementById("msgdefects").innerHTML = MSGAdm["ldactualfilter"];
			console.log(msgdefects);
		}
		
		ActualizeAdmin();
	}

	
	function ChangeWeightDefects(){
		document.getElementById("styleAdm").innerHTML = "#boton_view3d{display: none !important;}";
		let boton_ChangeDefects = document.getElementById("boton_ChangeDefects");
		mode = FLAG_WEIGHTDEFECTS;
		UImode = UITEXT_WEIGHT;
		boton_ChangeDefects.src = "images/WeightButton.png";
		boton_ChangeDefects.onmouseover = () => { boton_ChangeDefects.src = "images/WeightButtonH.png"; };
		boton_ChangeDefects.onmouseout = () => { boton_ChangeDefects.src = "images/WeightButton.png"; };
		document.getElementById("BoxCFGdefects").style.display = "none";
		document.getElementById("BoxCFG").style.height = "45px";
	}

	function ChangeSizeDefects(){
		document.getElementById("styleAdm").innerHTML = "";
		let boton_ChangeDefects = document.getElementById("boton_ChangeDefects");
		UImode = UITEXT_SIZE | UITEXT_WEIGHT;
		boton_ChangeDefects.src = "images/SizeButton.png";
		boton_ChangeDefects.onmouseover = () => { boton_ChangeDefects.src = "images/SizeButtonH.png"; };
		boton_ChangeDefects.onmouseout = () => { boton_ChangeDefects.src = "images/SizeButton.png"; };
		document.getElementById("BoxCFGdefects").style.display = "";
		document.getElementById("BoxCFG").style.height = "200px";
	}

	function ChangeDefects(){
		if(mode & FLAG_WEIGHTDEFECTS){
			// Si estaba en peso cambio a tamaño
			ChangeSizeDefects();
			ChangeModeSizeDefects(document.getElementById("dscreens").id);
		}else{
			// Si estaba en tamaño cambio a peso
			document.getElementById("Inspecciones").innerHTML = "";
			ChangeWeightDefects();
			ActualizeAdmin();
		}
	}



	/* AutoPrint */
	function ActAutoPrint(){
		let AutoPrintBoton = document.getElementById("AutoPrintBoton");
		if(AutoPrint){
			AutoPrint = false;
			AutoPrintBoton.src = "images/AutoPrintOFF.png";
			AutoPrintBoton.onmouseover = () => { AutoPrintBoton.src = "images/AutoPrintOFFH.png"; }
			AutoPrintBoton.onmouseout = () => { AutoPrintBoton.src = "images/AutoPrintOFF.png"; }
		}else{
			AutoPrint = true;
			AutoPrintBoton.src = "images/AutoPrintON.png"
			AutoPrintBoton.onmouseover = () => { AutoPrintBoton.src = "images/AutoPrintONH.png"; }
			AutoPrintBoton.onmouseout = () => { AutoPrintBoton.src = "images/AutoPrintON.png"; }
		}
	}

	/* Cambio de línea de reparación */
	function ChangeRepLine(div){
		document.getElementById("Inspecciones").innerHTML = "";
		// Reactualizo cuando se cambia de linea de reparación
		let replines = ((REPARACION && (document.getElementById("BChangeRepLine").value != 0)) ? document.getElementById("BChangeRepLine").value : "");
		SendRequestAdm('{"info":"GetLastCars", "Rep":"'+ REPARACION +'","replines":"'+ replines +'","mode":"'+mode+'","UImode":"'+UImode+'"}');
		ChangeBoton = true;
		return 0;
	}

	/* Vista en 3D */
	var renderer;
	var controls;
	var scene;
	var camera;
	var STLS = {};
	var DefectsInfo = {};

	function Get3dDefects(idInsp){
		let view = document.getElementById("View3d");
		view.style.visibility = "visible";
		document.getElementById("borroso").style.display = 'block';
		if(document.getElementById("BoxCFG").style.visibility !='visible') document.getElementById("borroso").style.zIndex = "3";
		document.getElementById('imagen_cargando').style.visibility = "visible";
		var mode_ = mode;
		if(mode_ == FLAG_SCREENBLOB) mode_ = FLAG_FILTERRAWDEFECTS;
		coche_3d = idInsp;
		DefectsInfo = {};
		SendRequestAdm('{"info":"Get3dDefects", "idInsp":"'+ idInsp +'","mode":"'+mode_+'"}');
	}

	function animate() {renderer.render( scene, camera );}

	function cleanScene(){
		for (let i = scene.children.length - 1; i >= 0 ; i--) {
			let child = scene.children[i];
			scene.remove(child);
		}
		animate();
		return 0;
	}
	function mostrarFiltros() {
		// Cambiar el estilo de los divs
		document.getElementById("divColor1").style.display = "block";
		document.getElementById("divColor2").style.display = "block";
		document.getElementById("divModelos").style.display = "block";
		document.getElementById("FiltrosON").style.display = "none";
		document.getElementById("FiltrosOFF").style.display = "block";
	}

	function menosFiltros() {
		// Cambiar el estilo de los divs
		document.getElementById("divColor1").style.display = "none";
		document.getElementById("divColor2").style.display = "none";
		document.getElementById("divModelos").style.display = "none";
		document.getElementById("FiltrosOFF").style.display = "none";
		document.getElementById("FiltrosON").style.display = "block"; 
	}

	function initView3d(){
		let view = document.getElementById("panel3d");
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xfff0e7);
		renderer = new THREE.WebGLRenderer();
		const aspect = view.offsetWidth / view.offsetHeight;
		const d = 2000;
		camera = new THREE.OrthographicCamera( - d * aspect, d * aspect, d, - d, 1, 100000 );
		camera.up.set(0, 0, 1);

		renderer.setSize( view.offsetWidth, view.offsetHeight );
		view.appendChild( renderer.domElement );

		controls = new THREE.OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.autoRotate = true;
    	controls.autoRotateSpeed = 0.5;
		controls.addEventListener( 'change', animate );

		document.addEventListener("mouseup",() =>{
			if(document.getElementById('infoDefect').style.visibility != 'hidden'){
				document.getElementById('infoDefect').style.visibility = 'hidden';
			}
		}
		,false);
	}

	function onTouchDefect(event){
		let d = DefectsInfo[event.target.id];
		if(d != undefined){
			document.getElementById('infoDefect').style.visibility = 'visible';
			document.getElementById('infoDefect').style.top = event.origDomEvent.clientY;
			document.getElementById('infoDefect').style.left = event.origDomEvent.clientX;
			document.getElementById("idefx").innerHTML = d.x.toFixed(2);
			document.getElementById("idefy").innerHTML = d.y.toFixed(2);
			document.getElementById("idefz").innerHTML = d.z.toFixed(2);
			document.getElementById("idefs").innerHTML = d.tam.toFixed(2);
			document.getElementById("ideft").innerHTML = d.symbol;
		}
	}

	function show3d(idInsp, defects){
		let car = info_coches[idInsp];
		var loader = new THREE.STLLoader();
		let idimgs = IDIMG[car.modelo][car.variante];
		let promises = [];
		let geometrys = [];
		const loadAsync = url => {
			return new Promise(resolve => {
				loader.load(url, geometry => {
					let aux = url.split("\\");
					let name = aux[aux.length - 1];
					geometry.computeBoundingBox();
					geometry.computeVertexNormals();
					var mat = new THREE.MeshStandardMaterial({
						color: 0xffffff,
						emissive: 0x000000,
						metalness: 0.66,
						roughness: 0.1,
						opacity: 1.0,
						side: THREE.DoubleSide
					});
					var mesh = new THREE.Mesh( geometry, mat );
					mesh.name = name;
					geometrys.push(mesh);
					STLS[name] = mesh;
					resolve();
				})
			})
		}

		for(let i = 0; i<idimgs.length;i++){
			let nstl = abrevPlanta+'.'+car.modelo+'.'+idimgs[i][0]+idimgs[i][1]+'.stl';
			if(STLS[nstl] == undefined) {promises.push(loadAsync("C:\\J3D\\UI\\images\\cads\\" +nstl));}
			else geometrys.push(STLS[nstl]);
		}

		Promise.all(promises).then(() => {
			let middles = [];
			for(let i = 0; i<geometrys.length;i++){
				let mesh = geometrys[i];
				let mat = mesh.material;
				let zona = mesh.name[mesh.name.length - 6];
				if(zona == 2) {mat.color.setHex(Number("0x"+car.color_web2));}
				else mat.color.setHex(Number("0x"+car.color_web1));
				scene.add( mesh);
				var middle = new THREE.Vector3();
				mesh.geometry.boundingBox.getCenter(middle);
				middles.push(middle);
			}

			let x = 0;
			let y = 0;
			let z = 0;
			for(let i = 0; i<idimgs.length;i++){
				x += middles[i].x;
				y += middles[i].y;
				z += middles[i].z;
			}

			x /= idimgs.length;
			y /= idimgs.length;
			z /= idimgs.length;

			camera.position.x = x;
			camera.position.y = y;
			camera.position.z = z;
			camera.rotation.x = 0;
			camera.rotation.y = 0;
			camera.rotation.z = 0;
			camera.translateZ( 3000 );
			camera.translateY( -3000 );
			camera.lookAt(x,y,z);

			controls.target.set(x,y,z);

			var domEvents = new THREE.DomEvents(camera, renderer.domElement);
			// Defectos
			for (var i = 0; i < defects.length; i++) {
				let def = defects[i];
				let material;
				let sgeometry;
				switch(def.symbol){
					case 1: // peso suciedad
					case 5: // peso suciedad especial
						sgeometry = new THREE.TetrahedronGeometry(0);
						material = new THREE.MeshBasicMaterial({color: "red"});
					break;
					case 2: // peso bollo
					case 6: // peso bollo especial
						sgeometry = new THREE.TetrahedronGeometry(0);
						material = new THREE.MeshBasicMaterial({color: "blue"});
					break;  
					case 3: // peso otros
					case 7: // peso otros especial
						sgeometry = new THREE.TetrahedronGeometry(0);
						material = new THREE.MeshBasicMaterial({color: "green"});
					break;
					case 4: // tamaño
					case 8: // tamaño especial
						var size = def.tam;
						if (size > 4) size = 4;
						if (size < 1) size = 1;
 						sgeometry = new THREE.SphereGeometry(size * 10, 36, 16);
						material = new THREE.MeshBasicMaterial({color: "red", transparent: true, opacity: (size-1) * 0.5 / 4 + 0.5});
					break;
					case 9:  // smart rule 1
					case 11: // smart rule 1 especial
						sgeometry = new THREE.SphereGeometry(10, 36, 16);
						material = new THREE.MeshBasicMaterial({color: "magenta"});
					break;
					case 10: // smart rule 2
					case 12: // smart rule 2 especial
						sgeometry = new THREE.TorusGeometry(20, 7, 16, 100);
						material = new THREE.MeshBasicMaterial({color: "yellow"});
					break;
					case 15: // aspecto
					case 16: // aspecto especial
					case 17: // sin cubrir
					case 18: // sin cubrir especial
						sgeometry = new THREE.TorusGeometry(20, 7, 16, 100);
						material = new THREE.MeshBasicMaterial({color: "blue"});
					break;
					case 13: // tamaño descartado
					case 14: // tamaño descartado especial
						var size = def.tam;
						if (size > 4) size = 4;
						if (size < 1) size = 1;
						sgeometry = new THREE.SphereGeometry(size * 10, 36, 16);
						material = new THREE.MeshBasicMaterial({color: "cyan", transparent: true, opacity: (size-1) * 0.5 / 4 + 0.5});
					break;
				}
				var symbol = new THREE.Mesh(sgeometry, material);
				symbol.position.set(def.x, def.y, def.z);
				domEvents.addEventListener(symbol, 'mousedown', onTouchDefect, false);
				DefectsInfo[symbol.id] = def;
				scene.add(symbol);
			}
			
			
			let t = new THREE.Object3D();
			t.translateX(x);
			t.translateY(y);
			t.translateZ(z);

			let ccar = new THREE.Color( Number("0x"+car.color_web1) );
			let rlighint =  (1 - ccar.r) * 2.0 + 2.5;
			let intdlight = (1 - ccar.r) * 1.0 + 0.10;
			var rectLight = new THREE.RectAreaLight( 0xffffff, rlighint,  5000, 5000 );
			rectLight.position.set( x  - 4000, y, z);
			rectLight.lookAt( x, y, z );
			//rectLight.add( new THREE.RectAreaLightHelper( rectLight ) );
			scene.add( rectLight );

			rectLight = new THREE.RectAreaLight( 0xffffff, rlighint,  5000, 5000 );
			rectLight.position.set( x  + 4000, y, z);
			rectLight.lookAt( x, y, z );
			//rectLight.add( new THREE.RectAreaLightHelper( rectLight ) );
			scene.add( rectLight );

			rectLight = new THREE.RectAreaLight( 0xffffff, rlighint,  5000, 5000 );
			rectLight.position.set( x, y  - 4000, z);
			rectLight.rotateZ(Math.PI/2);
			rectLight.lookAt( x, y, z );
			//rectLight.add( new THREE.RectAreaLightHelper( rectLight ) );
			scene.add( rectLight );

			rectLight = new THREE.RectAreaLight( 0xffffff, rlighint,  5000, 5000 );
			rectLight.position.set( x, y  + 4000, z);
			rectLight.lookAt( x, y, z );
			//rectLight.add( new THREE.RectAreaLightHelper( rectLight ) ); // helper must be added as a child of the light
			scene.add( rectLight );

			rectLight = new THREE.RectAreaLight( 0xffffff, rlighint,  5000, 5000 );
			rectLight.position.set( x, y, z + 4000);
			rectLight.lookAt( x, y, z );
			//rectLight.add( new THREE.RectAreaLightHelper( rectLight ) ); // helper must be added as a child of the light
			scene.add( rectLight );

			
			let dirlight = new THREE.DirectionalLight( 0xffffff, intdlight );
			dirlight.target = t;
			dirlight.position.set(x - 4000, y + 4000, z + 2000);
			scene.add( dirlight );
			//scene.add( new THREE.DirectionalLightHelper( dirlight, 5 ));

			dirlight = new THREE.DirectionalLight( 0xffffff, intdlight );
			dirlight.target = t;
			dirlight.position.set(x + 4000, y + 4000, z + 2000);
			scene.add( dirlight );
			//scene.add( new THREE.DirectionalLightHelper( dirlight, 5 ));
			
			dirlight = new THREE.DirectionalLight( 0xffffff, intdlight );
			dirlight.target = t;
			dirlight.position.set(x + 4000, y - 4000, z + 2000);
			scene.add( dirlight );
			//scene.add( new THREE.DirectionalLightHelper( dirlight, 5 ));

			dirlight = new THREE.DirectionalLight( 0xffffff, intdlight );
			dirlight.target = t;
			dirlight.position.set(x - 4000, y - 4000, z + 2000);
			console.log(dirlight.target);
			scene.add( dirlight );
			//scene.add( new THREE.DirectionalLightHelper( dirlight, 5 ));

			let light = new THREE.AmbientLight(0xffffff, 1);
			scene.add(light);
			
			animate();
			document.getElementById('imagen_cargando').style.visibility = "hidden";
		});
	}

	function closeview3d(){
		let view = document.getElementById("View3d");
		document.getElementById('imagen_cargando').style.visibility = "hidden";
		view.style.visibility = "hidden";
		if(document.getElementById("Zoom_Inspecciones").style.visibility != 'visible') {
			if(document.getElementById('resultados').style.display == 'none' && document.getElementById('buscador').style.visibility == 'hidden')
			{document.getElementById("borroso").style.display = 'none';}
			document.getElementById("borroso").style.zIndex = "1";
		}
		cleanScene();
		coche_3d = 0;
	}

	function isInit(){return init;}

	ChargeAdm();
	return{
		zona_zoom,
		adelanta,
		retrasa,
		pagina_final,
		pagina_inicio,
		MuestraBuscador,
		BuscaResultados,
		Exit,
		CerrarResultados,
		ValSearchUI,
		ocultar,
		abreZoom,
		cerrarZoom,
		ActualizaZoom,
		imprimir,
		guardar,
		showUI,
		ocultarIframe,
		ChangePlace,
		mostrarFiltros,
		menosFiltros,
		ChangeDefects,
		SeleccionarColores,
		SeleccionarColores2,
		SeleccionarModelos,
		ChangeModeSizeDefects,
		ActAutoPrint,
		SeleccionarTodasVariantesModelo,
		ChangeRepLine,
		ShowBoxCFG,
		SeleccionarFlag,
		Get3dDefects,
		show3d,
		closeview3d,
		isInit,	
	}
}

export { CreateAdminUI };