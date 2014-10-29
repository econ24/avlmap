window.onload = test;

function test() {
	var map = avlmap.Map()
		.addLayer(avlmap.RasterLayer({url: "http://api.tiles.mapbox.com/v3/am3081.map-lkbhqenw/{z}/{x}/{y}.png",
									  name: 'Raster Layer' }))
		.addControl({type:'info', position: 'bottom-right'})
		.addControl({type:'zoom'})
		.addControl({type:'layer'});

	var buildings = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-buildings/{z}/{x}/{y}.topojson',
									    name: 'Buildings' });
	buildings.drawTile = drawBuildings;
	buildings.converter = makeTopoJSON;
	map.addLayer(buildings);

	var highroads = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-highroad/{z}/{x}/{y}.topojson',
									    name: 'Roads' });
	highroads.drawTile = drawHighroads;
	highroads.converter = makeTopoJSON;
	map.addLayer(highroads);

	// var test = avlmap.VectorLayer({url: 'http://localhost:1337/{z}/{x}/{y}'});
	// map.addLayer(test);

	var markers = map.MapMarker()
		.data([
			{ coords: [-74.47828, 42.68254], name: 'Cobbleskill' },
			{ coords: [-73.82395, 42.68614], name: 'UAlbany' },
			{ coords: [-73.68248, 42.73523], name: 'Troy', image: 'banana_marker.png' }
		]);
	markers();

	map.addControl({type:'marker'});

	var strokeWidth = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range([5,3,5,1,1]);

	var stroke = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(["#392e40","#896f97","#614e6c","#525252","#525252"]);

	var strokeDashArray = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(['none', 'none', '2, 8', 'none', '5, 5']);

	function drawBuildings(group, json, tilePath) {
      	group.selectAll("path")
          	.data(json.features)
			.enter().append("path")
			.style('stroke', '#97812a')
			.style('fill', '#97812a')
			.attr("d", tilePath)
	}

	function drawHighroads(group, json, tilePath) {
      	group.selectAll("path")
          	.data(json.features.sort(function(a,b) { return a.properties.sort_key-b.properties.sort_key; }))
			.enter().append("path")
			.style('stroke-dasharray', function(d) {
				return strokeDashArray(d.properties.kind);
			})
			.style('stroke-width', function(d) {
				return strokeWidth(d.properties.kind);
			})
			.style('stroke', function(d) {
				return stroke(d.properties.kind);
			})
			.attr("d", tilePath)
	}

	function makeTopoJSON(json) {
		return topojson.feature(json, json.objects.vectile);
	}
}