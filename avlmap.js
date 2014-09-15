 (function() {
	var avlmap = {version: '2.0-beta'}

	function AVLobject(options) {
		this.id = arguments.length ? (options.id || null) : null;
	}

	function MapLayer(options) {
		AVLobject.call(this, options);

		this.URL = options.url;
		this.name = options.name || null;
	}
    MapLayer.prototype = Object.create(AVLobject.prototype);
    MapLayer.prototype.constructor = MapLayer;

    MapLayer.prototype.makeURL = function(tile) {
        return this.URL.replace(/{z}\/{x}\/{y}/, tile[2] + '/' + tile[0] + '/' + tile[1]);
    }

	function VectorLayer(options) {
		MapLayer.call(this, options);

		this.zIndex = options.zIndex || 0;
		this._visible = true;
	}
    VectorLayer.prototype = Object.create(MapLayer.prototype);
    VectorLayer.prototype.constructor = VectorLayer;

    VectorLayer.prototype.tilePath = d3.geo.path().projection(d3.geo.mercator());

    VectorLayer.prototype.initTile = function(group, tile, translate, scale) {
    	var path = this.tilePath,
    		draw = this.drawTile;

    	draw.bind(this)

    	group.style('display', function(layer) {
        		return layer.visible() ? 'block' : 'none';
        	})

        return d3.json(this.makeURL(tile), function(error, json) {
			    path.projection()
			        .translate(translate)
			        .scale(scale);
				draw(group, json, path);
	        })
    }

    VectorLayer.prototype.drawTile = function(group, json, tilePath) {
      	group.selectAll("path")
          	.data(json.features)
			.enter().append("path")
			//.attr("d", tilePath);
    }

    VectorLayer.prototype.visible = function(v) {
    	if (!arguments.length) {
    		return this._visible;
    	}
    	if (v) {
    		this.showLayer();
    	}
    	else {
    		this.hideLayer()
    	}
    	return this;
    }

    VectorLayer.prototype.hideLayer = function() {
    	d3.selectAll('.'+this.id).style('display', 'none');
    	this._visible = false;
    	return this;
    }

    VectorLayer.prototype.showLayer = function() {
    	d3.selectAll('.'+this.id).style('display', 'block');
    	this._visible = true;
    	return this;
    }

    function RasterLayer(options) {
		MapLayer.call(this, options);

		this.zIndex = options.zIndex || -5;
	}
    RasterLayer.prototype = Object.create(MapLayer.prototype);
    RasterLayer.prototype.constructor = RasterLayer;

    RasterLayer.prototype.initTile = function(group, tile, translate, scale) {
    	group.selectAll('image')
    		.data([tile])
    		.enter()
    		.append('svg:image')
    		.attr('width', '256px')
    		.attr('height', '256px')
    		.attr('xlink:href', this.makeURL(tile))

        return null;
    }

    function Control(map, options) {
		AVLobject.call(this, options);

		var self = this,
			position = options.position;

		self.DOMel = map.append('div')
			.attr('id', self.id)
			.attr('class', 'avl-control')
			.classed(position, true)
            .on('dblclick', function() {
                d3.event.stopPropagation();
            });

        self.position = function(p) {
			if (p === undefined) {
				return position;
			}
            self.DOMel.classed(position, false);
            position = p;
            self.DOMel.classed(position, true);
        }
    }
    Control.prototype = Object.create(AVLobject.prototype);
    Control.prototype.constructor = Control;

    function InfoControl(map, projection, options) {
		Control.call(this, map, options);

		map.on('mousemove', mousemoved);

        var info = this.DOMel
            .append('div')
            .attr('class', 'info-text');

		function mousemoved() {
		  	info.text(formatLocation(projection.invert(d3.mouse(this)), projection.scale()));
		}

		function formatLocation(p, k) {
		  	var format = d3.format("." + Math.floor(Math.log(k) / 2 - 2) + "f");
		  	return (p[1] < 0 ? format(-p[1]) + "°S" : format(p[1]) + "°N") + " "
		         + (p[0] < 0 ? format(-p[0]) + "°W" : format(p[0]) + "°E");
		}
    }
    InfoControl.prototype = Object.create(Control.prototype);
    InfoControl.prototype.constructor = InfoControl;

    function ZoomControl(mapObj, map, zoom, options) {
		Control.call(this, map, options);

		var self = this,
			width = mapObj.dimensions()[0],
			height = mapObj.dimensions()[1];

        self.DOMel.append('div')
            .attr('class', 'avl-button avl-bold')
            .text('+')
            .on('click', function() {
                d3.event.stopPropagation();
                _clicked(1);
            })

        self.DOMel.append('div')
            .attr('class', 'avl-button avl-bold')
            .text('-')
            .on('click', function() {
                d3.event.stopPropagation();
                _clicked(-1);
            })

        function _clicked(direction) {
            d3.event.preventDefault();

            var scale = 2.0,
                targetZoom = Math.round(zoom.scale() * Math.pow(scale, direction)),
                center = [width/2, height/2],
                extent = zoom.scaleExtent(),
                translate = zoom.translate(),
                translate0 = [],
                l = [],
                view = {
                    x: translate[0],
                    y: translate[1],
                    k: zoom.scale()
                };

            if (targetZoom < extent[0] || targetZoom > extent[1]) {
                return false;
            }
            translate0 = [(center[0]-view.x)/view.k, (center[1]-view.y)/view.k];

            view.k = targetZoom;

            l = [translate0[0]*view.k+view.x, translate0[1]*view.k+view.y];

            view.x += center[0]-l[0];
            view.y += center[1]-l[1];

            zoom.scale(view.k)
                .translate([view.x, view.y]);

            mapObj.zoomMap();
        }
    }
    ZoomControl.prototype = Object.create(Control.prototype);
    ZoomControl.prototype.constructor = ZoomControl;

    function LayerControl(mapObj, map, options) {
		Control.call(this, map, options);

		var self = this,
			layers;

        self.update = function(layer) {
        	layers = mapObj.layers() || [];
        	updateButtons();
        }

        self.update();

        function updateButtons() {
            var buttons = self.DOMel
                .selectAll('div')
                .data(layers, function(d) { return d.id; });
				
            buttons.exit().remove();

            buttons.enter().append('div')
                .attr('class', 'avl-list')
                .on('click', toggle)

            buttons.classed('avl-inactive', function(d) { return !d.visible(); })
                .text(function(d) { return d.name; });
        }

        function toggle(layer) {
            d3.event.stopPropagation();

            if (layer.visible()) {
            	layer.hideLayer();
            	d3.select(this).classed('avl-inactive', true);
            }
            else {
            	layer.showLayer();
            	d3.select(this).classed('avl-inactive', false);
            }
        }
    }
    LayerControl.prototype = Object.create(Control.prototype);
    LayerControl.prototype.constructor = LayerControl;

    function MarkerControl(mapObj, projection, zoom, map, options) {
		Control.call(this, map, options);

		var width = mapObj.dimensions()[0],
			height = mapObj.dimensions()[1],

			markers = mapObj.MapMarker();

		this.update = function() {
            var buttons = this.DOMel
                .selectAll('div')
                .data(markers.data(), function(d) { return d.markerID; });

            buttons.exit().remove();

            buttons.enter().append('div')
                .attr('class', 'avl-list avl-active')
                .on('click', zoomTo);

            buttons.text(function(d) { return d.name; });
		}

		markers.control(this.update.bind(this));

        function zoomTo(d) {
            d3.event.stopPropagation();
            projection
                .center(d.coords) // temporarily set center
                .translate([width / 2, height / 2])
                .translate(projection([0, 0])) // compute appropriate translate
                .center([0, 0]); // reset

            zoom.translate(projection.translate());

            mapObj.zoomMap();
        }
    }
    MarkerControl.prototype = Object.create(Control.prototype);
    MarkerControl.prototype.constructor = MarkerControl;

    function ControlsManager(mapObj, map, projection, zoom) {
    	var self = this,
    		controls = {},
			allPositions = ['top-right', 'bottom-right', 'bottom-left', 'top-left'],
            positionsUsed = {'top-right': false, 'bottom-right': false,
							 'bottom-left': false, 'top-left': false};;

    	this.addControl = function(options) {
			options.position = 'avl-'+getPosition(options.position);

			if (!options.position) {
				return;
			}

    		if (options.type == 'info' && !controls.info) {
    			options.id = 'avl-info-control'

    			controls.info = new InfoControl(map, projection, options);
    		}
    		else if (options.type == 'zoom' && !controls.zoom) {
    			options.id = 'avl-zoom-control'

    			controls.info = new ZoomControl(mapObj, map, zoom, options);
    		}
    		else if (options.type == 'layer' && !controls.layer) {
    			options.id = 'avl-layer-control'

    			controls.layer = new LayerControl(mapObj, map, options);
    		}
    		else if (options.type == 'marker' && !controls.marker) {
    			options.id = 'avl-map-marker-control';

    			controls.marker = new MarkerControl(mapObj, projection, zoom, map, options);
    			controls.marker.update();
    		}
    	}

        function getPosition(pos) {
            pos = pos || 'top-right';

            var index = allPositions.indexOf(pos);

            for (var x = 0; x < 4; x++) {
                if (positionsUsed[pos]) {
                    index = (index + 1) % allPositions.length;
                    pos = allPositions[index];
                } else {
                    positionsUsed[pos] = true;
                    return pos;
                }
            }
            return null;
        }

      	this.update = function(control) {
      		if (control in controls) {
      			controls[control].update();
      		}
      	}
    }

    var UNIQUE_MARKER_IDs = 0;

    function MapMarker(map, projection) {
    	var data = [],
    		width = 20,
    		height = 40,
    		markers,
    		control;

    	function marker() {
    		markers = map.selectAll('.avl-map-marker')
    			.data(data, function(d) { return d.coords.join('-'); });

    		markers.exit().remove();

    		markers.enter().append('div')
    			.attr('class', 'avl-map-marker')
    			.attr('id', function(d) { return (d.id || null); })
    			.each(function(d) {
    				d.markerID = 'avl-map-marker-'+UNIQUE_MARKER_IDs++;
    				d.name = d.name || 'avl-map-marker';
    				width = this.offsetWidth;
    				height = this.offsetHeight;
    			});

    		markers
    			.each(function(d) {
    				var loc = projection(d.coords);

    				d3.select(this)
    					.style('background-color', d.color || null)
    					.style('left', (loc[0]-width/2)+'px')
    					.style('top', (loc[1]-height)+'px')
    			})
    		return marker;
    	}
    	marker.each = function(func) {
    		markers.each(func);
    	}
    	marker.control = function(func) {
    		if (!arguments.length) {
    			return control;
    		}
    		control = func;
    		return marker;
    	}
    	marker.data = function(d) {
    		if (!arguments.length) {
    			return data;
    		}
    		data = d;
    		if (control) { control(); }
    		return marker;
    	}
    	return marker;
    }

    function XHRcache() {
    	var cache = {};

    	this.addXHR = function(xhr, tileID, layerID) {
    		if (!(tileID in cache)) {
    			cache[tileID] = {};
    		}
    		cache[tileID][layerID] = xhr;
    	}

    	this.removeXHR = function(tileID, layerID) {
    		delete cache[tileID];
    	}

    	this.abortXHR = function(tileID) {
			for (var layer in cache[tileID]) {
	    		cache[tileID][layer].abort();
			}
    		this.removeXHR(tileID);
    	}
    }

	function AVLMap(options) {
		var self = this;

		if (!options) {
			options = {id: '#avl-map'};
		}
		else if (!options.id) {
			options.id = '#avl-map';
		}
		AVLobject.call(this, options);

		if (!document.getElementById(self.id.slice(1))) {
			d3.select('body').append('div')
				.attr('id', self.id.slice(1))
				.attr('width', function() { return (window.innerWidth-this.offsetLeft)+'px'; })
				.attr('height', function() { return (window.innerHeight-this.offsetTop)+'px'; });
		}

        var zoomAdjust = 8; // needed to adjust start zoom

        var minZoom = 1 << ((options.minZoom || 4) + zoomAdjust),
            maxZoom = 1 << (Math.min((options.maxZoom || 17), 17) + zoomAdjust),
            startZoom = options.startZoom ? 1 << (options.startZoom + zoomAdjust) : minZoom,
            startLoc = options.startLoc || [-73.824, 42.686], // defaults to Albany, NY
            zoomExtent = [minZoom, maxZoom];

		var width = parseInt(d3.select(self.id).attr('width'))
		    height = parseInt(d3.select(self.id).attr('height'))
		    prefix = prefixMatch();

		var MAP_LAYERS = [],
			VECTOR_LAYERS = [],
			LAYER_IDs = 0;

		var MAP_MARKERS = null;

		var xhrCache = new XHRcache();

		var controlsManager = null;

		var tileGen = d3.geo.tile()
		    .size([width, height]);

		var projection = d3.geo.mercator()
		    .scale(startZoom / 2 / Math.PI)
		    .translate([-width / 2, -height / 2]);

		var zoom = d3.behavior.zoom()
		    .scale(projection.scale() * 2 * Math.PI)
		    .scaleExtent(zoomExtent)
		    .translate(projection(startLoc).map(function(x) { return -x; }))
		    .on("zoom", function() { self.zoomMap(); });

		var map = d3.select(self.id)
		    .attr("class", "avl-map")
		    .style("width", width + "px")
		    .style("height", height + "px")
		    .call(zoom);
		this.map = function() {
			return map;
		}

		var vectorLayer = map.append("div")
		    .attr("class", "layer");

		self.zoomMap = function() {
			tileGen
				.scale(zoom.scale())
			    .translate(zoom.translate());

			var tiles = tileGen();

			projection
			    .scale(zoom.scale() / 2 / Math.PI)
			    .translate(zoom.translate());

			var vectorTiles = vectorLayer
			    .style(prefix + "transform", matrix3d(tiles.scale, tiles.translate))
			    .selectAll(".tile")
			    .data(tiles, function(d) { return d; });

			vectorTiles.enter().append("svg")
				.attr("class", "tile")

			vectorTiles
				.style("left", function(d) { return d[0] * 256 + "px"; })
			    .style("top", function(d) { return d[1] * 256 + "px"; })
			    .each(function(tile) {
			    	var svg = d3.select(this),
			    		tileID = 'tile-'+tile.join('-');

				    var k = 1 << (tile[2]+7),
				    	translate = [k - tile[0] * 256, k - tile[1] * 256],
				    	scale = k / Math.PI;

			    	this.tileID = tileID;

			    	svg.selectAll('g')
			    		.data(MAP_LAYERS, function(layer) { return layer.id; })
			    		.enter().append('g')
			        	.attr('class', function(layer) {
			        		return layer.id;
			        	})
			        	.each(function(layer) {
			        		var xhr = layer.initTile(d3.select(this), tile, translate, scale);
					        if (xhr) {
					        	xhrCache.addXHR(xhr, tileID, layer.id);
					        }
			        	}); // end svg.selectAll('g').each(...)
			    }) // end vectorTiles.each(...)

			vectorTiles.exit().each(function() { xhrCache.abortXHR(this.tileID); }).remove();

			if (MAP_MARKERS) {
				MAP_MARKERS();
			}
		}

		self.layers = function(layer, vector) {
			if (!arguments.length) {
				return VECTOR_LAYERS;
			}
			if (!layer.id) {
				layer.id = 'layer-'+LAYER_IDs++;
			}
			if (!layer.name) {
				layer.name = 'Layer '+LAYER_IDs;
			}

			MAP_LAYERS.push(layer);
			if (vector) {
				VECTOR_LAYERS.push(layer);
			}

			MAP_LAYERS.sort(function(a, b) { return a._zIndex - b._zIndex; });

			if (controlsManager) {
				controlsManager.update('layer');
			}

			self.zoomMap();

			return self;
		}
		self.removeLayer = function(layer) {
			var index;
			if ((index = MAP_LAYERS.indexOf(layer)) >= 0) {
				MAP_LAYERS.splice(index, 1);
			}
			if ((index = VECTOR_LAYERS.indexOf(layer)) >= 0) {
				VECTOR_LAYERS.splice(index, 1);
			}

			MAP_LAYERS.sort(function(a, b) { return a._zIndex - b._zIndex; });

			if (controlsManager) {
				controlsManager.update('layer');
			}

			d3.selectAll('.'+layer.id()).remove();

			//self.zoomMap();

			return self;
		}

		self.addControl = function(options) {
			if (!controlsManager) {
				controlsManager = new ControlsManager(self, map, projection, zoom);
			}
			controlsManager.addControl(options)

			return self;
		}

		self.MapMarker = function() {
			if (!MAP_MARKERS) {
				MAP_MARKERS = MapMarker(map, projection);
			}

			return MAP_MARKERS;
		}

		self.dimensions = function(dims) {
			return [width, height];
		}
	}
    AVLMap.prototype = Object.create(AVLMap.prototype);
    AVLMap.prototype.constructor = AVLMap;

	AVLMap.prototype.addLayer = function(layer) {
		if (layer instanceof VectorLayer) {
			this.layers(layer, true);
		}
		else if (layer instanceof RasterLayer) {
			this.layers(layer, false);
		}
		return this;
	}

	function matrix3d(scale, translate) {
	  	var k = scale / 256, r = scale % 1 ? Number : Math.round;
	  	return "matrix3d(" + [k, 0, 0, 0,
	  						  0, k, 0, 0,
	  						  0, 0, k, 0,
	  						  r(translate[0] * scale), r(translate[1] * scale), 0, 1 ] + ")";
	}

	function prefixMatch() {
		var p = ["webkit", "ms", "Moz", "O"];

	  	for (var i in p) {
	  		if (p[i] + "Transform" in document.body.style) {
	  			return "-" + p[i].toLowerCase() + "-";
	  		}
	  	}
	  	return "";
	}

	// ##########
	// public constructor functions
	// ##########
	avlmap.Map = function(options) {
		return new AVLMap(options);
	}

	avlmap.VectorLayer = function(options) {
		return new VectorLayer(options);
	}

	avlmap.RasterLayer = function(options) {
		return new RasterLayer(options);
	}

	this.avlmap = avlmap;
})()