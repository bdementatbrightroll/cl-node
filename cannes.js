require('newrelic');

var util 	= require('util')
var path	= require('path')
var express	= require('express')
var time 	= require('time')
var fs 		= require('fs')
var os 		= require('os');
var Busboy 	= require('busboy');

var redis	= require('redis')
var rclient	= redis.createClient()

var app 	= express()
var bodyParser = require('body-parser')
	app.use(bodyParser.json())

const POPULARITY = 'popularity'
const ORDERS = 'orders'
const PHOTOS = 'photos'
const PORT = 1337

var count = 0

app.get("/crossdomain.xml", function(req, res) {
	res.status(200).sendFile(__dirname + '/crossdomain.xml');
	return;
});

app.get("/cannes/view-photos", function(req, res) {
	var content = ["<html><body>"];
	rclient.hgetall(PHOTOS, function(error, result) {
		for (var id in result) {
			content.push("<p>");
			content.push("email: " + result[id] + "<br>");
			content.push('photo: <img src="http://localhost/cannes/uploads/' + id + '.png" /><br />')
			content.push("<p><br /><br />");
		}
		content.push("</body></html>");
		res.status(200).type('text/html').send(content.join("\n"));
	});
});

app.get("/cannes/photos", function(req, res) {
	rclient.hgetall(PHOTOS, function(error, result) {
		res.status(200).type('application/json').send(result);
	});
})

app.post("/cannes/photobooth", function(req, res) {
	console.log("/cannes/photobooth")
	var busboy = new Busboy({ headers: req.headers })
	var id = new Date().getTime()
	var email;

	busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
		if(fieldname == "email") {
			email = val;
		}  	
    });

	busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
		var saveTo = path.join(__dirname, "uploads", String(id) + ".png");
		file.pipe(fs.createWriteStream(saveTo));
    });

    busboy.on('finish', function() {
    	rclient.hset(PHOTOS, id, email)
		res.writeHead(200, { 'Connection': 'close' })
		res.end("That's all folks!")
    });

    return req.pipe(busboy);
});

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
	console.log("/cannes/order " + JSON.stringify(order))
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