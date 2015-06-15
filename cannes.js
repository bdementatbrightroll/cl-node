require('newrelic');

var util 	= require('util')
var path	= require('path')
var express	= require('express')
var app 	= express()
var bodyParser = require('body-parser')
app.use( bodyParser.json() )
var time 	= require('time')
var fs 		= require('fs')
var multiparty 	= require('multiparty')
var form = new multiparty.Form()

var redis	= require('redis')
var rclient	= redis.createClient()

const POPULARITY = 'popularity'
const ORDERS = 'orders'
const PORT = 1337

var count = 0

app.post("/cannes/photobooth", function(request, response) {
	// console.log("/cannes/photobooth " + util.inspect(request))
	console.log("content-type " + request.headers['content-type'])

	form.on('field', function(name, value) {
		console.log('field: ' + name + "=" + value)
	})

	form.on('error', function(error) {
		console.log('error ' + error)
	})

	form.on('file', function(name, file){
		console.log("file: " + JSON.stringify(file))
		var filename = path.parse(file.path).name + path.parse(file.path).ext
		fs.renameSync(file.path, __dirname + '/uploads/' + filename)
	})

    form.on('close', function() {
    	// console.log('close')
    	response.status(200).send('')
    })

    try {
    	form.parse(request);	
    } catch (e) {
    	console.log("PARSE ERROR " + e);
    	// console.log(util.inspect(e));
    }
})

app.get("/cannes/meal-period", function(request, response) {
	var now = new time.Date();
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

	console.log("/cannes/meal-period " + period);
	response.status(200).send(period);
});

app.get("/cannes/delete/:id", function(request, response) {
	var id = request.params.id;
	rclient.hdel(ORDERS, id);

	rclient.hgetall(ORDERS, function(error, result)
	{
		var orders = [];
		for (var order in result)
		{
			orders.push(JSON.parse(result[order]));
		}

		console.log("cannes/delete/" + request.params.id);
		response.status(200).type('application/json').send(orders);
	});
});

app.get("/cannes/menu.xml", function(request, response) {
	response.status(200).sendFile(__dirname + '/menu.xml');
});

app.get("/cannes/orders", function(request, response) {
	rclient.hgetall(ORDERS, function(error, result)
	{
		var orders = [];
		for (var order in result)
		{
			// console.log("order: " + order + "=" + result[order]);
			orders.push(JSON.parse(result[order]));
		}

		console.log('/cannes/orders: ' + orders);	
		response.status(200).type('application/json').send(orders);
	});
});

app.get("/cannes/popularity", function(request, response) {
	console.log('/cannes/popularity');
	rclient.hgetall(POPULARITY, function(err, reply) {
		console.log('/cannes/popularity: ' + JSON.stringify(reply));
		response.status(200).send(JSON.stringify(reply));
	});
});

app.get("/cannes/order-queue", function(request, response) {
	rclient.hkeys(ORDERS, function(err, reply) {
		var length = reply.length;
		console.log("/cannes/order-queue " + length);
		response.status(200).send(JSON.stringify({'length':length}));
	});
});

app.post("/cannes/order", function(request, response) {
	var order = request.body;
	order.id = count++;
	
	for (var type in request.body) {
		if (['station','id'].indexOf(type) != -1) {
			continue;
		}
		var qty = order[type];
		rclient.hincrby(POPULARITY, type, qty, redis.print);
	}

	console.log("/cannes/order" + order);
	rclient.hset(ORDERS, order.id, JSON.stringify(order));
	response.status(200).send();
});

app.listen(PORT);
console.log('Server running on port ' + PORT);