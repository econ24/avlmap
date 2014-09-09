window.onload = test;

function test() {
	var map = avlmap.Map()
		.addLayer(avlmap.RasterLayer({url: "http://api.tiles.mapbox.com/v3/am3081.map-lkbhqenw/{z}/{x}/{y}.png"}))
		.addControl({type:'info', position: 'bottom-right'})
		.addControl({type:'zoom'})
		.addControl({type:'layer'})

	var buildings = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-buildings/{z}/{x}/{y}.json',
									 name: 'Buildings'});
	buildings.drawTile = drawBuildings;
	map.addLayer(buildings);

	var highroads = avlmap.VectorLayer({url: 'http://tile.openstreetmap.us/vectiles-highroad/{z}/{x}/{y}.json',
									 name: 'Roads'});
	highroads.drawTile = drawHighroads;
	map.addLayer(highroads);

	map.addMarker({coords: [-73.824, 42.686]})

	var strokeWidth = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range([5,3,5,1,1])

	var stroke = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(["#392e40","#896f97","#614e6c","#525252","#525252"])

	var strokeDashArray = d3.scale.ordinal()
		.domain(['highway', 'major_road', 'rail', 'minor_road', 'path'])
		.range(['none', 'none', '2, 8', 'none', '5, 5'])

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
}