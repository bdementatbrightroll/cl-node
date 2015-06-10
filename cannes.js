require('newrelic');

var express	= require('express');
var app 	= express();
var bodyParser = require('body-parser');
app.use( bodyParser.json() );
var time 	= require('time');

var redis	= require('redis');
var rclient	= redis.createClient();

const ORDERS = 'orders';
const PORT = 1337;

var count = 0;

app.get("/cannes/meal-period", function(request, response) {
	
	var now = new time.Date();
	console.log("Server location: " + now.getTimezone());

	var location = "CET";
	now.setTimezone(location);
	var hour = now.getHours();
	var period = 'breakfast';

	if (1 > hour) {
		period = 'evening';
	} else if (1 < hour && hour < 12) {
		period = 'breakfast';
	} else if (12 <= hour && hour < 14) {
		period = 'lunch';
	} else if (14 <= hour && hour < 22) {
		period = 'happy-hour';
	} else if (22 <= hour) {
		period = 'evening';
	}

	console.log("Hour in " + location + "=" + hour + " (" + period + ")");
	response.status(200).send(period);
});

app.get("/cannes/delete/:id", function(request, response) {
	var id = request.params.id;
	console.log("Delete order: " + request.params.id);
	
	rclient.hdel(ORDERS, id);

	rclient.hgetall(ORDERS, function(error, result)
	{
		console.log("Current Orders: " + JSON.stringify(result));

		var orders = [];
		for (var order in result)
		{
			orders.push(JSON.parse(result[order]));
		}
		response.status(200).type('application/json').send(orders);
	});
});

app.get("/cannes/menu.xml", function(request, response) {
	response.status(200).sendFile(__dirname + '/menu.xml');
});

app.get("/cannes/orders", function(request, response) {
	console.log('/cannes/orders');
	rclient.hgetall(ORDERS, function(error, result)
	{
		// console.log("Current Orders: " + JSON.stringify(result));

		var orders = [];
		for (var order in result)
		{
			// console.log("order: " + order + "=" + result[order]);
			orders.push(JSON.parse(result[order]));
		}

		response.status(200).type('application/json').send(orders);
	});
});

app.post("/cannes/complete", function(request, response) {
	var order = JSON.parse(request.body).id;
	console.log(order);
	response.status(200).type('application/json').send('{"success":true}');
});

app.post("/cannes/order", function(request, response) {
	var order = request.body;
	// order.status = 'received';
	order.id = count++;

	rclient.hset(ORDERS, order.id, JSON.stringify(order));
	console.log("Received Order: " + JSON.stringify(request.body));
	response.status(200).send(JSON.stringify({'success':true}));
});

app.listen(PORT);
console.log('Server running on port ' + PORT);