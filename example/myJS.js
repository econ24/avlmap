window.onload = test;

function test() {
	var map = avlmap.Map()
		.addLayer(avlmap.RasterLayer({url: "http://api.tiles.mapbox.com/v3/am3081.map-lkbhqenw/{z}/{x}/{y}.png",
									  name: 'Raster Layer', hidden: true }))
		.addControl({type:'info', position: 'bottom-right'})
		.addControl({type:'zoom'})
		.addControl({type:'layer'});

	var buildings = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-buildings/{z}/{x}/{y}.topojson',
									    name: 'Buildings', attr: { stroke: '#97812a', fill: '#97812a' } });
	buildings.converter = makeGeoJSON;
	map.addLayer(buildings);

	var highroads = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-highroad/{z}/{x}/{y}.topojson',
									    name: 'Roads' });
	highroads.drawTile = drawHighroads;
	highroads.converter = makeGeoJSON;
	map.addLayer(highroads);

	var markers = map.MapMarker()
		.data([
			{ coords: [-74.47828, 42.68254], name: 'Cobbleskill' },
			{ coords: [-73.82395, 42.68614], name: 'UAlbany' },
			{ coords: [-73.68248, 42.73523], name: 'Troy', image: 'banana_marker.png' },
			{ coords: [-76.4768, 42.6916], name: 'Locke', image: 'marker3.png' }
		]);
	markers();

	map.addControl({type:'marker'});

	var strokeWidth = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range([5,3,3,1,1]);

	var stroke = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(["#392e40","#896f97","#614e6c","#525252","#525252"]);

	var strokeDashArray = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(['none', 'none', '2, 8', 'none', '5, 5']);

	function drawHighroads(group, json, tilePath) {
      	group.selectAll("path")
          	.data(json.features.sort(function(a,b) { return a.properties.sort_key-b.properties.sort_key; }))
			.enter().append("path")
			.attr({
				'stroke-dasharray': function(d) { return strokeDashArray(d.properties.kind); },
				'stroke-width': function(d) { return strokeWidth(d.properties.kind); },
				stroke: function(d) { return stroke(d.properties.kind); },
				class: 'high-road',
				'd': tilePath
			})
			.on("click", function(d) { console.log(d); })
	}

	function makeGeoJSON(json) {
		return topojson.feature(json, json.objects.vectile);
	}

	window.addEventListener("resize", function() {
		map.size([window.innerWidth, window.innerHeight]);
	})
}