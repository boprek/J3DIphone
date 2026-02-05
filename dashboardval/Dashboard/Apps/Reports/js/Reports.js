
/*
	Para crear un Reports es necesario tener un div con un id = Reports
*/
const CreateReports = (ip_server) => {

	var paramsRep = {}; //Parámetros de los Reportes que salen del archivo de configuracion
	var MSGRep = {};

	var name_lineas = [];
	var ModelsName = null;
	var ColorsName = null;
	var nSelColors = 0;
	var nSelModels = 0;
	var htmlColors = [];
	var htmlColors2 = [];
	var htmlModels = [];
	var ColorsByID_color = {};
	var ColorsByID_colorweb = {};
	var ModelsByID_model = {};

	var rtType = 1;
	var tDefects = 7;
	var models = "";
	var colors = "";
	var colors2 = "";
	var colors2_aux = ""; //Esta variable guarda colores y colores2, segun si se ha seleccionado MONOTONO o BITONO
	var bitono = null;
	var selOneCar = 1;
	var lineas = "";
	var dateOneCar = "";
	var valueOneCar = "";
	var dateIni = "";
	var dateFin = "";
	var chartgenerated = false;

	var nColorsSelected = 0;				
	var disableColors = false;	
	var nColorsSelected2 = 0;				
	var disableColors2 = false;	
	var Plots = [];
	var svgsHeat = []; //Almacena las svgs del HeatMap, se hace porque sino al doblar los svgs las máscaras no se aplican bien
	var showed = 0; //Numero de heatmaps que se estan mostrando 

	var init = false; //Variable que determina si los reports se ha inicializado ya
	var socketReports; //Socket de los reportes
	var requestsReports = {};	//Peticiones del admin
	var idRep = BigInt(Math.floor(Math.random() * 10000)); //Id del Admin
	var TimeoutReports = 10000 //Ms de timeout de las requests que manda
	var InfoPlanta = {}; // Información de la planta

	var FLAG_DEFECTBLOB = 0x1n;
	var FLAG_WEIGHTDEFECTS  = 0x2n;
	var mode = FLAG_DEFECTBLOB; // Por defecto se muestran los defectos de tamaño (Si se quieren los defectos del blob añadir el flag FLAG_DEFECTBLOB)

	//------------WEBSOCKET---------------//

	function SendRequestRep(request){
		var json = {"id":(idRep).toString()};
		json = {...json, ...JSON.parse(request)};
		json = JSON.stringify(json);
		requestsReports[idRep] = {date:new Date(), request: json};
		idRep = (idRep+1n) & 0xFFFFFFFFn;
		if(!(socketReports.readyState == WebSocket.OPEN)) return -1;
		socketReports.send(json);
		return 0;
	}

	function ProcessTimeOutRep(data){
		switch(data["info"]){
			case "Reports":
				BeforeGenerate(false);
			break;
		}
		delete requestsReports[data["id"]];
	}

	async function CheckRequestRep(){
		while(true){
			for(const id in requestsReports){
				if((new Date() - requestsReports[id].date) > TimeoutReports){
					ProcessTimeOutRep(JSON.parse(requestsReports[id].request));
				}
			}
			await new Promise(r => setTimeout(r, 1000));
		}
	}
	
	function ProcessMSGReports(msg) {
		var response = JSON.parse(msg);
		var data = JSON.parse(DecodeResponse(response["data"]));
		console.log(data);
		delete requestsReports[response["id"]];
		let res;
		switch(data["info"]){
			case "ResultadoReadFile":
				switch(data["type"]){
					case "html":
						document.getElementById("Reports").innerHTML = DecodeBase64(data["content"]);
						SendRequestRep('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/Reports/version","type":"version"}');
					break;
					case "version":
						document.getElementById("reportsversion").innerHTML = DecodeBase64(data["content"]);
						let abrevPlanta = InfoPlanta.planta.substring(0,3);
						abrevPlanta = abrevPlanta[0].toUpperCase() + abrevPlanta.slice(1);
						SendRequestRep('{"info":"ReadFile", "path": "C:/J3D/Dashboard/Apps/Reports/'+ abrevPlanta +'.Reports.cfg","type":"cfg"}');
					break;
					case "cfg":
						paramsRep = FillParams(DecodeBase64(data["content"]));
						SendRequestRep('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/Reports/translation/'+ paramsRep['Language'] +'.lang","type":"translation"}');	
					break;
					case "translation":
						MSGRep = SetTranslate(DecodeBase64(data["content"]));
						InitApp();	//Inicializar Reports
						init = true;
					break;
				}
			break;
			case "ResultadoInfoPlanta":
				InfoPlanta = data;
				SendRequestRep('{"info":"ReadFile", "path":"C:/J3D/Dashboard/Apps/Reports/Reports.html","type":"html"}');
			break;
			case "ResultadoReports":
				switch(parseInt(data["type"])){
					case 1:
						generateOneCarReport(data);
						break;
					case 2:
						generateHeatMapReport(data);
						break;
					case 3:
						generateNewStatsReport(data);
						break;
					case 4:
						generateBarChartReport(data, false);	
						break;						
					case 5:
						generatePieChartReport(data);
						break;
					case 6:
						generateBarChartReport(data, true);
						break;
					case 7:
						generateMeanChart(data);
						break;
					default: 
						break;
				}
				break;
			
		}
	}

	async function OpenReports(event){
		SendRequestRep('{"info":"Name", "Name": "Reports"}');
		await new Promise(r => setTimeout(r, 100));
		if(!init) {SendRequestRep('{"info":"InfoPlanta"}');}
	}

	async function connectWSRep(){
		socketReports = new WebSocket('ws://' + ip_server);
		
		// Connection opened
		socketReports.addEventListener('open', async function(event) {OpenReports(event.data)});
		
		socketReports.addEventListener('close', async function(event) {
			setTimeout(function() {
				connectWSRep();
			}, 1000);
		});
		
		// Listen for messages
		socketReports.addEventListener('message', async function(event){
			ProcessMSGReports(event.data);
		});
	}

	async function ChargeRep(){
		CheckRequestRep();
		connectWSRep();
	}

	//------------------------------------//

	function rgb2grey(color)
	{
		var r = parseInt("0x" + color.substr(1,2));
		var g = parseInt("0x" + color.substr(3,2));
		var b = parseInt("0x" + color.substr(5,2));

		return 0.3*r + 0.6*g + 0.1*b
	}
	function timenow() {
		var now = new Date(),ampm = 'am',h = now.getHours(),m = now.getMinutes(),s = now.getSeconds();	
		if (m < 10) m = '0' + m;
		if (s < 10) s = '0' + s;
		return now.toLocaleDateString() + ' ' + h + ':' + m + ':' + s;
	}
	function validateFinalValues()
	{
		if (!tDefects) return 6;
		var MonoTon = document.getElementById('MonoTon').checked;
		var BitonTon = document.getElementById('BiTon').checked;
		var BiTonExt = document.getElementById('BiTonExt').checked;
		if (!MonoTon && !BitonTon && !BiTonExt) return 67;
		
		switch (selOneCar) {
			case 0:
				if (rtType != 1) {
					if (new Date(dateIni).getTime() > Date.now()) return 2;
					if (colors == null) return 7;
					if (models == null) return 8;
					
				}
				if ((lineas) == null && (document.getElementById("divLigne").style.visibility == 'visible')) return 9;									
				break;
			case 1: if (valueOneCar.length != 8) return 3; break;
			case 2: if (!valueOneCar.length || valueOneCar.match(/^([0-9])*$/)==null) return 4; break;
			case 3: if (!valueOneCar.length || valueOneCar.match(/^RJB[0-9]{11}$/) == null) return 5;
    	break;
			
		}
		return 0;
	}

	Date.prototype.dateAdd = function(size,value) {
		value = parseInt(value);
		var incr = 0;
		switch (size) {
			case 'day':
					incr = value * 24;
					this.dateAdd('hour',incr);
					break;
			case 'hour':
					incr = value * 60;
					this.dateAdd('minute',incr);
					break;
			case 'week':
					incr = value * 7;
					this.dateAdd('day',incr);
					break;
			case 'minute':
					incr = value * 60;
					this.dateAdd('second',incr);
					break;
			case 'second':
					incr = value * 1000;
					this.dateAdd('millisecond',incr);
					break;
			case 'month':
					value = value + this.getMonth();
					if (value/12>0) {
						this.dateAdd('year',value/12);
						value = value % 12;
					}
					this.setMonth(value);
					this.dateAdd('minute',-this.getTimezoneOffset());
					break;
			case 'millisecond':
					this.setTime(this.getTime() + value);
					break;
			case 'year':
					this.setFullYear(this.getUTCFullYear()+value);
					break;
			default:
					throw new error('Invalid date increment passed');
					break;
		}
	}

	function OnChangeReportType(htmlInput)
	{
		var elem;
		switch (htmlInput.id) {
			case "rtOneCar": 
				rtType = 1;
				document.getElementById('selVins').disabled = true;
				document.getElementById('selVins').checked = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').disabled = false;
				break;							
			case "rtHeatMap": 
				rtType = 2;	
				document.getElementById('selVins').disabled = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').checked = true;
				break;
						
			case "rtStats": 
				rtType = 3;
				document.getElementById('selVins').disabled = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').checked = true;
				break;		
			case "rtBar": 
				rtType = 4; 
				document.getElementById('selVins').disabled = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').disabled = false;
				document.getElementById('selMulti').checked = true;
				break;
			case "rtBarII": 
				rtType = 6;
				document.getElementById('selVins').disabled = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').disabled = false;
				document.getElementById('selMulti').checked = true;
				break;
			case "rtPie": 
				rtType = 5;
				document.getElementById('selVins').checked = true;
				elem = document.getElementById('defTodos');
				if(!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defDirt');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defCrater');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defDescolgon');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defGota');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defFibra');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defHervido');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defRoce');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defEspolvoreado');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defFaltaColor');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defPielNaranja');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defLineaCorteBitono');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defDesconchado');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defPinholes');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defCoquera');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defRayas');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defBollo');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defOtrosChapa');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;
				elem = document.getElementById('defOtrosPintura');
				if (!elem.checked) elem.checked = true;
				elem.disabled = true;									
				break;
			case "rtMean": 
				rtType = 7;
				document.getElementById('selVins').disabled = true;
				document.getElementById('selSkid').disabled = true;
				document.getElementById('selDFV').disabled = true;
				document.getElementById('selMulti').checked = true;
				break;					
		}
		if (rtType != 2 && rtType !=3 && rtType != 7  && rtType != 6) {
			document.getElementById('selVins').disabled = false;
			document.getElementById('selSkid').disabled = false;
			document.getElementById('selDFV').disabled = false;
		}
		if (rtType !=2 && rtType != 3 && rtType !=7) {
			document.getElementById('defTodos').disabled = false;	
			document.getElementById('defDirt').disabled = false;
			document.getElementById('defCrater').disabled = false;
			document.getElementById('defDescolgon').disabled = false;
			document.getElementById('defGota').disabled = false;
			document.getElementById('defFibra').disabled = false;
			document.getElementById('defHervido').disabled = false;
			document.getElementById('defRoce').disabled = false;
			document.getElementById('defEspolvoreado').disabled = false;
			document.getElementById('defFaltaColor').disabled = false;
			document.getElementById('defPielNaranja').disabled = false;
			document.getElementById('defLineaCorteBitono').disabled = false;
			document.getElementById('defDesconchado').disabled = false;
			document.getElementById('defPinholes').disabled = false;
			document.getElementById('defCoquera').disabled = false;
			document.getElementById('defRayas').disabled = false;
			document.getElementById('defBollo').disabled = false;
			document.getElementById('defOtrosChapa').disabled = false;
			document.getElementById('defOtrosPintura').disabled = false;
			document.getElementById('defOtrosChapa').disabled = false;						
		}
		OnChangeMultiCriterio();
	}

	function OnChangeDate(htmlDate)
	{		
		var other = null;
		var dat = null;
		
		if (htmlDate.id == "dateFin") {
			other = document.getElementById("dateIni");
			dat = new Date(getDateStr(htmlDate));
			dat.dateAdd('month',-1);
			other.min = dat.toISOString().substr(0,16);
			other.max = htmlDate.value;
			if (other.value < other.min) other.value = other.min;
			else if (other.value > other.max) other.value = other.max;
		}
	}

	function OnChangeCheckboxColorsAll(htmlInput)
	{				
		disableColors = true;
		if (htmlInput.checked) {
			for (i = 0; i<htmlColors.length; i++) {					
				htmlColors[i].checked = true;
			}
			nColorsSelected = htmlColors.length;
		} else {
			for (i = 0; i<htmlColors.length; i++) {
				htmlColors[i].checked = false;
			}
			nColorsSelected = 0;
		}					
		disableColors = false;
	}
	function OnChangeCheckboxColors(event)
	{				
		if (!disableColors) {
			var htmlInput = event.target;
			if (htmlInput.checked) nColorsSelected++;
			else nColorsSelected--;
			
			var colAll = document.getElementById("col0");						
			if (htmlColors.length == nColorsSelected) {
				colAll.onchange = null;
				colAll.checked = true;
				colAll.onchange = function() { OnChangeCheckboxColorsAll(colAll)};
			} else if (colAll.checked) {
				var colAll = document.getElementById("col0");
				colAll.onchange = null;
				colAll.checked = false;
				colAll.onchange = function() { OnChangeCheckboxColorsAll(colAll)};							
			}

		}
	}

	function OnChangeCheckboxColorsAll2(htmlInput2)
	{				
		disableColors2 = true;
		if (htmlInput2.checked) {
			for (i = 0; i<htmlColors2.length; i++) {					
				htmlColors2[i].checked = true;
			}
			nColorsSelected2 = htmlColors2.length;
		} else {
			for (i = 0; i<htmlColors2.length; i++) {
				htmlColors2[i].checked = false;
			}
			nColorsSelected2 = 0;
		}					
		disableColors2 = false;
		
	}
	function OnChangeCheckboxColors2(event)
	{		
		if (!disableColors2) {
			var htmlInput2 = event.target;
			if (htmlInput2.checked) nColorsSelected2++;
			else nColorsSelected2--;
			
			var colAll = document.getElementById("2col0");						
			if (htmlColors2.length == nColorsSelected2) {
				colAll.onchange = null;
				colAll.checked = true;
				colAll.onchange = function() { OnChangeCheckboxColorsAll2(colAll)};
			} else if (colAll.checked) {
				var colAll = document.getElementById("2col0");
				colAll.onchange = null;
				colAll.checked = false;	
				colAll.setAttribute('onchange', 'Reports.OnChangeCheckboxColorsAll2(colAll)');					
			}

		}
	}

	function OnChangeMultiCriterio()
	{
		var htmlInput = document.getElementById("selMulti");
		if (htmlInput.checked) {
			document.getElementById("divLigne").style.display = "block";						
			document.getElementById("selValue").style.visibility = "hidden";
			if (rtType == 1) {					
				document.getElementById("divDateOneCar").style.display = "inline";							
				document.getElementById("divMultiCriterio").style.display = "none";
				document.getElementById("divRange").style.display = "none";						
			} else if(rtType == 7){
				document.getElementById("divDateOneCar").style.display = "none";								
				document.getElementById("divMultiCriterio").style.display = "inline";
				document.getElementById("divRange").style.display = "block";	
			}else {					
				document.getElementById("divDateOneCar").style.display = "none";								
				document.getElementById("divMultiCriterio").style.display = "inline";
				document.getElementById("divRange").style.display = "none";	
			}
		} else {
			document.getElementById("selValue").style.visibility = "visible";
			document.getElementById("divMultiCriterio").style.display = "none";
			document.getElementById("divLigne").style.display = "none";
			document.getElementById("divDateOneCar").style.display = "none";
		}
	}
	
	function OnChangeTypeDefect(htmlInput)
	{
		switch (htmlInput.id) {
			case "defDirt":
				if (htmlInput.checked) tDefects |= 0x01; else tDefects = tDefects &= ~0x01;	break;
				
			case "defCrater":
				if (htmlInput.checked) tDefects |= 0x02; else tDefects = tDefects &= ~0x02;	break;
				
			case "defDescolgon":
				if (htmlInput.checked) tDefects |= 0x04; else tDefects = tDefects &= ~0x03;	break;

			case "defGota":
				if (htmlInput.checked) tDefects |= 0x08; else tDefects = tDefects &= ~0x04;	break;
			
			case "defFibra":
				if (htmlInput.checked) tDefects |= 0x10; else tDefects = tDefects &= ~0x05;	break;

			case "defHervido":
				if (htmlInput.checked) tDefects |= 0x20; else tDefects = tDefects &= ~0x06;	break;

			case "defRoce":
				if (htmlInput.checked) tDefects |= 0x40; else tDefects = tDefects &= ~0x07;	break;
	
			case "defEspolvoreado":
				if (htmlInput.checked) tDefects |= 0x80; else tDefects = tDefects &= ~0x08;	break;
			
			case "defFaltaColor":
				if (htmlInput.checked) tDefects |= 0x100; else tDefects = tDefects &= ~0x09;	break;
	
			case "defPielNaranja":
				if (htmlInput.checked) tDefects |= 0x200; else tDefects = tDefects &= ~0x10;	break;

			case "defLineaCorteBitono":
				if (htmlInput.checked) tDefects |= 0x400; else tDefects = tDefects &= ~0x11;	break;
			
			case "defDesconchado":
				if (htmlInput.checked) tDefects |= 0x800; else tDefects = tDefects &= ~0x12;	break;
			
			case "defPinholes":
				if (htmlInput.checked) tDefects |= 0x1000; else tDefects = tDefects &= ~0x13;	break;
	
			case "defCoquera":
				if (htmlInput.checked) tDefects |= 0x2000; else tDefects = tDefects &= ~0x14;	break;

			case "defRayas":
				if (htmlInput.checked) tDefects |= 0x4000; else tDefects = tDefects &= ~0x15;	break;
		
			case "defBollo":
				if (htmlInput.checked) tDefects |= 0x8000; else tDefects = tDefects &= ~0x16;	break;
			
			case "defOtrosChapa":
				if (htmlInput.checked) tDefects |= 0x10000; else tDefects = tDefects &= ~0x17;	break;
			
			case "defOtrosPintura":
				if (htmlInput.checked) tDefects |= 0x20000; else tDefects = tDefects &= ~0x18;	break;
	
				
		}
		
	}	
	function getDateStr(dateHTML)
	{
		var tmp = dateHTML.value.replace("T"," ");
		if (tmp.length < 18) tmp = tmp + ":00";
		
		return tmp;
	}
	function getIDFromHTMLInput(htmlInput)
	{
		return htmlInput.id.substr(3);
	}

	function desplegar()
	{			
		var params = document.getElementById("paramsID");
		if (params.style.display == "none") {
			params.style.display = "block";
		} else params.style.display = "none";
	}

	function InitApp(data) {

		// Modo del boton de defectos
		switch(paramsRep['Size']){
			case "0":
				mode = FLAG_WEIGHTDEFECTS;
				document.getElementById("boton_ChangeDefects").style.display = 'none';
				break;
			case "1":
				mode = FLAG_DEFECTBLOB;
				document.getElementById("boton_ChangeDefects").style.display = 'none';
				break;
			case "2":
				mode = FLAG_DEFECTBLOB;
				break;
		}

		let modelos = {};
		InfoPlanta.Modelos.map(m => modelos[m.modelo] = m.id_modelo);
		let ModelsName = InfoPlanta.Modelos.filter((value, index, self) => self[index].codigo_modelo < 999)
		.map(m => m.modelo).filter((value, index, self) => self.indexOf(value) === index);
		let colores = InfoPlanta.Colores;
		let colores1 = [];
		let colores2 = [];
		for (let i=0; i<colores.length; i++) {
			if((paramsRep['ShowAsociado'] == '0') && BigInt(colores[i].flags) & 0x01n) continue; // Si es asociado y esta desactivado, no se añade
			if(BigInt(colores[i].flags) & 0x02n) {colores1.push(colores[i])}
			if(BigInt(colores[i].flags) & 0x04n) {colores2.push(colores[i])}
		}

		var abrev = "";
		var id = 0;
		var label = null;
		var divColors = document.getElementById("divColors");
		for (i=0; i<colores1.length; i++) {
			htmlColors[i] = document.createElement("input");
			htmlColors[i].type = "checkbox";
			id = colores1[i].id_color;
			htmlColors[i].id = "col" + id;
			htmlColors[i].checked = true;
			htmlColors[i].onchange = function(ev) { OnChangeCheckboxColors(ev); };
			htmlColors[i].style.marginLeft = 10;
			divColors.appendChild(htmlColors[i]);
			label = document.createElement("label");
			label.htmlFor = htmlColors[i].id;
			label.innerHTML = " " + colores1[i].color;
			divColors.appendChild(label);					
			divColors.appendChild(document.createElement("br"));
			abrev = ColorsByID_color[id] = colores1[i].codigo_color;
			ColorsByID_colorweb[abrev] = "#" + colores1[i].color_web;						
		}
		divColors.appendChild(document.createElement("br"));
		nColorsSelected = colores1.length;
		

		var divColors2 = document.getElementById("divColors2");
		for (i=0; i<colores2.length; i++) {
			htmlColors2[i] = document.createElement("input");
			htmlColors2[i].type = "checkbox";
			id = colores2[i].id_color;
			htmlColors2[i].id = "co2" + id;
			htmlColors2[i].checked = true;
			htmlColors2[i].onchange = function(ev) { OnChangeCheckboxColors2(ev); };
			htmlColors2[i].style.marginLeft = 10;
			divColors2.appendChild(htmlColors2[i]);
			label = document.createElement("label");
			label.htmlFor = htmlColors2[i].id;
			label.innerHTML = " " + colores2[i].color;
			divColors2.appendChild(label);					
			divColors2.appendChild(document.createElement("br"));
			abrev = ColorsByID_color[id] = colores2[i].codigo_color;
			ColorsByID_colorweb[abrev] = "#" + colores2[i].color_web;								
		}
		

		divColors.appendChild(document.createElement("br"));
		nColorsSelected2 = colores2.length;
		if(nColorsSelected2 < 2) 
		if(colores2.length == 0){
			document.getElementById("selecBiton").style.display = 'none';
			document.getElementById("BoxColors2").style.display = 'none';
			document.getElementById('BiTon').checked = false;
		}else if(nColorsSelected2 < 2) {document.getElementById("BoxColors2").style.display = 'none';}
		
		var divModels = document.getElementById("divModels");
		for (i=0; i<ModelsName.length; i++) {
			htmlModels[i] = document.createElement("input");
			htmlModels[i].type = "checkbox";
			id = modelos[ModelsName[i]];
			htmlModels[i].id = "mod" + id;
			htmlModels[i].checked = true;
			htmlModels[i].style.marginLeft = 10;
			divModels.appendChild(htmlModels[i]);
			label = document.createElement("label");
			label.htmlFor = htmlModels[i].id;
			label.innerHTML = " " + ModelsName[i];
			divModels.appendChild(label);
			divModels.appendChild(document.createElement("br"));
			ModelsByID_model[id] = ModelsName[i];
		}
		
		var now = new Date(Date.now());
		var nowBefore = new Date(now);
		nowBefore.dateAdd('month',-1);
		var dateHTML = document.getElementById("dateFin");
		dateHTML.value = now.toISOString().substr(0,16);
		OnChangeDate(dateHTML);					

		dateHTML = document.getElementById("dateOneCar");
		dateHTML.value = now.toISOString().substr(0,16);
		
		models = getIDFromHTMLInput(htmlModels[0]);
		for (i=1; i<htmlModels.length; i++) models = models + "," + getIDFromHTMLInput(htmlModels[i]);
		colors = "0";

		Planta = InfoPlanta.planta[0].toUpperCase() + InfoPlanta.planta.substr(1);
		document.getElementById("NombrePlanta").innerHTML = Planta;

		
		if(!paramsRep['Lines'] || paramsRep['Lines'] == 0) {document.getElementById('divLigne').style.visibility = 'hidden';}
		else{
			name_lineas = paramsRep['Lines'].split(',');
			if (name_lineas.length <= 1) {document.getElementById('divLigne').style.visibility = 'hidden';}
			if(name_lineas.length > 0) {
				document.getElementById('linA').checked = true;
				document.getElementById('dlinA').style.display = 'inline';
				document.getElementById('linAl').innerHTML += name_lineas[0];
			}
			if(name_lineas.length > 1) {
				document.getElementById('linB').checked = true;
				document.getElementById('dlinB').style.display = 'inline';
				document.getElementById('linBl').innerHTML += name_lineas[1];
			}
			if(name_lineas.length > 2) {
				document.getElementById('linC').checked = true;
				document.getElementById('dlinC').style.display = 'inline';
				document.getElementById('linCl').innerHTML += name_lineas[2];
			}
			if(name_lineas.length > 3) {
				document.getElementById('linD').checked = true;
				document.getElementById('dlinD').style.display = 'inline';
				document.getElementById('linDl').innerHTML += name_lineas[3];
			}
		}
		
		if(!parseInt(paramsRep['BitonExt'])){document.getElementById('divBitonExt').style.display = 'none';}
	}

	function selectAllSubcat(mainCheckbox) {
		const isChecked = mainCheckbox.checked;
		const checkboxes = document.querySelectorAll('input[name="def"]');
		checkboxes.forEach(checkbox => {
			checkbox.checked = isChecked;
		});
	}

	function getFinalValues()
	{	
		tDefects = 0;
		if(rtType == 2 || rtType == 3 || rtType == 7){
			if (document.getElementById('defDirt').checked) tDefects |= 0x01;
			if (document.getElementById('defCrater').checked) tDefects |= 0x02;
			if (document.getElementById('defDescolgon').checked) tDefects |= 0x04;
		} else {
			if (document.getElementById('defDirt').checked) tDefects |= 0x01;
			if (document.getElementById('defCrater').checked) tDefects |= 0x02;
			if (document.getElementById('defDescolgon').checked) tDefects |= 0x04;
			if (document.getElementById('defGota').checked) tDefects |= 0x08;
			if (document.getElementById('defFibra').checked) tDefects |= 0x10;
			if (document.getElementById('defHervido').checked) tDefects |= 0x20;
			if (document.getElementById('defRoce').checked) tDefects |= 0x40;
			if (document.getElementById('defEspolvoreado').checked) tDefects |= 0x80;
			if (document.getElementById('defFaltaColor').checked) tDefects |= 0x100;
			if (document.getElementById('defPielNaranja').checked) tDefects |= 0x200;
			if (document.getElementById('defLineaCorteBitono').checked) tDefects |= 0x400;
			if (document.getElementById('defDesconchado').checked) tDefects |= 0x800;
			if (document.getElementById('defPinholes').checked) tDefects |= 0x1000;
			if (document.getElementById('defCoquera').checked) tDefects |= 0x2000;
			if (document.getElementById('defRayas').checked) tDefects |= 0x4000;
			if (document.getElementById('defBollo').checked) tDefects |= 0x8000;
			if (document.getElementById('defOtrosChapa').checked) tDefects |= 0x10000;
			if (document.getElementById('defOtrosPintura').checked) tDefects |= 0x20000;
		}
		


		// Si colors2 no tiene en cuenta el color2 por lo que busca solo por color base
		// Para que busque colores bitonos hay que poner en color el color base y en color2 el color del bitonos
		// Para que busque únicamete los monotonos el color y el color2 tienen que ser iguales
		var MonoTon = document.getElementById('MonoTon').checked;
		var BitonTon = document.getElementById('BiTon').checked;
		var BitonTonExt = document.getElementById('BiTonExt').checked;

		//Cargo los bitonos que están activos
		bitono = null;
		if(MonoTon) bitono = '0';
		if(BitonTon){
			if(!bitono) bitono = '1';
			else bitono += ',' + '1'
		}
		if(BitonTonExt){
			if(!bitono) bitono = '2';
			else bitono += ',' + '2'
		}

		colors = null; 
		for (i=0; i<htmlColors.length; i++) {
			if (htmlColors[i].checked) {
				if (colors != null) colors = colors + "," + getIDFromHTMLInput(htmlColors[i]);
				else colors = getIDFromHTMLInput(htmlColors[i]);
			}
		}
		
		colors2 = null; 
		for (i=0; i<htmlColors2.length; i++) {
			if (htmlColors2[i].checked) {
				if (colors2 != null) colors2 = colors2 + "," + getIDFromHTMLInput(htmlColors2[i]);
				else colors2 = getIDFromHTMLInput(htmlColors2[i]);
			}
		}
		colors2_aux = colors2;
		if(BitonTon && MonoTon) colors2_aux = colors2 + ',' + colors
		else if(MonoTon) colors2_aux = colors
		
		models = null;
		for (i=0; i<htmlModels.length; i++) {
			if (htmlModels[i].checked) {
				if (models != null) models = models + "," + getIDFromHTMLInput(htmlModels[i]);
				else models = getIDFromHTMLInput(htmlModels[i]);
			}
		}					

		selOneCar = 0;															// multicriterio
		if (document.getElementById('selVins').checked) selOneCar = 1;			// vins
		else if (document.getElementById('selSkid').checked) selOneCar = 2;		// skid
		else if (document.getElementById('selDFV').checked) selOneCar = 3;	// DFV
		
		let lines = [];
		if (document.getElementById('linA').checked) lines.push(name_lineas[0]);
		if (document.getElementById('linB').checked) lines.push(name_lineas[1]);
		if (document.getElementById('linC').checked) lines.push(name_lineas[2]);
		if (document.getElementById('linD').checked) lines.push(name_lineas[3]);

		lineas = null;
		for (i=0; i<lines.length; i++) {
			if (lineas != null) lineas = lineas + "," + lines[i];
			else lineas = lines[i];
		}	
		if(document.getElementById('divLigne').style.visibility == 'hidden') {lineas = null;}

		dateOneCar = getDateStr(document.getElementById('dateOneCar'));
		dateIni = getDateStr(document.getElementById('dateIni'));
		dateFin = getDateStr(document.getElementById('dateFin'));
		console.log(tDefects);
		
		valueOneCar = document.getElementById("carValue").value;
	}

	function selectAllSubcat(mainCheckbox) {
		const isChecked = mainCheckbox.checked;
		const checkboxes = document.querySelectorAll('input[name="def"]');
		checkboxes.forEach(checkbox => {
			checkbox.checked = isChecked;
		});
	}
	
	function removeModeBarContainerFromPlotly()
	{
		var elems = document.getElementsByClassName("modebar-container");
		for (i=elems.length-1; i>=0; i--) elems[i].remove();
	}

	function generateOneCarReport(data)
	{	
		try {
			ndefects = atob(data.ndefects);
		} catch (error) {
			if (error instanceof DOMException && error.name === "InvalidCharacterError") {
				alert(MSGRep[11]);
				desplegar();
				BeforeGenerate(false);
				return false;
			}
		}
		var arr = [];
		var buf = Uint8Array.from(atob(data.ndefects), c => c.charCodeAt(0));
		var nsubcat = (buf.length-2)/(2*7);
		console.log(nsubcat);
		for (k = 0; k < buf.length; k += 2) arr[k >> 1] = buf[k] + buf[k + 1] * 256;
		let defects = [0,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
		defects[0] = arr[0];
		for(let i=0;i<6;i++){
			for(let j=0;j<nsubcat;j++){
				const subcat = {
					1: 1,
					2: 2,
					3: 1,
					4: 3,
					5: 3,
					6: 4,
					7: 5,
					8: 6,
					9: 17,
					10: 18,
					11: 4,
					12: 4,
					13: 4,
					14: 15,
					15: 18,
					16: 16,
					17: 17,
					18: 14,
					19: 17,
					20: 4,
					21: 8,
					22: 18,
					23: 9,
					24: 9,
					25: 9,
					26: 10,
					27: 11,
					28: 12,
					29: 14,
					30: 18,
					31: 7,
					32: 13,
					33: 3
				};
				//console.log(subcat);
				defects[i+1][subcat[j]] = arr[4*i + j + 1];
				defects[i+1][0] += defects[i+1][subcat[j]];
			}
		}
		
		document.getElementById('divPlotly2').style.borderWidth = 0;					
		printPlot1 = document.getElementById('divPlotly1');
		printPlot2 = document.getElementById('divPlotly2');
		printPlot1.style.width = 1400;
		printPlot2.style.borderTopWidth = "0px";
		document.getElementById('divPlotly2').style.width = 510;
		printPlot1 = document.getElementById('printDivPlotly1');
		printPlot2 = document.getElementById('printDivPlotly2');
		
		printPlot1.style.margin = printPlot2.style.margin = 0;
		printPlot1.style.width = "220mm";
		printPlot2.style.width = "97mm";					
		printPlot2.style.marginLeft = "-20mm";
		printPlot2.style.borderTopWidth = "0px";
		document.getElementById('printPlots').style.display = "flex";						
							
		var layout = {title: {text: MSGRep[39],
			font:{size:16}}, 
			yaxis: {title: {text: MSGRep[45], font:{size:16}}, fixedrange: true}, 
			xaxis: {title: {text:"",font:{size:16}}, fixedrange: true}, 
			legend: {orientation:"h", x: 0.1, xanchor: 'top', y: 1.04}, 
			barmode: 'group', 
			plot_bgcolor:'rgba(0,0,0,0)',  
			paper_bgcolor:'rgba(0,0,0,0)',
			shapes: [
				{ type: 'line', x0: 0.5, x1: 0.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 1.5, x1: 1.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 2.5, x1: 2.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 3.5, x1: 3.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } }
			],
			};

		layout.xaxis.title.text = MSGRep[73] + data.model + MSGRep[74] + ColorsByID_color[data.id_color] + "'";
		
		var series = [];
		var s1 = null;
		var s2 = null;
		var s3 = null;
		var s4 = null;
		var s5 = null;
		var s6 = null;
		var s7 = null
		var s8 = null;
		var s9 = null;
		var s10 = null;
		var s11 = null;
		var s12 = null;
		var s13 = null		
		var s14 = null;
		var s15 = null;
		var s16 = null;
		var s17 = null;
		var s18 = null;

		let total_defects = 0;
		if (tDefects & 0x01) {
            s1 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[20], type: 'bar', marker:{color: 'rgb(214,39,40)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s1.y[i-1] = defects[i][1];
            s1.text = s1.y.map(value => value === 0 ? '' : String(value));
			//s1.text = s1.y.map(String);
            series.push(s1);
        }
        if (tDefects & 0x02) {
            s2 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[21], type: 'bar', marker:{color: 'rgb(31,119,180)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s2.y[i-1] = defects[i][2];
            s2.text = s2.y.map(value => value === 0 ? '' : String(value));
            //s2.text = s2.y.map(String);
			series.push(s2);                        
        }
        if (tDefects & 0x04) {
            s3 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[22], type: 'bar', marker:{color: 'rgb(44,160,44)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s3.y[i-1] = defects[i][3];
            s3.text = s3.y.map(value => value === 0 ? '' : String(value));
            //s3.text = s3.y.map(String);
			series.push(s3);
        }
        if (tDefects & 0x08) {
            s4 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[23], type: 'bar', marker:{color: 'rgb(128, 64, 175)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s4.y[i-1] = defects[i][4];
            s4.text = s4.y.map(value => value === 0 ? '' : String(value));
            //s4.text = s4.y.map(String);
			series.push(s4);                    
        }
        if (tDefects & 0x10) {
            s5 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[24], type: 'bar', marker:{color: 'rgb(255, 87, 34)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s5.y[i-1] = defects[i][5];
            s5.text = s5.y.map(value => value === 0 ? '' :String(value));
            //s5.text = s5.y.map(String);
			series.push(s5);                        
        }
        if (tDefects & 0x20) {
            s6 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[25], type: 'bar', marker:{color: 'rgb(23, 162, 184)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s6.y[i-1] = defects[i][6];
            s6.text = s6.y.map(value => value === 0 ? '' : String(value));
            //s6.text = s6.y.map(String);
			series.push(s6);                        
        }
        if (tDefects & 0x40) {
            s7 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[26], type: 'bar', marker:{color: 'rgb(245, 203, 92)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s7.y[i-1] = defects[i][7];
            s7.text = s7.y.map(value => value === 0 ? '' : String(value));
            //s7.text = s7.y.map(String);
			series.push(s7);                        
        }
        if (tDefects & 0x80) {
            s8 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[27], type: 'bar', marker:{color: 'rgb(211, 47, 47)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s8.y[i-1] = defects[i][8];
            s8.text = s8.y.map(value => value === 0 ? '' : String(value));
            //s8.text = s8.y.map(String);
			series.push(s8);                        
        }
        if (tDefects & 0x100) {
            s9 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[28], type: 'bar', marker:{color: 'rgb(66, 165, 245)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s9.y[i-1] = defects[i][9];
            s9.text = s9.y.map(value => value === 0 ? '' : String(value));
            //s9.text = s9.y.map(String);
			series.push(s9);                        
        }
        if (tDefects & 0x200) {
            s10 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[29], type: 'bar', marker:{color: 'rgb(156, 39, 176)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s10.y[i-1] = defects[i][10];
            s10.text = s10.y.map(value => value === 0 ? '' : String(value));
            //s10.text = s10.y.map(String);
			series.push(s10);                        
        }
        if (tDefects & 0x400) {
            s11 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[30], type: 'bar', marker:{color: 'rgb(255, 193, 7)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s11.y[i-1] = defects[i][11];
            s11.text = s11.y.map(value => value === 0 ? '' : String(value));
            //s11.text = s11.y.map(String);
			series.push(s11);                        
        }
        if (tDefects & 0x800) {
            s12 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[31], type: 'bar', marker:{color: 'rgb(200, 99, 200)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s12.y[i-1] = defects[i][12];
            s12.text = s12.y.map(value => value === 0 ? '' : String(value));
            //s12.text = s12.y.map(String);
			series.push(s12);                        
        }
        if (tDefects & 0x1000) {
            s13 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[32], type: 'bar', marker:{color: 'rgb(54, 124, 210)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s13.y[i-1] = defects[i][13];
            s13.text = s13.y.map(value => value === 0 ? '' : String(value));
            //s13.text = s13.y.map(String);
			series.push(s13);                        
        }
        if (tDefects & 0x2000) {
            s14 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[33], type: 'bar', marker:{color: 'rgb(255, 140, 0)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s14.y[i-1] = defects[i][14];
            s14.text = s14.y.map(value => value === 0 ? '' : String(value));
            //s14.text = s14.y.map(String);
			series.push(s14);                        
        }
        if (tDefects & 0x4000) {
            s15 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[34], type: 'bar', marker:{color: 'rgb(0, 188, 212)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s15.y[i-1] = defects[i][15];
            s15.text = s15.y.map(value => value === 0 ? '' : String(value));
            //s15.text = s15.y.map(String);
			series.push(s15);                        
        }
        if (tDefects & 0x8000) {
            s16 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[35], type: 'bar', marker:{color: 'rgb(105, 240, 174)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s16.y[i-1] = defects[i][16];
            s16.text = s16.y.map(value => value === 0 ? '' : String(value));
            //s16.text = s16.y.map(String);
			series.push(s16);                        
        }
        if (tDefects & 0x10000) {
            s17 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[36], type: 'bar', marker:{color: 'rgb(244, 67, 54)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s17.y[i-1] = defects[i][17];
            s17.text = s17.y.map(value => value === 0 ? '' : String(value));
            //s17.text = s17.y.map(String);
			series.push(s17);                        
        }
        if (tDefects & 0x20000) {
            s18 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[37], type: 'bar', marker:{color: 'rgb(139, 195, 74)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s18.y[i-1] = defects[i][18];
            s18.text = s18.y.map(value => value === 0 ? '' : String(value));
            //s18.text = s18.y.map(String);
			series.push(s18);                        
        }
		
		Plotly.newPlot('divPlotly1', series, layout);
		layout.legend.x = 0;
		layout.title.font.size = 11;
		layout.xaxis.title.font.size = 11;
		layout.yaxis.title.font.size = 11;	
		layout.title.y = 0;
		layout.title.yanchor = "bottom"; 	
		layout.legend.y = 1.2; 			
		Plotly.newPlot('printDivPlotly1', series, layout);
		Plots[0] = {data: series, layout: layout};
		
		layout = {title: {text:MSGRep[38]  + " (" + data.vins + ")",font:{size:16}}, yaxis: {title: {text:MSGRep[45], font:{size:16}}, fixedrange: true}, xaxis: {title: {text:"",font:{size:16}}, fixedrange: true}, legend: {orientation:"h", x: 0.4, xanchor: 'top', y: 1.02}, plot_bgcolor:'rgba(0,0,0,0)', paper_bgcolor:'rgba(0,0,0,0)'};
		layout.xaxis.title.text = MSGRep[72] + data.model + MSGRep[44] + ColorsByID_color[data.id_color] + "'";	
		s1 = { x: ['Z1','Z2','Z3','Z4','Z5'], y: [0,0,0,0,0], name: MSGRep[35], type: 'bar', marker:{color: 'rgb(225,107,0)'},textposition: 'outside',hoverinfo: 'none'};
		for (i=1; i<7; i++) {
			if (tDefects & 0x01) s1.y[i-1] += defects[i][1];
			if (tDefects & 0x02) s1.y[i-1] += defects[i][2];
			if (tDefects & 0x04) s1.y[i-1] += defects[i][3];
			if (tDefects & 0x08) s1.y[i-1] += defects[i][4];
			if (tDefects & 0x10) s1.y[i-1] += defects[i][5];
			if (tDefects & 0x20) s1.y[i-1] += defects[i][6];
			if (tDefects & 0x40) s1.y[i-1] += defects[i][7];
			if (tDefects & 0x80) s1.y[i-1] += defects[i][8];
			if (tDefects & 0x100) s1.y[i-1] += defects[i][9];
			if (tDefects & 0x200) s1.y[i-1] += defects[i][10];
			if (tDefects & 0x400) s1.y[i-1] += defects[i][11];
			if (tDefects & 0x800) s1.y[i-1] += defects[i][12];
			if (tDefects & 0x1000) s1.y[i-1] += defects[i][13];
			if (tDefects & 0x2000) s1.y[i-1] += defects[i][14];
			if (tDefects & 0x4000) s1.y[i-1] += defects[i][15];
			if (tDefects & 0x8000) s1.y[i-1] += defects[i][16];
			if (tDefects & 0x10000) s1.y[i-1] += defects[i][17];
			if (tDefects & 0x20000) s1.y[i-1] += defects[i][18];
		}	
		s1.text = s1.y.map(String);						
		Plotly.newPlot('divPlotly2', [s1], layout);
		layout.title.text = MSGRep[38];
		layout.legend.x = 0.3;
		layout.title.font.size = 12;
		layout.xaxis.title.font.size = 12;
		layout.yaxis.title.font.size = 12;						
		Plotly.newPlot('printDivPlotly2', [s1], layout);
		Plots[1] = {data: [s1], layout: layout};
							
		document.getElementById('RepimgLoading').style.display="none";	
		document.getElementById('divPlotly').style.display = "flex";
		document.getElementById('printDiv').style.height = "209.85mm";
		BeforeGenerate(true);
		return true;
	} 
	

	function getModelsFromIDs(ids)
	{
		var id_models = ids.split(",");
		var result = ModelsByID_model[id_models[0]];					
		for (i=1; i<id_models.length; i++) result += "," + ModelsByID_model[id_models[i]];
		return result;
	}
	function getColorAbrevFromIDs(ids)
	{
		if(!ids) return "";
		var id_colors;
		if (ids == "0") id_colors = Object.keys(ColorsByID_color);
		else id_colors = ids.split(",");
		result = ColorsByID_color[id_colors[0]];					
		for (i=1; i<id_colors.length; i++) result += "," + ColorsByID_color[id_colors[i]];
		return result;						
	}
	
	function getSelectedDefects() {
		if (areAllDefectsSelected()) {
			return ["Todos"];
		}
	
		let selectedDefects = [];
		
		if (document.getElementById("defDirt").checked) selectedDefects.push(MSGRep[46]);
		if (document.getElementById("defCrater").checked) selectedDefects.push(MSGRep[47]);
		if (document.getElementById("defDescolgon").checked) selectedDefects.push(MSGRep[48]);
		if (document.getElementById("defGota").checked) selectedDefects.push(MSGRep[49]);
		if (document.getElementById("defFibra").checked) selectedDefects.push(MSGRep[50]);
		if (document.getElementById("defHervido").checked) selectedDefects.push(MSGRep[51]);
		if (document.getElementById("defRoce").checked) selectedDefects.push(MSGRep[52]);
		if (document.getElementById("defEspolvoreado").checked) selectedDefects.push(MSGRep[53]);
		if (document.getElementById("defFaltaColor").checked) selectedDefects.push(MSGRep[54]);
		if (document.getElementById("defPielNaranja").checked) selectedDefects.push(MSGRep[55]);
		if (document.getElementById("defLineaCorteBitono").checked) selectedDefects.push(MSGRep[56]);
		if (document.getElementById("defDesconchado").checked) selectedDefects.push(MSGRep[57]);
		if (document.getElementById("defPinholes").checked) selectedDefects.push(MSGRep[58]);
		if (document.getElementById("defCoquera").checked) selectedDefects.push(MSGRep[59]);
		if (document.getElementById("defRayas").checked) selectedDefects.push(MSGRep[60]);
		if (document.getElementById("defBollo").checked) selectedDefects.push(MSGRep[61]);
		if (document.getElementById("defOtrosChapa").checked) selectedDefects.push(MSGRep[62]);
		if (document.getElementById("defOtrosPintura").checked) selectedDefects.push(MSGRep[63]);
	
		return selectedDefects;
	}
	
	
	function areAllDefectsSelected() {
		return document.getElementById("defDirt").checked &&
			   document.getElementById("defCrater").checked &&
			   document.getElementById("defDescolgon").checked &&
			   document.getElementById("defGota").checked &&
			   document.getElementById("defFibra").checked &&
			   document.getElementById("defHervido").checked &&
			   document.getElementById("defRoce").checked &&
			   document.getElementById("defEspolvoreado").checked &&
			   document.getElementById("defFaltaColor").checked &&
			   document.getElementById("defPielNaranja").checked &&
			   document.getElementById("defLineaCorteBitono").checked &&
			   document.getElementById("defDesconchado").checked &&
			   document.getElementById("defPinholes").checked &&
			   document.getElementById("defCoquera").checked &&
			   document.getElementById("defRayas").checked &&
			   document.getElementById("defBollo").checked &&
			   document.getElementById("defOtrosChapa").checked &&
			   document.getElementById("defOtrosPintura").checked;
	}
	
	function generateBarChartReport(data, mean)
	{	
		let ncars = parseInt(data.ncars);
		console.log(ncars);

		if (isNaN(ncars) || ncars == 0) {
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);
			return false;
		}


		var arr = [];
		var buf = Uint8Array.from(atob(data.ndefects), c => c.charCodeAt(0));
		var nsubcat = (buf.length-2)/(2*7);
		console.log(nsubcat);
		for (k = 0; k < buf.length; k += 2) arr[k >> 1] = buf[k] + buf[k + 1] * 256;
		let defects = [0,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
		defects[0] = arr[0];
		for(let i=0;i<6;i++){
			for(let j=0;j<nsubcat;j++){
				const subcat = {
					1: 1,
					2: 2,
					3: 1,
					4: 3,
					5: 3,
					6: 4,
					7: 5,
					8: 6,
					9: 17,
					10: 18,
					11: 4,
					12: 4,
					13: 4,
					14: 15,
					15: 18,
					16: 16,
					17: 17,
					18: 14,
					19: 17,
					20: 4,
					21: 8,
					22: 18,
					23: 9,
					24: 9,
					25: 9,
					26: 10,
					27: 11,
					28: 12,
					29: 14,
					30: 18,
					31: 7,
					32: 13,
					33: 3
				};
				console.log(subcat);
				defects[i+1][subcat[j]] = arr[4*i + j + 1];
				defects[i+1][0] += defects[i+1][subcat[j]];
			}
		}

		document.getElementById('divPlotly2').style.borderWidth = 0;					
		printPlot1 = document.getElementById('divPlotly1');
		printPlot2 = document.getElementById('divPlotly2');
		printPlot1.style.width = 1400;
		printPlot2.style.borderTopWidth = "0px";
		document.getElementById('divPlotly2').style.width = 510;
		printPlot1 = document.getElementById('printDivPlotly1');
		printPlot2 = document.getElementById('printDivPlotly2');
		
		printPlot1.style.margin = printPlot2.style.margin = 0;
		printPlot1.style.width = "220mm";
		printPlot2.style.width = "97mm";					
		printPlot2.style.marginLeft = "-20mm";
		printPlot2.style.borderTopWidth = "0px";
		document.getElementById('printPlots').style.display = "flex";						
							
		var layout = {title: {text: MSGRep[39],
			font:{size:16}}, 
			yaxis: {title: {text: MSGRep[45], font:{size:16}}, fixedrange: true}, 
			xaxis: {title: {text:"",font:{size:16}}, fixedrange: true}, 
			legend: {orientation:"h", x: 0.1, xanchor: 'top', y: 1.04}, 
			barmode: 'group', 
			plot_bgcolor:'rgba(0,0,0,0)',  
			paper_bgcolor:'rgba(0,0,0,0)',
			shapes: [
				{ type: 'line', x0: 0.5, x1: 0.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 1.5, x1: 1.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 2.5, x1: 2.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } },
				{ type: 'line', x0: 3.5, x1: 3.5, y0: 0, y1: 0.955, yref: 'paper', line: { color: 'gray', width: 1, dash: 'dot' } }
			],
			};

		aux = (document.getElementById('col0').checked) ? MSGRep[41] : getColorAbrevFromIDs(colors);
		aux2 = (document.getElementById('2col0').checked) ? MSGRep[100] : getColorAbrevFromIDs(colors2);
		layout.xaxis.title.text = MSGRep[73] + getModelsFromIDs(models) +"<br>"+ MSGRep[74] + aux + "'" ;
		if(document.getElementById('BiTon').checked) layout.xaxis.title.text += "       " + MSGRep[101] + aux2 + "'";
		
		var series = [];
		var s1 = null;
		var s2 = null;
		var s3 = null;
		var s4 = null;
		var s5 = null;
		var s6 = null;
		var s7 = null
		var s8 = null;
		var s9 = null;
		var s10 = null;
		var s11 = null;
		var s12 = null;
		var s13 = null		
		var s14 = null;
		var s15 = null;
		var s16 = null;
		var s17 = null;
		var s18 = null;

		let total_defects = 0;
		if (tDefects & 0x01) {
            s1 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[20], type: 'bar', marker:{color: 'rgb(214,39,40)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s1.y[i-1] = defects[i][1];
            s1.text = s1.y.map(value => value === 0 ? '' : String(value));
			//s1.text = s1.y.map(String);
			if (mean) s1.y[i-1] = (s1.y[i-1] / ncars).toFixed(1);
            series.push(s1);
        }
        if (tDefects & 0x02) {
            s2 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[21], type: 'bar', marker:{color: 'rgb(31,119,180)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s2.y[i-1] = defects[i][2];
            s2.text = s2.y.map(value => value === 0 ? '' : String(value));
            //s2.text = s2.y.map(String);
			if (mean) s2.y[i-1] = (s2.y[i-1] / ncars).toFixed(1);	
			series.push(s2);                        
        }
        if (tDefects & 0x04) {
            s3 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[22], type: 'bar', marker:{color: 'rgb(44,160,44)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s3.y[i-1] = defects[i][3];
            s3.text = s3.y.map(value => value === 0 ? '' : String(value));
            //s3.text = s3.y.map(String);
			if (mean) s3.y[i-1] = (s3.y[i-1] / ncars).toFixed(1);	
			series.push(s3);
        }
        if (tDefects & 0x08) {
            s4 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[23], type: 'bar', marker:{color: 'rgb(128, 64, 175)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s4.y[i-1] = defects[i][4];
            s4.text = s4.y.map(value => value === 0 ? '' : String(value));
            //s4.text = s4.y.map(String);
			if (mean) s4.y[i-1] = (s4.y[i-1] / ncars).toFixed(1);
			series.push(s4);                    
        }
        if (tDefects & 0x10) {
            s5 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[24], type: 'bar', marker:{color: 'rgb(255, 87, 34)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s5.y[i-1] = defects[i][5];
            s5.text = s5.y.map(value => value === 0 ? '' :String(value));
            //s5.text = s5.y.map(String);
			if (mean) s5.y[i-1] = (s5.y[i-1] / ncars).toFixed(1);
			series.push(s5);                        
        }
        if (tDefects & 0x20) {
            s6 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[25], type: 'bar', marker:{color: 'rgb(23, 162, 184)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s6.y[i-1] = defects[i][6];
            s6.text = s6.y.map(value => value === 0 ? '' : String(value));
            //s6.text = s6.y.map(String);
			if (mean) s6.y[i-1] = (s6.y[i-1] / ncars).toFixed(1);
			series.push(s6);                        
        }
        if (tDefects & 0x40) {
            s7 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[26], type: 'bar', marker:{color: 'rgb(245, 203, 92)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s7.y[i-1] = defects[i][7];
            s7.text = s7.y.map(value => value === 0 ? '' : String(value));
            //s7.text = s7.y.map(String);
			if (mean) s7.y[i-1] = (s7.y[i-1] / ncars).toFixed(1);
			series.push(s7);                        
        }
        if (tDefects & 0x80) {
            s8 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[27], type: 'bar', marker:{color: 'rgb(211, 47, 47)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s8.y[i-1] = defects[i][8];
            s8.text = s8.y.map(value => value === 0 ? '' : String(value));
            //s8.text = s8.y.map(String);
			if (mean) s8.y[i-1] = (s8.y[i-1] / ncars).toFixed(1);
			series.push(s8);                        
        }
        if (tDefects & 0x100) {
            s9 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[28], type: 'bar', marker:{color: 'rgb(66, 165, 245)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s9.y[i-1] = defects[i][9];
            s9.text = s9.y.map(value => value === 0 ? '' : String(value));
            //s9.text = s9.y.map(String);
			if (mean) s9.y[i-1] = (s9.y[i-1] / ncars).toFixed(1);
			series.push(s9);                        
        }
        if (tDefects & 0x200) {
            s10 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[29], type: 'bar', marker:{color: 'rgb(156, 39, 176)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s10.y[i-1] = defects[i][10];
            s10.text = s10.y.map(value => value === 0 ? '' : String(value));
            //s10.text = s10.y.map(String);
			if (mean) s10.y[i-1] = (s10.y[i-1] / ncars).toFixed(1);
			series.push(s10);                        
        }
        if (tDefects & 0x400) {
            s11 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[30], type: 'bar', marker:{color: 'rgb(255, 193, 7)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s11.y[i-1] = defects[i][11];
            s11.text = s11.y.map(value => value === 0 ? '' : String(value));
            //s11.text = s11.y.map(String);
			if (mean) s11.y[i-1] = (s11.y[i-1] / ncars).toFixed(1);
			series.push(s11);                        
        }
        if (tDefects & 0x800) {
            s12 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[31], type: 'bar', marker:{color: 'rgb(200, 99, 200)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s12.y[i-1] = defects[i][12];
            s12.text = s12.y.map(value => value === 0 ? '' : String(value));
            //s12.text = s12.y.map(String);
			if (mean) s12.y[i-1] = (s12.y[i-1] / ncars).toFixed(1);
			series.push(s12);                        
        }
        if (tDefects & 0x1000) {
            s13 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[32], type: 'bar', marker:{color: 'rgb(54, 124, 210)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s13.y[i-1] = defects[i][13];
            s13.text = s13.y.map(value => value === 0 ? '' : String(value));
            //s13.text = s13.y.map(String);
			if (mean) s13.y[i-1] = (s13.y[i-1] / ncars).toFixed(1);
			series.push(s13);                        
        }
        if (tDefects & 0x2000) {
            s14 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[33], type: 'bar', marker:{color: 'rgb(255, 140, 0)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s14.y[i-1] = defects[i][14];
            s14.text = s14.y.map(value => value === 0 ? '' : String(value));
            //s14.text = s14.y.map(String);
			if (mean) s14.y[i-1] = (s14.y[i-1] / ncars).toFixed(1);	
			series.push(s14);                        
        }
        if (tDefects & 0x4000) {
            s15 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[34], type: 'bar', marker:{color: 'rgb(0, 188, 212)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s15.y[i-1] = defects[i][15];
            s15.text = s15.y.map(value => value === 0 ? '' : String(value));
            //s15.text = s15.y.map(String);
			if (mean) s15.y[i-1] = (s15.y[i-1] / ncars).toFixed(1);
			series.push(s15);                        
        }
        if (tDefects & 0x8000) {
            s16 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[35], type: 'bar', marker:{color: 'rgb(105, 240, 174)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s16.y[i-1] = defects[i][16];
            s16.text = s16.y.map(value => value === 0 ? '' : String(value));
            //s16.text = s16.y.map(String);
			if (mean) s16.y[i-1] = (s16.y[i-1] / ncars).toFixed(1);
			series.push(s16);                        
        }
        if (tDefects & 0x10000) {
            s17 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[36], type: 'bar', marker:{color: 'rgb(244, 67, 54)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s17.y[i-1] = defects[i][17];
            s17.text = s17.y.map(value => value === 0 ? '' : String(value));
            //s17.text = s17.y.map(String);
			if (mean) s17.y[i-1] = (s17.y[i-1] / ncars).toFixed(1);
			series.push(s17);                        
        }
        if (tDefects & 0x20000) {
            s18 = { x: [MSGRep[14],MSGRep[15],MSGRep[16],MSGRep[17],MSGRep[18]], y: [0,0,0,0,0,0], name: MSGRep[37], type: 'bar', marker:{color: 'rgb(139, 195, 74)'},textposition: 'outside',hoverinfo: 'none'};
            for (i=1; i<7; i++) s18.y[i-1] = defects[i][18];
            s18.text = s18.y.map(value => value === 0 ? '' : String(value));
            //s18.text = s18.y.map(String);
			if (mean) s18.y[i-1] = (s18.y[i-1] / ncars).toFixed(1);
			series.push(s18);                        
        }
		
		if (mean) {
			layout.yaxis.title.text = MSGRep[45];
			layout.title.text = MSGRep[70] + ncars + MSGRep[71] + dateIni + " - " + dateFin + ")" + MSGRep[81] +(total_defects/ncars).toFixed(2)+"</b>"; 
		} else layout.title.text = MSGRep[72] + ncars + MSGRep[71] + dateIni + " - " + dateFin + ")" ;
		
		Plotly.newPlot('divPlotly1', series, layout);
		layout.legend.x = 0;
		layout.title.font.size = 11;
		layout.xaxis.title.font.size = 11;
		layout.yaxis.title.font.size = 11;
		layout.title.y = 0;
		layout.title.yanchor = "bottom"; 
		layout.legend.y = 1.2; 
		Plotly.newPlot('printDivPlotly1', series, layout);					
		Plots[0] = {data: series, layout: layout};
		
		layout = {title: {text:MSGRep[38],font:{size:16}}, yaxis: {title: {text:MSGRep[45], font:{size:16}}, fixedrange: true}, xaxis: {title: {text:"",font:{size:16}}, fixedrange: true}, legend: {orientation:"h", x: 0.4, xanchor: 'top', y: 1.02}, plot_bgcolor:'rgba(0,0,0,0)', paper_bgcolor:'rgba(0,0,0,0)'};
		if (mean) {
			layout.yaxis.title.text = MSGRep[45];
			layout.title.text = MSGRep[75];
		}

		layout.xaxis.title.text = MSGRep[72] + getModelsFromIDs(models);				
		s1 = { x: ['Z1','Z2','Z3','Z4','Z5'], y: [0,0,0,0,0], name: MSGRep[35], type: 'bar', marker:{color: 'rgb(225,107,0)'} ,textposition: 'outside',hoverinfo: 'none'};
		for (i=1; i<7; i++) {
			if (tDefects & 0x01) s1.y[i-1] += defects[i][1];
			if (tDefects & 0x02) s1.y[i-1] += defects[i][2];
			if (tDefects & 0x04) s1.y[i-1] += defects[i][3];
			if (tDefects & 0x08) s1.y[i-1] += defects[i][4];
			if (tDefects & 0x10) s1.y[i-1] += defects[i][5];
			if (tDefects & 0x20) s1.y[i-1] += defects[i][6];
			if (tDefects & 0x40) s1.y[i-1] += defects[i][7];
			if (tDefects & 0x80) s1.y[i-1] += defects[i][8];
			if (tDefects & 0x100) s1.y[i-1] += defects[i][9];
			if (tDefects & 0x200) s1.y[i-1] += defects[i][10];
			if (tDefects & 0x400) s1.y[i-1] += defects[i][11];
			if (tDefects & 0x800) s1.y[i-1] += defects[i][12];
			if (tDefects & 0x1000) s1.y[i-1] += defects[i][13];
			if (tDefects & 0x2000) s1.y[i-1] += defects[i][14];
			if (tDefects & 0x4000) s1.y[i-1] += defects[i][15];
			if (tDefects & 0x8000) s1.y[i-1] += defects[i][16];
			if (tDefects & 0x10000) s1.y[i-1] += defects[i][17];
			if (tDefects & 0x20000) s1.y[i-1] += defects[i][18];
			if (mean) s1.y[i-1] = (s1.y[i-1] / ncars).toFixed(1);
		}		
		s1.text = s1.y.map(String);	
		Plotly.newPlot('divPlotly2', [s1], layout);				
		layout.legend.x = 0.3;
		layout.title.font.size = 11;
		layout.xaxis.title.font.size = 11;
		layout.yaxis.title.font.size = 11;					
		Plotly.newPlot('printDivPlotly2', [s1], layout);
		Plots[1] = {data: [s1], layout: layout};
		

		BeforeGenerate(true);
		document.getElementById('divPlotly').style.display = "flex";
		document.getElementById('printDiv').style.height = "209.85mm";
		return true;
	} 
	
	async function generateNewStatsReport(data) {
		var series = [];
		var arr = [];
		var buf = null;
		var outColor = null;
		var info = null;

		var plot1 = document.getElementById('divPlotly1');
		var plot2 = document.getElementById('divPlotly2');
		plot1.style.float = "top";
		plot2.style.float = "bottom";
		plot1.style.width = plot2.style.width = 1920;
		plot1.style.paddingLeft = 360;
		plot1.style.height = plot2.style.height = window.screen.height/2 - 30;
		plot2.style.borderTop = "thin solid black";		
		plot1 = document.getElementById('printDivPlotly1');
		plot2 = document.getElementById('printDivPlotly2');
		plot1.style.margin = plot2.style.margin = 0;
		plot1.style.float = "top";
		plot2.style.float = "bottom";
		document.getElementById('printDiv').style.display = "block";
		plot2.style.borderTop = "thin solid black";
		plot1.style.width = "225mm";
		plot1.style.paddingLeft = "55mm";
		plot1.style.marginTop = "-8mm";
		plot2.style.marginTop = "0mm";
		plot2.style.width = "297mm";
		plot1.style.height = "83mm";
		plot2.style.height = "93mm";
		document.getElementById('printPlots').style.display = "inline";
		

		let colorsID = data["colors"].split(",");
		let modelsID = data["models"].split(",");
		let datos = {};
		for (i = 0; i < colorsID.length; i++) {
			arr = [];
			buf = Uint8Array.from(atob(data["c" + colorsID[i]]), c => c.charCodeAt(0));
			for (k = 0; k < buf.length; k += 2) arr[k >> 1] = buf[k] + buf[k + 1] * 256;
			datos[colorsID[i]] = {ncars: arr.length, defects: arr};
		}
		for (i = 0; i < modelsID.length; i++) {
			arr = [];
			buf = Uint8Array.from(atob(data["m" + modelsID[i]]), c => c.charCodeAt(0));
			for (k = 0; k < buf.length; k += 2) arr[k >> 1] = buf[k] + buf[k + 1] * 256;
			datos[modelsID[i]] = {ncars: arr.length, defects: arr};
		}


		// POR MODELO
		const median = arr => {
		let middle = Math.floor(arr.length / 2);
			arr = [...arr].sort((a, b) => a - b);
			return arr.length % 2 !== 0 ? arr[middle] : (arr[middle - 1] + arr[middle]) / 2;
		};
		
		for (i = 0; i < modelsID.length; i++) {
			info = datos[modelsID[i]];
			arr = [];
			if (info.ncars) {
				let sum = info.defects.reduce((a, b) => a + b, 0);
				let avg = (sum / info.defects.length) || 0;
				series.push({ y: info.defects, x0:ModelsByID_model[modelsID[i]] + " (" + info.ncars + MSGRep[76]  + MSGRep[102] + avg.toFixed(2) + MSGRep[103] + median(info.defects), name: ModelsByID_model[modelsID[i]] + " (" + info.ncars + MSGRep[76], type: 'box', boxpoints: false, boxmean: true, color: 'red'});
			}
		}
		if (series.length == 0) {
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);
			return false;
		}


		var layout = { title: { text: '', font: { size: 16 } }, yaxis: { title: { text: MSGRep[45], font: { size: 16 } }, zeroline: false, fixedrange: true }, xaxis: { title: { text: '', font: { size: 16 } }, fixedrange: true, tickfont: { size: 12 } }, width: 1200, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' };
		layout.title.text = MSGRep[77] + dateIni.substr(0, 16) + " - " + dateFin.substr(0, 16) + ")";
		aux = ((document.getElementById('col0').checked)) ? MSGRep[41] : getColorAbrevFromIDs(colors);
		aux2 = ((document.getElementById('2col0').checked)) ? MSGRep[100] : getColorAbrevFromIDs(colors2);
		layout.xaxis.title.text = MSGRep[78] + "'" + aux + "'"; 
		if(document.getElementById('BiTon').checked) layout.xaxis.title.text += "     " + MSGRep[101] + aux2 + "'";
		//layout.xaxis.title.text += MSGRep[79] + getDefectsStrFromInt(tDefects);
		Plotly.newPlot('divPlotly1', series, layout);
		layout.showlegend = false;
		layout.width = "100%";
		layout.xaxis.tickfont.size = 8;
		layout.title.font.size = 12;
		layout.xaxis.title.font.size = 12;
		layout.yaxis.title.font.size = 12;
		//layout.xaxis.title.text = MSGRep[80] + aux + MSGRep[81] + getModelsFromIDs(models);
		Plotly.newPlot('printDivPlotly1', series, layout);
		Plots[0] = { data: series, layout: layout };
		series = [];

		// POR COLOR
		for (i = 0; i < colorsID.length; i++) {
			info = datos[colorsID[i]];
			arr = [];
			if (info.ncars) {
				let sum = info.defects.reduce((a, b) => a + b, 0);
				let avg = (sum / info.defects.length) || 0;
				abrev = ColorsByID_color[colorsID[i]];
				if (rgb2grey(ColorsByID_colorweb[abrev]) > 196) {
					outColor = 'rgb(60,60,60)';
					series.push({
						y: info.defects,
						x0: ColorsByID_color[colorsID[i]] + " (" + info.ncars + MSGRep[76] + MSGRep[102] + avg.toFixed(2) + MSGRep[103] + median(info.defects),
						name: ColorsByID_color[colorsID[i]] + " (" + info.ncars + MSGRep[76],
						type: 'box',
						boxpoints: false,
						boxmean: true,
						fillcolor: ColorsByID_colorweb[abrev],
						line: { color: outColor }
					});							
				} else {
					series.push({
						y: info.defects,
						x0: ColorsByID_color[colorsID[i]] + " (" + info.ncars + MSGRep[76]+ MSGRep[102] + avg.toFixed(2) + MSGRep[103] + median(info.defects),
						name: ColorsByID_color[colorsID[i]] + " (" + info.ncars + MSGRep[76],
						type: 'box',
						boxpoints: false,
						boxmean: true,
						line: { color: ColorsByID_colorweb[abrev] }
					});
				}
			}
		}

		if (series.length == 0) {
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);
			return false;
		}
		let font;
		if(colorsID.length<13){font = 12;}
		else {font = 10;}
		var layout = { title: { text: '', font: { size: 16 } }, yaxis: { title: { text: MSGRep[45], font: { size: 16 } }, zeroline: false, fixedrange: true }, xaxis: { title: { text: '', font: { size: 16 } }, fixedrange: true, automargin: true, tickfont: { size: font } }, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' };
		layout.title.text = MSGRep[82] + dateIni.substr(0, 16) + " - " + dateFin.substr(0, 16) + ")";
		layout.xaxis.title.text = MSGRep[83] + getModelsFromIDs(models) //+ MSGRep[79] + getDefectsStrFromInt(tDefects);
		Plotly.newPlot('divPlotly2', series, layout);
		layout.xaxis.tickfont.size = font - 4;
		layout.xaxis.title.text = MSGRep[84] + getModelsFromIDs(models) //+ MSGRep[79] + getDefectsStrFromInt(tDefects);
		layout.showlegend = false;
		layout.title.font.size = 12;
		layout.xaxis.title.font.size = 12;
		layout.yaxis.title.font.size = 12;
		Plotly.newPlot('printDivPlotly2', series, layout);
		Plots[1] = { data: series, layout: layout };
		document.getElementById('RepimgLoading').style.display = "none";
		document.getElementById('divPlotly').style.display = "inline";
		document.getElementById('printDiv').style.height = "209.85mm";

		BeforeGenerate(true);
		return true;
	}	

	function generatePieChartReport(data) {    
		let defects = [0, new Array(20).fill(0)];
		let arr = [];
		
		let buf = Uint8Array.from(atob(data.ndefects), c => c.charCodeAt(0));
		let nsubcat = (buf.length - 4) / 4;
	
		for (let k = 0; k < buf.length; k += 4) {
			defects[k >> 2] = buf[k] + buf[k + 1] * 256 + buf[k + 2] * 256 * 256 + buf[k + 3] * 256 * 255 * 256;
		}
	
		defects[0] = arr[0];
		
		for (let i = 0; i < 5; i++) {
			for (let j = 0; j < nsubcat; j++) {
				const subcat = {
					1: 1,
					2: 2,
					3: 1,
					4: 3,
					5: 3,
					6: 4,
					7: 5,
					8: 6,
					9: 17,
					10: 18,
					11: 4,
					12: 4,
					13: 4,
					14: 15,
					15: 18,
					16: 16,
					17: 17,
					18: 14,
					19: 17,
					20: 4,
					21: 8,
					22: 18,
					23: 9,
					24: 9,
					25: 9,
					26: 10,
					27: 11,
					28: 12,
					29: 14,
					30: 18,
					31: 7,
					32: 13,
					33: 3
				};
				defects[i + 1][subcat[j]] = arr[4 * i + j + 1];
				defects[i + 1][0] += defects[i + 1][subcat[j]];
			}
		}
		
		if (defects[1] === 0) {
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);    
			return false;
		}
		
		document.getElementById('divPlotly1').style.width = "955px";
		document.getElementById('divPlotly2').style.width = "955px";
		document.getElementById('divPlotly2').style.borderWidth = "0px";
	
		let printPlot1 = document.getElementById('printDivPlotly1');
		let printPlot2 = document.getElementById('printDivPlotly2');
		printPlot2.style.marginTop = printPlot1.style.marginTop = "-5mm";
		printPlot1.style.height = "170mm"
		printPlot2.style.height = "175mm";
		printPlot2.style.width = printPlot1.style.width = "170mm";    
		
		printPlot1.style.marginLeft = "-8mm";        
		printPlot2.style.marginLeft = "-30mm";
		printPlot2.style.borderWidth = 0;
		document.getElementById('printPlots').style.display = "flex";
		let total_defectos = defects.flat().reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
	
		// Filtrar defectos seleccionados para el primer gráfico
		let selectedValues1 = [];
		let selectedLabels1 = [];
		let selectedColors1 = [];
	
		if (tDefects & 0x01 && defects[1] > 0.1) {
			selectedValues1.push(defects[1]);
			selectedLabels1.push(MSGRep[46]);
			selectedColors1.push('rgb(214,39,40)');
		}
		if (tDefects & 0x02 && defects[2] > 0.1) {
			selectedValues1.push(defects[2]);
			selectedLabels1.push(MSGRep[47]);
			selectedColors1.push('rgb(31,119,180)');
		}
		if (tDefects & 0x04 && defects[3] > 0.1) {
			selectedValues1.push(defects[3]);
			selectedLabels1.push(MSGRep[48]);
			selectedColors1.push('rgb(44,160,44)');
		}
		if (tDefects & 0x08 && defects[4] > 0.1) {
			selectedValues1.push(defects[4]);
			selectedLabels1.push(MSGRep[49]);
			selectedColors1.push('rgb(128, 64, 175)');
		}
		if (tDefects & 0x10 && defects[5] > 0.1) {
			selectedValues1.push(defects[5]);
			selectedLabels1.push(MSGRep[50]);
			selectedColors1.push('rgb(255, 87, 34)');
		}
		if (tDefects & 0x20 && defects[6] > 0.1) {
			selectedValues1.push(defects[6]);
			selectedLabels1.push(MSGRep[51]);
			selectedColors1.push('rgb(0, 88, 212)');
		}
		if (tDefects & 0x40 && defects[7] > 0.1) {
			selectedValues1.push(defects[7]);
			selectedLabels1.push(MSGRep[52]);
			selectedColors1.push('rgb(245, 203, 92)');
		}
		if (tDefects & 0x80 && defects[8] > 0.1) {
			selectedValues1.push(defects[8]);
			selectedLabels1.push(MSGRep[53]);
			selectedColors1.push('rgb(211, 47, 47)');
		}
		if (tDefects & 0x100 && defects[9] > 0.1) {
			selectedValues1.push(defects[9]);
			selectedLabels1.push(MSGRep[54]);
			selectedColors1.push('rgb(66, 165, 245)');
		}
		if (tDefects & 0x200 && defects[10] > 0.1) {
			selectedValues1.push(defects[10]);
			selectedLabels1.push(MSGRep[55]);
			selectedColors1.push('rgb(156, 39, 176)');
		}
		if (tDefects & 0x400 && defects[11] > 0.1) {
			selectedValues1.push(defects[11]);
			selectedLabels1.push(MSGRep[56]);
			selectedColors1.push('rgb(255, 193, 7)');
		}
		if (tDefects & 0x800 && defects[12] > 0.1) {
			selectedValues1.push(defects[12]);
			selectedLabels1.push(MSGRep[57]);
			selectedColors1.push('rgb(200, 99, 200)');
		}
		if (tDefects & 0x1000 && defects[13] > 0.1) {
			selectedValues1.push(defects[13]);
			selectedLabels1.push(MSGRep[58]);
			selectedColors1.push('rgb(54, 124, 210)');
		}
		if (tDefects & 0x2000 && defects[14] >0.1) {
			selectedValues1.push(defects[14]);
			selectedLabels1.push(MSGRep[59]);
			selectedColors1.push('rgb(255, 140, 0)');
		}
		if (tDefects & 0x4000 && defects[15] > 0.1) {
			selectedValues1.push(defects[15]);
			selectedLabels1.push(MSGRep[60]);
			selectedColors1.push('rgb(0, 188, 212)');
		}
		if (tDefects & 0x8000 && defects[16] > 0.1) {
			selectedValues1.push(defects[16]);
			selectedLabels1.push(MSGRep[61]);
			selectedColors1.push('rgb(105, 240, 174)');
		}
		if (tDefects & 0x10000 && defects[17] > 0.1) {
			selectedValues1.push(defects[17]);
			selectedLabels1.push(MSGRep[62]);
			selectedColors1.push('rgb(244, 67, 54)');
		}
		if (tDefects & 0x20000 && defects[18] > 0.1) {
			selectedValues1.push(defects[18]);
			selectedLabels1.push(MSGRep[63]);
			selectedColors1.push('rgb(139, 195, 74)');
		}
	
		var s1 = {
			values: selectedValues1,
			labels: selectedLabels1,
			marker: { colors: selectedColors1 }, 
			hole: .4, 
			type: 'pie',
			textinfo: "label+percent",
		};
		
		
		let aux = (document.getElementById('col0').checked) ? MSGRep[41] : getColorAbrevFromIDs(colors);
		let aux2 = (document.getElementById('2col0').checked) ? MSGRep[100] : getColorAbrevFromIDs(colors2);
		let text = MSGRep[73] + getModelsFromIDs(models) + MSGRep[88] + aux + "'";
	
		if (document.getElementById('BiTon').checked) {
			text += "    " + MSGRep[101] + aux2 + "'";
		}
		let ncars = parseInt(data.ncars);
		console.log(ncars);
		var layout = { 
			title: {text: text, font: {size:14}}, 
			annotations: [{font: {size:16}, text: MSGRep[89] + total_defectos + MSGRep[90] + "<br>" +  MSGRep[94] + ncars, showarrow: false, x: 0.5, y: 0.5}],
			legend: {x: 1, xanchor: 'left', y: 1}, 
			plot_bgcolor: 'rgba(0,0,0,0)', 
			paper_bgcolor: 'rgba(0,0,0,0)'
		};
	
		Plotly.newPlot('divPlotly1', [s1], layout);
	
		layout.legend = {orientation:"h", x: 0.1, xanchor: 'bottom', y: -0.03};
		layout.title.text = MSGRep[73] + getModelsFromIDs(models) + MSGRep[93] + aux + "'";
	
		layout.title.font.size = 12;
		layout.annotations[0].font.size = 11;
		s1.hole = 0.45;
	
		Plotly.newPlot('printDivPlotly1', [s1], layout);
		Plots[0] = {data: s1, layout: layout};
	
		s1 = { values: [], labels: [], marker: {colors: [], line: {width: 1}}, hole: .4, type: 'pie', textinfo: "label+percent" };
	
		if (data["vins"] || data["DFV"] || data["relai"]) {
			let abrev = data["codigo_color"];
			s1.labels.push(abrev);
			s1.values.push(data[abrev]);
			s1.marker.colors.push(ColorsByID_colorweb[abrev]);
		} else {
			let colorsID = data["colors"].split(',');
			for (let i = 0; i < colorsID.length; i++) {
				let abrev = getColorAbrevFromIDs(colorsID[i]);
				s1.labels.push(abrev);
				s1.values.push(data[abrev]);
				s1.marker.colors.push(ColorsByID_colorweb[abrev]);
			}
		}
	
		layout = { 
			title: {text: text, font: {size:14}},
			annotations: [{font: {size:16}, text: MSGRep[89] + total_defectos + MSGRep[91], showarrow: false, x: 0.5, y: 0.5}], 
			plot_bgcolor: 'rgba(0,0,0,0)', 
			paper_bgcolor: 'rgba(0,0,0,0)'
		};
	
		Plotly.newPlot('divPlotly2', [s1], layout);
	
		layout.legend = (s1.values.length > 8) ? {orientation: "h", yanchor: 'bottom', xanchor: 'center', x: 0.5, y: -0.1} : {orientation: "h", yanchor: 'bottom', xanchor: 'center', x: 0.5, y: -0.03};
	
		layout.title.text = MSGRep[92] + getModelsFromIDs(models) + MSGRep[93] + aux + "'<br>";
		layout.title.font.size = 12;
		layout.annotations[0].font.size = 11;
		s1.hole = 0.45;
	
		Plotly.newPlot('printDivPlotly2', [s1], layout);
		Plots[1] = {data: [s1], layout: layout};
	
		document.getElementById('divPlotly').style.display = "flex";
		document.getElementById('printDiv').style.height = "209.85mm";
		BeforeGenerate(true);                
		return true;
	}
	
	function generateHeatMapReport(data)
	{
		var modelsID = data["models"].split(",");
		var i = 0;
		showed = 0;
		var aux = null;
		var aux2 = null;
		var ncars = 0;
		var svg = null;

		for (i = 0; i < modelsID.length; i++) {
			document.getElementById('imgHeatMap' + i).innerHTML = "";
			document.getElementById('printImgHeatMap' + i).innerHTML = "";
			if (data[modelsID[i] + "-svg"] && data[modelsID[i] + "-ncars"]) {
				svg = atob(data[modelsID[i] + "-svg"]); 
				ncars = parseInt(data[modelsID[i] + "-ncars"]);

				var p = document.getElementById('textHeatMap' + i);
				var p2 = document.getElementById('printTextHeatMap' + i);

				aux = ((document.getElementById('col0').checked)) ? MSGRep[41] : getColorAbrevFromIDs(colors);
				aux2 = ((document.getElementById('2col0').checked)) ? MSGRep[100] : getColorAbrevFromIDs(colors2);
				let text = MSGRep[99] + ModelsByID_model[modelsID[i]] + ' ' + MSGRep[94] + ncars + MSGRep[93] + aux + "'" 
				if(document.getElementById('BiTon').checked) text += " &nbsp&nbsp " + MSGRep[101] + aux2 + "'";	
				let defectsStr = getSelectedDefects().join(", "); text += MSGRep[81] + defectsStr + " | " + dateIni.substr(0,16) + " &nbsp-&nbsp " + dateFin.substr(0,16); p2.innerHTML = p.innerHTML = text;															  
				

				document.getElementById('divHeatMap' + i).style.display = "inline";
				document.getElementById('printHeatMap' + i).style.display = "";	
				document.getElementById('imgHeatMap' + i).innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" style="background-color:black" width="790" height="900">'+svg+'</svg>';;
				document.getElementById('printImgHeatMap' + i).innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" style="background-color:black" width="790" height="900" transform="scale(0.55)">'+svg+'</svg>';
				document.getElementById('printHeatMap' + i).style.display = "flex";
				showed++;
				if (showed > 2) document.body.style.overflowX = "scroll";
			} else {
				document.getElementById('divHeatMap' + i).style.display = "none";
				document.getElementById('printHeatMap' + i).style.display = "none";
			}
		}
		if(!showed){
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);
			return false;
		}
		for (;i<7;i++) {
			document.getElementById('divHeatMap' + i).style.display = "none";
			document.getElementById('printHeatMap' + i).style.display = "none";
		}
		document.getElementById('divHeatMap').style.width= showed * 800;
		switch (showed) {
			case 0:
			case 1:
			case 2: 
				document.getElementById('printDiv').style.height = "209.85mm";
				break;
			case 3:
			case 4: 
				document.getElementById('printDiv').style.height = "419.70mm";
				break;
			default: 
				document.getElementById('printDiv').style.height = "629.55mm";
				break;
		}
		document.getElementById('RepimgLoading').style.display="none";	
		if (showed < 3) document.body.style.overflowX = "hidden";					
		document.getElementById('divHeatMap').style.display = "flex";
		
		BeforeGenerate(true);
		return true;
	} 
	function generateMeanChart(data){
		let line_types = [{dash:'solid', color:'black', width: 3},{dash:'solid'},{dash:'dot'},{dash:'longdash'},{dash:'1px,1px,1px'},{dash:'4px,4px,10px'},{dash:'dashdot'}];

		if (!data["days"]) {					
			alert(MSGRep[11]);
			desplegar();
			BeforeGenerate(false);
			return false;
		}
		let days = data["days"].split(',');

		let series = [];
		let total_defects = {day:[],ndefectos:[]};
		let i = 0;
		for(let i=0;i<7;i++){
			let t_def = data[i].split(',').reduce((a,b)=>a+parseFloat(b), 0);
			if(t_def){
				series.push({
					name: MSGRep[105+i],
					x: days,
					y: data[i].split(','),
					type: 'scatter',
					mode: 'lines+markers+text',
					texttemplate: '%{y:.2f}',
					textposition: 'top',
					textfont:{color:'black', size:10},
					line:line_types[i],
					marker: {size: 7}}
				);
			}
		}

		var layout = {title: {text: MSGRep[39], font:{size:16}}, yaxis: {gridcolor: "#C8C8C8", title: {text: MSGRep[45], font:{size:16}}}, xaxis: {"gridcolor": "#C8C8C8",title: {text:"",font:{size:16}}, fixedrange: true},   legend: {orientation:"h", x: 0.3, xanchor: 'top', y: 1.04}, barmode: 'group', plot_bgcolor:'rgba(0,0,0,0)',  paper_bgcolor:'rgba(0,0,0,0)'};
		if(document.getElementById('CustomRange').checked){
			let rangeini = 0;
			let rangefin = 30;
			if(document.getElementById('Rangeini').value) {rangeini = document.getElementById('Rangeini').value;}
			if(document.getElementById('Rangefin').value) {rangefin = document.getElementById('Rangefin').value;}
			layout = {title: {text: MSGRep[39], font:{size:16}}, yaxis: {gridcolor: "#C8C8C8", title: {text: MSGRep[45], font:{size:16}}, range : [ rangeini, rangefin ]}, xaxis: {"gridcolor": "#C8C8C8",title: {text:"",font:{size:16}}, fixedrange: true},   legend: {orientation:"h", x: 0.4, xanchor: 'top', y: 1.04}, barmode: 'group', plot_bgcolor:'rgba(0,0,0,0)',  paper_bgcolor:'rgba(0,0,0,0)'};
		}
		layout.yaxis.title.text = MSGRep[69];
		layout.title.text = MSGRep[104] + dateIni + " - " + dateFin; 
		aux = (document.getElementById('col0').checked) ? MSGRep[41] : getColorAbrevFromIDs(colors);
		aux2 = (document.getElementById('2col0').checked) ? MSGRep[100] : getColorAbrevFromIDs(colors2);
		layout.xaxis.title.text = MSGRep[73] + getModelsFromIDs(models) +"<br>"+ MSGRep[74] + aux + "'" ;
		if(document.getElementById('BiTon').checked) layout.xaxis.title.text += "       " + MSGRep[101] + aux2 + "'";

		document.getElementById('divPlotly1').style.width = 1920;
		document.getElementById('divPlotly1').style.height = window.screen.height - 130;
		document.getElementById('divPlotly2').style.display = 'none';	
		document.getElementById('printDivPlotly1').style.display = 'none';
		document.getElementById('printDivPlotly2').style.display = 'none';
		Plotly.newPlot('divPlotly1', series, layout);		


		BeforeGenerate(true);
		document.getElementById('divPlotly').style.display = "flex";
		document.getElementById('printDiv').style.height = "209.85mm";
		return true;	

	}

	function OnGenerateReport()
	{
		var nerr = 0;
		getFinalValues();
		nerr = validateFinalValues();
		if (!nerr) {
			chartgenerated = true;
			Plots = [];
			document.body.style.overflowX = "hidden";
			document.getElementById("paramsID").style.display = "none";
			document.getElementById('divHeatMap').style.display = "none";
			document.getElementById('divPlotly').style.display = "none";
			var plot1 = document.getElementById('divPlotly1');
			var plot2 = document.getElementById('divPlotly2');
			plot1.style.display = 'block';
			plot2.style.display = 'block';
			plot1.style.float = "left";
			plot2.style.float = "right";
			plot1.style.width = 1400;
			plot1.style.paddingLeft = 0;
			plot2.style.width = 510;
			//plot1.style.height = plot2.style.height = 1020;
			plot1.style.height = plot2.style.height = window.screen.height - 60;
			plot2.borderTopWidth = "0px";
									
			document.getElementById('printDiv').style.display = "flex";
			plot1 = document.getElementById('printDivPlotly1');
			plot2 = document.getElementById('printDivPlotly2');
			plot1.style.display = 'block';
			plot2.style.display = 'block';
			plot1.style.float = "left";
			plot2.style.float = "right";
			plot1.style.width = "188mm";
			plot1.style.paddingLeft = 0;
			plot2.style.width = "109mm";
			plot1.style.height = plot2.style.height = "166mm";
			plot2.borderTopWidth = "0px";
			

			//alert("TODO OK. Generando petición al servidor para generar los datos del gráfico");						
			document.getElementById('RepimgLoading').style.display="inline";
			document.getElementById('RepimgPrint').style.visibility = "hidden";

			var modelsID = models.split(",");
			var colorsID = [];
			if ((document.getElementById('col0').checked)) {
				for (i = 0; i < htmlColors.length; i++) colorsID[i] = getIDFromHTMLInput(htmlColors[i]);
			} else colorsID = colors.split(",");


			var json = '{"info":"Reports", "type": "'+rtType+'"';
			switch (selOneCar) {
				case 0: 
					json += ',"date":"'+ dateOneCar +'","dateIni":"'+ dateIni + '","dateFin":"'+ dateFin + '","models":"'+ modelsID + '","tDefects":"'+ tDefects +'"'; 	
					if (lineas) json += ',"booth":"'+ lineas + '"';
					if (colors.length > 0 && colors != "0") json += ',"colors":"'+ colors + '","colors2":"'+ colors2_aux + '","bitono":"'+ bitono + '"';
					break;
				case 1: json += ',"vins":"'+ valueOneCar + '"'; break;
				case 2: json += ',"relai":"'+ valueOneCar + '"'; break;
				case 3: json += ',"DFV":"'+ valueOneCar + '"'; break;
			}
			if(mode & FLAG_DEFECTBLOB)	{json += ',"size":"1"';}
			else json += ',"size":"0"';

			json += '}';

			console.log(json);
			SendRequestRep(json);
		} else alert(MSGRep[nerr]); 
	}
	function BeforeGenerate(PrintOK){
		removeModeBarContainerFromPlotly();	
		document.getElementById('RepimgLoading').style.display="none";	
		document.getElementById('printDate').innerHTML=timenow(); 
		if (PrintOK){document.getElementById('RepimgPrint').style.visibility = "visible";}
		else{document.getElementById('RepimgPrint').style.visibility = "hidden";}
	}

	function Exit() {
		var x=confirm(MSGRep[96]);
		if(x) window.close();
	}

	function BeforePrint() 
	{			
		if (rtType==2) { //Si es HeatMap
			document.getElementById('master').style.display = "none";
			document.getElementById('printPlots').style.zIndex = -1;
			document.getElementById('printHeatMaps').style.zIndex = 1;
			document.getElementById('printHeatMaps').style.display = "flex";
			for(let j=0;j<7;j++){
				svgsHeat.push(document.getElementById('imgHeatMap' + j).innerHTML);
				document.getElementById('imgHeatMap' + j).innerHTML = ""; //Elimino lo que hay en el HTML y lo guardo
			}
		} else {
			document.getElementById('printPlots').style.zIndex = 1;
			document.getElementById('printHeatMaps').style.zIndex = -1;
		}	

		if(rtType==7){
			document.getElementById('printDivMean').style.display = 'block';
			Plotly.toImage(document.getElementById('divPlotly1'),{format:'svg', width:1920, height:1080}).then(img => {document.getElementById('printDivMean').src = img;})
			.then(()=>window.print()).then(()=>AfterPrint());
		}else{
			document.getElementById('printDivMean').style.display = 'none';
			window.print();
			AfterPrint();
		}
		
	}
	function AfterPrint()
	{
		document.getElementById('printPlots').style.zIndex = -1;
		document.getElementById('printHeatMaps').style.zIndex = -1;
		document.getElementById('master').style.display = "block";
		document.getElementById('printHeatMaps').style.display = "none";
		document.getElementById('printDivMean').style.display = 'none';
		if(rtType==2){
			for(let j=0;j<7;j++){
				document.getElementById('imgHeatMap' + j).innerHTML = svgsHeat[j]; //Vuelvo a añadir los svgs que me he cargado antes
			}
		}
	}

	function OnChangeRange(div){
		if(div.checked) {
			document.getElementById('Rangeini').style.display = 'inline';
			document.getElementById('Rangefin').style.display = 'inline';
		}else{
			document.getElementById('Rangeini').style.display = 'none';
			document.getElementById('Rangefin').style.display = 'none';
		}
	}

	//-----CAMBIA DEFECTOS-----//
	function ChangeDefects(){
		let boton_ChangeDefects = document.getElementById("boton_ChangeDefects");
		if(mode & FLAG_DEFECTBLOB){
			mode = FLAG_WEIGHTDEFECTS;
			boton_ChangeDefects.src = "images/WeightButton.png";
			boton_ChangeDefects.onmouseover = () => { boton_ChangeDefects.src = "images/WeightButtonH.png"; };
			boton_ChangeDefects.onmouseout = () => { boton_ChangeDefects.src = "images/WeightButton.png"; };
		}else{
			mode = FLAG_DEFECTBLOB;
			boton_ChangeDefects.src = "images/SizeButton.png";
			boton_ChangeDefects.onmouseover = () => { boton_ChangeDefects.src = "images/SizeButtonH.png"; };
			boton_ChangeDefects.onmouseout = () => { boton_ChangeDefects.src = "images/SizeButton.png"; };
		}
		if(chartgenerated) {OnGenerateReport();} // Si rtType es 0, no se ha generado nada todavía
	}

	function isInit(){return init;}

	ChargeRep();
	return{
		desplegar,
		BeforePrint,
		OnChangeReportType,
		OnChangeMultiCriterio,
		OnChangeDate,
		OnChangeCheckboxColorsAll,
		OnChangeCheckboxColorsAll2,
		OnChangeRange,
		OnChangeTypeDefect,
		Exit,
		OnGenerateReport,
		ChangeDefects,
		isInit,
		selectAllSubcat
	}
}