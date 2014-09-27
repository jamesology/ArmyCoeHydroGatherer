var http = require("http");
var fs = require("fs");
var underscore = require("underscore");
var dateFormat = require('dateFormat');
var jsftp = require("jsftp");
var settings = require("./settings");

var debug = {
	beginRequest: false,
	processResults: false,
	processError: true,
	handleData: false,
	isDataLine: true,
	splitData: true,
	endResponse: false,
	sendFileToServer: false,
	ftpResult: true
};

var fileStream;
var initialWrite = true;
var lastPartial = "";
var getDays = 120;
var retryCount = 0;
beginRequest(getDays);

function beginRequest(daysToRetrieve) {
	if(debug.beginRequest){ 
		console.log("beginRequest"); 
		console.log("daysToRetrieve: " + daysToRetrieve);
	}
	
	var endDateRaw = new Date();
	var startDateRaw = new Date();
	startDateRaw.setDate(endDateRaw.getDate() - daysToRetrieve);
	var endDate = dateFormat(endDateRaw, "ddmmmyyyy");
	var startDate = dateFormat(startDateRaw, "ddmmmyyyy");
	if(debug.beginRequest) {
		console.log("From: " + startDate);
		console.log("To: " + endDate);
	}

	var url = 'http://www.swf-wc.usace.army.mil/cgi-bin/rcshtml.pl?page=contentOnly&report=hydrologic&results=tabular&lake=smct2&sdate=' + startDate + '&edate=' + endDate + '&elev=daily&gatedflow=on';
	if(debug.beginRequest) { console.log(url); }

	fileStream = fs.createWriteStream("canyonData.json");
	fileStream.on('finish', sendFileToServer);

	http.get(url, processResults)
		.on('error', processError);
}

function processResults(response) {
	if(debug.processResults) { 
		console.log("processResults");
		console.log(response.statusCode);
	}

	response.setEncoding('utf8');
	response.on('data', handleData);
	response.on('end', endResponse);
}

function processError(error) {
	if(debug.processError) { console.log("processError"); }

	if(error.code == 'ETIMEDOUT' && retryCount < settings.timeoutRetryCount){
		if(debug.processError) { console.log("Request timed out. Retry #" + (retryCount + 1)); }
		retryCount++;
		beginRequest(getDays);
	}
	else {
		console.log('Got Error: ' + error.message);
	}
}

function handleData(chunk) {
	if(debug.handleData) {
		console.log("handleData");
		//console.log(chunk);
	}

	if(lastPartial.length > 0) { chunk = lastPartial + chunk; }
	var dataList = chunk.split("\n");
	lastPartial = underscore.last(dataList);

	dataList = underscore.chain(dataList)
		.initial()
		.filter(function(line) { return isDataLine(line); })
		.map(function(line) { return splitData(line); })
		.map(function(line) { return JSON.stringify(line); })
		.value();
	if(debug.handleData) { console.log(dataList); }

	if(dataList.length) {
		if(initialWrite) { fileStream.write("[\n"); initialWrite = false; }
		else { fileStream.write(",\n"); }

		fileStream.write(dataList.join(",\n"));
	}
}

function isDataLine(text) {
	if(debug.isDataLine) { 
		console.log("isDataLine"); 
		console.log("text: " + text);
	}

	var regEx = /[\d]+[\s]+[;].+[;].+/;
	var result = regEx.test(text);
	if(debug.isDataLine) { console.log("regEx match: " + result); }

	return result;
}

function splitData(text) {
	if(debug.splitData) { 
		console.log("splitData");
		console.log(text);
	}

	var dataArray = text.split(";");
	var data = { date: dataArray[0].trim(), elev: dataArray[1].trim(), flow: dataArray[2].trim() };
	if(debug.splitData) { console.log(data); }

	return data;
}

function endResponse() {
	if(debug.endResponse) { console.log("endResponse"); }

	fileStream.end("\n]");
}

function sendFileToServer() {
	if(debug.sendFileToServer) {
		console.log("sendFileToServer");
		console.log("host: " + settings.ftp.url);
		console.log("user: " + settings.ftp.user);
	}

	var ftp = new jsftp({
		host: settings.ftp.url,
		//port: 3331, // defaults to 21
		user: settings.ftp.user,
		pass: settings.ftp.password
	});

	ftp.put('canyonData.json', 'james/rivers/canyonData.json', ftpResult);
}

function ftpResult(hadError) {
	if(debug.ftpResult) { console.log("ftpResult"); }

	if(hadError === false) { console.log("Transfer completed successfully."); }

	exit();
}

function exit() {

	process.exit();
}