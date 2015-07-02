(function() {
	var avlmap = { version: '2.0-beta' };

    var UNIQUE_MARKER_IDs = 0,
        UNIQUE_LAYER_IDs = 0;

	function AVLobject(options) {
		this.id = options.id;
	}

	function MapLayer(options) {
        options.id = options.id || 'layer-'+UNIQUE_LAYER_IDs++;

		AVLobject.call(this, options);

		this.URL = options.url;
		this.name = options.name || 'Layer '+UNIQUE_LAYER_IDs;
        this.hidden = options.hidden || false;

        var visible = true;
        this.visible = function(v) {
            if (!arguments.length) {
                return visible;
            }
            visible = v;
            d3.selectAll('.'+this.id).style('display', visible ? null : 'none');
            return this;
        }
	}
    MapLayer.prototype = Object.create(AVLobject.prototype);
    MapLayer.prototype.constructor = MapLayer;

    MapLayer.prototype.makeURL = function(tile) {
        return this.URL.replace(/{z}\/{x}\/{y}/, tile[2] + '/' + tile[0] + '/' + tile[1]);
    }

/*
RasterLayer object
*/
    function RasterLayer(options) {
        MapLayer.call(this, options);

        this.zIndex = options.zIndex || -5;
    }
    RasterLayer.prototype = Object.create(MapLayer.prototype);
    RasterLayer.prototype.constructor = RasterLayer;

    RasterLayer.prototype.initTile = function(group, tile) {
        group.style('display', function(layer) {
                return layer.visible() ? 'block' : 'none';
            })

        return d3.xhr(this.makeURL(tile)).responseType('blob').get(callBack.bind(this));

        function callBack(error, data) {
            this.drawTile(group, window.URL.createObjectURL(data.response));
        }
    }
    RasterLayer.prototype.drawTile = function(group, blobURI) {
        group.selectAll('image').data([this])
            .enter().append('svg:image')
            .attr('class', function(layer) { return layer.id; })
            .attr('width', '256px')
            .attr('height', '256px')
            .attr('xlink:href', blobURI);
    }

/*
VectorLayer object
*/
	function VectorLayer(options) {
		MapLayer.call(this, options);

        this.attr = options.attr || {
            fill: "none",
            stroke: "#000",
            "stroke-linejoin": "round",
            "stroke-linecap": "square"
        };

		this.zIndex = options.zIndex || 0;
        this.converter = null;
	}
    VectorLayer.prototype = Object.create(MapLayer.prototype);
    VectorLayer.prototype.constructor = VectorLayer;

    VectorLayer.prototype.tilePath = d3.geo.path().projection(d3.geo.mercator());

    VectorLayer.prototype.initTile = function(group, tile, translate, scale) {
        group.style('display', function(layer) {
                return layer.visible() ? 'block' : 'none';
            })

        return d3.json(this.makeURL(tile), callBack.bind(this));

        function callBack(error, json) {
            if (this.converter) {
                json = this.converter(json);
            }
            this.tilePath.projection()
                .translate(translate)
                .scale(scale);
            this.drawTile(group, json, this.tilePath);
        }
    }
    VectorLayer.prototype.drawTile = function(group, json, tilePath) {
      	group.selectAll("path")
          	.data(json.features)
			.enter().append("path")
            .attr(this.attr)
			.attr("d", tilePath);
    }

/*
Base for map control objects.
*/
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
			if (!arguments.length) {
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
            .attr('class', 'info-text')
            .text(avlmap.formatLocation(options.start, projection.scale()));

		function mousemoved() {
		  	info.text(avlmap.formatLocation(projection.invert(d3.mouse(this)), projection.scale()));
		}
    }
    InfoControl.prototype = Object.create(Control.prototype);
    InfoControl.prototype.constructor = InfoControl;

    function ZoomControl(mapObj, map, zoom, options) {
		Control.call(this, map, options);

        this.DOMel.append('div')
            .attr('class', 'avl-button avl-bold')
            .text('+')
            .on('click', function() {
                d3.event.stopPropagation();
                _clicked(1);
            })

        this.DOMel.append('div')
            .attr('class', 'avl-button avl-bold')
            .text('-')
            .on('click', function() {
                d3.event.stopPropagation();
                _clicked(-1);
            })

        function _clicked(direction) {
            d3.event.preventDefault();

            var width = mapObj.width(),
                height = mapObj.height(),

                scale = 2.0,
                targetZoom = zoom.scale() * Math.pow(scale, direction),
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
                return;
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

        this.update = function() {
            var buttons = this.DOMel
                .selectAll('div')
                .data(mapObj.layers().filter(function(d) { return !d.hidden; }), function(d) { return d.id; });
				
            buttons.exit().remove();

            buttons.enter().append('div')
                .attr('class', 'avl-list')
                .on('click', toggle);

            buttons
            	.classed('avl-inactive', function(d) { return !d.visible(); })
                .text(function(d) { return d.name; });
        }

        function toggle(layer) {
            d3.event.stopPropagation();

            var visible = layer.visible();

        	layer.visible(!visible);
        	d3.select(this).classed('avl-inactive', visible);
        }
    }
    LayerControl.prototype = Object.create(Control.prototype);
    LayerControl.prototype.constructor = LayerControl;

    function MarkerControl(mapObj, projection, zoom, map, options) {
		Control.call(this, map, options);

		this.update = function(data) {
            var buttons = this.DOMel
                .selectAll('div')
                .data(data, function(d) { return d.markerID; });

            buttons.exit().remove();

            buttons.enter().append('div')
                .attr('class', 'avl-list avl-active')
                .on('click', zoomTo);

            buttons.text(function(d) { return d.name; });
		}

        var markers = mapObj.MapMarker();
        this.update(markers.data());
        markers.on('dataupdate', this.update.bind(this));

        function zoomTo(d) {
            d3.event.stopPropagation();
            var width = mapObj.width(),
                height = mapObj.height();
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
			options.position = getPosition(options.position);

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
    			controls.layer.update();
    		}
    		else if (options.type == 'marker' && !controls.marker) {
    			options.id = 'avl-map-marker-control';

    			controls.marker = new MarkerControl(mapObj, projection, zoom, map, options);
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
                    return 'avl-'+pos;
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

    function MapMarker(map, projection) {
    	var data = [],
    		width = 20,
    		height = 40,
    		markers = null,
            dispatcher = d3.dispatch("dataupdate");

    	function marker(tiles) {
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
                    d3.select(this).style('background-image', function(d) {
                        if (d.image) {
                            return 'url('+d.image+')';
                        }
                        return 'url(/markers/avl_map_default_marker.png)';
                    })
    			});

    		markers.each(function(d) {
				var loc = projection(d.coords);

                // if (tiles) {
                //     var mod = 1 << (tiles[0][2]+8);
                //     loc[0] = (loc[0]%mod+mod)%mod;
                // }

				d3.select(this)
                    .style("transform", "translate("+(loc[0]-width/2)+"px,"+(loc[1]-height)+"px)");
			})
    	}
        marker.each = function(func) {
            markers.each(func);
        }
        marker.on = function(event, func) {
            if (!arguments.length) {
                return marker;
            }
            if (arguments.length == 1) {
                return dispatcher.on(event);
            }
            dispatcher.on(event, func);
            return marker;
        }
    	marker.data = function(d) {
    		if (!arguments.length) {
    			return data;
    		}
    		data = d;
            dispatcher.dataupdate(data);
    		return marker;
    	}
    	return marker;
    }

    function BrushZoom(mapObj, map) {
        window.addEventListener('keydown', keydown, true);
        window.addEventListener('keyup', keyup, true);

        var CTRL_KEY_CODE = 17,
        
            xScale = d3.scale.identity(),
            yScale = d3.scale.identity(),
            brush = d3.svg.brush()
                .x(xScale)
                .y(yScale)
                .on("brushstart", brushstart)
                .on("brushend", brushend);

        function keydown(key) {
            if (key.keyCode == CTRL_KEY_CODE) {
                brush.clear();

                var width = mapObj.width(),
                    height = mapObj.height();

                xScale.domain([0, width]);
                yScale.domain([0, height]);

                map.append('svg')
                    .attr('id', 'avl-map-svg-overlay')
                    .attr('class', 'avl-map-zoom-brush')
                    .style("width", width + "px")
                    .style("height", height + "px")
                    .call(brush);
            }
        }
        function keyup(key) {
            if (key.keyCode == CTRL_KEY_CODE) {
                d3.select('#avl-map-svg-overlay').remove();
            }
        }

        function brushstart() {
            d3.event.sourceEvent.stopPropagation();
        }

        function brushend() {
            if (brush.empty()) return;

            mapObj.zoomToBounds(brush.extent())
                .zoomMap();

            brush.clear();
            d3.select('#avl-map-svg-overlay').call(brush);
        }
    }

    function XHRcache() {
    	var cache = d3.map();

    	this.addXHR = function(xhr, tileID) {
    		if (!cache.has(tileID)) {
    			cache.set(tileID, []);
    		}
    		cache.get(tileID).push(xhr);
    	}

    	this.abortXHR = function(tileID) {
            var XHRlist = cache.get(tileID);

			while (XHRlist.length) {
                XHRlist.pop().abort();
            }
    	}
    }

var Tile = function() {
  var size = [960, 500],
      scale = 256,
      translate = [size[0] / 2, size[1] / 2],
      zoomDelta = 0,
      clampX = clamp,
      clampY = clamp;

  function tile() {
    var z = Math.max(Math.log(scale) / Math.LN2 - 8, 0),
        z0 = Math.round(z + zoomDelta),
        k = Math.pow(2, z - z0 + 8),
        origin = [(translate[0] - scale / 2) / k, (translate[1] - scale / 2) / k],
        tiles = [],
        w = 1 << z0,
        x0 = clampX(Math.floor(-origin[0]), w),
        y0 = clampY(Math.floor(-origin[1]), w),
        x1 = clampX(Math.ceil(size[0] / k - origin[0]), w),
        y1 = clampY(Math.ceil(size[1] / k - origin[1]), w);

    for (var y = y0; y < y1; ++y) {
      for (var x = x0; x < x1; ++x) {
        tiles.push([x, y, z0]);
      }
    }
    tiles.translate = origin;
    tiles.scale = k;

    return tiles;
  }

  tile.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return tile;
  };

  tile.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return tile;
  };

  tile.translate = function(_) {
    if (!arguments.length) return translate;
    translate = _;
    return tile;
  };

  tile.zoomDelta = function(_) {
    if (!arguments.length) return zoomDelta;
    zoomDelta = +_;
    return tile;
  };

  tile.overflow = function(_) {
    if (!arguments.length) return [clampX === identity, clampY === identity];
    clampX = _[0] ? identity : clamp;
    clampY = _[1] ? identity : clamp;
    return tile;
  };

  return tile;

  function identity(x, max) { return x; }
  function clamp(x, max) { return Math.max(0, Math.min(max, x)); }
};

	function AVLMap(options) {
		if (!('id' in options)) {
			options.id = '#avl-map';
		}

		AVLobject.call(this, options);

		if (!document.getElementById(this.id.slice(1))) {
			d3.select('body').append('div')
				.attr('id', this.id.slice(1))
				.attr('width', function() { return (window.innerWidth-this.offsetLeft)+'px'; })
				.attr('height', function() { return (window.innerHeight-this.offsetTop)+'px'; });
		}

        var minZoom = 1 << ((options.minZoom || 4) + 8),
            maxZoom = 1 << (Math.min((options.maxZoom || 17), 17) + 8),
            startZoom = options.startZoom ? 1 << (options.startZoom + 8) : minZoom,
            startLoc = options.startLoc || [-73.824, 42.686], // defaults to Albany, NY
            zoomExtent = [minZoom, maxZoom],

            map = d3.select(this.id)
                .append('div')
                .classed("avl-map", true),

            width = map.node().clientWidth || window.innerWidth,
            height = map.node().clientHeight || window.innerHeight,

		    prefix = prefixMatch(),

		    MAP_LAYERS = [],
            MAP_MARKERS = null,

		    xhrCache = new XHRcache(),

            controlsManager = null,

            tileGen = Tile()
                .size([width, height])
                .overflow([true, false]),

            currentZoom,

            projection = d3.geo.mercator()
    		    .scale(startZoom / 2 / Math.PI)
    		    .translate([-width / 2, -height / 2]),

            dispatcher = d3.dispatch('mapzoom', 'zoomchange');

        dispatcher.mapzoom.bind(this);
        dispatcher.zoomchange.bind(this);

		this.zoomMap = function() {
			tileGen.scale(zoom.scale())
			    .translate(zoom.translate());

			var tiles = tileGen();

            if (tiles[0][2] != currentZoom) {
                currentZoom = tiles[0][2];
                dispatcher.zoomchange(this, currentZoom);
            }

            var mod = 1 << (tiles[0][2]+8),     // 1 << z = the number of tiles required to represent the width of the world.
                                                // (1 << z) * 256 = number of pixels required to represent the world.
                translate = zoom.translate();

            zoom.translate([(translate[0]+mod)%mod, translate[1]])

			projection
			    .scale(zoom.scale() / 2 / Math.PI)
			    .translate(zoom.translate());

            dispatcher.mapzoom(tiles);

			vectorLayer.style(prefix + "transform", matrix3d(tiles.scale, tiles.translate))

            var vectorTiles = vectorLayer
			    .selectAll(".avl-tile")
			    .data(tiles, function(d) { return d; });

			vectorTiles.enter()
                .append("svg")
				.attr("class", "avl-tile")
				.style("left", function(d) { return (d[0] << 8) + "px"; })
			    .style("top", function(d) { return (d[1] << 8) + "px"; })
                .each(function(tile, i) {
                    var k = 1 << (tile[2]+7),
                        translate = [k - tile[0] * 256, k - tile[1] * 256],
                        scale = k / Math.PI,

                        z = tile[2],
                        k0 = 1 << z,
                        x = (tile[0] + k0) % k0,
                        y = tile[1],

                        tileID = 'tile-'+tile.join('-');

                    this.tileID = tileID;

                    d3.select(this).selectAll('g')
                        .data(MAP_LAYERS.sort(function(a, b) { return a.zIndex-b.zIndex; }))
                        .enter().append('g')
                        .attr('class', function(layer) { return layer.id; })
                        .each(function(layer) {
                            var xhr = layer.initTile(d3.select(this), [x, y, z], translate, scale);
                            xhrCache.addXHR(xhr, tileID);
                        });
                }) // end vectorTiles.each(...)

            vectorTiles.exit()
                .each(function() { xhrCache.abortXHR(this.tileID); })
                .remove();
		}

        var zoom = d3.behavior.zoom()
            .scale(startZoom)
            .scaleExtent(zoomExtent)
            .translate(projection(startLoc).map(function(x) { return -x; }))
            .on("zoom.avl-map", this.zoomMap);

        map.style({
                width: width+"px",
                height: height+"px"
            })
            .call(zoom)
            .on("dragstart.avl-map", function() {
                d3.event.sourceEvent.stopPropagation(); // silence other listeners
            })

        BrushZoom(this, map);

        var vectorLayer = map.append("g")
            .attr("class", "avl-layer");

		this.layers = function(layer) {
			if (!arguments.length) {
				return MAP_LAYERS;
			}
			
            MAP_LAYERS.push(layer);

			if (controlsManager) {
				controlsManager.update('layer');
			}

			this.zoomMap();

			return this;
		}

        this.addLayer = function(layer) {
            return this.layers(layer);
        }
		this.removeLayer = function(layer) {
			var index = MAP_LAYERS.indexOf(layer);
			if (index >= 0) {
				MAP_LAYERS.splice(index, 1);
			}

			if (controlsManager) {
				controlsManager.update('layer');
			}

			d3.selectAll('.'+layer.id).remove();

			return this;
		}

		this.addControl = function(options) {
			if (!controlsManager) {
				controlsManager = new ControlsManager(this, map, projection, zoom);
			}
            if (options.type == 'info') {
                options.start = startLoc;
            }
			controlsManager.addControl(options);

			return this;
		}

		this.MapMarker = function() {
			if (!MAP_MARKERS) {
				MAP_MARKERS = MapMarker(map, projection);
                dispatcher.on('mapzoom.mapmarkers', MAP_MARKERS);
			}

			return MAP_MARKERS;
		}

        this.on = function(event, func) {
            if (!arguments.length) {
                return this;
            }
            if (arguments.length == 1) {
                return dispatcher.on(event);
            }
            dispatcher.on(event, func);
            return this;
        }

        this.zoomToBounds = function(bounds) {
            var wdth = bounds[1][0] - bounds[0][0],
                hght = bounds[1][1] - bounds[0][1],

                k = Math.min(width/wdth, height/hght),
                desiredScale = zoom.scale()*k;

            if (desiredScale > maxZoom) {
                desiredScale = maxZoom;
                k = maxZoom / zoom.scale();
            }

            var centroid = [(bounds[1][0]+bounds[0][0])/2, (bounds[1][1]+bounds[0][1])/2]//,
                translate = zoom.translate();

            zoom.scale(desiredScale)
                .translate([translate[0]*k - centroid[0]*k + width / 2,
                            translate[1]*k - centroid[1]*k + height / 2]);

            return this;
        }

        this.width = function(w) {
            if (!arguments.length) {
                return width;
            }
            updateMapSize(w, height);
            return this;
        }
        this.height = function(h) {
            if (!arguments.length) {
                return height;
            }
            updateMapSize(width, h);
            return this;
        }
        this.size = function(s) {
            if (!arguments.length) {
                return [width, height];
            }
            updateMapSize(s[0], s[1]);
            return this;
        }

        var updateMapSize = function(newWidth, newHeight) {
            var translate = zoom.translate();
            zoom.translate([translate[0]+(newWidth-width)/2, translate[1]+(newHeight-height)/2]);
            width = newWidth;
            height = newHeight;
            tileGen.size([width, height]);
            map.style("width", width + "px")
                .style("height", height + "px")
            this.zoomMap();
        }.bind(this);

        this.projection = function(p) {
            if (!arguments.length) {
                return projection;
            }
            projection = p;
            return this;
        }
	}
    AVLMap.prototype = Object.create(AVLMap.prototype);
    AVLMap.prototype.constructor = AVLMap;

    // ################################ //
    // private functions                //
    // ################################ //
	function matrix3d(scale, translate) {
	  	var k = scale / 256, r = scale % 1 ? Number : Math.round;
	  	return "matrix3d(" + [k, 0, 0, 0,
	  						  0, k, 0, 0,
	  						  0, 0, 1, 0,
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

	// ############################### //
	// public constructor functions    //
	// ############################### //
	avlmap.Map = function(options) {
		return new AVLMap(options || {});
	}

	avlmap.VectorLayer = function(options) {
		return new VectorLayer(options);
	}

	avlmap.RasterLayer = function(options) {
		return new RasterLayer(options);
	}

    // ################################ //
    // public functions                 //
    // ################################ //
    avlmap.formatLocation = function(p, k) {
        var format = d3.format("." + Math.floor(Math.log(k) / 2 - 2) + "f");

        return (p[1] < 0 ? format(-p[1]) + "°S" : format(p[1]) + "°N") + "   "
             + (p[0] < 0 ? format(-p[0]) + "°W" : format(p[0]) + "°E");
    }

	this.avlmap = avlmap;
})()