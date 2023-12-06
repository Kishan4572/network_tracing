class NetworkControl {
  constructor(options) {
    console.log({ networkTraceOptions: options.options });

    this._options = { ...{ state: "none" }, ...options.options };

    this._worker = new Worker("./lib/networkControlWorker.js");
    this._map = this._options.map || null;
    this._traceDirection = this._options.state;

    this._originPoints = this._options.originPoints || {};
    this._originNetwork = this._options.linearNetwork || {};
    this._originLayer = this._options.originLayer || "";
    this._color = this._options.color || "yellow";

    this._linearNetwork = {
      type: "FeatureCollection",
      features: [],
    };
    this._linearNetwork.features = this._originNetwork.features.slice(0);
    this._linearNetwork["name"] = "network";

    this._blankGeoJSON = {
      type: "FeatureCollection",
      features: [],
    };

    this._workerLayer = L.featureGroup().addTo(this._map)

    this.toggleTrace = this.toggleTrace.bind(this);
    this.trace = this.trace.bind(this);

    this._worker.addEventListener(
      "message",
      (e) => {
        if (e.data.name && e.data.name === "networkTree") {
          console.log({ data: e.data });
          this._workerLayer.addLayer(L.geoJSON(e.data, { color: this._color }))
        }
      },
      false
    );

    this._worker.postMessage(this._linearNetwork);
    this._originPoints.name = "pointNetwork";
    this._worker.postMessage(this._originPoints);

  }

  mapClick() {
    if (this._workerLayer.getLayers().length > 0) {
      this._workerLayer.clearLayers();
    }
  }

  toggleTrace() {
    if (this._traceDirection === "upstream") {
      this._traceDirection = "downstream";
    } else {
      this._traceDirection = "upstream";
    }

    console.log("Trace direction toggled:", this._traceDirection);
  }

  onMapClick(e) {
    this._originLayer.off("click", this.onMapClick);

    switch (this._traceDirection) {
      case "upstream":
      case "laterals":
      case "downstream":
        this.trace(e);
        break;
      case "none":
        // Handle none state if needed
        break;
    }
  }

  trace(e) {
    this._workerLayer.clearLayers()

    const point = e.layer.feature
    point.name = this._traceDirection
   
    // Assuming you have a reference to your GeoJSON layer
    this._workerLayer.addLayer(L.geoJSON(point, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          fillOpacity: 0.8,
          "fillColor": "cyan",
          "radius": 6,
          "color": "red",
          "weight": 2,
          "opacity": 0.9
        });
      },
    }))

    this._worker.postMessage(point);
  }

  startTrace() {
    this._originLayer.on("click", this.onMapClick.bind(this));
    this._map.on("click", this.mapClick.bind(this));
  }

  stopTrace() {
    this._map.off("click", this.onMapClick);
  }

}