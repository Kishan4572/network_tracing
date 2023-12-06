// 2.108 SECONDS WITH 3537 FEATURES
// JavaScript toFixed() is very slow,

// self.importScripts('./turf.min.js');

const toPoint = (geom) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: geom },
  properties: {},
});

const toLine = (geom) => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: geom },
  properties: {},
});

const toFCollection = (features) => ({
  type: "FeatureCollection",
  features: features || [],
});

var workerMasterNetwork = {
  type: "FeatureCollection",
  features: [],
};

var workerMasterPointNetwork = {
  type: "FeatureCollection",
  features: [],
};

var workerIds = [];

var networkIndex = [];

var networkTree = {
  type: "FeatureCollection",
  name: "networkTree",
  features: [],
};

var netowrkTimeCheck = Date.now();

self.addEventListener(
  "message",
  function (e) {
    // LOG ANY MESSAGES FOR DEBUGGING
    // this.console.log(e)

    if (e.data.features && e.data.name === "network") {
      workerMasterNetwork.features = e.data.features.slice();

      var linestring = toFCollection();
      for (let i = 0; i < workerMasterNetwork.features.length; i++) {
        const feature = workerMasterNetwork.features[i];
        if (feature.geometry.coordinates[0][0].length) {
          for (let j = 0; j < feature.geometry.coordinates.length; j++) {
            const line = feature.geometry.coordinates[j];
            linestring.features.push(toLine(geojsonPrecision(line, 8)));
          }
        } else {
          linestring.features.push(geojsonPrecision(feature, 8));
        }
      }
      workerMasterNetwork.features = linestring.features.slice();
      // console.log(workerMasterNetwork)

      var geometryTypeCheck = true;

      //CHECKING THAT THE CONVERSION WORKED
      workerMasterNetwork.features.reduce((i, f) => {
        if (f.geometry.type != "LineString") error = true;
        return [...i, f.geometry.type];
      }, []);

      if (geometryTypeCheck) {
        console.log("all geometries are linestrings, the tool should work");
      } else {
        console.warn("all geometries are not linestrings, the tool may break");
        alert("all geometries are not linestrings, the tool may break");
      }

      this.console.log(
        "worker added",
        workerMasterNetwork.features.length,
        "features to the master linear network "
      );
    }

    if (e.data.features && e.data.name === "pointNetwork") {
      workerMasterPointNetwork.features = e.data.features.slice();
      this.console.log(
        "worker added",
        workerMasterPointNetwork.features.length,
        "features to the master point network "
      );
    }

    if (!e.data.features && e.data.geometry && e.data.geometry.type === "Point") {
      console.log("trace request", e.data);
      // GRAB CURRENT TIME TO CHECK DURATION OF NETWORK TRACE
      netowrkTimeCheck = Date.now();

      // RESET NETWORK TREE & WORKER IDS
      networkTree.features = [];

      workerIds = new Array(workerMasterNetwork.features.length);
      networkIndex = new Array(workerMasterNetwork.features.length);

      networkIndex[e.data.properties.index] = {
        up: [e.data.properties.index],
      };
      console.log(networkIndex)
      var featureId = e.data.properties.index;

      //GET SEED FEATURES
      var networkFeatureCollection = networkLines(e.data, workerMasterNetwork, null, featureId);
     
      networkTree.features = networkFeatureCollection.features.slice(0);

      //BUILD NETWORK
      networkBuild(networkFeatureCollection, workerMasterNetwork, e.data.name);
    }
  },
  false
);

function networkBuild(lines, network, string) {
  let direction = string;
  // GET ALL UPSTREAM POINTS
  var networkPoints = [];

  if (direction === "upstream" || direction === "downstream") {
    // IGNORE LATERALS
    for (let i = 0; i < lines.features.length; i++) {
      //NOTE conver the line to an array of points
      let f = lines.features[i];
      let coords = f.geometry.coordinates[0][0].length
        ? splitMultiLine(f.geometry.coordinates)
        : f.geometry.coordinates;
      //NOTE get the first or last point depending on direction
      let netowrkDirection = direction === "upstream" ? 0 : coords.length - 1;
      networkPoints.push(coords[netowrkDirection]);
    }
  } else {
    //INCLUDE LATERALS
    for (let i = 0; i < lines.features.length; i++) {
      let f = lines.features[i];
      let coords = f.geometry.coordinates[0][0].length
        ? splitMultiLine(f.geometry.coordinates)
        : f.geometry.coordinates;
      for (let i = 0; i < coords.length; i++) {
        networkPoints.push(f.geometry.coordinates[i]);
      }
    }
  }

  var tempFeatures = {
    type: "FeatureCollection",
    features: [],
  };

  // GET NETWORK LINES FROM THESE POINTS
  for (let p = 0; p < networkPoints.length; p++) {
    var point = toPoint(networkPoints[p]);
    var tempFeatures02 = networkLines(point, network, direction);
    for (let i = 0; i < tempFeatures02.features.length; i++) {
      let f = tempFeatures02.features[i];
      tempFeatures.features.push(f);
      networkTree.features.push(f);
    }
  }
  if (tempFeatures.features.length > 0) {
    networkBuild(tempFeatures, network, direction);
  } else {
    if (direction === "upstream" || direction === "laterals") {
      console.log("network features:", networkTree.features.length);
    }
    console.log("network trace:", Date.now() - netowrkTimeCheck, "ms");
    self.postMessage(networkTree);
  }

}

function networkLines(point, network, string, id) {
  var a = point.geometry.coordinates;
  let direction = !string ? point.name : string;
  var networkSeed = [];
 
  for (var i = 0; i < network.features.length; i++) {
    if (workerIds[i]) {
      continue;
    }

    var f = network.features[i];

    //TEST REPLACEMENT FOR POINT ON LINE booleanOnLine = 1500s, without = 0.200s
    //NOTE check if the point is in the line vertices - the point needs to exist in the line vertices
    var pointInLineVertices = false;
    f.geometry.coordinates.map((c) => {
      if (a[0] == c[0] && a[1] == c[1]) pointInLineVertices = true;
    });

    if (pointInLineVertices) {
      // if (turf.booleanPointOnLine(point, f)) {
      var d =
        direction === "upstream" || direction === "laterals"
          ? 0
          : f.geometry.coordinates.length - 1;
      var b = f.geometry.coordinates[d];
      if (a[0] != b[0] || a[1] != b[1]) {
        workerIds[i] = 1;
        networkSeed.push(f);
        if (!networkIndex[id]) {
          networkIndex[id] = {
            up: [i],
          };
        } else {
          networkIndex[id].up = [i, ...new Set(networkIndex[id].up)];
        }
      }
    }
  }

  return toFCollection(networkSeed);
}

function splitMultiLine(array) {
  return array.reduce((i, a) => {
    return [...i, ...a];
  }, []);
}

function geojsonPrecision(t, coordinatePrecision, extrasPrecision) {
  function point(p) {
    return p.map(function (e, index) {
      if (index < 2) {
        return 1 * e.toFixed(coordinatePrecision);
      } else {
        return 1 * e.toFixed(extrasPrecision);
      }
    });
  }

  function multi(l) {
    return l.map(point);
  }

  function poly(p) {
    return p.map(multi);
  }

  function multiPoly(m) {
    return m.map(poly);
  }

  function geometry(obj) {
    if (!obj) {
      return {};
    }

    switch (obj.type) {
      case "Point":
        obj.coordinates = point(obj.coordinates);
        return obj;
      case "LineString":
      case "MultiPoint":
        obj.coordinates = multi(obj.coordinates);
        return obj;
      case "Polygon":
      case "MultiLineString":
        obj.coordinates = poly(obj.coordinates);
        return obj;
      case "MultiPolygon":
        obj.coordinates = multiPoly(obj.coordinates);
        return obj;
      case "GeometryCollection":
        obj.geometries = obj.geometries.map(geometry);
        return obj;
      default:
        return {};
    }
  }

  function feature(obj) {
    obj.geometry = geometry(obj.geometry);
    return obj;
  }

  function _featureCollection(f) {
    f.features = f.features.map(feature);
    return f;
  }

  function geometryCollection(g) {
    g.geometries = g.geometries.map(geometry);
    return g;
  }

  if (!t) {
    return t;
  }

  switch (t.type) {
    case "Feature":
      return feature(t);
    case "GeometryCollection":
      return geometryCollection(t);
    case "FeatureCollection":
      return _featureCollection(t);
    case "Point":
    case "LineString":
    case "Polygon":
    case "MultiPoint":
    case "MultiPolygon":
    case "MultiLineString":
      return geometry(t);
    default:
      return t;
  }
}