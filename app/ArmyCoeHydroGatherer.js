var http = require("http");
var fs = require("fs");
var underscore = require("underscore");
var dateFormat = require('dateFormat');

var debug = {
	beginRequest: false,
	processResults: false,
	handleData: true,
	isDataLine: false,
	endResponse: false
};

var fileStream;
var lastPartial = "";
beginRequest(120);

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

	fileStream = fs.createWriteStream("hydrologicData.txt");
	fileStream.on('finish', exit);

	http.get(url, processResults);
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
		.value();
	if(debug.handleData) { console.log(dataList); }

	if(dataList.length) {
		fileStream.write(dataList.join("\n") + "\n");
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

function endResponse() {
	if(debug.endResponse) { console.log("endResponse"); }

	fileStream.end();
}

function exit() {
	process.exit();
}