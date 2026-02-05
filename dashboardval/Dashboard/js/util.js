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
	const MSG = {};
	const raw = text.replace(/\r/g, '');
	const lines = raw.split('\n');
	let inHTML = false;
	let idx = 0;

	for (let line of lines) {
		const t = line.trim();
		if (!t) continue;
		if (t === '[HTML]') { inHTML = true; continue; }
		if (!inHTML) {
			const m = t.match(/"([^"]+)"/);
			if (m) { idx++; MSG[idx] = m[1]; }
			continue;
		}
		const m2 = t.match(/"([^"]+)"\s*"([^"]*)"/);
		if (m2) {
			const key = m2[1];
			const token = m2[2];
			MSG[key] = token;
			const el = document.getElementById(key);
			if (el) el.innerHTML = token;
		}
	}
	return MSG;
}

function DecodeBase64(str) {return decodeURIComponent(escape(window.atob(str)));}